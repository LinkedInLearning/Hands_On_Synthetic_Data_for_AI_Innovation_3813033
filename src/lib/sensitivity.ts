import { computeResults, type Results } from "./calc";
import { annualValueOf, type Scenario } from "./defaults";

/**
 * Multiplicative overrides applied to a *clone* of a scenario.
 * Nothing here mutates the stored scenario — sensitivity is always exploratory.
 */
export interface SensitivityOverrides {
  benefit: number; // scales every use-case value
  adoption: number; // scales the adoption rate
  timeToValue: number; // scales the go-live delay
  platform: number; // scales license, support and infrastructure
  implementation: number; // scales implementation effort, services AND enablement
  run: number; // scales run FTEs and change budget
}

export const NEUTRAL_OVERRIDES: SensitivityOverrides = {
  benefit: 1,
  adoption: 1,
  timeToValue: 1,
  platform: 1,
  implementation: 1,
  run: 1,
};

/** True when the requested adoption multiplier was clipped by the 100% ceiling. (Fix 2.2) */
export function adoptionClamped(s: Scenario, o: Partial<SensitivityOverrides>): boolean {
  const m = { ...NEUTRAL_OVERRIDES, ...o };
  return s.adoptionRate * m.adoption > 1;
}

export function applyOverrides(s: Scenario, o: Partial<SensitivityOverrides>): Scenario {
  const m = { ...NEUTRAL_OVERRIDES, ...o };
  return {
    ...s,
    adoptionRate: Math.min(1, s.adoptionRate * m.adoption),
    timeToValueMonths: Math.max(0, s.timeToValueMonths * m.timeToValue),
    // Flatten driver-based use cases to plain values so the multiplier applies cleanly.
    useCases: s.useCases.map((u) => ({
      ...u,
      annualValue: annualValueOf(u) * m.benefit,
      driver: undefined,
    })),
    ydataLicense: s.ydataLicense * m.platform,
    ydataSupport: s.ydataSupport * m.platform,
    ydataInfra: s.ydataInfra * m.platform,
    internalRoles: s.internalRoles.map((r) => ({ ...r, hours: r.hours * m.implementation })),
    externalServices: s.externalServices * m.implementation,
    // Enablement is part of implementationOneOff everywhere else in the model,
    // so it has to move with the implementation slider too. (Fix 2.3)
    enablementCost: s.enablementCost * m.implementation,
    runFte: s.runFte * m.run,
    changeBudget: s.changeBudget * m.run,
  };
}

export function resultsWith(s: Scenario, o: Partial<SensitivityOverrides>): Results {
  return computeResults(applyOverrides(s, o));
}

export interface TornadoRow {
  driver: string;
  key: keyof SensitivityOverrides;
  low: number;
  high: number;
  baseline: number;
  swing: number;
}

export const DRIVER_LABELS: Record<keyof SensitivityOverrides, string> = {
  benefit: "Benefit realization",
  adoption: "Adoption rate",
  timeToValue: "Time to value",
  platform: "Platform cost",
  implementation: "Implementation effort",
  run: "Run cost",
};

export const DRIVER_HINTS: Record<keyof SensitivityOverrides, string> = {
  benefit: "Scales every enabled use-case value",
  adoption: "Share of the modeled value actually captured (capped at 100%)",
  timeToValue: "How long before benefits start accruing",
  platform: "License, support and infrastructure",
  implementation: "Internal role hours, external services and enablement",
  run: "Run team and change budget",
};

/**
 * Drivers included in the tornado.
 *
 * `adoption` is deliberately excluded: it multiplies the same product as
 * `benefit`, so the two produced byte-identical swings and always tied at the
 * top of the chart, implying two independent risks where there is one. It
 * remains available as a what-if slider. `timeToValue` replaces it as a
 * genuinely independent driver. (Fix 2.1)
 */
export const TORNADO_KEYS: (keyof SensitivityOverrides)[] = [
  "benefit",
  "timeToValue",
  "platform",
  "implementation",
  "run",
];

/** Vary each driver independently by ±`swing` and measure the impact on net benefit. */
export function tornado(s: Scenario, base: SensitivityOverrides, swing = 0.2): TornadoRow[] {
  const baseline = resultsWith(s, base).netBenefit;
  return TORNADO_KEYS.map((key) => {
    const low = resultsWith(s, { ...base, [key]: base[key] * (1 - swing) }).netBenefit;
    const high = resultsWith(s, { ...base, [key]: base[key] * (1 + swing) }).netBenefit;
    return { driver: DRIVER_LABELS[key], key, low, high, baseline, swing: Math.abs(high - low) };
  })
    .filter((r) => r.swing > 0.5)
    .sort((a, b) => b.swing - a.swing);
}

/**
 * Lowest benefit-realization multiplier at which net benefit turns positive,
 * holding the other overrides fixed. Returns null when unreachable within 0–10x.
 */
export function benefitBreakEven(s: Scenario, base: SensitivityOverrides): number | null {
  const net = (m: number) => resultsWith(s, { ...base, benefit: m }).netBenefit;
  if (net(0) >= 0) return 0;
  const CEILING = 10;
  if (net(CEILING) < 0) return null;
  let lo = 0;
  let hi = CEILING;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (net(mid) >= 0) hi = mid;
    else lo = mid;
  }
  return hi;
}
