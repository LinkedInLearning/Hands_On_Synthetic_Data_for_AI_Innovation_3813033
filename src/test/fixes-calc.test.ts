import { describe, it, expect } from "vitest";
import { computeResults, formatIrr, formatPayback, formatRoi, fmt, maturityAt, rampFactors } from "@/lib/calc";
import { makeDefaultScenario, type Scenario } from "@/lib/defaults";

const base = () => makeDefaultScenario();

/* ------------------------------------------------------------- Fix 1.3 */

describe("1.3 — horizon must not rewrite year one", () => {
  it("gives the same year-1 value at every horizon", () => {
    const s = base();
    const y1 = ([1, 3, 5] as const).map(
      (h) => computeResults({ ...s, horizonYears: h }).cashflow[1].benefits,
    );
    expect(y1[0]).toBeCloseTo(y1[1], 6);
    expect(y1[1]).toBeCloseTo(y1[2], 6);
  });

  it("ramps continuously rather than stepping", () => {
    // No cliff: maturity is monotonic and has no jump at exactly 1 or 2 years.
    const eps = 1e-6;
    for (const t of [0.5, 1, 1.5, 2, 2.5]) {
      expect(maturityAt(t + eps) - maturityAt(t - eps)).toBeLessThan(1e-4);
    }
    expect(maturityAt(0)).toBe(0);
    expect(maturityAt(99)).toBe(1);
  });

  it("respects monthsToMaturity", () => {
    const fast = rampFactors(3, 0, 6);
    const slow = rampFactors(3, 0, 36);
    expect(fast[1]).toBeGreaterThan(slow[1]);
    expect(fast[3]).toBeCloseTo(1, 6);
    expect(slow[3]).toBeLessThan(1);
  });
});

/* ------------------------------------------------------------- Fix 1.4 */

describe("1.4 — IRR beyond the old 1000% ceiling", () => {
  it("returns a value instead of null for a small investment", () => {
    const s = base();
    const tiny: Scenario = {
      ...s,
      horizonYears: 1,
      timeToValueMonths: 0,
      externalServices: 0,
      enablementCost: 0,
      internalRoles: s.internalRoles.map((r) => ({ ...r, hourlyRate: 200, hours: 10 })),
    };
    const r = computeResults(tiny);
    expect(r.irr).not.toBeNull();
    expect(r.irrUnbounded).toBe(true);
    expect(formatIrr(r.irr, r.irrUnbounded)).toBe("> 1000%");
  });

  it("still reports a precise IRR in the normal range", () => {
    const r = computeResults(base());
    expect(r.irr).not.toBeNull();
    expect(r.irrUnbounded).toBe(false);
    const npvAtIrr = r.cashflow.reduce((a, l, i) => a + l.net / Math.pow(1 + r.irr!, i), 0);
    expect(Math.abs(npvAtIrr)).toBeLessThan(1);
  });

  it("suppresses IRR when the upfront investment is trivial", () => {
    const s = base();
    const r = computeResults({
      ...s,
      externalServices: 0,
      enablementCost: 0,
      internalRoles: s.internalRoles.map((x) => ({ ...x, hours: 0 })),
    });
    expect(r.irr).toBeNull();
    expect(formatIrr(r.irr, r.irrUnbounded)).toBe("n/a");
  });
});

/* ------------------------------------------------------------- Fix 1.5 */

describe("1.5 — zero cost is an undefined ROI, not zero", () => {
  it("returns null rather than 0", () => {
    const s = base();
    const free = computeResults({
      ...s,
      ydataLicense: 0,
      ydataSupport: 0,
      ydataInfra: 0,
      externalServices: 0,
      enablementCost: 0,
      changeBudget: 0,
      runFte: 0,
      internalRoles: [],
    });
    expect(free.totalCost).toBe(0);
    expect(free.roi).toBeNull();
    expect(formatRoi(free.roi)).toBe("n/a");
  });

  it("still divides normally when there is a cost", () => {
    const r = computeResults(base());
    expect(r.roi).toBeCloseTo(r.netBenefit / r.totalCost, 8);
  });
});

/* ------------------------------------------------------------- Fix 2.6 */

describe("2.6 — payback never claims Immediate for a case that never repays", () => {
  it("labels an unreachable payback as beyond horizon", () => {
    const s = base();
    const bad = computeResults({ ...s, useCases: s.useCases.map((u) => ({ ...u, enabled: false })) });
    expect(bad.paybackMonths).toBeNull();
    expect(bad.paybackBeyondHorizon).toBe(true);
    expect(formatPayback(bad.paybackMonths, bad.paybackBeyondHorizon)).toBe("Beyond horizon");
  });

  it("never lands before go-live", () => {
    const delayed = computeResults({ ...base(), timeToValueMonths: 9 });
    expect(delayed.paybackMonths).not.toBeNull();
    expect(delayed.paybackMonths!).toBeGreaterThanOrEqual(9);
  });

  it("agrees with the annual cash flow it is derived from", () => {
    const r = computeResults(base());
    const yearOfPayback = Math.ceil(r.paybackMonths! / 12);
    expect(r.cashflow[yearOfPayback].cumulative).toBeGreaterThanOrEqual(0);
    expect(r.cashflow[yearOfPayback - 1].cumulative).toBeLessThan(0);
  });

  it("promotes 12 months to a year", () => {
    expect(formatPayback(11.6)).toBe("1 year");
    expect(formatPayback(1)).toBe("1 month");
    expect(formatPayback(13)).toBe("1y 1mo");
  });
});

/* ----------------------------------------------------- number formatting */

describe("formatting boundaries", () => {
  it("rolls up instead of printing 1000k", () => {
    expect(fmt.short(999_499, "USD")).toBe("$999k");
    expect(fmt.short(999_600, "USD")).toBe("$1.00M");
    expect(fmt.short(1_000_000, "USD")).toBe("$1.00M");
  });

  it("uses a B suffix for billions", () => {
    expect(fmt.short(1_500_000_000, "USD")).toBe("$1.50B");
  });

  it("renders USD as $ rather than US$", () => {
    expect(fmt.currency(1_234_567, "USD")).toContain("$1,234,567");
    expect(fmt.currency(1_234_567, "USD")).not.toContain("US$");
    expect(fmt.currency(1_234_567, "GBP")).toContain("£");
  });
});
