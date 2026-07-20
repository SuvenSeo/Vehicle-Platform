"""Vehicle History, Insurance Quotes, and Loan Applications API endpoints.

Phase 1 Trust Infrastructure endpoints for:
- Vehicle history reports (AA Sri Lanka integration)
- Insurance quote comparison (5+ insurers)
- Loan pre-approval marketplace (6+ banks)
"""
import structlog
from typing import Optional, List, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from db.session import get_db
from db.models import CarListing
from app.services.vehicle_history import VehicleHistoryService
from app.services.insurance_quotes import InsuranceQuoteService
from app.services.loan_applications import LoanApplicationService

logger = structlog.get_logger()

router = APIRouter()


# ==================== Request/Response Models ====================

class VehicleHistoryRequest(BaseModel):
    listing_id: int
    vin_chassis_number: Optional[str] = None
    registration_number: Optional[str] = None


class VehicleHistoryResponse(BaseModel):
    id: int
    listing_id: int
    status: str
    payment_status: str
    report_cost_lkr: float
    accident_count: Optional[int] = None
    ownership_count: Optional[int] = None
    is_stolen: bool = False
    is_written_off: bool = False
    aa_verified: bool = False
    generated_at: Optional[str] = None
    report_url: Optional[str] = None
    
    class Config:
        from_attributes = True


class InsuranceQuoteRequest(BaseModel):
    listing_id: Optional[int] = None
    make: str
    model: str
    year: int
    price_lkr: float
    fuel_type: Optional[str] = None
    body_type: Optional[str] = None
    driver_age: Optional[int] = None
    driver_gender: Optional[str] = None
    driving_experience_years: Optional[int] = None
    no_claim_discount: bool = False
    previous_claims: int = 0
    coverage_type: str = 'comprehensive'
    voluntary_excess: Optional[float] = None
    add_ons: Optional[List[str]] = None


class InsuranceQuoteResponse(BaseModel):
    id: int
    insurer_name: str
    premium_amount: float
    sum_insured: float
    excess_amount: float
    coverage_type: str
    commission_amount: float
    quote_reference: str
    expires_at: Optional[str] = None
    
    class Config:
        from_attributes = True


class LoanApplicationRequest(BaseModel):
    listing_id: Optional[int] = None
    applicant_name: str = Field(..., min_length=2, max_length=100)
    nic_number: str = Field(..., min_length=9, max_length=20)
    email: str = Field(..., pattern=r'^[^@]+@[^@]+\.[^@]+$')
    phone: str = Field(..., min_length=7, max_length=20)
    vehicle_price: float = Field(..., gt=0)
    make: str
    model: str
    year: int
    mileage: Optional[int] = None
    employment_status: Optional[str] = None
    monthly_income: Optional[float] = None
    employer_name: Optional[str] = None
    employment_duration_months: Optional[int] = None
    down_payment: Optional[float] = None
    loan_amount_requested: Optional[float] = None
    loan_tenor_months: int = 60
    existing_loans: int = 0
    existing_loan_emis: float = 0
    preferred_banks: Optional[List[str]] = None
    credit_score: Optional[int] = None


class LoanApplicationResponse(BaseModel):
    application_reference: str
    application_status: str
    loan_amount_requested: float
    approved_banks: Optional[List[str]] = None
    best_offer_bank: Optional[str] = None
    best_offer_rate: Optional[float] = None
    best_offer_amount: Optional[float] = None
    
    class Config:
        from_attributes = True


# ==================== Vehicle History Endpoints ====================

