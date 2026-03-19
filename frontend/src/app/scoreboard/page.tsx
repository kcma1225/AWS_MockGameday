"use client";

import { useEffect, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";

import { ScoreboardTable } from "@/components/scoreboard/ScoreboardTable";
import TopNav from "@/components/layout/TopNav";
import { useWebSocket } from "@/hooks/useWebSocket";
import { isAuthenticated } from "@/lib/auth";
import { getScoreboard, getTeamDashboard } from "@/lib/api";
import { Scoreboard, WSMessage } from "@/types";

export default function ScoreboardPage() {
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated()) router.push("/");
  }, [router]);

  const { data: scoreboard, mutate } = useSWR<Scoreboard>(
    "scoreboard",
    () => getScoreboard(),
    { refreshInterval: 10000 }
  );

  const { data: dashboard } = useSWR("team-dashboard-sb", () => getTeamDashboard());

  const handleWsMessage = useCallback(
    (msg: WSMessage) => {
      if (msg.type === "scoreboard.updated") {
        mutate();
      }
    },
    [mutate]
  );

  const { connected } = useWebSocket(handleWsMessage);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a]">
      <TopNav eventTitle={dashboard?.event_title} />

      <main className="max-w-[1280px] mx-auto px-5 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-[#0f172a]">Scoreboard</h1>
            <p className="text-sm text-[#64748b] mt-1">Live team ranking by total score</p>
          </div>
          <div className="text-right">
            <p className={`text-xs ${connected ? "text-[#16a34a]" : "text-[#64748b]"}`}>
              {connected ? "Live" : "Polling"}
            </p>
            {scoreboard && (
              <p className="text-xs text-[#64748b] mt-1">
                Updated {new Date(scoreboard.updated_at).toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>

        {!scoreboard ? (
          <div className="text-[#64748b] text-sm">Loading scoreboard...</div>
        ) : scoreboard.rows.length === 0 ? (
          <div className="text-[#64748b] text-sm border border-[#d1d5db] rounded p-8 text-center bg-[#ffffff]">
            No teams on the scoreboard yet.
          </div>
        ) : (
          <div className="bg-[#ffffff] border border-[#d1d5db] rounded-lg overflow-hidden">
            <ScoreboardTable rows={scoreboard.rows} />
          </div>
        )}
      </main>
    </div>
  );
}
