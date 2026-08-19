import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp, Wallet, Calendar, Activity, Layers } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KpiCard } from "./KpiCard";
import { SensitivityPanel } from "./SensitivityPanel";
import { fmt, formatIrr, formatPayback, formatRoi, type Results } from "@/lib/calc";
import { confidenceWeightsOf, type Scenario } from "@/lib/defaults";

type ResultsView = "case" | "sensitivity";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--success))",
  "hsl(var(--brand-violet))",
  "hsl(var(--brand-purple))",
];



/**
 * Hoisted out of ResultsPanel's render. Declaring it inside meant a new
 * component identity every render, so React remounted the entire table on
 * every keystroke. (Fix 6.2)
 */
function PLRow({
  label, value, formula, bold, indent, positive, negative, total, cur,
}: {
  label: string;
  value: number;
  formula?: string;
  bold?: boolean;
  indent?: boolean;
  positive?: boolean;
  negative?: boolean;
  total?: boolean;
  cur: string;
}) {
  return (
    <tr className={`${total ? "border-t-2 border-foreground/40 bg-secondary/40" : "border-t"} ${bold || total ? "font-semibold" : ""}`}>
      <td className={`px-3 py-2 ${indent ? "pl-8" : ""}`}>
        <div>{label}</div>
        {formula && <div className="text-[10px] font-normal text-muted-foreground">{formula}</div>}
      </td>
      <td className={`px-3 py-2 text-right tabular-nums ${positive ? "text-success" : negative ? "text-destructive" : ""}`}>
        {negative ? `(${fmt.short(Math.abs(value), cur)})` : fmt.short(value, cur)}
      </td>
    </tr>
  );
}

interface Props {
  scenario: Scenario;
  results: Results;
  onUpdate: (patch: Partial<Scenario>) => void;
}

