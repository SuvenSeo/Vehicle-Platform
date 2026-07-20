"""Loan application and pre-approval service for Phase 1 Trust Infrastructure.

Routes loan applications to multiple Sri Lankan banks (Commercial, Sampath, HNB, 
BOC, DFCC, Seylan) and tracks approvals with lead generation fee management.
"""
import structlog
from datetime import datetime
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from uuid import uuid4

from db.models import LoanApplication, CarListing

logger = structlog.get_logger()


# Bank configurations with lending criteria
BANK_CONFIGS = {
    'commercial': {
        'name': 'Commercial Bank of Ceylon',
        'min_interest_rate': 0.145,  # 14.5%
        'max_interest_rate': 0.175,  # 17.5%
        'max_ltv': 0.80,  # 80% Loan-to-Value
        'min_loan_amount': 500000,
        'max_loan_amount': 15000000,
        'tenor_options': [36, 48, 60, 72, 84],
        'processing_fee_rate': 0.015,  # 1.5%
        'preferred_segments': ['employed', 'business_owner']
    },
    'sampath': {
        'name': 'Sampath Bank',
        'min_interest_rate': 0.148,
        'max_interest_rate': 0.178,
        'max_ltv': 0.75,
        'min_loan_amount': 500000,
        'max_loan_amount': 12000000,
        'tenor_options': [36, 48, 60, 72],
        'processing_fee_rate': 0.012,
        'preferred_segments': ['employed', 'self_employed']
    },
    'hnb': {
        'name': 'Hatton National Bank',
        'min_interest_rate': 0.142,
        'max_interest_rate': 0.172,
        'max_ltv': 0.85,
        'min_loan_amount': 750000,
        'max_loan_amount': 20000000,
        'tenor_options': [48, 60, 72, 84],
        'processing_fee_rate': 0.018,
        'preferred_segments': ['employed', 'business_owner']
    },
    'boc': {
        'name': 'Bank of Ceylon',
        'min_interest_rate': 0.140,
        'max_interest_rate': 0.170,
        'max_ltv': 0.80,
        'min_loan_amount': 500000,
        'max_loan_amount': 15000000,
        'tenor_options': [36, 48, 60, 72, 84],
        'processing_fee_rate': 0.010,
        'preferred_segments': ['employed', 'self_employed', 'business_owner']
    },
    'dfcc': {
        'name': 'DFCC Bank',
        'min_interest_rate': 0.150,
        'max_interest_rate': 0.180,
        'max_ltv': 0.75,
        'min_loan_amount': 1000000,
        'max_loan_amount': 10000000,
        'tenor_options': [36, 48, 60],
        'processing_fee_rate': 0.020,
        'preferred_segments': ['business_owner']
    },
    'seylan': {
        'name': 'Seylan Bank',
        'min_interest_rate': 0.146,
        'max_interest_rate': 0.176,
        'max_ltv': 0.78,
        'min_loan_amount': 500000,
        'max_loan_amount': 12000000,
        'tenor_options': [36, 48, 60, 72],
        'processing_fee_rate': 0.015,
        'preferred_segments': ['employed', 'self_employed']
    }
}


