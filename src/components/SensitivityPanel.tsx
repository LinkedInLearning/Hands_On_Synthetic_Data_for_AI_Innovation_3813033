import * as React from "react";
import { Bar, BarChart, Cell, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { RotateCcw, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { KpiCard } from "./KpiCard";
import { fmt, formatRoi, type Results } from "@/lib/calc";
import type { Scenario } from "@/lib/defaults";
import {
  DRIVER_HINTS,
  DRIVER_LABELS,
  NEUTRAL_OVERRIDES,
  TORNADO_KEYS,
  adoptionClamped,
  benefitBreakEven,
  resultsWith,
  tornado,
  type SensitivityOverrides,
} from "@/lib/sensitivity";

interface Props {
  scenario: Scenario;
  baseline: Results;
}

// Labels and hints now come from sensitivity.ts so the sliders, the tornado and
// the model can never drift apart. The stale "Internal days" hint is gone —
// the model moved to hours several versions ago. (Fix 2.3)
const DRIVER_KEYS: (keyof SensitivityOverrides)[] = [
  "benefit", "adoption", "timeToValue", "platform", "implementation", "run",
];
const DRIVERS = DRIVER_KEYS.map((key) => ({
  key, label: DRIVER_LABELS[key], hint: DRIVER_HINTS[key],
}));

function Delta({ value, format }: { value: number; format: (v: number) => string }) {
  if (Math.abs(value) < 0.005) return <span className="text-muted-foreground">no change</span>;
  const positive = value > 0;
  return (
    <span className={positive ? "text-success" : "text-destructive"}>
      {positive ? "▲" : "▼"} {format(Math.abs(value))} vs baseline
    </span>
  );
}

export function SensitivityPanel({ scenario, baseline }: Props) {
  const cur = scenario.currency;
  const [overrides, setOverrides] = React.useState<SensitivityOverrides>(NEUTRAL_OVERRIDES);

  const live = React.useMemo(() => resultsWith(scenario, overrides), [scenario, overrides]);
  const rows = React.useMemo(() => tornado(scenario, overrides), [scenario, overrides]);
  const breakEven = React.useMemo(() => benefitBreakEven(scenario, overrides), [scenario, overrides]);

  const dirty = DRIVERS.some((d) => overrides[d.key] !== 1);
  const clamped = adoptionClamped(scenario, overrides);

  const chartData = rows.map((r) => ({
    driver: r.driver,
    low: r.low - r.baseline,
    high: r.high - r.baseline,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Sensitivity analysis</h2>
          <p className="text-xs text-muted-foreground">
            Explore how the business case moves. Nothing here changes your saved scenario.
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" disabled={!dirty} onClick={() => setOverrides(NEUTRAL_OVERRIDES)}>
          <RotateCcw className="h-4 w-4" /> Reset assumptions
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard
          label="ROI"
          value={formatRoi(live.roi)}
          tone="primary"
          hint={<Delta value={(live.roi ?? 0) - (baseline.roi ?? 0)} format={(v) => fmt.pct(v)} />}
        />
        <KpiCard
          label="Net benefit"
          value={fmt.short(live.netBenefit, cur)}
          tone="accent"
          hint={<Delta value={live.netBenefit - baseline.netBenefit} format={(v) => fmt.short(v, cur)} />}
        />
        <KpiCard
          label="Break-even benefit"
          value={breakEven === null ? "Not reachable" : fmt.pct(breakEven)}
          hint="Share of modeled value needed to break even"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">What-if assumptions</CardTitle>
            <CardDescription>Each slider scales the underlying inputs from 50% to 150%.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {DRIVERS.map((d) => (
              <div key={d.key} className="space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium">{d.label}</div>
                    <div className="text-[11px] text-muted-foreground">{d.hint}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold tabular-nums text-primary">
                      {Math.round(overrides[d.key] * 100)}%
                    </div>
                    {d.key === "adoption" && clamped && (
                      <div className="text-[10px] font-medium text-warning">capped at 100%</div>
                    )}
                  </div>
                </div>
                <Slider
                  value={[overrides[d.key] * 100]}
                  min={50}
                  max={150}
                  step={5}
                  onValueChange={(v) => setOverrides((o) => ({ ...o, [d.key]: v[0] / 100 }))}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tornado — impact on net benefit</CardTitle>
            <CardDescription>
              Each driver varied ±20% independently, sorted by swing. Adoption is excluded here because it
              scales the same product as benefit realization — it stays available as a what-if slider above.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
                <Info className="h-4 w-4" /> Add costs and enabled use cases to see driver sensitivity.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={40 + chartData.length * 52}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }} stackOffset="sign">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => fmt.short(Number(v), cur)}
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis
                    type="category"
                    dataKey="driver"
                    width={150}
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <Tooltip
                    formatter={(v: number, name) => [fmt.short(Number(v), cur), name === "low" ? "-20%" : "+20%"]}
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <ReferenceLine x={0} stroke="hsl(var(--foreground))" />
                  <Bar dataKey="low" stackId="a" radius={[2, 2, 2, 2]}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={d.low < 0 ? "hsl(var(--destructive))" : "hsl(var(--success))"} />
                    ))}
                  </Bar>
                  <Bar dataKey="high" stackId="a" radius={[2, 2, 2, 2]}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={d.high < 0 ? "hsl(var(--destructive))" : "hsl(var(--success))"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
