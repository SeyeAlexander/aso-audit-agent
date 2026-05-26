import { ArrowRight, Check, ExternalLink, RotateCcw, Star, Zap } from "lucide-react";
import type { ListingResponse } from "@/lib/types";
import { Pill } from "@/components/ui/Pill";
import { cn } from "@/lib/cn";

interface Props {
  data: ListingResponse;
  onConfirm: () => void;
  onReset: () => void;
}

export function StepConfirm({ data, onConfirm, onReset }: Props): JSX.Element {
  const { surfaceMetadata, highlights, trackViewUrl, capabilities } = data;

  return (
    <div className="w-full max-w-xl flex flex-col items-center gap-6">
      <header className="flex flex-col items-center text-center gap-2 max-w-md">
        <h2 className="text-[26px] sm:text-[28px] font-semibold tracking-tight leading-tight">
          Is this the app you want audited?
        </h2>
        <p className="text-[14px] text-ink-soft">
          We pulled surface metadata{capabilities.firecrawl ? " + scraped the live page" : ""}.
        </p>
      </header>

      <div
        className={cn(
          "w-full rounded-3xl border border-border bg-surface",
          "p-5 sm:p-6 flex flex-col gap-5"
        )}
      >
        <div className="flex items-start gap-4">
          {surfaceMetadata.iconUrl ? (
            <img
              src={surfaceMetadata.iconUrl}
              alt=""
              className="h-20 w-20 rounded-[1.25rem] border border-border bg-elevated"
            />
          ) : (
            <div className="h-20 w-20 rounded-[1.25rem] border border-border bg-elevated" />
          )}
          <div className="min-w-0 flex-1 flex flex-col gap-1.5">
            <h3 className="text-[18px] font-semibold leading-tight tracking-tight truncate">
              {surfaceMetadata.appName}
            </h3>
            {highlights.subtitle ? (
              <p className="text-[14px] text-ink-soft">{highlights.subtitle}</p>
            ) : null}
            <p className="text-[14px] text-muted truncate">{surfaceMetadata.developer}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Pill>{surfaceMetadata.category}</Pill>
              <Pill>{surfaceMetadata.country}</Pill>
              <Pill tone="mono">#{surfaceMetadata.appId}</Pill>
              {highlights.formattedPrice ? <Pill>{highlights.formattedPrice}</Pill> : null}
              {highlights.contentAdvisoryRating ? <Pill>{highlights.contentAdvisoryRating}</Pill> : null}
            </div>
          </div>
        </div>

        {(typeof highlights.averageUserRating === "number" ||
          highlights.promotionalText ||
          highlights.whatsNew) && (
          <div className="grid gap-3 sm:grid-cols-2 border-t border-border pt-4">
            {typeof highlights.averageUserRating === "number" && (
              <Stat
                icon={<Star className="h-3.5 w-3.5 text-warning" />}
                label="Average rating"
                value={`${highlights.averageUserRating.toFixed(2)}★`}
                sub={
                  highlights.userRatingCount
                    ? `${formatCount(highlights.userRatingCount)} ratings`
                    : undefined
                }
              />
            )}
            {highlights.version && (
              <Stat
                icon={<Zap className="h-3.5 w-3.5 text-ink-soft" />}
                label="Latest version"
                value={highlights.version}
                sub={
                  highlights.currentVersionReleaseDate
                    ? formatRelativeDate(highlights.currentVersionReleaseDate)
                    : undefined
                }
              />
            )}
            {highlights.promotionalText && (
              <KeyExcerpt label="Promotional text" value={highlights.promotionalText} />
            )}
            {highlights.whatsNew && (
              <KeyExcerpt label="What's new" value={cleanWhatsNew(highlights.whatsNew)} />
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <a
            href={trackViewUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[12px] text-muted hover:text-ink-soft"
          >
            View on App Store <ExternalLink className="h-3 w-3" />
          </a>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              type="button"
              onClick={onReset}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface",
                "px-3 h-9 text-[13px] text-ink-soft hover:text-ink hover:bg-elevated transition-colors"
              )}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Try another
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg bg-logo px-4 h-9 text-[13px] font-medium",
                "text-[rgb(23_23_25)] hover:bg-logo/88 active:bg-logo/70 transition-colors"
              )}
            >
              <Check className="h-3.5 w-3.5" />
              Run full audit
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="text-[12px] text-muted flex items-center gap-2">
        <span
          className={cn(
            "inline-block h-1.5 w-1.5 rounded-full",
            capabilities.llm ? "bg-success" : "bg-muted"
          )}
        />
        Audit will {capabilities.llm ? "use" : "skip"} LLM refinement
        {capabilities.firecrawl ? " + Firecrawl enrichment" : ""}.
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  sub
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string | undefined;
}): JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-elevated px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[12px] uppercase tracking-widest text-muted">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-[16px] font-semibold tracking-tight">{value}</div>
      {sub ? <div className="text-[12px] text-muted">{sub}</div> : null}
    </div>
  );
}

function KeyExcerpt({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-elevated px-3 py-2.5 sm:col-span-2">
      <div className="text-[12px] uppercase tracking-widest text-muted">{label}</div>
      <p className="mt-1 text-[13px] text-ink-soft line-clamp-3">{value}</p>
    </div>
  );
}

function formatCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

function formatRelativeDate(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function cleanWhatsNew(raw: string): string {
  return raw
    .replace(/^#\s.*$/m, "")
    .replace(/[-•*]\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
