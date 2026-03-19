"use client";

import { useEffect, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";

import TopNav from "@/components/layout/TopNav";
import { ScoreEventsTable } from "@/components/score-events/ScoreEventsTable";
import { useWebSocket } from "@/hooks/useWebSocket";
import { isAuthenticated } from "@/lib/auth";
import { getScoreEvents, getTeamDashboard } from "@/lib/api";
import { ScoreEventPage, ScoreEvent, WSMessage } from "@/types";

const PAGE_SIZE = 50;

export default function ScoreEventsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<"all" | "positive" | "negative">("all");
  const [liveEvents, setLiveEvents] = useState<ScoreEvent[]>([]);

  useEffect(() => {
    if (!isAuthenticated()) router.push("/");
  }, [router]);

  const { data: dashboard } = useSWR("team-dashboard-se", () => getTeamDashboard());

  const queryParams = {
    page,
    page_size: PAGE_SIZE,
    ...(filter === "positive" ? { min_points: 0.01 } : {}),
    ...(filter === "negative" ? { max_points: -0.01 } : {}),
  };

  const { data: eventsData, mutate } = useSWR<ScoreEventPage>(
    ["score-events", page, filter],
    () => getScoreEvents(queryParams),
    { refreshInterval: 10000 }
  );

  const handleWsMessage = useCallback(
    (msg: WSMessage) => {
      if (msg.type === "team.score.updated" && msg.score_event && page === 1) {
        setLiveEvents((prev) => [msg.score_event!, ...prev].slice(0, 10));
        mutate();
      }
    },
    [page, mutate]
  );

  useWebSocket(handleWsMessage);

  // Combine live + fetched events (de-dupe by id on page 1)
  const allEvents =
    page === 1 && eventsData
      ? [
          ...liveEvents.filter(
            (le) => !eventsData.items.find((e) => e.id === le.id)
          ),
          ...eventsData.items,
        ]
      : eventsData?.items || [];

  const totalPages = eventsData ? Math.ceil(eventsData.total / PAGE_SIZE) : 1;

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <TopNav eventTitle={dashboard?.event_title} />

      <main className="max-w-[1280px] mx-auto px-5 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-semibold text-[#0f172a]">Score Events</h1>
            <p className="text-[#64748b] text-sm mt-1">
              {eventsData ? `${eventsData.total} total events` : "Loading..."}
            </p>
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            {(["all", "positive", "negative"] as const).map((f) => (
              <button
                key={f}
                onClick={() => { setFilter(f); setPage(1); }}
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  filter === f
                    ? "bg-[#4ade80] text-black font-bold"
                    : "bg-[#ffffff] border border-[#d1d5db] text-[#475569] hover:text-[#0f172a]"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-[#ffffff] border border-[#d1d5db] rounded-lg overflow-hidden">
          <ScoreEventsTable events={allEvents} />
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-[#ffffff] border border-[#d1d5db] rounded text-sm text-[#475569] hover:text-[#0f172a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              ← Previous
            </button>
            <span className="text-[#64748b] text-sm">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 bg-[#ffffff] border border-[#d1d5db] rounded text-sm text-[#475569] hover:text-[#0f172a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next →
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
