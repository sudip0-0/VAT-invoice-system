import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

export type Invoice = Tables<'invoices'>;
export type InvoiceItem = Tables<'invoice_items'>;

export interface InvoiceWithParty extends Invoice {
  customer: { name: string } | null;
  vendor: { name: string } | null;
}

export function useInvoices() {
  const { business } = useBusiness();
  const qc = useQueryClient();
  const key = ['invoices', business?.id];

  const query = useQuery({
    queryKey: key,
    enabled: !!business?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, customer:parties!invoices_customer_id_fkey(name), vendor:parties!invoices_vendor_id_fkey(name)')
        .eq('business_id', business!.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as InvoiceWithParty[];
    },
  });

  const createInvoice = useMutation({
    mutationFn: async ({
      invoice,
      items,
    }: {
      invoice: Omit<TablesInsert<'invoices'>, 'business_id'>;
      items: Omit<TablesInsert<'invoice_items'>, 'invoice_id'>[];
    }) => {
      const invoiceId = crypto.randomUUID();
      const { error: invErr } = await supabase.from('invoices').insert({
        ...invoice,
        id: invoiceId,
        business_id: business!.id,
      });
      if (invErr) throw invErr;

      if (items.length > 0) {
        const { error: itemsErr } = await supabase.from('invoice_items').insert(
          items.map((item, idx) => ({
            ...item,
            invoice_id: invoiceId,
            sort_order: idx,
          }))
        );
        if (itemsErr) throw itemsErr;
      }

      // Increment next_invoice_num
      const { data: biz } = await supabase
        .from('businesses')
        .select('next_invoice_num')
        .eq('id', business!.id)
        .single();
      if (biz) {
        await supabase
          .from('businesses')
          .update({ next_invoice_num: biz.next_invoice_num + 1 })
          .eq('id', business!.id);
      }

      return invoiceId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
    },
  });

  return { invoices: query.data || [], isLoading: query.isLoading, createInvoice };
}

export function useTaxRates() {
  const { business } = useBusiness();

  return useQuery({
    queryKey: ['tax_rates', business?.id],
    enabled: !!business?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tax_rates')
        .select('*')
        .eq('business_id', business!.id)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });
}
