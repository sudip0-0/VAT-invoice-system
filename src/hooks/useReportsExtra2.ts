import { useQuery } from '@tanstack/react-query';
import { localDb } from '@/integrations/local-db/client';
import { useBusiness } from '@/contexts/BusinessContext';
import { buildVATBookRows, type VATBookRow } from '@/lib/vat-books';

// ── Trial Balance ──

export interface TrialBalanceRow {
  account_name: string;
  type: 'asset' | 'liability' | 'income' | 'expense';
  debit: number;
  credit: number;
}

export function useTrialBalance(dateFrom: string, dateTo: string) {
  const { business } = useBusiness();

  return useQuery({
    queryKey: ['report-trial-balance', business?.id, dateFrom, dateTo],
    enabled: !!business?.id && !!dateFrom && !!dateTo,
    queryFn: async () => {
      const [{ data: invoices, error: iErr }, { data: payments, error: pErr }, { data: expenses, error: eErr }] = await Promise.all([
        localDb.from('invoices')
          .select('type, total_amount, vat_amount, discount_amount')
          .eq('business_id', business!.id).is('deleted_at', null).neq('status', 'cancelled')
          .gte('issued_date_ad', dateFrom).lte('issued_date_ad', dateTo),
        localDb.from('payments')
          .select('amount, invoice:invoices(type)')
          .eq('business_id', business!.id).eq('status', 'completed')
          .gte('payment_date_ad', dateFrom).lte('payment_date_ad', dateTo),
        localDb.from('expenses')
          .select('amount')
          .eq('business_id', business!.id).is('deleted_at', null)
          .gte('expense_date_ad', dateFrom).lte('expense_date_ad', dateTo),
      ]);
      if (iErr) throw iErr;
      if (pErr) throw pErr;
      if (eErr) throw eErr;

      let salesRevenue = 0, purchaseExpense = 0, salesVAT = 0, purchaseVAT = 0;
      let salesDiscount = 0, saleReturnAmt = 0, purchaseReturnAmt = 0;

      for (const inv of invoices || []) {
        const amt = Number(inv.total_amount);
        if (inv.type === 'sale') {
          salesRevenue += amt;
          salesVAT += Number(inv.vat_amount);
          salesDiscount += Number(inv.discount_amount);
        } else if (inv.type === 'purchase') {
          purchaseExpense += amt;
          purchaseVAT += Number(inv.vat_amount);
        } else if (inv.type === 'sale_return') {
          saleReturnAmt += amt;
        } else if (inv.type === 'purchase_return') {
          purchaseReturnAmt += amt;
        }
      }

      let cashReceived = 0, cashPaid = 0;
      for (const p of payments || []) {
        const isSale = (p as any).invoice?.type === 'sale' || !(p as any).invoice;
        if (isSale) cashReceived += Number(p.amount);
        else cashPaid += Number(p.amount);
      }
      const operatingExpenses = (expenses || []).reduce((sum, expense) => sum + Number(expense.amount), 0);

      // Build trial balance rows
      const rows: TrialBalanceRow[] = ([
        // Assets (debit balances)
        { account_name: 'Cash & Bank (Received)', type: 'asset' as const, debit: cashReceived, credit: 0 },
        { account_name: 'Accounts Receivable', type: 'asset' as const, debit: Math.max(0, salesRevenue - cashReceived), credit: 0 },
        { account_name: 'Purchase Returns', type: 'asset' as const, debit: purchaseReturnAmt, credit: 0 },
        // Expenses (debit balances)
        { account_name: 'Purchases', type: 'expense' as const, debit: purchaseExpense, credit: 0 },
        { account_name: 'Cash & Bank (Paid)', type: 'expense' as const, debit: cashPaid, credit: 0 },
        { account_name: 'Operating Expenses', type: 'expense' as const, debit: operatingExpenses, credit: 0 },
        { account_name: 'Sales Discount', type: 'expense' as const, debit: salesDiscount, credit: 0 },
        // Income (credit balances)
        { account_name: 'Sales Revenue', type: 'income' as const, debit: 0, credit: salesRevenue },
        { account_name: 'Sale Returns', type: 'liability' as const, debit: 0, credit: saleReturnAmt },
        // Liabilities (credit balances)
        { account_name: 'Accounts Payable', type: 'liability' as const, debit: 0, credit: Math.max(0, purchaseExpense - cashPaid) },
        { account_name: 'VAT Output (Sales)', type: 'liability' as const, debit: 0, credit: salesVAT },
        { account_name: 'VAT Input (Purchases)', type: 'asset' as const, debit: purchaseVAT, credit: 0 },
      ] as TrialBalanceRow[]).filter(r => r.debit > 0 || r.credit > 0);

      const totalDebit = rows.reduce((a, r) => a + r.debit, 0);
      const totalCredit = rows.reduce((a, r) => a + r.credit, 0);

      return { rows, totalDebit, totalCredit };
    },
  });
}

