# AWS_MockGameday Agent Guidelines

This file defines required development rules for contributors and coding agents in this workspace.

## 1) Environment Variables: No Unnecessary Fallbacks

- Do not add fallback defaults for required environment variables in application code.
- If a required env var is missing, fail fast with a clear error message.
- Avoid patterns like:
  - `process.env.SOME_KEY || "http://localhost:8000"`
  - `SOME_SETTING: str = "default"` for required runtime config

Required examples in this project:
- Frontend:
  - `NEXT_PUBLIC_API_URL`
  - `NEXT_PUBLIC_WS_URL`
- Backend:
  - `DATABASE_URL`
  - `SYNC_DATABASE_URL`
  - `REDIS_URL`
  - `SECRET_KEY`
  - `ADMIN_SECRET_KEY`
  - `CORS_ORIGINS`
  - `DEFAULT_ADMIN_USERNAME`
  - `DEFAULT_ADMIN_EMAIL`
  - `DEFAULT_ADMIN_PASSWORD`
  - `DEFAULT_ADMIN_NAME`

## 2) .env.example Rules (Keep Required Settings on Top)

- Keep required settings at the top of `.env.example`.
- Public URL variables must include:
  - `PUBLIC_PROTOCOL`
  - `PUBLIC_HOSTNAME`
- Build URL values from variables (no hardcoded localhost in URL fields):
  - `API_URL=${PUBLIC_PROTOCOL}://${PUBLIC_HOSTNAME}`
  - `WS_URL=ws://${PUBLIC_HOSTNAME}`
- Database URLs must use variable substitution instead of literal host strings:
  - `DATABASE_HOST`, `DATABASE_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`

## 3) API Route Conventions

- All HTTP API routes must be served under `/api` prefix.
- When mounting routers in `backend/app/main.py`, ensure prefix consistency.
- Shared Folder routes must remain:
  - Admin:
    - `/api/admin/events/{event_id}/shared-folder/upload`
    - `/api/admin/events/{event_id}/shared-folder/files`
    - `/api/admin/events/{event_id}/shared-folder/files/{file_id}`
  - Team:
    - `/api/shared-folder/files`
    - `/api/shared-folder/files/{file_id}/download`
    - `/api/shared-folder/files/{file_id}/content`

## 4) Database Migration Policy (Current Project Workflow)

- This project currently uses consolidated schema workflow for fresh restarts.
- `backend/alembic/versions/001_initial_schema.py` is the primary full schema migration.
- New schema changes should be reflected consistently with this restart-based workflow.
- Do not re-introduce scattered incremental migration logic without explicit team decision.

## 5) Feature Toggle Behavior

- Event-level toggles must be respected in both backend and frontend behavior.
- Important toggles currently in use:
  - `scoreboard_public`
  - `root_url_detection_enabled`
  - `shared_folder_enabled`
  - `show_aws_console_button`
  - `show_ssh_key_button`
- UI actions that depend on toggles must be hidden/disabled when toggle is off.

## 6) Frontend Integration Rules

- Admin event pages should keep header navigation consistent across:
  - Event Detail
  - Scoreboard
  - Score Events
  - Shared Folder
- Shared Folder button in user dashboard must appear in the same action row and align right.
- Shared Folder list/download interactions must use existing API wrappers in `frontend/src/lib/api.ts`.

## 7) Quality Gate Before Finish

Before finishing changes:
- Run diagnostics/errors check on touched files.
- Confirm no new fallback defaults were introduced for required env vars.
- Confirm route/path changes match frontend calls and backend registration.
- Keep edits minimal and avoid unrelated refactors.
