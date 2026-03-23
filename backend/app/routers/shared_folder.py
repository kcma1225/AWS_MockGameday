"""Shared folder API - admin uploads, team downloads."""

import os
import secrets
import mimetypes
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from uuid import UUID
from typing import List

from app.database import get_db
from app.deps import get_current_admin, get_current_team_session
from app.models.event import Event
from app.models.team import Team
from app.models.admin_user import AdminUser
from app.models.event import SharedFolderFile

router = APIRouter()

# Shared folder storage path
SHARED_FOLDERS_DIR = Path("shared_folders")
SHARED_FOLDERS_DIR.mkdir(exist_ok=True)


def get_event_folder(event_id: str) -> Path:
    """Get the folder path for an event's shared files."""
    folder = SHARED_FOLDERS_DIR / str(event_id)
    folder.mkdir(parents=True, exist_ok=True)
    return folder


# ---- Admin: Upload and Manage ----

class SharedFolderFileOut:
    """Response model for shared folder file."""
    def __init__(self, file: SharedFolderFile):
        self.id = str(file.id)
        self.original_filename = file.original_filename
        self.file_size = file.file_size
        self.mime_type = file.mime_type
        self.uploaded_at = file.uploaded_at


@router.post("/admin/events/{event_id}/shared-folder/upload", status_code=status.HTTP_201_CREATED)
async def upload_shared_file(
    event_id: UUID,
    file: UploadFile = File(...),
    admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin uploads a file to the shared folder."""
    # Verify event exists and has shared folder enabled
    event_result = await db.execute(select(Event).where(Event.id == event_id))
    event = event_result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    if not event.shared_folder_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Shared folder is not enabled for this event",
        )

    # Validate file size (max 100MB)
    max_size = 100 * 1024 * 1024
    contents = await file.read()
    if len(contents) > max_size:
        raise HTTPException(
            status_code=status.HTTP_413_PAYLOAD_TOO_LARGE,
            detail="File is too large (max 100MB)",
        )

    # Generate unique stored filename
    file_extension = Path(file.filename or "").suffix
    stored_filename = f"{secrets.token_hex(16)}{file_extension}"
    mime_type = file.content_type or mimetypes.guess_type(file.filename or "")[0] or "application/octet-stream"

    # Save file
    event_folder = get_event_folder(str(event_id))
    file_path = event_folder / stored_filename
    with open(file_path, "wb") as f:
        f.write(contents)

    # Record in database
    db_file = SharedFolderFile(
        event_id=event_id,
        original_filename=file.filename or "file",
        stored_filename=stored_filename,
        file_size=len(contents),
        mime_type=mime_type,
        uploaded_by_admin_id=admin.id,
    )
    db.add(db_file)
    await db.flush()

    return {
        "id": str(db_file.id),
        "original_filename": db_file.original_filename,
        "file_size": db_file.file_size,
        "mime_type": db_file.mime_type,
        "uploaded_at": db_file.uploaded_at.isoformat(),
    }


@router.get("/admin/events/{event_id}/shared-folder/files")
async def list_shared_files(
    event_id: UUID,
    admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin lists files in shared folder."""
    # Verify event exists
    event_result = await db.execute(select(Event).where(Event.id == event_id))
    event = event_result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    # Get files, ordered by newest first
    files_result = await db.execute(
        select(SharedFolderFile)
        .where(SharedFolderFile.event_id == event_id)
        .order_by(desc(SharedFolderFile.uploaded_at))
    )
    files = files_result.scalars().all()

    return [
        {
            "id": str(f.id),
            "original_filename": f.original_filename,
            "file_size": f.file_size,
            "mime_type": f.mime_type,
            "uploaded_at": f.uploaded_at.isoformat(),
        }
        for f in files
    ]


@router.delete("/admin/events/{event_id}/shared-folder/files/{file_id}")
async def delete_shared_file(
    event_id: UUID,
    file_id: UUID,
    admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin deletes a file from shared folder."""
    # Verify file exists and belongs to this event
    file_result = await db.execute(
        select(SharedFolderFile).where(
            SharedFolderFile.id == file_id,
            SharedFolderFile.event_id == event_id,
        )
    )
    db_file = file_result.scalar_one_or_none()
    if not db_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    # Delete file from filesystem
    event_folder = get_event_folder(str(event_id))
    file_path = event_folder / db_file.stored_filename
    if file_path.exists():
        file_path.unlink()

    # Delete from database
    await db.delete(db_file)
    await db.flush()

    return {"status": "deleted"}


# ---- Team: Download Files ----

@router.get("/shared-folder/files")
async def team_list_shared_files(
    session=Depends(get_current_team_session),
    db: AsyncSession = Depends(get_db),
):
    """Team lists files in their event's shared folder."""
    # Get team and verify event
    team_result = await db.execute(select(Team).where(Team.id == session.team_id))
    team = team_result.scalar_one()

    event_result = await db.execute(select(Event).where(Event.id == team.event_id))
    event = event_result.scalar_one()

    if not event.shared_folder_enabled:
        return {"files": []}

    # Get files
    files_result = await db.execute(
        select(SharedFolderFile)
        .where(SharedFolderFile.event_id == team.event_id)
        .order_by(desc(SharedFolderFile.uploaded_at))
    )
    files = files_result.scalars().all()

    return {
        "files": [
            {
                "id": str(f.id),
                "original_filename": f.original_filename,
                "file_size": f.file_size,
                "mime_type": f.mime_type,
                "uploaded_at": f.uploaded_at.isoformat(),
            }
            for f in files
        ]
    }


@router.get("/shared-folder/files/{file_id}/download")
async def team_download_shared_file(
    file_id: UUID,
    session=Depends(get_current_team_session),
    db: AsyncSession = Depends(get_db),
):
    """Team downloads a file from shared folder."""
    # Get team
    team_result = await db.execute(select(Team).where(Team.id == session.team_id))
    team = team_result.scalar_one()

    # Verify file exists and belongs to team's event
    file_result = await db.execute(
        select(SharedFolderFile).where(
            SharedFolderFile.id == file_id,
            SharedFolderFile.event_id == team.event_id,
        )
    )
    db_file = file_result.scalar_one_or_none()
    if not db_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    # Return file path for frontend to handle download
    return {
        "file_id": str(db_file.id),
        "original_filename": db_file.original_filename,
        "download_url": f"/api/shared-folder/files/{file_id}/content",
    }


@router.get("/shared-folder/files/{file_id}/content")
async def team_download_shared_file_content(
    file_id: UUID,
    session=Depends(get_current_team_session),
    db: AsyncSession = Depends(get_db),
):
    """Team downloads file content."""
    # Get team
    team_result = await db.execute(select(Team).where(Team.id == session.team_id))
    team = team_result.scalar_one()

    # Verify file exists and belongs to team's event
    file_result = await db.execute(
        select(SharedFolderFile).where(
            SharedFolderFile.id == file_id,
            SharedFolderFile.event_id == team.event_id,
        )
    )
    db_file = file_result.scalar_one_or_none()
    if not db_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    # Return file content
    event_folder = get_event_folder(str(team.event_id))
    file_path = event_folder / db_file.stored_filename
    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found on disk")

    from fastapi.responses import FileResponse
    return FileResponse(
        file_path,
        filename=db_file.original_filename,
        media_type=db_file.mime_type,
    )
