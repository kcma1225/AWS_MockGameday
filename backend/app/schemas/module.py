from pydantic import BaseModel
from datetime import datetime
from uuid import UUID
from typing import Optional, Any


class ModuleOut(BaseModel):
    id: str
    name: str
    key: str
    description: Optional[str]
    input_schema_json: Optional[Any]
    evaluator_type: str
    display_order: int
    is_active: bool

    model_config = {"from_attributes": True}
