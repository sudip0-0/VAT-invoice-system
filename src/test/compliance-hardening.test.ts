import { describe, expect, it } from "vitest";
import {
  calculateVATLine,
  fromPaisa,
  reconcileLineTotals,
  roundMoney,
  toPaisa,
} from "@/lib/vat-compliance";
import { calculateAuditEventHash, verifyAuditHashChain } from "@/lib/audit-chain";
import { analyzeFiscalSequences } from "@/lib/fiscal-sequence-review";
import { buildVATBookRows } from "@/lib/vat-books";
import { calculateVATReturnSummary } from "@/lib/vat-return";

describe("monetary precision", () => {
  it("rounds compliance money to nearest paisa", () => {
    expect(roundMoney(10.005)).toBe(10.01);
    expect(toPaisa(123.456)).toBe(12346);
    expect(fromPaisa(12346)).toBe(123.46);
  });

  it("reconciles VAT line totals using integer paisa", () => {
    const lines = [
      calculateVATLine({ quantity: 3, rate: 33.333, discount_pct: 0, tax_type: "vat_13" }),
      calculateVATLine({ quantity: 2, rate: 10.005, discount_pct: 5, tax_type: "vat_13" }),
    ];
    const totals = reconcileLineTotals(lines);
    expect(totals.total_amount_paisa).toBe(toPaisa(totals.total_amount));
    expect(totals.vat_amount).toBe(fromPaisa(totals.vat_amount_paisa));
  });
});

describe("audit hash chain", () => {
  it("verifies chained invoice events and detects tampering", async () => {
    const first = {
      business_id: "biz",
      invoice_id: "inv",
      action: "issued",
      details: "{\"invoice_number\":\"INV-0001\"}",
      created_at: "2026-05-01T00:00:00.000Z",
      previous_hash: "",
    };
    const firstHash = await calculateAuditEventHash(first);
    const second = {
      business_id: "biz",
      invoice_id: "inv",
      action: "printed",
      details: "{\"print_count\":1}",
      created_at: "2026-05-01T00:01:00.000Z",
      previous_hash: firstHash,
    };
    const secondHash = await calculateAuditEventHash(second);

    await expect(verifyAuditHashChain([
      { ...first, event_hash: firstHash },
      { ...second, event_hash: secondHash },
    ])).resolves.toEqual({ valid: true, failedEventId: null, reason: null });

    await expect(verifyAuditHashChain([
      { ...first, event_hash: firstHash },
      { ...second, details: "{\"print_count\":2}", event_hash: secondHash },
    ])).resolves.toMatchObject({ valid: false, reason: "event_hash_mismatch" });
  });
});

describe("fiscal sequence review", () => {
  it("flags gaps, duplicates, and legacy documents without renumbering them", () => {
    const issues = analyzeFiscalSequences([
      { id: "1", type: "sale", invoice_number: "INV-0001", fiscal_year: "2082/83", document_serial: 1 },
      { id: "2", type: "sale", invoice_number: "INV-0003", fiscal_year: "2082/83", document_serial: 3 },
      { id: "3", type: "sale", invoice_number: "INV-0003B", fiscal_year: "2082/83", document_serial: 3 },
      { id: "4", type: "sale_return", invoice_number: "CN-LEGACY", fiscal_year: null, document_serial: null },
    ]);

    expect(issues.map((issue) => issue.type)).toContain("gap");
    expect(issues.map((issue) => issue.type)).toContain("duplicate");
    expect(issues.map((issue) => issue.type)).toContain("legacy_review");
  });
});

describe("credit and debit note VAT return impact", () => {
  it("reduces sales VAT by credit notes and purchase VAT by debit notes", () => {
    const summary = calculateVATReturnSummary([
      { type: "sale", is_vat_invoice: true, taxable_amount: 1000, vat_amount: 130, total_amount: 1130 },
      { type: "purchase", is_vat_invoice: true, taxable_amount: 500, vat_amount: 65, total_amount: 565 },
      { type: "sale_return", is_vat_invoice: true, taxable_amount: 200, vat_amount: 26, total_amount: 226 },
      { type: "purchase_return", is_vat_invoice: true, taxable_amount: 100, vat_amount: 13, total_amount: 113 },
    ]);

    expect(summary.counts.credit_note_count).toBe(1);
    expect(summary.counts.debit_note_count).toBe(1);
    expect(summary.netVATPayable).toBe(52);
  });

  it("uses edited correction-note line totals for partial returns", () => {
    const originalLines = [
      calculateVATLine({ quantity: 10, rate: 100, discount_pct: 0, tax_type: "vat_13" }),
      calculateVATLine({ quantity: 5, rate: 200, discount_pct: 10, tax_type: "vat_13" }),
    ];
    const partialCreditLines = [
      calculateVATLine({ quantity: 2, rate: 100, discount_pct: 0, tax_type: "vat_13" }),
      calculateVATLine({ quantity: 1, rate: 200, discount_pct: 10, tax_type: "vat_13" }),
    ];

    const original = reconcileLineTotals(originalLines);
    const partialCredit = reconcileLineTotals(partialCreditLines);
    const summary = calculateVATReturnSummary([
      { type: "sale", is_vat_invoice: true, taxable_amount: original.taxable_amount, vat_amount: original.vat_amount, total_amount: original.total_amount },
      { type: "sale_return", is_vat_invoice: true, taxable_amount: partialCredit.taxable_amount, vat_amount: partialCredit.vat_amount, total_amount: partialCredit.total_amount },
    ]);

    expect(partialCredit.taxable_amount).toBe(380);
    expect(partialCredit.vat_amount).toBe(49.4);
    expect(summary.sections.find((row) => row.label === "Net Taxable Sales")?.amount).toBe(1520);
    expect(summary.sections.find((row) => row.label === "Net Taxable Sales")?.vat).toBe(197.6);
  });
});

describe("official-style VAT books", () => {
  it("builds Schedule 8/9 review rows with taxpayer info, counts, totals, and unavailable markers", () => {
    const book = buildVATBookRows([
      {
        invoice_number: "INV-0001",
        document_serial: 1,
        issued_date_bs: "2082-01-01",
        fiscal_year: "2082/83",
        vat_period: "2082-01",
        is_vat_invoice: true,
        buyer_name: "ABC Traders",
        buyer_pan: "123456789",
        total_amount: 1130,
        taxable_amount: 1000,
        vat_amount: 130,
        invoice_items: [{ tax_type: "vat_13", total_amount: 1130 }],
      },
      {
        invoice_number: "INV-LEGACY",
        document_serial: null,
        issued_date_bs: "2082-01-02",
        fiscal_year: null,
        vat_period: null,
        is_vat_invoice: false,
        buyer_name: null,
        buyer_pan: null,
        total_amount: 500,
        taxable_amount: 0,
        vat_amount: 0,
      },
    ], "987654321", "sales");

    expect(book.count).toBe(2);
    expect(book.rows[0]).toMatchObject({
      fiscal_year: "2082/83",
      vat_period: "2082-01",
      taxpayer_pan: "987654321",
      buyer_pan: "123456789",
    });
    expect(book.rows[1]).toMatchObject({
      fiscal_year: "Accountant review",
      vat_period: "Accountant review",
      buyer_pan: "Accountant review",
      buyer_name: "Accountant review",
      exempt_sales: 500,
    });
    expect(book.totals).toEqual({
      total_sales: 1630,
      exempt_sales: 500,
      taxable_amount: 1000,
      vat_amount: 130,
    });
  });
});
