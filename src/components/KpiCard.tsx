import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import type { ReactNode } from "react";

interface KpiCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "primary" | "accent" | "success" | "warning";
  icon?: ReactNode;
}

const tones = {
  default: "bg-card",
  primary: "bg-gradient-to-br from-primary to-primary-glow text-primary-foreground border-transparent shadow-elegant",
  accent: "bg-gradient-to-br from-accent to-accent/80 text-accent-foreground border-transparent shadow-elegant",
  success: "bg-gradient-to-br from-success to-success/80 text-success-foreground border-transparent",
  warning: "bg-gradient-to-br from-warning to-warning/80 text-warning-foreground border-transparent",
};

export function KpiCard({ label, value, hint, tone = "default", icon }: KpiCardProps) {
  const isLight = tone !== "default";
  return (
    <Card className={cn("p-5 transition-all hover:shadow-elegant", tones[tone])}>
      <div className="flex items-start justify-between gap-3">
        <div className={cn("text-xs font-medium uppercase tracking-wider", isLight ? "opacity-90" : "text-muted-foreground")}>
          {label}
        </div>
        {icon && <div className={cn(isLight ? "opacity-90" : "text-muted-foreground")}>{icon}</div>}
      </div>
      <div className="mt-2 text-2xl font-bold tabular-nums tracking-tight">{value}</div>
      {hint && (
        <div className={cn("mt-1 text-xs", isLight ? "opacity-80" : "text-muted-foreground")}>{hint}</div>
      )}
    </Card>
  );
}
