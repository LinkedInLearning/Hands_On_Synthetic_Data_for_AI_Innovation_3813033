import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Numeric input used everywhere money or counts are entered. (Fixes 4.1, 4.2)
 *
 * The previous implementation bound `value={number}` directly and pushed
 * `Number(e.target.value) || 0` into the store on every keystroke. Two problems
 * followed:
 *
 *  1. The field could never be empty. Clearing it snapped to 0 and every later
 *     keystroke appended to that zero, so typing 250000 left "0250000" on
 *     screen. React's controlled-input check for type="number" compares
 *     loosely, so "0250000" != 250000 is false and the DOM is never corrected.
 *  2. A focused number input captures the scroll wheel, so scrolling the page
 *     with the cursor over a cost field silently edited it.
 *
 * This version keeps the raw string in local state while focused, commits a
 * number on blur, shows a grouped value when idle, and blurs on wheel.
 */

const GROUPED = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 });

export interface NumberFieldProps {
  label?: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
  suffix?: string;
  hint?: string;
  /** Render grouped ("250,000") when not focused. Off for small counts. */
  group?: boolean;
  className?: string;
  inputClassName?: string;
  ariaLabel?: string;
  id?: string;
}

export function useNumberField({
  value,
  onChange,
  min = 0,
  max,
}: Pick<NumberFieldProps, "value" | "onChange" | "min" | "max">) {
  const [draft, setDraft] = React.useState<string | null>(null);

  const clamp = (v: number) => {
    let out = v;
    if (min !== undefined) out = Math.max(min, out);
    if (max !== undefined) out = Math.min(max, out);
    return out;
  };

  const commit = (raw: string) => {
    setDraft(null);
    if (raw.trim() === "") {
      onChange(clamp(0));
      return;
    }
    const n = Number(raw);
    if (Number.isFinite(n)) onChange(clamp(n));
  };

  return {
    draft,
    isEditing: draft !== null,
    onFocus: () => setDraft(String(value)),
    onInput: (raw: string) => {
      // Keep whatever the user typed, including intermediate states like "0."
      setDraft(raw);
      const n = Number(raw);
      if (raw.trim() !== "" && Number.isFinite(n)) onChange(clamp(n));
    },
    onBlur: (raw: string) => commit(raw),
  };
}

export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  prefix,
  suffix,
  hint,
  group = true,
  className,
  inputClassName,
  ariaLabel,
  id,
}: NumberFieldProps) {
  const field = useNumberField({ value, onChange, min, max });
  const autoId = React.useId();
  const inputId = id ?? autoId;

  const display = field.isEditing
    ? (field.draft as string)
    : group
      ? GROUPED.format(value || 0)
      : String(value ?? 0);

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <Label htmlFor={inputId} className="text-xs font-medium">
          {label}
        </Label>
      )}
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {prefix}
          </span>
        )}
        <Input
          id={inputId}
          // `inputMode` keeps the mobile numeric keypad without the type="number"
          // spinner, wheel capture and browser-specific parsing quirks.
          type="text"
          inputMode="decimal"
          step={step}
          aria-label={ariaLabel ?? label}
          value={display}
          onFocus={field.onFocus}
          onChange={(e) => field.onInput(e.target.value)}
          onBlur={(e) => field.onBlur(e.target.value)}
          onWheel={(e) => e.currentTarget.blur()}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              const delta = (e.key === "ArrowUp" ? 1 : -1) * (e.shiftKey ? step * 10 : step);
              const next = Number(((value || 0) + delta).toFixed(6));
              const clamped = Math.max(min, max === undefined ? next : Math.min(max, next));
              onChange(clamped);
              field.onFocus();
            }
          }}
          className={cn(prefix ? "pl-7" : suffix ? "pr-9" : "", "tabular-nums", inputClassName)}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
