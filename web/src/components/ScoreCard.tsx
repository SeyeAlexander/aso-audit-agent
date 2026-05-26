import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  DIMENSION_LABELS,
  DIMENSION_WEIGHTS,
  type AsoAudit,
  type DimensionScore,
  type SurfaceMetadata
} from "@/lib/types";
import { OverallScoreRing } from "./OverallScoreRing";
import { Card, CardHeader, CardTitle, CardSubtle } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { cn } from "@/lib/cn";

interface Props {
  audit: AsoAudit;
  metadata: SurfaceMetadata;
  usedLlmRefinement: boolean;
}

export function ScoreCard({ audit, metadata, usedLlmRefinement }: Props): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3 min-w-0">
          {metadata.iconUrl ? (
            <img
              src={metadata.iconUrl}
              alt=""
              className="h-9 w-9 rounded-md border border-border bg-elevated"
            />
          ) : null}
          <div className="min-w-0">
            <CardTitle className="truncate">Score card</CardTitle>
            <CardSubtle className="truncate">
              {audit.appName} · {metadata.category} · {metadata.country}
            </CardSubtle>
          </div>
        </div>
        <Pill tone={usedLlmRefinement ? "accent" : "default"}>
          {usedLlmRefinement ? "LLM refined" : "Deterministic"}
        </Pill>
      </CardHeader>

      <div className="grid gap-5 sm:gap-6 px-4 sm:px-6 py-5 sm:py-6 md:grid-cols-[auto_1fr] md:items-start">
        <div className="flex items-center justify-center md:justify-start md:pt-2">
          <OverallScoreRing score={audit.overallScore} />
        </div>
        <ul className="flex flex-col gap-1">
          {audit.scoreCard.map((row) => (
            <DimensionRow key={row.dimension} row={row} />
          ))}
        </ul>
      </div>
    </Card>
  );
}

function DimensionRow({ row }: { row: DimensionScore }): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-lg hover:bg-elevated/60 transition-colors">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full grid grid-cols-[110px_1fr_auto] sm:grid-cols-[150px_1fr_auto] items-center gap-3 px-2 py-2.5 text-left"
      >
        <div className="flex flex-col">
          <span className="text-[13px] text-ink">{DIMENSION_LABELS[row.dimension]}</span>
          <span className="text-[12px] uppercase tracking-widest text-muted">
            {DIMENSION_WEIGHTS[row.dimension]}% weight
          </span>
        </div>
        <ScoreBar value={row.score} />
        <span className="flex items-center gap-1.5 text-mono text-[13px] tabular-nums text-ink-soft w-16 text-right justify-end">
          {row.score.toFixed(1)}
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-muted transition-transform duration-150",
              open && "rotate-180"
            )}
          />
        </span>
      </button>
      {open ? (
        <div className="pb-3 pl-3 sm:pl-[162px] pr-3 sm:pr-4 -mt-1">
          <ul className="flex flex-col gap-2 border-l border-logo/35 pl-3 text-[13px] text-ink-soft leading-relaxed">
            {row.evidence.map((line, index) => (
              <li key={index}>
                <span className="text-muted mr-1">·</span>
                {line}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </li>
  );
}

function ScoreBar({ value }: { value: number }): JSX.Element {
  const pct = Math.max(0, Math.min(100, value * 10));
  return (
    <div className="relative h-1.5 rounded-full bg-elevated overflow-hidden">
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-logo"
        style={{ width: `${pct}%`, transition: "width 700ms cubic-bezier(0.4, 0, 0.2, 1)" }}
      />
    </div>
  );
}
