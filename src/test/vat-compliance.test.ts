import { describe, expect, it } from "vitest";
import {
  STATUTORY_VAT_RATE,
  calculateVATLine,
  canDirectlyEditInvoice,
  canIssueVATInvoice,
  getVATRateForTaxType,
  hasRequiredBuyerPan,
} from "@/lib/vat-compliance";

describe("VAT compliance helpers", () => {
  it("uses the statutory 13% VAT rate for ordinary taxable supplies", () => {
    expect(STATUTORY_VAT_RATE).toBe(13);
  });

  it("reduces taxable value by discount before calculating VAT", () => {
    const line = calculateVATLine({
      quantity: 2,
      rate: 1000,
      discount_pct: 10,
      tax_type: "vat_13",
    });

    expect(line.discount_amt).toBe(200);
    expect(line.taxable_amount).toBe(1800);
    expect(line.vat_amount).toBe(234);
    expect(line.total_amount).toBe(2034);
  });

  it("requires explicit non-standard tax classification to suppress VAT", () => {
    expect(getVATRateForTaxType("vat_13")).toBe(13);
    expect(getVATRateForTaxType("zero_rated")).toBe(0);
    expect(getVATRateForTaxType("exempt")).toBe(0);
    expect(getVATRateForTaxType("non_taxable")).toBe(0);

    const exemptLine = calculateVATLine({
      quantity: 1,
      rate: 1000,
      tax_type: "exempt",
    });

    expect(exemptLine.taxable_amount).toBe(0);
    expect(exemptLine.vat_amount).toBe(0);
    expect(exemptLine.total_amount).toBe(1000);
  });

  it("blocks VAT invoice issuance for a non-VAT-registered business", () => {
    expect(canIssueVATInvoice(true, false)).toBe(false);
    expect(canIssueVATInvoice(true, true)).toBe(true);
    expect(canIssueVATInvoice(false, false)).toBe(true);
  });

  it("requires buyer PAN for issued VAT sales invoices", () => {
    expect(hasRequiredBuyerPan("sale", "issued", true, "")).toBe(false);
    expect(hasRequiredBuyerPan("sale", "issued", true, "123456789")).toBe(true);
    expect(hasRequiredBuyerPan("sale", "draft", true, "")).toBe(true);
    expect(hasRequiredBuyerPan("purchase", "issued", true, "")).toBe(true);
    expect(hasRequiredBuyerPan("sale", "issued", false, "")).toBe(true);
  });

  it("locks issued VAT invoices from direct edits", () => {
    expect(canDirectlyEditInvoice({ type: "sale", status: "draft", is_vat_invoice: true })).toBe(true);
    expect(canDirectlyEditInvoice({ type: "sale", status: "issued", is_vat_invoice: true })).toBe(false);
    expect(canDirectlyEditInvoice({ type: "sale", status: "partially_paid", is_vat_invoice: true })).toBe(false);
    expect(canDirectlyEditInvoice({ type: "sale", status: "paid", is_vat_invoice: true })).toBe(false);
    expect(canDirectlyEditInvoice({ type: "sale", status: "issued", is_vat_invoice: false })).toBe(true);
  });
});
