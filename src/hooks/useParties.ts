import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { localDb } from '@/integrations/local-db/client';
import { useBusiness } from '@/contexts/BusinessContext';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/local-db/types';
import { CASH_CUSTOMER_NAME } from '@/lib/cash-customer';

export type Party = Tables<'parties'>;
export type PartyInsert = TablesInsert<'parties'>;
export type PartyUpdate = TablesUpdate<'parties'>;

export interface PartyWithBalance extends Party {
  ledger_balance: number; // positive = receivable, negative = payable
}

interface InvoiceBalanceRow {
  customer_id: string | null;
  vendor_id: string | null;
  balance_due: number | null;
  type: string | null;
}

interface StandalonePaymentRow {
  party_id: string | null;
  amount: number | null;
}

interface UsePartyListParams {
  type?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

const DEFAULT_PAGE_SIZE = 50;
const RESERVED_PARTY_NAMES = new Set([CASH_CUSTOMER_NAME.toLowerCase()]);

function getRange(page = 1, pageSize = DEFAULT_PAGE_SIZE) {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

function assertPartyNameAllowed(name: string | null | undefined) {
  if (RESERVED_PARTY_NAMES.has((name || '').trim().toLowerCase())) {
    throw new Error(`${CASH_CUSTOMER_NAME} is a system customer and cannot be created manually.`);
  }
}

function withLedgerBalance(
  parties: Party[],
  invoices: InvoiceBalanceRow[],
  standalonePayments: StandalonePaymentRow[]
) {
  // Compute ledger balance per party
  const balanceMap: Record<string, number> = {};

  for (const inv of invoices) {
    if (inv.type === 'sale' && inv.customer_id) {
      // Customer owes us balance_due (receivable)
      balanceMap[inv.customer_id] = (balanceMap[inv.customer_id] || 0) + Number(inv.balance_due);
    } else if (inv.type === 'purchase' && inv.vendor_id) {
      // We owe vendor balance_due (payable = negative)
      balanceMap[inv.vendor_id] = (balanceMap[inv.vendor_id] || 0) - Number(inv.balance_due);
    }
  }

  // Standalone payments: need party type to determine direction
  const partyTypeMap: Record<string, string> = {};
  for (const p of parties) {
    partyTypeMap[p.id] = p.type;
  }

  for (const pay of standalonePayments) {
    if (!pay.party_id) continue;

    const pType = partyTypeMap[pay.party_id];
    if (pType === 'vendor') {
      // Payment out to vendor reduces payable (makes balance less negative)
      balanceMap[pay.party_id] = (balanceMap[pay.party_id] || 0) + Number(pay.amount);
    } else {
      // Payment in from customer reduces receivable
      balanceMap[pay.party_id] = (balanceMap[pay.party_id] || 0) - Number(pay.amount);
    }
  }

  return parties.map((p) => ({
    ...p,
    ledger_balance: (p.opening_balance || 0) + (balanceMap[p.id] || 0),
  })) as PartyWithBalance[];
}

export function useParties() {
  const { business } = useBusiness();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['parties', business?.id],
    queryFn: async () => {
      if (!business) return [];

      // Fetch parties, invoices, and standalone payments in parallel
      const [partiesRes, invoicesRes, paymentsRes] = await Promise.all([
        localDb
          .from('parties')
          .select('*')
          .eq('business_id', business.id)
          .is('deleted_at', null)
          .order('name'),
        localDb
          .from('invoices')
          .select('customer_id, vendor_id, balance_due, type, status')
          .eq('business_id', business.id)
          .is('deleted_at', null)
          .neq('status', 'cancelled'),
        localDb
          .from('payments')
          .select('party_id, amount, invoice_id, method')
          .eq('business_id', business.id)
          .eq('status', 'completed')
          .is('invoice_id', null), // only standalone payments not tied to invoices
      ]);

      if (partiesRes.error) throw partiesRes.error;

      const parties = partiesRes.data as Party[];
      return withLedgerBalance(
        parties,
        (invoicesRes.data || []) as InvoiceBalanceRow[],
        (paymentsRes.data || []) as StandalonePaymentRow[]
      );
    },
    enabled: !!business,
  });

