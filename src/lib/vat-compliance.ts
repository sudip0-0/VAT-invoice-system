import type { InvoiceStatus, InvoiceType } from "@/integrations/local-db/types";

export const STATUTORY_VAT_RATE = 13;
export type LineTaxType = "vat_13" | "zero_rated" | "exempt" | "non_taxable";

export interface VATLineInput {
  quantity: number;
  rate: number;
  discount_pct?: number;
  vat_rate?: number;
  tax_type?: LineTaxType | string | null;
}

export interface VATLineTotals {
  discount_amt: number;
  taxable_amount: number;
  vat_amount: number;
  total_amount: number;
}

export const NPR_ROUNDING_POLICY =
  "Compliance calculations round each line and document total to the nearest paisa (2 decimal places); display keeps NPR with two decimals and no automatic rupee rounding.";

export interface EditableInvoiceLike {
  type: InvoiceType | string;
  status: InvoiceStatus | string;
  is_vat_invoice: boolean;
}

export function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export function toPaisa(amount: number): number {
  return Math.round((Number(amount) + Number.EPSILON) * 100);
}

export function fromPaisa(paisa: number): number {
  return roundMoney(Number(paisa) / 100);
}

export function reconcileLineTotals(lines: VATLineTotals[]) {
  const totals = lines.reduce(
    (acc, line) => ({
      discount_amount_paisa: acc.discount_amount_paisa + toPaisa(line.discount_amt),
      taxable_amount_paisa: acc.taxable_amount_paisa + toPaisa(line.taxable_amount),
      vat_amount_paisa: acc.vat_amount_paisa + toPaisa(line.vat_amount),
      total_amount_paisa: acc.total_amount_paisa + toPaisa(line.total_amount),
    }),
    {
      discount_amount_paisa: 0,
      taxable_amount_paisa: 0,
      vat_amount_paisa: 0,
      total_amount_paisa: 0,
    }
  );

  return {
    discount_amount: fromPaisa(totals.discount_amount_paisa),
    taxable_amount: fromPaisa(totals.taxable_amount_paisa),
    vat_amount: fromPaisa(totals.vat_amount_paisa),
    total_amount: fromPaisa(totals.total_amount_paisa),
    ...totals,
  };
}

export function calculateVATLine(input: VATLineInput): VATLineTotals {
  const gross = Number(input.quantity) * Number(input.rate);
  const discountPct = Number(input.discount_pct || 0);
  const discountAmt = discountPct > 0 ? gross * (discountPct / 100) : 0;
  const netAmount = gross - discountAmt;
  const taxType = input.tax_type || (Number(input.vat_rate || 0) > 0 ? "vat_13" : "non_taxable");
  const taxableAmount = taxType === "vat_13" || taxType === "zero_rated" ? netAmount : 0;
  const vatRate = taxType === "vat_13" ? STATUTORY_VAT_RATE : 0;
  const vatAmount = taxableAmount * vatRate / 100;

  return {
    discount_amt: roundMoney(discountAmt),
    taxable_amount: roundMoney(taxableAmount),
    vat_amount: roundMoney(vatAmount),
    total_amount: roundMoney(netAmount + vatAmount),
  };
}

export function getVATRateForTaxType(taxType: LineTaxType | string | null | undefined): number {
  return taxType === "vat_13" ? STATUTORY_VAT_RATE : 0;
}

export function canIssueVATInvoice(isVatInvoice: boolean, isBusinessVatRegistered: boolean): boolean {
  return !isVatInvoice || isBusinessVatRegistered;
}

export function requiresBuyerPanForIssue(
  type: string | undefined,
  status: string | undefined,
  isVatInvoice: boolean
): boolean {
  return type === "sale" && status !== "draft" && isVatInvoice;
}

export function hasRequiredBuyerPan(
  type: string | undefined,
  status: string | undefined,
  isVatInvoice: boolean,
  buyerPan: string | null | undefined
): boolean {
  return !requiresBuyerPanForIssue(type, status, isVatInvoice) || Boolean(buyerPan?.trim());
}

export function canDirectlyEditInvoice(invoice: EditableInvoiceLike): boolean {
  if (invoice.status === "cancelled" || invoice.status === "paid") return false;
  if (invoice.type === "quotation") return true;
  if ((invoice.type === "sale_return" || invoice.type === "purchase_return") && invoice.status !== "draft") return false;
  if (invoice.is_vat_invoice && invoice.status !== "draft") return false;
  return true;
}
