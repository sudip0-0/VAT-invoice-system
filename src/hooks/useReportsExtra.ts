import { useQuery } from '@tanstack/react-query';
import { localDb } from '@/integrations/local-db/client';
import { useBusiness } from '@/contexts/BusinessContext';
import { calculateVATReturnSummary, type VATReturnPaymentDetail } from '@/lib/vat-return';
import { analyzeFiscalSequences } from '@/lib/fiscal-sequence-review';
export type { VATReturnRow } from '@/lib/vat-return';

// ── Item-wise Sales/Purchase ──

export interface ItemWiseRow {
  item_name: string;
  code: string | null;
  unit: string;
  qty_sold: number;
  sales_amount: number;
  qty_purchased: number;
  purchase_amount: number;
}

export function useItemWiseSalesPurchase(dateFrom: string, dateTo: string) {
  const { business } = useBusiness();

  return useQuery({
    queryKey: ['report-item-wise', business?.id, dateFrom, dateTo],
    enabled: !!business?.id && !!dateFrom && !!dateTo,
    queryFn: async () => {
      const { data: invoices, error } = await localDb
        .from('invoices')
        .select('type, invoice_items(item_id, name, unit, quantity, total_amount)')
        .eq('business_id', business!.id)
        .is('deleted_at', null)
        .neq('status', 'cancelled')
        .in('type', ['sale', 'purchase'])
        .gte('issued_date_ad', dateFrom)
        .lte('issued_date_ad', dateTo);
      if (error) throw error;

      // Get item codes
      const itemIds = new Set<string>();
      for (const inv of invoices || []) {
        for (const it of inv.invoice_items || []) {
          if (it.item_id) itemIds.add(it.item_id);
        }
      }
      let codeMap = new Map<string, string>();
      if (itemIds.size > 0) {
        const { data: items } = await localDb.from('items').select('id, code').in('id', Array.from(itemIds));
        for (const it of items || []) if (it.code) codeMap.set(it.id, it.code);
      }

      const map = new Map<string, ItemWiseRow>();
      for (const inv of invoices || []) {
        for (const it of (inv as any).invoice_items || []) {
          const key = it.item_id || it.name;
          const existing = map.get(key) || { item_name: it.name, code: it.item_id ? (codeMap.get(it.item_id) || null) : null, unit: it.unit, qty_sold: 0, sales_amount: 0, qty_purchased: 0, purchase_amount: 0 };
          if (inv.type === 'sale') {
            existing.qty_sold += Number(it.quantity);
            existing.sales_amount += Number(it.total_amount);
          } else {
            existing.qty_purchased += Number(it.quantity);
            existing.purchase_amount += Number(it.total_amount);
          }
          map.set(key, existing);
        }
      }

      const rows = Array.from(map.values()).sort((a, b) => (b.sales_amount + b.purchase_amount) - (a.sales_amount + a.purchase_amount));
      const totals = rows.reduce((a, r) => ({
        qty_sold: a.qty_sold + r.qty_sold,
        sales_amount: a.sales_amount + r.sales_amount,
        qty_purchased: a.qty_purchased + r.qty_purchased,
        purchase_amount: a.purchase_amount + r.purchase_amount,
      }), { qty_sold: 0, sales_amount: 0, qty_purchased: 0, purchase_amount: 0 });

      return { rows, totals };
    },
  });
}

// ── Low Stock Alert ──

export interface LowStockRow {
  item_name: string;
  code: string | null;
  unit: string;
  current_stock: number;
  low_stock_alert: number;
  purchase_price: number;
  sale_price: number;
}

export function useLowStockAlert() {
  const { business } = useBusiness();

  return useQuery({
    queryKey: ['report-low-stock', business?.id],
    enabled: !!business?.id,
    queryFn: async () => {
      const { data, error } = await localDb
        .from('items')
        .select('name, code, unit, current_stock, low_stock_alert, purchase_price, sale_price')
        .eq('business_id', business!.id)
        .eq('type', 'product')
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('current_stock');
      if (error) throw error;

      return (data || [])
        .filter(it => it.low_stock_alert != null && Number(it.current_stock) <= Number(it.low_stock_alert))
        .map(it => ({
          item_name: it.name,
          code: it.code,
          unit: it.unit,
          current_stock: Number(it.current_stock),
          low_stock_alert: Number(it.low_stock_alert),
          purchase_price: Number(it.purchase_price || 0),
          sale_price: Number(it.sale_price),
        })) as LowStockRow[];
    },
  });
}

