export interface VATBookInvoiceInput {
  invoice_number: string;
  document_serial: number | null;
  issued_date_bs: string;
  fiscal_year: string | null;
  vat_period: string | null;
  is_vat_invoice: boolean;
  buyer_name: string | null;
  buyer_pan: string | null;
  total_amount: number;
  taxable_amount: number;
  vat_amount: number;
  invoice_items?: Array<{ tax_type?: string | null; total_amount: number }> | null;
  customer?: { name?: string | null; pan_number?: string | null } | null;
  vendor?: { name?: string | null; pan_number?: string | null } | null;
}

export interface VATBookRow {
  sn: number;
  invoice_number: string;
  document_serial: number | null;
  date_bs: string;
  fiscal_year: string;
  vat_period: string;
  taxpayer_pan: string;
  buyer_pan: string;
  buyer_name: string;
  total_sales: number;
  exempt_sales: number;
  taxable_amount: number;
  vat_amount: number;
}

export function buildVATBookRows(
  invoices: VATBookInvoiceInput[],
  taxpayerPan: string | null | undefined,
  annexType: "sales" | "purchases"
) {
  const rows: VATBookRow[] = invoices.map((inv, idx) => {
    const party = annexType === "sales" ? inv.customer : inv.vendor;
    const totalAmt = Number(inv.total_amount);
    const exemptLines = (inv.invoice_items || [])
      .filter((item) => item.tax_type === "exempt" || item.tax_type === "non_taxable")
      .reduce((sum, item) => sum + Number(item.total_amount), 0);

    return {
      sn: idx + 1,
      invoice_number: inv.invoice_number,
      document_serial: inv.document_serial,
      date_bs: inv.issued_date_bs,
      fiscal_year: inv.fiscal_year || "Accountant review",
      vat_period: inv.vat_period || "Accountant review",
      taxpayer_pan: taxpayerPan || "Accountant review",
      buyer_pan: inv.buyer_pan || party?.pan_number || "Accountant review",
      buyer_name: inv.buyer_name || party?.name || "Accountant review",
      total_sales: totalAmt,
      exempt_sales: inv.is_vat_invoice ? exemptLines : totalAmt,
      taxable_amount: Number(inv.taxable_amount),
      vat_amount: Number(inv.vat_amount),
    };
  });

  const totals = rows.reduce((a, r) => ({
    total_sales: a.total_sales + r.total_sales,
    exempt_sales: a.exempt_sales + r.exempt_sales,
    taxable_amount: a.taxable_amount + r.taxable_amount,
    vat_amount: a.vat_amount + r.vat_amount,
  }), { total_sales: 0, exempt_sales: 0, taxable_amount: 0, vat_amount: 0 });

  return { rows, totals, count: rows.length };
}
