from pydantic import BaseModel, EmailStr, Field, field_validator
from datetime import datetime
from typing import Optional, List, Any


class AdminEventCreate(BaseModel):
    title: str
    slug: str
    description: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    timezone: str = "UTC"
    readme_markdown: Optional[str] = None
    runbook_markdown: Optional[str] = None
    scoreboard_public: bool = True
    show_aws_console_button: bool = False
    show_ssh_key_button: bool = False


class AdminEventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    timezone: Optional[str] = None
    readme_markdown: Optional[str] = None
    runbook_markdown: Optional[str] = None
    scoreboard_public: Optional[bool] = None
    show_aws_console_button: Optional[bool] = None
    show_ssh_key_button: Optional[bool] = None


class AdminTeamCreate(BaseModel):
    team_name: str


class AdminTeamBulkCreate(BaseModel):
    team_names: List[str]

    @field_validator("team_names")
    @classmethod
    def validate_team_names(cls, v: List[str]) -> List[str]:
        if not v:
            raise ValueError("At least one team name required")
        if len(v) > 100:
            raise ValueError("Maximum 100 teams per bulk create")
        cleaned = [name.strip() for name in v if name.strip()]
        if len(cleaned) != len(v):
            raise ValueError("Team names cannot be empty or whitespace-only")
        return cleaned


class AdminTeamOut(BaseModel):
    id: str
    public_team_id: str
    team_name: str
    encoded_team_id_base64: str
    login_code: Optional[str]
    score_total: float
    trend_value: float
    rank_cache: Optional[int]
    is_active: bool
    created_at: datetime


class AdminModuleCreate(BaseModel):
    name: str
    key: str
    description: Optional[str] = None
    evaluator_type: str = "http_latency"
    display_order: int = 0
    input_schema_json: Optional[Any] = None


class AdminModuleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    evaluator_type: Optional[str] = None
    display_order: Optional[int] = None
    is_active: Optional[bool] = None


class AdminTestingRound(BaseModel):
    name: str
    requests_per_second: int
    duration_seconds: int

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Round name is required")
        if len(cleaned) > 80:
            raise ValueError("Round name must be 80 characters or less")
        return cleaned

    @field_validator("requests_per_second")
    @classmethod
    def validate_rps(cls, v: int) -> int:
        if v < 1 or v > 100:
            raise ValueError("requests_per_second must be between 1 and 100")
        return v

    @field_validator("duration_seconds")
    @classmethod
    def validate_duration(cls, v: int) -> int:
        if v < 1 or v > 600:
            raise ValueError("duration_seconds must be between 1 and 600")
        return v


class AdminChallengeRoundCreate(AdminTestingRound):
    pass


class AdminChallengeRoundTrigger(BaseModel):
    round_index: Optional[int] = None
    requests_per_second: Optional[int] = None
    duration_seconds: Optional[int] = None

    @field_validator("round_index")
    @classmethod
    def validate_round_index(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v < 0:
            raise ValueError("round_index must be 0 or greater")
        return v

    @field_validator("requests_per_second")
    @classmethod
    def validate_optional_rps(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and (v < 1 or v > 100):
            raise ValueError("requests_per_second must be between 1 and 100")
        return v

    @field_validator("duration_seconds")
    @classmethod
    def validate_optional_duration(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and (v < 1 or v > 600):
            raise ValueError("duration_seconds must be between 1 and 600")
        return v


class AdminScoreEventCreate(BaseModel):
    team_id: str
    module_id: Optional[str] = None
    points: float
    source: str
    reason: str
    category: str = "manual"


class AdminUserCreate(BaseModel):
    email: EmailStr
    password: str
    display_name: str
    role: str = "organizer"


class AdminEventOut(BaseModel):
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
    readme_markdown: Optional[str]
    runbook_markdown: Optional[str]
    testing_rounds: List[AdminTestingRound] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
    team_count: int = 0
