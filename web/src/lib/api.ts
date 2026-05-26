import type { AuditResponse, ListingResponse } from "./types";

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? `Request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

export function fetchListing(url: string): Promise<ListingResponse> {
  return postJson<ListingResponse>("/api/listing", { url });
}

export function runAudit(url: string): Promise<AuditResponse> {
  return postJson<AuditResponse>("/api/audit", { url });
}
