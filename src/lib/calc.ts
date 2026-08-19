import {
  annualValueOf,
  confidenceWeightsOf,
  DEFAULT_MONTHS_TO_MATURITY,
  VALUE_DIMENSIONS,
  DIMENSION_LABEL,
  type Scenario,
  type ValueDimension,
} from "./defaults";

export interface YearLine {
  year: number; // 0 = initial investment, 1..N = year N
  benefits: number;
  platformCost: number;
  implementationCost: number;
  runCost: number;
  net: number;
  cumulative: number;
}

export interface Results {
  grossAnnualBenefit: number;
  riskAdjustedAnnualBenefit: number;
  adoptedAnnualBenefit: number;
  annualBenefitAtMaturity: number;
  benefitsByDimension: { name: string; label: string; value: number }[];

  platformAnnual: number;
  implementationOneOff: number;
  runAnnual: number;
  totalAnnualCost: number;
  totalCost: number;

  totalBenefit: number;
  netBenefit: number;
  /** null when there is no cost to divide by — an undefined ROI, not a zero one. (Fix 1.5) */
  roi: number | null;
  paybackMonths: number | null;
  /** True when the case never repays inside the horizon (as opposed to repaying instantly). */
  paybackBeyondHorizon: boolean;
  npv: number;
  irr: number | null;
  /** True when the IRR is real but too large to state meaningfully. (Fix 1.4) */
  irrUnbounded: boolean;

  cashflow: YearLine[];
}

/** Sub-year integration steps, shared by the annual and monthly paths so the
 *  cash-flow table and the payback figure can never disagree. (Fix 2.6) */
const STEPS_PER_YEAR = 120;

/** Year-0 outflow below which an IRR is arithmetically valid but meaningless. */
const MIN_MEANINGFUL_INVESTMENT = 1_000;

/* ---------------------------------------------------------------- ramp */

/**
 * Share of run-rate value available after `liveYears` of being live.
 *
 * A continuous linear ramp from go-live to full maturity. The previous version
 * was a three-step function with a `horizon === 1` special case that returned
 * full value immediately, which made year one worth 67% more in a 1-year
 * scenario than in an identical 3-year one. (Fix 1.3)
 */
export function maturityAt(liveYears: number, monthsToMaturity = DEFAULT_MONTHS_TO_MATURITY): number {
  if (liveYears <= 0) return 0;
  const rampYears = Math.max(0, monthsToMaturity) / 12;
  if (rampYears === 0) return 1;
  return Math.min(1, liveYears / rampYears);
}

/** Average maturity across each year of the horizon. Index 0 is always 0. */
export function rampFactors(
  horizon: number,
  timeToValueMonths: number,
  monthsToMaturity = DEFAULT_MONTHS_TO_MATURITY,
): number[] {
  const delayYears = Math.max(0, timeToValueMonths) / 12;
  const factors: number[] = [0];
  for (let y = 1; y <= horizon; y++) {
    let acc = 0;
    for (let k = 0; k < STEPS_PER_YEAR; k++) {
      const t = y - 1 + (k + 0.5) / STEPS_PER_YEAR;
      acc += maturityAt(t - delayYears, monthsToMaturity) / STEPS_PER_YEAR;
    }
    factors.push(acc);
  }
  return factors;
}

/* ----------------------------------------------------------------- IRR */

const IRR_HUGE = 10; // 1000%

/**
 * IRR by bracketing then bisection. The bracket expands geometrically instead
 * of stopping at 1000%, so a small-investment scenario no longer reports "n/a"
 * beside a healthy ROI. (Fix 1.4)
 */
function irrOf(cashflows: number[]): { irr: number | null; unbounded: boolean } {
  if (!cashflows.some((c) => c > 0) || !cashflows.some((c) => c < 0)) {
    return { irr: null, unbounded: false };
  }
  const npv = (r: number) => cashflows.reduce((s, cf, i) => s + cf / Math.pow(1 + r, i), 0);

  let low = -0.9999;
  let npvLow = npv(low);
  let high = low;
  let bracketed = false;

  const probes: number[] = [];
  for (let r = -0.9; r <= IRR_HUGE; r += 0.05) probes.push(r);
  for (let r = IRR_HUGE * 2; r <= 1e6; r *= 4) probes.push(r);

  for (const r of probes) {
    const v = npv(r);
    if (npvLow * v <= 0) { high = r; bracketed = true; break; }
    low = r;
    npvLow = v;
  }
  if (!bracketed) return { irr: null, unbounded: false };

  for (let i = 0; i < 200; i++) {
    const mid = (low + high) / 2;
    const v = npv(mid);
    if (v === 0) return { irr: mid, unbounded: mid > IRR_HUGE };
    if (npvLow * v < 0) high = mid;
    else { low = mid; npvLow = v; }
  }
  const irr = (low + high) / 2;
  return { irr, unbounded: irr > IRR_HUGE };
}

