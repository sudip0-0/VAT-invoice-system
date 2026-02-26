import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';

// ── Party Report by Item ──
// For each party, lists the items they bought/sold with quantities and amounts

export interface PartyByItemRow {
  party_name: string;
  party_type: string;
  items: {
    item_name: string;
    code: string | null;
    unit: string;
    qty: number;
    amount: number;
  }[];
  total_amount: number;
}

export function usePartyReportByItem(dateFrom: string, dateTo: string) {
  const { business } = useBusiness();

  return useQuery({
    queryKey: ['report-party-by-item', business?.id, dateFrom, dateTo],
    enabled: !!business?.id && !!dateFrom && !!dateTo,
    queryFn: async () => {
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('type, customer:parties!invoices_customer_id_fkey(id, name, type), vendor:parties!invoices_vendor_id_fkey(id, name, type), invoice_items(item_id, name, unit, quantity, total_amount)')
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
        for (const it of (inv as any).invoice_items || []) {
          if (it.item_id) itemIds.add(it.item_id);
        }
      }
      const codeMap = new Map<string, string>();
      if (itemIds.size > 0) {
        const { data: items } = await supabase.from('items').select('id, code').in('id', Array.from(itemIds));
        for (const it of items || []) if (it.code) codeMap.set(it.id, it.code);
      }

      const partyMap = new Map<string, PartyByItemRow>();

      for (const inv of invoices || []) {
        const party = (inv as any).customer || (inv as any).vendor;
        if (!party) continue;
        const key = party.id;
        const existing = partyMap.get(key) || { party_name: party.name, party_type: party.type, items: [], total_amount: 0 };

        for (const it of (inv as any).invoice_items || []) {
          const itemKey = it.item_id || it.name;
          let found = existing.items.find(i => (i.code && i.code === codeMap.get(it.item_id)) || i.item_name === it.name);
          if (found) {
            found.qty += Number(it.quantity);
            found.amount += Number(it.total_amount);
          } else {
            existing.items.push({
              item_name: it.name,
              code: it.item_id ? (codeMap.get(it.item_id) || null) : null,
              unit: it.unit,
              qty: Number(it.quantity),
              amount: Number(it.total_amount),
            });
          }
          existing.total_amount += Number(it.total_amount);
        }
        partyMap.set(key, existing);
      }

      return Array.from(partyMap.values()).sort((a, b) => b.total_amount - a.total_amount);
    },
  });
}

// ── Item Report by Party ──
// For each item, lists which parties bought/sold it

export interface ItemByPartyRow {
  item_name: string;
  code: string | null;
  unit: string;
  parties: {
    party_name: string;
    party_type: string;
    qty: number;
    amount: number;
  }[];
  total_qty: number;
  total_amount: number;
}

export function useItemReportByParty(dateFrom: string, dateTo: string) {
  const { business } = useBusiness();

  return useQuery({
    queryKey: ['report-item-by-party', business?.id, dateFrom, dateTo],
    enabled: !!business?.id && !!dateFrom && !!dateTo,
    queryFn: async () => {
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('type, customer:parties!invoices_customer_id_fkey(name, type), vendor:parties!invoices_vendor_id_fkey(name, type), invoice_items(item_id, name, unit, quantity, total_amount)')
        .eq('business_id', business!.id)
        .is('deleted_at', null)
        .neq('status', 'cancelled')
        .in('type', ['sale', 'purchase'])
        .gte('issued_date_ad', dateFrom)
        .lte('issued_date_ad', dateTo);
      if (error) throw error;

      const itemIds = new Set<string>();
      for (const inv of invoices || []) {
        for (const it of (inv as any).invoice_items || []) {
          if (it.item_id) itemIds.add(it.item_id);
        }
      }
      const codeMap = new Map<string, string>();
      if (itemIds.size > 0) {
        const { data: items } = await supabase.from('items').select('id, code').in('id', Array.from(itemIds));
        for (const it of items || []) if (it.code) codeMap.set(it.id, it.code);
      }

      const itemMap = new Map<string, ItemByPartyRow>();

      for (const inv of invoices || []) {
        const party = (inv as any).customer || (inv as any).vendor;
        const partyName = party?.name || '—';
        const partyType = party?.type || '';

        for (const it of (inv as any).invoice_items || []) {
          const key = it.item_id || it.name;
          const existing = itemMap.get(key) || {
            item_name: it.name,
            code: it.item_id ? (codeMap.get(it.item_id) || null) : null,
            unit: it.unit,
            parties: [],
            total_qty: 0,
            total_amount: 0,
          };

          let found = existing.parties.find(p => p.party_name === partyName);
          if (found) {
            found.qty += Number(it.quantity);
            found.amount += Number(it.total_amount);
          } else {
            existing.parties.push({ party_name: partyName, party_type: partyType, qty: Number(it.quantity), amount: Number(it.total_amount) });
          }
          existing.total_qty += Number(it.quantity);
          existing.total_amount += Number(it.total_amount);
          itemMap.set(key, existing);
        }
      }

      return Array.from(itemMap.values()).sort((a, b) => b.total_amount - a.total_amount);
    },
  });
}

