import hashlib
import re
from datetime import datetime
from typing import Any, Dict, Optional
from urllib.parse import urlparse

from app.utils.districts import resolve_canonical_district
from app.utils.time import utc_now
from app.utils.vehicle_category import normalize_vehicle_category

class CarCleaner:
    MIN_REASONABLE_PRICE_LKR = 100_000
    MAX_REASONABLE_PRICE_LKR = 200_000_000
    _AUXILIARY_TEXT_FIELDS = (
        "_text_blobs",
        "detail",
        "details",
        "description",
        "meta",
        "metadata",
        "raw_meta",
        "spec",
        "specs",
    )
    _TECHNICAL_FIELD_MAX_LENGTHS = {
        "fuel_type": 20,
        "transmission": 20,
        "condition": 20,
        "body_type": 30,
    }
    _INSTALLMENT_HINTS = (
        "installment",
        "monthly",
        "per month",
        "down payment",
        "emi",
        "lease",
        "finance",
    )
    _FULL_PRICE_HINTS = (
        "price",
        "asking",
        "indicative",
        "sale",
        "cash",
        "full amount",
    )

    def __init__(self):
        # A small sample of common marks in SL
        self.makes_map = {
            "toyota": ["toyota"],
            "honda": ["honda"],
            "nissan": ["nissan"],
            "suzuki": ["suzuki", "maruti"],
            "mitsubishi": ["mitsubishi"],
            "mercedes": ["mercedes", "benz", "mercedes-benz"],
            "bmw": ["bmw"],
            "audi": ["audi"],
            "chevrolet": ["chevrolet"],
            "daihatsu": ["daihatsu"],
            "datsun": ["datsun"],
            "ford": ["ford"],
            "hyundai": ["hyundai"],
            "jeep": ["jeep"],
            "kia": ["kia"],
            "land rover": ["land rover", "land-rover"],
            "lexus": ["lexus"],
            "mazda": ["mazda"],
            "micro": ["micro"],
            "mini": ["mini"],
            "perodua": ["perodua"],
            "peugeot": ["peugeot"],
            "proton": ["proton"],
            "renault": ["renault"],
            "ssangyong": ["ssangyong"],
            "subaru": ["subaru"],
            "tata": ["tata"],
            "mahindra": ["mahindra"],
            "mg": ["mg", "morris garages"],
            "isuzu": ["isuzu"],
            "volkswagen": ["volkswagen", "vw"],
        }

    def _is_reasonable_price(self, value: int) -> bool:
        return self.MIN_REASONABLE_PRICE_LKR <= value <= self.MAX_REASONABLE_PRICE_LKR

    def normalize_price_lkr(self, raw_price: Any) -> Optional[int]:
        if raw_price is None or isinstance(raw_price, bool):
            return None

        if isinstance(raw_price, (int, float)):
            try:
                value = int(float(raw_price))
            except Exception:
                return None
            return value if self._is_reasonable_price(value) else None

        return self.clean_price(str(raw_price))
        
    def clean_title(self, title: str) -> Dict[str, Optional[str]]:
        """Parses title to extract make, model, and year."""
        title_low = title.lower()
        
        result = {
            "make": None,
            "model": None,
            "year": None
        }
        
        # 1. Extract Year (4 digits starting with 19 or 20)
        year_match = re.search(r"\b(19|20)\d{2}\b", title)
        if year_match:
            result["year"] = int(year_match.group(0))
            
        # 2. Extract Make
        for make_key, synonyms in self.makes_map.items():
            if any(syn in title_low for syn in synonyms):
                result["make"] = make_key.capitalize()
                break
                
        # 3. Very basic model extraction 
        # (In a production app, we would use a lookup table of models per make)
        if result["make"]:
            # Remove year and make from title to find model
            clean_text = title_low
            if result["year"]:
                clean_text = clean_text.replace(str(result["year"]), "")
            clean_text = clean_text.replace(result["make"].lower(), "")
            
            # Simple heuristic: first word after make/year that isn't a common word
            words = [w for w in re.split(r"\W+", clean_text) if len(w) > 2]
            common_words = {"for", "sale", "new", "mint", "condition", "car", "used", "lkr"}
            model_words = [w for w in words if w not in common_words]
            
            if model_words:
                result["model"] = model_words[0].capitalize()
                
        return result

    def clean_price(self, raw_price: str) -> Optional[int]:
        """Converts common SL price strings to int LKR, skipping unrealistic values."""
        try:
            if not raw_price:
                return None

            text = str(raw_price).replace("\xa0", " ").strip()
            if not text:
                return None

            # First parse explicit "million" notation (e.g. Rs 8.7 Million, LKR 4.35 mn).
            for pattern in (
                r"(?:(?:rs\.?|lkr)\s*[:\-]?\s*)?([0-9]+(?:\.[0-9]+)?)\s*(?:million|mn|m)\b",
            ):
                for match in re.finditer(pattern, text, flags=re.IGNORECASE):
                    if self._is_installment_candidate(text, match.start(1), match.end(1)):
                        continue
                    token = match.group(1)
                    try:
                        value = int(float(token) * 1_000_000)
                    except Exception:
                        continue
                    if self._is_reasonable_price(value):
                        return value

            # Parse SL "lakh"/"crore" notation (Rs 55 lakhs → 5,500,000; 1.2 crore → 12,000,000).
            for pattern, multiplier in (
                (r"(?:(?:rs\.?|lkr)\s*[:\-]?\s*)?([0-9]+(?:\.[0-9]+)?)\s*(?:lakhs?|lacs?)\b", 100_000),
                (r"(?:(?:rs\.?|lkr)\s*[:\-]?\s*)?([0-9]+(?:\.[0-9]+)?)\s*(?:crores?|cr)\b", 10_000_000),
            ):
                for match in re.finditer(pattern, text, flags=re.IGNORECASE):
                    if self._is_installment_candidate(text, match.start(1), match.end(1)):
                        continue
                    token = match.group(1)
                    try:
                        value = int(float(token) * multiplier)
                    except Exception:
                        continue
                    if self._is_reasonable_price(value):
                        return value

            # Prefer explicit currency markers first.
            for match in re.finditer(
                r"(?:rs\.?|lkr)\s*[:\-]?\s*([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]+)?|[0-9]{5,12}(?:\.[0-9]+)?)",
                text,
                flags=re.IGNORECASE,
            ):
                if self._is_installment_candidate(text, match.start(1), match.end(1)):
                    continue
                token = match.group(1)
                normalized = token.replace(",", "")
                value = int(float(normalized))
                if self._is_reasonable_price(value):
                    return value

            # Allow strict plain numeric prices (e.g. JSON-LD "price": "12500000").
            plain = re.fullmatch(
                r"\s*([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]+)?|[0-9]{5,12}(?:\.[0-9]+)?)\s*",
                text,
            )
            if plain:
                value = int(float(plain.group(1).replace(",", "")))
                if self._is_reasonable_price(value):
                    return value

            return None
        except:
            return None

    @classmethod
    def _is_installment_candidate(cls, text: str, start: int, end: int) -> bool:
        prefix = text[max(0, start - 40) : start].lower()
        suffix = text[end : end + 30].lower()
        context = f"{prefix} {suffix}"

        if not any(hint in context for hint in cls._INSTALLMENT_HINTS):
            return False

        # Accept if there is an explicit full-price marker nearby before the value.
        return not any(hint in prefix for hint in cls._FULL_PRICE_HINTS)

    @staticmethod
    def _flatten_text_blob(value: Any) -> str:
        if value is None:
            return ""
        if isinstance(value, str):
            return value
        if isinstance(value, dict):
            parts = []
            for key, item in value.items():
                item_text = CarCleaner._flatten_text_blob(item)
                if item_text:
                    parts.append(f"{key}: {item_text}")
            return " | ".join(parts)
        if isinstance(value, (list, tuple, set)):
            return " | ".join(CarCleaner._flatten_text_blob(item) for item in value if item is not None)
        return str(value)

    def _build_technical_text_blob(self, payload: Dict[str, Any]) -> str:
        blob_parts = []
        for field in ("title", *self._AUXILIARY_TEXT_FIELDS):
            if field in payload:
                text = self._flatten_text_blob(payload.get(field)).strip()
                if text:
                    blob_parts.append(text)
        return " | ".join(blob_parts)

    @staticmethod
    def _extract_first(text: str, patterns: tuple[tuple[str, str], ...]) -> Optional[str]:
        for pattern, value in patterns:
            if re.search(pattern, text, flags=re.IGNORECASE):
                return value
        return None

    def _infer_technical_fields(self, payload: Dict[str, Any]) -> Dict[str, Optional[str]]:
        text = self._build_technical_text_blob(payload)
        if not text:
            return {key: None for key in self._TECHNICAL_FIELD_MAX_LENGTHS}

        inferred = {
            "fuel_type": self._extract_first(
                text,
                (
                    (r"\b(?:plug[\s-]*in\s*hybrid|phev|hybrid)\b", "hybrid"),
                    (r"\b(?:electric|ev|battery\s*electric)\b", "electric"),
                    (r"\b(?:diesel)\b", "diesel"),
                    (r"\b(?:petrol|gasoline)\b", "petrol"),
                    (r"\b(?:cng)\b", "cng"),
                    (r"\b(?:lpg)\b", "lpg"),
                ),
            ),
            "transmission": self._extract_first(
                text,
                (
                    (r"\b(?:automatic|cvt|tiptronic|triptronic|dct|amt|geartronic|pdk)\b", "automatic"),
                    (r"\b(?:manual|stick\s*shift)\b", "manual"),
                ),
            ),
            "body_type": self._extract_first(
                text,
                (
                    (r"\b(?:suv|sport\s*utility)\b", "suv"),
                    (r"\b(?:sedan|saloon)\b", "sedan"),
                    (r"\b(?:hatchback)\b", "hatchback"),
                    (r"\b(?:pickup|pick[\s-]*up|double\s*cab|single\s*cab)\b", "pickup"),
                    (r"\b(?:crossover)\b", "crossover"),
                    (r"\b(?:wagon|estate)\b", "wagon"),
                    (r"\b(?:coupe)\b", "coupe"),
                    (r"\b(?:convertible|cabriolet)\b", "convertible"),
                    (r"\b(?:mpv|minivan)\b", "mpv"),
                    (r"\b(?:van)\b", "van"),
                ),
            ),
            "condition": self._extract_first(
                text,
                (
                    (r"\b(?:recondition(?:ed)?|recon)\b", "reconditioned"),
                    (r"\b(?:brand\s*new|unregistered|zero\s*mileage)\b", "new"),
                    (r"\b(?:used|pre[\s-]*owned|second\s*owner|mint\s*condition)\b", "used"),
                ),
            ),
        }
        return inferred

    @staticmethod
    def _truncate_text(value: Any, max_len: int) -> str:
        if value is None:
            return ""
        text = str(value).strip()
        return text[:max_len] if len(text) > max_len else text

    def make_source_id(self, source_id_or_url: str) -> str:
        raw = str(source_id_or_url or "").strip()
        if not raw:
            return ""

        parsed = urlparse(raw)
        if parsed.scheme and parsed.netloc:
            candidate = parsed.path or "/"
            if parsed.query:
                candidate = f"{candidate}?{parsed.query}"
        else:
            candidate = raw

        if len(candidate) <= 100:
            return candidate

        digest = hashlib.sha1(candidate.encode("utf-8")).hexdigest()[:16]
        tail = candidate[-80:]
        return self._truncate_text(f"{tail}#{digest}", 100)

    def normalize_listing_payload(self, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        normalized = dict(payload)
        allow_missing_price = bool(normalized.pop("_allow_missing_price", False))
        inferred_fields = self._infer_technical_fields(normalized)

        source = self._truncate_text(normalized.get("source"), 20)
        if not source:
            return None
        normalized["source"] = source

        source_id = self.make_source_id(normalized.get("source_id") or normalized.get("url"))
        if not source_id:
            return None
        normalized["source_id"] = source_id

        make = self._truncate_text(normalized.get("make"), 50)
        if not make:
            return None
        normalized["make"] = make
        normalized["model"] = self._truncate_text(normalized.get("model") or "Other", 100) or "Other"

        for key, max_len in (
            ("fuel_type", 20),
            ("transmission", 20),
            ("condition", 20),
            ("body_type", 30),
            ("vehicle_category", 40),
            ("district", 50),
            ("city", 100),
        ):
            if key in normalized and normalized[key] is not None:
                trimmed = self._truncate_text(normalized[key], max_len)
                normalized[key] = trimmed if trimmed else None

        if normalized.get("vehicle_category"):
            normalized["vehicle_category"] = normalize_vehicle_category(
                normalized.get("vehicle_category")
            )

        listing_url = normalized.get("url")
        canonical_district = resolve_canonical_district(normalized.get("district"), listing_url)
        if canonical_district:
            normalized["district"] = canonical_district
        elif normalized.get("district") and str(normalized["district"]).strip().lower() == "sri lanka":
            normalized["district"] = None

        for key, max_len in self._TECHNICAL_FIELD_MAX_LENGTHS.items():
            if normalized.get(key):
                continue
            inferred = inferred_fields.get(key)
            if inferred:
                normalized[key] = self._truncate_text(inferred, max_len) or None

        for key in self._AUXILIARY_TEXT_FIELDS:
            normalized.pop(key, None)

        raw_price = normalized.get("price_lkr")
        price = self.normalize_price_lkr(raw_price)
        if price is None and not allow_missing_price:
            return None
        normalized["price_lkr"] = price

        try:
            year = int(normalized.get("year") or 0)
        except Exception:
            year = 0
        current_year = utc_now().year
        if not (1950 <= year <= current_year + 1):
            normalized["year"] = None  # Don't default to 2015 - leave as NULL
        else:
            normalized["year"] = year

        return normalized

    def clean_mileage(self, raw_mileage: str) -> Optional[int]:
        """Converts '50,000 km' to 50000."""
        try:
            digits = re.sub(r"\D", "", raw_mileage)
            return int(digits) if digits else None
        except:
            return None
