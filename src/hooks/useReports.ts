import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';

// ── Party Ledger (used by PartyDetailPage) ──

interface PartyLedgerEntry {
  date_bs: string;
  time: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

export function usePartyLedger(partyId: string | undefined, dateFrom: string, dateTo: string) {
  const { business } = useBusiness();

  return useQuery({
    queryKey: ['report-ledger', business?.id, partyId, dateFrom, dateTo],
    enabled: !!business?.id && !!partyId && !!dateFrom && !!dateTo,
    queryFn: async () => {
      const { data: party, error: partyErr } = await supabase
        .from('parties').select('opening_balance, type').eq('id', partyId!).single();
      if (partyErr) throw partyErr;
      const openingBalance = Number(party?.opening_balance || 0);
      const partyType = party?.type; // 'customer' | 'vendor' | 'both'

      const { data: invoices, error: invErr } = await supabase
        .from('invoices')
        .select('id, invoice_number, type, issued_date_bs, issued_date_ad, total_amount, created_at')
        .eq('business_id', business!.id).is('deleted_at', null).neq('status', 'cancelled')
        .gte('issued_date_ad', dateFrom).lte('issued_date_ad', dateTo)
        .or(`customer_id.eq.${partyId},vendor_id.eq.${partyId}`)
        .order('issued_date_ad');
      if (invErr) throw invErr;

      const { data: payments, error: payErr } = await supabase
        .from('payments')
        .select('id, payment_date_bs, payment_date_ad, amount, method, reference, created_at, invoice_id')
        .eq('business_id', business!.id).eq('party_id', partyId!).eq('status', 'completed')
        .gte('payment_date_ad', dateFrom).lte('payment_date_ad', dateTo)
        .order('payment_date_ad');
      if (payErr) throw payErr;

      // Build a set of invoice IDs to determine payment direction from linked invoice
      const invoiceTypeMap = new Map<string, string>();
      for (const inv of invoices || []) {
        invoiceTypeMap.set(inv.id, inv.type);
      }

      const entries: { date_ad: string; created_at: string; date_bs: string; description: string; debit: number; credit: number }[] = [];
      for (const inv of invoices || []) {
        const isSale = inv.type === 'sale';
        entries.push({ date_ad: inv.issued_date_ad, created_at: inv.created_at, date_bs: inv.issued_date_bs, description: `${isSale ? 'Invoice' : 'Bill'} ${inv.invoice_number}`, debit: isSale ? Number(inv.total_amount) : 0, credit: !isSale ? Number(inv.total_amount) : 0 });
      }
      for (const p of payments || []) {
        const amt = Number(p.amount);
        const desc = `Payment (${p.method.replace('_', ' ')})${p.reference ? ` - ${p.reference}` : ''}`;
        
        // Determine if this is a payment in or payment out
        let isPaymentOut = false;
        if (p.invoice_id) {
          const invType = invoiceTypeMap.get(p.invoice_id);
          isPaymentOut = invType === 'purchase' || invType === 'purchase_return';
        } else {
          // Standalone payment: direction based on party type
          isPaymentOut = partyType === 'vendor';
        }

        if (isPaymentOut) {
          // Payment out to vendor = debit (reduces payable)
          entries.push({ date_ad: p.payment_date_ad, created_at: p.created_at, date_bs: p.payment_date_bs, description: desc, debit: amt, credit: 0 });
        } else {
          // Payment in from customer = credit (reduces receivable)
          entries.push({ date_ad: p.payment_date_ad, created_at: p.created_at, date_bs: p.payment_date_bs, description: desc, debit: 0, credit: amt });
        }
      }
      entries.sort((a, b) => a.date_ad.localeCompare(b.date_ad) || a.created_at.localeCompare(b.created_at));

      let balance = openingBalance;
      const ledger: PartyLedgerEntry[] = [{ date_bs: '—', time: '—', description: 'Opening Balance', debit: openingBalance > 0 ? openingBalance : 0, credit: openingBalance < 0 ? Math.abs(openingBalance) : 0, balance: openingBalance }];
      for (const e of entries) {
        balance += e.debit - e.credit;
        const time = new Date(e.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        ledger.push({ date_bs: e.date_bs, time, description: e.description, debit: e.debit, credit: e.credit, balance });
      }
      return { entries: ledger, closingBalance: balance };
    },
  });
}

// ── Sales / Purchase Report ──

interface SalesReportRow {
  date_bs: string;
  invoice_number: string;
  party_name: string;
  type: string;
  sub_total: number;
  discount: number;
  taxable: number;
  vat: number;
  total: number;
}

export function useSalesReport(dateFrom: string, dateTo: string) {
  const { business } = useBusiness();

  return useQuery({
    queryKey: ['report-sales', business?.id, dateFrom, dateTo],
    enabled: !!business?.id && !!dateFrom && !!dateTo,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, customer:parties!invoices_customer_id_fkey(name), vendor:parties!invoices_vendor_id_fkey(name)')
        .eq('business_id', business!.id)
        .is('deleted_at', null)
        .neq('status', 'cancelled')
        .gte('issued_date_ad', dateFrom)
        .lte('issued_date_ad', dateTo)
        .order('issued_date_ad');
      if (error) throw error;

      const rows: SalesReportRow[] = (data || []).map((inv: any) => ({
        date_bs: inv.issued_date_bs,
        invoice_number: inv.invoice_number,
        party_name: inv.customer?.name || inv.vendor?.name || '—',
        type: inv.type,
        sub_total: Number(inv.sub_total),
        discount: Number(inv.discount_amount),
        taxable: Number(inv.taxable_amount),
        vat: Number(inv.vat_amount),
        total: Number(inv.total_amount),
      }));

      const totals = rows.reduce(
        (acc, r) => ({
          sub_total: acc.sub_total + r.sub_total,
          discount: acc.discount + r.discount,
          taxable: acc.taxable + r.taxable,
          vat: acc.vat + r.vat,
          total: acc.total + r.total,
        }),
        { sub_total: 0, discount: 0, taxable: 0, vat: 0, total: 0 }
      );

      return { rows, totals };
    },
  });
}

// ── VAT Summary ──

interface VATSummaryRow {
  period: string;
  sales_taxable: number;
  sales_vat: number;
  purchase_taxable: number;
  purchase_vat: number;
  net_vat: number;
}

export function useVATSummary(dateFrom: string, dateTo: string) {
  const { business } = useBusiness();

  return useQuery({
    queryKey: ['report-vat', business?.id, dateFrom, dateTo],
    enabled: !!business?.id && !!dateFrom && !!dateTo,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('type, vat_period, taxable_amount, vat_amount')
        .eq('business_id', business!.id)
        .is('deleted_at', null)
        .neq('status', 'cancelled')
        .eq('is_vat_invoice', true)
        .gte('issued_date_ad', dateFrom)
        .lte('issued_date_ad', dateTo)
        .order('vat_period');
      if (error) throw error;

      const periodMap = new Map<string, VATSummaryRow>();
      for (const inv of data || []) {
        const period = inv.vat_period || 'Unknown';
        const existing = periodMap.get(period) || { period, sales_taxable: 0, sales_vat: 0, purchase_taxable: 0, purchase_vat: 0, net_vat: 0 };
        if (inv.type === 'sale') {
          existing.sales_taxable += Number(inv.taxable_amount);
          existing.sales_vat += Number(inv.vat_amount);
        } else if (inv.type === 'purchase') {
          existing.purchase_taxable += Number(inv.taxable_amount);
          existing.purchase_vat += Number(inv.vat_amount);
        }
        existing.net_vat = existing.sales_vat - existing.purchase_vat;
        periodMap.set(period, existing);
      }
      return Array.from(periodMap.values());
    },
  });
}

