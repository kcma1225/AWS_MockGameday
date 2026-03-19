import { clsx } from "clsx";

interface KPICardProps {
  label: string;
  value: string | number;
  subValue?: string;
  colorClass?: string;
}

export function KPICard({ label, value, subValue, colorClass = "text-[#0f172a]" }: KPICardProps) {
  return (
    <div className="bg-[#ffffff] border border-[#d1d5db] rounded-lg p-6 flex flex-col items-center justify-center min-w-[140px]">
      <span className="text-[#64748b] text-xs uppercase tracking-widest mb-2">{label}</span>
      <span className={clsx("text-4xl font-bold tabular-nums", colorClass)}>{value}</span>
      {subValue && (
        <span className="text-[#475569] text-xs mt-1">{subValue}</span>
      )}
    </div>
  );
}

interface KPIStripProps {
  score: number;
  trend: number;
  rank: number | null;
}

export function KPIStrip({ score, trend, rank }: KPIStripProps) {
  const trendColor =
    trend > 0 ? "text-[#4ade80]" : trend < 0 ? "text-[#f87171]" : "text-[#475569]";
  const trendPrefix = trend > 0 ? "+" : "";

  return (
    <div className="flex flex-wrap gap-4 justify-center">
      <KPICard label="Score" value={score.toFixed(2)} colorClass="text-[#0f172a]" />
      <KPICard
        label="Trend"
        value={`${trendPrefix}${trend.toFixed(1)}`}
        subValue="last 5 min"
        colorClass={trendColor}
      />
      <KPICard
        label="Rank"
        value={rank !== null ? `#${rank}` : "—"}
        colorClass="text-[#60a5fa]"
      />
    </div>
  );
}
