"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";

import TopNav from "@/components/layout/TopNav";
import { MarkdownViewer } from "@/components/readme/MarkdownViewer";
import { isAuthenticated } from "@/lib/auth";
import { getReadme, getTeamDashboard } from "@/lib/api";
import { ReadmeContent } from "@/types";

export default function ReadmePage() {
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated()) router.push("/");
  }, [router]);

  const { data: dashboard } = useSWR("team-dashboard-rm", () => getTeamDashboard());
  const { data: content } = useSWR<ReadmeContent>("readme", () => getReadme());

  const activeContent = content?.readme_markdown;

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <TopNav eventTitle={dashboard?.event_title} />

      <main className="max-w-[1280px] mx-auto px-5 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-semibold text-[#0f172a]">Dashboard Guide</h1>
        </div>

        <div className="bg-[#ffffff] border border-[#d1d5db] rounded-lg p-6 min-h-[420px]">
          {!content ? (
            <div className="text-[#64748b] font-mono text-sm">Loading...</div>
          ) : !activeContent ? (
            <div className="text-[#64748b] text-sm text-center py-12">
              No README content has been published for this event.
            </div>
          ) : (
            <MarkdownViewer content={activeContent} />
          )}
        </div>
      </main>
    </div>
  );
}
