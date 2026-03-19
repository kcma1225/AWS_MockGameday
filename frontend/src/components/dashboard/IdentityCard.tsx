interface IdentityCardProps {
  publicEventId: string;
  eventTitle: string;
  teamName: string;
  publicTeamId: string;
  encodedTeamId: string;
}

export function IdentityCard({
  publicEventId,
  eventTitle,
  teamName,
  publicTeamId,
  encodedTeamId,
}: IdentityCardProps) {
  return (
    <div className="bg-[#ffffff] border border-[#d1d5db] rounded-lg p-5">
      <h3 className="text-[#64748b] text-xs uppercase tracking-widest mb-4">Game Information</h3>
      <div className="space-y-3">
        <Row label="Game" value={eventTitle} />
        <Row label="Team Name" value={teamName} highlight />
        <Row label="Event ID" value={publicEventId} mono />
        <Row label="Team ID" value={publicTeamId} mono />
        <Row label="Team ID (base64)" value={encodedTeamId} mono small />
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  highlight = false,
  mono = false,
  small = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  mono?: boolean;
  small?: boolean;
}) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-[#475569] text-xs shrink-0 pt-0.5">{label}</span>
      <span
        className={`text-right break-all ${highlight ? "text-[#4ade80] font-semibold" : "text-[#e8eaf0]"} ${mono ? "font-mono" : ""} ${small ? "text-xs" : "text-sm"}`}
      >
        {value}
      </span>
    </div>
  );
}
