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
          stroke="#26282C"
          strokeWidth={thickness}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#B5FF6B"
          strokeWidth={thickness}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 700ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-mono text-3xl font-semibold text-ink">{Math.round(clamped)}</span>
        <span className={cn("text-xs uppercase tracking-widest", grade.tone)}>{grade.label}</span>
      </div>
    </div>
  );
}

function scoreGrade(score: number): { label: string; tone: string } {
  if (score >= 80) return { label: "Strong", tone: "text-accent" };
  if (score >= 60) return { label: "Solid", tone: "text-accent/80" };
  if (score >= 40) return { label: "Mixed", tone: "text-warning" };
  return { label: "Weak", tone: "text-danger" };
}
