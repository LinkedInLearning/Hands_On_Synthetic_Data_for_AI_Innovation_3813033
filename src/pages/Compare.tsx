import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useScenarios } from "@/lib/store";
import { AlertTriangle } from "lucide-react";
import { computeResults, fmt, formatIrr, formatPayback, formatRoi } from "@/lib/calc";

export default function Compare() {
  const { scenarios } = useScenarios();
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 3 ? [...prev, id] : prev,
    );
  };

  const compared = selected
    .map((id) => scenarios.find((s) => s.id === id))
    .filter(Boolean)
    .map((s) => ({ s: s!, r: computeResults(s!) }));

  // Fix 4.4 — a mixed selection was compared line for line with no warning.
  const currencies = new Set(compared.map(({ s }) => s.currency));
  const horizons = new Set(compared.map(({ s }) => s.horizonYears));
  const mismatched = compared.length > 1 && (currencies.size > 1 || horizons.size > 1);

  const rows: { label: string; get: (r: ReturnType<typeof computeResults>, cur: string) => string }[] = [
    { label: "ROI", get: (r) => formatRoi(r.roi) },
    { label: "Payback", get: (r) => formatPayback(r.paybackMonths, r.paybackBeyondHorizon) },
    { label: "Net benefit", get: (r, c) => fmt.short(r.netBenefit, c) },
    { label: "Total value", get: (r, c) => fmt.short(r.totalBenefit, c) },
    { label: "Total cost of ownership", get: (r, c) => fmt.short(r.totalCost, c) },
    { label: "NPV", get: (r, c) => fmt.short(r.npv, c) },
    { label: "IRR", get: (r) => formatIrr(r.irr, r.irrUnbounded) },
    { label: "Annual value at maturity", get: (r, c) => fmt.short(r.annualBenefitAtMaturity, c) },
  ];


  return (
    <div className="container max-w-7xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Compare scenarios</h1>
        <p className="mt-1 text-sm text-muted-foreground">Select up to 3 scenarios to compare side-by-side.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select scenarios</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          {scenarios.length === 0 && (
            <p className="text-sm text-muted-foreground">No scenarios yet.</p>
          )}
          {scenarios.map((s) => (
            <label
              key={s.id}
              className="flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors hover:bg-secondary/50"
            >
              <Checkbox
                checked={selected.includes(s.id)}
                onCheckedChange={() => toggle(s.id)}
                disabled={!selected.includes(s.id) && selected.length >= 3}
              />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{s.name}</div>
                <div className="truncate text-xs text-muted-foreground">{s.organization}</div>
              </div>
            </label>
          ))}
        </CardContent>
      </Card>

      {mismatched && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/15 px-4 py-3 text-xs"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p>
            <span className="font-semibold">These scenarios are not directly comparable.</span>{" "}
            {currencies.size > 1 && `They use different currencies (${[...currencies].join(", ")}) and no conversion is applied. `}
            {horizons.size > 1 && `They cover different horizons (${[...horizons].sort().map((h) => `${h}y`).join(", ")}), so totals span different periods. `}
            Compare ROI and payback rather than the absolute totals.
          </p>
        </div>
      )}

      {compared.length > 0 && (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-secondary/40">
                  <th className="px-4 py-3 text-left font-semibold">Metric</th>
                  {compared.map(({ s }) => (
                    <th key={s.id} className="px-4 py-3 text-right font-semibold">
                      <div>{s.name}</div>
                      <div className="text-xs font-normal text-muted-foreground">{s.organization}</div>
                      <div className="mt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        {s.currency} · {s.horizonYears}-year
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const values = compared.map(({ s, r }) => row.get(r, s.currency));
                  return (
                    <tr key={row.label} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium text-muted-foreground">{row.label}</td>
                      {values.map((v, i) => (
                        <td key={i} className="px-4 py-3 text-right font-semibold tabular-nums">
                          {v}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