// ── Balance Sheet Summary ──

export interface BalanceSheetSection {
  label: string;
  items: { name: string; amount: number }[];
  total: number;
}

export function useBalanceSheetSummary(dateTo: string) {
  const { business } = useBusiness();

  return useQuery({
    queryKey: ['report-balance-sheet', business?.id, dateTo],
    enabled: !!business?.id && !!dateTo,
    queryFn: async () => {
      const [{ data: invoices, error: iErr }, { data: payments, error: pErr }, { data: items, error: itErr }, { data: expenses, error: eErr }] = await Promise.all([
        localDb.from('invoices')
          .select('type, total_amount, paid_amount, balance_due, vat_amount')
          .eq('business_id', business!.id).is('deleted_at', null).neq('status', 'cancelled')
          .lte('issued_date_ad', dateTo),
        localDb.from('payments')
          .select('amount, invoice:invoices(type)')
          .eq('business_id', business!.id).eq('status', 'completed')
          .lte('payment_date_ad', dateTo),
        localDb.from('items')
          .select('current_stock, purchase_price')
          .eq('business_id', business!.id).eq('type', 'product').eq('is_active', true).is('deleted_at', null),
        localDb.from('expenses')
          .select('amount')
          .eq('business_id', business!.id).is('deleted_at', null)
          .lte('expense_date_ad', dateTo),
      ]);
      if (iErr) throw iErr;
      if (pErr) throw pErr;
      if (itErr) throw itErr;
      if (eErr) throw eErr;

      // Inventory valuation
      let inventoryValue = 0;
      for (const it of items || []) {
        inventoryValue += Number(it.current_stock) * Number(it.purchase_price || 0);
      }

      // Cash = total received - total paid
      let cashReceived = 0, cashPaid = 0;
      for (const p of payments || []) {
        const isSale = (p as any).invoice?.type === 'sale' || !(p as any).invoice;
        if (isSale) cashReceived += Number(p.amount);
        else cashPaid += Number(p.amount);
      }
      const cashBalance = cashReceived - cashPaid;

      // Receivables & Payables
      let accountsReceivable = 0, accountsPayable = 0;
      let salesVAT = 0, purchaseVAT = 0;
      for (const inv of invoices || []) {
        if (inv.type === 'sale') {
          accountsReceivable += Number(inv.balance_due);
          salesVAT += Number(inv.vat_amount);
        } else if (inv.type === 'purchase') {
          accountsPayable += Number(inv.balance_due);
          purchaseVAT += Number(inv.vat_amount);
        }
      }

      const assets: BalanceSheetSection = {
        label: 'Assets',
        items: [
          { name: 'Cash & Bank', amount: Math.max(0, cashBalance) },
          { name: 'Accounts Receivable', amount: accountsReceivable },
          { name: 'Inventory', amount: Math.max(0, inventoryValue) },
          { name: 'VAT Input Credit', amount: purchaseVAT },
        ].filter(i => i.amount > 0),
        total: 0,
      };
      assets.total = assets.items.reduce((a, i) => a + i.amount, 0);

      const liabilities: BalanceSheetSection = {
        label: 'Liabilities',
        items: [
          { name: 'Accounts Payable', amount: accountsPayable },
          { name: 'VAT Output Liability', amount: salesVAT },
          { name: 'Bank Overdraft', amount: Math.max(0, -cashBalance) },
        ].filter(i => i.amount > 0),
        total: 0,
      };
      liabilities.total = liabilities.items.reduce((a, i) => a + i.amount, 0);

      const equity = assets.total - liabilities.total;
      const retainedEarnings = equity - (expenses || []).reduce((sum, expense) => sum + Number(expense.amount), 0);

      return { assets, liabilities, equity: retainedEarnings };
    },
  });
}