// ── Profit & Loss ──

export function useProfitLoss(dateFrom: string, dateTo: string) {
  const { business } = useBusiness();

  return useQuery({
    queryKey: ['report-pnl', business?.id, dateFrom, dateTo],
    enabled: !!business?.id && !!dateFrom && !!dateTo,
    queryFn: async () => {
      // Fetch sales & purchases
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('type, total_amount, discount_amount, vat_amount, invoice_items(quantity, rate, item_id, total_amount)')
        .eq('business_id', business!.id)
        .is('deleted_at', null)
        .neq('status', 'cancelled')
        .in('type', ['sale', 'purchase'])
        .gte('issued_date_ad', dateFrom)
        .lte('issued_date_ad', dateTo);
      if (error) throw error;

      // Fetch item purchase prices for COGS
      const itemIds = new Set<string>();
      for (const inv of invoices || []) {
        if (inv.type === 'sale') {
          for (const item of inv.invoice_items || []) {
            if (item.item_id) itemIds.add(item.item_id);
          }
        }
      }

      let itemPriceMap = new Map<string, number>();
      if (itemIds.size > 0) {
        const { data: items } = await supabase
          .from('items')
          .select('id, purchase_price')
          .in('id', Array.from(itemIds));
        for (const it of items || []) {
          itemPriceMap.set(it.id, Number(it.purchase_price || 0));
        }
      }

      let totalSales = 0;
      let totalPurchases = 0;
      let totalCOGS = 0;
      let totalSalesDiscount = 0;
      let totalPurchaseDiscount = 0;
      let totalSalesVAT = 0;
      let totalPurchaseVAT = 0;

      for (const inv of invoices || []) {
        if (inv.type === 'sale') {
          totalSales += Number(inv.total_amount);
          totalSalesDiscount += Number(inv.discount_amount);
          totalSalesVAT += Number(inv.vat_amount);
          for (const item of inv.invoice_items || []) {
            const pp = item.item_id ? (itemPriceMap.get(item.item_id) || 0) : 0;
            totalCOGS += pp * Number(item.quantity);
          }
        } else {
          totalPurchases += Number(inv.total_amount);
          totalPurchaseDiscount += Number(inv.discount_amount);
          totalPurchaseVAT += Number(inv.vat_amount);
        }
      }

      const grossProfit = totalSales - totalCOGS;
      const netProfit = grossProfit; // simplified — no expenses table

      return {
        totalSales,
        totalPurchases,
        totalCOGS,
        grossProfit,
        netProfit,
        totalSalesDiscount,
        totalPurchaseDiscount,
        totalSalesVAT,
        totalPurchaseVAT,
      };
    },
  });
}

