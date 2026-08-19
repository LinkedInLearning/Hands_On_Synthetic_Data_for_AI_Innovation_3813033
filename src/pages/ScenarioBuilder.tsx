import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, ArrowRight, Trash2, RotateCcw, Plus, Download, FileText, FileJson, Presentation, FileType } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
// Fix 6.3 — jspdf + pptxgenjs + html2canvas are ~380 kB and were in the
// initial bundle for a feature behind a dropdown. Loaded on demand instead.
const loadExporters = () => import("@/lib/exporters");

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useScenarios } from "@/lib/store";
import { settingsPatch, useSettings } from "@/lib/settings";
import { computeResults, fmt } from "@/lib/calc";
import {
  confidenceWeightsOf,
  makeDefaultScenario,
  infraBaseline,
  DEFAULT_USE_CASES,
  STARTER_USE_CASE_IDS,
  type Scenario,
  type Deployment,
  type Product,
} from "@/lib/defaults";
import { useUseCaseLibrary } from "@/lib/useCaseLibrary";
import { shortId } from "@/lib/uuid";
import { exportScenarios } from "@/lib/scenarioIo";
import { NumberField } from "@/components/NumberField";
import { ResultsPanel } from "@/components/ResultsPanel";
import { UseCaseRow } from "@/components/UseCaseRow";

const INDUSTRIES = [
  "Technology, Media & Telecommunications",
  "Financial Services",
  "Healthcare & Life Sciences",
  "Government & Public Sector",
  "Consumer & Retail",
  "Industrial Manufacturing",
  "Energy, Natural Resources & Chemicals",
  "Asset Management",
  "Insurance",
  "Other",
] as const;

const TAB_ORDER = ["setup", "value", "costs", "results"] as const;
type TabKey = (typeof TAB_ORDER)[number];

