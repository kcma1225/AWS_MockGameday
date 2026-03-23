"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import useSWR from "swr";
import {
  getAdminToken,
  clearAdminToken,
  adminGetEvent,
  adminGetTeams,
  adminCreateTeams,
  adminUpdateTeam,
  adminDeleteTeam,
  adminEventAction,
  adminDeleteEvent,
  adminGetChallengeRounds,
  adminCreateChallengeRound,
  adminUpdateChallengeRound,
  adminDeleteChallengeRound,
  adminTriggerChallenge,
  adminUploadReadme,
  adminRegenerateCode,
} from "@/lib/api";
import { AdminChallengeRoundsResponse, AdminChallengeTriggerResponse, AdminTestingRound, AdminEvent, AdminTeam } from "@/types";

export default function AdminEventDetailPage() {
  const params = useParams<{ eventId: string }>();
  const eventId = params?.eventId;
  const router = useRouter();

  useEffect(() => {
    if (!getAdminToken()) router.push("/admin");
  }, [router]);

  const { data: event, mutate: mutateEvent } = useSWR<AdminEvent>(
    eventId ? `admin-event-${eventId}` : null,
    () => adminGetEvent(eventId),
    { revalidateOnFocus: false }
  );

  const { data: teams, mutate: mutateTeams } = useSWR<AdminTeam[]>(
    eventId ? `admin-teams-${eventId}` : null,
    () => adminGetTeams(eventId),
    { revalidateOnFocus: false }
  );

  function handleLogout() {
    clearAdminToken();
    router.push("/admin");
  }

  async function handleEventAction(action: "start" | "pause" | "resume" | "end" | "delete") {
    if (action === "end" && !confirm("End this event? This cannot be undone.")) return;
    if (action === "delete" && !confirm("Delete this event permanently? This will hard delete all related data.")) return;
    try {
      if (action === "delete") {
        await adminDeleteEvent(eventId);
        router.push("/admin/events");
        return;
      }
      await adminEventAction(eventId, action);
      mutateEvent();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Action failed");
    }
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Admin Nav */}
      <nav className="border-b border-[#d1d5db] bg-[#f8fafc] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-12">
          <div className="flex items-center gap-6">
            <Link href="/admin/events" className="flex items-center" aria-label="Go to admin events">
              <Image
                src="/site_logo_admin.svg"
                alt="GameDay Admin"
                width={170}
                height={44}
                priority
                className="h-8 w-auto"
              />
            </Link>
            <Link href={`/admin/events/${eventId}`} className="text-[#475569] hover:text-[#0f172a] text-xs uppercase tracking-wide">
              Event
            </Link>
            {eventId && (
              <>
                <Link href={`/admin/events/${eventId}/scoreboard`} className="text-[#475569] hover:text-[#0f172a] text-xs uppercase tracking-wide">
                  Scoreboard
                </Link>
                <Link href={`/admin/events/${eventId}/score-events`} className="text-[#475569] hover:text-[#0f172a] text-xs uppercase tracking-wide">
                  Score Events
                </Link>
                {event?.shared_folder_enabled && (
                  <Link
                    href={`/admin/events/${eventId}/shared-folder`}
                    className="text-[#475569] hover:text-[#0f172a] text-xs uppercase tracking-wide inline-flex items-center gap-1.5"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    </svg>
                    Shared Folder
                  </Link>
                )}
              </>
            )}
          </div>
          <button onClick={handleLogout} className="text-[#475569] hover:text-[#f87171] text-xs uppercase tracking-wide transition-colors">
            Logout
          </button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/admin/events" className="text-[#64748b] hover:text-[#0f172a] text-xs">
            ← Back to Events
          </Link>
        </div>

        {!event ? (
          <div className="text-[#64748b] text-sm">Loading event...</div>
        ) : (
          <div className="space-y-8">
            {/* Header */}
            <EventHeader event={event} onAction={handleEventAction} />

            {/* Trigger Challenge Round */}
            <TriggerPanel eventId={eventId} />

            {/* Teams Table */}
            <TeamsPanel eventId={eventId} teams={teams} mutateTeams={mutateTeams} mutateEvent={mutateEvent} />

            {/* Content Editor */}
            <ContentPanel eventId={eventId} event={event} />
          </div>
        )}
      </main>
    </div>
  );
}

