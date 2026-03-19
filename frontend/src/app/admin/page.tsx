"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { adminLogin, setAdminToken, getAdminToken } from "@/lib/api";

export default function AdminLoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (getAdminToken()) {
      router.push("/admin/events");
    }
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await adminLogin(login, password);
      setAdminToken(res.access_token);
      router.push("/admin/events");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
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

      <div className="bg-[#ffffff] border border-[#d1d5db] rounded-xl p-8 w-full max-w-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[#475569] text-xs uppercase tracking-widest mb-2">
              Username or Email
            </label>
            <input
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              className="w-full bg-[#f8fafc] border border-[#d1d5db] rounded-lg px-4 py-3 text-[#0f172a] text-sm placeholder-[#3d4365] focus:outline-none focus:border-[#4ade80] transition-colors"
              required
            />
          </div>
          <div>
            <label className="block text-[#475569] text-xs uppercase tracking-widest mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#f8fafc] border border-[#d1d5db] rounded-lg px-4 py-3 text-[#0f172a] text-sm placeholder-[#3d4365] focus:outline-none focus:border-[#4ade80] transition-colors"
              required
            />
          </div>

          {error && (
            <div className="bg-[#2a1010] border border-[#f87171] rounded-lg px-4 py-3">
              <p className="text-[#f87171] text-xs">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#4ade80] hover:bg-[#22c55e] text-black font-bold py-3 rounded-lg transition-colors disabled:opacity-50 text-sm"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-[#d1d5db] text-center">
          <a href="/" className="text-[#64748b] hover:text-[#475569] text-xs transition-colors">
            ← Back to Participant Login
          </a>
        </div>
      </div>
    </div>
  );
}