function StepNav({ current, onChange }: { current: TabKey; onChange: (t: TabKey) => void }) {
  const idx = TAB_ORDER.indexOf(current);
  const prev = idx > 0 ? TAB_ORDER[idx - 1] : null;
  const next = idx < TAB_ORDER.length - 1 ? TAB_ORDER[idx + 1] : null;
  return (
    <div className="flex items-center justify-between pt-2">
      <Button variant="outline" size="sm" className="gap-1" disabled={!prev} onClick={() => prev && onChange(prev)}>
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>
      <Button size="sm" className="gap-1" disabled={!next} onClick={() => next && onChange(next)}>
        Next <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function ScenarioBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { create, update, remove, getById } = useScenarios();
  const [activeTab, setActiveTab] = useState<TabKey>("setup");
  // Fix 5.2 — export had no pending state, so a slow machine invited double clicks.
  const [exporting, setExporting] = useState<"pdf" | "pptx" | "docx" | null>(null);

  useEffect(() => {
    if (id === "new") {
      const newId = create();
      navigate(`/scenario/${newId}`, { replace: true });
    }
  }, [id, create, navigate]);

  const scenario = id && id !== "new" ? getById(id) : undefined;
  const results = useMemo(() => (scenario ? computeResults(scenario) : null), [scenario]);

  if (!scenario || !results) {
    return (
      <div className="container px-6 py-12 text-center text-muted-foreground">
        {id === "new" ? "Creating scenario…" : "Scenario not found."}{" "}
        <Button variant="link" onClick={() => navigate("/")}>
          Back to dashboard
        </Button>
      </div>
    );
  }

  const set = (patch: Partial<Scenario>) => update(scenario.id, patch);
  // Switching step should always start the new step from the top of the page.
  const goToTab = (t: TabKey) => {
    setActiveTab(t);
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  };
  const curSym = scenario.currency === "EUR" ? "€" : scenario.currency === "USD" ? "$" : "£";
  const implementationTotal = scenario.internalRoles.reduce((s, r) => s + r.hourlyRate * r.hours, 0);
  const weights = confidenceWeightsOf(scenario);
  const enabledCases = scenario.useCases.filter((u) => u.enabled);

  // Credibility checks surfaced to the user rather than silently baked into the model.
  const gaps: string[] = [];
  if (enabledCases.length === 0) gaps.push("No use case is switched on, so there is no value to compare costs against.");
  if (results && results.grossAnnualBenefit <= 0) gaps.push("Every enabled use case is worth zero per year.");
  if (scenario.ydataLicense + scenario.ydataSupport + scenario.ydataInfra === 0)
    gaps.push("Platform costs are all zero — add license, support or infrastructure figures.");
  if (implementationTotal === 0 && scenario.externalServices === 0)
    gaps.push("No implementation effort is budgeted (internal role hours or external services).");
  if (results && results.roi === null)
    gaps.push("Total cost is zero, so there is no ROI to report — add the costs of running this.");
  if (scenario.adoptionRate >= 0.95 && enabledCases.every((u) => u.confidence === "High"))
    gaps.push("Every use case is High confidence at near-total adoption — the case has no downside modeled.");

  return (
    <div className="flex flex-col">
      <div className="border-b bg-card/50 backdrop-blur">
        <div className="container max-w-7xl px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-1">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <div className="min-w-[12rem] flex-1">
              <Input
                value={scenario.name}
                onChange={(e) => set({ name: e.target.value })}
                className="h-9 max-w-md border-transparent bg-transparent text-lg font-semibold shadow-none focus-visible:border-input"
              />
              <Input
                value={scenario.organization}
                onChange={(e) => set({ organization: e.target.value })}
                placeholder="Organization"
                className="h-7 max-w-md border-transparent bg-transparent text-xs text-muted-foreground shadow-none focus-visible:border-input"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="default" size="sm" className="gap-2 shadow-elegant" disabled={exporting !== null}>
                  <Download className="h-4 w-4" /> {exporting ? "Preparing\u2026" : "Export"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="gap-2"
                  onSelect={async () => {
                    setExporting("pptx");
                    try {
                      const { exportScenarioPptx } = await loadExporters();
                      await exportScenarioPptx(scenario, results);
                      toast.success("PowerPoint deck downloaded");
                    } catch (e) {
                      toast.error("Could not generate the deck");
                      console.error(e);
                    } finally {
                      setExporting(null);
                    }
                  }}
                >
                  <Presentation className="h-4 w-4" /> PowerPoint (.pptx)
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-2"
                  onSelect={async () => {
                    setExporting("pdf");
                    try {
                      const { exportScenarioPdf } = await loadExporters();
                      await exportScenarioPdf(scenario, results);
                      toast.success("PDF downloaded");
                    } catch (e) {
                      toast.error("Could not generate the PDF");
                      console.error(e);
                    } finally {
                      setExporting(null);
                    }
                  }}
                >
                  <FileText className="h-4 w-4" /> PDF report
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-2"
                  onSelect={async () => {
                    setExporting("docx");
                    try {
                      const { exportScenarioDocx } = await loadExporters();
                      await exportScenarioDocx(scenario, results);
                      toast.success("Word document downloaded");
                    } catch (e) {
                      toast.error("Could not generate the Word document");
                      console.error(e);
                    } finally {
                      setExporting(null);
                    }
                  }}
                >
                  <FileType className="h-4 w-4" /> Word report (.docx)
                </DropdownMenuItem>

                <DropdownMenuItem
                  className="gap-2"
                  onSelect={() => {
                    exportScenarios([scenario]);
                    toast.success("Scenario file downloaded");
                  }}
                >
                  <FileJson className="h-4 w-4" /> Scenario file (.json)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <RotateCcw className="h-4 w-4" /> Reset to defaults
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset this scenario?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Every value driver, cost and assumption returns to the default model, rebuilt from your
                    use case library. The name, organization, business unit, industry and currency are kept.
                    This cannot be undone — export the scenario first if you want a copy.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      // Fix 3.4 — reset now mirrors "New scenario": it rebuilds from
                      // the user's library, and keeps the scenario's identity fields.
                      const libItems = useUseCaseLibrary.getState().items;
                      set(
                        makeDefaultScenario({
                          id: scenario.id,
                          name: scenario.name,
                          organization: scenario.organization,
                          businessUnit: scenario.businessUnit,
                          industry: scenario.industry,
                          ...settingsPatch(useSettings.getState()),
                          createdAt: scenario.createdAt,
                          useCases: structuredClone(libItems).map((u) => ({
                            ...u,
                            enabled:
                              STARTER_USE_CASE_IDS.includes(u.id) ||
                              !DEFAULT_USE_CASES.some((d) => d.id === u.id),
                          })),
                        }),
                      );
                      toast.success("Scenario reset to defaults");
                    }}
                  >
                    Reset
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            {/* Fix 4.3 — this used to delete on a single unconfirmed click. */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 text-destructive">
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete &ldquo;{scenario.name}&rdquo;?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This scenario will be removed permanently. Export it first if you want a copy.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      remove(scenario.id);
                      navigate("/");
                    }}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      <div className="container max-w-7xl px-4 py-6 sm:px-6">
        <Tabs value={activeTab} onValueChange={(v) => goToTab(v as TabKey)} className="space-y-6">
          <TabsList className="w-full justify-start overflow-x-auto bg-secondary">
            <TabsTrigger value="setup">1. Setup</TabsTrigger>
            <TabsTrigger value="value">2. Use cases</TabsTrigger>
            <TabsTrigger value="costs">3. Costs</TabsTrigger>
            <TabsTrigger value="results" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              📊 Results
            </TabsTrigger>
          </TabsList>

          {/* SETUP */}
          <TabsContent value="setup" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Initiative profile</CardTitle>
                <CardDescription>Who is running this synthetic data initiative and over what horizon.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                {/* Fix 1.7 — col-span-3 in a 2-column grid created an implicit third track. */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Scenario name</Label>
                  <Input
                    value={scenario.name}
                    onChange={(e) => set({ name: e.target.value })}
                    placeholder="e.g. Synthetic data platform — 3-year case"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Organization</Label>
                  <Input value={scenario.organization} onChange={(e) => set({ organization: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Business unit / sponsor</Label>
                  <Input value={scenario.businessUnit} onChange={(e) => set({ businessUnit: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Industry</Label>
                  <Select value={scenario.industry} onValueChange={(v: Scenario["industry"]) => set({ industry: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Product</CardTitle>
                <CardDescription>Which YData product you plan to run, and where.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Product name</Label>
                  <Select
                    value={scenario.product}
                    onValueChange={(v: Product) =>
                      set({
                        product: v,
                        deployment:
                          v === "YData SDK" && scenario.deployment === "Managed cloud (SaaS)"
                            ? "Own cloud"
                            : scenario.deployment,
                        ...(scenario.ydataInfra === infraBaseline(scenario.product, scenario.deployment)
                          ? {
                              ydataInfra: infraBaseline(
                                v,
                                v === "YData SDK" && scenario.deployment === "Managed cloud (SaaS)"
                                  ? "Own cloud"
                                  : scenario.deployment,
                              ),
                            }
                          : {}),
                      })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="YData SDK">YData SDK</SelectItem>
                      <SelectItem value="YData SaaS">YData SaaS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Deployment</Label>
                  <Select
                    value={scenario.deployment}
                    onValueChange={(v: Deployment) =>
                      set({
                        deployment: v,
                        // Fix 1.6 — only re-baseline infra when it was never edited.
                        ...(scenario.ydataInfra === infraBaseline(scenario.product, scenario.deployment)
                          ? { ydataInfra: infraBaseline(scenario.product, v) }
                          : {}),
                      })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {scenario.product !== "YData SDK" && (
                        <SelectItem value="Managed cloud (SaaS)">Managed cloud (SaaS)</SelectItem>
                      )}
                      <SelectItem value="Own cloud">Own cloud</SelectItem>
                      <SelectItem value="On-premises">On-premises</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
            <StepNav current={activeTab} onChange={goToTab} />
          </TabsContent>

          {/* VALUE */}
          <TabsContent value="value" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Use cases</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="hidden items-center gap-2 px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground md:grid md:grid-cols-12">
                  <div className="md:col-span-4">Use case</div>
                  <div className="md:col-span-2">Value driver</div>

                  <div className="md:col-span-3">Annual value</div>
                  <div className="md:col-span-2">Confidence</div>
                  <div className="md:col-span-1" />
                </div>
                {scenario.useCases.map((uc, idx) => (
                  <UseCaseRow
                    key={uc.id}
                    useCase={uc}
                    currency={scenario.currency}
                    currencySymbol={curSym}
                    weights={weights}
                    onChange={(patch) => {
                      const useCases = [...scenario.useCases];
                      useCases[idx] = { ...uc, ...patch };
                      set({ useCases });
                    }}
                    onRemove={() => set({ useCases: scenario.useCases.filter((x) => x.id !== uc.id) })}
                  />
                ))}

                <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed bg-secondary/30 p-4 text-center">
                  <p className="text-xs text-muted-foreground">Couldn't find your use case?</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() =>
                      set({
                        useCases: [
                          ...scenario.useCases,
                          {
                            id: shortId(),
                            name: "New use case",
                            enabled: true,
                            category: "Revenue" as const,
                            annualValue: 100_000,
                            confidence: "High" as const,
                          },
                        ],
                      })
                    }
                  >
                    <Plus className="h-4 w-4" /> Create new use case
                  </Button>
                </div>
              </CardContent>
            </Card>

            <StepNav current={activeTab} onChange={goToTab} />
          </TabsContent>

          {/* COSTS */}
          <TabsContent value="costs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Platform costs</CardTitle>
                <CardDescription>
                  What you pay to run {scenario.product} on {scenario.deployment.toLowerCase()}.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <NumberField label="License (annual)" value={scenario.ydataLicense} prefix={curSym} onChange={(v) => set({ ydataLicense: v })} />
                <NumberField label="Support (annual)" value={scenario.ydataSupport} prefix={curSym} onChange={(v) => set({ ydataSupport: v })} />
                <NumberField
                  label="Infrastructure (annual)"
                  value={scenario.ydataInfra}
                  prefix={curSym}
                  onChange={(v) => set({ ydataInfra: v })}
                  hint={scenario.deployment === "Own cloud" ? "Compute, storage and networking you operate" : scenario.deployment === "Managed cloud (SaaS)" ? "Included in the SaaS subscription" : "Existing on-premises capacity — add only incremental spend"}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Implementation (one-off)</CardTitle>
                <CardDescription>
                  Internal effort to get the platform live, plus any external help. Add, rename or remove line items to
                  match your delivery plan.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="hidden grid-cols-12 gap-2 border-b pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
                  <div className="col-span-4">Line item</div>
                  <div className="col-span-2 text-right">Loaded hourly rate ({curSym})</div>
                  <div className="col-span-2 text-right">Hours</div>
                  <div className="col-span-3 text-right">Subtotal</div>
                  <div className="col-span-1" />
                </div>
                {scenario.internalRoles.map((role, idx) => (
                  <div key={idx} className="grid grid-cols-2 items-center gap-2 border-b py-3 last:border-0 md:grid-cols-12 md:py-2">
                    <div className="col-span-2 md:col-span-4">
                      <Input
                        aria-label={`Line item ${idx + 1} name`}
                        value={role.role}
                        onChange={(e) => {
                          const internalRoles = [...scenario.internalRoles];
                          internalRoles[idx] = { ...role, role: e.target.value };
                          set({ internalRoles });
                        }}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="col-span-1 md:col-span-2">
                      <Label className="mb-1 block text-[10px] uppercase text-muted-foreground md:hidden">
                        Hourly rate ({curSym})
                      </Label>
                      <NumberField
                        ariaLabel={`${role.role} loaded hourly rate`}
                        value={role.hourlyRate}
                        onChange={(v) => {
                          const internalRoles = [...scenario.internalRoles];
                          internalRoles[idx] = { ...role, hourlyRate: v };
                          set({ internalRoles });
                        }}
                        inputClassName="h-8 text-right text-xs"
                      />
                    </div>
                    <div className="col-span-1 md:col-span-2">
                      <Label className="mb-1 block text-[10px] uppercase text-muted-foreground md:hidden">Hours</Label>
                      <NumberField
                        ariaLabel={`${role.role} hours`}
                        value={role.hours}
                        onChange={(v) => {
                          const internalRoles = [...scenario.internalRoles];
                          internalRoles[idx] = { ...role, hours: v };
                          set({ internalRoles });
                        }}
                        inputClassName="h-8 text-right text-xs"
                      />
                    </div>
                    <div className="col-span-1 text-right text-xs font-semibold tabular-nums md:col-span-3">
                      {fmt.short(role.hourlyRate * role.hours, scenario.currency)}
                    </div>
                    <div className="col-span-1 flex justify-end md:col-span-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label={`Remove ${role.role}`}
                        onClick={() =>
                          set({ internalRoles: scenario.internalRoles.filter((_, i) => i !== idx) })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t pt-2 text-xs font-semibold">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() =>
                      set({
                        internalRoles: [
                          ...scenario.internalRoles,
                          { role: "New line item", hourlyRate: 170, hours: 80 },
                        ],
                      })
                    }
                  >
                    <Plus className="h-4 w-4" /> Add line item
                  </Button>
                  <span className="flex items-center gap-2">
                    Total internal effort
                    <span className="tabular-nums">{fmt.short(implementationTotal, scenario.currency)}</span>
                  </span>
                </div>

                <Separator className="my-3" />
                <div className="grid gap-4 md:grid-cols-2">
                  <NumberField
                    label="External services (one-off)"
                    value={scenario.externalServices}
                    prefix={curSym}
                    onChange={(v) => set({ externalServices: v })}
                    hint="Integrator or vendor professional services"
                  />
                  <NumberField
                    label="Training & enablement (one-off)"
                    value={scenario.enablementCost}
                    prefix={curSym}
                    onChange={(v) => set({ enablementCost: v })}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Run the platform (annual)</CardTitle>
                <CardDescription>The team and budget that keeps it live after go-live.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <NumberField label="Run team (FTE)" value={scenario.runFte} step={0.5} onChange={(v) => set({ runFte: v })} />
                <NumberField label="Loaded cost / FTE / year" value={scenario.runFteCost} prefix={curSym} onChange={(v) => set({ runFteCost: v })} />
                <NumberField
                  label="Change & enhancement budget (annual)"
                  value={scenario.changeBudget}
                  prefix={curSym}
                  onChange={(v) => set({ changeBudget: v })}
                  hint="Onboarding new use cases, model refreshes"
                />
              </CardContent>
            </Card>
            <StepNav current={activeTab} onChange={goToTab} />
          </TabsContent>

          {/* RESULTS */}
          <TabsContent value="results" className="space-y-4">
            {gaps.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle className="text-sm">This case is not complete yet</AlertTitle>
                <AlertDescription>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs">
                    {gaps.map((g) => (
                      <li key={g}>{g}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            <ResultsPanel scenario={scenario} results={results} onUpdate={set} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
