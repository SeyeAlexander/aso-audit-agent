import { z } from "zod";
import { asoAuditSchema } from "../domain/aso.js";
import type { AppStoreListing } from "../domain/app-store.js";

/**
 * Apple's iTunes Lookup response is large and fluid (Apple adds fields freely),
 * so we type the listing as an opaque object at the Mastra-tool boundary and
 * rely on the domain-layer parser (`parseLookupResponse`) for the strict shape.
 * This keeps schemas thin without losing TS safety inside execute bodies.
 */
export const listingSchema = z.custom<AppStoreListing>(
  (value) => typeof value === "object" && value !== null && "trackId" in (value as object),
  { message: "Invalid AppStoreListing" }
);

export const urlInputSchema = z.object({
  url: z.string().url()
});

export const fetchedListingSchema = z.object({
  listing: listingSchema
});

export const competitorSetSchema = z.object({
  listing: listingSchema,
  competitors: z.array(listingSchema)
});

export const scoredAuditSchema = z.object({
  listing: listingSchema,
  competitors: z.array(listingSchema),
  audit: asoAuditSchema
});

export const auditResultSchema = z.object({
  listing: listingSchema,
  competitors: z.array(listingSchema),
  audit: asoAuditSchema,
  // True when the agent produced the audit; false when we fell back to the
  // deterministic engine (no LLM key, or the agent failed/returned junk).
  agentLed: z.boolean()
});

export type FetchedListing = z.infer<typeof fetchedListingSchema>;
export type CompetitorSet = z.infer<typeof competitorSetSchema>;
export type ScoredAudit = z.infer<typeof scoredAuditSchema>;
export type AuditResult = z.infer<typeof auditResultSchema>;
