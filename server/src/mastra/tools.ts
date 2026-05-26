import { createTool } from "@mastra/core/tools";
import { AppStoreClient } from "../services/app-store-client.js";
import { createDeterministicAudit } from "../services/audit-engine.js";
import {
  competitorSetSchema,
  fetchedListingSchema,
  scoredAuditSchema,
  urlInputSchema
} from "./schemas.js";

const appStoreClient = new AppStoreClient();

export const fetchAppStoreListingTool = createTool({
  id: "fetch-app-store-listing",
  description:
    "Fetch full Apple App Store listing metadata for an apps.apple.com URL. Uses Apple's public lookup API plus lightweight HTML hints.",
  inputSchema: urlInputSchema,
  outputSchema: fetchedListingSchema,
  execute: async ({ url }) => {
    const listing = await appStoreClient.fetchListing(url);
    return { listing };
  }
});

export const findAppStoreCompetitorsTool = createTool({
  id: "find-app-store-competitors",
  description:
    "Find 2-3 App Store competitors in the same country and primary category. Uses Apple Search and filters to the same genre when known.",
  inputSchema: fetchedListingSchema,
  outputSchema: competitorSetSchema,
  execute: async ({ listing }) => {
    const competitors = await appStoreClient.findCompetitors(listing, 3);
    return { listing, competitors };
  }
});

export const scoreAsoAuditTool = createTool({
  id: "score-aso-audit",
  description:
    "Run the deterministic 10-dimension ASO scoring engine and produce a complete audit (score card, quick wins, high-impact changes, strategic recommendations, competitor comparison).",
  inputSchema: competitorSetSchema,
  outputSchema: scoredAuditSchema,
  execute: async ({ listing, competitors }) => {
    const audit = createDeterministicAudit({ listing, competitors });
    return { listing, competitors, audit };
  }
});
