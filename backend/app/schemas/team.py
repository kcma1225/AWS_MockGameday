from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class TeamOut(BaseModel):
    id: str
    public_team_id: str
    team_name: str
    encoded_team_id_base64: str
    score_total: float
    trend_value: float
    rank_cache: Optional[int]
    is_active: bool

    model_config = {"from_attributes": True}


class TeamDashboard(BaseModel):
    """Full team dashboard context for the participant UI."""

    team_id: str
    public_team_id: str
    team_name: str
    encoded_team_id_base64: str
    score_total: float
    trend_value: float
    rank_cache: Optional[int]

    event_id: str
    public_event_id: str
    event_title: str
    event_status: str
    event_start_time: Optional[datetime]
    event_end_time: Optional[datetime]
    scoreboard_public: bool
    root_url_detection_enabled: bool
    shared_folder_enabled: bool
    show_aws_console_button: bool
    show_ssh_key_button: bool