// ── Day Book ──

export interface DayBookEntry {
  date_bs: string;
  date_ad: string;
  time: string;
  type: 'invoice' | 'payment';
  ref_number: string;
  party_name: string;
  description: string;
  debit: number;
  credit: number;
}

export function useDayBook(dateFrom: string, dateTo: string) {
  const { business } = useBusiness();

  return useQuery({
    queryKey: ['report-daybook', business?.id, dateFrom, dateTo],
    enabled: !!business?.id && !!dateFrom && !!dateTo,
    queryFn: async () => {
      const [{ data: invoices, error: iErr }, { data: payments, error: pErr }] = await Promise.all([
        localDb.from('invoices')
          .select('invoice_number, type, issued_date_bs, issued_date_ad, buyer_name, total_amount, created_at, customer:parties!invoices_customer_id_fkey(name), vendor:parties!invoices_vendor_id_fkey(name)')
          .eq('business_id', business!.id).is('deleted_at', null).neq('status', 'cancelled')
          .gte('issued_date_ad', dateFrom).lte('issued_date_ad', dateTo)
          .order('issued_date_ad'),
        localDb.from('payments')
          .select('payment_date_bs, payment_date_ad, amount, method, reference, created_at, party:parties(name)')
          .eq('business_id', business!.id).eq('status', 'completed')
          .gte('payment_date_ad', dateFrom).lte('payment_date_ad', dateTo)
          .order('payment_date_ad'),
      ]);
      if (iErr) throw iErr;
      if (pErr) throw pErr;

      const entries: (DayBookEntry & { sort_date: string; sort_time: string })[] = [];

      for (const inv of invoices || []) {
        const isSale = inv.type === 'sale';
        const party = (inv as any).buyer_name || (inv as any).customer?.name || (inv as any).vendor?.name || '—';
        const amt = Number(inv.total_amount);
        const time = new Date(inv.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        entries.push({
          sort_date: inv.issued_date_ad, sort_time: inv.created_at,
          date_bs: inv.issued_date_bs, date_ad: inv.issued_date_ad,
          time, type: 'invoice', ref_number: inv.invoice_number,
          party_name: party,
          description: isSale ? 'Sale Invoice' : inv.type === 'purchase' ? 'Purchase Bill' : `${inv.type}`,
          debit: isSale ? amt : 0,
          credit: !isSale ? amt : 0,
        });
      }

      for (const p of payments || []) {
        const time = new Date(p.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        entries.push({
          sort_date: p.payment_date_ad, sort_time: p.created_at,
          date_bs: p.payment_date_bs, date_ad: p.payment_date_ad,
          time, type: 'payment', ref_number: p.reference || '—',
          party_name: (p as any).party?.name || '—',
          description: `Payment (${p.method.replace('_', ' ')})`,
          debit: 0, credit: Number(p.amount),
        });
      }

      entries.sort((a, b) => a.sort_date.localeCompare(b.sort_date) || a.sort_time.localeCompare(b.sort_time));

      const totals = entries.reduce((a, r) => ({ debit: a.debit + r.debit, credit: a.credit + r.credit }), { debit: 0, credit: 0 });

      return { entries: entries as DayBookEntry[], totals };
    },
  });
}

// ── Credit Note / Debit Note Register ──

export interface CNDNRow {
  date_bs: string;
  invoice_number: string;
  original_invoice_number: string;
  fiscal_year: string;
  party_name: string;
  type: string;
  taxable_amount: number;
  vat_amount: number;
  total_amount: number;
  status: string;
}

export function useCNDNRegister(dateFrom: string, dateTo: string) {
  const { business } = useBusiness();

  return useQuery({
    queryKey: ['report-cndn', business?.id, dateFrom, dateTo],
    enabled: !!business?.id && !!dateFrom && !!dateTo,
    queryFn: async () => {
      const { data, error } = await localDb
        .from('invoices')
        .select('invoice_number, original_invoice_number, fiscal_year, type, issued_date_bs, buyer_name, taxable_amount, vat_amount, total_amount, status, customer:parties!invoices_customer_id_fkey(name), vendor:parties!invoices_vendor_id_fkey(name)')
        .eq('business_id', business!.id)
        .is('deleted_at', null)
        .in('type', ['sale_return', 'purchase_return'])
        .gte('issued_date_ad', dateFrom)
        .lte('issued_date_ad', dateTo)
        .order('issued_date_ad');
      if (error) throw error;

      const rows: CNDNRow[] = (data || []).map((inv: any) => ({
        date_bs: inv.issued_date_bs,
        invoice_number: inv.invoice_number,
        original_invoice_number: inv.original_invoice_number || 'Accountant review',
        fiscal_year: inv.fiscal_year || 'Accountant review',
        party_name: inv.buyer_name || inv.customer?.name || inv.vendor?.name || '—',
        type: inv.type === 'sale_return' ? 'Credit Note' : 'Debit Note',
        taxable_amount: Number(inv.taxable_amount),
        vat_amount: Number(inv.vat_amount),
        total_amount: Number(inv.total_amount),
        status: inv.status,
      }));

      const totals = { credit_notes: 0, debit_notes: 0 };
      for (const r of rows) {
        if (r.type === 'Credit Note') totals.credit_notes += r.total_amount;
        else totals.debit_notes += r.total_amount;
      }

      return { rows, totals };
    },
  });
}

// ── Outstanding Report ──

export interface OutstandingRow {
  invoice_number: string;
  date_bs: string;
  due_date_bs: string | null;
  party_name: string;
  type: string;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  days_overdue: number;
}

export function useOutstandingReport(dateFrom: string, dateTo: string) {
  const { business } = useBusiness();

  return useQuery({
    queryKey: ['report-outstanding', business?.id, dateFrom, dateTo],
    enabled: !!business?.id && !!dateFrom && !!dateTo,
    queryFn: async () => {
      const { data, error } = await localDb
        .from('invoices')
        .select('invoice_number, type, issued_date_bs, issued_date_ad, due_date_bs, due_date_ad, buyer_name, total_amount, paid_amount, balance_due, status, customer:parties!invoices_customer_id_fkey(name), vendor:parties!invoices_vendor_id_fkey(name)')
        .eq('business_id', business!.id)
        .is('deleted_at', null)
        .in('status', ['issued', 'partially_paid', 'overdue'])
        .gte('issued_date_ad', dateFrom)
        .lte('issued_date_ad', dateTo)
        .order('issued_date_ad');
      if (error) throw error;

      const now = new Date();
      const rows: OutstandingRow[] = (data || []).map((inv: any) => {
        const dueDate = inv.due_date_ad ? new Date(inv.due_date_ad) : null;
        const daysOverdue = dueDate ? Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))) : 0;
        return {
          invoice_number: inv.invoice_number,
          date_bs: inv.issued_date_bs,
          due_date_bs: inv.due_date_bs,
          party_name: inv.buyer_name || inv.customer?.name || inv.vendor?.name || '—',
          type: inv.type === 'sale' ? 'Receivable' : 'Payable',
          total_amount: Number(inv.total_amount),
          paid_amount: Number(inv.paid_amount),
          balance_due: Number(inv.balance_due),
          days_overdue: daysOverdue,
        };
      });

      const totals = rows.reduce((a, r) => ({
        total_amount: a.total_amount + r.total_amount,
        paid_amount: a.paid_amount + r.paid_amount,
        balance_due: a.balance_due + r.balance_due,
      }), { total_amount: 0, paid_amount: 0, balance_due: 0 });

      return { rows, totals };
    },
  });
}