/* ------------------------------------------------------------- payback */

function monthlyPayback(
  implementationOneOff: number,
  annualBenefitAtMaturity: number,
  annualCost: number,
  horizon: number,
  timeToValueMonths: number,
  monthsToMaturity: number,
): number | null {
  let cum = -implementationOneOff;
  if (cum >= 0 && annualBenefitAtMaturity >= annualCost) return 0;
  const delayYears = Math.max(0, timeToValueMonths) / 12;
  const SUB = STEPS_PER_YEAR / 12;

  for (let m = 1; m <= horizon * 12; m++) {
    let benefit = 0;
    for (let k = 0; k < SUB; k++) {
      const t = (m - 1 + (k + 0.5) / SUB) / 12;
      benefit += (annualBenefitAtMaturity * maturityAt(t - delayYears, monthsToMaturity)) / SUB;
    }
    const net = (benefit - annualCost) / 12;
    const prev = cum;
    cum += net;
    if (prev < 0 && cum >= 0 && net > 0) return m - 1 + -prev / net;
  }
  return null;
}

/* ------------------------------------------------------------- results */

export function computeResults(s: Scenario): Results {
  const enabled = s.useCases.filter((u) => u.enabled);
  const weights = confidenceWeightsOf(s);
  const monthsToMaturity = s.monthsToMaturity ?? DEFAULT_MONTHS_TO_MATURITY;

  const grossAnnualBenefit = enabled.reduce((sum, u) => sum + annualValueOf(u), 0);
  const riskAdjustedAnnualBenefit = enabled.reduce(
    (sum, u) => sum + annualValueOf(u) * weights[u.confidence],
    0,
  );
  const adoptedAnnualBenefit = riskAdjustedAnnualBenefit * s.adoptionRate;
  const annualBenefitAtMaturity = adoptedAnnualBenefit;

  const byDim = new Map<ValueDimension, number>();
  for (const u of enabled) {
    byDim.set(
      u.category,
      (byDim.get(u.category) ?? 0) + annualValueOf(u) * weights[u.confidence] * s.adoptionRate,
    );
  }
  const benefitsByDimension = VALUE_DIMENSIONS.map((d) => ({
    name: d,
    label: DIMENSION_LABEL[d],
    value: byDim.get(d) ?? 0,
  })).filter((d) => d.value > 0);

  const platformAnnual = s.ydataLicense + s.ydataSupport + s.ydataInfra;
  const internalImplementation = s.internalRoles.reduce((sum, r) => sum + r.hourlyRate * r.hours, 0);
  const implementationOneOff = internalImplementation + s.externalServices + s.enablementCost;
  const runAnnual = s.runFte * s.runFteCost + s.changeBudget;
  const totalAnnualCost = platformAnnual + runAnnual;

  const ramp = rampFactors(s.horizonYears, s.timeToValueMonths, monthsToMaturity);
  const cashflow: YearLine[] = [];
  let cumulative = -implementationOneOff;

  cashflow.push({
    year: 0, benefits: 0, platformCost: 0, implementationCost: implementationOneOff,
    runCost: 0, net: -implementationOneOff, cumulative,
  });

  for (let y = 1; y <= s.horizonYears; y++) {
    const benefits = annualBenefitAtMaturity * (ramp[y] ?? 1);
    const net = benefits - platformAnnual - runAnnual;
    cumulative += net;
    cashflow.push({
      year: y, benefits, platformCost: platformAnnual, implementationCost: 0,
      runCost: runAnnual, net, cumulative,
    });
  }

  const totalBenefit = cashflow.reduce((a, l) => a + l.benefits, 0);
  const totalCost = cashflow.reduce((a, l) => a + l.platformCost + l.implementationCost + l.runCost, 0);
  const netBenefit = totalBenefit - totalCost;
  const roi = totalCost > 0 ? netBenefit / totalCost : null;

  const cfs = cashflow.map((l) => l.net);
  const npv = cfs.reduce((acc, cf, i) => acc + cf / Math.pow(1 + s.discountRate, i), 0);

  const paybackMonths = monthlyPayback(
    implementationOneOff, annualBenefitAtMaturity, platformAnnual + runAnnual,
    s.horizonYears, s.timeToValueMonths, monthsToMaturity,
  );

  const { irr, unbounded } =
    implementationOneOff >= MIN_MEANINGFUL_INVESTMENT ? irrOf(cfs) : { irr: null, unbounded: false };

  return {
    grossAnnualBenefit, riskAdjustedAnnualBenefit, adoptedAnnualBenefit, annualBenefitAtMaturity,
    benefitsByDimension, platformAnnual, implementationOneOff, runAnnual, totalAnnualCost,
    totalCost, totalBenefit, netBenefit, roi,
    paybackMonths, paybackBeyondHorizon: paybackMonths === null,
    npv, irr, irrUnbounded: unbounded, cashflow,
  };
}

