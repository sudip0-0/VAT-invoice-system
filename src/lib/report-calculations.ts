export interface ProfitLossInvoice {
  type: string;
  total_amount: number;
  discount_amount: number;
  vat_amount: number;
  invoice_items?: Array<{
    item_id: string | null;
    quantity: number;
  }>;
}

export interface ProfitLossExpense {
  amount: number;
}

export function calculateProfitLossTotals(
  invoices: ProfitLossInvoice[],
  purchasePriceByItemId: Map<string, number>,
  expenses: ProfitLossExpense[] = []
) {
  let totalSales = 0;
  let totalPurchases = 0;
  let totalCOGS = 0;
  let totalSalesDiscount = 0;
  let totalPurchaseDiscount = 0;
  let totalSalesVAT = 0;
  let totalPurchaseVAT = 0;

  for (const inv of invoices) {
    if (inv.type === "sale") {
      totalSales += Number(inv.total_amount);
      totalSalesDiscount += Number(inv.discount_amount);
      totalSalesVAT += Number(inv.vat_amount);
      for (const item of inv.invoice_items || []) {
        const purchasePrice = item.item_id ? purchasePriceByItemId.get(item.item_id) || 0 : 0;
        totalCOGS += purchasePrice * Number(item.quantity);
      }
    } else if (inv.type === "purchase") {
      totalPurchases += Number(inv.total_amount);
      totalPurchaseDiscount += Number(inv.discount_amount);
      totalPurchaseVAT += Number(inv.vat_amount);
    }
  }

  const totalExpenses = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const grossProfit = totalSales - totalCOGS;
  const netProfit = grossProfit - totalExpenses;

  return {
    totalSales,
    totalPurchases,
    totalCOGS,
    grossProfit,
    totalExpenses,
    netProfit,
    totalSalesDiscount,
    totalPurchaseDiscount,
    totalSalesVAT,
    totalPurchaseVAT,
  };
}
