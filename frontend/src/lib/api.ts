import { fetchWithAuth, getToken, API_URL } from "@/lib/auth";
import Cookies from "js-cookie";

// ---- Auth ----

export async function loginWithCode(code: string) {
  const res = await fetch(`${API_URL}/api/auth/code-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Login failed");
  }
  return res.json();
}

export async function adminLogin(login: string, password: string) {
  const res = await fetch(`${API_URL}/api/auth/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Login failed");
  }
  return res.json();
}

export function sharedFilePublicUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  return `${API_URL}${path}`;
}

export async function logout() {
  await fetchWithAuth("/api/auth/logout", { method: "POST" });
}

export async function getMe() {
  const res = await fetchWithAuth("/api/auth/me");
  if (!res.ok) throw new Error("Failed to get current user");
  return res.json();
}

// ---- Team Dashboard ----

export async function getTeamDashboard() {
  const res = await fetchWithAuth("/api/teams/current");
  if (!res.ok) throw new Error("Failed to load dashboard");
  return res.json();
}

// ---- Modules ----

export async function getModules() {
  const res = await fetchWithAuth("/api/modules");
  if (!res.ok) throw new Error("Failed to load modules");
  return res.json();
}

export async function submitModuleUrl(moduleId: string, url: string) {
  const res = await fetchWithAuth(`/api/modules/${moduleId}/submissions`, {
    method: "POST",
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Submission failed");
  }
  return res.json();
}

export async function getModuleStatus(moduleId: string) {
  const res = await fetchWithAuth(`/api/modules/${moduleId}/status`);
  if (!res.ok) throw new Error("Failed to get module status");
  return res.json();
}

// ---- Score Events ----

export async function getScoreEvents(params?: {
  page?: number;
  page_size?: number;
  source?: string;
  min_points?: number;
  max_points?: number;
  category?: string;
}) {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.page_size) q.set("page_size", String(params.page_size));
  if (params?.source) q.set("source", params.source);
  if (params?.min_points !== undefined) q.set("min_points", String(params.min_points));
  if (params?.max_points !== undefined) q.set("max_points", String(params.max_points));
  if (params?.category) q.set("category", params.category);

  const res = await fetchWithAuth(`/api/score-events?${q.toString()}`);
  if (!res.ok) throw new Error("Failed to load score events");
  return res.json();
}

// ---- Scoreboard ----

export async function getScoreboard() {
  const res = await fetchWithAuth("/api/scoreboard");
  if (!res.ok) throw new Error("Failed to load scoreboard");
  return res.json();
}

// ---- README ----

export async function getReadme() {
  const res = await fetchWithAuth("/api/readme");
  if (!res.ok) throw new Error("Failed to load readme");
  return res.json();
}

// ---- Admin ----

const ADMIN_TOKEN_KEY = "gd_admin_token";

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return Cookies.get(ADMIN_TOKEN_KEY) || null;
}

export function setAdminToken(token: string): void {
  Cookies.set(ADMIN_TOKEN_KEY, token, { expires: 1, sameSite: "lax" });
}

export function clearAdminToken(): void {
  Cookies.remove(ADMIN_TOKEN_KEY);
}

async function adminFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = getAdminToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return fetch(`${API_URL}${path}`, { ...init, headers });
}

export async function adminGetEvents() {
  const res = await adminFetch("/api/admin/events");
  if (!res.ok) throw new Error("Failed to load events");
  return res.json();
}

export async function adminGetEvent(eventId: string) {
  const res = await adminFetch(`/api/admin/events/${eventId}`);
  if (!res.ok) throw new Error("Failed to load event");
  return res.json();
}

export async function adminCreateEvent(data: Record<string, unknown>) {
  const res = await adminFetch("/api/admin/events", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to create event");
  }
  return res.json();
}

