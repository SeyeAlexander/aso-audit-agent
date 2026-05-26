import { Sparkles, ExternalLink } from "lucide-react";
import { DIMENSION_LABELS, DIMENSIONS, type AsoAudit, type CompetitorSummary } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardSubtle } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

interface Props {
  audit: AsoAudit;
  competitors: CompetitorSummary[];
  onAuditUrl: (url: string) => void;
}

export function CompetitorTable({ audit, competitors, onAuditUrl }: Props): JSX.Element {
  const ownScores = Object.fromEntries(audit.scoreCard.map((row) => [row.dimension, row.score]));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Competitor comparison</CardTitle>
        <CardSubtle>Apple Search · same country &amp; category</CardSubtle>
      </CardHeader>

      <div className="overflow-x-auto">
        <table className="w-full text-[14px]">
          <thead className="bg-elevated/40 text-left text-[12px] uppercase tracking-widest text-muted">
            <tr>
              <th className="px-6 py-3 font-medium">Dimension</th>
              <th className="px-3 py-3 font-medium text-ink">{audit.appName}</th>
              {audit.competitors.map((competitor) => (
                <th key={competitor.name} className="px-3 py-3 font-medium">
                  <div className="flex items-center gap-2">
                    <CompetitorIcon name={competitor.name} competitors={competitors} />
                    <span className="truncate max-w-[140px]">{competitor.name}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {DIMENSIONS.map((dimension) => {
              const own = ownScores[dimension];
              return (
                <tr key={dimension}>
                  <td className="px-6 py-2.5 text-muted">{DIMENSION_LABELS[dimension]}</td>
                  <td className="px-3 py-2.5 text-mono tabular-nums">
                    <ScorePill value={own} highlight />
                  </td>
                  {audit.competitors.map((competitor) => (
                    <td key={competitor.name} className="px-3 py-2.5 text-mono tabular-nums">
                      <ScorePill value={competitor.scores[dimension]} compare={own} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="border-t border-border px-4 sm:px-6 py-4 sm:py-5">
        <div className="text-[12px] uppercase tracking-widest text-muted mb-3">
          Run an audit on a competitor
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {competitors.map((competitor) => (
            <CompetitorCard
              key={competitor.name}
              competitor={competitor}
              onAudit={() => onAuditUrl(competitor.url)}
            />
          ))}
        </ul>
      </div>
    </Card>
  );
}

function CompetitorCard({
  competitor,
  onAudit
}: {
  competitor: CompetitorSummary;
  onAudit: () => void;
}): JSX.Element {
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border bg-elevated p-4">
      <div className="flex items-start gap-3 min-w-0">
        {competitor.iconUrl ? (
          <img
            src={competitor.iconUrl}
            alt=""
            className="h-11 w-11 rounded-lg border border-border bg-surface shrink-0"
          />
        ) : (
          <div className="h-11 w-11 rounded-lg bg-surface shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium text-ink leading-tight">
            <span className="truncate inline-block max-w-full" title={competitor.name}>
              {competitor.name}
            </span>
          </p>
          <p className="text-[12px] text-muted mt-0.5">
            {typeof competitor.rating === "number" ? `${competitor.rating.toFixed(1)}★` : "—"}
            {competitor.ratingCount
              ? ` · ${formatCount(competitor.ratingCount)} ratings`
              : ""}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <a
          href={competitor.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[12px] text-muted hover:text-ink-soft"
        >
          App Store <ExternalLink className="h-3 w-3" />
        </a>
        <button
          type="button"
          onClick={onAudit}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface",
            "px-2.5 h-8 text-[12px] text-ink-soft hover:text-ink hover:bg-elevated hover:border-accent-green/50 transition-colors"
          )}
        >
          <Sparkles className="h-3 w-3 text-accent-green/90" />
          Audit this
        </button>
      </div>
    </li>
  );
}

function ScorePill({
  value,
  highlight = false,
  compare
}: {
  value: number | undefined;
  highlight?: boolean | undefined;
  compare?: number | undefined;
}): JSX.Element {
  if (typeof value !== "number") return <span className="text-muted">—</span>;
  const ahead = typeof compare === "number" && compare > value;
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center min-w-[42px]",
        highlight && "font-semibold text-ink",
        !highlight && ahead && "text-muted",
        !highlight && !ahead && "text-ink-soft"
      )}
    >
      {value.toFixed(1)}
    </span>
  );
}

function CompetitorIcon({
  name,
  competitors
}: {
  name: string;
  competitors: CompetitorSummary[];
}): JSX.Element {
  const url = competitors.find((c) => c.name === name)?.iconUrl;
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-border bg-elevated overflow-hidden">
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : null}
    </span>
  );
}

function formatCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}