export function ResultsPanel({ scenario, results: live }: Props) {
  const cur = scenario.currency;
  const horizon = scenario.horizonYears;
  const weights = confidenceWeightsOf(scenario);
  const [view, setView] = React.useState<ResultsView>("case");

  const cashflowChart = live.cashflow.map((l) => ({
    name: l.year === 0 ? "Initial" : `Y${l.year}`,
    benefits: Math.round(l.benefits),
    cost: -Math.round(l.platformCost + l.implementationCost + l.runCost),
    cumulative: Math.round(l.cumulative),
  }));

  const internalImplementation = scenario.internalRoles.reduce((s, r) => s + r.hourlyRate * r.hours, 0);

  return (
    <div className="space-y-6">
      <Tabs value={view} onValueChange={(v) => setView(v as ResultsView)}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Results</h2>
            <p className="text-xs text-muted-foreground">
              One ROI, from the organization's point of view — value created minus total cost of ownership.
            </p>
          </div>
          <TabsList className="h-11 w-full bg-secondary p-1 sm:w-auto">
            <TabsTrigger value="case" className="flex-1 px-5 text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground sm:flex-initial">
              Business case
            </TabsTrigger>
            <TabsTrigger value="sensitivity" className="flex-1 px-5 text-sm font-semibold data-[state=active]:bg-foreground data-[state=active]:text-background sm:flex-initial">
              Sensitivity
            </TabsTrigger>
          </TabsList>
        </div>
      </Tabs>

      {view === "sensitivity" && <SensitivityPanel scenario={scenario} baseline={live} />}

      {view === "case" && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <KpiCard
              label="ROI"
              value={formatRoi(live.roi)}
              hint={`Over ${horizon} year${horizon > 1 ? "s" : ""}`}
              tone="primary"
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <KpiCard
              label="Payback period"
              value={formatPayback(live.paybackMonths, live.paybackBeyondHorizon)}
              hint="Time to recover the investment"
              icon={<Calendar className="h-4 w-4" />}
            />
            <KpiCard
              label="Net benefit"
              value={fmt.short(live.netBenefit, cur)}
              hint="Risk- and adoption-adjusted"
              tone="accent"
              icon={<Activity className="h-4 w-4" />}
            />
            <KpiCard
              label="Total cost of ownership"
              value={fmt.short(live.totalCost, cur)}
              hint="Platform + implementation + run"
              icon={<Wallet className="h-4 w-4" />}
            />
            <KpiCard
              label="Annual value at maturity"
              value={fmt.short(live.annualBenefitAtMaturity, cur)}
              hint="Risk- and adoption-adjusted annual value"
              icon={<Layers className="h-4 w-4" />}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-sm">Cumulative net benefit</CardTitle></CardHeader>
              <CardContent className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={cashflowChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => fmt.short(v, cur)} tick={{ fontSize: 11 }} width={70} />
                    <Tooltip formatter={(v: number) => fmt.short(v, cur)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    <Line type="monotone" dataKey="cumulative" stroke="hsl(var(--accent))" strokeWidth={3} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Value vs. cost by year</CardTitle></CardHeader>
              <CardContent className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cashflowChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => fmt.short(v, cur)} tick={{ fontSize: 11 }} width={70} />
                    <Tooltip formatter={(v: number) => fmt.short(v, cur)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="benefits" fill="hsl(var(--success))" name="Value" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="cost" fill="hsl(var(--destructive))" name="Cost" radius={[0, 0, 4, 4]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Value by dimension</CardTitle>
              </CardHeader>
              <CardContent className="h-[280px]">
                {live.benefitsByDimension.length === 0 ? (
                  <p className="pt-16 text-center text-sm text-muted-foreground">
                    Enable use cases to see where the value comes from.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={live.benefitsByDimension}
                        dataKey="value"
                        nameKey="label"
                        cx="50%"
                        cy="45%"
                        innerRadius={48}
                        outerRadius={82}
                        paddingAngle={2}
                      >

                        {live.benefitsByDimension.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => fmt.short(v, cur)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Cash flow detail</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full text-xs">
                  <thead className="bg-secondary/40">
                    <tr>
                      <th className="px-3 py-2 text-left">Year</th>
                      <th className="px-3 py-2 text-right">Value</th>
                      <th className="px-3 py-2 text-right">Platform</th>
                      <th className="px-3 py-2 text-right">Implementation</th>
                      <th className="px-3 py-2 text-right">Run</th>
                      <th className="px-3 py-2 text-right">Net</th>
                      <th className="px-3 py-2 text-right">Cumulative</th>
                    </tr>
                  </thead>
                  <tbody>
                    {live.cashflow.map((l) => (
                      <tr key={l.year} className="border-t">
                        <td className="px-3 py-2 font-medium">{l.year === 0 ? "Initial" : `Y${l.year}`}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-success">{fmt.short(l.benefits, cur)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt.short(-l.platformCost, cur)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt.short(-l.implementationCost, cur)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt.short(-l.runCost, cur)}</td>
                        <td className={`px-3 py-2 text-right font-semibold tabular-nums ${l.net >= 0 ? "text-success" : "text-destructive"}`}>
                          {fmt.short(l.net, cur)}
                        </td>
                        <td className={`px-3 py-2 text-right font-bold tabular-nums ${l.cumulative >= 0 ? "text-success" : "text-destructive"}`}>
                          {fmt.short(l.cumulative, cur)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>

          <Card className="border-2 border-primary/30">
            <CardHeader className="bg-primary/5">
              <CardTitle className="text-base">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Detailed calculation
                </span>
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                How the headline numbers are computed — over {horizon} year{horizon > 1 ? "s" : ""}.
                Platform and run costs are charged in full from year 1; benefits start after the
                time-to-value delay and then ramp to maturity.
              </p>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-xs">
                <tbody>
                  <PLRow cur={cur} label="VALUE CREATED" value={live.totalBenefit} bold positive />
                  <PLRow cur={cur}
                    label="Gross annual value"
                    value={live.grossAnnualBenefit}
                    formula="Σ enabled use cases at maturity"
                    indent
                  />
                  <PLRow cur={cur}
                    label="Risk-adjusted annual value"
                    value={live.riskAdjustedAnnualBenefit}
                    formula={`× confidence weight (High ${Math.round(weights.High * 100)}% / Med ${Math.round(weights.Medium * 100)}% / Low ${Math.round(weights.Low * 100)}%)`}
                    indent
                  />
                  <PLRow cur={cur}
                    label="After adoption"
                    value={live.adoptedAnnualBenefit}
                    formula={`× adoption rate ${fmt.pct(scenario.adoptionRate, 0)}`}
                    indent
                  />
                  <PLRow cur={cur}
                    label={`Total value over ${horizon}y (with ramp)`}
                    value={live.totalBenefit}
                    formula={`Time-to-value ${scenario.timeToValueMonths} months, then ramp to maturity`}
                    indent
                    positive
                  />

                  <PLRow cur={cur} label="TOTAL COST OF OWNERSHIP" value={live.totalCost} bold negative />
                  <PLRow cur={cur} label="Platform license" value={scenario.ydataLicense * horizon} formula={`${fmt.short(scenario.ydataLicense, cur)}/y × ${horizon}y`} indent negative />
                  <PLRow cur={cur} label="Support" value={scenario.ydataSupport * horizon} formula={`${fmt.short(scenario.ydataSupport, cur)}/y × ${horizon}y`} indent negative />
                  <PLRow cur={cur} label="Infrastructure" value={scenario.ydataInfra * horizon} formula={`${fmt.short(scenario.ydataInfra, cur)}/y × ${horizon}y (${scenario.deployment})`} indent negative />
                  <PLRow cur={cur} label="Internal implementation effort" value={internalImplementation} formula="Σ role hourly rate × hours" indent negative />
                  <PLRow cur={cur} label="External services" value={scenario.externalServices} formula="Integrator / vendor professional services (one-off)" indent negative />
                  <PLRow cur={cur} label="Training & enablement" value={scenario.enablementCost} indent negative />
                  <PLRow cur={cur}
                    label="Run team & change budget"
                    value={live.runAnnual * horizon}
                    formula={`${scenario.runFte} FTE × ${fmt.short(scenario.runFteCost, cur)} + ${fmt.short(scenario.changeBudget, cur)} change / year`}
                    indent
                    negative
                  />

                  <PLRow cur={cur} label="NET BENEFIT" value={live.netBenefit} total positive={live.netBenefit >= 0} negative={live.netBenefit < 0} />
                  <PLRow cur={cur}
                    label="ROI"
                    value={0}
                    formula={`Net benefit ÷ total cost = ${fmt.short(live.netBenefit, cur)} ÷ ${fmt.short(live.totalCost, cur)} = ${formatRoi(live.roi)}`}
                    indent
                  />
                  <PLRow cur={cur}
                    label="NPV / IRR"
                    value={0}
                    formula={`NPV ${fmt.short(live.npv, cur)} at ${fmt.pct(scenario.discountRate, 0)} discount · IRR ${formatIrr(live.irr, live.irrUnbounded)}`}
                    indent
                  />
                  <PLRow cur={cur}
                    label="Payback period"
                    value={0}
                    formula={`Cumulative cash flow turns positive: ${formatPayback(live.paybackMonths, live.paybackBeyondHorizon)}`}
                    indent
                  />
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
