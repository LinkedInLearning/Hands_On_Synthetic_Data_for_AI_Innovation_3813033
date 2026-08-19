import { describe, it, expect, beforeEach } from "vitest";
import { makeDefaultScenario } from "@/lib/defaults";
import { computeResults } from "@/lib/calc";
import {
  NEUTRAL_OVERRIDES,
  TORNADO_KEYS,
  adoptionClamped,
  applyOverrides,
  tornado,
} from "@/lib/sensitivity";
import { bundleOf, parseBundle, ImportError, EXPORT_FORMAT } from "@/lib/scenarioIo";
import { uuid } from "@/lib/uuid";

/* ------------------------------------------------------------- Fix 1.1 */

describe("1.1 — the migration must not rewrite user-entered figures", () => {
  beforeEach(() => {
    localStorage.clear();
    // Each test needs a fresh module instance so persist re-hydrates.
    void 0;
  });

  it("keeps a value the user typed, and refreshes one they never touched", async () => {
    const base = makeDefaultScenario({ id: "sc-legacy" });
    const legacy = {
      state: {
        scenarios: [{
          ...base,
          useCases: base.useCases.map((u) =>
            u.id === "uc-churn" ? { ...u, annualValue: 250_000, enabled: true } : { ...u, enabled: true },
          ),
          confidenceWeights: { High: 1, Medium: 0.8, Low: 0.4 },
        }],
        activeId: "sc-legacy",
      },
      version: 9,
    };
    localStorage.setItem("ydata-scenarios", JSON.stringify(legacy));

    vi.resetModules();
    const { useScenarios } = await import("@/lib/store");
    await new Promise((r) => setTimeout(r, 30));

    const s = useScenarios.getState().scenarios[0];
    const churn = s.useCases.find((u) => u.id === "uc-churn")!;
    const untouched = s.useCases.find((u) => u.id === "uc-fraud")!;

    // The figure the user typed survives...
    expect(churn.annualValue).toBe(250_000);
    // ...and the placeholder they never touched is still refreshable.
    expect(untouched.annualValue).toBe(1_500_000);
    // Confidence weights are now app-wide settings, so scenarios adopt them.
    expect(s.confidenceWeights.High).toBe(0.9);
    expect(s.confidenceWeights.Low).toBe(0.5);
  });
});

/* ------------------------------------------------------------- Fix 2.1 */

describe("2.1 — tornado drivers must be independent", () => {
  it("excludes adoption, which duplicates benefit realization", () => {
    expect(TORNADO_KEYS).not.toContain("adoption");
    expect(TORNADO_KEYS).toContain("benefit");
    expect(TORNADO_KEYS).toContain("timeToValue");
  });

  it("produces no two drivers with identical swings", () => {
    const rows = tornado(makeDefaultScenario(), NEUTRAL_OVERRIDES);
    const swings = rows.map((r) => Math.round(r.swing));
    expect(new Set(swings).size).toBe(swings.length);
  });

  it("time to value actually moves the answer", () => {
    const row = tornado(makeDefaultScenario(), NEUTRAL_OVERRIDES).find((r) => r.key === "timeToValue");
    expect(row).toBeDefined();
    expect(row!.swing).toBeGreaterThan(0);
  });
});

/* --------------------------------------------------------- Fixes 2.2 / 2.3 */

describe("2.2 / 2.3 — sensitivity mechanics", () => {
  it("reports when the adoption ceiling clipped the request", () => {
    const s = makeDefaultScenario({ adoptionRate: 0.95 });
    expect(adoptionClamped(s, { adoption: 1.2 })).toBe(true);
    expect(adoptionClamped(s, { adoption: 0.8 })).toBe(false);
  });

  it("scales enablement with the implementation slider", () => {
    const s = makeDefaultScenario();
    const doubled = applyOverrides(s, { implementation: 2 });
    expect(doubled.enablementCost).toBe(s.enablementCost * 2);
    expect(doubled.externalServices).toBe(s.externalServices * 2);
    expect(doubled.internalRoles[0].hours).toBe(s.internalRoles[0].hours * 2);
  });

  it("moves total implementation cost by the full multiplier", () => {
    const s = makeDefaultScenario();
    const b = computeResults(s).implementationOneOff;
    const d = computeResults(applyOverrides(s, { implementation: 2 })).implementationOneOff;
    expect(d).toBeCloseTo(b * 2, 6);
  });
});

/* ------------------------------------------------------------- Fix 3.2 */

describe("3.2 — scenarios can leave the browser", () => {
  it("round-trips through a bundle", () => {
    const s = makeDefaultScenario({ name: "Round trip", organization: "Acme" });
    const text = JSON.stringify(bundleOf([s]));
    const back = parseBundle(text);
    expect(back).toHaveLength(1);
    expect(back[0].name).toBe("Round trip");
    expect(computeResults(back[0]).netBenefit).toBeCloseTo(computeResults(s).netBenefit, 6);
  });

  it("accepts a bare scenario and a bare array", () => {
    const s = makeDefaultScenario();
    expect(parseBundle(JSON.stringify(s))).toHaveLength(1);
    expect(parseBundle(JSON.stringify([s, s]))).toHaveLength(2);
  });

  it("rejects junk with a readable message", () => {
    expect(() => parseBundle("not json")).toThrow(ImportError);
    expect(() => parseBundle(JSON.stringify({ hello: "world" }))).toThrow(ImportError);
    expect(() => parseBundle(JSON.stringify({ format: EXPORT_FORMAT, scenarios: [] }))).toThrow(ImportError);
    expect(() => parseBundle(JSON.stringify([{ name: "no use cases" }]))).toThrow(ImportError);
  });
});

/* ------------------------------------------------------------- Fix 3.3 */

describe("3.3 — uuid works without a secure context", () => {
  it("falls back when crypto.randomUUID is absent", () => {
    const original = globalThis.crypto;
    // Simulate a plain-http origin, where randomUUID is undefined.
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: { getRandomValues: original.getRandomValues.bind(original) },
    });
    const id = uuid();
    Object.defineProperty(globalThis, "crypto", { configurable: true, value: original });

    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(uuid()).not.toBe(id);
  });
});
