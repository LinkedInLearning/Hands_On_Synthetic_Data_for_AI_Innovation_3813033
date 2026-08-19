import * as React from "react";
import { ChevronDown, ChevronRight, Calculator, Info, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { fmt } from "@/lib/calc";
import {
  CONFIDENCE_WEIGHTS,
  DIMENSION_LABEL,
  VALUE_DIMENSIONS,
  annualValueOf,
  driverFormula,
  driverValue,
  makeDriver,
  PLACEHOLDER_BASIS,
  type Confidence,
  type UseCase,
  type ValueDimension,
} from "@/lib/defaults";
import { NumberField } from "./NumberField";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const CONFIDENCES: Confidence[] = ["High", "Medium", "Low"];

/**
 * Labels are derived from the scenario's own weights rather than hard-coded, so
 * they stay truthful once the weights are editable. (Fix 2.4)
 */
const confidenceLabel = (c: Confidence, w: Record<Confidence, number>) =>
  `${c} (${Math.round(w[c] * 100)}%)`;

interface Props {
  useCase: UseCase;
  currencySymbol: string;
  currency: string;
  weights?: Record<Confidence, number>;
  onChange: (patch: Partial<UseCase>) => void;
  onRemove?: () => void;
}

/** Non-negative numeric field. */
function Num({
  label, value, onChange, prefix, step = 1, max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  step?: number;
  max?: number;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      <NumberField
        ariaLabel={label}
        value={value}
        onChange={onChange}
        max={max}
        step={step}
        prefix={prefix}
        inputClassName={`h-8 text-xs ${prefix ? "pl-6" : ""}`}
      />
    </div>
  );
}

/** Percentage field, bounded 0–100 like every other percentage in the app. */
function Pct({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</Label>
        <span className="text-[11px] font-semibold tabular-nums text-primary">{pct}%</span>
      </div>
      <Slider
        aria-label={label}
        value={[pct]}
        min={0}
        max={100}
        step={1}
        onValueChange={(v) => onChange(v[0] / 100)}
        className="pt-2"
      />
    </div>
  );
}

export function UseCaseRow({ useCase: uc, currencySymbol, currency, weights, onChange, onRemove }: Props) {
  const w = weights ?? CONFIDENCE_WEIGHTS;
  const [open, setOpen] = React.useState(false);
  const value = annualValueOf(uc);
  // Fix 4.3 — switching dimension used to silently discard a populated estimator.
  const [pendingDimension, setPendingDimension] = React.useState<ValueDimension | null>(null);
  const d = uc.driver;

  return (
    <div className="rounded-lg border bg-card">
      <div className="grid items-center gap-3 p-3 md:grid-cols-12 md:pb-7">
        <div className="flex items-center gap-3 md:col-span-4">
          <Switch aria-label={`Include ${uc.name}`} checked={uc.enabled} onCheckedChange={(enabled) => onChange({ enabled })} />
          <Input value={uc.name} aria-label="Use case name" onChange={(e) => onChange({ name: e.target.value })} className="h-9" />
        </div>
        <div className="md:col-span-2">
          <Select
            value={uc.category}
            onValueChange={(v: ValueDimension) => {
              if (uc.driver) setPendingDimension(v);
              else onChange({ category: v });
            }}
          >
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {VALUE_DIMENSIONS.map((c) => <SelectItem key={c} value={c}>{DIMENSION_LABEL[c]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="relative md:col-span-3">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-xs text-muted-foreground">{currencySymbol}</span>
            {d ? (
              <Input
                aria-label="Annual value"
                value={fmt.number(Math.round(value))}
                disabled
                readOnly
                className="h-9 pl-7 pr-9 tabular-nums"
              />
            ) : (
              <NumberField
                ariaLabel="Annual value"
                value={value}
                // Fix 1.1 — taking ownership of a row protects it from the
                // migration's placeholder refresh.
                onChange={(v) => onChange({ annualValue: v, userEdited: true })}
                inputClassName="h-9 pl-7 pr-9"
              />
            )}
            {!d && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="About this placeholder value"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                  {PLACEHOLDER_BASIS}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground md:absolute md:left-0 md:top-full md:mt-1 md:w-full">
            Risk-adjusted {fmt.short(value * w[uc.confidence], currency)}
            {d ? " · from estimator" : ""}
          </p>
        </div>
        <div className="md:col-span-2">
          <Select value={uc.confidence} onValueChange={(v: Confidence) => onChange({ confidence: v })}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CONFIDENCES.map((c) => <SelectItem key={c} value={c}>{confidenceLabel(c, w)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-end gap-1 md:col-span-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen((o) => !o)} title="Value estimator" aria-label="Toggle value estimator" aria-expanded={open}>
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
          {onRemove && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onRemove} aria-label="Remove use case">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {open && (
        <div className="space-y-3 border-t bg-secondary/30 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-medium">
              <Calculator className="h-3.5 w-3.5" /> Bottom-up estimator — {DIMENSION_LABEL[uc.category]}
            </div>
            <Button
              variant={d ? "secondary" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => onChange(d ? { driver: undefined, annualValue: Math.round(value), userEdited: true } : { driver: makeDriver(uc.category) })}
            >
              {d ? "Use a flat annual figure" : "Estimate from drivers"}
            </Button>
          </div>

          {d && (
            <>
              <div className="grid gap-3 md:grid-cols-4">
                {d.kind === "Revenue" && (
                  <>
                    <Num label="Incremental revenue / yr" value={d.incrementalRevenue} prefix={currencySymbol} onChange={(v) => onChange({ driver: { ...d, incrementalRevenue: v } })} />
                    <Pct label="Contribution margin" value={d.margin} onChange={(v) => onChange({ driver: { ...d, margin: v } })} />
                    <Pct label="Attributable to synthetic data" value={d.attribution} onChange={(v) => onChange({ driver: { ...d, attribution: v } })} />
                  </>
                )}
                {d.kind === "Cost" && (
                  <>
                    <Num label="Current annual spend" value={d.currentSpend} prefix={currencySymbol} onChange={(v) => onChange({ driver: { ...d, currentSpend: v } })} />
                    <Pct label="Expected reduction" value={d.reduction} onChange={(v) => onChange({ driver: { ...d, reduction: v } })} />
                  </>
                )}
                {d.kind === "Productivity" && (
                  <>
                    <Num label="People affected (FTE)" value={d.people} onChange={(v) => onChange({ driver: { ...d, people: v } })} />
                    <Num label="Loaded cost / FTE / yr" value={d.loadedCost} prefix={currencySymbol} onChange={(v) => onChange({ driver: { ...d, loadedCost: v } })} />
                    <Pct label="Time freed" value={d.timeFreed} onChange={(v) => onChange({ driver: { ...d, timeFreed: v } })} />
                    <Pct label="Redeployed to value work" value={d.redeployment} onChange={(v) => onChange({ driver: { ...d, redeployment: v } })} />
                  </>
                )}
                {d.kind === "Risk" && (
                  <>
                    <Pct label="Annual probability" value={d.probability} onChange={(v) => onChange({ driver: { ...d, probability: v } })} />
                    <Num label="Impact if it happens" value={d.impact} prefix={currencySymbol} onChange={(v) => onChange({ driver: { ...d, impact: v } })} />
                    <Pct label="Reduction achieved" value={d.reduction} onChange={(v) => onChange({ driver: { ...d, reduction: v } })} />
                  </>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {driverFormula(d)} = <span className="font-semibold text-foreground">{fmt.short(driverValue(d), currency)} / year</span>
              </p>
            </>
          )}

          {!d && (
            <p className="text-[11px] text-muted-foreground">
              Currently using a flat annual figure. Switch to the estimator to derive the value from measurable drivers.
            </p>
          )}
        </div>
      )}

      {/*
        Guard for changing a use case's value driver while an estimator is populated.
        Each driver kind has its own inputs, so switching discards them — ask first.
      */}
      <AlertDialog open={pendingDimension !== null} onOpenChange={(o) => !o && setPendingDimension(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change value driver and reset the estimator?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{uc.name}&rdquo; uses a {DIMENSION_LABEL[uc.category].toLowerCase()} estimator. Each value driver
              has its own inputs, so switching to{" "}
              {pendingDimension ? DIMENSION_LABEL[pendingDimension].toLowerCase() : ""} will clear the figures you
              entered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep as is</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDimension) {
                  onChange({ category: pendingDimension, driver: makeDriver(pendingDimension) });
                }
                setPendingDimension(null);
              }}
            >
              Change value driver
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
