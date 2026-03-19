"use client";

import { useEffect, useState } from "react";
import { ScoreEvent } from "@/types";
import { clsx } from "clsx";

interface ScoreEventsTableProps {
  events: ScoreEvent[];
}

export function ScoreEventsTable({ events }: ScoreEventsTableProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-[#d1d5db] bg-[#f8fafc]">
            <th className="text-[#64748b] text-xs uppercase tracking-wide py-3 px-4 font-medium text-left whitespace-nowrap">
              When
            </th>
            <th className="text-[#64748b] text-xs uppercase tracking-wide py-3 px-4 font-medium text-left whitespace-nowrap">
              Timestamp
            </th>
            <th className="text-[#64748b] text-xs uppercase tracking-wide py-3 px-4 font-medium text-right whitespace-nowrap">
              Points
            </th>
            <th className="text-[#64748b] text-xs uppercase tracking-wide py-3 px-4 font-medium text-left whitespace-nowrap">
              Source
            </th>
            <th className="text-[#64748b] text-xs uppercase tracking-wide py-3 px-4 font-medium text-left">
              Reason
            </th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <ScoreEventRow key={event.id} event={event} nowMs={nowMs} />
          ))}
        </tbody>
      </table>
      {events.length === 0 && (
        <div className="text-center py-12 text-[#64748b] text-sm">
          No score events yet. Submit your endpoint and wait for the scoring engine.
        </div>
      )}
    </div>
  );
}

function formatRelativeFromTimestamp(timestampMs: number, nowMs: number): string {
  const diffSeconds = Math.max(0, Math.floor((nowMs - timestampMs) / 1000));
  if (diffSeconds < 10) return "just now";
  if (diffSeconds < 60) return `${diffSeconds}s ago`;

  const minutes = Math.floor(diffSeconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function ScoreEventRow({ event, nowMs }: { event: ScoreEvent; nowMs: number }) {
  const positive = event.points > 0;
  const negative = event.points < 0;

  return (
    <tr className="border-b border-[#eef2f7] hover:bg-[#f8fafc] transition-colors">
      <td className="py-3 px-4 text-[#475569] whitespace-nowrap text-xs">
        {formatRelativeFromTimestamp(event.timestamp_ms, nowMs)}
      </td>
      <td className="py-3 px-4 text-[#64748b] font-mono text-xs whitespace-nowrap">
        {event.timestamp_ms}
      </td>
      <td className="py-3 px-4 text-right">
        <span
          className={clsx(
            "font-bold tabular-nums text-base",
            positive ? "text-[#4ade80]" : negative ? "text-[#f87171]" : "text-[#475569]"
          )}
        >
          {positive ? "+" : ""}
          {event.points}
        </span>
      </td>
      <td className="py-3 px-4 text-[#475569] whitespace-nowrap text-xs">
        {event.source}
      </td>
      <td className="py-3 px-4 text-[#334155] text-xs">{event.reason}</td>
    </tr>
  );
}
