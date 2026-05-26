import { Check, RotateCcw } from "lucide-react";
import type { SurfaceMetadata } from "@/lib/types";
import { cn } from "@/lib/cn";

interface Props {
  metadata: SurfaceMetadata;
  onConfirm: () => void;
  onReset: () => void;
  confirming: boolean;
}

export function AppPreviewCard({ metadata, onConfirm, onReset, confirming }: Props): JSX.Element {
  return (
    <div
      className={cn(
        "w-full max-w-2xl rounded-2xl border border-border bg-panel shadow-panel",
        "p-5 flex flex-col gap-5"
      )}
    >
      <div className="flex items-center gap-4">
        {metadata.iconUrl ? (
          <img
            src={metadata.iconUrl}
            alt=""
            className="h-16 w-16 rounded-2xl border border-border bg-elevated"
          />
        ) : (
          <div className="h-16 w-16 rounded-2xl border border-border bg-elevated" />
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold text-ink">{metadata.appName}</h2>
          <p className="truncate text-sm text-muted">{metadata.developer}</p>
          <div className="mt-1.5 flex items-center gap-2 text-xs text-muted">
            <Pill>{metadata.category}</Pill>
            <Pill>{metadata.country}</Pill>
            <Pill mono>#{metadata.appId}</Pill>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">Is this the app you want audited?</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onReset}
            disabled={confirming}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2",
              "text-sm text-muted hover:text-ink hover:border-muted/60 transition-colors",
              "disabled:opacity-60"
            )}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Try another
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirming}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-surface",
              "hover:bg-accent-soft disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            )}
          >
            <Check className="h-4 w-4" /> {confirming ? "Running audit..." : "Run audit"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Pill({ children, mono = false }: { children: React.ReactNode; mono?: boolean }): JSX.Element {
  return (
    <span
      className={cn(
        "rounded-md border border-border bg-elevated px-1.5 py-0.5",
        mono && "font-mono tracking-tight"
      )}
    >
      {children}
    </span>
  );
}
