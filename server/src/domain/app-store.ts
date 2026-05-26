import { z } from "zod";
import { PublicError } from "../lib/errors.js";

const appStoreLookupResultSchema = z.object({
  trackId: z.number(),
  trackName: z.string(),
  trackCensoredName: z.string().optional(),
  sellerName: z.string().optional(),
  artistName: z.string().optional(),
  artworkUrl512: z.string().url().optional(),
  artworkUrl100: z.string().url().optional(),
  primaryGenreName: z.string().optional(),
  genres: z.array(z.string()).optional(),
  genreIds: z.array(z.string()).optional(),
  trackViewUrl: z.string().url(),
  description: z.string().optional(),
  releaseNotes: z.string().optional(),
  averageUserRating: z.number().optional(),
  userRatingCount: z.number().optional(),
  screenshotUrls: z.array(z.string().url()).optional(),
  ipadScreenshotUrls: z.array(z.string().url()).optional(),
  appletvScreenshotUrls: z.array(z.string().url()).optional(),
  previewUrls: z.array(z.string().url()).optional(),
  version: z.string().optional(),
  currentVersionReleaseDate: z.string().optional(),
  contentAdvisoryRating: z.string().optional(),
  languageCodesISO2A: z.array(z.string()).optional(),
  price: z.number().optional(),
  formattedPrice: z.string().optional(),
  minimumOsVersion: z.string().optional()
});

const appStoreLookupResponseSchema = z.object({
  resultCount: z.number(),
  results: z.array(appStoreLookupResultSchema)
});

export type AppStoreLookupResult = z.infer<typeof appStoreLookupResultSchema>;

export interface AppStoreListing extends AppStoreLookupResult {
  country: string;
  appStoreUrl: string;
  htmlSubtitle?: string | undefined;
  htmlDescription?: string | undefined;

  /** Real subtitle scraped from the public App Store page (Apple hides it in Lookup). */
  subtitle?: string | undefined;
  /** Promotional text (above-the-fold copy editable in App Store Connect). */
  promotionalText?: string | undefined;
  /** "What's New" body for the current version. */
  whatsNew?: string | undefined;
  /** Best-effort review/dev-response snippets from the public page. */
  reviewSnippets?: { body: string; rating?: number; title?: string; developerResponse?: string }[];
}

export interface SurfaceMetadata {
  appName: string;
  developer: string;
  iconUrl?: string | undefined;
  category: string;
  country: string;
  appId: number;
}

export interface ParsedAppStoreUrl {
  appId: number;
  country: string;
  url: string;
}

export function parseAppStoreUrl(input: string): ParsedAppStoreUrl {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new PublicError("Please paste a valid App Store URL.");
  }

  if (url.hostname !== "apps.apple.com") {
    throw new PublicError("The URL must be from apps.apple.com.");
  }

  const idMatch = url.pathname.match(/\/id(\d+)/);
  if (!idMatch?.[1]) {
    throw new PublicError("Could not find an app id in that URL.");
  }

  const country = url.pathname.split("/").filter(Boolean)[0] ?? "us";

  return {
    appId: Number(idMatch[1]),
    country: country.toLowerCase(),
    url: url.toString()
  };
}

export function toSurfaceMetadata(listing: AppStoreListing): SurfaceMetadata {
  const metadata: SurfaceMetadata = {
    appName: listing.trackName,
    developer: listing.sellerName ?? listing.artistName ?? "Unknown developer",
    category: listing.primaryGenreName ?? listing.genres?.[0] ?? "Unknown category",
    country: listing.country.toUpperCase(),
    appId: listing.trackId
  };

  const iconUrl = listing.artworkUrl512 ?? listing.artworkUrl100;
  if (iconUrl) metadata.iconUrl = iconUrl;

  return metadata;
}

export function parseLookupResponse(payload: unknown): AppStoreLookupResult {
  const parsed = appStoreLookupResponseSchema.parse(payload);
  const result = parsed.results[0];

  if (!result) {
    throw new PublicError("No app found for that URL — double-check the link.");
  }

  return result;
}
