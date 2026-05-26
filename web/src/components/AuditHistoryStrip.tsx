import { X } from "lucide-react";
import { formatRelative, type HistoryEntry } from "@/lib/history";
import { cn } from "@/lib/cn";

interface Props {
  entries: HistoryEntry[];
  onPick: (url: string) => void;
  onRemove: (url: string) => void;
}

export function AuditHistoryStrip({ entries, onPick, onRemove }: Props): JSX.Element | null {
  if (entries.length === 0) return null;
  const visible = entries.slice(0, 3);

  return (
    <div className="w-full flex flex-col items-center gap-3">
      <span className="text-[12px] text-muted">Recent audits</span>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {visible.map((entry) => (
          <HistoryChip
            key={entry.appStoreUrl}
            entry={entry}
            onClick={() => onPick(entry.appStoreUrl)}
            onRemove={() => onRemove(entry.appStoreUrl)}
          />
        ))}
      </div>
    </div>
  );
}

function HistoryChip({
  entry,
  onClick,
  onRemove
}: {
  entry: HistoryEntry;
  onClick: () => void;
  onRemove: () => void;
}): JSX.Element {
  return (
    <div
      className={cn(
        "group flex items-center gap-2.5 rounded-lg border border-border bg-surface",
        "pl-2 pr-1 py-1.5 transition-colors hover:bg-elevated"
      )}
    >
      <button type="button" onClick={onClick} className="flex items-center gap-2 min-w-0">
        {entry.iconUrl ? (
          <img
            src={entry.iconUrl}
            alt=""
            className="h-7 w-7 rounded-md border border-border bg-elevated"
          />
        ) : (
          <div className="h-7 w-7 rounded-md border border-border bg-elevated" />
        )}
        <div className="flex flex-col items-start min-w-0">
          <span className="text-[12px] text-ink truncate max-w-[160px]">{entry.appName}</span>
          <span className="text-[12px] text-muted">
            {Math.round(entry.overallScore)}/100 · {formatRelative(entry.timestamp)}
          </span>
        </div>
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove from history"
        className={cn(
          "ml-1 h-6 w-6 inline-flex items-center justify-center rounded-md",
          "text-muted opacity-0 group-hover:opacity-100 hover:text-ink hover:bg-elevated",
          "transition-opacity"
        )}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
