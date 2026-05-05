import { describe, expect, it } from "vitest";
import { calculateVATReturnSummary } from "@/lib/vat-return";

describe("VAT return summary", () => {
  it("counts VAT return documents and separates exempt lines within VAT invoices", () => {
    const summary = calculateVATReturnSummary([
      {
        type: "sale",
        is_vat_invoice: true,
        taxable_amount: 1000,
        vat_amount: 130,
        total_amount: 1630,
        invoice_items: [
          { tax_type: "vat_13", total_amount: 1130 },
          { tax_type: "exempt", total_amount: 500 },
        ],
      },
      {
        type: "purchase",
        is_vat_invoice: false,
        taxable_amount: 0,
        vat_amount: 0,
        total_amount: 300,
      },
      {
        type: "sale_return",
        is_vat_invoice: true,
        taxable_amount: 200,
        vat_amount: 26,
        total_amount: 226,
      },
      {
        type: "purchase_return",
        is_vat_invoice: true,
        taxable_amount: 100,
        vat_amount: 13,
        total_amount: 113,
      },
    ]);

    expect(summary.counts).toEqual({
      sales_invoice_count: 1,
      purchase_invoice_count: 1,
      credit_note_count: 1,
      debit_note_count: 1,
      total_document_count: 4,
    });
    expect(summary.sections.find((row) => row.label === "Exempt Sales")?.amount).toBe(500);
    expect(summary.sections.find((row) => row.label === "Exempt Purchases")?.amount).toBe(300);
    expect(summary.sections.find((row) => row.label === "Net Taxable Sales")?.vat).toBe(104);
    expect(summary.sections.find((row) => row.label === "Net Taxable Purchases")?.vat).toBe(-13);
    expect(summary.netVATPayable).toBe(117);
  });
});
