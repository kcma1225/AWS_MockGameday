from pydantic import BaseModel
from datetime import datetime
from uuid import UUID
from typing import Optional


class EventSummary(BaseModel):
    id: str
    public_event_id: str
    title: str
    slug: str
    status: str
    start_time: Optional[datetime]
    end_time: Optional[datetime]
    timezone: str

    model_config = {"from_attributes": True}


class EventOut(BaseModel):
    id: str
    public_event_id: str
    title: str
    slug: str
    description: Optional[str]
    status: str
    start_time: Optional[datetime]
    end_time: Optional[datetime]
    timezone: str
    scoreboard_public: bool
    show_aws_console_button: bool
    show_ssh_key_button: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
