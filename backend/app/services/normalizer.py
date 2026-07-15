import re
from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator

class NormalizedVehicle(BaseModel):
    make: str
    model: str
    year: Optional[int] = Field(None, ge=1980, le=2028)
    price_lkr: float = Field(..., gt=100000.0)
    mileage: Optional[int] = Field(None, ge=0)
    fuel_type: Literal["petrol", "diesel", "hybrid", "electric", "cng"] = Field("petrol")
    transmission: Literal["manual", "auto", "triptonic"] = Field("auto")
    district: Optional[str] = None
    city: Optional[str] = None

    @field_validator("make", mode="before")
    @classmethod
    def clean_make(cls, value: str) -> str:
        val = str(value or "").strip().title()
        # Common typos or aliases normalization
        aliases = {
            "Tyoata": "Toyota",
            "Toyata": "Toyota",
            "Nisan": "Nissan",
            "Suzki": "Suzuki",
            "Mishubisi": "Mitsubishi",
            "Mitsubisi": "Mitsubishi",
        }
        return aliases.get(val, val)

    @field_validator("fuel_type", mode="before")
    @classmethod
    def clean_fuel(cls, value: str) -> str:
        val = str(value or "").strip().lower()
        if "hybrid" in val or "phev" in val:
            return "hybrid"
        if "electric" in val or "ev" in val:
            return "electric"
        if "cng" in val:
            return "cng"
        if "diesel" in val:
            return "diesel"
        return "petrol"

    @field_validator("transmission", mode="before")
    @classmethod
    def clean_transmission(cls, value: str) -> str:
        val = str(value or "").strip().lower()
        if "manual" in val:
            return "manual"
        if "triptonic" in val or "tiptronic" in val:
            return "triptonic"
        return "auto"

def parse_lkr_price(price_text: str) -> Optional[float]:
    """Parse LKR price string containing lakhs, crores, millions, or commas.
    
    Examples:
      - "Rs 5.5M" -> 5500000.0
      - "Rs 55 Lakhs" -> 5500000.0
      - "5,500,000" -> 5500000.0
      - "Rs 1.2 Crore" -> 12000000.0
    """
    raw = str(price_text).strip().lower()
    # Strip non-numeric characters except dots
    raw = re.sub(r"[^0-9.lakhcrorem]", "", raw)
    if not raw:
        return None

    try:
        # Check units
        if "lakh" in raw:
            num = float(raw.split("lakh")[0])
            return num * 100000.0
        elif "crore" in raw:
            num = float(raw.split("crore")[0])
            return num * 10000000.0
        elif "m" in raw:
            num = float(raw.split("m")[0])
            return num * 1000000.0
        else:
            return float(raw)
    except ValueError:
        return None
