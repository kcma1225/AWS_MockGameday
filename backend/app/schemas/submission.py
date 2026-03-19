from pydantic import BaseModel, field_validator
from datetime import datetime
from typing import Optional
import re


class SubmissionIn(BaseModel):
    url: str

    @field_validator("url")
    @classmethod
    def validate_url_format(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("URL cannot be empty")
        if not re.match(r"^https?://", v, re.IGNORECASE):
            raise ValueError("URL must start with http:// or https://")
        if len(v) > 2000:
            raise ValueError("URL too long")
        # Basic structure check
        if not re.match(r"^https?://[^\s/$.?#].[^\s]*$", v, re.IGNORECASE):
            raise ValueError("Invalid URL format")
        return v


class SubmissionOut(BaseModel):
    id: str
    module_id: str
    input_value: str
    normalized_value: Optional[str]
    validation_status: str
    submitted_at: datetime

    model_config = {"from_attributes": True}


class ModuleStatusOut(BaseModel):
    module_id: str
    latest_submission: Optional[SubmissionOut]
    validation_status: str
