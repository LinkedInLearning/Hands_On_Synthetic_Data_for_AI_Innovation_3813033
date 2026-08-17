import { describe, it, expect } from "vitest";
import { computeResults, rampFactors } from "@/lib/calc";
import { confidenceWeightsOf, makeDefaultScenario, useCaseValue, type Scenario } from "@/lib/defaults";

const s: Scenario = makeDefaultScenario();

describe("value chain", () => {
  it("applies confidence weights then adoption", () => {
    const r = computeResults(s);
    const w = confidenceWeightsOf(s);
    const enabled = s.useCases.filter((u) => u.enabled);
    expect(r.grossAnnualBenefit).toBeCloseTo(enabled.reduce((a, u) => a + useCaseValue(u), 0), 6);
    expect(r.riskAdjustedAnnualBenefit).toBeCloseTo(
      enabled.reduce((a, u) => a + useCaseValue(u) * w[u.confidence], 0),
      6,
    );
    expect(r.adoptedAnnualBenefit).toBeCloseTo(r.riskAdjustedAnnualBenefit * s.adoptionRate, 6);
  });

  it("splits value by dimension without losing any", () => {
    const r = computeResults(s);
    const sum = r.benefitsByDimension.reduce((a, d) => a + d.value, 0);
    expect(sum).toBeCloseTo(r.adoptedAnnualBenefit, 4);
  });
});

describe("ramp", () => {
  it("is zero in year 0 and never exceeds 1", () => {
    for (const [h, d] of [[3, 0], [3, 3], [5, 18], [1, 6]] as const) {
      const f = rampFactors(h, d);
      expect(f[0]).toBe(0);
      expect(f).toHaveLength(h + 1);
      f.forEach((v) => {
        expect(v).toBeGreaterThanOrEqual(-1e-9);
        expect(v).toBeLessThanOrEqual(1 + 1e-9);
      });
    }
  });

  it("pushes value into later years for long delays", () => {
    const f = rampFactors(5, 18);
    expect(f[1]).toBeCloseTo(0, 6);
    expect(f[2]).toBeGreaterThan(0);
    expect(f[5]).toBeCloseTo(1, 3);
  });
});

describe("totals", () => {
  it("reconciles cost of ownership with its components", () => {
    const r = computeResults(s);
    const h = s.horizonYears;
    const impl = s.internalRoles.reduce((a, x) => a + x.hourlyRate * x.hours, 0) + s.externalServices + s.enablementCost;
    const expected = (s.ydataLicense + s.ydataSupport + s.ydataInfra) * h + impl + (s.runFte * s.runFteCost + s.changeBudget) * h;
    expect(r.totalCost).toBeCloseTo(expected, 4);
    expect(r.netBenefit).toBeCloseTo(r.totalBenefit - r.totalCost, 4);
    expect(r.roi).toBeCloseTo(r.netBenefit / r.totalCost, 8);
  });

  it("discounts NPV from year 0 and solves IRR", () => {
    const r = computeResults(s);
    const manual = r.cashflow.reduce((a, l, i) => a + l.net / Math.pow(1 + s.discountRate, i), 0);
    expect(r.npv).toBeCloseTo(manual, 4);
    if (r.irr !== null) {
      const atIrr = r.cashflow.reduce((a, l, i) => a + l.net / Math.pow(1 + r.irr!, i), 0);
      expect(Math.abs(atIrr)).toBeLessThan(1);
    }
  });
});

describe("payback", () => {
  it("never lands before go-live", () => {
    const delayed = computeResults({ ...s, timeToValueMonths: 9 });
    expect(delayed.paybackMonths).not.toBeNull();
    expect(delayed.paybackMonths!).toBeGreaterThanOrEqual(9);
  });

  it("is null when the case never turns positive", () => {
    const bad = computeResults({ ...s, useCases: s.useCases.map((u) => ({ ...u, enabled: false })) });
    expect(bad.paybackMonths).toBeNull();
    expect(bad.netBenefit).toBeLessThan(0);
  });
});
