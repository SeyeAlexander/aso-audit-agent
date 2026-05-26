import { cn } from "@/lib/cn";

interface Props {
  score: number;
  size?: number;
  thickness?: number;
}

export function OverallScoreRing({ score, size = 132, thickness = 10 }: Props): JSX.Element {
  const clamped = Math.max(0, Math.min(100, score));
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  const grade = scoreGrade(clamped);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgb(var(--border))"
          strokeWidth={thickness}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgb(var(--logo))"
          strokeWidth={thickness}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 700ms cubic-bezier(0.4, 0, 0.2, 1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-mono text-[34px] font-semibold leading-none tracking-tight text-ink">
          {Math.round(clamped)}
        </span>
        <span className={cn("mt-1 text-[12px] uppercase tracking-[0.18em]", grade.tone)}>
          {grade.label}
        </span>
      </div>
    </div>
  );
}

function scoreGrade(score: number): { label: string; tone: string } {
  if (score >= 80) return { label: "Strong", tone: "text-ink" };
  if (score >= 60) return { label: "Solid", tone: "text-ink-soft" };
  if (score >= 40) return { label: "Mixed", tone: "text-warning" };
  return { label: "Weak", tone: "text-danger-ink" };
}
