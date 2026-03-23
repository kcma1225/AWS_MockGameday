"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { clearToken } from "@/lib/auth";
import { logout } from "@/lib/api";

interface NavItem {
  label: string;
  href: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Scoreboard", href: "/scoreboard" },
  { label: "Score Events", href: "/score-events" },
  { label: "README", href: "/readme" },
];

export default function TopNav({ eventTitle }: { eventTitle?: string }) {
  const router = useRouter();

  async function handleLogout() {
    try {
      await logout();
    } finally {
      clearToken();
      router.push("/");
    }
  }

  return (
    <nav className="border-b border-[#d1d5db] bg-[#ffffff] sticky top-0 z-50">
      <div className="max-w-[1280px] mx-auto px-5 flex items-center justify-between h-14">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center" aria-label="Go to dashboard">
            <Image
              src="/site_logo.svg"
              alt="NTUNHS ITC"
              width={170}
              height={48}
              priority
              className="h-9 w-auto"
            />
            <span className="ml-2 text-[#2563eb]" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </span>
          </Link>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-[#475569] hover:text-[#0f172a] text-sm transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-4">
          {eventTitle && (
            <span className="text-[#64748b] text-xs hidden md:block">{eventTitle}</span>
          )}
          <button
            onClick={handleLogout}
            className="text-[#475569] hover:text-[#f87171] text-sm transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
