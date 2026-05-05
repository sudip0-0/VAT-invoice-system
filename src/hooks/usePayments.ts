import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { localDb } from '@/integrations/local-db/client';
import { useBusiness } from '@/contexts/BusinessContext';
import type { TablesInsert } from '@/integrations/local-db/types';

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

interface UseAllPaymentsParams {
  search?: string;
}

export function useAllPayments({ search = '' }: UseAllPaymentsParams = {}) {
  const { business } = useBusiness();
  const qc = useQueryClient();
  const cleanSearch = search.trim();

  const query = useQuery({
    queryKey: ['all_payments', business?.id, cleanSearch],
    enabled: !!business?.id,
    queryFn: async () => {
      let request = localDb
        .from('payments')
        .select('*, invoice:invoices!payments_invoice_id_fkey(invoice_number, type), party:parties!payments_party_id_fkey(name, type)', { count: 'exact' })
        .eq('business_id', business!.id)
        .order('payment_date_ad', { ascending: false });

      if (cleanSearch) {
        request = request.or(`reference.ilike.%${cleanSearch}%,method.ilike.%${cleanSearch}%`);
      }

      const { data, error, count } = await request;
      if (error) throw error;
      return { data: data as unknown as PaymentWithDetails[], count: count || 0 };
    },
  });

  const recordStandalonePayment = useMutation({
    mutationFn: async (payment: Omit<TablesInsert<'payments'>, 'business_id'>) => {
      const { data, error } = await localDb
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

  return {
    data: query.data?.data || [],
    count: query.data?.count || 0,
    isLoading: query.isLoading,
    recordStandalonePayment,
  };
}
