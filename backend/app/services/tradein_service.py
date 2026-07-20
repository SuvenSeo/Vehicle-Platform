"""
Trade-In Valuation Service
AI-powered instant vehicle valuations and dealer offer aggregation
"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
import uuid


class VehicleCondition(str, Enum):
    EXCELLENT = "excellent"  # Like new, no issues
    VERY_GOOD = "very_good"  # Minor wear, fully functional
    GOOD = "good"  # Normal wear, all functional
    FAIR = "fair"  # Noticeable wear, minor issues
    POOR = "poor"  # Significant wear, needs repairs


class ValuationRequest(BaseModel):
    request_id: str = Field(default_factory=lambda: f"val_{uuid.uuid4().hex[:12]}")
    vehicle_vin: Optional[str] = None
    make: str
    model: str
    year: int
    variant: Optional[str] = None
    mileage: int
    condition: VehicleCondition
    registration_date: datetime
    fuel_type: str
    transmission: str
    body_type: str
    color: str
    modifications: Optional[List[str]] = []
    accident_history: bool = False
    service_history: bool = True
    owner_count: int = 1
    location: str
    photos: List[str] = []
    additional_notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_schema_extra = {
            "example": {
                "make": "Toyota",
                "model": "Prius",
                "year": 2018,
                "mileage": 45000,
                "condition": "very_good",
                "fuel_type": "Hybrid",
                "transmission": "Automatic",
                "body_type": "Sedan",
                "color": "White",
                "owner_count": 1,
                "location": "Colombo",
                "accident_history": False,
                "service_history": True
            }
        }


class DealerOffer(BaseModel):
    offer_id: str
    dealer_id: str
    dealer_name: str
    dealer_location: str
    offer_amount: float
    offer_valid_until: datetime
    conditions: List[str] = []
    trade_in_bonus: float = 0.0
    notes: Optional[str] = None
    status: str = "pending"  # pending, accepted, rejected, expired
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ValuationResult(BaseModel):
    valuation_id: str
    request_id: str
    vehicle_description: str
    estimated_market_value: float
    trade_in_value: float
    private_sale_value: float
    dealer_retail_value: float
    confidence_score: float  # 0-1, how confident is the valuation
    valuation_date: datetime
    comparable_listings: List[Dict] = []
    market_trends: Dict[str, Any] = {}
    depreciation_rate: float
    recommended_action: str  # sell_now, wait, improve_condition
    offers: List[DealerOffer] = []
    valid_until: datetime
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_schema_extra = {
            "example": {
                "valuation_id": "val_result_001",
                "vehicle_description": "2018 Toyota Prius",
                "estimated_market_value": 8500000,
                "trade_in_value": 7650000,
                "private_sale_value": 8900000,
                "dealer_retail_value": 9500000,
                "confidence_score": 0.92,
                "depreciation_rate": 0.08,
                "recommended_action": "sell_now"
            }
        }


class TradeInService:
    """Service for AI-powered trade-in valuations and dealer offer management"""

    # Base depreciation rates by vehicle age (years)
    DEPRECIATION_RATES = {
        0: 0.15,  # First year: 15%
        1: 0.12,  # Second year: 12%
        2: 0.10,  # Third year: 10%
        3: 0.08,  # Fourth year: 8%
        4: 0.07,  # Fifth year: 7%
        5: 0.06,  # Sixth+ year: 6%
    }

    # Condition multipliers
    CONDITION_MULTIPLIERS = {
        VehicleCondition.EXCELLENT: 1.05,
        VehicleCondition.VERY_GOOD: 1.00,
        VehicleCondition.GOOD: 0.92,
        VehicleCondition.FAIR: 0.82,
        VehicleCondition.POOR: 0.70,
    }

    # Mileage adjustment (per 10,000 km over average)
    MILEAGE_ADJUSTMENT = -0.03

    # Brand value retention factors (popular brands in Sri Lanka)
    BRAND_FACTORS = {
        "Toyota": 1.08,
        "Honda": 1.05,
        "Nissan": 0.98,
        "Mazda": 0.97,
        "Suzuki": 1.02,
        "Mitsubishi": 0.95,
        "Hyundai": 0.96,
        "Kia": 0.94,
        "BMW": 0.92,
        "Mercedes-Benz": 0.90,
        "Audi": 0.88,
        "Volkswagen": 0.91,
        "Ford": 0.89,
        "Chevrolet": 0.87,
        "Subaru": 0.93,
        "Daihatsu": 0.99,
        "Isuzu": 0.96,
        "Land Rover": 0.85,
        "Jeep": 0.86,
    }

    # Fuel type preferences in Sri Lanka market
    FUEL_TYPE_FACTORS = {
        "Hybrid": 1.10,
        "Electric": 1.15,
        "Diesel": 1.02,
        "Petrol": 1.00,
    }

    def __init__(self, db_session=None):
        self.db = db_session

    def calculate_depreciation(self, year: int, current_year: int = None) -> float:
        """Calculate total depreciation based on vehicle age"""
        if current_year is None:
            current_year = datetime.utcnow().year
        
        age = current_year - year
        total_depreciation = 0.0
        
        for year_idx in range(min(age, 6)):
            rate = self.DEPRECIATION_RATES.get(year_idx, 0.06)
            total_depreciation += rate
        
        # Cap at 80% total depreciation
        return min(total_depreciation, 0.80)

    def get_base_market_value(
        self,
        make: str,
        model: str,
        year: int,
        variant: Optional[str] = None,
    ) -> float:
        """Get base market value from historical data"""
        # In production, this would query the database for actual market data
        # Mock implementation with realistic Sri Lankan market prices
        
        base_prices = {
            ("Toyota", "Prius"): {2018: 8500000, 2019: 9200000, 2020: 10000000},
            ("Toyota", "Axio"): {2018: 5500000, 2019: 6000000, 2020: 6500000},
            ("Honda", "Fit"): {2018: 4800000, 2019: 5200000, 2020: 5700000},
            ("Honda", "City"): {2018: 6200000, 2019: 6800000, 2020: 7400000},
            ("Nissan", "Note"): {2018: 3800000, 2019: 4200000, 2020: 4600000},
            ("Suzuki", "Swift"): {2018: 3200000, 2019: 3600000, 2020: 4000000},
        }
        
        key = (make, model)
        if key in base_prices:
            year_data = base_prices[key]
            if year in year_data:
                return year_data[year]
            # Interpolate for missing years
            sorted_years = sorted(year_data.keys())
            if year < sorted_years[0]:
                return year_data[sorted_years[0]] * 1.1
            elif year > sorted_years[-1]:
                return year_data[sorted_years[-1]] * 0.9
        
        # Default fallback
        return 5000000

    def calculate_valuation(self, request: ValuationRequest) -> ValuationResult:
        """Calculate comprehensive vehicle valuation"""
        
        # Get base market value
        base_value = self.get_base_market_value(
            request.make,
            request.model,
            request.year,
            request.variant,
        )
        
        # Apply depreciation
        depreciation = self.calculate_depreciation(request.year)
        depreciated_value = base_value * (1 - depreciation)
        
        # Apply brand factor
        brand_factor = self.BRAND_FACTORS.get(request.make, 1.00)
        valued = depreciated_value * brand_factor
        
        # Apply fuel type factor
        fuel_factor = self.FUEL_TYPE_FACTORS.get(request.fuel_type, 1.00)
        valued *= fuel_factor
        
        # Apply condition multiplier
        condition_mult = self.CONDITION_MULTIPLIERS.get(request.condition, 1.00)
        valued *= condition_mult
        
        # Apply mileage adjustment (average: 15,000 km/year)
        expected_mileage = (datetime.utcnow().year - request.year) * 15000
        mileage_diff = request.mileage - expected_mileage
        mileage_adjustment = 1 + (mileage_diff / 10000) * self.MILEAGE_ADJUSTMENT
        valued *= max(0.7, mileage_adjustment)  # Cap at 30% reduction
        
        # Adjust for accident history
        if request.accident_history:
            valued *= 0.85  # 15% reduction for accidents
        
        # Adjust for service history
        if not request.service_history:
            valued *= 0.95  # 5% reduction for no service history
        
        # Adjust for multiple owners
        if request.owner_count > 1:
            valued *= (1 - 0.03 * (request.owner_count - 1))  # 3% per additional owner
        
        # Round to nearest 10,000
        valued = round(valued / 10000) * 10000
        
        # Calculate different value types
        trade_in_value = valued * 0.90  # Dealers need margin
        private_sale_value = valued * 1.05  # Private sales typically higher
        dealer_retail_value = valued * 1.12  # Dealer retail price
        
        # Calculate confidence score based on data availability
        confidence = 0.70  # Base confidence
        if request.vehicle_vin:
            confidence += 0.10
        if request.service_history:
            confidence += 0.05
        if len(request.photos) >= 5:
            confidence += 0.05
        if not request.accident_history:
            confidence += 0.05
        confidence = min(confidence, 0.98)
        
        # Determine recommended action
        if request.condition == VehicleCondition.POOR:
            recommended_action = "improve_condition"
        elif self._is_market_declining(request.make, request.model):
            recommended_action = "sell_now"
        else:
            recommended_action = "wait"
        
        vehicle_desc = f"{request.year} {request.make} {request.model}"
        
        result = ValuationResult(
            valuation_id=f"val_res_{uuid.uuid4().hex[:12]}",
            request_id=request.request_id,
            vehicle_description=vehicle_desc,
            estimated_market_value=valued,
            trade_in_value=trade_in_value,
            private_sale_value=private_sale_value,
            dealer_retail_value=dealer_retail_value,
            confidence_score=confidence,
            valuation_date=datetime.utcnow(),
            depreciation_rate=depreciation,
            recommended_action=recommended_action,
            valid_until=datetime.utcnow().replace(hour=23, minute=59, second=59),
        )
        
        return result

    def _is_market_declining(self, make: str, model: str) -> bool:
        """Check if market prices are declining for this vehicle"""
        # In production, analyze recent sales trends
        # Mock: assume stable market
        return False

    def request_dealer_offers(
        self,
        valuation_result: ValuationResult,
        dealer_ids: Optional[List[str]] = None,
    ) -> List[DealerOffer]:
        """Request offers from dealers"""
        # In production, send notifications to dealers
        # Mock implementation
        offers = []
        
        mock_dealers = [
            {"id": "dlr_001", "name": "Colombo Motors", "location": "Colombo 7"},
            {"id": "dlr_002", "name": "Kandy Auto Traders", "location": "Kandy"},
            {"id": "dlr_003", "name": "Galle Vehicle Exchange", "location": "Galle"},
        ]
        
        base_offer = valuation_result.trade_in_value
        
        for dealer in (mock_dealers if not dealer_ids else dealer_ids):
            if isinstance(dealer, dict):
                dealer_id = dealer["id"]
                dealer_name = dealer["name"]
                dealer_location = dealer["location"]
            else:
                dealer_id = dealer
                dealer_name = f"Dealer {dealer_id}"
                dealer_location = "Unknown"
            
            # Vary offers slightly
            variation = 0.95 + (hash(dealer_id) % 10) / 100
            offer_amount = base_offer * variation
            
            offer = DealerOffer(
                offer_id=f"offer_{uuid.uuid4().hex[:12]}",
                dealer_id=dealer_id,
                dealer_name=dealer_name,
                dealer_location=dealer_location,
                offer_amount=round(offer_amount / 10000) * 10000,
                offer_valid_until=datetime.utcnow().replace(day=28),
                conditions=["Vehicle inspection required", "Valid registration"],
                trade_in_bonus=50000 if hash(dealer_id) % 3 == 0 else 0,
            )
            offers.append(offer)
        
        return offers

    def accept_offer(self, offer_id: str, user_id: str) -> bool:
        """Accept a dealer offer"""
        # In production, update database and notify dealer
        return True

    def schedule_inspection(
        self,
        offer_id: str,
        preferred_date: datetime,
        location: str,
    ) -> Dict[str, Any]:
        """Schedule vehicle inspection for accepted offer"""
        return {
            "inspection_id": f"insp_{uuid.uuid4().hex[:12]}",
            "offer_id": offer_id,
            "scheduled_date": preferred_date,
            "location": location,
            "status": "scheduled",
            "inspector_assigned": False,
        }


# Export for API usage
tradein_service = TradeInService()
