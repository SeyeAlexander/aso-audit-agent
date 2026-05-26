import { useCallback, useEffect, useState } from "react";
import { fetchListing, runAudit } from "./lib/api";
import type { AuditResponse, ListingResponse } from "./lib/types";
import { useAuditHistory } from "./lib/history";
import { TopBar } from "./components/TopBar";
import { StepFooter, type StepId } from "./components/StepFooter";
import { StepInput } from "./components/steps/StepInput";
import { StepConfirm } from "./components/steps/StepConfirm";
import { StepRunning } from "./components/steps/StepRunning";
import { ResultsView } from "./components/ResultsView";
import { AuditHistoryStrip } from "./components/AuditHistoryStrip";

type Stage =
  | { kind: "paste-url"; url: string; loading: boolean; error?: string }
  | { kind: "confirm-app"; url: string; listing: ListingResponse }
  | { kind: "running"; url: string; listing: ListingResponse }
  | { kind: "results"; url: string; audit: AuditResponse };

function stageToStepId(stage: Stage): StepId {
  return stage.kind;
}

export function App(): JSX.Element {
  const [stage, setStage] = useState<Stage>({ kind: "paste-url", url: "", loading: false });
  const { entries, record, getCached, remove } = useAuditHistory();

  const goHome = useCallback((): void => {
    setStage({ kind: "paste-url", url: "", loading: false });
  }, []);

  const submitUrl = useCallback(async (url: string): Promise<void> => {
    setStage({ kind: "paste-url", url, loading: true });
    try {
      const listing = await fetchListing(url);
      setStage({ kind: "confirm-app", url, listing });
    } catch (error) {
      setStage({
        kind: "paste-url",
        url,
        loading: false,
        error: error instanceof Error ? error.message : "Something went wrong."
      });
    }
  }, []);

  // Clicking a "Recent audits" chip re-opens the cached report instantly. If
  // the entry predates audit caching (no stored payload), fall back to a fresh
  // audit so the chip never dead-ends.
  const openFromHistory = useCallback(
    (appStoreUrl: string): void => {
      const cached = getCached(appStoreUrl);
      if (cached) {
        setStage({ kind: "results", url: appStoreUrl, audit: cached });
        return;
      }
      void submitUrl(appStoreUrl);
    },
    [getCached, submitUrl]
  );

  const startAudit = useCallback(async (): Promise<void> => {
    if (stage.kind !== "confirm-app") return;
    const { url, listing } = stage;
    setStage({ kind: "running", url, listing });
    try {
      const audit = await runAudit(url);
      record(audit);
      setStage({ kind: "results", url, audit });
    } catch (error) {
      setStage({
        kind: "paste-url",
        url,
        loading: false,
        error: error instanceof Error ? error.message : "Audit failed."
      });
    }
  }, [stage, record]);

  const resetToInput = useCallback((): void => {
    setStage((current) =>
      current.kind === "paste-url"
        ? current
        : { kind: "paste-url", url: "url" in current ? current.url : "", loading: false }
    );
  }, []);

  // Keep top of page when stage transitions to results.
  useEffect(() => {
    if (stage.kind === "results") {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    }
  }, [stage.kind]);

  return (
    <div className="min-h-full flex flex-col">
      <TopBar onHome={goHome} />

      <main
        className={[
          "flex-1 px-4 sm:px-6 flex flex-col items-center",
          // Only the URL-input screen vertically centers; the rest start from
          // the top so the cards anchor near the masthead and don't shift down
          // as content grows.
          stage.kind === "paste-url"
            ? "py-4 sm:py-6 min-h-[calc(100dvh-7.5rem)] justify-center"
            : "py-6 sm:py-10"
        ].join(" ")}
      >
        {stage.kind === "paste-url" && (
          <StepInput
            initialValue={stage.url}
            onSubmit={submitUrl}
            loading={stage.loading}
            error={stage.error ?? null}
          >
            <AuditHistoryStrip entries={entries} onPick={openFromHistory} onRemove={remove} />
          </StepInput>
        )}

        {stage.kind === "confirm-app" && (
          <StepConfirm data={stage.listing} onConfirm={startAudit} onReset={resetToInput} />
        )}

        {stage.kind === "running" && (
          <StepRunning
            appName={stage.listing.surfaceMetadata.appName}
            llm={stage.listing.capabilities.llm}
            firecrawl={stage.listing.capabilities.firecrawl}
          />
        )}

        {stage.kind === "results" && (
          <ResultsView
            data={stage.audit}
            onAuditUrl={submitUrl}
            onAuditAnother={resetToInput}
          />
        )}
      </main>

      <StepFooter step={stageToStepId(stage)} />
    </div>
  );
}
