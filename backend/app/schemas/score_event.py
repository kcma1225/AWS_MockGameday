from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


class ScoreEventOut(BaseModel):
    id: str
    timestamp_ms: int
    points: float
    source: str
    reason: str
    category: str
    module_id: Optional[str]

    model_config = {"from_attributes": True}


class ScoreEventPage(BaseModel):
    items: List[ScoreEventOut]
    page: int
    page_size: int
    total: int


class ScoreboardRow(BaseModel):
    rank: int
    team_name: str
    public_team_id: str
    score_total: float
    trend_value: float
    is_current_team: bool
    is_active: bool
    last_score_at: Optional[datetime]


class ScoreboardOut(BaseModel):
    updated_at: datetime
    rows: List[ScoreboardRow]
