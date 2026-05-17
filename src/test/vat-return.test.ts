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
      vat_sales_invoice_count: 1,
      vat_purchase_invoice_count: 0,
      total_document_count: 4,
    });
    expect(summary.sections.find((row) => row.label === "Exempt Sales")?.amount).toBe(500);
    expect(summary.sections.find((row) => row.label === "Exempt Purchases")?.amount).toBe(300);
    expect(summary.sections.find((row) => row.label === "Net Taxable Sales")?.vat).toBe(104);
    expect(summary.sections.find((row) => row.label === "Net Taxable Purchases")?.vat).toBe(-13);
    expect(summary.netVATPayable).toBe(117);
  });

  it("aggregates Schedule 10 purchase buckets and payment voucher details", () => {
    const summary = calculateVATReturnSummary([
      { type: "purchase", is_vat_invoice: true, taxable_amount: 1000, vat_amount: 130, total_amount: 1130, purchase_bucket: "regular" },
      { type: "purchase", is_vat_invoice: true, taxable_amount: 2000, vat_amount: 260, total_amount: 2260, purchase_bucket: "import" },
      { type: "purchase", is_vat_invoice: true, taxable_amount: 3000, vat_amount: 390, total_amount: 3390, purchase_bucket: "capitalized" },
    ], [
      { date_bs: "2082-01-10", method: "bank_transfer", reference: "VCH-001", amount: 5000, bank_name: "Nabil" },
    ]);

    expect(summary.purchaseBuckets.local_taxable_purchase).toMatchObject({ amount: 1000, vat: 130 });
    expect(summary.purchaseBuckets.import_taxable_purchase).toMatchObject({ amount: 2000, vat: 260 });
    expect(summary.purchaseBuckets.capitalized_taxable_purchase).toMatchObject({ amount: 3000, vat: 390 });
    expect(summary.paymentDetails[0]).toMatchObject({ reference: "VCH-001", amount: 5000 });
    expect(summary.refundReason).toBe("Accountant review required before claiming refund.");
  });
});