// ── Bill-wise Profit ──

export interface BillProfitRow {
  invoice_number: string;
  date_bs: string;
  party_name: string;
  sale_amount: number;
  cost_amount: number;
  profit: number;
  margin_pct: number;
}

export function useBillWiseProfit(dateFrom: string, dateTo: string) {
  const { business } = useBusiness();

  return useQuery({
    queryKey: ['report-bill-profit', business?.id, dateFrom, dateTo],
    enabled: !!business?.id && !!dateFrom && !!dateTo,
    queryFn: async () => {
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, issued_date_bs, total_amount, customer:parties!invoices_customer_id_fkey(name), invoice_items(quantity, item_id)')
        .eq('business_id', business!.id)
        .eq('type', 'sale')
        .is('deleted_at', null)
        .neq('status', 'cancelled')
        .gte('issued_date_ad', dateFrom)
        .lte('issued_date_ad', dateTo)
        .order('issued_date_ad');
      if (error) throw error;

      const itemIds = new Set<string>();
      for (const inv of invoices || []) {
        for (const it of inv.invoice_items || []) {
          if (it.item_id) itemIds.add(it.item_id);
        }
      }

      let itemPriceMap = new Map<string, number>();
      if (itemIds.size > 0) {
        const { data: items } = await supabase.from('items').select('id, purchase_price').in('id', Array.from(itemIds));
        for (const it of items || []) itemPriceMap.set(it.id, Number(it.purchase_price || 0));
      }

      const rows: BillProfitRow[] = (invoices || []).map((inv: any) => {
        const saleAmt = Number(inv.total_amount);
        let costAmt = 0;
        for (const it of inv.invoice_items || []) {
          const pp = it.item_id ? (itemPriceMap.get(it.item_id) || 0) : 0;
          costAmt += pp * Number(it.quantity);
        }
        const profit = saleAmt - costAmt;
        return {
          invoice_number: inv.invoice_number,
          date_bs: inv.issued_date_bs,
          party_name: inv.customer?.name || '—',
          sale_amount: saleAmt,
          cost_amount: costAmt,
          profit,
          margin_pct: saleAmt > 0 ? (profit / saleAmt) * 100 : 0,
        };
      });

      const totals = rows.reduce((acc, r) => ({
        sale_amount: acc.sale_amount + r.sale_amount,
        cost_amount: acc.cost_amount + r.cost_amount,
        profit: acc.profit + r.profit,
      }), { sale_amount: 0, cost_amount: 0, profit: 0 });

      return { rows, totals };
    },
  });
}