@router.post("/vehicle-history/request", response_model=VehicleHistoryResponse, tags=["Trust Services"])
def request_vehicle_history_report(
    request: VehicleHistoryRequest,
    user_session_id: str = Query(..., description="User session identifier"),
    db: Session = Depends(get_db)
):
    """Request a vehicle history report for a listing.
    
    Reports include:
    - Accident history and severity
    - Ownership chain
    - Odometer readings timeline
    - Service records
    - Insurance claims
    - Theft/write-off status
    - AA Sri Lanka verification
    
    Price: Rs. 1,000 per report
    """
    # Verify listing exists
    listing = db.query(CarListing).filter(
        CarListing.id == request.listing_id
    ).first()
    
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    
    try:
        service = VehicleHistoryService(db)
        
        # Create report request
        report = service.create_report_request(
            listing_id=request.listing_id,
            vin_chassis_number=request.vin_chassis_number,
            registration_number=request.registration_number
        )
        
        # For demo purposes, generate mock report immediately
        # In production, this would be async with payment gateway
        mock_data = service.generate_mock_report(request.listing_id)
        service.update_report_status(report.id, 'ready', mock_data)
        service.mark_payment_completed(report.id, f"DEMO-{user_session_id}")
        
        return report
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/vehicle-history/{listing_id}", response_model=Optional[VehicleHistoryResponse], tags=["Trust Services"])
def get_vehicle_history_report(
    listing_id: int,
    db: Session = Depends(get_db)
):
    """Get existing vehicle history report for a listing."""
    service = VehicleHistoryService(db)
    report = service.get_report_by_listing(listing_id)
    
    if not report:
        return None
    
    return report


@router.get("/vehicle-history/report/{report_id}", response_model=VehicleHistoryResponse, tags=["Trust Services"])
def get_report_by_id(
    report_id: int,
    db: Session = Depends(get_db)
):
    """Get vehicle history report by ID."""
    service = VehicleHistoryService(db)
    report = service.get_report_by_id(report_id)
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    return report


# ==================== Insurance Quote Endpoints ====================

