import { cn } from "@/lib/utils";

interface DealScoreGaugeProps {
  score: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function DealScoreGauge({ score, size = "md", className }: DealScoreGaugeProps) {
  const clampedScore = Math.max(-100, Math.min(100, score));
  const normalized = (clampedScore + 100) / 200; // 0 to 1
  const angle = -90 + normalized * 180; // -90 to 90 degrees
  const circumference = Math.PI * 80; // half circle
  const offset = circumference * (1 - normalized);

  const sizeMap = { sm: 100, md: 180, lg: 260 };
  const w = sizeMap[size];

  const getColor = () => {
    if (clampedScore > 30) return "hsl(var(--deal-green))";
    if (clampedScore > -30) return "hsl(var(--deal-amber))";
    return "hsl(var(--deal-red))";
  };

  const getLabel = () => {
    if (clampedScore > 30) return "Great Deal";
    if (clampedScore > 0) return "Fair Deal";
    if (clampedScore > -30) return "Above Market";
    return "Overpriced";
  };

  return (
    <div className={cn("flex flex-col items-center relative", className)}>
      <svg viewBox="0 0 200 120" width={w} className="overflow-visible filter drop-shadow-[0_0_12px_rgba(0,0,0,0.5)]">
        {/* Background track */}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth="10"
          strokeLinecap="round"
          className="opacity-50"
        />
        {/* Glowing Score Arc */}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke={getColor()}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke,stroke-dashoffset,filter,opacity] duration-1000"
          style={{
            filter: `drop-shadow(0 0 8px ${getColor()})`,
            transitionTimingFunction: "cubic-bezier(0.22,1,0.36,1)",
          }}
        />
        
        {/* Modern Needle Hub */}
        <circle cx="100" cy="100" r="6" fill={getColor()} className="transition-colors duration-700" style={{ filter: `drop-shadow(0 0 6px ${getColor()})` }} />
        <circle cx="100" cy="100" r="3" fill="hsl(var(--background))" />
        
        {/* Needle Line */}
        <line
          x1="100"
          y1="100"
          x2={100 + 64 * Math.cos((angle * Math.PI) / 180)}
          y2={100 + 64 * Math.sin((angle * Math.PI) / 180)}
          stroke={getColor()}
          strokeWidth="3"
          strokeLinecap="round"
          className="transition-[stroke,filter,opacity] duration-1000"
          style={{
            filter: `drop-shadow(0 0 4px ${getColor()})`,
            transitionTimingFunction: "cubic-bezier(0.22,1,0.36,1)",
          }}
        />
        
        {/* Score Readout */}
        <text 
          x="100" 
          y="85" 
          textAnchor="middle" 
          fill={getColor()} 
          fontSize={size === "sm" ? "24" : "32"} 
          fontFamily="Geist Mono"
          fontWeight="700"
          letterSpacing="0"
          style={{ filter: `drop-shadow(0 0 12px ${getColor()})` }}
        >
          {clampedScore > 0 ? "+" : ""}{clampedScore}
        </text>
      </svg>
      {size !== "sm" && (
        <span className="mt-2 font-tech text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: getColor() }}>{getLabel()}</span>
      )}
    </div>
  );
}
