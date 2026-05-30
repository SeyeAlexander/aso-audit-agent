import { env, hasFirecrawl } from "../env.js";

/**
 * Fields the iTunes Lookup API does NOT return that the audit needs.
 * All optional: a Firecrawl failure (or absent key) should never break an audit.
 */
export interface AppStorePageEnrichment {
  subtitle?: string;
  promotionalText?: string;
  whatsNew?: string;
  reviewSnippets?: ReviewSnippet[];
}

export interface ReviewSnippet {
  rating?: number;
  title?: string;
  body: string;
  developerResponse?: string;
}

interface FirecrawlScrapeResponse {
  success: boolean;
  data?: {
    markdown?: string;
    html?: string;
    metadata?: Record<string, unknown>;
  };
  error?: string;
}

/**
 * Scrape the public App Store page for the fields Apple keeps out of the
 * iTunes Lookup JSON. Returns an empty enrichment object on any failure so
 * the workflow stays alive without the LLM-only path.
 */
export async function enrichWithFirecrawl(appStoreUrl: string): Promise<AppStorePageEnrichment> {
  if (!hasFirecrawl()) return {};

  try {
    const response = await fetch(`${env.FIRECRAWL_BASE_URL}/scrape`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.FIRECRAWL_API_KEY}`
      },
      body: JSON.stringify({
        url: appStoreUrl,
        formats: ["markdown"],
        onlyMainContent: true,
        waitFor: 1500
      })
    });

    if (!response.ok) return {};
    const payload = (await response.json()) as FirecrawlScrapeResponse;
    if (!payload.success || !payload.data?.markdown) return {};

    return extractFromMarkdown(payload.data.markdown);
  } catch {
    return {};
  }
}

/**
 * Apple's app store page has a stable structure. The subtitle sits directly
 * under the app name (and above the developer link), the "What's New" block
 * lives under a heading of the same name, etc. We do best-effort markdown
 * pattern matching — anything we can't find is just undefined.
 */
function extractFromMarkdown(markdown: string): AppStorePageEnrichment {
  const enrichment: AppStorePageEnrichment = {};

  const subtitle = extractSubtitle(markdown);
  if (subtitle) enrichment.subtitle = subtitle;

  const whatsNew = extractSection(markdown, ["What's New", "Whats New", "What’s New"]);
  if (whatsNew) enrichment.whatsNew = whatsNew;

  const promo = extractSection(markdown, ["Promotional Text"]);
  if (promo) enrichment.promotionalText = promo;

  const reviews = extractReviewSnippets(markdown);
  if (reviews.length > 0) enrichment.reviewSnippets = reviews;

  return enrichment;
}

function extractSubtitle(markdown: string): string | undefined {
  // App Store page typically: # App Name\n  ## Subtitle\n  or "App Name 4+\n  Subtitle..."
  const lines = markdown.split("\n").map((line) => line.trim()).filter(Boolean);
  for (let i = 0; i < Math.min(20, lines.length - 1); i += 1) {
    const line = lines[i];
    if (!line) continue;
    if (!/^#\s/.test(line)) continue;
    const next = lines[i + 1];
    if (!next) continue;
    if (next.length > 0 && next.length <= 60 && !next.startsWith("#") && !next.startsWith("[")) {
      return next.replace(/^["']|["']$/g, "");
    }
  }
  return undefined;
}

function extractSection(markdown: string, headings: string[]): string | undefined {
  const headingPattern = headings.map(escapeRegex).join("|");
  const regex = new RegExp(`#{1,6}\\s*(${headingPattern})\\s*\\n([\\s\\S]*?)(?:\\n#{1,6}\\s|$)`, "i");
  const match = regex.exec(markdown);
  if (!match?.[2]) return undefined;
  return match[2].trim().split("\n").slice(0, 8).join("\n").trim() || undefined;
}

function extractReviewSnippets(markdown: string): ReviewSnippet[] {
  // Apple's review HTML lays out individual reviews as:
  //   ### {title}\n  {author} · {date}\n  {body}
  // and adjacent dev responses include "Developer Response" or "Response from
  // the developer". We harvest both signals.
  const reviewsRegex = /(?:^|\n)(?:#{2,4}\s*)?([^\n#]{8,140})\n(?:[^\n]{1,80}·\s*[^\n]{1,40}\n)?([^\n#]{60,800})/g;
  const snippets: ReviewSnippet[] = [];
  let match: RegExpExecArray | null;
  let safety = 0;
  while ((match = reviewsRegex.exec(markdown)) !== null && safety < 40 && snippets.length < 5) {
    safety += 1;
    const title = match[1]?.trim();
    const body = match[2]?.trim();
    if (!body || /firstpartof|see all|tap to|app support/i.test(body)) continue;
    if (title && /version history|what.?s new|information|ratings & reviews|app privacy/i.test(title)) continue;
    const snippet: ReviewSnippet = { body };
    if (title) snippet.title = title;
    snippets.push(snippet);
  }

  // Find developer responses adjacent to the snippets we kept (best-effort).
  const devResponseRegex = /(?:Developer Response|Response from the developer)[\s\S]{0,40}\n([^\n#]{40,500})/i;
  const devMatch = devResponseRegex.exec(markdown);
  if (devMatch?.[1] && snippets[0]) {
    snippets[0].developerResponse = devMatch[1].trim();
  }

  return snippets;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
