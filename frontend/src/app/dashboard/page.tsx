"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import Image from "next/image";

import { useWebSocket } from "@/hooks/useWebSocket";
import { clearToken, isAuthenticated } from "@/lib/auth";
import { getTeamDashboard, getModules, getModuleStatus, logout, submitModuleUrl } from "@/lib/api";
import { TeamDashboard, Module, ModuleStatus, WSMessage, EventStatus } from "@/types";

export default function DashboardPage() {
  const router = useRouter();
  const [liveData, setLiveData] = useState<Partial<TeamDashboard>>({});
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

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
                <GameButton label="Set Team Name" href="#" accent="green" />
                <GameButton label="Score Events" href="/score-events" />
                <GameButton label="Scoreboard" href="/scoreboard" />
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

              <section className="max-w-[900px] mx-auto border border-[#d1d5db] rounded-sm bg-[#ffffff] p-5">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-2xl font-semibold text-[#111827]">
                    {selectedModule?.name || "Service Endpoint"}
                  </h2>
                  <Link href="/readme" className="text-sm text-[#2563eb] hover:underline">Readme</Link>
                </div>

                <div className="text-lg font-semibold text-[#111827] mb-2">Outputs:</div>
                <div className="text-base text-[#1f2937] mb-2">Source Webserver URL</div>
                <div className="text-sm text-[#374151] break-all mb-5">
                  {selectedStatus?.latest_submission?.normalized_value || "Not submitted yet"}
                </div>

                <form onSubmit={handleSubmitEndpoint} className="flex flex-col md:flex-row gap-3 md:items-center">
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="http://your-server-host:port"
                    className="flex-1 border border-[#d1d5db] bg-[#ffffff] rounded-sm px-4 py-3 text-sm text-[#111827] focus:outline-none focus:border-[#60a5fa]"
                    required
                  />
                  <button
                    type="submit"
                    disabled={submitting || !selectedModule}
                    className="px-6 py-3 rounded-sm border border-[#60a5fa] text-[#2563eb] text-sm font-medium hover:bg-[#eff6ff] disabled:opacity-50"
                  >
                    {submitting ? "Submitting..." : "Submit URL"}
                  </button>
                </form>
                {submitError && <p className="mt-3 text-sm text-[#dc2626]">{submitError}</p>}
                {submitSuccess && <p className="mt-3 text-sm text-[#16a34a]">URL submitted successfully</p>}
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
