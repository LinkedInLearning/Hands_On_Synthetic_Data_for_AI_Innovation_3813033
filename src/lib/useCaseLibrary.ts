import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_USE_CASES, isUntouchedPlaceholder, type UseCase, type Confidence, type UseCaseCategory } from "./defaults";
import { shortId } from "./uuid";

export type LibraryUseCase = UseCase;

interface UseCaseLibraryState {
  items: LibraryUseCase[];
  add: (uc: Omit<LibraryUseCase, "id">) => string;
  update: (id: string, patch: Partial<LibraryUseCase>) => void;
  remove: (id: string) => void;
  reset: () => void;
}

export const useUseCaseLibrary = create<UseCaseLibraryState>()(
  persist(
    (set) => ({
      items: structuredClone(DEFAULT_USE_CASES),
      add: (uc) => {
        const id = shortId();
        set((st) => ({ items: [{ ...uc, id }, ...st.items] }));
        return id;
      },
      update: (id, patch) =>
        set((st) => ({ items: st.items.map((u) => (u.id === id ? { ...u, ...patch } : u)) })),
      remove: (id) => set((st) => ({ items: st.items.filter((u) => u.id !== id) })),
      reset: () => set({ items: structuredClone(DEFAULT_USE_CASES) }),
    }),
    {
      name: "ydata-usecase-library",
      version: 5,
      /**
       * Refreshes placeholder values on built-in entries only, and only when
       * the user has never edited them — the previous version overwrote any
       * figure the user had typed. (Fix 1.1)
       */
      migrate: (persisted: unknown, fromVersion: number) => {
        const p = persisted as { items?: Record<string, unknown>[] } | null;
        if (!p) return p;
        const items = (p.items ?? []).map((u) => {
          const base = DEFAULT_USE_CASES.find((d) => d.id === u.id);
          const next: Record<string, unknown> = {
            ...u,
            category: (u.category as UseCaseCategory) ?? base?.category ?? "Revenue",
          };
          if (fromVersion < 5 && next.userEdited === undefined) {
            next.userEdited = !!base && Number(next.annualValue) !== base.annualValue;
          }
          if (isUntouchedPlaceholder(next as never) && base) next.annualValue = base.annualValue;
          return next as unknown as UseCase;
        });
        return { ...p, items };
      },
    },
  ),
);

export type { Confidence };
