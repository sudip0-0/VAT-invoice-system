import { calculateVATLine, reconcileLineTotals, type LineTaxType } from "@/lib/vat-compliance";

export type CorrectionCategory = "return" | "rate_adjustment" | "other";

export interface OriginalLineLike {
  id?: string;
  item_id?: string | null;
  name: string;
  unit?: string | null;
  hsn_code?: string | null;
  quantity: number;
  rate: number;
  discount_pct?: number;
  tax_type?: string | null;
  vat_rate?: number | null;
}

export interface PriorCorrectionLineLike {
  item_id?: string | null;
  name: string;
  quantity: number;
}

export interface CorrectionLineSelection {
  sourceLineId?: string;
  item_id?: string | null;
  name: string;
  unit?: string | null;
  hsn_code?: string | null;
  quantity: number;
  rate: number;
  discount_pct?: number;
  tax_type?: string | null;
  vat_rate?: number | null;
  maxQuantity: number;
}

function lineKey(line: { item_id?: string | null; name: string; sourceLineId?: string; id?: string }) {
  return line.sourceLineId || line.id || `${line.item_id || "none"}::${line.name}`;
}

export function remainingCorrectableQuantities(
  originalLines: OriginalLineLike[],
  priorCorrectionLines: PriorCorrectionLineLike[]
): Map<string, number> {
  const used = new Map<string, number>();
  for (const line of priorCorrectionLines) {
    const key = `${line.item_id || "none"}::${line.name}`;
    used.set(key, (used.get(key) || 0) + Number(line.quantity || 0));
  }

  const remaining = new Map<string, number>();
  for (const line of originalLines) {
    const key = lineKey(line);
    const usedKey = `${line.item_id || "none"}::${line.name}`;
    const left = Math.max(0, Number(line.quantity || 0) - (used.get(usedKey) || 0));
    remaining.set(key, left);
  }
  return remaining;
}

export function buildPartialCorrectionItems(selections: CorrectionLineSelection[]) {
  const lines = selections
    .filter((line) => Number(line.quantity) > 0)
    .map((line) => {
      if (line.quantity > line.maxQuantity + 1e-9) {
        throw new Error(`Quantity for ${line.name} exceeds remaining correctable amount`);
      }
      const totals = calculateVATLine({
        quantity: Number(line.quantity),
        rate: Number(line.rate),
        discount_pct: Number(line.discount_pct || 0),
        tax_type: (line.tax_type || "vat_13") as LineTaxType,
        vat_rate: Number(line.vat_rate || 0),
      });
      return {
        item_id: line.item_id || null,
        hsn_code: line.hsn_code || null,
        name: line.name,
        unit: line.unit || "PCS",
        quantity: Number(line.quantity),
        rate: Number(line.rate),
        discount_pct: Number(line.discount_pct || 0),
        discount_amt: totals.discount_amt,
        tax_type: (line.tax_type || "vat_13") as LineTaxType,
        vat_rate: Number(line.vat_rate || 0),
        taxable_amount: totals.taxable_amount,
        vat_amount: totals.vat_amount,
        total_amount: totals.total_amount,
      };
    });

  if (lines.length === 0) {
    throw new Error("Select at least one line to correct");
  }

  const totals = reconcileLineTotals(lines);
  return { lines, totals };
}
