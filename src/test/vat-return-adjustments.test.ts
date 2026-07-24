import { describe, expect, it } from "vitest";
import { applyVATReturnAdjustments, calculateVATReturnSummary } from "@/lib/vat-return";

describe("vat return adjustments", () => {
  it("applies import and capitalized manual amounts to purchase buckets", () => {
    const base = calculateVATReturnSummary([]);
    const summary = applyVATReturnAdjustments(base, [
      { field_key: "import_taxable", amount: 1000, note: "customs" },
      { field_key: "import_vat", amount: 130 },
      { field_key: "capitalized_taxable", amount: 500 },
      { field_key: "refund_reason", amount: 0, note: "Carry forward credit" },
      { field_key: "payment_voucher_ref", amount: 0, note: "PV-99" },
    ]);

    expect(summary.purchaseBuckets.import_taxable_purchase.amount).toBe(1000);
    expect(summary.purchaseBuckets.import_taxable_purchase.vat).toBe(130);
    expect(summary.purchaseBuckets.capitalized_taxable_purchase.amount).toBe(500);
    expect(summary.refundReason).toBe("Carry forward credit");
    expect(summary.accountantReviewPlaceholders.some((p) => p.includes("PV-99"))).toBe(true);
    expect(summary.accountantReviewPlaceholders[0]).toMatch(/review aid/i);
  });
});
