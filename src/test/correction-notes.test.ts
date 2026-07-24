import { describe, expect, it } from "vitest";
import { buildPartialCorrectionItems, remainingCorrectableQuantities } from "@/lib/correction-notes";

describe("correction notes", () => {
  it("computes remaining quantities after prior corrections", () => {
    const remaining = remainingCorrectableQuantities(
      [
        { id: "l1", item_id: "i1", name: "Rice", quantity: 10, rate: 100 },
        { id: "l2", item_id: "i2", name: "Oil", quantity: 5, rate: 200 },
      ],
      [{ item_id: "i1", name: "Rice", quantity: 4 }]
    );
    expect(remaining.get("l1")).toBe(6);
    expect(remaining.get("l2")).toBe(5);
  });

  it("builds partial correction lines and rejects over-correction", () => {
    const built = buildPartialCorrectionItems([
      {
        name: "Rice",
        item_id: "i1",
        quantity: 2,
        rate: 100,
        tax_type: "vat_13",
        vat_rate: 13,
        maxQuantity: 10,
      },
    ]);
    expect(built.lines).toHaveLength(1);
    expect(built.totals.taxable_amount).toBe(200);
    expect(() =>
      buildPartialCorrectionItems([
        { name: "Rice", quantity: 11, rate: 100, tax_type: "non_taxable", maxQuantity: 10 },
      ])
    ).toThrow(/exceeds remaining/i);
  });
});
