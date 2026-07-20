"""Vehicle history report service for Phase 1 Trust Infrastructure.

Integrates with AA Sri Lanka and insurance databases to provide comprehensive
vehicle history reports including accidents, ownership, odometer readings, and more.
"""
import structlog
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import and_

from db.models import VehicleHistoryReport, CarListing

logger = structlog.get_logger()


class VehicleHistoryService:
    """Service for generating and managing vehicle history reports."""
    
    # Pricing in LKR
    REPORT_PRICE = 1000.00
    
    def __init__(self, db_session: Session):
        self.db = db_session
    
    def create_report_request(
        self,
        listing_id: int,
        vin_chassis_number: Optional[str] = None,
        registration_number: Optional[str] = None
    ) -> VehicleHistoryReport:
        """Create a new vehicle history report request.
        
        Args:
            listing_id: ID of the car listing
            vin_chassis_number: VIN or chassis number if available
            registration_number: Registration number if available
            
        Returns:
            Created VehicleHistoryReport instance
        """
        # Get listing details
        listing = self.db.query(CarListing).filter(
            CarListing.id == listing_id,
            CarListing.is_active == True
        ).first()
        
        if not listing:
            raise ValueError(f"Active listing with ID {listing_id} not found")
        
        # Create report record
        report = VehicleHistoryReport(
            listing_id=listing_id,
            vin_chassis_number=vin_chassis_number,
            registration_number=registration_number,
            status='generating',
            payment_status='pending',
            report_cost_lkr=self.REPORT_PRICE
        )
        
        self.db.add(report)
        self.db.commit()
        self.db.refresh(report)
        
        logger.info("vehicle_history_report_created", 
                   report_id=report.id, 
                   listing_id=listing_id,
                   status=report.status)
        
        return report
    
    def get_report_by_id(self, report_id: int) -> Optional[VehicleHistoryReport]:
        """Get a vehicle history report by ID."""
        return self.db.query(VehicleHistoryReport).filter(
            VehicleHistoryReport.id == report_id
        ).first()
    
    def get_report_by_listing(self, listing_id: int) -> Optional[VehicleHistoryReport]:
        """Get the most recent vehicle history report for a listing."""
        return self.db.query(VehicleHistoryReport).filter(
            VehicleHistoryReport.listing_id == listing_id
        ).order_by(VehicleHistoryReport.generated_at.desc()).first()
    
    def update_report_status(
        self,
        report_id: int,
        status: str,
        report_data: Optional[Dict[str, Any]] = None
    ) -> Optional[VehicleHistoryReport]:
        """Update the status and data of a vehicle history report.
        
        Args:
            report_id: ID of the report to update
            status: New status (generating, ready, failed, expired)
            report_data: Dictionary containing report data fields
            
        Returns:
            Updated VehicleHistoryReport instance or None if not found
        """
        report = self.get_report_by_id(report_id)
        if not report:
            return None
        
        report.status = status
        
        if report_data:
            # Update report data fields
            if 'accident_count' in report_data:
                report.accident_count = report_data['accident_count']
            if 'accident_details' in report_data:
                report.accident_details = report_data['accident_details']
            if 'ownership_count' in report_data:
                report.ownership_count = report_data['ownership_count']
            if 'ownership_history' in report_data:
                report.ownership_history = report_data['ownership_history']
            if 'odometer_readings' in report_data:
                report.odometer_readings = report_data['odometer_readings']
            if 'service_history' in report_data:
                report.service_history = report_data['service_history']
            if 'insurance_claims' in report_data:
                report.insurance_claims = report_data['insurance_claims']
            if 'is_stolen' in report_data:
                report.is_stolen = report_data['is_stolen']
            if 'is_written_off' in report_data:
                report.is_written_off = report_data['is_written_off']
            if 'recall_notices' in report_data:
                report.recall_notices = report_data['recall_notices']
            if 'aa_verified' in report_data:
                report.aa_verified = report_data['aa_verified']
            if 'verification_date' in report_data:
                report.verification_date = report_data['verification_date']
            if 'verifier_name' in report_data:
                report.verifier_name = report_data['verifier_name']
            if 'report_url' in report_data:
                report.report_url = report_data['report_url']
        
        if status == 'ready':
            report.generated_at = datetime.utcnow()
            # Set expiry to 30 days from generation
            report.expires_at = datetime.utcnow() + timedelta(days=30)
        elif status == 'failed':
            report.payment_status = 'refunded'
        
        self.db.commit()
        self.db.refresh(report)
        
        logger.info("vehicle_history_report_updated",
                   report_id=report_id,
                   status=status)
        
        return report
    
    def mark_payment_completed(
        self,
        report_id: int,
        payment_id: str
    ) -> Optional[VehicleHistoryReport]:
        """Mark a report's payment as completed."""
        report = self.get_report_by_id(report_id)
        if not report:
            return None
        
        report.payment_status = 'paid'
        report.payment_id = payment_id
        
        self.db.commit()
        self.db.refresh(report)
        
        logger.info("vehicle_history_payment_completed",
                   report_id=report_id,
                   payment_id=payment_id)
        
        return report
    
    def generate_mock_report(self, listing_id: int) -> Dict[str, Any]:
        """Generate a mock vehicle history report for demo/testing purposes.
        
        In production, this would call AA Sri Lanka API or other data sources.
        """
        import random
        
        listing = self.db.query(CarListing).filter(
            CarListing.id == listing_id
        ).first()
        
        if not listing:
            raise ValueError(f"Listing {listing_id} not found")
        
        # Generate realistic mock data
        accident_count = random.choices([0, 1, 2], weights=[70, 25, 5])[0]
        ownership_count = random.randint(1, 4)
        
        accident_details = []
        if accident_count > 0:
            severities = ['minor', 'moderate', 'severe']
            for i in range(accident_count):
                accident_details.append({
                    'date': f"{random.randint(2018, 2024)}-{random.randint(1, 12):02d}-{random.randint(1, 28):02d}",
                    'severity': random.choice(severities),
                    'damage_description': f"Accident {i+1} damage description",
                    'repaired': True,
                    'repair_cost_lkr': random.randint(50000, 500000)
                })
        
        ownership_history = []
        for i in range(ownership_count):
            ownership_history.append({
                'owner_number': i + 1,
                'ownership_period': f"{2015 + i} - {'Present' if i == ownership_count - 1 else 2015 + i + 1}",
                'owner_type': 'Individual' if i < ownership_count - 1 else 'Current Owner'
            })
        
        odometer_readings = [
            {'date': f"{year}-01-15", 'reading_km': mileage, 'source': 'Service Record'}
            for year, mileage in zip(
                range(listing.year or 2015, 2025),
                range(0, (2025 - (listing.year or 2015)) * 15000, 15000)
            )
        ]
        
        return {
            'accident_count': accident_count,
            'accident_details': accident_details if accident_details else None,
            'ownership_count': ownership_count,
            'ownership_history': ownership_history,
            'odometer_readings': odometer_readings,
            'service_history': [
                {
                    'date': f"{2020 + i}-06-15",
                    'type': 'Regular Service',
                    'mileage_km': 15000 * (i + 1),
                    'service_center': f"Authorized Service Center {i+1}"
                }
                for i in range(3)
            ],
            'insurance_claims': None if accident_count == 0 else [
                {
                    'claim_date': f"2022-03-10",
                    'claim_amount_lkr': 150000,
                    'claim_type': 'Accident Repair',
                    'status': 'Settled'
                }
            ],
            'is_stolen': False,
            'is_written_off': False,
            'recall_notices': None,
            'aa_verified': True,
            'verification_date': datetime.utcnow().isoformat(),
            'verifier_name': 'AA Sri Lanka - Colombo Branch'
        }
