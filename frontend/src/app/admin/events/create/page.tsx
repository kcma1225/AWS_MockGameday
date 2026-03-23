"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  getAdminToken,
  clearAdminToken,
  adminCreateEvent,
  adminCreateTeams,
  adminUploadReadme,
} from "@/lib/api";
import { AdminTeam } from "@/types";

const STEPS = [
  "Basic Info",
  "Content",
  "Teams",
  "Review & Create",
];

interface EventForm {
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  timezone: string;
  status: "draft" | "live";
  scoreboard_public: boolean;
  root_url_detection_enabled: boolean;
  shared_folder_enabled: boolean;
}

function toDateTimeLocalValue(date: Date): string {
  const tzOffset = date.getTimezoneOffset() * 60000;
  const localISO = new Date(date.getTime() - tzOffset).toISOString();
  return localISO.slice(0, 16);
}

export default function AdminCreateEventPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 — Basic Info
  const defaultStart = toDateTimeLocalValue(new Date());
  const defaultEnd = toDateTimeLocalValue(new Date(Date.now() + 60 * 60 * 1000));
  const [form, setForm] = useState<EventForm>({
    title: "",
    description: "",
    start_time: defaultStart,
    end_time: defaultEnd,
    timezone: "UTC",
    status: "draft",
    scoreboard_public: true,
    root_url_detection_enabled: true,
    shared_folder_enabled: true,
  });

  // Step 2 — Content
  const [readme, setReadme] = useState("");

  // Step 3 — Teams
  const [teamNamesRaw, setTeamNamesRaw] = useState("");

  // Step 4 — Result
  const [createdEventId, setCreatedEventId] = useState<string | null>(null);
  const [createdTeams, setCreatedTeams] = useState<AdminTeam[]>([]);

  useEffect(() => {
    if (!getAdminToken()) router.push("/admin");
  }, [router]);

  function handleLogout() {
    clearAdminToken();
    router.push("/admin");
  }

  // Step validation
  function canAdvance() {
    if (step === 0) return form.title.trim().length > 0;
    if (step === 3) return false; // handled separately
    return true;
  }

  async function handleFinalCreate() {
    setLoading(true);
    setError(null);

    try {
      const generatedSlug = form.title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");

      // Create event
      const eventPayload: Record<string, unknown> = {
        title: form.title,
        slug: generatedSlug || `event-${Date.now()}`,
        description: form.description || undefined,
        timezone: form.timezone,
        status: form.status,
        scoreboard_public: form.scoreboard_public,
        root_url_detection_enabled: form.root_url_detection_enabled,
        shared_folder_enabled: form.shared_folder_enabled,
      };
      if (form.start_time) eventPayload.start_time = new Date(form.start_time).toISOString();
      if (form.end_time) eventPayload.end_time = new Date(form.end_time).toISOString();

      const newEvent = await adminCreateEvent(eventPayload);
      setCreatedEventId(newEvent.id);

      // Upload readme content if provided
      if (readme.trim()) await adminUploadReadme(newEvent.id, readme);

      // Create teams
      const teamNames = teamNamesRaw
        .split("\n")
        .map((t) => t.trim())
        .filter(Boolean);
      if (teamNames.length > 0) {
        const teams = await adminCreateTeams(newEvent.id, teamNames);
        setCreatedTeams(teams);
      }

      setStep(4); // success screen
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create event");
    } finally {
      setLoading(false);
    }
  }

  if (step === 4 && createdEventId) {
    return <SuccessScreen eventId={createdEventId} teams={createdTeams} />;
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
            <Link href="/admin/events" className="text-[#475569] hover:text-[#0f172a] text-xs uppercase tracking-wide">
              Events
            </Link>
          </div>
          <button onClick={handleLogout} className="text-[#475569] hover:text-[#f87171] text-xs uppercase tracking-wide transition-colors">
            Logout
          </button>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-10">
        <div className="mb-8">
          <Link href="/admin/events" className="text-[#64748b] hover:text-[#0f172a] text-xs">
            ← Back to Events
          </Link>
          <h1 className="text-2xl font-bold text-[#0f172a] mt-3">Create New Event</h1>
        </div>

        {/* Step indicators */}
        <div className="flex gap-2 mb-10">
          {STEPS.map((label, i) => (
            <div key={i} className="flex-1">
              <div
                className={`h-1 rounded-full transition-colors ${
                  i < step ? "bg-[#4ade80]" : i === step ? "bg-[#4ade80] opacity-60" : "bg-[#d1d5db]"
                }`}
              />
              <p className={`text-xs mt-1.5 font-mono hidden sm:block truncate ${i === step ? "text-[#4ade80]" : "text-[#64748b]"}`}>
                {i + 1}. {label}
              </p>
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="bg-[#ffffff] border border-[#d1d5db] rounded-lg p-6">
          {step === 0 && (
            <StepBasicInfo form={form} setForm={setForm} />
          )}
          {step === 1 && (
            <StepContent readme={readme} setReadme={setReadme} />
          )}
          {step === 2 && (
            <StepTeams teamNamesRaw={teamNamesRaw} setTeamNamesRaw={setTeamNamesRaw} />
          )}
          {step === 3 && (
            <StepReview form={form} teamCount={teamNamesRaw.split("\n").filter(Boolean).length} />
          )}
        </div>

        {error && (
          <div className="mt-4 px-4 py-3 bg-[#3d1515] border border-[#f87171] rounded text-[#f87171] text-sm">
            {error}
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <button
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 0}
            className="px-5 py-2 border border-[#d1d5db] hover:border-[#64748b] text-[#475569] hover:text-[#0f172a] text-sm rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Back
          </button>
          {step < 3 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canAdvance()}
              className="px-5 py-2 bg-[#4ade80] hover:bg-[#22c55e] text-black font-bold text-sm rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          ) : (
            <button
              onClick={handleFinalCreate}
              disabled={loading}
              className="px-5 py-2 bg-[#4ade80] hover:bg-[#22c55e] text-black font-bold text-sm rounded transition-colors disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Event"}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}

// ── Step Components ──────────────────────────────────────────────────────────

function StepBasicInfo({ form, setForm }: { form: EventForm; setForm: (f: EventForm) => void }) {
  function set<K extends keyof EventForm>(key: K, val: EventForm[K]) {
    setForm({ ...form, [key]: val });
  }

  return (
    <div className="space-y-5">
      <h2 className="text-[#0f172a] font-semibold text-base mb-4">Basic Information</h2>

      <Field label="Event Title *">
        <input
          className="input-field"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="AWS GameDay 2025 Q1"
        />
      </Field>

      <Field label="Description">
        <textarea
          className="input-field h-20 resize-none"
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Optional event description..."
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Start Time">
          <input
            type="datetime-local"
            className="input-field"
            value={form.start_time}
            onChange={(e) => set("start_time", e.target.value)}
          />
        </Field>
        <Field label="End Time">
          <input
            type="datetime-local"
            className="input-field"
            value={form.end_time}
            onChange={(e) => set("end_time", e.target.value)}
          />
        </Field>
      </div>

      <Field label="Timezone">
        <input
          className="input-field"
          value={form.timezone}
          onChange={(e) => set("timezone", e.target.value)}
          placeholder="UTC"
        />
      </Field>

      <Field label="Initial Status">
        <select
          className="input-field"
          value={form.status}
          onChange={(e) => set("status", e.target.value as "draft" | "live")}
        >
          <option value="draft">Draft</option>
          <option value="live">Live (start immediately)</option>
        </select>
      </Field>

      <div className="space-y-3 pt-2">
        <CheckboxField
          label="Scoreboard public (visible to participants)"
          checked={form.scoreboard_public}
          onChange={(v) => set("scoreboard_public", v)}
        />
        <CheckboxField
          label="Enable root URL detection (allow root URL only)"
          checked={form.root_url_detection_enabled}
          onChange={(v) => set("root_url_detection_enabled", v)}
        />
        <CheckboxField
          label="Enable shared folder (files for all teams)"
          checked={form.shared_folder_enabled}
          onChange={(v) => set("shared_folder_enabled", v)}
        />
      </div>
    </div>
  );
}

function StepContent({
  readme, setReadme,
}: {
  readme: string; setReadme: (v: string) => void;
}) {
  async function handleUploadReadme(file: File | null) {
    if (!file) return;
    const text = await file.text();
    setReadme(text);
  }

  return (
    <div>
      <h2 className="text-[#0f172a] font-semibold text-base mb-4">Event Content</h2>
      <p className="text-[#475569] text-xs mb-4">
        README markdown shown to participants. You can type manually or upload a markdown file.
      </p>
      <div className="mb-4">
        <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-[#d1d5db] hover:border-[#4ade80] text-[#475569] hover:text-[#4ade80] text-xs cursor-pointer transition-colors">
          Upload README (.md/.txt)
          <input
            type="file"
            accept=".md,.markdown,.txt"
            className="hidden"
            onChange={(e) => handleUploadReadme(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>
      <textarea
        className="input-field h-64 resize-none font-mono text-xs"
        value={readme}
        onChange={(e) => setReadme(e.target.value)}
        placeholder="# Welcome to the GameDay!&#10;&#10;Your mission is..."
      />
    </div>
  );
}

function StepTeams({ teamNamesRaw, setTeamNamesRaw }: { teamNamesRaw: string; setTeamNamesRaw: (v: string) => void }) {
  const count = teamNamesRaw.split("\n").map((t) => t.trim()).filter(Boolean).length;

  return (
    <div>
      <h2 className="text-[#0f172a] font-semibold text-base mb-4">Teams</h2>
      <p className="text-[#475569] text-xs mb-4">
        Enter one team name per line. Login codes will be automatically generated.
      </p>
      <Field label={`Team names (${count} team${count !== 1 ? "s" : ""})`}>
        <textarea
          className="input-field h-52 resize-none font-mono text-sm"
          value={teamNamesRaw}
          onChange={(e) => setTeamNamesRaw(e.target.value)}
          placeholder="Team Alpha&#10;Team Bravo&#10;Team Charlie"
        />
      </Field>
      <p className="text-[#64748b] text-xs mt-2">Up to 100 teams. Leave blank to add teams later.</p>
    </div>
  );
}

function StepReview({
  form,
  teamCount,
}: {
  form: EventForm;
  teamCount: number;
}) {
  return (
    <div>
      <h2 className="text-[#0f172a] font-semibold text-base mb-4">Review & Create</h2>
      <div className="space-y-3 text-sm">
        <Row label="Title" value={form.title} />
        <Row label="Status" value={form.status} />
        <Row label="Timezone" value={form.timezone} />
        {form.start_time && <Row label="Start" value={new Date(form.start_time).toLocaleString()} />}
        {form.end_time && <Row label="End" value={new Date(form.end_time).toLocaleString()} />}
        <Row label="Teams to create" value={teamCount === 0 ? "None (add later)" : `${teamCount}`} />
        <Row label="Challenge Endpoint" value="Single default module (auto-created)" />
        <Row label="Scoreboard public" value={form.scoreboard_public ? "Yes" : "No"} />
        <Row label="Root URL detection" value={form.root_url_detection_enabled ? "On" : "Off"} />
        <Row label="Shared folder" value={form.shared_folder_enabled ? "On" : "Off"} />
      </div>
      <p className="text-[#64748b] text-xs mt-6">
        Login codes will be shown only once after creation. Make sure to save them.
      </p>
    </div>
  );
}

function SuccessScreen({ eventId, teams }: { eventId: string; teams: AdminTeam[] }) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-start pt-16 px-4">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <div className="text-[#4ade80] text-5xl mb-4">✓</div>
          <h1 className="text-[#0f172a] text-2xl font-bold">Event Created!</h1>
          <p className="text-[#475569] text-sm mt-2">
            Below are the team login codes. <strong className="text-[#facc15]">Save these now</strong> — they will not be shown again.
          </p>
        </div>

        {teams.length > 0 && (
          <div className="bg-[#ffffff] border border-[#d1d5db] rounded-lg overflow-hidden mb-6">
            <div className="px-4 py-3 border-b border-[#d1d5db] flex justify-between items-center">
              <span className="text-[#0f172a] text-sm font-semibold">Team Login Codes</span>
              <button
                onClick={() => {
                  const csv = teams.map((t) => `"${t.team_name}","${t.public_team_id}","${t.login_code}"`).join("\n");
                  const blob = new Blob([`"Team Name","Team ID","Login Code"\n${csv}`], { type: "text/csv" });
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = "team-codes.csv";
                  a.click();
                }}
                className="text-xs px-3 py-1 border border-[#d1d5db] hover:border-[#4ade80] text-[#475569] hover:text-[#4ade80] rounded transition-colors"
              >
                ↓ Download CSV
              </button>
            </div>
            <table className="w-full">
              <thead>
                <tr className="text-[#64748b] text-xs border-b border-[#d1d5db]">
                  <th className="px-4 py-2 text-left">Team Name</th>
                  <th className="px-4 py-2 text-left">Team ID</th>
                  <th className="px-4 py-2 text-left font-mono">Login Code</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((team) => (
                  <tr key={team.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc]">
                    <td className="px-4 py-2.5 text-[#0f172a] text-sm">{team.team_name}</td>
                    <td className="px-4 py-2.5 text-[#475569] text-xs font-mono">{team.public_team_id}</td>
                    <td className="px-4 py-2.5 text-[#4ade80] text-sm font-mono font-bold tracking-wider">
                      {team.login_code}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => router.push(`/admin/events/${eventId}`)}
            className="flex-1 py-2.5 bg-[#4ade80] hover:bg-[#22c55e] text-black font-bold text-sm rounded transition-colors"
          >
            Manage Event →
          </button>
          <button
            onClick={() => router.push("/admin/events")}
            className="px-5 py-2.5 border border-[#d1d5db] hover:border-[#64748b] text-[#475569] hover:text-[#0f172a] text-sm rounded transition-colors"
          >
            All Events
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[#475569] text-xs mb-1.5 font-medium">{label}</label>
      {children}
    </div>
  );
}

function CheckboxField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-[#4ade80] w-3.5 h-3.5"
      />
      <span className="text-[#475569] text-sm">{label}</span>
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-[#d1d5db]">
      <span className="text-[#64748b]">{label}</span>
      <span className="text-[#0f172a]">{value}</span>
    </div>
  );
}
