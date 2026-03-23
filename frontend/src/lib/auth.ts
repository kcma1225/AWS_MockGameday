import Cookies from "js-cookie";

const TOKEN_KEY = "gd_token";
const API_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_URL) {
  throw new Error("Missing required env var NEXT_PUBLIC_API_URL");
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return Cookies.get(TOKEN_KEY) || null;
}

export function setToken(token: string): void {
  Cookies.set(TOKEN_KEY, token, { expires: 1, sameSite: "lax" });
}

export function clearToken(): void {
  Cookies.remove(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

async function fetchWithAuth(path: string, init?: RequestInit): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });

  if (res.status === 401) {
    clearToken();
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  }

  return res;
}

export { fetchWithAuth, API_URL };
