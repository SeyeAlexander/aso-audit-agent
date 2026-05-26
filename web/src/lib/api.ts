import type { AuditResponse, ListingResponse } from "./types";

const GENERIC_SERVER_ERROR = "Server error — please try again.";

// Fallback for anything that slips past the server's sanitizer (older builds,
// proxy errors, etc.). If a message names a known upstream vendor, treat it as
// internal and show the generic message instead.
const VENDOR_PATTERNS = /\b(apple|itunes|firecrawl|nvidia|nim|openai|llm)\b/i;

function sanitizeError(message: string | undefined, status: number): string {
  if (!message || message.trim() === "") {
    return status >= 500 ? GENERIC_SERVER_ERROR : `Request failed (${status}).`;
  }
  if (VENDOR_PATTERNS.test(message)) return GENERIC_SERVER_ERROR;
  return message;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
  } catch {
    throw new Error("Can't reach the server — is it running?");
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(sanitizeError(payload?.error, response.status));
  }

  return (await response.json()) as T;
}

export function fetchListing(url: string): Promise<ListingResponse> {
  return postJson<ListingResponse>("/api/listing", { url });
}

export function runAudit(url: string): Promise<AuditResponse> {
  return postJson<AuditResponse>("/api/audit", { url });
}
