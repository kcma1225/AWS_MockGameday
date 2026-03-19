// ---- Auth ----

export interface TeamInfo {
  id: string;
  public_team_id: string;
  team_name: string;
  encoded_team_id_base64: string;
}

export interface EventInfo {
  id: string;
  public_event_id: string;
  title: string;
  status: EventStatus;
}

export type EventStatus = "draft" | "live" | "paused" | "ended";

export interface LoginResponse {
  access_token: string;
  token_type: string;
  event: EventInfo;
  team: TeamInfo;
}

export interface MeResponse {
  session_id: string;
  team_id: string;
  event_id: string;
  public_team_id: string;
  team_name: string;
  encoded_team_id_base64: string;
  public_event_id: string;
  event_title: string;
  event_status: EventStatus;
}

// ---- Team Dashboard ----

export interface TeamDashboard {
  team_id: string;
  public_team_id: string;
  team_name: string;
  encoded_team_id_base64: string;
  score_total: number;
  trend_value: number;
  rank_cache: number | null;
  event_id: string;
  public_event_id: string;
  event_title: string;
  event_status: EventStatus;
  event_start_time: string | null;
  event_end_time: string | null;
  show_aws_console_button: boolean;
  show_ssh_key_button: boolean;
}

// ---- Module ----

export interface Module {
  id: string;
  name: string;
  key: string;
  description: string | null;
  input_schema_json: Record<string, unknown> | null;
  evaluator_type: string;
  display_order: number;
  is_active: boolean;
}

export interface Submission {
  id: string;
  module_id: string;
  input_value: string;
  normalized_value: string | null;
  validation_status: "pending" | "accepted" | "rejected" | "error" | "none";
  submitted_at: string;
}

export interface ModuleStatus {
  module_id: string;
  latest_submission: Submission | null;
  validation_status: string;
}

// ---- Score Events ----

export interface ScoreEvent {
  id: string;
  timestamp_ms: number;
  points: number;
  source: string;
  reason: string;
  category: string;
  module_id?: string | null;
}

export interface ScoreEventPage {
  items: ScoreEvent[];
  page: number;
  page_size: number;
  total: number;
}

// ---- Scoreboard ----

export interface ScoreboardRow {
  rank: number;
  team_name: string;
  public_team_id: string;
  score_total: number;
  trend_value: number;
  is_current_team: boolean;
  is_active: boolean;
  last_score_at: string | null;
}

export interface Scoreboard {
  updated_at: string;
  rows: ScoreboardRow[];
}

// ---- README ----

export interface ReadmeContent {
  readme_markdown: string | null;
  runbook_markdown: string | null;
  event_title: string;
}

// ---- Admin ----

export interface AdminEvent {
  id: string;
  public_event_id: string;
  title: string;
  slug: string;
  description: string | null;
  status: EventStatus;
  start_time: string | null;
  end_time: string | null;
  timezone: string;
  scoreboard_public: boolean;
  show_aws_console_button: boolean;
  show_ssh_key_button: boolean;
  readme_markdown: string | null;
  runbook_markdown: string | null;
  testing_rounds: AdminTestingRound[];
  created_at: string;
  updated_at: string;
  team_count: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  modules?: any[];
}

export interface AdminTestingRound {
  name: string;
  requests_per_second: number;
  duration_seconds: number;
}

export interface AdminChallengeRoundsResponse {
  rounds: AdminTestingRound[];
}

export interface AdminChallengeTriggerResponse {
  round_name: string;
  requests_per_second: number;
  duration_seconds: number;
  per_endpoint_requests: number;
  tasks_dispatched: number;
  dispatched_tasks: number;
  teams: number;
  modules: number;
}

export interface AdminTeam {
  id: string;
  public_team_id: string;
  team_name: string;
  encoded_team_id_base64: string;
  login_code: string | null;
  score_total: number;
  trend_value: number;
  rank_cache: number | null;
  is_active: boolean;
  created_at: string;
}

// ---- Admin Score Event ----

export interface AdminScoreEvent {
  id: string;
  team_id: string;
  team_name: string;
  timestamp_ms: number;
  points: number;
  source: string;
  reason: string;
  category: string;
}

export interface WSScoreEvent {
  id: string;
  timestamp_ms: number;
  points: number;
  source: string;
  reason: string;
  category: string;
}

export interface AdminScoreEventPage {
  items: AdminScoreEvent[];
  page: number;
  page_size: number;
  total: number;
}

export interface AdminScoreboardRow {
  rank: number;
  team_id: string;
  team_name: string;
  public_team_id: string;
  score_total: number;
  trend_value: number;
  is_active: boolean;
  last_score_at: string | null;
}

export interface AdminScoreboard {
  updated_at: string;
  rows: AdminScoreboardRow[];
}

// ---- WebSocket Events ----

export type WSMessage =
  | { type: "team.score.updated"; score_total: number; trend_value: number; rank: number | null; score_event?: WSScoreEvent }
  | { type: "team.rank.updated"; rank: number }
  | { type: "scoreboard.updated" }
  | { type: "score_event.created"; score_event: WSScoreEvent }
  | { type: "event.status.changed"; status: EventStatus };
