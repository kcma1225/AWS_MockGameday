"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import Image from "next/image";
import { getAdminToken, clearAdminToken, adminGetEvents, adminEventAction, adminDeleteEvent } from "@/lib/api";
import { AdminEvent } from "@/types";

const STATUS_COLORS: Record<string, string> = {
  draft: "text-[#64748b] border-[#64748b]",
  live: "text-[#4ade80] border-[#4ade80]",
  paused: "text-[#facc15] border-[#facc15]",
  ended: "text-[#f87171] border-[#f87171]",
};

export default function AdminEventsPage() {
  const router = useRouter();

  useEffect(() => {
    if (!getAdminToken()) router.push("/admin");
  }, [router]);

  const { data: events, mutate } = useSWR<AdminEvent[]>(
    "admin-events",
    () => adminGetEvents(),
    { revalidateOnFocus: false }
  );

  async function handleAction(eventId: string, action: "start" | "pause" | "resume" | "end" | "delete") {
    try {
      if (action === "delete") {
        await adminDeleteEvent(eventId);
      } else {
        await adminEventAction(eventId, action);
      }
      mutate();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Action failed");
    }
  }

  function handleLogout() {
    clearAdminToken();
    router.push("/admin");
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
          <button
            onClick={handleLogout}
            className="text-[#475569] hover:text-[#f87171] text-xs uppercase tracking-wide transition-colors"
          >
            Logout
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-[#0f172a]">Events</h1>
          <Link
            href="/admin/events/create"
            className="px-5 py-2 bg-[#4ade80] hover:bg-[#22c55e] text-black font-bold text-sm rounded transition-colors"
          >
            + Create New Event
          </Link>
        </div>

        {!events ? (
          <div className="text-[#64748b] text-sm">Loading events...</div>
        ) : events.length === 0 ? (
          <div className="text-center py-16 border border-[#d1d5db] rounded-lg text-[#64748b]">
            <p className="text-lg mb-4">No events created yet</p>
            <Link
              href="/admin/events/create"
              className="px-5 py-2 bg-[#4ade80] hover:bg-[#22c55e] text-black font-bold text-sm rounded transition-colors"
            >
              Create your first event
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onAction={(action) => handleAction(event.id, action)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function EventCard({
  event,
  onAction,
}: {
  event: AdminEvent;
  onAction: (action: "start" | "pause" | "resume" | "end" | "delete") => void;
}) {
  const statusCls = STATUS_COLORS[event.status] || STATUS_COLORS.draft;

  return (
    <div className="bg-[#ffffff] border border-[#d1d5db] rounded-lg p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-[#0f172a] font-semibold text-base truncate">{event.title}</h2>
            <span className={`text-xs px-2 py-0.5 rounded border font-mono uppercase shrink-0 ${statusCls}`}>
              {event.status}
            </span>
          </div>
          <div className="text-[#64748b] text-xs font-mono mb-2">{event.public_event_id}</div>
          <div className="flex gap-4 text-[#475569] text-xs">
            <span>{event.team_count} teams</span>
            {event.start_time && (
              <span>Start: {new Date(event.start_time).toLocaleDateString()}</span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 shrink-0">
          {/* State Controls */}
          <div className="flex gap-2">
            {event.status === "draft" && (
              <button
                onClick={() => onAction("start")}
                className="px-3 py-1 bg-[#4ade80] hover:bg-[#22c55e] text-black text-xs font-bold rounded transition-colors"
              >
                Start
              </button>
            )}
            {event.status === "live" && (
              <>
                <button
                  onClick={() => onAction("pause")}
                  className="px-3 py-1 bg-[#facc15] hover:bg-[#eab308] text-black text-xs font-bold rounded transition-colors"
                >
                  Pause
                </button>
                <button
                  onClick={() => {
                    if (confirm("End this event? This cannot be undone.")) onAction("end");
                  }}
                  className="px-3 py-1 bg-[#f87171] hover:bg-[#ef4444] text-black text-xs font-bold rounded transition-colors"
                >
                  End
                </button>
              </>
            )}
            {event.status === "paused" && (
              <button
                onClick={() => onAction("resume")}
                className="px-3 py-1 bg-[#4ade80] hover:bg-[#22c55e] text-black text-xs font-bold rounded transition-colors"
              >
                Resume
              </button>
            )}
            <button
              onClick={() => {
                if (confirm(`Delete event \"${event.title}\" permanently? This will hard delete all related data.`)) {
                  onAction("delete");
                }
              }}
              className="px-3 py-1 bg-[#ffffff] border border-[#f87171] hover:bg-[#fff1f2] text-[#dc2626] text-xs font-bold rounded transition-colors"
            >
              Delete
            </button>
          </div>
          <Link
            href={`/admin/events/${event.id}`}
            className="px-3 py-1 bg-[#ffffff] border border-[#d1d5db] hover:border-[#4ade80] text-[#475569] hover:text-[#0f172a] text-xs rounded transition-colors text-center"
          >
            Manage →
          </Link>
        </div>
      </div>
    </div>
  );
}
