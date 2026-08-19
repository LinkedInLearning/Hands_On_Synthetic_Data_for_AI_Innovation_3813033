import { uuid } from "./uuid";

// Internal ROI model for a synthetic-data initiative built on YData.
// Single perspective: the organization running the initiative.
// All currency in the scenario currency; all percentages as decimals (0.10 = 10%).

export type Industry =
  | "Technology, Media & Telecommunications"
  | "Financial Services"
  | "Healthcare & Life Sciences"
  | "Government & Public Sector"
  | "Consumer & Retail"
  | "Industrial Manufacturing"
  | "Energy, Natural Resources & Chemicals"
  | "Asset Management"
  | "Insurance"
  | "Other";

export type Deployment = "Managed cloud (SaaS)" | "Own cloud" | "On-premises";
export type Confidence = "High" | "Medium" | "Low";
export type Product = "YData SDK" | "YData SaaS";

/** The four value dimensions an internal business case can create. */
export type ValueDimension = "Revenue" | "Cost" | "Productivity" | "Risk";
export type UseCaseCategory = ValueDimension; // kept for backwards compatibility

export const VALUE_DIMENSIONS: ValueDimension[] = ["Revenue", "Cost", "Productivity", "Risk"];
export const USE_CASE_CATEGORIES = VALUE_DIMENSIONS;

export const DIMENSION_LABEL: Record<ValueDimension, string> = {
  Revenue: "New revenue",
  Cost: "Cost saving",
  Productivity: "Productivity",
  Risk: "Risk & compliance",
};

// Annual infrastructure baseline cost by product (illustrative).
/** Infra is only carried by the org when it runs the platform in its own cloud. */
export function infraBaseline(product: Product, deployment: Deployment): number {
  return deployment === "Own cloud" ? PRODUCT_INFRA_BASELINE[product] : 0;
}

export const PRODUCT_INFRA_BASELINE: Record<Product, number> = {
  "YData SDK": 12_000,
  "YData SaaS": 60_000,
};

/* ---------------------------------------------------------------- drivers */

export interface RevenueDriver {
  kind: "Revenue";
  incrementalRevenue: number; // annual incremental revenue unlocked
  margin: number; // 0..1 contribution margin
  attribution: number; // 0..1 share attributable to synthetic data
}
export interface CostDriver {
  kind: "Cost";
  currentSpend: number; // annual spend today on the activity
  reduction: number; // 0..1 expected reduction
}
export interface ProductivityDriver {
  kind: "Productivity";
  people: number; // FTEs affected
  loadedCost: number; // fully loaded annual cost per FTE
  timeFreed: number; // 0..1 share of their time freed
  redeployment: number; // 0..1 share of freed time actually redeployed to value work
}
export interface RiskDriver {
  kind: "Risk";
  probability: number; // 0..1 annual probability of the loss event
  impact: number; // financial impact if it happens
  reduction: number; // 0..1 reduction in probability/impact
}

export type ValueDriver = RevenueDriver | CostDriver | ProductivityDriver | RiskDriver;

export function makeDriver(kind: ValueDimension): ValueDriver {
  switch (kind) {
    case "Revenue":
      return { kind, incrementalRevenue: 10_000_000, margin: 0.35, attribution: 0.2 };
    case "Cost":
      return { kind, currentSpend: 5_000_000, reduction: 0.3 };
    case "Productivity":
      return { kind, people: 200, loadedCost: 150_000, timeFreed: 0.1, redeployment: 0.7 };
    case "Risk":
      return { kind, probability: 0.1, impact: 30_000_000, reduction: 0.35 };
  }
}

/** Annual gross value produced by a driver, before confidence weighting. */
export function driverValue(d: ValueDriver): number {
  switch (d.kind) {
    case "Revenue":
      return d.incrementalRevenue * d.margin * d.attribution;
    case "Cost":
      return d.currentSpend * d.reduction;
    case "Productivity":
      return d.people * d.loadedCost * d.timeFreed * d.redeployment;
    case "Risk":
      return d.probability * d.impact * d.reduction;
  }
}

export function driverFormula(d: ValueDriver): string {
  switch (d.kind) {
    case "Revenue":
      return "Incremental revenue × contribution margin × attribution";
    case "Cost":
      return "Current annual spend × % reduction";
    case "Productivity":
      return "FTEs × loaded cost × % time freed × % redeployed";
    case "Risk":
      return "Annual probability × impact × % reduction";
  }
}

/* -------------------------------------------------------------- use cases */

