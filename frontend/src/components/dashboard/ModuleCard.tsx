"use client";

import { useState } from "react";
import { Module, Submission } from "@/types";
import { submitModuleUrl } from "@/lib/api";
import { clsx } from "clsx";

interface ModuleCardProps {
  module: Module;
  latestSubmission?: Submission | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  accepted: { label: "Accepted", color: "text-[#4ade80]" },
  pending: { label: "Pending", color: "text-[#facc15]" },
  rejected: { label: "Rejected", color: "text-[#f87171]" },
  error: { label: "Error", color: "text-[#f87171]" },
  none: { label: "Not Submitted", color: "text-[#64748b]" },
};

export function ModuleCard({ module, latestSubmission }: ModuleCardProps) {
  const [url, setUrl] = useState(latestSubmission?.normalized_value || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const status = latestSubmission?.validation_status || "none";
  const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.none;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSubmitting(true);
    try {
      await submitModuleUrl(module.id, url);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-[#ffffff] border border-[#d1d5db] rounded-lg p-5">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-[#0f172a] font-semibold text-sm">{module.name}</h3>
          {module.description && (
            <p className="text-[#475569] text-xs mt-1">{module.description}</p>
          )}
        </div>
        <span className={clsx("text-xs font-mono", statusCfg.color)}>
          ● {statusCfg.label}
        </span>
      </div>

      {latestSubmission?.normalized_value && (
        <div className="mb-3 text-xs text-[#64748b] font-mono truncate">
          Current: {latestSubmission.normalized_value}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="http://your-endpoint.com"
          className="flex-1 bg-[#f8fafc] border border-[#d1d5db] rounded px-3 py-2 text-sm text-[#e8eaf0] placeholder-[#3d4365] focus:outline-none focus:border-[#4ade80] font-mono"
          required
        />
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 bg-[#4ade80] hover:bg-[#22c55e] text-black text-xs font-bold rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "..." : "Submit"}
        </button>
      </form>

      {error && <p className="text-[#f87171] text-xs mt-2">{error}</p>}
      {success && (
        <p className="text-[#4ade80] text-xs mt-2">Endpoint submitted successfully</p>
      )}
    </div>
  );
}
