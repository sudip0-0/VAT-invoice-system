import { describe, expect, it } from "vitest";
import { calculateProfitLossTotals } from "@/lib/report-calculations";

describe("calculateProfitLossTotals", () => {
  it("subtracts COGS and operating expenses from sales", () => {
    const totals = calculateProfitLossTotals(
      [
        {
          type: "sale",
          total_amount: 1000,
          discount_amount: 50,
          vat_amount: 130,
          invoice_items: [
            { item_id: "item-1", quantity: 2 },
            { item_id: "item-2", quantity: 1 },
          ],
        },
        {
          type: "purchase",
          total_amount: 400,
          discount_amount: 10,
          vat_amount: 52,
          invoice_items: [],
        },
      ],
      new Map([
        ["item-1", 100],
        ["item-2", 150],
      ]),
      [{ amount: 125 }]
    );

    expect(totals.totalSales).toBe(1000);
    expect(totals.totalCOGS).toBe(350);
    expect(totals.grossProfit).toBe(650);
    expect(totals.totalExpenses).toBe(125);
    expect(totals.netProfit).toBe(525);
    expect(totals.totalPurchases).toBe(400);
  });
});