// ── VAT Return Summary (Nepal IRD format) ──

export function useVATReturnSummary(dateFrom: string, dateTo: string) {
  const { business } = useBusiness();

  return useQuery({
    queryKey: ['report-vat-return', business?.id, dateFrom, dateTo],
    enabled: !!business?.id && !!dateFrom && !!dateTo,
    queryFn: async () => {
      const [{ data, error }, { data: payments, error: paymentError }] = await Promise.all([
        localDb
          .from('invoices')
          .select('type, is_vat_invoice, taxable_amount, vat_amount, total_amount, invoice_items(tax_type, total_amount)')
          .eq('business_id', business!.id)
          .is('deleted_at', null)
          .neq('status', 'cancelled')
          .gte('issued_date_ad', dateFrom)
          .lte('issued_date_ad', dateTo),
        localDb
          .from('payments')
          .select('payment_date_bs, method, reference, amount, bank_name, cheque_number')
          .eq('business_id', business!.id)
          .eq('status', 'completed')
          .gte('payment_date_ad', dateFrom)
          .lte('payment_date_ad', dateTo)
          .order('payment_date_ad'),
      ]);
      if (error) throw error;
      if (paymentError) throw paymentError;

      const paymentDetails: VATReturnPaymentDetail[] = (payments || []).map((payment: any) => ({
        date_bs: payment.payment_date_bs,
        method: payment.method,
        reference: payment.reference || null,
        amount: Number(payment.amount),
        bank_name: payment.bank_name || null,
        cheque_number: payment.cheque_number || null,
      }));

      return calculateVATReturnSummary((data || []) as any, paymentDetails);
    },
  });
}