@router.post("/insurance/quotes", response_model=List[InsuranceQuoteResponse], tags=["Trust Services"])
def get_insurance_quotes(
    request: InsuranceQuoteRequest,
    user_session_id: str = Query(..., description="User session identifier"),
    db: Session = Depends(get_db)
):
    """Get insurance quotes from multiple providers.
    
    Compares quotes from:
    - Ceylinco Insurance
    - Union Assurance
    - AIA Insurance
    - Softlogic Insurance
    - Janashakthi Insurance
    
    Commission: 7-8.5% per policy sold
    """
    # If listing_id provided, verify it exists
    if request.listing_id:
        listing = db.query(CarListing).filter(
            CarListing.id == request.listing_id
        ).first()
        
        if not listing:
            raise HTTPException(status_code=404, detail="Listing not found")
    
    try:
        service = InsuranceQuoteService(db)
        
        quotes = service.create_quote_request(
            user_session_id=user_session_id,
            listing_id=request.listing_id,
            make=request.make,
            model=request.model,
            year=request.year,
            price_lkr=request.price_lkr,
            fuel_type=request.fuel_type,
            body_type=request.body_type,
            driver_age=request.driver_age,
            driver_gender=request.driver_gender,
            driving_experience_years=request.driving_experience_years,
            no_claim_discount=request.no_claim_discount,
            previous_claims=request.previous_claims,
            coverage_type=request.coverage_type,
            voluntary_excess=request.voluntary_excess,
            add_ons=request.add_ons
        )
        
        return quotes
        
    except Exception as e:
        logger.error("insurance_quote_error", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to generate quotes")


@router.get("/insurance/quotes/session/{session_id}", response_model=List[InsuranceQuoteResponse], tags=["Trust Services"])
def get_quotes_by_session(
    session_id: str,
    db: Session = Depends(get_db)
):
    """Get all active quotes for a user session."""
    service = InsuranceQuoteService(db)
    quotes = service.get_quotes_by_session(session_id)
    return quotes


@router.get("/insurance/quotes/listing/{listing_id}", response_model=List[InsuranceQuoteResponse], tags=["Trust Services"])
def get_quotes_by_listing(
    listing_id: int,
    db: Session = Depends(get_db)
):
    """Get best insurance quotes for a specific listing."""
    service = InsuranceQuoteService(db)
    quotes = service.get_quotes_by_listing(listing_id)
    return quotes


@router.post("/insurance/quotes/{quote_id}/purchase", tags=["Trust Services"])
def purchase_insurance_quote(
    quote_id: int,
    policy_number: str = Query(..., description="Generated policy number"),
    db: Session = Depends(get_db)
):
    """Mark an insurance quote as purchased."""
    service = InsuranceQuoteService(db)
    quote = service.mark_quote_purchased(quote_id, policy_number)
    
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    return {
        "success": True,
        "message": "Insurance policy purchased successfully",
        "policy_number": policy_number,
        "commission_earned": quote.commission_amount
    }


# ==================== Loan Application Endpoints ====================

@router.post("/loans/apply", response_model=LoanApplicationResponse, tags=["Trust Services"])
def apply_for_loan(
    request: LoanApplicationRequest,
    user_session_id: str = Query(..., description="User session identifier"),
    db: Session = Depends(get_db)
):
    """Apply for vehicle loan pre-approval from multiple banks.
    
    Routes application to:
    - Commercial Bank
    - Sampath Bank
    - HNB
    - Bank of Ceylon
    - DFCC Bank
    - Seylan Bank
    
    Lead generation fee: Rs. 3,000 per approved lead
    """
    # If listing_id provided, verify it exists
    if request.listing_id:
        listing = db.query(CarListing).filter(
            CarListing.id == request.listing_id
        ).first()
        
        if not listing:
            raise HTTPException(status_code=404, detail="Listing not found")
    
    try:
        service = LoanApplicationService(db)
        
        application = service.create_loan_application(
            user_session_id=user_session_id,
            applicant_name=request.applicant_name,
            nic_number=request.nic_number,
            email=request.email,
            phone=request.phone,
            vehicle_price=request.vehicle_price,
            make=request.make,
            model=request.model,
            year=request.year,
            mileage=request.mileage,
            employment_status=request.employment_status,
            monthly_income=request.monthly_income,
            employer_name=request.employer_name,
            employment_duration_months=request.employment_duration_months,
            down_payment=request.down_payment,
            loan_amount_requested=request.loan_amount_requested,
            loan_tenor_months=request.loan_tenor_months,
            existing_loans=request.existing_loans,
            existing_loan_emis=request.existing_loan_emis,
            preferred_banks=request.preferred_banks,
            credit_score=request.credit_score,
            listing_id=request.listing_id
        )
        
        # Mark as lead generated if approved
        if application.application_status == 'approved':
            service.mark_lead_generated(application.application_reference)
        
        return application
        
    except Exception as e:
        logger.error("loan_application_error", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to process loan application")


@router.get("/loans/application/{reference}", response_model=LoanApplicationResponse, tags=["Trust Services"])
def get_loan_application(
    reference: str,
    db: Session = Depends(get_db)
):
    """Get loan application status by reference number."""
    service = LoanApplicationService(db)
    application = service.get_application_by_reference(reference)
    
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    return application


@router.get("/loans/session/{session_id}", response_model=List[LoanApplicationResponse], tags=["Trust Services"])
def get_applications_by_session(
    session_id: str,
    db: Session = Depends(get_db)
):
    """Get all loan applications for a user session."""
    service = LoanApplicationService(db)
    applications = service.get_applications_by_session(session_id)
    return applications


# ==================== Admin/Analytics Endpoints ====================

@router.get("/trust-services/analytics/insurance", tags=["Trust Services - Admin"])
def get_insurance_analytics(
    start_date: Optional[str] = Query(None, description="Start date (ISO format)"),
    end_date: Optional[str] = Query(None, description="End date (ISO format)"),
    db: Session = Depends(get_db)
):
    """Get insurance commission analytics (Admin only)."""
    from datetime import datetime
    
    start_dt = datetime.fromisoformat(start_date) if start_date else None
    end_dt = datetime.fromisoformat(end_date) if end_date else None
    
    service = InsuranceQuoteService(db)
    return service.calculate_total_commission(start_dt, end_dt)


@router.get("/trust-services/analytics/loans", tags=["Trust Services - Admin"])
def get_loan_analytics(
    start_date: Optional[str] = Query(None, description="Start date (ISO format)"),
    end_date: Optional[str] = Query(None, description="End date (ISO format)"),
    db: Session = Depends(get_db)
):
    """Get loan lead generation fee analytics (Admin only)."""
    from datetime import datetime
    
    start_dt = datetime.fromisoformat(start_date) if start_date else None
    end_dt = datetime.fromisoformat(end_date) if end_date else None
    
    service = LoanApplicationService(db)
    return service.calculate_total_lead_fees(start_dt, end_dt)
