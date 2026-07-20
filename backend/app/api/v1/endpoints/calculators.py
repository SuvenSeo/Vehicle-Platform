from fastapi import APIRouter, Depends, HTTPException, Query, Header
from pydantic import BaseModel, Field
import httpx
import logging
from typing import Literal, Optional, List
from decimal import Decimal
from sqlalchemy.orm import Session
from app.services.rate_limit import RateLimiter
from db.session import get_db
from db.models import VehiclePermit
import secrets
import os

# 120/min: the calculator UI recalculates as users adjust inputs (debounced
# client-side), so an active session legitimately produces bursts.
_calculators_rate_limiter = RateLimiter(max_requests=120, window_seconds=60)

router = APIRouter(dependencies=[Depends(_calculators_rate_limiter)])
logger = logging.getLogger("motormila.calculators")

# Fallback fuel prices in LKR
FALLBACK_PETROL_92 = 370.0
FALLBACK_PETROL_95 = 410.0
FALLBACK_DIESEL = 320.0
FALLBACK_ELECTRIC_KWH = 35.0

class LandedCostRequest(BaseModel):
    cif_usd: float = Field(..., gt=0, description="CIF value of the vehicle in USD")
    exchange_rate: float = Field(300.0, gt=0, description="USD to LKR exchange rate")
    fuel_type: Literal["petrol", "diesel", "hybrid", "electric"] = Field(..., description="Vehicle fuel type")
    engine_cc: Optional[int] = Field(None, ge=0, description="Engine capacity in CC (for ICE and hybrids)")
    motor_kw: Optional[int] = Field(None, ge=0, description="Motor power in kW (for electric vehicles)")
    apply_surcharge: bool = Field(True, description="Apply the 50% CID surcharge")
    apply_sscl: bool = Field(True, description="Apply 2.5% SSCL")

class LandedCostResponse(BaseModel):
    cif_lkr: float
    cid: float
    surcharge: float
    excise: float
    sscl: float
    vat: float
    luxury_tax: float
    total_tax: float
    landed_cost: float
    surcharge_applied: bool
    notes: str

class TCORequest(BaseModel):
    daily_km: float = Field(40.0, ge=0, description="Average daily commute distance in km")
    fuel_type: Literal["petrol", "diesel", "hybrid", "electric"] = Field(..., description="Fuel type")
    mileage_kmpl: float = Field(..., gt=0, description="Fuel/energy efficiency (km/L or km/kWh for EV)")
    lease_installment: float = Field(0.0, ge=0, description="Monthly lease installment in LKR")
    insurance_annual: float = Field(120000.0, ge=0, description="Annual insurance premium in LKR")
    service_annual: float = Field(60000.0, ge=0, description="Annual maintenance and service cost in LKR")
    tyres_annual: float = Field(30000.0, ge=0, description="Annual tyre replacement allocation in LKR")
    resale_loss_annual: float = Field(100000.0, ge=0, description="Estimated annual depreciation loss in LKR")

class TCOResponse(BaseModel):
    fuel_price_lkr: float
    fuel_cost_monthly: float
    lease_cost_monthly: float
    overhead_cost_monthly: float
    total_tco_monthly: float
    notes: str

class PermitCreate(BaseModel):
    permit_name: str = Field(..., min_length=2, max_length=100)
    permit_type: str = Field(..., min_length=2, max_length=50)
    market_price_lkr: float = Field(..., ge=0)

class PermitRead(PermitCreate):
    id: int

# Excise band configurations
EXCISE_PETROL = [
    (1000, 2450.0),
    (1300, 3850.0),
    (1500, 4450.0),
    (1800, 5150.0),
    (2000, 6400.0),
    (2500, 7700.0),
    (float('inf'), 8900.0)
]

EXCISE_HYBRID = [
    (1000, 2100.0),
    (1300, 3300.0),
    (1500, 3850.0),
    (1800, 4700.0),
    (2000, 5600.0),
    (2500, 7100.0),
    (float('inf'), 8400.0)
]

EXCISE_DIESEL = [
    (1500, 5150.0),
    (1800, 6150.0),
    (2000, 7100.0),
    (2500, 8400.0),
    (float('inf'), 9650.0)
]

EXCISE_ELECTRIC = [
    (50, 12500.0),
    (100, 25000.0),
    (200, 43000.0),
    (float('inf'), 55000.0)
]

LUXURY_TAX_THRESHOLDS = {
    "petrol": (5000000.0, 1.00),
    "diesel": (5000000.0, 1.20),
    "hybrid": (5500000.0, 0.80),
    "electric": (6000000.0, 0.60)
}

def get_rate(bands, value):
    for limit, rate in bands:
        if value <= limit:
            return rate
    return bands[-1][1]

def require_admin_key(x_admin_key: str | None = Header(default=None, alias="X-Admin-Key")):
    configured_key = os.getenv("ADMIN_API_KEY", "").strip()
    if not configured_key:
        raise HTTPException(status_code=503, detail="Admin feature is not configured.")
    if not x_admin_key or not secrets.compare_digest(x_admin_key, configured_key):
        raise HTTPException(status_code=401, detail="Invalid admin key.")

