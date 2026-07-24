export interface VATReturnInvoiceLineInput {
  tax_type?: string | null;
  taxable_amount?: number;
  vat_amount?: number;
  total_amount: number;
  purchase_bucket?: VATPurchaseBucket | null;
}

export type VATPurchaseBucket = "regular" | "import" | "capitalized";

export interface VATReturnInvoiceInput {
  type: string;
  is_vat_invoice: boolean;
  taxable_amount: number;
  vat_amount: number;
  total_amount: number;
  purchase_bucket?: VATPurchaseBucket | null;
  invoice_items?: VATReturnInvoiceLineInput[] | null;
}

export interface VATReturnRow {
  label: string;
  amount: number;
  vat: number;
}

export interface VATReturnPaymentDetail {
  date_bs: string;
  method: string;
  reference: string | null;
  amount: number;
  bank_name?: string | null;
  cheque_number?: string | null;
}

export interface VATReturnDocumentCounts {
  sales_invoice_count: number;
  purchase_invoice_count: number;
  credit_note_count: number;
  debit_note_count: number;
  vat_sales_invoice_count: number;
  vat_purchase_invoice_count: number;
  total_document_count: number;
}

export interface VATReturnPurchaseBuckets {
  local_taxable_purchase: VATReturnRow;
  import_taxable_purchase: VATReturnRow;
  capitalized_taxable_purchase: VATReturnRow;
}

export interface VATReturnSummary {
  sections: VATReturnRow[];
  counts: VATReturnDocumentCounts;
  purchaseBuckets: VATReturnPurchaseBuckets;
  paymentDetails: VATReturnPaymentDetail[];
  refundReason: string;
  accountantReviewPlaceholders: string[];
  netVATPayable: number;
  adjustments: VATReturnAdjustmentInput[];
}

export interface VATReturnAdjustmentInput {
  field_key: string;
  amount: number;
  note?: string | null;
}

function exemptAmountForInvoice(invoice: VATReturnInvoiceInput): number {
  if (!invoice.is_vat_invoice) return Number(invoice.total_amount);

  return (invoice.invoice_items || [])
    .filter((item) => item.tax_type === "exempt" || item.tax_type === "non_taxable")
    .reduce((sum, item) => sum + Number(item.total_amount), 0);
}

export function applyVATReturnAdjustments(
  summary: Omit<VATReturnSummary, "adjustments"> & { adjustments?: VATReturnAdjustmentInput[] },
  adjustments: VATReturnAdjustmentInput[] = []
): VATReturnSummary {
  const next = {
    ...summary,
    purchaseBuckets: {
      local_taxable_purchase: { ...summary.purchaseBuckets.local_taxable_purchase },
      import_taxable_purchase: { ...summary.purchaseBuckets.import_taxable_purchase },
      capitalized_taxable_purchase: { ...summary.purchaseBuckets.capitalized_taxable_purchase },
    },
    adjustments: [...adjustments],
  };

  let refundOverride: string | null = null;
  for (const adj of adjustments) {
    const amount = Number(adj.amount) || 0;
    if (adj.field_key === "import_taxable") {
      next.purchaseBuckets.import_taxable_purchase.amount += amount;
    } else if (adj.field_key === "capitalized_taxable") {
      next.purchaseBuckets.capitalized_taxable_purchase.amount += amount;
    } else if (adj.field_key === "import_vat") {
      next.purchaseBuckets.import_taxable_purchase.vat += amount;
    } else if (adj.field_key === "capitalized_vat") {
      next.purchaseBuckets.capitalized_taxable_purchase.vat += amount;
    } else if (adj.field_key === "refund_reason" && adj.note) {
      refundOverride = adj.note;
    }
  }

  if (refundOverride) {
    next.refundReason = refundOverride;
  }

  next.accountantReviewPlaceholders = [
    "This Schedule 10 pack is a review aid — not an IRD filing submission.",
    ...summary.accountantReviewPlaceholders.filter((p) => !p.includes("Payment voucher")),
    ...adjustments
      .filter((adj) => adj.field_key === "payment_voucher_ref" && adj.note)
      .map((adj) => `Payment voucher ref: ${adj.note}`),
  ];

  return next as VATReturnSummary;
}

export function calculateVATReturnSummary(
  invoices: VATReturnInvoiceInput[],
  paymentDetails: VATReturnPaymentDetail[] = [],
  adjustments: VATReturnAdjustmentInput[] = []
): VATReturnSummary {
  let salesTaxable = 0, salesVAT = 0, salesExempt = 0;
  let purchaseTaxable = 0, purchaseVAT = 0, purchaseExempt = 0;
  let saleReturnTaxable = 0, saleReturnVAT = 0;
  let purchaseReturnTaxable = 0, purchaseReturnVAT = 0;
  const purchaseBuckets: VATReturnPurchaseBuckets = {
    local_taxable_purchase: { label: "Local Taxable Purchases", amount: 0, vat: 0 },
    import_taxable_purchase: { label: "Taxable Imports", amount: 0, vat: 0 },
    capitalized_taxable_purchase: { label: "Capitalized Taxable Purchases", amount: 0, vat: 0 },
  };
  const counts: VATReturnDocumentCounts = {
    sales_invoice_count: 0,
    purchase_invoice_count: 0,
    credit_note_count: 0,
    debit_note_count: 0,
    vat_sales_invoice_count: 0,
    vat_purchase_invoice_count: 0,
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
      if (inv.is_vat_invoice) counts.vat_sales_invoice_count += 1;
    } else if (inv.type === "purchase") {
      purchaseTaxable += taxable;
      purchaseVAT += vat;
      purchaseExempt += exempt;
      counts.purchase_invoice_count += 1;
      if (inv.is_vat_invoice) counts.vat_purchase_invoice_count += 1;
      const bucket = inv.purchase_bucket || "regular";
      if (bucket === "import") {
        purchaseBuckets.import_taxable_purchase.amount += taxable;
        purchaseBuckets.import_taxable_purchase.vat += vat;
      } else if (bucket === "capitalized") {
        purchaseBuckets.capitalized_taxable_purchase.amount += taxable;
        purchaseBuckets.capitalized_taxable_purchase.vat += vat;
      } else {
        purchaseBuckets.local_taxable_purchase.amount += taxable;
        purchaseBuckets.local_taxable_purchase.vat += vat;
      }
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
  const refundReason = netVATPayable < 0 ? "Accountant review required before claiming refund." : "Not applicable";

  const base = {
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
    purchaseBuckets,
    paymentDetails,
    refundReason,
    accountantReviewPlaceholders: [
      "Payment voucher submission details require accountant review before filing.",
      "Import and capitalized purchase buckets are only as accurate as captured document metadata.",
      "Refund reason must be reviewed when VAT is refundable.",
      "Accountant-reviewed filing sign-off is not stored in this app.",
    ],
    netVATPayable,
  };

  return applyVATReturnAdjustments(base, adjustments);
}
