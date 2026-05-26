import type { Express, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { AppStoreClient } from "./services/app-store-client.js";
import { toSurfaceMetadata } from "./domain/app-store.js";
import type { AppStoreListing } from "./domain/app-store.js";
import { mastra } from "./mastra/index.js";
import { hasConfiguredModel } from "./mastra/model.js";
import { hasFirecrawl } from "./env.js";
import { PublicError } from "./lib/errors.js";

function listingHighlights(listing: AppStoreListing): Record<string, unknown> {
  return {
    subtitle: listing.subtitle ?? null,
    promotionalText: listing.promotionalText ?? null,
    whatsNew: listing.whatsNew ?? null,
    averageUserRating: listing.averageUserRating ?? null,
    userRatingCount: listing.userRatingCount ?? null,
    formattedPrice: listing.formattedPrice ?? null,
    contentAdvisoryRating: listing.contentAdvisoryRating ?? null,
    currentVersionReleaseDate: listing.currentVersionReleaseDate ?? null,
    version: listing.version ?? null
  };
}

const listingClient = new AppStoreClient();

const urlBody = z.object({
  url: z.string().url()
});

function parseUrlBody(body: unknown): { url: string } {
  const result = urlBody.safeParse(body);
  if (!result.success) {
    throw new PublicError("Please paste a valid App Store URL.");
  }
  return result.data;
}

export function registerRoutes(app: Express): void {
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  /**
   * Fast path used by the URL-confirmation step on the client. We hit Apple
   * Lookup directly instead of running the workflow so the user sees the
   * app's icon/name within ~300ms.
   */
  app.post("/api/listing", asyncRoute(async (req, res) => {
    const { url } = parseUrlBody(req.body);
    const listing = await listingClient.fetchListing(url);
    res.json({
      surfaceMetadata: toSurfaceMetadata(listing),
      highlights: listingHighlights(listing),
      trackViewUrl: listing.trackViewUrl,
      capabilities: {
        llm: hasConfiguredModel(),
        firecrawl: hasFirecrawl()
      }
    });
  }));

  /**
   * Full audit runs through the Mastra workflow so every external action and
   * scoring step is observable, individually retryable, and re-usable from
   * the agent's tool list.
   */
  app.post("/api/audit", asyncRoute(async (req, res) => {
    const { url } = parseUrlBody(req.body);

    const workflow = mastra.getWorkflow("asoAudit");
    const run = await workflow.createRun();
    const outcome = await run.start({ inputData: { url } });

    if (outcome.status !== "success") {
      const reason = outcome.status === "failed" ? outcome.error?.message : `Workflow ${outcome.status}.`;
      throw new Error(reason ?? "ASO audit workflow did not produce a result.");
    }

    const { listing, competitors, audit, usedLlmRefinement } = outcome.result;

    res.json({
      surfaceMetadata: toSurfaceMetadata(listing),
      highlights: listingHighlights(listing),
      trackViewUrl: listing.trackViewUrl,
      audit,
      competitors: competitors.map((c: AppStoreListing) => ({
        name: c.trackName,
        iconUrl: c.artworkUrl100,
        rating: c.averageUserRating,
        ratingCount: c.userRatingCount,
        url: c.trackViewUrl
      })),
      usedLlmRefinement,
      capabilities: {
        llm: hasConfiguredModel(),
        firecrawl: hasFirecrawl()
      }
    });
  }));
}

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

function asyncRoute(handler: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res, next).catch(next);
  };
}
