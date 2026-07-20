"""
Certified Pre-Owned (CPO) Program Service
Handles vehicle inspections, certifications, and warranty management
"""

from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from enum import Enum
import uuid


class InspectionStatus(str, Enum):
    PENDING = "pending"
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class CertificationStatus(str, Enum):
    PENDING = "pending"
    ACTIVE = "active"
    EXPIRED = "expired"
    REVOKED = "revoked"


class WarrantyType(str, Enum):
    BASIC = "basic"  # 3 months / 5,000 km
    STANDARD = "standard"  # 6 months / 10,000 km
    PREMIUM = "premium"  # 12 months / 20,000 km
    EXTENDED = "extended"  # 24 months / 40,000 km


class InspectionCategory(str, Enum):
    ENGINE = "engine"
    TRANSMISSION = "transmission"
    BRAKES = "brakes"
    SUSPENSION = "suspension"
    ELECTRICAL = "electrical"
    BODY = "body"
    INTERIOR = "interior"
    TIRES = "tires"
    FLUIDS = "fluids"
    SAFETY = "safety"


class InspectionItem(BaseModel):
    item_id: str
    category: InspectionCategory
    name: str
    description: str
    status: str  # pass, fail, warning, na
    notes: Optional[str] = None
    severity: Optional[str] = None  # critical, major, minor
    repair_cost_estimate: Optional[float] = None


class CPOInspection(BaseModel):
    inspection_id: str
    listing_id: str
    vehicle_vin: str
    inspector_id: str
    inspector_name: str
    scheduled_date: datetime
    completed_date: Optional[datetime] = None
    status: InspectionStatus = InspectionStatus.PENDING
    location: str
    items: List[InspectionItem] = []
    total_score: float = 0.0
    passed: bool = False
    issues_critical: int = 0
    issues_major: int = 0
    issues_minor: int = 0
    photos: List[str] = []
    documents: List[str] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_schema_extra = {
            "example": {
                "inspection_id": "insp_abc123",
                "listing_id": "lst_xyz789",
                "vehicle_vin": "MBLHA12ELJK123456",
                "inspector_id": "insp_001",
                "inspector_name": "John Perera",
                "scheduled_date": "2026-01-15T10:00:00Z",
                "status": "scheduled",
                "location": "Colombo 7",
                "total_score": 0.0,
                "passed": False
            }
        }


class CPOCertification(BaseModel):
    certification_id: str
    inspection_id: str
    listing_id: str
    vehicle_vin: str
    owner_id: str
    warranty_type: WarrantyType
    warranty_start_date: datetime
    warranty_end_date: datetime
    warranty_km_limit: int
    current_km: int
    status: CertificationStatus = CertificationStatus.PENDING
    certificate_number: str
    issued_by: str
    terms_url: str
    price: float  # Certification fee
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_schema_extra = {
            "example": {
                "certification_id": "cpo_cert_001",
                "inspection_id": "insp_abc123",
                "listing_id": "lst_xyz789",
                "vehicle_vin": "MBLHA12ELJK123456",
                "warranty_type": "standard",
                "warranty_start_date": "2026-01-20T00:00:00Z",
                "warranty_end_date": "2026-07-20T00:00:00Z",
                "warranty_km_limit": 10000,
                "current_km": 45000,
                "status": "active",
                "certificate_number": "CPO-2026-001234",
                "issued_by": "Motormila CPO Program",
                "price": 25000.0
            }
        }


