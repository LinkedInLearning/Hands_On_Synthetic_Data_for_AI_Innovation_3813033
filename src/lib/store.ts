import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  DEFAULT_INTERNAL_ROLES,
  DEFAULT_MONTHS_TO_MATURITY,
  DEFAULT_USE_CASES,
  isUntouchedPlaceholder,
  makeDefaultScenario,
  STARTER_USE_CASE_IDS,
  type Scenario,
  type ValueDimension,
} from "./defaults";
import { useUseCaseLibrary } from "./useCaseLibrary";
import { settingsPatch, useSettings } from "./settings";
import { uuid } from "./uuid";

export const STORAGE_KEY = "ydata-scenarios";
export const SCHEMA_VERSION = 13;

/** True when localStorage is actually writable. Surfaced as a banner. (Fix 3.1) */
export function storageAvailable(): boolean {
  try {
    const k = "__vn_probe__";
    window.localStorage.setItem(k, "1");
    window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

interface ScenarioState {
  scenarios: Scenario[];
  activeId: string | null;
  create: () => string;
  update: (id: string, patch: Partial<Scenario>) => void;
  remove: (id: string) => void;
  duplicate: (id: string) => string | null;
  setActive: (id: string | null) => void;
  getById: (id: string) => Scenario | undefined;
  /** Adds imported scenarios under fresh ids. Returns the new ids. (Fix 3.2) */
  importScenarios: (incoming: Scenario[]) => string[];
  /** Mirrors the app-wide assumptions onto every scenario. */
  applyGlobalSettings: (patch: Partial<Scenario>) => void;
}

function mapDimension(c: string | undefined): ValueDimension {
  if (c === "Productivity" || c === "Risk" || c === "Revenue" || c === "Cost") return c;
  return "Revenue";
}

export const useScenarios = create<ScenarioState>()(
  persist(
    (set, get) => ({
      scenarios: [],
      activeId: null,
      create: () => {
        const libItems = useUseCaseLibrary.getState().items;
        const useCases = structuredClone(libItems).map((u) => ({
          ...u,
          // Library entries the user authored are enabled; built-in starters too.
          enabled: STARTER_USE_CASE_IDS.includes(u.id) || !DEFAULT_USE_CASES.some((d) => d.id === u.id),
        }));
        const s = makeDefaultScenario({ useCases, ...settingsPatch(useSettings.getState()) });


        set((st) => ({ scenarios: [s, ...st.scenarios], activeId: s.id }));
        return s.id;
      },
      update: (id, patch) =>
        set((st) => ({
          scenarios: st.scenarios.map((s) =>
            s.id === id ? { ...s, ...patch, updatedAt: new Date().toISOString() } : s,
          ),
        })),
      remove: (id) =>
        set((st) => ({
          scenarios: st.scenarios.filter((s) => s.id !== id),
          activeId: st.activeId === id ? null : st.activeId,
        })),
      duplicate: (id) => {
        const orig = get().scenarios.find((s) => s.id === id);
        if (!orig) return null;
        const copy: Scenario = {
          ...structuredClone(orig),
          id: uuid(),
          name: `${orig.name} (copy)`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((st) => ({ scenarios: [copy, ...st.scenarios] }));
        return copy.id;
      },
      setActive: (id) => set({ activeId: id }),
      getById: (id) => get().scenarios.find((s) => s.id === id),
      importScenarios: (incoming) => {
        const clean = incoming.map((raw) => {
          const base = makeDefaultScenario({ id: uuid() });
          return {
            ...base,
            ...raw,
            id: uuid(),
            createdAt: raw.createdAt ?? new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as Scenario;
        });
        set((st) => ({ scenarios: [...clean, ...st.scenarios] }));
        return clean.map((s) => s.id);
      },
      applyGlobalSettings: (patch) =>
        set((st) => ({ scenarios: st.scenarios.map((s) => ({ ...s, ...patch })) })),
    }),
    {
      name: STORAGE_KEY,
      version: SCHEMA_VERSION,
      storage: createJSONStorage(() => localStorage),
      /**
       * Rebuilds every persisted scenario on top of the current defaults.
       *
       * The key change from the previous implementation: a use case the user
       * has taken ownership of is never refreshed from the library, and custom
       * confidence weights are merged rather than overwritten. (Fix 1.1)
       */
      migrate: (persisted: unknown, fromVersion: number) => {
        const p = persisted as { scenarios?: Record<string, unknown>[] } | null;
        if (!p) return p;

        const scenarios = (p.scenarios ?? []).map((raw) => {
          const s = raw as Record<string, unknown>;
          const base = makeDefaultScenario({ id: (s.id as string) ?? uuid() });
          const baseRecord = base as unknown as Record<string, unknown>;
          const next: Record<string, unknown> = { ...baseRecord };

          for (const key of Object.keys(base)) {
            const value = s[key];
            if (value === undefined || value === null) continue;
            if (typeof value !== typeof baseRecord[key]) continue;
            next[key] = value;
          }

          if (s.deployment !== "Own cloud") next.ydataInfra = 0;
          if (typeof s.organisation === "string" && !s.organization) next.organization = s.organisation;
          if (s.product === "YData Fabric") next.product = "YData SaaS";
          if (typeof s.monthsToMaturity !== "number") next.monthsToMaturity = DEFAULT_MONTHS_TO_MATURITY;

          // Day rates / days become hourly rates / hours (8h day). Pre-v10 only.
          if (Array.isArray(s.internalRoles) && s.internalRoles.length) {
            next.internalRoles = (s.internalRoles as Record<string, unknown>[]).map((r) => {
              if (typeof r.hourlyRate === "number" && typeof r.hours === "number") return r;
              const dayRate = Number(r.dayRate ?? 0);
              const days = Number(r.days ?? 0);
              return { role: r.role, hourlyRate: Math.round(dayRate / 8), hours: Math.round(days * 8) };
            });
          }

          const useCases = Array.isArray(s.useCases) ? (s.useCases as Record<string, unknown>[]) : [];
          if (useCases.length) {
            next.useCases = useCases.map((u) => {
              const lib = DEFAULT_USE_CASES.find((d) => d.id === u.id);
              const uc = {
                ...u,
                category: mapDimension(u.category as string | undefined),
              } as Record<string, unknown>;

              // Scenarios written before v13 had no userEdited flag. Treat any
              // value that differs from the shipped placeholder as user-owned,
              // so upgrading never silently rewrites a figure someone typed.
              if (fromVersion < 13 && uc.userEdited === undefined) {
                uc.userEdited = !!lib && Number(uc.annualValue) !== lib.annualValue;
              }

              if (isUntouchedPlaceholder(uc as never) && lib) {
                uc.annualValue = lib.annualValue;
              }
              return uc;
            });
          }

          const deployment = s.deployment as string | undefined;
          if (deployment && !["Managed cloud (SaaS)", "Own cloud", "On-premises"].includes(deployment)) {
            next.deployment = base.deployment;
          }
          if (!s.internalRoles || !Array.isArray(s.internalRoles) || s.internalRoles.length === 0) {
            next.internalRoles = structuredClone(DEFAULT_INTERNAL_ROLES);
          }
          // Merge, don't clobber — custom weights used to be wiped here.
          next.confidenceWeights = {
            ...base.confidenceWeights,
            ...((s.confidenceWeights as Record<string, number>) ?? {}),
          };

          return next as unknown as Scenario;
        });
        return { ...p, scenarios };
      },
    },
  ),
);

// Global assumptions are the single source of truth: mirror them onto every
// scenario now and whenever they change, so calc/exports stay unchanged.
useScenarios.getState().applyGlobalSettings(settingsPatch(useSettings.getState()));
useSettings.subscribe((s) => {
  useScenarios.getState().applyGlobalSettings(settingsPatch(s));
});