/* ---------------------------------------------------------- formatting */

/** Locale per currency, so USD renders "$" instead of "US$". (Fix 5.1) */
const LOCALE: Record<string, string> = { EUR: "de-DE", USD: "en-US", GBP: "en-GB" };
const SYMBOL: Record<string, string> = { EUR: "\u20ac", USD: "$", GBP: "\u00a3" };

export const fmt = {
  currency: (v: number, cur = "USD") =>
    new Intl.NumberFormat(LOCALE[cur] ?? "en-US", {
      style: "currency", currency: cur, maximumFractionDigits: 0,
    }).format(v || 0),

  /** Grouped number without a symbol — for inputs and the currency-neutral library. */
  number: (v: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(v || 0),

  /** Compact form. Rolls up at 1000 rather than printing "1000k", and carries a B suffix. */
  short: (v: number, cur = "USD") => {
    const abs = Math.abs(v || 0);
    const sign = v < 0 ? "-" : "";
    const sym = SYMBOL[cur] ?? "$";
    const scale = (n: number, div: number, suffix: string) => {
      const x = n / div;
      return `${sign}${sym}${x.toFixed(x >= 100 ? 0 : 2)}${suffix}`;
    };
    if (abs >= 999.5e6) return scale(abs, 1e9, "B");
    if (abs >= 999.5e3) return scale(abs, 1e6, "M");
    if (abs >= 1e3) return `${sign}${sym}${Math.round(abs / 1e3)}k`;
    return `${sign}${sym}${Math.round(abs)}`;
  },

  pct: (v: number, digits = 1) => `${(v * 100).toFixed(digits)}%`,
};

/** ROI is null when there is no cost to divide by. (Fix 1.5) */
export function formatRoi(roi: number | null): string {
  return roi === null ? "n/a" : fmt.pct(roi);
}

/** IRR is null when undefined, and capped when arithmetically huge. (Fix 1.4) */
export function formatIrr(irr: number | null, unbounded = false): string {
  if (irr === null) return "n/a";
  if (unbounded) return "> 1000%";
  return fmt.pct(irr);
}

/** A null payback means the case never repays inside the horizon — it used to
 *  fall back to "Immediate" whenever net benefit was positive. (Fix 2.6) */
export function formatPayback(months: number | null, beyondHorizon = true): string {
  if (months === null || !isFinite(months)) return beyondHorizon ? "Beyond horizon" : "No payback";
  if (months <= 0) return "Immediate";
  if (months < 1) {
    const days = Math.max(1, Math.round(months * 30));
    return `${days} day${days === 1 ? "" : "s"}`;
  }
  if (months < 11.5) {
    const rounded = months < 3 ? Number(months.toFixed(1)) : Math.round(months);
    return `${rounded} month${rounded === 1 ? "" : "s"}`;
  }
  const total = Math.round(months);
  const years = Math.floor(total / 12);
  const rem = total - years * 12;
  return rem === 0 ? `${years} year${years === 1 ? "" : "s"}` : `${years}y ${rem}mo`;
}