@router.post("/landed-cost", response_model=LandedCostResponse)
def calculate_landed_cost(payload: LandedCostRequest):
    cif_lkr = payload.cif_usd * payload.exchange_rate

    # 1. CID (20% default)
    cid_rate = 0.20
    cid = cif_lkr * cid_rate

    # 2. CID Surcharge (50% of CID, compounds)
    surcharge = cid * 0.50 if payload.apply_surcharge else 0.0

    # 3. Excise Duty
    excise = 0.0
    if payload.fuel_type == "electric":
        if payload.motor_kw is None:
            raise HTTPException(status_code=422, detail="motor_kw is required for electric vehicles")
        rate = get_rate(EXCISE_ELECTRIC, payload.motor_kw)
        excise = payload.motor_kw * rate
    else:
        if payload.engine_cc is None:
            raise HTTPException(status_code=422, detail="engine_cc is required for petrol, diesel, and hybrid vehicles")
        
        if payload.fuel_type == "petrol":
            rate = get_rate(EXCISE_PETROL, payload.engine_cc)
        elif payload.fuel_type == "hybrid":
            rate = get_rate(EXCISE_HYBRID, payload.engine_cc)
        else: # diesel
            rate = get_rate(EXCISE_DIESEL, payload.engine_cc)
        
        excise = payload.engine_cc * rate

    # 4. SSCL (2.5%)
    sscl = 0.0
    if payload.apply_sscl:
        sscl = (cif_lkr + cid + surcharge + excise) * 0.025

    # 5. VAT (18%)
    vat = (cif_lkr + cid + surcharge + excise + sscl) * 0.18

    # 6. Luxury Tax (applied on CIF excess above threshold)
    threshold, rate_excess = LUXURY_TAX_THRESHOLDS[payload.fuel_type]
    luxury_tax = max(0.0, cif_lkr - threshold) * rate_excess

    total_tax = cid + surcharge + excise + sscl + vat + luxury_tax
    landed_cost = cif_lkr + total_tax

    note_text = f"Calculated with {payload.exchange_rate} USD/LKR rate. "
    if payload.apply_surcharge:
        note_text += "Includes 50% CID surcharge per gazette. "
    if payload.fuel_type == "hybrid" and payload.engine_cc and payload.engine_cc <= 1500:
        note_text += "Sits under the 1500cc hybrid tax cliff band. "

    return LandedCostResponse(
        cif_lkr=round(cif_lkr, 2),
        cid=round(cid, 2),
        surcharge=round(surcharge, 2),
        excise=round(excise, 2),
        sscl=round(sscl, 2),
        vat=round(vat, 2),
        luxury_tax=round(luxury_tax, 2),
        total_tax=round(total_tax, 2),
        landed_cost=round(landed_cost, 2),
        surcharge_applied=payload.apply_surcharge,
        notes=note_text
    )

@router.post("/tco", response_model=TCOResponse)
async def calculate_tco(payload: TCORequest):
    fuel_price = FALLBACK_PETROL_95
    source_notes = "Using fallback fuel prices. "

    # Attempt to fetch live fuel prices from Octane API
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            res = await client.get("https://octane-smoky.vercel.app/api/fuel-price")
            if res.status_code == 200:
                data = res.json()
                prices = data.get("prices", {})
                if payload.fuel_type == "petrol" or payload.fuel_type == "hybrid":
                    fuel_price = float(prices.get("petrol_95", FALLBACK_PETROL_95))
                elif payload.fuel_type == "diesel":
                    fuel_price = float(prices.get("auto_diesel", FALLBACK_DIESEL))
                else: # electric
                    fuel_price = FALLBACK_ELECTRIC_KWH
                source_notes = "Using live fuel prices from Octane API. "
    except Exception as exc:
        logger.warning(f"Failed to fetch live fuel prices, fallback applied: {exc}")
        if payload.fuel_type == "petrol" or payload.fuel_type == "hybrid":
            fuel_price = FALLBACK_PETROL_95
        elif payload.fuel_type == "diesel":
            fuel_price = FALLBACK_DIESEL
        else: # electric
            fuel_price = FALLBACK_ELECTRIC_KWH

    # Calculate monthly fuel costs
    # Monthly distance = daily distance * 30 days
    monthly_km = payload.daily_km * 30.0
    fuel_cost_monthly = (monthly_km / payload.mileage_kmpl) * fuel_price

    # Lease installment is already monthly
    lease_cost_monthly = payload.lease_installment

    # Calculate other monthly amortized overheads
    overhead_cost_monthly = (
        payload.insurance_annual + 
        payload.service_annual + 
        payload.tyres_annual + 
        payload.resale_loss_annual
    ) / 12.0

    total_tco_monthly = fuel_cost_monthly + lease_cost_monthly + overhead_cost_monthly

    return TCOResponse(
        fuel_price_lkr=round(fuel_price, 2),
        fuel_cost_monthly=round(fuel_cost_monthly, 2),
        lease_cost_monthly=round(lease_cost_monthly, 2),
        overhead_cost_monthly=round(overhead_cost_monthly, 2),
        total_tco_monthly=round(total_tco_monthly, 2),
        notes=source_notes
    )

@router.get("/permits", response_model=List[PermitRead])
def get_permits(db: Session = Depends(get_db)):
    return db.query(VehiclePermit).order_by(VehiclePermit.market_price_lkr.desc()).all()

@router.post("/permits", response_model=PermitRead, dependencies=[Depends(require_admin_key)])
def create_or_update_permit(payload: PermitCreate, db: Session = Depends(get_db)):
    permit = db.query(VehiclePermit).filter(VehiclePermit.permit_name == payload.permit_name).first()
    if permit:
        permit.permit_type = payload.permit_type
        permit.market_price_lkr = payload.market_price_lkr
    else:
        permit = VehiclePermit(
            permit_name=payload.permit_name,
            permit_type=payload.permit_type,
            market_price_lkr=payload.market_price_lkr
        )
        db.add(permit)
    
    try:
        db.commit()
        db.refresh(permit)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database update failed: {e}")
        
    return permit
