"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { setToken, isAuthenticated } from "@/lib/auth";
import { loginWithCode } from "@/lib/api";
import { LoginResponse } from "@/types";

export default function LoginPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated()) {
      router.push("/dashboard");
    }
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res: LoginResponse = await loginWithCode(code.trim().toUpperCase());
      setToken(res.access_token);
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed. Check your code and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8fafc] px-4">
      <div className="mb-10 text-center">
        <Image
          src="/site_logo.svg"
          alt="NTUNHS ITC"
          width={300}
          height={84}
          priority
          className="h-16 w-auto mx-auto"
        />
      </div>

      {/* Login Card */}
      <div className="bg-[#ffffff] border border-[#d1d5db] rounded-xl p-8 w-full max-w-sm shadow-2xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[#475569] text-xs uppercase tracking-widest mb-2">
              Login Code
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="w-full bg-[#f8fafc] border border-[#d1d5db] rounded-lg px-4 py-3 text-[#0f172a] font-mono text-sm placeholder-[#3d4365] focus:outline-none focus:border-[#4ade80] transition-colors tracking-widest"
              autoFocus
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          {error && (
            <div className="bg-[#2a1010] border border-[#f87171] rounded-lg px-4 py-3">
              <p className="text-[#f87171] text-xs">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="w-full bg-[#4ade80] hover:bg-[#22c55e] text-black font-bold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm tracking-wide"
          >
            {loading ? "Logging in..." : "Join Event"}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-[#d1d5db] text-center">
          <a
            href="/admin"
            className="text-[#64748b] hover:text-[#475569] text-xs transition-colors"
          >
            Organizer Login →
          </a>
        </div>
      </div>

    </div>
  );
}
