import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  CONFIDENCE_WEIGHTS,
  DEFAULT_MONTHS_TO_MATURITY,
  type Confidence,
  type Scenario,
} from "./defaults";

export const SETTINGS_STORAGE_KEY = "ydata-global-settings";

/**
 * Global modeling assumptions. These used to live on every scenario; they are
 * now app-wide and mirrored down onto each scenario so the calculation engine,
 * exports and comparison views keep reading them off the scenario object.
 */
export interface GlobalSettings {
  currency: Scenario["currency"];
  horizonYears: Scenario["horizonYears"];
  timeToValueMonths: number;
  monthsToMaturity: number;
  discountRate: number;
  adoptionRate: number;
  confidenceWeights: Record<Confidence, number>;
}

export const DEFAULT_SETTINGS: GlobalSettings = {
  currency: "USD",
  horizonYears: 3,
  timeToValueMonths: 3,
  monthsToMaturity: DEFAULT_MONTHS_TO_MATURITY,
  discountRate: 0.1,
  adoptionRate: 0.7,
  confidenceWeights: { ...CONFIDENCE_WEIGHTS },
};

interface SettingsState extends GlobalSettings {
  update: (patch: Partial<GlobalSettings>) => void;
  reset: () => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      update: (patch) => set((s) => ({ ...s, ...patch })),
      reset: () => set({ ...DEFAULT_SETTINGS }),
    }),
    {
      name: SETTINGS_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

/** The plain settings values, without the store actions. */
export function settingsPatch(s: GlobalSettings): Partial<Scenario> {
  return {
    currency: s.currency,
    horizonYears: s.horizonYears,
    timeToValueMonths: s.timeToValueMonths,
    monthsToMaturity: s.monthsToMaturity,
    discountRate: s.discountRate,
    adoptionRate: s.adoptionRate,
    confidenceWeights: { ...s.confidenceWeights },
  };
}
