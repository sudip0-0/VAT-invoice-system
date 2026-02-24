import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

export type Invoice = Tables<'invoices'>;
export type InvoiceItem = Tables<'invoice_items'>;
export type Payment = Tables<'payments'>;

export interface InvoiceWithParty extends Invoice {
  customer: { name: string } | null;
  vendor: { name: string } | null;
}

export interface InvoiceDetail extends InvoiceWithParty {
  invoice_items: InvoiceItem[];
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
      const desiredStatus = invoice.status || 'draft';

      // Insert invoice as draft first so trigger doesn't fire before items exist
      const { error: invErr } = await supabase.from('invoices').insert({
        ...invoice,
        id: invoiceId,
        business_id: business!.id,
        status: 'draft' as any,
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

      // Now update status to desired value so the trigger fires with items present
      if (desiredStatus !== 'draft') {
        const { error: statusErr } = await supabase
          .from('invoices')
          .update({ status: desiredStatus as any, updated_at: new Date().toISOString() })
          .eq('id', invoiceId);
        if (statusErr) throw statusErr;
      }

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
      qc.invalidateQueries({ queryKey: ['items', business?.id] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const updateInvoice = useMutation({
    mutationFn: async ({
      id,
      invoice,
      items,
    }: {
      id: string;
      invoice: Partial<TablesInsert<'invoices'>>;
      items?: Omit<TablesInsert<'invoice_items'>, 'invoice_id'>[];
    }) => {
      const { error: invErr } = await supabase
        .from('invoices')
        .update({ ...invoice, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (invErr) throw invErr;

      if (items !== undefined) {
        // Delete existing items and re-insert
        const { error: delErr } = await supabase
          .from('invoice_items')
          .delete()
          .eq('invoice_id', id);
        if (delErr) throw delErr;

        if (items.length > 0) {
          const { error: itemsErr } = await supabase.from('invoice_items').insert(
            items.map((item, idx) => ({
              ...item,
              invoice_id: id,
              sort_order: idx,
            }))
          );
          if (itemsErr) throw itemsErr;
        }
      }

      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
    },
  });

  const cancelInvoice = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('invoices')
        .update({ status: 'cancelled' as any, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ['invoice', id] });
      qc.invalidateQueries({ queryKey: ['items', business?.id] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  return { invoices: query.data || [], isLoading: query.isLoading, createInvoice, updateInvoice, cancelInvoice };
}

export function useInvoiceDetail(id: string | undefined) {
  const { business } = useBusiness();

  return useQuery({
    queryKey: ['invoice', id],
    enabled: !!id && !!business?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, customer:parties!invoices_customer_id_fkey(name, phone, email, address, city, pan_number), vendor:parties!invoices_vendor_id_fkey(name, phone, email, address, city, pan_number), invoice_items(*)')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as InvoiceDetail;
    },
  });
}

export function useInvoicePayments(invoiceId: string | undefined) {
  const { business } = useBusiness();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['payments', invoiceId],
    enabled: !!invoiceId && !!business?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('invoice_id', invoiceId!)
        .eq('business_id', business!.id)
        .order('payment_date_ad', { ascending: false });
      if (error) throw error;
      return data as Payment[];
    },
  });

  const recordPayment = useMutation({
    mutationFn: async (payment: Omit<TablesInsert<'payments'>, 'business_id'>) => {
      const { data, error } = await supabase
        .from('payments')
        .insert({ ...payment, business_id: business!.id })
        .select()
        .single();
      if (error) throw error;

      // Update invoice paid_amount and balance_due
      if (payment.invoice_id) {
        const { data: inv } = await supabase
          .from('invoices')
          .select('paid_amount, total_amount')
          .eq('id', payment.invoice_id)
          .single();
        if (inv) {
          const newPaid = Number(inv.paid_amount) + Number(payment.amount);
          const newBalance = Number(inv.total_amount) - newPaid;
          const newStatus = newBalance <= 0 ? 'paid' : newPaid > 0 ? 'partially_paid' : undefined;
          await supabase
            .from('invoices')
            .update({
              paid_amount: newPaid,
              balance_due: Math.max(0, newBalance),
              ...(newStatus ? { status: newStatus } : {}),
            })
            .eq('id', payment.invoice_id);
        }
      }

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments', invoiceId] });
      qc.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  return { payments: query.data || [], isLoading: query.isLoading, recordPayment };
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
