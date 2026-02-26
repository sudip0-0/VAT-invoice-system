import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';
import type { TablesInsert } from '@/integrations/supabase/types';

export interface PaymentWithDetails {
  id: string;
  business_id: string;
  invoice_id: string | null;
  party_id: string | null;
  amount: number;
  method: string;
  status: string;
  payment_date_ad: string;
  payment_date_bs: string;
  reference: string | null;
  notes: string | null;
  bank_name: string | null;
  cheque_number: string | null;
  cheque_date: string | null;
  gateway_ref_id: string | null;
  created_at: string;
  invoice: { invoice_number: string; type: string } | null;
  party: { name: string; type: string } | null;
}

export function useAllPayments() {
  const { business } = useBusiness();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['all_payments', business?.id],
    enabled: !!business?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*, invoice:invoices!payments_invoice_id_fkey(invoice_number, type), party:parties!payments_party_id_fkey(name, type)')
        .eq('business_id', business!.id)
        .order('payment_date_ad', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as unknown as PaymentWithDetails[];
    },
  });

  const recordStandalonePayment = useMutation({
    mutationFn: async (payment: Omit<TablesInsert<'payments'>, 'business_id'>) => {
      const { data, error } = await supabase
        .from('payments')
        .insert({ ...payment, business_id: business!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all_payments', business?.id] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  return { ...query, recordStandalonePayment };
}