// ── Top Selling Items ──

export interface TopSellingRow {
  item_name: string;
  code: string | null;
  unit: string;
  qty_sold: number;
  total_revenue: number;
  avg_rate: number;
}

export function useTopSellingItems(dateFrom: string, dateTo: string, limit = 20) {
  const { business } = useBusiness();

  return useQuery({
    queryKey: ['report-top-selling', business?.id, dateFrom, dateTo, limit],
    enabled: !!business?.id && !!dateFrom && !!dateTo,
    queryFn: async () => {
      const { data: invoices, error } = await localDb
        .from('invoices')
        .select('invoice_items(item_id, name, unit, quantity, total_amount)')
        .eq('business_id', business!.id)
        .eq('type', 'sale')
        .is('deleted_at', null)
        .neq('status', 'cancelled')
        .gte('issued_date_ad', dateFrom)
        .lte('issued_date_ad', dateTo);
      if (error) throw error;

      const itemIds = new Set<string>();
      const map = new Map<string, { item_name: string; item_id: string | null; unit: string; qty_sold: number; total_revenue: number }>();

      for (const inv of invoices || []) {
        for (const it of (inv as any).invoice_items || []) {
          const key = it.item_id || it.name;
          if (it.item_id) itemIds.add(it.item_id);
          const existing = map.get(key) || { item_name: it.name, item_id: it.item_id, unit: it.unit, qty_sold: 0, total_revenue: 0 };
          existing.qty_sold += Number(it.quantity);
          existing.total_revenue += Number(it.total_amount);
          map.set(key, existing);
        }
      }

      let codeMap = new Map<string, string>();
      if (itemIds.size > 0) {
        const { data: items } = await localDb.from('items').select('id, code').in('id', Array.from(itemIds));
        for (const it of items || []) if (it.code) codeMap.set(it.id, it.code);
      }

      const rows: TopSellingRow[] = Array.from(map.values())
        .map(r => ({
          item_name: r.item_name,
          code: r.item_id ? (codeMap.get(r.item_id) || null) : null,
          unit: r.unit,
          qty_sold: r.qty_sold,
          total_revenue: r.total_revenue,
          avg_rate: r.qty_sold > 0 ? r.total_revenue / r.qty_sold : 0,
        }))
        .sort((a, b) => b.total_revenue - a.total_revenue)
        .slice(0, limit);

      const totalRevenue = rows.reduce((a, r) => a + r.total_revenue, 0);
      const totalQty = rows.reduce((a, r) => a + r.qty_sold, 0);

      return { rows, totalRevenue, totalQty };
    },
  });
}

// ── VAT Annex Reports (Nepal IRD Annex 1–5) ──

export type VATAnnexRow = VATBookRow;

export function useVATAnnex(dateFrom: string, dateTo: string, annexType: 'sales' | 'purchases') {
  const { business } = useBusiness();

  return useQuery({
    queryKey: ['report-vat-annex', business?.id, dateFrom, dateTo, annexType],
    enabled: !!business?.id && !!dateFrom && !!dateTo,
    queryFn: async () => {
      const invoiceType = annexType === 'sales' ? 'sale' : 'purchase';
      const { data, error } = await localDb
        .from('invoices')
        .select('invoice_number, document_serial, issued_date_bs, fiscal_year, vat_period, is_vat_invoice, buyer_name, buyer_pan, total_amount, taxable_amount, vat_amount, invoice_items(tax_type, total_amount), customer:parties!invoices_customer_id_fkey(name, pan_number), vendor:parties!invoices_vendor_id_fkey(name, pan_number)')
        .eq('business_id', business!.id)
        .eq('type', invoiceType)
        .is('deleted_at', null)
        .neq('status', 'cancelled')
        .gte('issued_date_ad', dateFrom)
        .lte('issued_date_ad', dateTo)
        .order('issued_date_ad');
      if (error) throw error;

      return buildVATBookRows((data || []) as any, business?.pan_number, annexType);
    },
  });
}