// ── Cash Flow ──

export interface CashFlowRow {
  date_bs: string;
  date_ad: string;
  description: string;
  method: string;
  inflow: number;
  outflow: number;
}

export function useCashFlow(dateFrom: string, dateTo: string) {
  const { business } = useBusiness();

  return useQuery({
    queryKey: ['report-cashflow', business?.id, dateFrom, dateTo],
    enabled: !!business?.id && !!dateFrom && !!dateTo,
    queryFn: async () => {
      const { data: payments, error } = await supabase
        .from('payments')
        .select('*, party:parties(name, type), invoice:invoices(type, invoice_number)')
        .eq('business_id', business!.id)
        .eq('status', 'completed')
        .gte('payment_date_ad', dateFrom)
        .lte('payment_date_ad', dateTo)
        .order('payment_date_ad');
      if (error) throw error;

      const rows: CashFlowRow[] = (payments || []).map((p: any) => {
        const isSaleRelated = p.invoice?.type === 'sale' || p.invoice?.type === 'sale_return';
        const isPurchaseRelated = p.invoice?.type === 'purchase' || p.invoice?.type === 'purchase_return';
        const desc = p.invoice?.invoice_number
          ? `${p.party?.name || '—'} — ${p.invoice.invoice_number}`
          : `${p.party?.name || 'Standalone'} — ${p.reference || p.notes || 'Payment'}`;

        // For standalone payments (no invoice), check party type
        const isOutflow = isPurchaseRelated || (!p.invoice && p.party?.type === 'vendor');
        const isInflow = !isOutflow;

        return {
          date_bs: p.payment_date_bs,
          date_ad: p.payment_date_ad,
          description: desc,
          method: p.method.replace('_', ' '),
          inflow: isInflow ? Number(p.amount) : 0,
          outflow: isOutflow ? Number(p.amount) : 0,
        };
      });

      const totals = rows.reduce((acc, r) => ({
        inflow: acc.inflow + r.inflow,
        outflow: acc.outflow + r.outflow,
      }), { inflow: 0, outflow: 0 });

      return { rows, totals, net: totals.inflow - totals.outflow };
    },
  });
}

// ── Party Statement (summary) ──

export interface PartyStatementRow {
  party_id: string;
  party_name: string;
  party_type: string;
  opening_balance: number;
  total_invoiced: number;
  total_paid: number;
  closing_balance: number;
}

export function usePartyStatement(dateFrom: string, dateTo: string) {
  const { business } = useBusiness();

  return useQuery({
    queryKey: ['report-party-statement', business?.id, dateFrom, dateTo],
    enabled: !!business?.id && !!dateFrom && !!dateTo,
    queryFn: async () => {
      const [{ data: parties, error: pErr }, { data: invoices, error: iErr }, { data: payments, error: payErr }] = await Promise.all([
        supabase.from('parties').select('id, name, type, opening_balance').eq('business_id', business!.id).is('deleted_at', null),
        supabase.from('invoices').select('id, type, customer_id, vendor_id, total_amount').eq('business_id', business!.id).is('deleted_at', null).neq('status', 'cancelled').gte('issued_date_ad', dateFrom).lte('issued_date_ad', dateTo),
        supabase.from('payments').select('party_id, amount').eq('business_id', business!.id).eq('status', 'completed').gte('payment_date_ad', dateFrom).lte('payment_date_ad', dateTo),
      ]);
      if (pErr) throw pErr;
      if (iErr) throw iErr;
      if (payErr) throw payErr;

      const invoicedMap = new Map<string, number>();
      for (const inv of invoices || []) {
        const pid = inv.customer_id || inv.vendor_id;
        if (pid) invoicedMap.set(pid, (invoicedMap.get(pid) || 0) + Number(inv.total_amount));
      }

      const paidMap = new Map<string, number>();
      for (const p of payments || []) {
        if (p.party_id) paidMap.set(p.party_id, (paidMap.get(p.party_id) || 0) + Number(p.amount));
      }

      const rows: PartyStatementRow[] = (parties || []).map((p) => {
        const opening = Number(p.opening_balance || 0);
        const invoiced = invoicedMap.get(p.id) || 0;
        const paid = paidMap.get(p.id) || 0;
        return {
          party_id: p.id,
          party_name: p.name,
          party_type: p.type,
          opening_balance: opening,
          total_invoiced: invoiced,
          total_paid: paid,
          closing_balance: opening + invoiced - paid,
        };
      }).filter(r => r.total_invoiced > 0 || r.total_paid > 0 || r.opening_balance !== 0);

      return rows;
    },
  });
}

