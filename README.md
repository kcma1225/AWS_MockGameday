![AWS Mock GameDay](docs/readme-assets/site_logo.png)

# AWS Mock GameDay

AWS Mock GameDay is a containerized challenge platform inspired by AWS GameDay style events.
It provides:
- Team login with event codes
- Endpoint submission and scoring
- Live scoreboard and score events
- Admin event management and challenge round controls

## Tech Stack

- Frontend: Next.js
- Backend: FastAPI
- Database: PostgreSQL
- Queue and cache: Redis
- Async workers: Celery worker + Celery beat
- Edge gateway: Nginx
- Deployment model: Docker Compose only

## Repository Structure

- backend: FastAPI app, database models, migrations, workers
- frontend: Next.js app
- nginx: Reverse proxy configuration
- compose.yml: Full service orchestration
- docs/readme-assets: README source assets (images, docs media)

## Architecture

Nginx is the single public entrypoint on port 80.
- / -> frontend service (Next.js)
- /api/* -> backend service (FastAPI)
- /ws/* -> backend WebSocket endpoints

Internal services run on a private Docker network:
- db
- redis
- backend
- worker
- beat
- frontend
- nginx

## Quick Start (Docker)

1. Create your runtime env file.
- Copy .env.example to .env

2. Update important values in .env before running.
- SECRET_KEY
- ADMIN_SECRET_KEY
- DEFAULT_ADMIN_PASSWORD
- DB credentials if needed

3. Start all services.
- docker compose up -d --build

4. Open the platform.
- http://localhost

## Environment Configuration

Frontend public URLs are controlled in .env:
- API_URL
- WS_URL

Default local development values:
- API_URL=http://localhost
- WS_URL=ws://localhost

If deploying on a server with a specific IPv4, set for example:
- API_URL=http://192.168.1.50
- WS_URL=ws://192.168.1.50

## Docker Operations

Start or update stack:
- docker compose up -d --build

Check running containers:
- docker compose ps

View logs:
- docker compose logs -f

Stop stack:
- docker compose down

Stop stack and remove volumes (data reset):
- docker compose down -v

## Docker Deployment Guide

This project is designed for Docker-based deployment only.

1. Prepare server
- Install Docker and Docker Compose plugin
- Open port 80 in firewall/security group
- Clone repository

2. Configure environment
- Copy .env.example to .env
- Set production secrets and passwords
- Set API_URL and WS_URL to your server IPv4 or domain

3. Deploy
- docker compose up -d --build

4. Validate
- Visit http://your-server-ip
- Check health endpoint at /health via backend route if needed

5. Maintain
- Pull latest code
- docker compose up -d --build

## Notes

- .env is ignored by git and should not be committed.
- .env.example is the safe template for collaborators.
- Default admin account is auto-created on first startup from env values.