// ── Daily Summary / Tally Sheet ──

export interface DailySummaryRow {
  date_bs: string;
  date_ad: string;
  total_sales: number;
  total_purchases: number;
  total_payments_in: number;
  total_payments_out: number;
  invoice_count: number;
  payment_count: number;
}

export function useDailySummary(dateFrom: string, dateTo: string) {
  const { business } = useBusiness();

  return useQuery({
    queryKey: ['report-daily-summary', business?.id, dateFrom, dateTo],
    enabled: !!business?.id && !!dateFrom && !!dateTo,
    queryFn: async () => {
      const [{ data: invoices, error: iErr }, { data: payments, error: pErr }] = await Promise.all([
        localDb.from('invoices')
          .select('type, issued_date_bs, issued_date_ad, total_amount')
          .eq('business_id', business!.id).is('deleted_at', null).neq('status', 'cancelled')
          .in('type', ['sale', 'purchase'])
          .gte('issued_date_ad', dateFrom).lte('issued_date_ad', dateTo),
        localDb.from('payments')
          .select('payment_date_bs, payment_date_ad, amount, invoice:invoices(type)')
          .eq('business_id', business!.id).eq('status', 'completed')
          .gte('payment_date_ad', dateFrom).lte('payment_date_ad', dateTo),
      ]);
      if (iErr) throw iErr;
      if (pErr) throw pErr;

      const map = new Map<string, DailySummaryRow>();

      for (const inv of invoices || []) {
        const key = inv.issued_date_ad;
        const existing = map.get(key) || { date_bs: inv.issued_date_bs, date_ad: inv.issued_date_ad, total_sales: 0, total_purchases: 0, total_payments_in: 0, total_payments_out: 0, invoice_count: 0, payment_count: 0 };
        if (inv.type === 'sale') existing.total_sales += Number(inv.total_amount);
        else existing.total_purchases += Number(inv.total_amount);
        existing.invoice_count++;
        map.set(key, existing);
      }

      for (const p of payments || []) {
        const key = p.payment_date_ad;
        const existing = map.get(key) || { date_bs: p.payment_date_bs, date_ad: p.payment_date_ad, total_sales: 0, total_purchases: 0, total_payments_in: 0, total_payments_out: 0, invoice_count: 0, payment_count: 0 };
        const isSaleRelated = (p as any).invoice?.type === 'sale' || !(p as any).invoice;
        if (isSaleRelated) existing.total_payments_in += Number(p.amount);
        else existing.total_payments_out += Number(p.amount);
        existing.payment_count++;
        map.set(key, existing);
      }

      const rows = Array.from(map.values()).sort((a, b) => a.date_ad.localeCompare(b.date_ad));
      const totals = rows.reduce((a, r) => ({
        total_sales: a.total_sales + r.total_sales,
        total_purchases: a.total_purchases + r.total_purchases,
        total_payments_in: a.total_payments_in + r.total_payments_in,
        total_payments_out: a.total_payments_out + r.total_payments_out,
        invoice_count: a.invoice_count + r.invoice_count,
        payment_count: a.payment_count + r.payment_count,
      }), { total_sales: 0, total_purchases: 0, total_payments_in: 0, total_payments_out: 0, invoice_count: 0, payment_count: 0 });

      return { rows, totals };
    },
  });
}

export function useFiscalSequenceReview() {
  const { business } = useBusiness();

  return useQuery({
    queryKey: ['report-fiscal-sequence-review', business?.id],
    enabled: !!business?.id,
    queryFn: async () => {
      const { data, error } = await localDb
        .from('invoices')
        .select('id, type, invoice_number, fiscal_year, document_serial')
        .eq('business_id', business!.id)
        .is('deleted_at', null)
        .in('type', ['sale', 'purchase', 'quotation', 'sale_return', 'purchase_return']);
      if (error) throw error;
      return analyzeFiscalSequences(data || []);
    },
  });
}
