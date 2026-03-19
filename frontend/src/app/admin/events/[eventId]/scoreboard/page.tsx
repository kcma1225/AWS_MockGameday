"use client";

import { useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import useSWR from "swr";
import { getAdminToken, clearAdminToken, adminGetEventScoreboard } from "@/lib/api";
import { AdminScoreboard } from "@/types";

export default function AdminEventScoreboardPage() {
  const params = useParams<{ eventId: string }>();
  const eventId = params?.eventId;
  const router = useRouter();

  useEffect(() => {
    if (!getAdminToken()) router.push("/admin");
  }, [router]);

  const { data, mutate } = useSWR<AdminScoreboard>(
    eventId ? `admin-scoreboard-${eventId}` : null,
    () => adminGetEventScoreboard(eventId),
    { refreshInterval: 3000 }
  );

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
            <Link href={`/admin/events/${eventId}/scoreboard`} className="text-[#0f172a] font-semibold text-xs uppercase tracking-wide">Scoreboard</Link>
            <Link href={`/admin/events/${eventId}/score-events`} className="text-[#475569] hover:text-[#0f172a] text-xs uppercase tracking-wide">Score Events</Link>
          </div>
          <button onClick={handleLogout} className="text-[#475569] hover:text-[#f87171] text-xs uppercase tracking-wide transition-colors">Logout</button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-5 flex items-center gap-4">
          <Link href={`/admin/events/${eventId}`} className="text-[#64748b] hover:text-[#0f172a] text-xs">← Back to Event</Link>
          <h1 className="text-xl font-bold text-[#0f172a]">Scoreboard</h1>
          {data && (
            <span className="ml-auto text-[#64748b] text-xs">Updated: {new Date(data.updated_at).toLocaleTimeString()}</span>
          )}
          <button onClick={() => mutate()} className="text-xs px-3 py-1 border border-[#d1d5db] hover:border-[#4ade80] text-[#475569] hover:text-[#4ade80] rounded transition-colors">
            Refresh
          </button>
        </div>

        <div className="bg-[#ffffff] border border-[#d1d5db] rounded-lg overflow-hidden">
          {!data ? (
            <div className="px-5 py-12 text-center text-[#64748b] text-sm">Loading scoreboard...</div>
          ) : data.rows.length === 0 ? (
            <div className="px-5 py-12 text-center text-[#64748b] text-sm">No teams yet</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[#64748b] text-xs border-b border-[#d1d5db] bg-[#f8fafc]">
                  <th className="px-4 py-3 text-left w-12">Rank</th>
                  <th className="px-4 py-3 text-left">Team</th>
                  <th className="px-4 py-3 text-right">Score</th>
                  <th className="px-4 py-3 text-right">Trend (1 min)</th>
                  <th className="px-4 py-3 text-left">Last Score</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.team_id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc]">
                    <td className="px-4 py-3 text-center font-mono font-bold text-[#0f172a]">{row.rank}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#0f172a]">{row.team_name}</div>
                      <div className="text-[#64748b] text-xs font-mono">{row.public_team_id}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-[#0f172a]">
                      {Number(row.score_total).toFixed(4)}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono font-semibold ${row.trend_value >= 0 ? "text-[#16a34a]" : "text-[#dc2626]"}`}>
                      {row.trend_value >= 0 ? "+" : ""}{Number(row.trend_value).toFixed(4)}
                    </td>
                    <td className="px-4 py-3 text-[#475569] text-xs">
                      {row.last_score_at ? new Date(row.last_score_at).toLocaleTimeString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p className="text-center text-[#94a3b8] text-xs mt-4">Auto-refreshes every 3 seconds</p>
      </main>
    </div>
  );
}
