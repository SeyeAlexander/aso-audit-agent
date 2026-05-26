import { DIMENSION_LABELS, DIMENSION_WEIGHTS, type AsoAudit, type SurfaceMetadata } from "@/lib/types";
import { OverallScoreRing } from "./OverallScoreRing";
import { cn } from "@/lib/cn";

interface Props {
  audit: AsoAudit;
  metadata: SurfaceMetadata;
  usedLlmRefinement: boolean;
}

export function ScoreCard({ audit, metadata, usedLlmRefinement }: Props): JSX.Element {
  return (
    <section className="w-full rounded-2xl border border-border bg-panel shadow-panel">
      <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
        <div className="flex items-center gap-3 min-w-0">
          {metadata.iconUrl ? (
            <img
              src={metadata.iconUrl}
              alt=""
              className="h-10 w-10 rounded-xl border border-border bg-elevated"
            />
          ) : null}
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">{audit.appName}</h2>
            <p className="truncate text-xs text-muted">
              {metadata.category} · {metadata.country}
            </p>
          </div>
        </div>
        <span
          className={cn(
            "rounded-md border px-2 py-0.5 text-[10px] uppercase tracking-widest",
            usedLlmRefinement
              ? "border-accent/40 text-accent bg-accent/5"
              : "border-border text-muted"
          )}
        >
          {usedLlmRefinement ? "LLM refined" : "Deterministic"}
        </span>
      </header>

      <div className="grid gap-6 px-5 py-6 md:grid-cols-[auto_1fr] md:items-center">
        <div className="flex items-center justify-center md:justify-start">
          <OverallScoreRing score={audit.overallScore} />
        </div>

        <ul className="flex flex-col gap-3">
          {audit.scoreCard.map((row) => (
            <li key={row.dimension} className="grid grid-cols-[140px_1fr_auto] items-center gap-3">
              <div className="flex flex-col">
                <span className="text-sm">{DIMENSION_LABELS[row.dimension]}</span>
                <span className="text-[10px] uppercase tracking-widest text-muted">
                  {DIMENSION_WEIGHTS[row.dimension]}% weight
                </span>
              </div>
              <ScoreBar value={row.score} />
              <span className="text-mono text-sm tabular-nums text-ink/90 w-12 text-right">
                {row.score.toFixed(1)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ScoreBar({ value }: { value: number }): JSX.Element {
  const pct = Math.max(0, Math.min(100, value * 10));
  return (
    <div className="relative h-2 rounded-full bg-elevated overflow-hidden">
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-accent"
        style={{ width: `${pct}%`, transition: "width 700ms ease" }}
      />
    </div>
  );
}
