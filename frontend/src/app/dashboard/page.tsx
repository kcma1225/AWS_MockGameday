"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import Image from "next/image";

import { useWebSocket } from "@/hooks/useWebSocket";
import { clearToken, isAuthenticated } from "@/lib/auth";
import {
  getTeamDashboard,
  getModules,
  getModuleStatus,
  logout,
  submitModuleUrl,
  teamListSharedFiles,
  teamDownloadSharedFileContent,
  sharedFilePublicUrl,
} from "@/lib/api";
import { isRootUrl } from "@/lib/url";
import { TeamDashboard, Module, ModuleStatus, WSMessage, SharedFolderFileItem, TeamSharedFilesResponse } from "@/types";

export default function DashboardPage() {
  const router = useRouter();
  const [liveData, setLiveData] = useState<Partial<TeamDashboard>>({});
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [sharedModalOpen, setSharedModalOpen] = useState(false);
  const [sharedFiles, setSharedFiles] = useState<SharedFolderFileItem[]>([]);
  const [sharedLoading, setSharedLoading] = useState(false);
  const [sharedError, setSharedError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/");
    }
  }, [router]);

  const { data: dashboard, mutate: mutateDashboard } = useSWR<TeamDashboard>(
    "team-dashboard",
    () => getTeamDashboard(),
    { refreshInterval: 10000 }
  );

  const { data: modules } = useSWR<Module[]>("modules", () => getModules(), {
    refreshInterval: 30000,
  });

  // Fetch module statuses
  const { data: moduleStatuses } = useSWR<ModuleStatus[]>(
    modules ? `module-statuses-${modules.map((m) => m.id).join(",")}` : null,
    async () => {
      if (!modules) return [];
      return Promise.all(modules.map((m) => getModuleStatus(m.id)));
    },
    { refreshInterval: 15000 }
  );

  const handleWsMessage = useCallback(
    (msg: WSMessage) => {
      if (msg.type === "team.score.updated") {
        setLiveData((prev) => ({
          ...prev,
          score_total: msg.score_total,
          trend_value: msg.trend_value,
          rank_cache: msg.rank ?? prev.rank_cache,
        }));
      } else if (msg.type === "event.status.changed") {
        mutateDashboard();
      }
    },
    [mutateDashboard]
  );

  const { connected } = useWebSocket(handleWsMessage);

  useEffect(() => {
    const first = moduleStatuses?.[0]?.latest_submission?.normalized_value;
    if (first) setUrl(first);
  }, [moduleStatuses]);

  if (!dashboard) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[#4ade80] font-mono text-sm">Loading...</div>
      </div>
    );
  }

  const score = liveData.score_total ?? dashboard.score_total;
  const trend = liveData.trend_value ?? dashboard.trend_value;
  const rank = liveData.rank_cache ?? dashboard.rank_cache;
  const eventIsRunning = dashboard.event_status === "live";
  const selectedModule = modules?.[0];
  const moduleTitle = selectedModule?.name === "Service Endpoint"
    ? "Order Processor"
    : (selectedModule?.name || "Order Processor");
  const selectedStatus = selectedModule
    ? moduleStatuses?.find((s) => s.module_id === selectedModule.id)
    : undefined;

  async function handleLogout() {
    try {
      await logout();
    } finally {
      clearToken();
      router.push("/");
    }
  }

  async function handleSubmitEndpoint(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedModule) return;

    if (dashboard?.root_url_detection_enabled && !isRootUrl(url)) {
      setSubmitError("Only root URLs are allowed, for example: https://example.com or http://66.71.42.14");
      setSubmitSuccess(false);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);
    try {
      await submitModuleUrl(selectedModule.id, url);
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 2500);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function openSharedFolderModal() {
    setSharedModalOpen(true);
    setSharedLoading(true);
    setSharedError(null);
    try {
      const data: TeamSharedFilesResponse = await teamListSharedFiles();
      setSharedFiles(data.files || []);
    } catch (err) {
      setSharedError(err instanceof Error ? err.message : "Failed to load shared files");
    } finally {
      setSharedLoading(false);
    }
  }

  async function handleCopyUrl(publicUrl: string, fileId: string) {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(`${publicUrl}`);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = `${publicUrl}`;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedId(fileId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      alert("Failed to copy URL. Please try again.");
    }
  }

  async function downloadSharedFile(fileId: string) {
    setDownloadingId(fileId);
    try {
      const { blob, filename } = await teamDownloadSharedFileContent(fileId);
      const urlObject = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = urlObject;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(urlObject);
    } catch (err) {
      setSharedError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloadingId(null);
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <header className="border-b border-[#d1d5db] bg-[#ffffff]">
        <div className="max-w-[1280px] mx-auto h-14 px-5 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center" aria-label="Go to dashboard">
            <Image
              src="/site_logo.svg"
              alt="NTJNHS ITC"
              width={170}
              height={48}
              priority
              className="h-9 w-auto"
            />
            <span className="ml-2 text-[#2563eb]" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </span>
          </Link>
          <div className="flex items-center gap-6 text-[#334155] text-sm font-medium leading-none">
            <button onClick={handleLogout} className="hover:text-[#0f172a]">Logout</button>
          </div>
        </div>
      </header>

      <main className="max-w-[1280px] mx-auto px-5 py-8">
        <h1 className="text-center text-4xl leading-none font-semibold text-[#111827] mb-8">Player Dashboard</h1>

        <div className="grid grid-cols-3 gap-8 max-w-[900px] mx-auto mb-10">
          <Metric label="SCORE" value={score.toFixed(3)} />
          <Metric label="TREND" value={trend.toFixed(3)} />
          <Metric label="RANK" value={rank !== null ? String(rank) : "-"} />
        </div>

        {eventIsRunning ? (
          <>
            <DividerTitle title="Game" />

            <section className="max-w-[900px] mx-auto border border-[#d1d5db] rounded-sm bg-[#ffffff]">
              <div className="border-b border-[#d1d5db] px-4 py-3 flex flex-wrap gap-2">
                <GameButton label="Score Events" href="/score-events" />
                {dashboard.scoreboard_public && <GameButton label="Scoreboard" href="/scoreboard" />}
                {dashboard.shared_folder_enabled && (
                  <button
                    onClick={() => void openSharedFolderModal()}
                    className="ml-auto px-4 py-2 rounded-sm border border-[#60a5fa] text-sm font-medium text-[#2563eb] hover:bg-[#eff6ff] hover:border-[#3b82f6] inline-flex items-center gap-1.5"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    </svg>
                    Shared Folder
                  </button>
                )}
                {dashboard.show_aws_console_button && <GameButton label="AWS Console" href="#" />}
                {dashboard.show_ssh_key_button && <GameButton label="SSH Key" href="#" />}
              </div>

              <div className="px-5 py-4 text-2xl leading-tight font-semibold text-[#1f2937]">
                Game: {dashboard.event_title}
                <div className="mt-2 text-base text-[#6b7280] font-normal">Team Name: {dashboard.team_name}</div>
              </div>

              <div className="border-t border-[#d1d5db] px-5 py-5 text-base text-[#1f2937] space-y-2">
                <div>Game ID: {dashboard.public_event_id}</div>
                <div>Team ID: {dashboard.public_team_id}</div>
              </div>
            </section>

            <div className="mt-10">
              <DividerTitle title="Modules" />

              <section className="max-w-[900px] mx-auto border border-[#d1d5db] rounded-xl bg-[#ffffff] overflow-hidden shadow-sm">
                <div className="px-6 py-5 border-b border-[#e5e7eb] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
                  <h2 className="text-[#0f172a] font-semibold text-xl leading-tight">
                    {moduleTitle}
                  </h2>
                  <div className="flex items-center gap-5">
                    <Link href="/readme" className="inline-flex items-center gap-1.5 text-base font-medium text-[#2563eb] hover:underline whitespace-nowrap">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      Readme
                    </Link>
                  </div>
                </div>

                <div className="px-6 py-5">
                  <div className="text-[#0f172a] font-semibold text-lg mb-3">Inputs</div>
                  <label className="block text-[#334155] text-sm font-medium mb-2">Server Address</label>

                  <form onSubmit={handleSubmitEndpoint} className="space-y-4">
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="http://your-server-host"
                      className="w-full border border-[#d1d5db] bg-[#ffffff] rounded-md px-4 py-2.5 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#bfdbfe] focus:border-[#60a5fa]"
                      required
                    />
                    <div className="rounded-md border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-sm break-all text-[#334155]">
                      <span className="font-medium text-[#475569]">Current Value:</span>{" "}
                      {selectedStatus?.latest_submission?.normalized_value || "Not set"}
                    </div>
                    <div className="pt-1 flex items-center gap-4">
                      <button
                        type="submit"
                        disabled={submitting || !selectedModule}
                        className="px-5 py-2.5 rounded-md bg-[#e2e8f0] text-[#1f2937] text-sm font-semibold hover:bg-[#cbd5e1] disabled:opacity-50"
                      >
                        {submitting ? "Updating..." : "Update"}
                      </button>
                    </div>
                  </form>
                  {submitError && <p className="mt-3 text-sm text-[#dc2626]">{submitError}</p>}
                  {submitSuccess && <p className="mt-3 text-sm text-[#16a34a]">URL submitted successfully</p>}
                </div>
              </section>
            </div>
          </>
        ) : (
          <section className="max-w-[900px] mx-auto border border-[#d1d5db] rounded-sm bg-[#ffffff]">
            <div className="px-5 py-12 text-center">
              <div className="text-4xl mb-4">ℹ️</div>
              <h2 className="text-2xl font-semibold text-[#111827] mb-2">Event Not Running</h2>
              <p className="text-base text-[#6b7280]">The event is currently stopped.</p>
            </div>
          </section>
        )}
      </main>

      {sharedModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSharedModalOpen(false);
          }}
        >
          <div className="w-full max-w-3xl bg-[#ffffff] border border-[#d1d5db] rounded-lg shadow-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-[#d1d5db] flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#0f172a]">Shared Folder</h2>
              <button
                onClick={() => setSharedModalOpen(false)}
                className="text-[#dc2626] hover:text-[#991b1b] text-xl font-bold leading-none w-6 h-6 flex items-center justify-center rounded hover:bg-[#fee2e2] transition-colors"
                title="Close"
              >
                ×
              </button>
            </div>

            <div className="p-5 max-h-[70vh] overflow-auto">
              {sharedError && <p className="mb-4 text-sm text-[#dc2626]">{sharedError}</p>}
              {sharedLoading ? (
                <p className="text-sm text-[#64748b]">Loading files...</p>
              ) : sharedFiles.length === 0 ? (
                <p className="text-sm text-[#64748b]">No files uploaded by admin yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[#64748b] text-xs border-b border-[#d1d5db]">
                      <th className="py-2 text-left">Filename</th>
                      <th className="py-2 text-left">Type</th>
                      <th className="py-2 text-right">Size</th>
                      <th className="py-2 text-left">Uploaded</th>
                      <th className="py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sharedFiles.map((file) => (
                      <tr key={file.id} className="border-b border-[#f1f5f9]">
                        <td className="py-2 pr-2 text-[#0f172a]">{file.original_filename}</td>
                        <td className="py-2 pr-2 text-[#64748b] text-xs">{file.mime_type}</td>
                        <td className="py-2 pr-2 text-right font-mono text-[#334155]">{formatFileSize(file.file_size)}</td>
                        <td className="py-2 pr-2 text-[#475569] text-xs">{new Date(file.uploaded_at).toLocaleString()}</td>
                        <td className="py-2 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={() => void downloadSharedFile(file.id)}
                              disabled={downloadingId === file.id}
                              className="px-3 py-1.5 rounded border border-[#60a5fa] text-[#2563eb] hover:bg-[#eff6ff] text-xs disabled:opacity-60"
                            >
                              {downloadingId === file.id ? "Downloading..." : "Download"}
                            </button>
                            <button
                              onClick={() => handleCopyUrl(sharedFilePublicUrl(file.public_url), file.id)}
                              className="px-3 py-1.5 rounded border border-[#10b981] text-[#059669] hover:bg-[#f0fdf4] text-xs"
                            >
                              {copiedId === file.id ? "Copied!" : "Copy"}
                            </button>
                            <a
                              href={sharedFilePublicUrl(file.public_url)}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-1.5 rounded border border-[#94a3b8] text-[#334155] hover:bg-[#f8fafc] text-xs"
                            >
                              URL
                            </a>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-xs text-[#374151] font-semibold tracking-wide mb-2">{label}</div>
      <div className="text-5xl text-[#111827] font-light leading-none tabular-nums">{value}</div>
    </div>
  );
}

function DividerTitle({ title }: { title: string }) {
  return (
    <div className="max-w-[900px] mx-auto mb-5 flex items-center gap-5">
      <div className="h-px bg-[#d1d5db] flex-1" />
      <div className="text-xl text-[#1f2937] font-semibold">{title}</div>
      <div className="h-px bg-[#d1d5db] flex-1" />
    </div>
  );
}

function GameButton({ label, href, accent }: { label: string; href: string; accent?: "green" }) {
  const cls = `px-4 py-2 rounded-sm border text-sm font-medium ${
    accent === "green"
      ? "border-[#4ade80] text-[#16a34a] hover:bg-[#f0fdf4] hover:border-[#22c55e]"
      : "border-[#60a5fa] text-[#2563eb] hover:bg-[#eff6ff] hover:border-[#3b82f6]"
  }`;

  if (href === "#") {
    return <span className={cls}>{label}</span>;
  }
  return (
    <Link href={href} className={cls}>
      {label}
    </Link>
  );
}
