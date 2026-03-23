export function isRootUrl(input: string): boolean {
  try {
    const parsed = new URL(input.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }

    const path = parsed.pathname || "";
    if (path !== "" && path !== "/") {
      return false;
    }

    if (parsed.search || parsed.hash) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
