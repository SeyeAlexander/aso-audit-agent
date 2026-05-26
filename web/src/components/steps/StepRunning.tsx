import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

interface Props {
  appName: string;
  llm: boolean;
  firecrawl: boolean;
}

interface Stage {
  id: string;
  label: string;
  detail: string;
  estimateMs: number;
}

export function StepRunning({ appName, llm, firecrawl }: Props): JSX.Element {
  const stages: Stage[] = [
    {
      id: "fetch",
      label: "Fetch listing",
      detail: `Apple Lookup${firecrawl ? " + Firecrawl page scrape" : ""}`,
      estimateMs: firecrawl ? 2400 : 700
    },
    { id: "competitors", label: "Find competitors", detail: "Apple Search · same category", estimateMs: 900 },
    { id: "score", label: "Score 10 dimensions", detail: "Deterministic ASO engine", estimateMs: 300 },
    {
      id: "refine",
      label: "Refine audit",
      detail: llm
        ? "ASO strategist · NVIDIA NIM · parallel qualitative + prose pass"
        : "Skipped (no LLM key)",
      estimateMs: llm ? 8000 : 0
    }
  ];

  // We don't have step-level progress from the server, so the indicator
  // advances on a soft timer keyed to the stage's expected duration. This is
  // honest UX: it tells the user what's happening, not lies about progress.
  const [activeIndex, setActiveIndex] = useState(0);
  const [longRunning, setLongRunning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function tick(index: number): void {
      if (cancelled) return;
      const stage = stages[index];
      if (!stage) return;
      if (stage.estimateMs === 0) {
        setActiveIndex(index + 1);
        tick(index + 1);
        return;
      }
      timer = setTimeout(() => {
        if (cancelled) return;
        if (index + 1 < stages.length) {
          setActiveIndex(index + 1);
          tick(index + 1);
        }
      }, stage.estimateMs);
    }

    tick(0);

    // After ~30s past the last stage's expected end, surface a soft "still
    // working" note. Doesn't change behavior — only signals to the user that
    // the wait is unusual but not stuck.
    const expectedTotalMs = stages.reduce((sum, stage) => sum + stage.estimateMs, 0);
    const longRunningTimer = setTimeout(() => {
      if (!cancelled) setLongRunning(true);
    }, expectedTotalMs + 30_000);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      clearTimeout(longRunningTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="w-full max-w-xl flex flex-col items-center gap-6">
      <header className="flex flex-col items-center text-center gap-2">
        <h2 className="text-[24px] sm:text-[28px] font-semibold tracking-tight">{appName}</h2>
        <p className="text-[14px] text-ink-soft">
          The Mastra workflow is running.
        </p>
      </header>

      <ol
        className={cn(
          "w-full rounded-3xl border bg-surface divide-y divide-border transition-colors",
          longRunning ? "border-warning/60" : "border-border"
        )}
      >
        {stages.map((stage, index) => {
          const state =
            stage.estimateMs === 0
              ? "skipped"
              : index < activeIndex
                ? "done"
                : index === activeIndex
                  ? "active"
                  : "pending";
          return (
            <li key={stage.id} className="flex items-center gap-3 px-5 py-3.5">
              <StageIcon state={state} />
              <div className="min-w-0 flex-1">
                <div
                  className={cn(
                    "text-sm",
                    state === "done" && "text-ink",
                    state === "active" && "text-ink",
                    state === "pending" && "text-muted",
                    state === "skipped" && "text-muted line-through"
                  )}
                >
                  {stage.label}
                </div>
                <div className="text-xs text-muted">{stage.detail}</div>
              </div>
            </li>
          );
        })}
      </ol>

      {longRunning ? (
        <p className="text-[12px] text-muted text-center max-w-md">
          Still working — large listings or slow upstreams can stretch this past a minute.
        </p>
      ) : null}
    </div>
  );
}

function StageIcon({ state }: { state: "done" | "active" | "pending" | "skipped" }): JSX.Element {
  if (state === "done") {
    return (
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent-green text-white dark:text-[rgb(23_23_25)]">
        <Check className="h-3 w-3" />
      </span>
    );
  }
  if (state === "active") {
    return (
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-accent-green/60">
        <Loader2 className="h-3 w-3 animate-spin text-accent-green/90" />
      </span>
    );
  }
  if (state === "skipped") {
    return (
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-border" />
    );
  }
  return <span className="inline-block h-5 w-5 rounded-full border border-border" />;
}
