from pydantic import BaseModel, Field, AliasChoices
from uuid import UUID


class CodeLoginRequest(BaseModel):
    code: str


class TeamInfo(BaseModel):
    id: str
    public_team_id: str
    team_name: str
    encoded_team_id_base64: str


class EventInfo(BaseModel):
    id: str
    public_event_id: str
    title: str
    status: str


class CodeLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    event: EventInfo
    team: TeamInfo


class MeResponse(BaseModel):
    session_id: str
    team_id: str
    event_id: str
    public_team_id: str
    team_name: str
    encoded_team_id_base64: str
    public_event_id: str
    event_title: str
    event_status: str


class AdminLoginRequest(BaseModel):
    login: str = Field(validation_alias=AliasChoices("login", "email", "username"))
    password: str


class AdminLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    admin_id: str
    email: str
    display_name: str
    role: str