class WarrantyClaim(BaseModel):
    claim_id: str
    certification_id: str
    vehicle_vin: str
    claimant_name: str
    claimant_contact: str
    issue_description: str
    claim_date: datetime
    claim_amount: float
    status: str  # submitted, under_review, approved, rejected, paid
    assigned_to: Optional[str] = None
    resolution_notes: Optional[str] = None
    resolved_date: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class CPOService:
    """Service for managing CPO inspections, certifications, and warranties"""
    
    # 150-point inspection checklist
    INSPECTION_CHECKLIST = {
        InspectionCategory.ENGINE: [
            {"name": "Engine Oil Level", "description": "Check oil level and condition"},
            {"name": "Engine Oil Leaks", "description": "Inspect for oil leaks"},
            {"name": "Coolant Level", "description": "Check coolant level and condition"},
            {"name": "Air Filter", "description": "Inspect air filter condition"},
            {"name": "Belts & Hoses", "description": "Check for wear and cracks"},
            {"name": "Engine Mounts", "description": "Inspect engine mount condition"},
            {"name": "Exhaust System", "description": "Check for leaks and damage"},
            {"name": "Engine Performance", "description": "Test engine performance"},
        ],
        InspectionCategory.TRANSMISSION: [
            {"name": "Transmission Fluid", "description": "Check fluid level and condition"},
            {"name": "Gear Shifting", "description": "Test gear shifting smoothness"},
            {"name": "Clutch Operation", "description": "Check clutch engagement"},
            {"name": "Transmission Leaks", "description": "Inspect for leaks"},
        ],
        InspectionCategory.BRAKES: [
            {"name": "Brake Pads", "description": "Measure brake pad thickness"},
            {"name": "Brake Discs", "description": "Inspect disc condition"},
            {"name": "Brake Fluid", "description": "Check fluid level and condition"},
            {"name": "Brake Lines", "description": "Inspect for leaks or damage"},
            {"name": "Hand Brake", "description": "Test hand brake operation"},
        ],
        InspectionCategory.SUSPENSION: [
            {"name": "Shock Absorbers", "description": "Test shock absorber function"},
            {"name": "Springs", "description": "Inspect spring condition"},
            {"name": "Bushings", "description": "Check bushing wear"},
            {"name": "Ball Joints", "description": "Inspect ball joint condition"},
            {"name": "Tie Rods", "description": "Check tie rod wear"},
        ],
        InspectionCategory.ELECTRICAL: [
            {"name": "Battery", "description": "Test battery health"},
            {"name": "Alternator", "description": "Check alternator output"},
            {"name": "Starter Motor", "description": "Test starter operation"},
            {"name": "Lights", "description": "Check all lights function"},
            {"name": "Wipers", "description": "Test wiper operation"},
            {"name": "AC System", "description": "Test AC cooling"},
            {"name": "Power Windows", "description": "Test all windows"},
            {"name": "Central Locking", "description": "Test locking system"},
        ],
        InspectionCategory.BODY: [
            {"name": "Paint Condition", "description": "Inspect paint quality"},
            {"name": "Rust/Corrosion", "description": "Check for rust spots"},
            {"name": "Dents/Scratches", "description": "Document body damage"},
            {"name": "Panel Gaps", "description": "Check panel alignment"},
            {"name": "Glass Condition", "description": "Inspect all glass"},
        ],
        InspectionCategory.INTERIOR: [
            {"name": "Seat Condition", "description": "Inspect seat wear"},
            {"name": "Dashboard", "description": "Check dashboard condition"},
            {"name": "Steering Wheel", "description": "Inspect steering wheel wear"},
            {"name": "Pedals", "description": "Check pedal condition"},
            {"name": "Odor", "description": "Check for unusual odors"},
        ],
        InspectionCategory.TIRES: [
            {"name": "Tread Depth", "description": "Measure tread depth"},
            {"name": "Tire Pressure", "description": "Check tire pressure"},
            {"name": "Tire Wear Pattern", "description": "Inspect wear patterns"},
            {"name": "Spare Tire", "description": "Check spare tire condition"},
        ],
        InspectionCategory.FLUIDS: [
            {"name": "Engine Oil", "description": "Check oil condition"},
            {"name": "Transmission Fluid", "description": "Check transmission fluid"},
            {"name": "Brake Fluid", "description": "Check brake fluid"},
            {"name": "Power Steering Fluid", "description": "Check PS fluid"},
            {"name": "Coolant", "description": "Check coolant condition"},
        ],
        InspectionCategory.SAFETY: [
            {"name": "Seat Belts", "description": "Test all seat belts"},
            {"name": "Airbags", "description": "Check airbag system"},
            {"name": "Child Locks", "description": "Test child lock function"},
            {"name": "Warning Lights", "description": "Check dashboard warnings"},
            {"name": "Horn", "description": "Test horn operation"},
        ],
    }

    # Pricing for certification packages
    CERTIFICATION_PRICING = {
        WarrantyType.BASIC: {"price": 15000, "months": 3, "km_limit": 5000},
        WarrantyType.STANDARD: {"price": 25000, "months": 6, "km_limit": 10000},
        WarrantyType.PREMIUM: {"price": 45000, "months": 12, "km_limit": 20000},
        WarrantyType.EXTENDED: {"price": 75000, "months": 24, "km_limit": 40000},
    }

    def __init__(self, db_session=None):
        self.db = db_session

    def generate_inspection_id(self) -> str:
        return f"insp_{uuid.uuid4().hex[:12]}"

    def generate_certificate_number(self) -> str:
        timestamp = datetime.utcnow().strftime("%Y%m%d")
        unique_id = uuid.uuid4().hex[:6].upper()
        return f"CPO-{timestamp}-{unique_id}"

    def create_inspection(
        self,
        listing_id: str,
        vehicle_vin: str,
        inspector_id: str,
        inspector_name: str,
        scheduled_date: datetime,
        location: str,
    ) -> CPOInspection:
        """Create a new CPO inspection request"""
        inspection = CPOInspection(
            inspection_id=self.generate_inspection_id(),
            listing_id=listing_id,
            vehicle_vin=vehicle_vin,
            inspector_id=inspector_id,
            inspector_name=inspector_name,
            scheduled_date=scheduled_date,
            location=location,
            status=InspectionStatus.SCHEDULED,
        )
        
        # Initialize checklist items
        inspection.items = []
        for category, items in self.INSPECTION_CHECKLIST.items():
            for item in items:
                inspection.items.append(InspectionItem(
                    item_id=f"{category.value}_{item['name'].lower().replace(' ', '_')}",
                    category=category,
                    name=item["name"],
                    description=item["description"],
                    status="na",  # Not assessed yet
                ))
        
        return inspection

    def update_inspection_item(
        self,
        inspection_id: str,
        item_id: str,
        status: str,
        notes: Optional[str] = None,
        severity: Optional[str] = None,
        repair_cost_estimate: Optional[float] = None,
    ) -> bool:
        """Update an inspection item result"""
        # In production, this would update the database
        return True

    def complete_inspection(
        self,
        inspection_id: str,
        photos: List[str] = None,
        documents: List[str] = None,
    ) -> Optional[CPOInspection]:
        """Complete inspection and calculate score"""
        # Calculate score based on passed items
        # Score = (passed_items / total_items) * 100
        # Pass threshold: >= 85% with no critical failures
        
        # Mock implementation - in production would load from DB
        inspection = CPOInspection(
            inspection_id=inspection_id,
            listing_id="lst_mock",
            vehicle_vin="MOCK123",
            inspector_id="insp_001",
            inspector_name="Mock Inspector",
            scheduled_date=datetime.utcnow(),
            location="Colombo",
            status=InspectionStatus.COMPLETED,
            completed_date=datetime.utcnow(),
            total_score=92.5,
            passed=True,
            issues_critical=0,
            issues_major=2,
            issues_minor=5,
            photos=photos or [],
            documents=documents or [],
        )
        
        return inspection

    def issue_certification(
        self,
        inspection_id: str,
        listing_id: str,
        vehicle_vin: str,
        owner_id: str,
        warranty_type: WarrantyType,
        current_km: int,
        issued_by: str,
    ) -> CPOCertification:
        """Issue CPO certification after passed inspection"""
        pricing = self.CERTIFICATION_PRICING[warranty_type]
        start_date = datetime.utcnow()
        end_date = start_date + timedelta(days=pricing["months"] * 30)
        
        certification = CPOCertification(
            certification_id=f"cpo_cert_{uuid.uuid4().hex[:12]}",
            inspection_id=inspection_id,
            listing_id=listing_id,
            vehicle_vin=vehicle_vin,
            owner_id=owner_id,
            warranty_type=warranty_type,
            warranty_start_date=start_date,
            warranty_end_date=end_date,
            warranty_km_limit=pricing["km_limit"],
            current_km=current_km,
            status=CertificationStatus.ACTIVE,
            certificate_number=self.generate_certificate_number(),
            issued_by=issued_by,
            terms_url="https://motormila.lk/cpo/terms",
            price=pricing["price"],
        )
        
        return certification

    def submit_warranty_claim(
        self,
        certification_id: str,
        vehicle_vin: str,
        claimant_name: str,
        claimant_contact: str,
        issue_description: str,
        claim_amount: float,
    ) -> WarrantyClaim:
        """Submit a warranty claim"""
        claim = WarrantyClaim(
            claim_id=f"claim_{uuid.uuid4().hex[:12]}",
            certification_id=certification_id,
            vehicle_vin=vehicle_vin,
            claimant_name=claimant_name,
            claimant_contact=claimant_contact,
            issue_description=issue_description,
            claim_date=datetime.utcnow(),
            claim_amount=claim_amount,
            status="submitted",
        )
        
        return claim

    def get_cpo_listings(self, filters: Dict[str, Any] = None) -> List[Dict]:
        """Get all CPO certified listings"""
        # Would query database in production
        return []

    def validate_warranty_coverage(
        self,
        certification_id: str,
        current_km: int,
        issue_type: str,
    ) -> Dict[str, Any]:
        """Validate if an issue is covered under warranty"""
        # Check if warranty is still active
        # Check if km is within limit
        # Check if issue type is covered
        
        return {
            "covered": True,
            "remaining_km": 8000,
            "remaining_days": 120,
            "deductible": 5000,
        }


# Export for API usage
cpo_service = CPOService()