// ── Event Header ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  draft: "text-[#64748b] border-[#64748b]",
  live: "text-[#4ade80] border-[#4ade80]",
  paused: "text-[#facc15] border-[#facc15]",
  ended: "text-[#f87171] border-[#f87171]",
};

function EventHeader({ event, onAction }: { event: AdminEvent; onAction: (a: "start" | "pause" | "resume" | "end" | "delete") => void }) {
  const statusCls = STATUS_COLORS[event.status] || STATUS_COLORS.draft;

  return (
    <div className="bg-[#ffffff] border border-[#d1d5db] rounded-lg p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-[#0f172a] text-xl font-bold">{event.title}</h1>
            <span className={`text-xs px-2 py-0.5 rounded border font-mono uppercase ${statusCls}`}>
              {event.status}
            </span>
          </div>
          <div className="text-[#64748b] text-xs font-mono">{event.public_event_id}</div>
          {event.description && (
            <p className="text-[#475569] text-sm mt-2">{event.description}</p>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          {event.status === "draft" && (
            <ActionBtn label="Start Event" color="green" onClick={() => onAction("start")} />
          )}
          {event.status === "live" && (
            <>
              <ActionBtn label="Pause" color="yellow" onClick={() => onAction("pause")} />
              <ActionBtn label="End Event" color="red" onClick={() => onAction("end")} />
            </>
          )}
          {event.status === "paused" && (
            <ActionBtn label="Resume" color="green" onClick={() => onAction("resume")} />
          )}
          <ActionBtn label="Delete" color="red-outline" onClick={() => onAction("delete")} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-[#d1d5db]">
        <StatCell label="Teams" value={String(event.team_count)} />
        {event.start_time && (
          <StatCell label="Starts" value={new Date(event.start_time).toLocaleString()} />
        )}
        {event.end_time && (
          <StatCell label="Ends" value={new Date(event.end_time).toLocaleString()} />
        )}
      </div>
    </div>
  );
}

function ActionBtn({
  label, color, onClick,
}: {
  label: string;
  color: "green" | "yellow" | "red" | "red-outline";
  onClick: () => void;
}) {
  const map = {
    green: "bg-[#4ade80] hover:bg-[#22c55e] text-black",
    yellow: "bg-[#facc15] hover:bg-[#eab308] text-black",
    red: "bg-[#f87171] hover:bg-[#ef4444] text-black",
    "red-outline": "bg-[#ffffff] border border-[#f87171] hover:bg-[#fff1f2] text-[#dc2626]",
  };
  return (
    <button onClick={onClick} className={`px-4 py-1.5 text-sm font-bold rounded transition-colors ${map[color]}`}>
      {label}
    </button>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[#64748b] text-xs">{label}</div>
      <div className="text-[#0f172a] text-sm mt-0.5">{value}</div>
    </div>
  );
}

// ── Trigger Panel ─────────────────────────────────────────────────────────────

function TriggerPanel({ eventId }: { eventId: string }) {
  const [triggeringIndex, setTriggeringIndex] = useState<number | null>(null);
  const [submittingModal, setSubmittingModal] = useState(false);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [roundName, setRoundName] = useState("");
  const [roundRps, setRoundRps] = useState(5);
  const [roundDuration, setRoundDuration] = useState(10);
  const [result, setResult] = useState<string | null>(null);

  const { data, mutate } = useSWR<AdminChallengeRoundsResponse>(
    eventId ? `admin-challenge-rounds-${eventId}` : null,
    () => adminGetChallengeRounds(eventId),
    { revalidateOnFocus: false }
  );

  const rounds: AdminTestingRound[] = data?.rounds ?? [];

  function openAddRoundModal() {
    setEditingIndex(null);
    setRoundName("");
    setRoundRps(5);
    setRoundDuration(10);
    setModalOpen(true);
  }

  function openEditRoundModal(round: AdminTestingRound, index: number) {
    setEditingIndex(index);
    setRoundName(round.name);
    setRoundRps(round.requests_per_second);
    setRoundDuration(round.duration_seconds);
    setModalOpen(true);
  }

  function closeModal() {
    if (submittingModal) return;
    setModalOpen(false);
  }

  async function triggerRound(index: number) {
    setTriggeringIndex(index);
    setResult(null);
    try {
      const res: AdminChallengeTriggerResponse = await adminTriggerChallenge(eventId, {
        round_index: index,
      });
      setResult(
        `✓ ${res.round_name}: ${res.requests_per_second}/sec × ${res.duration_seconds}s (${res.per_endpoint_requests} requests per endpoint), dispatched ${res.tasks_dispatched} scoring tasks`
      );
    } catch (err) {
      setResult("✗ " + (err instanceof Error ? err.message : "Failed"));
    } finally {
      setTriggeringIndex(null);
    }
  }

  async function saveRound() {
    if (!roundName.trim()) {
      setResult("✗ Round name is required");
      return;
    }

    setSubmittingModal(true);
    setResult(null);
    try {
      const payload = {
        name: roundName.trim(),
        requests_per_second: roundRps,
        duration_seconds: roundDuration,
      };

      if (editingIndex === null) {
        await adminCreateChallengeRound(eventId, payload);
        setResult("✓ New testing round created");
      } else {
        await adminUpdateChallengeRound(eventId, editingIndex, payload);
        setResult("✓ Testing round updated");
      }

      await mutate();
      setModalOpen(false);
    } catch (err) {
      setResult("✗ " + (err instanceof Error ? err.message : "Failed"));
    } finally {
      setSubmittingModal(false);
    }
  }

  async function deleteRound(index: number) {
    if (!confirm("Delete this testing round?")) return;

    setDeletingIndex(index);
    setResult(null);
    try {
      await adminDeleteChallengeRound(eventId, index);
      await mutate();
      setResult("✓ Testing round deleted");
    } catch (err) {
      setResult("✗ " + (err instanceof Error ? err.message : "Failed"));
    } finally {
      setDeletingIndex(null);
    }
  }

  return (
    <>
      <div className="bg-[#ffffff] border border-[#d1d5db] rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-[#d1d5db] flex items-center justify-between">
          <h2 className="text-[#0f172a] font-semibold text-sm">Challenge Rounds ({rounds.length})</h2>
          <button
            onClick={openAddRoundModal}
            className="text-xs px-3 py-1 border border-[#d1d5db] hover:border-[#4ade80] text-[#475569] hover:text-[#4ade80] rounded transition-colors"
          >
            Add Round
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#f8fafc] border-b border-[#d1d5db]">
              <tr className="text-[#64748b] text-xs uppercase">
                <th className="px-5 py-3">Round</th>
                <th className="px-5 py-3">Requests/Sec</th>
                <th className="px-5 py-3">Duration</th>
                <th className="px-5 py-3">Total Requests</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rounds.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-[#64748b] text-sm">No testing rounds configured.</td>
                </tr>
              ) : (
                rounds.map((round, index) => (
                  <tr key={`${round.name}-${index}`} className="border-b last:border-b-0 border-[#d1d5db]">
                    <td className="px-5 py-3">
                      <div className="font-medium text-[#0f172a]">{round.name}</div>
                    </td>
                    <td className="px-5 py-3 text-[#0f172a] font-mono">{round.requests_per_second}</td>
                    <td className="px-5 py-3 text-[#0f172a] font-mono">{round.duration_seconds}s</td>
                    <td className="px-5 py-3 text-[#0f172a] font-mono">{round.requests_per_second * round.duration_seconds}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => triggerRound(index)}
                          disabled={triggeringIndex === index}
                          className="text-xs px-3 py-1 rounded bg-[#4ade80] hover:bg-[#22c55e] text-black font-semibold disabled:opacity-50"
                        >
                          {triggeringIndex === index ? "Triggering..." : "Trigger"}
                        </button>
                        <button
                          onClick={() => openEditRoundModal(round, index)}
                          className="text-xs px-3 py-1 border border-[#d1d5db] rounded text-[#475569] hover:text-[#0f172a] hover:border-[#94a3b8]"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteRound(index)}
                          disabled={deletingIndex === index}
                          className="text-xs px-3 py-1 border border-[#fecaca] rounded text-[#dc2626] hover:bg-[#fff1f2] disabled:opacity-50"
                        >
                          {deletingIndex === index ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {result && (
        <p className={`mt-3 text-sm ${result.startsWith("✓") ? "text-[#4ade80]" : "text-[#f87171]"}`}>
          {result}
        </p>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="w-full max-w-lg bg-[#ffffff] rounded-lg border border-[#d1d5db] shadow-2xl">
            <div className="px-5 py-4 border-b border-[#d1d5db] flex items-center justify-between">
              <h3 className="text-[#0f172a] text-sm font-semibold">
                {editingIndex === null ? "Add Round" : "Edit Round"}
              </h3>
              <button
                onClick={closeModal}
                disabled={submittingModal}
                className="text-[#dc2626] hover:text-[#991b1b] text-xl font-bold leading-none w-6 h-6 flex items-center justify-center rounded hover:bg-[#fee2e2] transition-colors disabled:opacity-50"
                title="Close"
              >
                ×
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-[#64748b] mb-1">Round Name</label>
                <input
                  value={roundName}
                  onChange={(e) => setRoundName(e.target.value)}
                  className="w-full border border-[#d1d5db] rounded px-3 py-2 text-sm text-[#0f172a]"
                  placeholder="Example: Stability 5x20"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#64748b] mb-1">Requests / Sec</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={roundRps}
                    onChange={(e) => setRoundRps(Number(e.target.value))}
                    className="w-full border border-[#d1d5db] rounded px-3 py-2 text-sm text-[#0f172a]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#64748b] mb-1">Duration (Sec)</label>
                  <input
                    type="number"
                    min={1}
                    max={600}
                    value={roundDuration}
                    onChange={(e) => setRoundDuration(Number(e.target.value))}
                    className="w-full border border-[#d1d5db] rounded px-3 py-2 text-sm text-[#0f172a]"
                  />
                </div>
              </div>

              <p className="text-xs text-[#64748b]">
                Total per endpoint: {Math.max(0, roundRps) * Math.max(0, roundDuration)} requests
              </p>
            </div>

            <div className="px-5 py-4 border-t border-[#d1d5db] flex items-center justify-end gap-2">
              <button
                onClick={closeModal}
                disabled={submittingModal}
                className="px-4 py-2 border border-[#d1d5db] rounded text-sm text-[#475569] hover:text-[#0f172a]"
              >
                Cancel
              </button>
              <button
                onClick={saveRound}
                disabled={submittingModal || !roundName.trim()}
                className="px-4 py-2 bg-[#4ade80] hover:bg-[#22c55e] text-black rounded text-sm font-semibold disabled:opacity-50"
              >
                {submittingModal ? "Saving..." : editingIndex === null ? "Create Round" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Teams Panel ───────────────────────────────────────────────────────────────

function TeamsPanel({
  eventId,
  teams,
  mutateTeams,
  mutateEvent,
}: {
  eventId: string;
  teams: AdminTeam[] | undefined;
  mutateTeams: () => void;
  mutateEvent: () => void;
}) {
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [newCodes, setNewCodes] = useState<Record<string, string>>({});
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [teamNamesRaw, setTeamNamesRaw] = useState("");
  const [addingTeams, setAddingTeams] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [savingTeamId, setSavingTeamId] = useState<string | null>(null);
  const [deletingTeamId, setDeletingTeamId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function handleCopyCode(teamId: string, code: string) {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(code);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = code;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      setCopiedId(teamId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      alert("Copy failed. Please copy the code manually.");
    }
  }

  async function handleAddTeams() {
    const teamNames = teamNamesRaw
      .split("\n")
      .map((name) => name.trim())
      .filter(Boolean);

    if (teamNames.length === 0) {
      alert("Enter at least one team name");
      return;
    }

    setAddingTeams(true);
    try {
      await adminCreateTeams(eventId, teamNames);
      setTeamNamesRaw("");
      setIsAddOpen(false);
      mutateTeams();
      mutateEvent();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add teams");
    } finally {
      setAddingTeams(false);
    }
  }

  async function handleSaveTeamName(teamId: string) {
    const trimmed = editingName.trim();
    if (!trimmed) {
      alert("Team name cannot be empty");
      return;
    }

    setSavingTeamId(teamId);
    try {
      await adminUpdateTeam(eventId, teamId, { team_name: trimmed });
      setEditingTeamId(null);
      setEditingName("");
      mutateTeams();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update team name");
    } finally {
      setSavingTeamId(null);
    }
  }

  async function handleRegenerate(teamId: string) {
    if (!confirm("Regenerate this team's login code? The current code will stop working.")) {
      return;
    }

    setRegeneratingId(teamId);
    try {
      const res = await adminRegenerateCode(eventId, teamId);
      setNewCodes((prev) => ({ ...prev, [teamId]: res.login_code }));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to regenerate code");
    } finally {
      setRegeneratingId(null);
    }
  }

  async function handleDeleteTeam(teamId: string) {
    if (!confirm("Delete this team? This cannot be undone.")) {
      return;
    }

    setDeletingTeamId(teamId);
    try {
      await adminDeleteTeam(eventId, teamId);
      setNewCodes((prev) => {
        const next = { ...prev };
        delete next[teamId];
        return next;
      });
      if (editingTeamId === teamId) {
        setEditingTeamId(null);
        setEditingName("");
      }
      await mutateTeams();
      mutateEvent();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete team");
    } finally {
      setDeletingTeamId(null);
    }
  }

  return (
    <>
      <div className="bg-[#ffffff] border border-[#d1d5db] rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-[#d1d5db] flex items-center justify-between">
          <h2 className="text-[#0f172a] font-semibold text-sm">Teams ({teams?.length ?? 0})</h2>
          <button
            onClick={() => setIsAddOpen(true)}
            className="text-xs px-3 py-1 border border-[#d1d5db] hover:border-[#4ade80] text-[#475569] hover:text-[#4ade80] rounded transition-colors"
          >
            + Add Teams
          </button>
        </div>

        {!teams || teams.length === 0 ? (
          <div className="px-5 py-8 text-center text-[#64748b] text-sm">No teams yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#f8fafc] border-b border-[#d1d5db]">
                <tr className="text-[#64748b] text-xs border-b border-[#d1d5db]">
                  <th className="px-4 py-2.5 text-left">Team Name</th>
                  <th className="px-4 py-2.5 text-left">Team ID</th>
                  <th className="px-4 py-2.5 text-left">Score</th>
                  <th className="px-4 py-2.5">Login Code</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((team) => {
                  const displayCode = newCodes[team.id] ?? team.login_code;
                  const isNew = !!newCodes[team.id];
                  const isEditing = editingTeamId === team.id;
                  return (
                    <tr key={team.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc]">
                      <td className="px-4 py-2.5 text-[#0f172a]">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <input
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              className="input-field text-sm"
                            />
                            <button
                              onClick={() => handleSaveTeamName(team.id)}
                              disabled={savingTeamId === team.id}
                              className="px-2 py-1 border border-[#4ade80] text-[#16a34a] rounded text-[11px] hover:bg-[#f0fdf4] transition-colors disabled:opacity-50"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => {
                                setEditingTeamId(null);
                                setEditingName("");
                              }}
                              className="px-2 py-1 border border-[#d1d5db] text-[#64748b] rounded text-[11px] hover:bg-[#f8fafc] transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          team.team_name
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-[#475569] font-mono text-xs">{team.public_team_id}</td>
                      <td className="px-4 py-2.5 text-[#0f172a]">{Number(team.score_total ?? 0).toFixed(4)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2 justify-end">
                          <span className={`font-mono text-sm font-bold tracking-wider ${isNew ? "text-[#facc15]" : "text-[#4ade80]"}`}>
                            {displayCode ?? <span className="text-[#64748b] text-xs italic">not available (regenerate)</span>}
                          </span>
                          {displayCode && (
                            <button
                              onClick={() => handleCopyCode(team.id, displayCode)}
                              className={`px-2 py-1 border rounded text-[11px] transition-colors ${
                                copiedId === team.id
                                  ? "border-[#4ade80] text-[#16a34a] bg-[#f0fdf4]"
                                  : "border-[#d1d5db] text-[#475569] hover:text-[#0f172a] hover:bg-[#f8fafc]"
                              }`}
                            >
                              {copiedId === team.id ? "Copied!" : "Copy"}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2 justify-end">
                          {!isEditing && (
                            <button
                              onClick={() => {
                                setEditingTeamId(team.id);
                                setEditingName(team.team_name);
                              }}
                              className="text-xs px-2.5 py-1 border border-[#d1d5db] hover:border-[#60a5fa] text-[#64748b] hover:text-[#2563eb] rounded transition-colors"
                            >
                              Edit Name
                            </button>
                          )}
                          <button
                            onClick={() => handleRegenerate(team.id)}
                            disabled={regeneratingId === team.id}
                            className="text-xs px-2.5 py-1 border border-[#d1d5db] hover:border-[#facc15] text-[#64748b] hover:text-[#facc15] rounded transition-colors disabled:opacity-40"
                          >
                            {regeneratingId === team.id ? "..." : "Regen Code"}
                          </button>
                          <button
                            onClick={() => handleDeleteTeam(team.id)}
                            disabled={deletingTeamId === team.id}
                            className="text-xs px-3 py-1 border border-[#fecaca] rounded text-[#dc2626] hover:bg-[#fff1f2] disabled:opacity-50"
                          >
                            {deletingTeamId === team.id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isAddOpen && (
        <div
          className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAddOpen(false);
          }}
        >
          <div className="w-full max-w-lg bg-[#ffffff] border border-[#d1d5db] rounded-lg shadow-xl">
            <div className="px-5 py-4 border-b border-[#d1d5db] flex items-center justify-between">
              <h3 className="text-[#0f172a] font-semibold text-base">Add Teams</h3>
              <button
                onClick={() => setIsAddOpen(false)}
                className="text-[#dc2626] hover:text-[#991b1b] text-xl font-bold leading-none w-6 h-6 flex items-center justify-center rounded hover:bg-[#fee2e2] transition-colors"
                title="Close"
              >
                ×
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-[#475569]">Enter one team name per line.</p>
              <textarea
                value={teamNamesRaw}
                onChange={(e) => setTeamNamesRaw(e.target.value)}
                className="input-field h-56 resize-none text-sm"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 border border-[#d1d5db] rounded text-sm text-[#475569] hover:bg-[#f8fafc] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddTeams}
                  disabled={addingTeams}
                  className="px-4 py-2 bg-[#4ade80] hover:bg-[#22c55e] text-black font-semibold rounded text-sm transition-colors disabled:opacity-50"
                >
                  {addingTeams ? "Adding..." : "Add Teams"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Content Panel ─────────────────────────────────────────────────────────────

function ContentPanel({ eventId, event }: { eventId: string; event: AdminEvent }) {
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setContent(event.readme_markdown ?? "");
    setSaved(false);
  }, [event]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await adminUploadReadme(eventId, content);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-[#ffffff] border border-[#d1d5db] rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-[#d1d5db] flex items-center justify-between">
        <span className="text-xs font-semibold text-[#0f172a] uppercase tracking-wider">README</span>
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-xs px-4 py-1.5 bg-[#4ade80] hover:bg-[#22c55e] text-black font-bold rounded transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : saved ? "Saved ✓" : "Save"}
        </button>
      </div>
      <div className="p-5">
        <textarea
          className="input-field h-64 resize-none font-mono text-xs"
          value={content}
          onChange={(e) => { setContent(e.target.value); setSaved(false); }}
          placeholder="# Markdown content..."
        />
        {error && <p className="text-[#f87171] text-xs mt-2">{error}</p>}
      </div>
    </div>
  );
}
