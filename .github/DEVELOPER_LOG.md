# Developer Log

Features and bugs awaiting implementation for future releases.

## Planned Features

### 1. Event Configuration Updates
**Status:** 🟡 IN PROGRESS
  - Implement `EventConfigPanel` React component with EditSettings/ViewSettings modes
  - Wire component into admin event detail page
  - Test end-to-end editing of all event fields
**Status:** 🟢 COMPLETED
- **Implementation:**
  - ✅ Backend: `adminUpdateEvent()` PATCH endpoint exists at `/api/admin/events/{event_id}`
  - ✅ Backend Schema: `AdminEventUpdate` pydantic model for all editable fields
  - ✅ Frontend: `EventConfigPanel` component created with edit/view modes
  - ✅ Event detail page integrated with config panel below content editor
  - ✅ Feature toggles UI for: scoreboard_public, root_url_detection, shared_folder, aws_button, ssh_button
  - ✅ All containers deployed and tested successfully

- **Description:** Implement token exchange mechanism where:
  - Client sends token in request headers
  - Server includes specific token in response headers for session tracking
  - Proper token validation on both request and response sides

### 3. Challenge Token Refresh & Version Management
- **Description:** Implement:
  - Token refresh mechanism (rotate team tokens without losing history)
  - Gradual rollout support: send traffic to both old and new servers based on token version
  - Useful for seamless server migrations and A/B testing in GameDay scenarios

### 4. Admin-Team Chat System
- **Description:** Create real-time messaging system with WebSocket support:
  - Dedicated chat channel per team (admin ↔ team communication)
  - Real-time updates via WebSocket
  - Use cases: provide hints, clarifications, emergency notifications during GameDay
  - Message history and persistence

### 5. Default README Template
- **Description:** Auto-generate a standard README markdown template when creating new events with:
  - Challenge description section
  - Submission instructions
  - Scoring rules
  - Common troubleshooting
  - Customizable by admins

---

## Bonus Features

### AWS S3 Permissions Management
- **Description:** Add AWS ARN ID field for teams to enable:
  - Per-team AWS IAM role assignment
  - Granular S3 bucket access control (files, prefixes, operations)
  - Secure file sharing without exposing credentials
  - Audit logging of S3 access by team members
  - Integration with AWS STS for temporary credentials

---

## Status Legend
- 🔴 **Not Started:** Feature not yet implemented
- 🟡 **In Progress:** Currently being worked on
- 🟢 **Completed:** Feature is live and tested

Last Updated: March 24, 2026
