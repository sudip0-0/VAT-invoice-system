import { calculateVATLine, type LineTaxType } from "@/lib/vat-compliance";

export const LINE_TAX_TYPES: Array<{ value: LineTaxType; label: string }> = [
  { value: "vat_13", label: "VAT 13%" },
  { value: "zero_rated", label: "Zero-rated" },
  { value: "exempt", label: "Exempt" },
  { value: "non_taxable", label: "Non-taxable" },
];

export interface DocumentLineItem {
  key: string;
  item_id: string | null;
  hsn_code: string | null;
  name: string;
  unit: string;
  quantity: number;
  rate: number;
  discount_pct: number;
  discount_amt: number;
  tax_type: LineTaxType;
  vat_rate: number;
  taxable_amount: number;
  vat_amount: number;
  total_amount: number;
  is_custom: boolean;
}

export function newDocumentLine(): DocumentLineItem {
  return {
    key: crypto.randomUUID(),
    item_id: null,
    hsn_code: null,
    name: "",
    unit: "PCS",
    quantity: 1,
    rate: 0,
    discount_pct: 0,
    discount_amt: 0,
    tax_type: "non_taxable",
    vat_rate: 0,
    taxable_amount: 0,
    vat_amount: 0,
    total_amount: 0,
    is_custom: false,
  };
}

export function calcDocumentLine(line: DocumentLineItem): DocumentLineItem {
  const totals = calculateVATLine(line);
  return {
    ...line,
    ...totals,
  };
}