  const createParty = useMutation({
    mutationFn: async (party: Omit<PartyInsert, 'business_id'>) => {
      if (!business) throw new Error('No business');
      assertPartyNameAllowed(party.name);
      const { data, error } = await localDb
        .from('parties')
        .insert({ ...party, business_id: business.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['parties', business?.id] }),
  });

  const updateParty = useMutation({
    mutationFn: async ({ id, ...updates }: PartyUpdate & { id: string }) => {
      assertPartyNameAllowed(updates.name);
      const { data, error } = await localDb
        .from('parties')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['parties', business?.id] }),
  });

  const deleteParty = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await localDb
        .from('parties')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['parties', business?.id] }),
  });

  return { ...query, createParty, updateParty, deleteParty };
}

export function usePartyList({
  type = 'all',
  search = '',
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
}: UsePartyListParams = {}) {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const { from, to } = getRange(page, pageSize);
  const cleanSearch = search.trim();

  const query = useQuery({
    queryKey: ['party_list', business?.id, type, cleanSearch, page, pageSize],
    enabled: !!business?.id,
    queryFn: async () => {
      let request = localDb
        .from('parties')
        .select('*', { count: 'exact' })
        .eq('business_id', business!.id)
        .is('deleted_at', null);

      if (type !== 'all') {
        request = request.in('type', [type as any, 'both' as any]);
      }
      if (cleanSearch) {
        request = request.or(`name.ilike.%${cleanSearch}%,phone.ilike.%${cleanSearch}%,pan_number.ilike.%${cleanSearch}%`);
      }

      const { data, error, count } = await request
        .order('name')
        .range(from, to);

      if (error) throw error;

      const parties = (data || []) as Party[];
      if (!parties.length) {
        return { data: [] as PartyWithBalance[], count: count || 0 };
      }

      const partyIds = parties.map((p) => p.id);
      const idList = partyIds.join(',');

      // Keep pagination, but calculate live per-party balances for current page rows.
      const [invoicesRes, paymentsRes] = await Promise.all([
        localDb
          .from('invoices')
          .select('customer_id, vendor_id, balance_due, type, status')
          .eq('business_id', business!.id)
          .is('deleted_at', null)
          .neq('status', 'cancelled')
          .or(`customer_id.in.(${idList}),vendor_id.in.(${idList})`),
        localDb
          .from('payments')
          .select('party_id, amount, invoice_id')
          .eq('business_id', business!.id)
          .eq('status', 'completed')
          .is('invoice_id', null)
          .in('party_id', partyIds),
      ]);

      if (invoicesRes.error) throw invoicesRes.error;
      if (paymentsRes.error) throw paymentsRes.error;

      return {
        data: withLedgerBalance(
          parties,
          (invoicesRes.data || []) as InvoiceBalanceRow[],
          (paymentsRes.data || []) as StandalonePaymentRow[]
        ),
        count: count || 0,
      };
    },
  });

  const createParty = useMutation({
    mutationFn: async (party: Omit<PartyInsert, 'business_id'>) => {
      if (!business) throw new Error('No business');
      assertPartyNameAllowed(party.name);
      const { data, error } = await localDb
        .from('parties')
        .insert({ ...party, business_id: business.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['party_list', business?.id] });
      queryClient.invalidateQueries({ queryKey: ['parties', business?.id] });
    },
  });

  const updateParty = useMutation({
    mutationFn: async ({ id, ...updates }: PartyUpdate & { id: string }) => {
      assertPartyNameAllowed(updates.name);
      const { data, error } = await localDb
        .from('parties')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['party_list', business?.id] });
      queryClient.invalidateQueries({ queryKey: ['parties', business?.id] });
    },
  });

  const deleteParty = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await localDb
        .from('parties')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['party_list', business?.id] });
      queryClient.invalidateQueries({ queryKey: ['parties', business?.id] });
    },
  });

  return {
    data: query.data?.data || [],
    count: query.data?.count || 0,
    isLoading: query.isLoading,
    createParty,
    updateParty,
    deleteParty,
  };
}