export interface UseCase {
  id: string;
  name: string;
  enabled: boolean;
  category: ValueDimension;
  annualValue: number; // scenario currency / year at maturity (derived from driver when present)
  confidence: Confidence;
  description?: string;
  driver?: ValueDriver; // optional bottom-up estimator
  /**
   * True once the user has typed their own figure into this row. The persist
   * migration refreshes built-in placeholder values, and must never touch a
   * row the user has taken ownership of. (Fix 1.1)
   */
  userEdited?: boolean;
}

/**
 * Annual gross value of a use case, before confidence weighting and adoption.
 *
 * Renamed from `useCaseValue` — a `use*` name makes the React hooks linter
 * treat every call site as a hook. (Fix 6.1)
 */
export function annualValueOf(u: UseCase): number {
  return u.driver ? driverValue(u.driver) : u.annualValue;
}

/** @deprecated Use {@link annualValueOf}. Kept so external callers keep working. */
export const useCaseValue = annualValueOf;

/* ------------------------------------------------------------------ roles */

/** Free text — implementation line items are fully configurable. */
export type InternalRoleName = string;

export interface InternalRole {
  role: InternalRoleName;
  hourlyRate: number; // fully loaded internal hourly cost
  hours: number; // total hours across implementation
}

export const DEFAULT_INTERNAL_ROLES: InternalRole[] = [
  { role: "Product / initiative lead", hourlyRate: 200, hours: 160 },
  { role: "Data engineer", hourlyRate: 170, hours: 240 },
  { role: "Data scientist", hourlyRate: 185, hours: 160 },
  { role: "ML / platform engineer", hourlyRate: 185, hours: 120 },
  { role: "Privacy & compliance", hourlyRate: 150, hours: 60 },
];


/* --------------------------------------------------------------- scenario */

export interface Scenario {
  id: string;
  name: string;
  organization: string;
  businessUnit: string;
  industry: Industry;
  currency: "EUR" | "USD" | "GBP";
  createdAt: string;
  updatedAt: string;

  // Platform
  product: Product;
  deployment: Deployment;

  // Modelling assumptions
  adoptionRate: number; // 0..1 — share of the modeled value actually captured
  timeToValueMonths: number; // delay before benefits start
  /** Months from go-live to full run-rate value. Drives the ramp. (Fix 1.3) */
  monthsToMaturity: number;
  horizonYears: 1 | 3 | 5;
  discountRate: number; // 0..1 — editable in Setup (Fix 2.4)

  // Value
  useCases: UseCase[];
  confidenceWeights: Record<Confidence, number>; // 0..1 weight applied per confidence level

  // Platform costs (annual unless stated)
  ydataLicense: number;
  ydataSupport: number;
  ydataInfra: number;

  // Implementation (one-off)
  internalRoles: InternalRole[];
  externalServices: number; // integrator / vendor professional services
  enablementCost: number; // training, change management

  // Run (annual)
  runFte: number; // internal FTEs to operate the platform
  runFteCost: number; // fully loaded annual cost per FTE
  changeBudget: number; // annual enhancements / new use-case onboarding
}

/** One representative use case per value dimension, on by default. */
export const STARTER_USE_CASE_IDS: string[] = [];

/**
 * Stated basis for the placeholder annual values below: an organization with
 * roughly $1B annual revenue and a ~500-person data & analytics function.
 * They are illustrative starting points, not benchmarks or a YData estimate —
 * replace them with your own figures or use the bottom-up estimator.
 */
export const PLACEHOLDER_BASIS =
  "Illustrative placeholder, sized for a ~$1B-revenue organization with a ~500-person data & analytics function at a ~$150k fully loaded cost per FTE (a ~$75M annual people base). Productivity cases assume single-digit percentages of that base, revenue cases a low-single-digit revenue uplift at ~35% margin with ~20% attribution. Not a benchmark or a YData estimate — replace it with your own figure, or open the estimator to derive it from drivers.";

