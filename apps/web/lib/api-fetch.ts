"use client";

/**
 * Client-side fetch wrapper that automatically includes the CSRF token
 * on state-mutating requests (POST, PATCH, DELETE).
 *
 * Usage: import { apiFetch } from "@/lib/api-fetch";
 *        const res = await apiFetch("/api/cash-logs", { method: "POST", ... });
 */

const CSRF_METHODS = new Set(["POST", "PATCH", "DELETE"]);

let csrfToken: string | null = null;

async function fetchCsrfToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/auth/csrf");
    if (!res.ok) return null;
    const data = await res.json();
    csrfToken = data.csrfToken ?? null;
    return csrfToken;
  } catch {
    return null;
  }
}

/**
 * Drop-in replacement for `fetch` that adds the X-CSRF-Token header
 * on POST/PATCH/DELETE requests. Retries once with a fresh token on 403.
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const method = (init?.method ?? "GET").toUpperCase();

  if (!CSRF_METHODS.has(method)) {
    return fetch(input, init);
  }

  // Ensure we have a CSRF token
  if (!csrfToken) {
    await fetchCsrfToken();
  }

  const headers = new Headers(init?.headers);
  if (csrfToken) {
    headers.set("X-CSRF-Token", csrfToken);
  }

  const response = await fetch(input, { ...init, headers });

  // If 403 due to stale/missing CSRF token, refresh and retry once
  if (response.status === 403) {
    const body = await response.clone().json().catch(() => null);
    if (body?.error?.includes("CSRF")) {
      await fetchCsrfToken();
      if (csrfToken) {
        headers.set("X-CSRF-Token", csrfToken);
        return fetch(input, { ...init, headers });
      }
    }
  }

  return response;
}
