import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { NumberField } from "@/components/NumberField";
import { useSettings } from "@/lib/settings";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import type { Scenario } from "@/lib/defaults";

function PctSlider({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">{label}</Label>
        <span className="text-xs font-semibold tabular-nums text-primary">{(value * 100).toFixed(0)}%</span>
      </div>
      <Slider
        aria-label={label}
        value={[Math.max(0, Math.min(1, value)) * 100]}
        min={0}
        max={100}
        step={1}
        onValueChange={(v) => onChange(v[0] / 100)}
      />
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function Settings() {
  const settings = useSettings();
  const { update, reset } = settings;

  return (
    <div className="container max-w-4xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Settings</h2>
          <p className="text-sm text-muted-foreground">
            App-wide modeling assumptions. These apply to every scenario.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => {
            reset();
            toast.success("Settings restored to defaults");
          }}
        >
          <RotateCcw className="h-4 w-4" /> Restore defaults
        </Button>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Modeling assumptions</CardTitle>
            <CardDescription>Currency, horizon and the timing of value across every scenario.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Currency</Label>
              <Select
                value={settings.currency}
                onValueChange={(v: Scenario["currency"]) => update({ currency: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EUR">EUR €</SelectItem>
                  <SelectItem value="USD">USD $</SelectItem>
                  <SelectItem value="GBP">GBP £</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Horizon</Label>
              <Select
                value={String(settings.horizonYears)}
                onValueChange={(v) => update({ horizonYears: Number(v) as 1 | 3 | 5 })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 year</SelectItem>
                  <SelectItem value="3">3 years</SelectItem>
                  <SelectItem value="5">5 years</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <NumberField
              label="Time to value (months)"
              value={settings.timeToValueMonths}
              onChange={(v) => update({ timeToValueMonths: v })}
              group={false}
              max={120}
              hint="Delay before benefits start accruing"
            />
            <NumberField
              label="Months to maturity"
              value={settings.monthsToMaturity}
              onChange={(v) => update({ monthsToMaturity: v })}
              group={false}
              max={120}
              hint="Go-live to full run-rate value"
            />
            <NumberField
              label="Discount rate (%)"
              value={Math.round(settings.discountRate * 1000) / 10}
              onChange={(v) => update({ discountRate: Math.min(0.5, v / 100) })}
              step={0.5}
              max={50}
              group={false}
              suffix="%"
              hint="Used for NPV. Your WACC or hurdle rate."
            />
            <PctSlider
              label="Adoption rate"
              value={settings.adoptionRate}
              onChange={(v) => update({ adoptionRate: v })}
              hint="Share of the modeled value the organization actually captures"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Confidence weighting</CardTitle>
            <CardDescription>
              How much of a use case&rsquo;s value survives its confidence level. These weights drive the
              risk-adjusted figure, and the labels on every use-case row.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            {(["High", "Medium", "Low"] as const).map((level) => (
              <PctSlider
                key={level}
                label={`${level} confidence`}
                value={settings.confidenceWeights[level]}
                onChange={(v) =>
                  update({ confidenceWeights: { ...settings.confidenceWeights, [level]: v } })
                }
              />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
