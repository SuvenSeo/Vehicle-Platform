"""Insurance quote comparison service for Phase 1 Trust Infrastructure.

Aggregates quotes from multiple Sri Lankan insurers (Ceylinco, Union Assurance, 
AIA, Softlogic, Janashakthi) and provides comparison tools with commission tracking.
"""
import structlog
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from uuid import uuid4

from db.models import InsuranceQuote, CarListing

logger = structlog.get_logger()


# Insurer configurations with commission rates
INSURER_CONFIGS = {
    'ceylitco': {
        'name': 'Ceylinco Insurance',
        'commission_rate': 0.08,  # 8%
        'base_premium_factor': 1.0,
        'supported_coverage': ['third_party', 'comprehensive']
    },
    'union_assurance': {
        'name': 'Union Assurance',
        'commission_rate': 0.075,  # 7.5%
        'base_premium_factor': 0.98,
        'supported_coverage': ['third_party', 'comprehensive']
    },
    'aia': {
        'name': 'AIA Insurance',
        'commission_rate': 0.07,  # 7%
        'base_premium_factor': 1.02,
        'supported_coverage': ['third_party', 'comprehensive']
    },
    'softlogic': {
        'name': 'Softlogic Insurance',
        'commission_rate': 0.085,  # 8.5%
        'base_premium_factor': 0.95,
        'supported_coverage': ['third_party', 'comprehensive']
    },
    'janashakthi': {
        'name': 'Janashakthi Insurance',
        'commission_rate': 0.075,  # 7.5%
        'base_premium_factor': 0.97,
        'supported_coverage': ['third_party', 'comprehensive']
    }
}


