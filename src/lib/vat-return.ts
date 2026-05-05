export interface VATReturnInvoiceLineInput {
  tax_type?: string | null;
  total_amount: number;
}

export interface VATReturnInvoiceInput {
  type: string;
  is_vat_invoice: boolean;
  taxable_amount: number;
  vat_amount: number;
  total_amount: number;
  invoice_items?: VATReturnInvoiceLineInput[] | null;
}

export interface VATReturnRow {
  label: string;
  amount: number;
  vat: number;
}

export interface VATReturnDocumentCounts {
  sales_invoice_count: number;
  purchase_invoice_count: number;
  credit_note_count: number;
  debit_note_count: number;
  total_document_count: number;
}

export interface VATReturnSummary {
  sections: VATReturnRow[];
  counts: VATReturnDocumentCounts;
  netVATPayable: number;
}

function exemptAmountForInvoice(invoice: VATReturnInvoiceInput): number {
  if (!invoice.is_vat_invoice) return Number(invoice.total_amount);

  return (invoice.invoice_items || [])
    .filter((item) => item.tax_type === "exempt" || item.tax_type === "non_taxable")
    .reduce((sum, item) => sum + Number(item.total_amount), 0);
}

export function calculateVATReturnSummary(invoices: VATReturnInvoiceInput[]): VATReturnSummary {
  let salesTaxable = 0, salesVAT = 0, salesExempt = 0;
  let purchaseTaxable = 0, purchaseVAT = 0, purchaseExempt = 0;
  let saleReturnTaxable = 0, saleReturnVAT = 0;
  let purchaseReturnTaxable = 0, purchaseReturnVAT = 0;
  const counts: VATReturnDocumentCounts = {
    sales_invoice_count: 0,
    purchase_invoice_count: 0,
    credit_note_count: 0,
    debit_note_count: 0,
    total_document_count: 0,
  };

  for (const inv of invoices) {
    const taxable = Number(inv.taxable_amount);
    const vat = Number(inv.vat_amount);
    const exempt = exemptAmountForInvoice(inv);

    if (inv.type === "sale") {
      salesTaxable += taxable;
      salesVAT += vat;
      salesExempt += exempt;
      counts.sales_invoice_count += 1;
    } else if (inv.type === "purchase") {
      purchaseTaxable += taxable;
      purchaseVAT += vat;
      purchaseExempt += exempt;
      counts.purchase_invoice_count += 1;
    } else if (inv.type === "sale_return") {
      saleReturnTaxable += taxable;
      saleReturnVAT += vat;
      counts.credit_note_count += 1;
    } else if (inv.type === "purchase_return") {
      purchaseReturnTaxable += taxable;
      purchaseReturnVAT += vat;
      counts.debit_note_count += 1;
    }
  }

  counts.total_document_count =
    counts.sales_invoice_count +
    counts.purchase_invoice_count +
    counts.credit_note_count +
    counts.debit_note_count;

  const netSalesTaxable = salesTaxable - saleReturnTaxable;
  const netSalesVAT = salesVAT - saleReturnVAT;
  const netPurchaseTaxable = purchaseTaxable - purchaseReturnTaxable;
  const netPurchaseVAT = purchaseVAT - purchaseReturnVAT;
  const netVATPayable = netSalesVAT - netPurchaseVAT;

  return {
    sections: [
      { label: "Taxable Sales", amount: salesTaxable, vat: salesVAT },
      { label: "Exempt Sales", amount: salesExempt, vat: 0 },
      { label: "Sales Return (CN)", amount: saleReturnTaxable, vat: saleReturnVAT },
      { label: "Net Taxable Sales", amount: netSalesTaxable, vat: netSalesVAT },
      { label: "Taxable Purchases", amount: purchaseTaxable, vat: purchaseVAT },
      { label: "Exempt Purchases", amount: purchaseExempt, vat: 0 },
      { label: "Purchase Return (DN)", amount: purchaseReturnTaxable, vat: purchaseReturnVAT },
      { label: "Net Taxable Purchases", amount: netPurchaseTaxable, vat: netPurchaseVAT },
    ],
    counts,
    netVATPayable,
  };
}