class LoanApplicationService:
    """Service for managing loan applications and bank routing."""
    
    # Lead generation fee per approved application (LKR)
    LEAD_FEE_AMOUNT = 3000.00
    
    def __init__(self, db_session: Session):
        self.db = db_session
    
    def calculate_monthly_emi(
        self,
        principal: float,
        annual_interest_rate: float,
        tenor_months: int
    ) -> float:
        """Calculate monthly EMI using reducing balance method.
        
        Args:
            principal: Loan amount
            annual_interest_rate: Annual interest rate (e.g., 0.15 for 15%)
            tenor_months: Loan tenure in months
            
        Returns:
            Monthly EMI amount
        """
        if annual_interest_rate == 0:
            return principal / tenor_months
        
        monthly_rate = annual_interest_rate / 12
        emi = principal * monthly_rate * ((1 + monthly_rate) ** tenor_months) / (((1 + monthly_rate) ** tenor_months) - 1)
        
        return emi
    
    def create_loan_application(
        self,
        user_session_id: str,
        applicant_name: str,
        nic_number: str,
        email: str,
        phone: str,
        vehicle_price: float,
        make: str,
        model: str,
        year: int,
        mileage: Optional[int] = None,
        employment_status: Optional[str] = None,
        monthly_income: Optional[float] = None,
        employer_name: Optional[str] = None,
        employment_duration_months: Optional[int] = None,
        down_payment: Optional[float] = None,
        loan_amount_requested: Optional[float] = None,
        loan_tenor_months: int = 60,
        existing_loans: int = 0,
        existing_loan_emis: float = 0,
        preferred_banks: Optional[List[str]] = None,
        credit_score: Optional[int] = None,
        listing_id: Optional[int] = None
    ) -> LoanApplication:
        """Create a new loan application and route to banks.
        
        Args:
            user_session_id: User session identifier
            applicant_name: Applicant's full name
            nic_number: NIC number
            email: Email address
            phone: Phone number
            vehicle_price: Vehicle price in LKR
            make: Vehicle make
            model: Vehicle model
            year: Vehicle year
            mileage: Vehicle mileage
            employment_status: Employment status
            monthly_income: Monthly income
            employer_name: Employer name
            employment_duration_months: Employment duration
            down_payment: Down payment amount
            loan_amount_requested: Requested loan amount
            loan_tenor_months: Desired loan tenure
            existing_loans: Number of existing loans
            existing_loan_emis: Total existing EMI payments
            preferred_banks: List of preferred bank codes
            credit_score: Credit score if available
            listing_id: Optional listing ID
            
        Returns:
            Created LoanApplication instance
        """
        # Calculate loan amount if not provided
        if not loan_amount_requested:
            if down_payment:
                loan_amount_requested = vehicle_price - down_payment
            else:
                # Default 80% financing
                loan_amount_requested = vehicle_price * 0.80
        
        # Validate against bank LTV limits
        max_ltv = max(config['max_ltv'] for config in BANK_CONFIGS.values())
        if loan_amount_requested > vehicle_price * max_ltv:
            loan_amount_requested = vehicle_price * max_ltv
        
        # Generate application reference
        application_reference = f"LOAN-{uuid4().hex[:12].upper()}"
        
        # Determine eligible banks based on employment status
        eligible_banks = []
        for bank_code, config in BANK_CONFIGS.items():
            if preferred_banks and bank_code not in preferred_banks:
                continue
            if employment_status in config['preferred_segments']:
                eligible_banks.append(bank_code)
            elif not preferred_banks:
                eligible_banks.append(bank_code)
        
        if not eligible_banks:
            eligible_banks = list(BANK_CONFIGS.keys())[:3]  # Default to top 3
        
        # Create application record
        application = LoanApplication(
            application_reference=application_reference,
            user_session_id=user_session_id,
            listing_id=listing_id,
            vehicle_price=vehicle_price,
            make=make,
            model=model,
            year=year,
            mileage=mileage,
            applicant_name=applicant_name,
            nic_number=nic_number,
            email=email,
            phone=phone,
            employment_status=employment_status,
            monthly_income=monthly_income,
            employer_name=employer_name,
            employment_duration_months=employment_duration_months,
            down_payment=down_payment,
            loan_amount_requested=loan_amount_requested,
            loan_tenor_months=loan_tenor_months,
            existing_loans=existing_loans,
            existing_loan_emis=existing_loan_emis,
            preferred_banks=eligible_banks,
            credit_score_provided=credit_score is not None,
            credit_score=credit_score,
            application_status='submitted'
        )
        
        self.db.add(application)
        self.db.commit()
        self.db.refresh(application)
        
        # Simulate bank responses (in production, this would call bank APIs)
        bank_responses = self._simulate_bank_responses(
            application=application,
            eligible_banks=eligible_banks
        )
        
        application.bank_responses = bank_responses
        
        # Determine approved banks
        approved_banks = [
            bank_code for bank_code, response in bank_responses.items()
            if response.get('status') == 'approved'
        ]
        
        application.approved_banks = approved_banks
        
        # Find best offer
        if approved_banks:
            best_bank = None
            best_rate = float('inf')
            
            for bank_code in approved_banks:
                response = bank_responses[bank_code]
                if response.get('interest_rate', float('inf')) < best_rate:
                    best_rate = response['interest_rate']
                    best_bank = bank_code
            
            if best_bank:
                application.best_offer_bank = BANK_CONFIGS[best_bank]['name']
                application.best_offer_rate = best_rate
                application.best_offer_amount = bank_responses[best_bank].get('approved_amount')
                application.application_status = 'approved'
        
        self.db.commit()
        self.db.refresh(application)
        
        logger.info("loan_application_created",
                   application_reference=application_reference,
                   user_session_id=user_session_id,
                   loan_amount=loan_amount_requested,
                   eligible_banks=eligible_banks,
                   approved_count=len(approved_banks))
        
        return application
    
    def _simulate_bank_responses(
        self,
        application: LoanApplication,
        eligible_banks: List[str]
    ) -> Dict[str, Dict[str, Any]]:
        """Simulate bank approval responses based on applicant profile.
        
        In production, this would call actual bank APIs.
        """
        import random
        
        responses = {}
        
        # Calculate debt-to-income ratio
        monthly_income = application.monthly_income or 0
        total_existing_emis = application.existing_loan_emis or 0
        proposed_emi_estimate = application.loan_amount_requested / application.loan_tenor_months * 1.2  # Rough estimate
        
        dti_ratio = (total_existing_emis + proposed_emi_estimate) / monthly_income if monthly_income > 0 else 1.0
        
        for bank_code in eligible_banks:
            config = BANK_CONFIGS[bank_code]
            
            # Check basic eligibility
            eligible = True
            rejection_reason = None
            
            # Loan amount check
            if application.loan_amount_requested < config['min_loan_amount']:
                eligible = False
                rejection_reason = 'Below minimum loan amount'
            elif application.loan_amount_requested > config['max_loan_amount']:
                eligible = False
                rejection_reason = 'Exceeds maximum loan amount'
            
            # LTV check
            ltv = application.loan_amount_requested / application.vehicle_price
            if ltv > config['max_ltv']:
                eligible = False
                rejection_reason = 'Exceeds maximum LTV ratio'
            
            # DTI check (more lenient for some banks)
            max_dti = 0.60 if bank_code in ['boc', 'commercial'] else 0.50
            if dti_ratio > max_dti and monthly_income > 0:
                eligible = False
                rejection_reason = 'Debt-to-income ratio too high'
            
            # Employment stability check
            if application.employment_duration_months and application.employment_duration_months < 12:
                if bank_code in ['dfcc']:  # Stricter banks
                    eligible = False
                    rejection_reason = 'Insufficient employment duration'
            
            # Generate response
            if eligible:
                # Determine interest rate based on profile
                base_rate = (config['min_interest_rate'] + config['max_interest_rate']) / 2
                
                # Adjustments
                if application.credit_score and application.credit_score > 700:
                    base_rate -= 0.01  # 1% discount for good credit
                elif application.credit_score and application.credit_score < 600:
                    base_rate += 0.02  # 2% surcharge for poor credit
                
                if monthly_income and monthly_income > 200000:
                    base_rate -= 0.005  # 0.5% discount for high income
                
                # Random variation for simulation
                rate_variation = random.uniform(-0.01, 0.01)
                final_rate = round(base_rate + rate_variation, 4)
                
                # Calculate approved amount (may be less than requested)
                approved_amount = min(
                    application.loan_amount_requested,
                    application.vehicle_price * config['max_ltv'] * random.uniform(0.95, 1.0)
                )
                
                responses[bank_code] = {
                    'status': 'approved',
                    'approved_amount': round(approved_amount, 2),
                    'interest_rate': final_rate,
                    'tenor_months': application.loan_tenor_months,
                    'monthly_emi': round(self.calculate_monthly_emi(approved_amount, final_rate, application.loan_tenor_months), 2),
                    'processing_fee': round(approved_amount * config['processing_fee_rate'], 2),
                    'conditional_approval': random.choice([True, False, False]),  # 33% chance
                    'conditions': ['Income verification required', 'Vehicle valuation required'] if random.random() > 0.5 else None
                }
            else:
                responses[bank_code] = {
                    'status': 'rejected',
                    'rejection_reason': rejection_reason
                }
        
        return responses
    
    def get_application_by_reference(self, reference: str) -> Optional[LoanApplication]:
        """Get loan application by reference number."""
        return self.db.query(LoanApplication).filter(
            LoanApplication.application_reference == reference
        ).first()
    
    def get_applications_by_session(self, user_session_id: str) -> List[LoanApplication]:
        """Get all applications for a user session."""
        return self.db.query(LoanApplication).filter(
            LoanApplication.user_session_id == user_session_id
        ).order_by(LoanApplication.submitted_at.desc()).all()
    
    def update_application_status(
        self,
        application_reference: str,
        status: str,
        bank_responses: Optional[Dict] = None
    ) -> Optional[LoanApplication]:
        """Update application status and optionally bank responses."""
        application = self.get_application_by_reference(application_reference)
        if not application:
            return None
        
        application.application_status = status
        
        if bank_responses:
            application.bank_responses = bank_responses
            
            # Recalculate approved banks
            approved_banks = [
                bank_code for bank_code, response in bank_responses.items()
                if response.get('status') == 'approved'
            ]
            application.approved_banks = approved_banks
        
        self.db.commit()
        self.db.refresh(application)
        
        logger.info("loan_application_updated",
                   application_reference=application_reference,
                   status=status)
        
        return application
    
    def mark_lead_generated(
        self,
        application_reference: str
    ) -> Optional[LoanApplication]:
        """Mark a loan application as lead generated for fee tracking."""
        application = self.get_application_by_reference(application_reference)
        if not application:
            return None
        
        application.lead_generated = True
        application.lead_generation_date = datetime.utcnow()
        application.lead_fee_paid = False
        
        self.db.commit()
        self.db.refresh(application)
        
        logger.info("loan_lead_generated",
                   application_reference=application_reference,
                   lead_fee=self.LEAD_FEE_AMOUNT)
        
        return application
    
    def mark_lead_fee_paid(
        self,
        application_reference: str
    ) -> Optional[LoanApplication]:
        """Mark the lead generation fee as paid."""
        application = self.get_application_by_reference(application_reference)
        if not application:
            return None
        
        application.lead_fee_paid = True
        
        self.db.commit()
        self.db.refresh(application)
        
        logger.info("loan_lead_fee_paid",
                   application_reference=application_reference,
                   amount=self.LEAD_FEE_AMOUNT)
        
        return application
    
    def calculate_total_lead_fees(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Calculate total lead generation fees earned.
        
        Args:
            start_date: Start date for calculation
            end_date: End date for calculation
            
        Returns:
            Dictionary with fee breakdown
        """
        query = self.db.query(LoanApplication).filter(
            LoanApplication.lead_generated == True
        )
        
        if start_date:
            query = query.filter(LoanApplication.lead_generation_date >= start_date)
        if end_date:
            query = query.filter(LoanApplication.lead_generation_date <= end_date)
        
        applications = query.all()
        
        total_fees = sum(self.LEAD_FEE_AMOUNT for app in applications if not app.lead_fee_paid)
        paid_fees = sum(self.LEAD_FEE_AMOUNT for app in applications if app.lead_fee_paid)
        
        # Breakdown by bank
        bank_breakdown = {}
        for app in applications:
            if app.best_offer_bank:
                bank = app.best_offer_bank
                if bank not in bank_breakdown:
                    bank_breakdown[bank] = {
                        'count': 0,
                        'total_fees': 0,
                        'paid_fees': 0
                    }
                bank_breakdown[bank]['count'] += 1
                bank_breakdown[bank]['total_fees'] += self.LEAD_FEE_AMOUNT
                if app.lead_fee_paid:
                    bank_breakdown[bank]['paid_fees'] += self.LEAD_FEE_AMOUNT
        
        return {
            'total_leads_generated': len(applications),
            'total_fees_earned': round(total_fees + paid_fees, 2),
            'fees_pending': round(total_fees, 2),
            'fees_paid': round(paid_fees, 2),
            'average_fee_per_lead': self.LEAD_FEE_AMOUNT,
            'bank_breakdown': bank_breakdown
        }
