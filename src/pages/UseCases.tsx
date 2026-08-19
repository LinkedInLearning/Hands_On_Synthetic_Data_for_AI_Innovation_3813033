import { useState } from "react";
import { Plus, Trash2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUseCaseLibrary } from "@/lib/useCaseLibrary";
import { DIMENSION_LABEL, USE_CASE_CATEGORIES, CONFIDENCE_WEIGHTS, type Confidence, type UseCaseCategory } from "@/lib/defaults";
import { NumberField } from "@/components/NumberField";
import { fmt } from "@/lib/calc";

const CONFIDENCES: Confidence[] = ["High", "Medium", "Low"];
const CONFIDENCE_LABEL: Record<Confidence, string> = {
  High: `High (${Math.round(CONFIDENCE_WEIGHTS.High * 100)}%)`,
  Medium: `Medium (${Math.round(CONFIDENCE_WEIGHTS.Medium * 100)}%)`,
  Low: `Low (${Math.round(CONFIDENCE_WEIGHTS.Low * 100)}%)`,
};

export default function UseCases() {
  const { items, add, update, remove, reset } = useUseCaseLibrary();
  const [draft, setDraft] = useState<{
    name: string;
    category: UseCaseCategory;
    annualValue: number;
    confidence: Confidence;
    description: string;
  }>({
    name: "",
    category: "Revenue",
    annualValue: 250_000,
    confidence: "High",
    description: "",
  });

  const handleAdd = () => {
    if (!draft.name.trim()) return;
    add({
      name: draft.name,
      category: draft.category,
      annualValue: draft.annualValue,
      confidence: draft.confidence,
      description: draft.description,
      enabled: true,
    });
    setDraft({ name: "", category: "Revenue", annualValue: 250_000, confidence: "High", description: "" });
  };

  return (
    <div className="container max-w-6xl px-6 py-8 space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Use case library</h1>
          <p className="text-sm text-muted-foreground">
            Reusable value drivers available when building a scenario, grouped by dimension: new revenue, cost saving,
            productivity, and risk &amp; compliance. Figures are currency-neutral — each scenario applies its own.
          </p>

        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={reset}>
          <RotateCcw className="h-4 w-4" /> Reset to defaults
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add new use case</CardTitle>
          <CardDescription>Created use cases appear in new scenarios, switched on by default.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-12">
          <div className="md:col-span-4 space-y-1.5">
            <Label className="text-xs font-medium">Name</Label>
            <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. KYC automation" />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs font-medium">Category</Label>
            <Select value={draft.category} onValueChange={(v: UseCaseCategory) => setDraft({ ...draft, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {USE_CASE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{DIMENSION_LABEL[c]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs font-medium">Annual value</Label>
            {/* Fix 4.5 — the library feeds scenarios in any currency, so it shows none. */}
            <NumberField
              ariaLabel="Annual value"
              value={draft.annualValue}
              onChange={(v) => setDraft({ ...draft, annualValue: v })}
            />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs font-medium">Confidence</Label>
            <Select value={draft.confidence} onValueChange={(v: Confidence) => setDraft({ ...draft, confidence: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CONFIDENCES.map((c) => <SelectItem key={c} value={c}>{CONFIDENCE_LABEL[c]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 flex items-end">
            <Button className="w-full gap-2" onClick={handleAdd}>
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
          <div className="md:col-span-12 space-y-1.5">
            <Label className="text-xs font-medium">Description (optional)</Label>
            <Textarea
              rows={2}
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="Short description of business value, applicable industries, etc."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Library ({items.length})</CardTitle>
          <CardDescription>Edit any field inline. Changes apply to new scenarios.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((uc) => (
            <div key={uc.id} className="grid items-start gap-3 rounded-lg border p-3 md:grid-cols-12">
              <div className="md:col-span-4 space-y-1.5">
                <Label className="text-[10px] uppercase text-muted-foreground">Name</Label>
                <Input value={uc.name} onChange={(e) => update(uc.id, { name: e.target.value })} className="h-9" />
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <Label className="text-[10px] uppercase text-muted-foreground">Category</Label>
                <Select value={uc.category} onValueChange={(v: UseCaseCategory) => update(uc.id, { category: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {USE_CASE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{DIMENSION_LABEL[c]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-3 space-y-1.5">
                <Label className="text-[10px] uppercase text-muted-foreground">Annual value</Label>
                <NumberField
                  ariaLabel="Annual value"
                  value={uc.annualValue}
                  onChange={(v) => update(uc.id, { annualValue: v, userEdited: true })}
                  inputClassName="h-9"
                />
                <p className="text-[10px] text-muted-foreground">
                  Per year, in each scenario&rsquo;s own currency
                </p>
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <Label className="text-[10px] uppercase text-muted-foreground">Confidence</Label>
                <Select value={uc.confidence} onValueChange={(v: Confidence) => update(uc.id, { confidence: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONFIDENCES.map((c) => <SelectItem key={c} value={c}>{CONFIDENCE_LABEL[c]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-1 flex items-end justify-end">
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => remove(uc.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="md:col-span-12 space-y-1.5">
                <Label className="text-[10px] uppercase text-muted-foreground">Description</Label>
                <Textarea
                  rows={2}
                  value={uc.description ?? ""}
                  onChange={(e) => update(uc.id, { description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No use cases yet. Add one above or reset to defaults.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
