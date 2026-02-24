import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type Party = Tables<'parties'>;
export type PartyInsert = TablesInsert<'parties'>;
export type PartyUpdate = TablesUpdate<'parties'>;

export interface PartyWithBalance extends Party {
  ledger_balance: number; // positive = receivable, negative = payable
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
        supabase
          .from('parties')
          .select('*')
          .eq('business_id', business.id)
          .is('deleted_at', null)
          .order('name'),
        supabase
          .from('invoices')
          .select('customer_id, vendor_id, balance_due, type, status')
          .eq('business_id', business.id)
          .is('deleted_at', null)
          .neq('status', 'cancelled'),
        supabase
          .from('payments')
          .select('party_id, amount, invoice_id')
          .eq('business_id', business.id)
          .is('invoice_id', null), // only standalone payments not tied to invoices
      ]);

      if (partiesRes.error) throw partiesRes.error;

      const parties = partiesRes.data as Party[];
      const invoices = invoicesRes.data || [];
      const standalonePayments = paymentsRes.data || [];

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

      // Standalone payments reduce outstanding
      for (const pay of standalonePayments) {
        if (pay.party_id) {
          balanceMap[pay.party_id] = (balanceMap[pay.party_id] || 0) - Number(pay.amount);
        }
      }

      return parties.map((p) => ({
        ...p,
        ledger_balance: (p.opening_balance || 0) + (balanceMap[p.id] || 0),
      })) as PartyWithBalance[];
    },
    enabled: !!business,
  });

  const createParty = useMutation({
    mutationFn: async (party: Omit<PartyInsert, 'business_id'>) => {
      if (!business) throw new Error('No business');
      const { data, error } = await supabase
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
      const { data, error } = await supabase
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
      const { error } = await supabase
        .from('parties')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['parties', business?.id] }),
  });

  return { ...query, createParty, updateParty, deleteParty };
}
