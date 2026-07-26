import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type TvaRate = 0 | 5.5 | 10 | 20;
export type LineType = "Service" | "Matériel" | "Taux horaire";

export interface EditableLine {
  id: string;
  type: LineType;
  description: string;
  unit_price_ht: string;
  quantity: string;
  tva: TvaRate;
}

export function newLine(): EditableLine {
  return {
    id: crypto.randomUUID(),
    type: "Service",
    description: "",
    unit_price_ht: "",
    quantity: "1",
    tva: 20,
  };
}

export function fmtEUR(n: number): string {
  return `${n.toFixed(2).replace(".", ",")} EUR`;
}

export function parseNum(value: string): number {
  return parseFloat(value.replace(",", "."));
}

export function computeEditorTotals(lines: EditableLine[]) {
  let totalHT = 0;
  let totalTVA = 0;
  for (const l of lines) {
    const ht = (parseNum(l.unit_price_ht) || 0) * (parseNum(l.quantity) || 0);
    totalHT += ht;
    totalTVA += ht * (l.tva / 100);
  }
  return {
    totalHT: Math.round(totalHT * 100) / 100,
    totalTVA: Math.round(totalTVA * 100) / 100,
    totalTTC: Math.round((totalHT + totalTVA) * 100) / 100,
  };
}

/** Shared line editor used by both the invoice and the quote screens. */
export function LineItemsEditor({
  title,
  lines,
  onChange,
}: {
  title: string;
  lines: EditableLine[];
  onChange: (next: EditableLine[]) => void;
}) {
  const updateLine = (id: string, patch: Partial<EditableLine>) =>
    onChange(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const removeLine = (id: string) =>
    onChange(lines.length === 1 ? lines : lines.filter((l) => l.id !== id));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>{title}</CardTitle>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...lines, newLine()])}
        >
          <Plus className="h-4 w-4" /> Ajouter une ligne
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {lines.map((l, i) => {
          const pu = parseNum(l.unit_price_ht) || 0;
          const qty = parseNum(l.quantity) || 0;
          const ttc = pu * qty * (1 + l.tva / 100);
          return (
            <div
              key={l.id}
              className="grid gap-2 rounded-lg border border-border p-3 md:grid-cols-12"
            >
              <div className="md:col-span-2">
                <Label className="text-xs">Type</Label>
                <Select
                  value={l.type}
                  onValueChange={(v) => updateLine(l.id, { type: v as LineType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Service">Service</SelectItem>
                    <SelectItem value="Matériel">Matériel</SelectItem>
                    <SelectItem value="Taux horaire">Taux horaire</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-4">
                <Label className="text-xs">Description</Label>
                <Input
                  value={l.description}
                  onChange={(e) => updateLine(l.id, { description: e.target.value })}
                  placeholder="Ex : Remplacement mitigeur cuisine"
                  maxLength={300}
                />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs">PU HT</Label>
                <Input
                  inputMode="decimal"
                  value={l.unit_price_ht}
                  onChange={(e) => updateLine(l.id, { unit_price_ht: e.target.value })}
                  placeholder="0,00"
                />
              </div>
              <div className="md:col-span-1">
                <Label className="text-xs">Qté</Label>
                <Input
                  inputMode="decimal"
                  value={l.quantity}
                  onChange={(e) => updateLine(l.id, { quantity: e.target.value })}
                />
              </div>
              <div className="md:col-span-1">
                <Label className="text-xs">TVA</Label>
                <Select
                  value={String(l.tva)}
                  onValueChange={(v) => updateLine(l.id, { tva: parseFloat(v) as TvaRate })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0%</SelectItem>
                    <SelectItem value="5.5">5,5%</SelectItem>
                    <SelectItem value="10">10%</SelectItem>
                    <SelectItem value="20">20%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs">Prix TTC</Label>
                <div className="flex items-center gap-2">
                  <Input readOnly value={fmtEUR(ttc)} className="bg-muted" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeLine(l.id)}
                    disabled={lines.length === 1}
                    aria-label={`Supprimer ligne ${i + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function TotalsCard({
  totals,
}: {
  totals: { totalHT: number; totalTVA: number; totalTTC: number };
}) {
  return (
    <Card>
      <CardContent className="grid gap-2 pt-6 md:grid-cols-3">
        <TotalBox label="Total HT" value={fmtEUR(totals.totalHT)} />
        <TotalBox label="Total TVA" value={fmtEUR(totals.totalTVA)} />
        <TotalBox label="Total TTC" value={fmtEUR(totals.totalTTC)} accent />
      </CardContent>
    </Card>
  );
}

function TotalBox({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        accent ? "border-primary bg-primary/10" : "border-border bg-muted/30"
      }`}
    >
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 text-xl font-bold ${accent ? "text-primary" : ""}`}>
        {value}
      </div>
    </div>
  );
}

export function downloadBase64Pdf(base64: string, filename: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
