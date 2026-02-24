import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';
import type { Tables } from '@/integrations/supabase/types';

type Invoice = Tables<'invoices'>;
type Payment = Tables<'payments'>;
type Party = Tables<'parties'>;

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

interface VATSummaryRow {
  period: string;
  sales_taxable: number;
  sales_vat: number;
  purchase_taxable: number;
  purchase_vat: number;
  net_vat: number;
}

interface PartyLedgerEntry {
  date_bs: string;
  time: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
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
        const existing = periodMap.get(period) || {
          period,
          sales_taxable: 0,
          sales_vat: 0,
          purchase_taxable: 0,
          purchase_vat: 0,
          net_vat: 0,
        };
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

export function usePartyLedger(partyId: string | undefined, dateFrom: string, dateTo: string) {
  const { business } = useBusiness();

  return useQuery({
    queryKey: ['report-ledger', business?.id, partyId, dateFrom, dateTo],
    enabled: !!business?.id && !!partyId && !!dateFrom && !!dateTo,
    queryFn: async () => {
      // Get party's opening balance
      const { data: party, error: partyErr } = await supabase
        .from('parties')
        .select('opening_balance')
        .eq('id', partyId!)
        .single();
      if (partyErr) throw partyErr;

      const openingBalance = Number(party?.opening_balance || 0);

      // Get invoices for this party
      const { data: invoices, error: invErr } = await supabase
        .from('invoices')
        .select('id, invoice_number, type, issued_date_bs, issued_date_ad, total_amount, created_at')
        .eq('business_id', business!.id)
        .is('deleted_at', null)
        .neq('status', 'cancelled')
        .gte('issued_date_ad', dateFrom)
        .lte('issued_date_ad', dateTo)
        .or(`customer_id.eq.${partyId},vendor_id.eq.${partyId}`)
        .order('issued_date_ad');
      if (invErr) throw invErr;

      // Get payments for this party
      const { data: payments, error: payErr } = await supabase
        .from('payments')
        .select('id, payment_date_bs, payment_date_ad, amount, method, reference, created_at')
        .eq('business_id', business!.id)
        .eq('party_id', partyId!)
        .eq('status', 'completed')
        .gte('payment_date_ad', dateFrom)
        .lte('payment_date_ad', dateTo)
        .order('payment_date_ad');
      if (payErr) throw payErr;

      // Combine into ledger entries sorted by date
      const entries: { date_ad: string; created_at: string; date_bs: string; description: string; debit: number; credit: number }[] = [];

      for (const inv of invoices || []) {
        const isSale = inv.type === 'sale';
        entries.push({
          date_ad: inv.issued_date_ad,
          created_at: inv.created_at,
          date_bs: inv.issued_date_bs,
          description: `${isSale ? 'Invoice' : 'Bill'} ${inv.invoice_number}`,
          debit: isSale ? Number(inv.total_amount) : 0,
          credit: !isSale ? Number(inv.total_amount) : 0,
        });
      }

      for (const p of payments || []) {
        entries.push({
          date_ad: p.payment_date_ad,
          created_at: p.created_at,
          date_bs: p.payment_date_bs,
          description: `Payment (${p.method.replace('_', ' ')})${p.reference ? ` - ${p.reference}` : ''}`,
          debit: 0,
          credit: Number(p.amount),
        });
      }

      entries.sort((a, b) => a.date_ad.localeCompare(b.date_ad) || a.created_at.localeCompare(b.created_at));

      // Start with opening balance row
      let balance = openingBalance;
      const ledger: PartyLedgerEntry[] = [];

      if (openingBalance !== 0) {
        ledger.push({
          date_bs: '—',
          time: '—',
          description: 'Opening Balance',
          debit: openingBalance > 0 ? openingBalance : 0,
          credit: openingBalance < 0 ? Math.abs(openingBalance) : 0,
          balance: openingBalance,
        });
      }

      for (const e of entries) {
        balance += e.debit - e.credit;
        const time = new Date(e.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        ledger.push({ date_bs: e.date_bs, time, description: e.description, debit: e.debit, credit: e.credit, balance });
      }

      return { entries: ledger, closingBalance: balance };
    },
  });
}
