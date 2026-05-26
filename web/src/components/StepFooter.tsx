import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

export type StepId = "paste-url" | "confirm-app" | "running" | "results";

interface Props {
  step: StepId;
}

const ORDER: { id: StepId; label: string }[] = [
  { id: "paste-url", label: "URL" },
  { id: "confirm-app", label: "Confirm" },
  { id: "running", label: "Audit" },
  { id: "results", label: "Results" }
];

/**
 * Transparent step indicator. No background, no buttons, no sticky bar — just a
 * connected dot-and-line strip that tells the user where they are in the flow.
 * Primary CTAs live inside the active step's content (chat input, preview card,
 * results header), so this is purely a wayfinding device.
 */
export function StepFooter({ step }: Props): JSX.Element {
  const activeIndex = ORDER.findIndex((s) => s.id === step);

  return (
    <div className="w-full flex justify-center pb-5 sm:pb-7 pt-2 px-4">
      <ol className="flex items-center gap-0">
        {ORDER.map((entry, index) => {
          const done = index < activeIndex;
          const active = index === activeIndex;
          const last = index === ORDER.length - 1;
          return (
            <li key={entry.id} className="flex items-center">
              <div className="flex flex-col items-center gap-1.5">
                <span
                  className={cn(
                    "inline-flex items-center justify-center text-[12px] font-medium transition-colors",
                    done && "text-ink",
                    active && "text-ink",
                    !done && !active && "text-muted"
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </span>
                <span
                  className={cn(
                    "text-[12px] tabular-nums",
                    (active || done) ? "text-ink-soft" : "text-muted"
                  )}
                >
                  {entry.label}
                </span>
              </div>
              {!last && (
                <span
                  aria-hidden
                  className={cn(
                    "mx-2 sm:mx-4 mb-5 h-px w-10 sm:w-16 rounded-full transition-colors",
                    done
                      ? "bg-logo/55"
                      : active
                        ? "bg-logo/30"
                        : "bg-border"
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
