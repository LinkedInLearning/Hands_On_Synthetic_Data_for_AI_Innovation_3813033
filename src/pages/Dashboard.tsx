import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Plus, Briefcase, Calendar, Copy, Trash2, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useScenarios } from "@/lib/store";
import { computeResults, fmt, formatPayback, formatRoi } from "@/lib/calc";
import { exportScenarios, pickScenarioFile, ImportError } from "@/lib/scenarioIo";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Dashboard() {
  const navigate = useNavigate();
  const { scenarios, create, duplicate, remove, importScenarios } = useScenarios();
  // Fix 4.3 — deleting used to be a single unconfirmed click with no undo.
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const enriched = scenarios.map((s) => ({ s, r: computeResults(s) }));

  const handleNew = () => {
    const id = create();
    navigate(`/scenario/${id}`);
  };

  return (
    <div className="container max-w-7xl space-y-6 px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Portfolio dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Build, compare and export internal ROI business cases for your synthetic data initiative.
          </p>

        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Fix 3.2 — scenarios had no way out of this browser. */}
          <Button
            variant="outline"
            className="gap-2"
            disabled={scenarios.length === 0}
            onClick={() => {
              exportScenarios(scenarios);
              toast.success(`Exported ${scenarios.length} scenario${scenarios.length === 1 ? "" : "s"}`);
            }}
          >
            <Download className="h-4 w-4" /> Export all
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={async () => {
              try {
                const incoming = await pickScenarioFile();
                const ids = importScenarios(incoming);
                toast.success(`Imported ${ids.length} scenario${ids.length === 1 ? "" : "s"}`);
              } catch (e) {
                if (e instanceof ImportError) toast.error(e.message);
                else if (e) console.error(e);
              }
            }}
          >
            <Upload className="h-4 w-4" /> Import
          </Button>
          <Button onClick={handleNew} size="lg" className="gap-2 shadow-elegant">
            <Plus className="h-4 w-4" /> New scenario
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scenarios</CardTitle>
        </CardHeader>
        <CardContent>
          {scenarios.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
              <Briefcase className="h-10 w-10 text-muted-foreground/40" />
              <p className="mt-4 text-sm text-muted-foreground">No scenarios yet.</p>
              <Button onClick={handleNew} variant="outline" className="mt-4 gap-2">
                <Plus className="h-4 w-4" /> Create your first scenario
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {enriched.map(({ s, r }) => (
                <div
                  key={s.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/scenario/${s.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") navigate(`/scenario/${s.id}`);
                  }}
                  className="group cursor-pointer rounded-lg border bg-card p-4 text-left transition-all hover:border-primary/50 hover:shadow-elegant"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-semibold leading-tight">{s.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{s.organization} · {s.industry}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
                        {s.horizonYears}Y
                      </span>
                      <div className="flex" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          aria-label="Duplicate scenario"
                          onClick={() => {
                            const id = duplicate(s.id);
                            if (id) navigate(`/scenario/${id}`);
                          }}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          aria-label="Export scenario"
                          onClick={() => exportScenarios([s])}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          aria-label="Delete scenario"
                          onClick={() => setPendingDelete(s.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-muted-foreground">ROI</div>
                      <div className="font-bold tabular-nums text-primary">{formatRoi(r.roi)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Net benefit</div>
                      <div className="font-bold tabular-nums">{fmt.short(r.netBenefit, s.currency)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Total cost</div>
                      <div className="font-bold tabular-nums text-accent">{fmt.short(r.totalCost, s.currency)}</div>
                    </div>

                    <div>
                      <div className="text-muted-foreground">Payback</div>
                      <div className="font-bold tabular-nums">
                        {formatPayback(r.paybackMonths, r.paybackBeyondHorizon)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Calendar className="h-3 w-3" /> Updated {new Date(s.updatedAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this scenario?</AlertDialogTitle>
            <AlertDialogDescription>
              {scenarios.find((s) => s.id === pendingDelete)?.name} will be removed permanently.
              Export it first if you want to keep a copy.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const victim = scenarios.find((s) => s.id === pendingDelete);
                if (victim) {
                  const backup = structuredClone(victim);
                  remove(victim.id);
                  toast("Scenario deleted", {
                    action: { label: "Undo", onClick: () => importScenarios([backup]) },
                  });
                }
                setPendingDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