// ── Item-wise Profit ──
// For each item sold, shows revenue, cost, and profit

export interface ItemProfitRow {
  item_name: string;
  code: string | null;
  unit: string;
  qty_sold: number;
  sale_amount: number;
  cost_amount: number;
  profit: number;
  margin_pct: number;
}

export function useItemWiseProfit(dateFrom: string, dateTo: string) {
  const { business } = useBusiness();

  return useQuery({
    queryKey: ['report-item-profit', business?.id, dateFrom, dateTo],
    enabled: !!business?.id && !!dateFrom && !!dateTo,
    queryFn: async () => {
      const { data: invoices, error } = await supabase
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
      const map = new Map<string, { item_name: string; item_id: string | null; unit: string; qty_sold: number; sale_amount: number }>();

      for (const inv of invoices || []) {
        for (const it of (inv as any).invoice_items || []) {
          const key = it.item_id || it.name;
          if (it.item_id) itemIds.add(it.item_id);
          const existing = map.get(key) || { item_name: it.name, item_id: it.item_id, unit: it.unit, qty_sold: 0, sale_amount: 0 };
          existing.qty_sold += Number(it.quantity);
          existing.sale_amount += Number(it.total_amount);
          map.set(key, existing);
        }
      }

      // Fetch purchase prices
      const priceMap = new Map<string, number>();
      const codeMap = new Map<string, string>();
      if (itemIds.size > 0) {
        const { data: items } = await supabase.from('items').select('id, code, purchase_price').in('id', Array.from(itemIds));
        for (const it of items || []) {
          priceMap.set(it.id, Number(it.purchase_price || 0));
          if (it.code) codeMap.set(it.id, it.code);
        }
      }

      const rows: ItemProfitRow[] = Array.from(map.values())
        .map(r => {
          const costPerUnit = r.item_id ? (priceMap.get(r.item_id) || 0) : 0;
          const costAmount = costPerUnit * r.qty_sold;
          const profit = r.sale_amount - costAmount;
          return {
            item_name: r.item_name,
            code: r.item_id ? (codeMap.get(r.item_id) || null) : null,
            unit: r.unit,
            qty_sold: r.qty_sold,
            sale_amount: r.sale_amount,
            cost_amount: costAmount,
            profit,
            margin_pct: r.sale_amount > 0 ? (profit / r.sale_amount) * 100 : 0,
          };
        })
        .sort((a, b) => b.profit - a.profit);

      const totals = rows.reduce((a, r) => ({
        sale_amount: a.sale_amount + r.sale_amount,
        cost_amount: a.cost_amount + r.cost_amount,
        profit: a.profit + r.profit,
        qty_sold: a.qty_sold + r.qty_sold,
      }), { sale_amount: 0, cost_amount: 0, profit: 0, qty_sold: 0 });

      return { rows, totals };
    },
  });
}