// ── Sale/Purchase by Party ──

export interface SalePurchaseByPartyRow {
  party_name: string;
  party_type: string;
  total_sales: number;
  total_purchases: number;
  total_amount: number;
  invoice_count: number;
}

export function useSalePurchaseByParty(dateFrom: string, dateTo: string) {
  const { business } = useBusiness();

  return useQuery({
    queryKey: ['report-sp-by-party', business?.id, dateFrom, dateTo],
    enabled: !!business?.id && !!dateFrom && !!dateTo,
    queryFn: async () => {
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('type, total_amount, customer:parties!invoices_customer_id_fkey(name, type), vendor:parties!invoices_vendor_id_fkey(name, type)')
        .eq('business_id', business!.id)
        .is('deleted_at', null)
        .neq('status', 'cancelled')
        .in('type', ['sale', 'purchase'])
        .gte('issued_date_ad', dateFrom)
        .lte('issued_date_ad', dateTo);
      if (error) throw error;

      const map = new Map<string, SalePurchaseByPartyRow>();
      for (const inv of invoices || []) {
        const party = (inv as any).customer || (inv as any).vendor;
        const name = party?.name || '—';
        const existing = map.get(name) || { party_name: name, party_type: party?.type || '', total_sales: 0, total_purchases: 0, total_amount: 0, invoice_count: 0 };
        const amt = Number(inv.total_amount);
        if (inv.type === 'sale') existing.total_sales += amt;
        else existing.total_purchases += amt;
        existing.total_amount += amt;
        existing.invoice_count++;
        map.set(name, existing);
      }

      return Array.from(map.values()).sort((a, b) => b.total_amount - a.total_amount);
    },
  });
}

// ── Stock Summary ──

export interface StockSummaryRow {
  item_name: string;
  code: string | null;
  unit: string;
  opening_stock: number;
  current_stock: number;
  purchase_price: number;
  sale_price: number;
  stock_value: number;
}

export function useStockSummary() {
  const { business } = useBusiness();

  return useQuery({
    queryKey: ['report-stock-summary', business?.id],
    enabled: !!business?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('items')
        .select('name, code, unit, opening_stock, current_stock, purchase_price, sale_price')
        .eq('business_id', business!.id)
        .eq('type', 'product')
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('name');
      if (error) throw error;

      const rows: StockSummaryRow[] = (data || []).map(it => ({
        item_name: it.name,
        code: it.code,
        unit: it.unit,
        opening_stock: Number(it.opening_stock),
        current_stock: Number(it.current_stock),
        purchase_price: Number(it.purchase_price || 0),
        sale_price: Number(it.sale_price),
        stock_value: Number(it.current_stock) * Number(it.purchase_price || 0),
      }));

      const totalValue = rows.reduce((s, r) => s + r.stock_value, 0);
      return { rows, totalValue };
    },
  });
}

// ── All Parties Report ──

export interface AllPartiesRow {
  id: string;
  name: string;
  type: string;
  phone: string | null;
  city: string | null;
  opening_balance: number;
  is_active: boolean;
}

export function useAllParties() {
  const { business } = useBusiness();

  return useQuery({
    queryKey: ['report-all-parties', business?.id],
    enabled: !!business?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parties')
        .select('id, name, type, phone, city, opening_balance, is_active')
        .eq('business_id', business!.id)
        .is('deleted_at', null)
        .order('name');
      if (error) throw error;
      return (data || []).map(p => ({ ...p, opening_balance: Number(p.opening_balance) })) as AllPartiesRow[];
    },
  });
}
