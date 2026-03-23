"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import useSWR from "swr";
import { getAdminToken, clearAdminToken, adminGetEvent, adminGetEventScoreEvents } from "@/lib/api";
import { AdminEvent, AdminScoreEventPage } from "@/types";

const CATEGORY_COLORS: Record<string, string> = {
  score: "text-[#16a34a]",
  penalty: "text-[#dc2626]",
  info: "text-[#475569]",
};

function timeAgoFromTimestamp(timestampMs: number, nowMs: number): string {
  const diff = Math.max(0, Math.floor((nowMs - timestampMs) / 1000));
  if (diff < 10) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function AdminEventScoreEventsPage() {
  const params = useParams<{ eventId: string }>();
  const eventId = params?.eventId;
  const router = useRouter();
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!getAdminToken()) router.push("/admin");
  }, [router]);

  const { data } = useSWR<AdminScoreEventPage>(
    eventId ? `admin-score-events-${eventId}` : null,
    () => adminGetEventScoreEvents(eventId, 1, 200),
    { refreshInterval: 1000 }
  );

  const { data: event } = useSWR<AdminEvent>(
    eventId ? `admin-event-header-${eventId}` : null,
    () => adminGetEvent(eventId),
    { revalidateOnFocus: false }
  );

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  function handleLogout() {
    clearAdminToken();
    router.push("/admin");
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
            <Link href={`/admin/events/${eventId}/score-events`} className="text-[#0f172a] font-semibold text-xs uppercase tracking-wide">Score Events</Link>
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
          </div>
          <button onClick={handleLogout} className="text-[#475569] hover:text-[#f87171] text-xs uppercase tracking-wide transition-colors">Logout</button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-5 flex items-center gap-4">
          <Link href={`/admin/events/${eventId}`} className="text-[#64748b] hover:text-[#0f172a] text-xs">← Back to Event</Link>
          <h1 className="text-xl font-bold text-[#0f172a]">Score Events</h1>
          <span className="ml-auto text-[#64748b] text-xs">
            {data ? `${data.total} total events` : "Loading..."}
          </span>
        </div>

        <div className="bg-[#ffffff] border border-[#d1d5db] rounded-lg overflow-hidden">
          {!data ? (
            <div className="px-5 py-12 text-center text-[#64748b] text-sm">Loading score events...</div>
          ) : data.items.length === 0 ? (
            <div className="px-5 py-12 text-center text-[#64748b] text-sm">No score events yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[#64748b] text-xs border-b border-[#d1d5db] bg-[#f8fafc]">
                    <th className="px-4 py-3 text-left">When</th>
                    <th className="px-4 py-3 text-left">Team</th>
                    <th className="px-4 py-3 text-right">Points</th>
                    <th className="px-4 py-3 text-left">Source</th>
                    <th className="px-4 py-3 text-left">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((ev) => (
                    <tr key={ev.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc]">
                      <td className="px-4 py-2.5 text-[#64748b] text-xs whitespace-nowrap">
                        {timeAgoFromTimestamp(ev.timestamp_ms, nowMs)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="font-medium text-[#0f172a]">{ev.team_name}</span>
                      </td>
                      <td className={`px-4 py-2.5 text-right font-mono font-bold ${CATEGORY_COLORS[ev.category] ?? "text-[#475569]"}`}>
                        {ev.points >= 0 ? "+" : ""}{Number(ev.points).toFixed(4)}
                      </td>
                      <td className="px-4 py-2.5 text-[#475569] text-xs">{ev.source}</td>
                      <td className="px-4 py-2.5 text-[#475569] text-xs max-w-xs truncate">{ev.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <p className="text-center text-[#94a3b8] text-xs mt-4">Auto-refreshes every 1 second</p>
      </main>
    </div>
  );
}