class InsuranceQuoteService:
    """Service for generating and managing insurance quotes."""
    
    def __init__(self, db_session: Session):
        self.db = db_session
    
    def calculate_base_premium(
        self,
        vehicle_price: float,
        vehicle_year: int,
        coverage_type: str = 'comprehensive',
        fuel_type: Optional[str] = None,
        body_type: Optional[str] = None
    ) -> float:
        """Calculate base premium based on vehicle details.
        
        Args:
            vehicle_price: Vehicle market value in LKR
            vehicle_year: Manufacturing year
            coverage_type: 'third_party' or 'comprehensive'
            fuel_type: Fuel type (petrol, diesel, hybrid, electric)
            body_type: Body type (sedan, suv, van, etc.)
            
        Returns:
            Base premium amount in LKR
        """
        # Base rate as percentage of vehicle value
        if coverage_type == 'third_party':
            base_rate = 0.015  # 1.5% of vehicle value
        else:  # comprehensive
            base_rate = 0.035  # 3.5% of vehicle value
        
        # Age factor - older vehicles cost more to insure
        vehicle_age = 2025 - vehicle_year
        age_factor = 1.0 + (vehicle_age * 0.05)  # 5% increase per year
        
        # Fuel type adjustments
        fuel_factors = {
            'petrol': 1.0,
            'diesel': 1.05,
            'hybrid': 0.95,
            'electric': 1.10
        }
        fuel_factor = fuel_factors.get(fuel_type, 1.0) if fuel_type else 1.0
        
        # Body type adjustments
        body_factors = {
            'sedan': 1.0,
            'suv': 1.10,
            'van': 1.05,
            'hatchback': 0.95,
            'truck': 1.15
        }
        body_factor = body_factors.get(body_type, 1.0) if body_type else 1.0
        
        base_premium = vehicle_price * base_rate * age_factor * fuel_factor * body_factor
        
        return max(base_premium, 15000)  # Minimum premium of Rs. 15,000
    
    def create_quote_request(
        self,
        user_session_id: str,
        listing_id: Optional[int],
        make: str,
        model: str,
        year: int,
        price_lkr: float,
        fuel_type: Optional[str] = None,
        body_type: Optional[str] = None,
        driver_age: Optional[int] = None,
        driver_gender: Optional[str] = None,
        driving_experience_years: Optional[int] = None,
        no_claim_discount: bool = False,
        previous_claims: int = 0,
        coverage_type: str = 'comprehensive',
        voluntary_excess: Optional[float] = None,
        add_ons: Optional[List[str]] = None
    ) -> List[InsuranceQuote]:
        """Create insurance quote requests from all insurers.
        
        Args:
            user_session_id: User session identifier
            listing_id: Optional listing ID
            make: Vehicle make
            model: Vehicle model
            year: Vehicle year
            price_lkr: Vehicle price
            fuel_type: Fuel type
            body_type: Body type
            driver_age: Driver's age
            driver_gender: Driver's gender
            driving_experience_years: Years of driving experience
            no_claim_discount: Whether NCD applies
            previous_claims: Number of previous claims
            coverage_type: Coverage type
            voluntary_excess: Voluntary excess amount
            add_ons: List of add-on services
            
        Returns:
            List of InsuranceQuote instances from different insurers
        """
        # Calculate base premium
        base_premium = self.calculate_base_premium(
            vehicle_price=price_lkr,
            vehicle_year=year,
            coverage_type=coverage_type,
            fuel_type=fuel_type,
            body_type=body_type
        )
        
        # Driver risk factor
        driver_factor = 1.0
        if driver_age and driver_age < 25:
            driver_factor += 0.20  # 20% surcharge for young drivers
        elif driver_age and driver_age > 60:
            driver_factor += 0.10  # 10% surcharge for senior drivers
        
        if driving_experience_years and driving_experience_years < 3:
            driver_factor += 0.15  # 15% surcharge for inexperienced drivers
        
        # Claims history factor
        claims_factor = 1.0 + (previous_claims * 0.10)  # 10% per claim
        
        # No claim discount
        ncd_discount = 0.0
        if no_claim_discount:
            ncd_discount = 0.25  # 25% discount
        
        # Add-on premiums
        add_on_premiums = {}
        if add_ons:
            add_on_prices = {
                'roadside_assistance': 5000,
                'engine_protection': 8000,
                'personal_accident': 3000,
                'loss_of_use': 4000,
                'windscreen_cover': 2500
            }
            for addon in add_ons:
                if addon in add_on_prices:
                    add_on_premiums[addon] = add_on_prices[addon]
        
        total_add_on_premium = sum(add_on_premiums.values())
        
        # Generate quotes from all insurers
        quotes = []
        for insurer_code, config in INSURER_CONFIGS.items():
            # Check if insurer supports requested coverage
            if coverage_type not in config['supported_coverage']:
                continue
            
            # Calculate final premium
            premium = (
                (base_premium * config['base_premium_factor'] * driver_factor * claims_factor)
                * (1 - ncd_discount)
                + total_add_on_premium
            )
            
            # Apply voluntary excess discount
            if voluntary_excess and voluntary_excess > 0:
                excess_discount = min(voluntary_excess / 50000, 0.15)  # Max 15% discount
                premium *= (1 - excess_discount)
            
            # Calculate commission
            commission_amount = premium * config['commission_rate']
            
            # Create quote record
            quote = InsuranceQuote(
                user_session_id=user_session_id,
                listing_id=listing_id,
                make=make,
                model=model,
                year=year,
                price_lkr=price_lkr,
                fuel_type=fuel_type,
                body_type=body_type,
                driver_age=driver_age,
                driver_gender=driver_gender,
                driving_experience_years=driving_experience_years,
                no_claim_discount=no_claim_discount,
                previous_claims=previous_claims,
                coverage_type=coverage_type,
                voluntary_excess=voluntary_excess,
                add_ons=add_ons,
                insurer_name=config['name'],
                premium_amount=round(premium, 2),
                sum_insured=price_lkr,
                excess_amount=voluntary_excess or 25000,  # Default excess
                coverage_details={
                    'coverage_type': coverage_type,
                    'third_party_liability': 'Unlimited' if coverage_type == 'comprehensive' else 'Limited',
                    'own_damage': coverage_type == 'comprehensive',
                    'theft_cover': coverage_type == 'comprehensive'
                },
                add_on_premiums=add_on_premiums,
                commission_rate=config['commission_rate'],
                commission_amount=round(commission_amount, 2),
                expires_at=datetime.utcnow() + timedelta(days=30),
                quote_reference=f"INS-{insurer_code.upper()}-{uuid4().hex[:8].upper()}"
            )
            
            quotes.append(quote)
        
        # Bulk insert
        self.db.add_all(quotes)
        self.db.commit()
        
        for quote in quotes:
            self.db.refresh(quote)
        
        logger.info("insurance_quotes_generated",
                   user_session_id=user_session_id,
                   listing_id=listing_id,
                   quote_count=len(quotes),
                   insurers=[q.insurer_name for q in quotes])
        
        return quotes
    
    def get_quotes_by_session(self, user_session_id: str) -> List[InsuranceQuote]:
        """Get all active quotes for a user session."""
        return self.db.query(InsuranceQuote).filter(
            InsuranceQuote.user_session_id == user_session_id,
            InsuranceQuote.quote_status == 'active'
        ).order_by(InsuranceQuote.premium_amount).all()
    
    def get_quotes_by_listing(self, listing_id: int) -> List[InsuranceQuote]:
        """Get all active quotes for a listing."""
        return self.db.query(InsuranceQuote).filter(
            InsuranceQuote.listing_id == listing_id,
            InsuranceQuote.quote_status == 'active'
        ).order_by(InsuranceQuote.premium_amount).all()
    
    def mark_quote_purchased(
        self,
        quote_id: int,
        policy_number: str
    ) -> Optional[InsuranceQuote]:
        """Mark a quote as purchased."""
        quote = self.db.query(InsuranceQuote).filter(
            InsuranceQuote.id == quote_id
        ).first()
        
        if not quote:
            return None
        
        quote.purchased = True
        quote.quote_status = 'purchased'
        quote.purchase_date = datetime.utcnow()
        quote.policy_number = policy_number
        
        self.db.commit()
        self.db.refresh(quote)
        
        logger.info("insurance_quote_purchased",
                   quote_id=quote_id,
                   policy_number=policy_number,
                   insurer=quote.insurer_name,
                   premium=quote.premium_amount,
                   commission=quote.commission_amount)
        
        return quote
    
    def expire_old_quotes(self) -> int:
        """Expire quotes that have passed their expiry date."""
        expired_count = self.db.query(InsuranceQuote).filter(
            InsuranceQuote.quote_status == 'active',
            InsuranceQuote.expires_at < datetime.utcnow()
        ).update({
            InsuranceQuote.quote_status: 'expired'
        })
        
        self.db.commit()
        
        logger.info("insurance_quotes_expired", count=expired_count)
        
        return expired_count
    
    def get_best_quote_for_listing(
        self,
        listing_id: int
    ) -> Optional[InsuranceQuote]:
        """Get the best (lowest premium) active quote for a listing."""
        return self.db.query(InsuranceQuote).filter(
            InsuranceQuote.listing_id == listing_id,
            InsuranceQuote.quote_status == 'active'
        ).order_by(InsuranceQuote.premium_amount).first()
    
    def calculate_total_commission(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Calculate total commission earned from insurance quotes.
        
        Args:
            start_date: Start date for calculation
            end_date: End date for calculation
            
        Returns:
            Dictionary with commission breakdown
        """
        query = self.db.query(InsuranceQuote).filter(
            InsuranceQuote.purchased == True
        )
        
        if start_date:
            query = query.filter(InsuranceQuote.purchase_date >= start_date)
        if end_date:
            query = query.filter(InsuranceQuote.purchase_date <= end_date)
        
        purchased_quotes = query.all()
        
        total_commission = sum(q.commission_amount or 0 for q in purchased_quotes)
        total_premium = sum(q.premium_amount or 0 for q in purchased_quotes)
        
        # Breakdown by insurer
        insurer_breakdown = {}
        for quote in purchased_quotes:
            insurer = quote.insurer_name
            if insurer not in insurer_breakdown:
                insurer_breakdown[insurer] = {
                    'count': 0,
                    'total_premium': 0,
                    'total_commission': 0
                }
            insurer_breakdown[insurer]['count'] += 1
            insurer_breakdown[insurer]['total_premium'] += quote.premium_amount or 0
            insurer_breakdown[insurer]['total_commission'] += quote.commission_amount or 0
        
        return {
            'total_quotes_sold': len(purchased_quotes),
            'total_premium': round(total_premium, 2),
            'total_commission': round(total_commission, 2),
            'average_commission_rate': round(total_commission / total_premium * 100, 2) if total_premium > 0 else 0,
            'insurer_breakdown': insurer_breakdown
        }
