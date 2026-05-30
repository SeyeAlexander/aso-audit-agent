import { env } from "../env.js";
import type { AppStoreListing } from "../domain/app-store.js";
import { parseAppStoreUrl, parseLookupResponse } from "../domain/app-store.js";
import { enrichWithFirecrawl } from "./firecrawl-client.js";

export class AppStoreClient {
  async fetchListing(appStoreUrl: string): Promise<AppStoreListing> {
    const parsed = parseAppStoreUrl(appStoreUrl);
    const lookupUrl = new URL(env.APP_STORE_LOOKUP_URL);
    lookupUrl.searchParams.set("id", String(parsed.appId));
    lookupUrl.searchParams.set("country", parsed.country);

    const response = await fetch(lookupUrl);
    if (!response.ok) {
      throw new Error(`Apple lookup failed with ${response.status} ${response.statusText}.`);
    }

    const result = parseLookupResponse(await response.json());

    // Three enrichment sources, in priority order, all best-effort:
    //   1. iTunes Lookup (above): authoritative numeric metadata
    //   2. Lightweight HTML hints: og:description, json-ld description
    //   3. Firecrawl: real subtitle, promo text, What's New, reviews
    const [htmlFields, firecrawl] = await Promise.all([
      this.fetchHtmlHints(result.trackViewUrl).catch(() => ({})),
      enrichWithFirecrawl(result.trackViewUrl).catch(() => ({}))
    ]);

    return {
      ...result,
      ...htmlFields,
      ...firecrawl,
      country: parsed.country,
      appStoreUrl: parsed.url
    };
  }

  async findCompetitors(listing: AppStoreListing, limit = 3): Promise<AppStoreListing[]> {
    const searchUrl = new URL(env.APP_STORE_SEARCH_URL);
    const term = buildSearchTerm(listing);
    searchUrl.searchParams.set("term", term);
    searchUrl.searchParams.set("country", listing.country);
    searchUrl.searchParams.set("entity", "software");
    searchUrl.searchParams.set("limit", "12");

    const response = await fetch(searchUrl);
    if (!response.ok) {
      throw new Error(`Apple search failed with ${response.status} ${response.statusText}.`);
    }

    const payload = (await response.json()) as unknown;
    const results = Array.isArray((payload as { results?: unknown }).results)
      ? ((payload as { results: unknown[] }).results.map(parseLookupResponseItem).filter(Boolean) as AppStoreListing[])
      : [];

    return results
      .filter((candidate) => candidate.trackId !== listing.trackId)
      .filter((candidate) => {
        if (!listing.primaryGenreName || !candidate.primaryGenreName) return true;
        return candidate.primaryGenreName === listing.primaryGenreName;
      })
      .slice(0, limit)
      .map((candidate) => ({
        ...candidate,
        country: listing.country,
        appStoreUrl: candidate.trackViewUrl
      }));
  }

  private async fetchHtmlHints(url: string): Promise<Pick<AppStoreListing, "htmlSubtitle" | "htmlDescription">> {
    const response = await fetch(url, {
      headers: {
        "user-agent": "loupe/0.1 (+https://github.com/SeyeAlexander)"
      }
    });

    if (!response.ok) return {};

    const html = await response.text();
    const hints: Pick<AppStoreListing, "htmlSubtitle" | "htmlDescription"> = {};
    const htmlSubtitle = extractMetaContent(html, "og:description") ?? extractJsonLdDescription(html);
    const htmlDescription = extractMetaContent(html, "description");

    if (htmlSubtitle) hints.htmlSubtitle = htmlSubtitle;
    if (htmlDescription) hints.htmlDescription = htmlDescription;

    return hints;
  }
}

function parseLookupResponseItem(item: unknown): AppStoreListing | null {
  try {
    const result = parseLookupResponse({ resultCount: 1, results: [item] });
    return {
      ...result,
      country: "us",
      appStoreUrl: result.trackViewUrl
    };
  } catch {
    return null;
  }
}

function buildSearchTerm(listing: AppStoreListing): string {
  const titleWords = listing.trackName
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3)
    .slice(0, 3);

  if (titleWords.length > 0) return titleWords.join(" ");
  return listing.primaryGenreName ?? listing.genres?.[0] ?? listing.trackName;
}

function extractMetaContent(html: string, property: string): string | undefined {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i"));
  return match?.[1] ? decodeHtml(match[1]) : undefined;
}

function extractJsonLdDescription(html: string): string | undefined {
  const match = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match?.[1]) return undefined;

  try {
    const parsed = JSON.parse(match[1]) as { description?: string };
    return parsed.description;
  } catch {
    return undefined;
  }
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
