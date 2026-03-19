"use client";

import { ScoreboardRow } from "@/types";
import { clsx } from "clsx";

interface ScoreboardTableProps {
  rows: ScoreboardRow[];
}

export function ScoreboardTable({ rows }: ScoreboardTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-[#d1d5db] text-left bg-[#f8fafc]">
            <th className="text-[#64748b] text-xs uppercase tracking-wide py-3 px-4 font-medium w-16">
              Rank
            </th>
            <th className="text-[#64748b] text-xs uppercase tracking-wide py-3 px-4 font-medium">
              Team
            </th>
            <th className="text-[#64748b] text-xs uppercase tracking-wide py-3 px-4 font-medium text-right">
              Trend
            </th>
            <th className="text-[#64748b] text-xs uppercase tracking-wide py-3 px-4 font-medium text-right">
              Score
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <ScoreboardTableRow key={row.public_team_id} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScoreboardTableRow({ row }: { row: ScoreboardRow }) {
  const trendPositive = row.trend_value > 0;
  const trendNegative = row.trend_value < 0;

  return (
    <tr
      className={clsx(
        "border-b border-[#eef2f7] transition-colors",
        row.is_current_team
          ? "bg-[#f0fdf4] hover:bg-[#ecfdf3]"
          : "hover:bg-[#f8fafc]"
      )}
    >
      <td className="py-4 px-4">
        <span
          className={clsx(
            "text-xl font-semibold tabular-nums",
            row.rank === 1 ? "text-[#facc15]" : row.rank === 2 ? "text-[#94a3b8]" : row.rank === 3 ? "text-[#cd7f32]" : "text-[#64748b]"
          )}
        >
          {row.rank}
        </span>
      </td>
      <td className="py-4 px-4">
        <div className="flex items-center gap-2">
          <span
            className={clsx(
              "text-base font-semibold",
              row.is_current_team ? "text-[#4ade80]" : "text-[#0f172a]"
            )}
          >
            {row.team_name}
          </span>
          {row.is_current_team && (
            <span className="text-xs bg-[#ecfdf3] text-[#16a34a] border border-[#86efac] px-2 py-0.5 rounded">
              YOU
            </span>
          )}
          {!row.is_active && (
            <span className="text-xs text-[#64748b]">[inactive]</span>
          )}
        </div>
        <div className="text-[#64748b] text-xs font-mono mt-0.5">{row.public_team_id}</div>
      </td>
      <td className="py-4 px-4 text-right">
        <span
          className={clsx(
            "text-base font-semibold tabular-nums",
            trendPositive ? "text-[#4ade80]" : trendNegative ? "text-[#f87171]" : "text-[#64748b]"
          )}
        >
          {trendPositive ? "▲" : trendNegative ? "▼" : "–"}{" "}
          {Math.abs(row.trend_value).toFixed(1)}
        </span>
      </td>
      <td className="py-4 px-4 text-right">
        <span className="text-xl font-semibold tabular-nums text-[#0f172a]">
          {row.score_total.toFixed(2)}
        </span>
      </td>
    </tr>
  );
}
