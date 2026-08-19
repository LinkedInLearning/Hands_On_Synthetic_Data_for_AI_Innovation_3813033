import type { Scenario } from "./defaults";

/**
 * Scenario portability. (Fix 3.2)
 *
 * Everything lived in localStorage with no way out, so a case could not be
 * shared with a colleague, moved between machines, attached to an engagement
 * file, or recovered after site data was cleared.
 */

export const EXPORT_FORMAT = "value-navigator/scenario-bundle";
export const EXPORT_VERSION = 1;

export interface ScenarioBundle {
  format: typeof EXPORT_FORMAT;
  version: number;
  exportedAt: string;
  scenarios: Scenario[];
}

function slug(v: string) {
  return (v || "scenario").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function bundleOf(scenarios: Scenario[]): ScenarioBundle {
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    scenarios: structuredClone(scenarios),
  };
}

export function exportScenarios(scenarios: Scenario[], filename?: string) {
  const name =
    filename ??
    (scenarios.length === 1
      ? `${slug(scenarios[0].organization)}-${slug(scenarios[0].name)}.json`
      : `value-navigator-scenarios-${new Date().toISOString().slice(0, 10)}.json`);
  download(name, JSON.stringify(bundleOf(scenarios), null, 2));
}

export class ImportError extends Error {}

/** Parses a bundle, or a bare scenario / array of scenarios, and validates shape. */
export function parseBundle(text: string): Scenario[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ImportError("That file isn't valid JSON.");
  }

  const asRecord = data as Record<string, unknown>;
  let list: unknown;

  if (Array.isArray(data)) list = data;
  else if (asRecord?.format === EXPORT_FORMAT) list = asRecord.scenarios;
  else if (asRecord?.useCases) list = [data];
  else if (Array.isArray(asRecord?.scenarios)) list = asRecord.scenarios;
  else throw new ImportError("That file doesn't look like a Synthetic Data ROI export.");

  if (!Array.isArray(list) || list.length === 0) {
    throw new ImportError("No scenarios found in that file.");
  }

  const bad = (list as Record<string, unknown>[]).find(
    (s) => !s || typeof s !== "object" || !Array.isArray(s.useCases) || typeof s.name !== "string",
  );
  if (bad) throw new ImportError("One or more scenarios in that file are missing required fields.");

  return list as Scenario[];
}

/** Opens a file picker and resolves with the parsed scenarios. */
export function pickScenarioFile(): Promise<Scenario[]> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return reject(new ImportError("No file selected."));
      try {
        resolve(parseBundle(await file.text()));
      } catch (e) {
        reject(e);
      }
    };
    input.click();
  });
}