export const DEFAULT_USE_CASES: UseCase[] = [
  { id: "uc-fraud", name: "Fraud detection", enabled: false, category: "Risk", annualValue: 1_500_000, confidence: "High",
    description: "Detect anomalous transactions and patterns to prevent financial loss." },
  { id: "uc-churn", name: "Customer churn prediction", enabled: false, category: "Revenue", annualValue: 1_400_000, confidence: "Medium",
    description: "Predict at-risk customers to drive retention campaigns." },
  { id: "uc-sales", name: "Sales forecasting", enabled: false, category: "Revenue", annualValue: 600_000, confidence: "Medium",
    description: "Forecast demand and pipeline conversion to optimize planning." },
  { id: "uc-offshore", name: "Offshore / partner analytics", enabled: false, category: "Cost", annualValue: 2_400_000, confidence: "High",
    description: "Use synthetic data so external teams can work without exposing production data." },
  { id: "uc-marketplace", name: "Internal data marketplace", enabled: false, category: "Revenue", annualValue: 500_000, confidence: "Low",
    description: "Exchange privacy-preserving datasets across the organization." },
  { id: "uc-ttm", name: "Faster time-to-market", enabled: false, category: "Productivity", annualValue: 4_200_000, confidence: "High",
    description: "Shorten model development cycles with synthetic data on demand." },
  { id: "uc-dataprep", name: "Reduced data prep effort", enabled: false, category: "Productivity", annualValue: 3_000_000, confidence: "Medium",
    description: "Cut manual data wrangling and access-request overhead." },
  { id: "uc-privacy", name: "Privacy & compliance risk reduction", enabled: false, category: "Risk", annualValue: 1_200_000, confidence: "Medium",
    description: "Lower exposure to GDPR / sector-specific privacy fines." },
  { id: "uc-breach", name: "Reduced data breach exposure", enabled: false, category: "Risk", annualValue: 700_000, confidence: "Low",
    description: "Synthetic substitutes shrink the surface area of sensitive data at rest." },
  { id: "uc-testing", name: "Synthetic data for testing", enabled: false, category: "Cost", annualValue: 1_200_000, confidence: "High",
    description: "Replace masked test data with high-fidelity synthetic equivalents." },
  { id: "uc-accuracy", name: "Improved model accuracy", enabled: false, category: "Revenue", annualValue: 700_000, confidence: "Medium",
    description: "Augment under-represented classes for better downstream performance." },
  { id: "uc-regulatory", name: "Faster regulatory approvals", enabled: false, category: "Revenue", annualValue: 400_000, confidence: "Low",
    description: "Demonstrate privacy-preserving training to accelerate model approvals." },
  { id: "uc-crossborder", name: "Cross-border data sharing", enabled: false, category: "Revenue", annualValue: 900_000, confidence: "Medium",
    description: "Share synthetic datasets across jurisdictions without breaching residency rules." },
];

/** Default months from go-live to full run-rate value. */
export const DEFAULT_MONTHS_TO_MATURITY = 6;

export const CONFIDENCE_WEIGHTS: Record<Confidence, number> = {
  High: 0.9,
  Medium: 0.7,
  Low: 0.5,
};

/** True when a use case still holds an untouched built-in placeholder value. */
export function isUntouchedPlaceholder(u: Pick<UseCase, "id" | "driver" | "userEdited" | "annualValue">): boolean {
  if (u.userEdited || u.driver) return false;
  return DEFAULT_USE_CASES.some((d) => d.id === u.id);
}

/** Confidence weights for a scenario, falling back to the defaults. */
export function confidenceWeightsOf(s: { confidenceWeights?: Record<Confidence, number> }): Record<Confidence, number> {
  const w = s.confidenceWeights;
  if (!w) return CONFIDENCE_WEIGHTS;
  return {
    High: w.High ?? CONFIDENCE_WEIGHTS.High,
    Medium: w.Medium ?? CONFIDENCE_WEIGHTS.Medium,
    Low: w.Low ?? CONFIDENCE_WEIGHTS.Low,
  };
}

export function makeDefaultScenario(overrides: Partial<Scenario> = {}): Scenario {
  const now = new Date().toISOString();
  const product: Product = overrides.product ?? "YData SDK";
  const deployment: Deployment = overrides.deployment ?? "On-premises";
  return {
    id: uuid(),
    name: "New scenario",
    organization: "Our organization",
    businessUnit: "Data & Analytics",
    industry: "Financial Services",
    currency: "USD",
    createdAt: now,
    updatedAt: now,

    product,
    deployment,

    adoptionRate: 0.7,
    timeToValueMonths: 3,
    monthsToMaturity: DEFAULT_MONTHS_TO_MATURITY,
    horizonYears: 3,
    discountRate: 0.1,

    // A new scenario starts with one representative use case per value
    // dimension switched on, so the Results step is meaningful immediately.
    useCases: structuredClone(DEFAULT_USE_CASES).map((u) => ({
      ...u,
      enabled: STARTER_USE_CASE_IDS.includes(u.id),
    })),
    confidenceWeights: { ...CONFIDENCE_WEIGHTS },

    ydataLicense: 200_000,
    ydataSupport: 30_000,
    ydataInfra: infraBaseline(product, deployment),

    internalRoles: structuredClone(DEFAULT_INTERNAL_ROLES),
    externalServices: 0,
    enablementCost: 0,

    runFte: 3,
    runFteCost: 130_000,
    changeBudget: 25_000,

    ...overrides,
  };
}
