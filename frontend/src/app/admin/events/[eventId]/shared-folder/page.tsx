"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import useSWR from "swr";
import {
  getAdminToken,
  clearAdminToken,
  adminGetEvent,
  adminListSharedFiles,
  adminUploadSharedFile,
  adminDeleteSharedFile,
} from "@/lib/api";
import { AdminEvent, SharedFolderFileItem } from "@/types";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AdminEventSharedFolderPage() {
  const params = useParams<{ eventId: string }>();
  const eventId = params?.eventId;
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!getAdminToken()) router.push("/admin");
  }, [router]);

  const { data: event } = useSWR<AdminEvent>(
    eventId ? `admin-event-${eventId}` : null,
    () => adminGetEvent(eventId),
    { revalidateOnFocus: false }
  );

  const { data: files, mutate: mutateFiles } = useSWR<SharedFolderFileItem[]>(
    eventId ? `admin-shared-files-${eventId}` : null,
    () => adminListSharedFiles(eventId),
    { revalidateOnFocus: false }
  );

  function handleLogout() {
    clearAdminToken();
    router.push("/admin");
  }

  async function handleUploadFile(file: File) {
    if (!eventId) return;
    setUploading(true);
    setMessage(null);
    try {
      await adminUploadSharedFile(eventId, file);
      await mutateFiles();
      setMessage(`Uploaded: ${file.name}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handleDeleteFile(fileId: string) {
    if (!eventId) return;
    if (!confirm("Delete this file from the shared folder?")) return;
    setDeletingId(fileId);
    setMessage(null);
    try {
      await adminDeleteSharedFile(eventId, fileId);
      await mutateFiles();
      setMessage("File deleted");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <nav className="border-b border-[#d1d5db] bg-[#f8fafc] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-12">
          <div className="flex items-center gap-6">
            <Link href="/admin/events" className="flex items-center" aria-label="Go to admin events">
              <Image src="/site_logo_admin.svg" alt="GameDay Admin" width={170} height={44} priority className="h-8 w-auto" />
            </Link>
            <Link href={`/admin/events/${eventId}`} className="text-[#475569] hover:text-[#0f172a] text-xs uppercase tracking-wide">Event</Link>
            <Link href={`/admin/events/${eventId}/scoreboard`} className="text-[#475569] hover:text-[#0f172a] text-xs uppercase tracking-wide">Scoreboard</Link>
            <Link href={`/admin/events/${eventId}/score-events`} className="text-[#475569] hover:text-[#0f172a] text-xs uppercase tracking-wide">Score Events</Link>
            <Link
              href={`/admin/events/${eventId}/shared-folder`}
              className="text-[#0f172a] font-semibold text-xs uppercase tracking-wide inline-flex items-center gap-1.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              </svg>
              Shared Folder
            </Link>
          </div>
          <button onClick={handleLogout} className="text-[#475569] hover:text-[#f87171] text-xs uppercase tracking-wide transition-colors">Logout</button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-5 flex items-center gap-4">
          <Link href={`/admin/events/${eventId}`} className="text-[#64748b] hover:text-[#0f172a] text-xs">← Back to Event</Link>
          <h1 className="text-xl font-bold text-[#0f172a]">Shared Folder</h1>
          {event && (
            <span className="ml-auto text-[#64748b] text-xs">{event.title}</span>
          )}
        </div>

        {event && !event.shared_folder_enabled ? (
          <div className="border border-[#d1d5db] rounded-lg bg-[#ffffff] px-5 py-10 text-center text-[#64748b] text-sm">
            Shared folder is disabled for this event.
          </div>
        ) : (
          <>
            <div className="bg-[#ffffff] border border-[#d1d5db] rounded-lg p-5 mb-5">
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleUploadFile(file);
                  }}
                  disabled={uploading}
                  className="text-sm text-[#475569]"
                />
                <span className="text-xs text-[#64748b]">Max size: 100MB</span>
                {uploading && <span className="text-xs text-[#2563eb]">Uploading...</span>}
              </div>
              {message && <p className="mt-3 text-sm text-[#334155]">{message}</p>}
            </div>

            <div className="bg-[#ffffff] border border-[#d1d5db] rounded-lg overflow-hidden">
              {!files ? (
                <div className="px-5 py-12 text-center text-[#64748b] text-sm">Loading shared files...</div>
              ) : files.length === 0 ? (
                <div className="px-5 py-12 text-center text-[#64748b] text-sm">No files uploaded yet</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[#64748b] text-xs border-b border-[#d1d5db] bg-[#f8fafc]">
                      <th className="px-4 py-3 text-left">Filename</th>
                      <th className="px-4 py-3 text-left">Type</th>
                      <th className="px-4 py-3 text-right">Size</th>
                      <th className="px-4 py-3 text-left">Uploaded</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((file) => (
                      <tr key={file.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc]">
                        <td className="px-4 py-2.5 text-[#0f172a]">{file.original_filename}</td>
                        <td className="px-4 py-2.5 text-[#64748b] text-xs">{file.mime_type}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-[#334155]">{formatFileSize(file.file_size)}</td>
                        <td className="px-4 py-2.5 text-[#475569] text-xs">{new Date(file.uploaded_at).toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={() => void handleDeleteFile(file.id)}
                            disabled={deletingId === file.id}
                            className="text-xs px-3 py-1 border border-[#f87171] hover:bg-[#fff1f2] text-[#dc2626] rounded transition-colors disabled:opacity-60"
                          >
                            {deletingId === file.id ? "Deleting..." : "Delete"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