export async function adminUpdateEvent(eventId: string, data: Record<string, unknown>) {
  const res = await adminFetch(`/api/admin/events/${eventId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update event");
  return res.json();
}

export async function adminDeleteEvent(eventId: string) {
  const res = await adminFetch(`/api/admin/events/${eventId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete event");
}

export async function adminEventAction(eventId: string, action: "start" | "pause" | "resume" | "end") {
  const res = await adminFetch(`/api/admin/events/${eventId}/${action}`, { method: "POST" });
  if (!res.ok) throw new Error(`Failed to ${action} event`);
  return res.json();
}

export async function adminCreateTeams(eventId: string, teamNames: string[]) {
  const res = await adminFetch(`/api/admin/events/${eventId}/teams/bulk`, {
    method: "POST",
    body: JSON.stringify({ team_names: teamNames }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to create teams");
  }
  return res.json();
}

export async function adminGetTeams(eventId: string) {
  const res = await adminFetch(`/api/admin/events/${eventId}/teams`);
  if (!res.ok) throw new Error("Failed to load teams");
  return res.json();
}

export async function adminUpdateTeam(eventId: string, teamId: string, data: Record<string, unknown>) {
  const res = await adminFetch(`/api/admin/events/${eventId}/teams/${teamId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to update team");
  }
  return res.json();
}

export async function adminRegenerateCode(eventId: string, teamId: string) {
  const res = await adminFetch(`/api/admin/events/${eventId}/teams/${teamId}/regenerate-code`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to regenerate code");
  return res.json();
}

export async function adminDeleteTeam(eventId: string, teamId: string) {
  const res = await adminFetch(`/api/admin/events/${eventId}/teams/${teamId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to delete team");
  }
  return res.json();
}

export async function adminCreateModule(eventId: string, data: Record<string, unknown>) {
  const res = await adminFetch(`/api/admin/events/${eventId}/modules`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to create module");
  }
  return res.json();
}

export async function adminUploadReadme(eventId: string, content: string) {
  const res = await adminFetch(`/api/admin/events/${eventId}/content/readme`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error("Failed to upload readme");
  return res.json();
}

export async function adminUploadRunbook(eventId: string, content: string) {
  const res = await adminFetch(`/api/admin/events/${eventId}/content/runbook`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error("Failed to upload runbook");
  return res.json();
}

export async function adminGetChallengeRounds(eventId: string) {
  const res = await adminFetch(`/api/admin/events/${eventId}/challenge-rounds`);
  if (!res.ok) throw new Error("Failed to load challenge rounds");
  return res.json();
}

export async function adminCreateChallengeRound(
  eventId: string,
  data: { name: string; requests_per_second: number; duration_seconds: number }
) {
  const res = await adminFetch(`/api/admin/events/${eventId}/challenge-rounds`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to create challenge round");
  }
  return res.json();
}

export async function adminUpdateChallengeRound(
  eventId: string,
  roundIndex: number,
  data: { name: string; requests_per_second: number; duration_seconds: number }
) {
  const res = await adminFetch(`/api/admin/events/${eventId}/challenge-rounds/${roundIndex}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to update challenge round");
  }
  return res.json();
}

export async function adminDeleteChallengeRound(eventId: string, roundIndex: number) {
  const res = await adminFetch(`/api/admin/events/${eventId}/challenge-rounds/${roundIndex}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to delete challenge round");
  }
  return res.json();
}

export async function adminTriggerChallenge(
  eventId: string,
  data?: { round_index?: number; requests_per_second?: number; duration_seconds?: number }
) {
  const res = await adminFetch(`/api/admin/events/${eventId}/challenge-round`, {
    method: "POST",
    body: data ? JSON.stringify(data) : undefined,
  });
  if (!res.ok) throw new Error("Failed to trigger challenge");
  return res.json();
}

export async function adminGetEventScoreboard(eventId: string) {
  const res = await adminFetch(`/api/admin/events/${eventId}/scoreboard`);
  if (!res.ok) throw new Error("Failed to load scoreboard");
  return res.json();
}

export async function adminGetEventScoreEvents(eventId: string, page = 1, pageSize = 100) {
  const res = await adminFetch(`/api/admin/events/${eventId}/score-events?page=${page}&page_size=${pageSize}`);
  if (!res.ok) throw new Error("Failed to load score events");
  return res.json();
}

export async function adminCreateUser(data: Record<string, unknown>) {
  const res = await fetch(`${API_URL}/api/admin/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to create admin user");
  }
  return res.json();
}

// ---- Shared Folder ----

export async function adminUploadSharedFile(eventId: string, file: File) {
  const token = getAdminToken();
  const formData = new FormData();
  formData.append("file", file);

  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}/api/admin/events/${eventId}/shared-folder/upload`, {
    method: "POST",
    headers,
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to upload file");
  }
  return res.json();
}

export async function adminListSharedFiles(eventId: string) {
  const res = await adminFetch(`/api/admin/events/${eventId}/shared-folder/files`);
  if (!res.ok) throw new Error("Failed to load shared files");
  return res.json();
}

export async function adminDeleteSharedFile(eventId: string, fileId: string) {
  const res = await adminFetch(`/api/admin/events/${eventId}/shared-folder/files/${fileId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete file");
  return res.json();
}

export async function teamListSharedFiles() {
  const res = await fetchWithAuth("/api/shared-folder/files");
  if (!res.ok) throw new Error("Failed to load shared files");
  return res.json();
}

export async function teamDownloadSharedFile(fileId: string) {
  const res = await fetchWithAuth(`/api/shared-folder/files/${fileId}/download`);
  if (!res.ok) throw new Error("Failed to get download link");
  return res.json();
}

export async function teamDownloadSharedFileContent(fileId: string) {
  const res = await fetchWithAuth(`/api/shared-folder/files/${fileId}/content`);
  if (!res.ok) throw new Error("Failed to download file");

  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") || "";
  const fallbackName = `file-${fileId}`;
  const filenameMatch = disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
  const rawName = filenameMatch?.[1] || filenameMatch?.[2] || fallbackName;
  const filename = decodeURIComponent(rawName);

  return { blob, filename };
}
