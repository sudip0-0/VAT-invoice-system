import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { localDb } from '@/integrations/local-db/client';
import { useBusiness } from '@/contexts/BusinessContext';
import type { Tables, TablesInsert } from '@/integrations/local-db/types';

export type Invoice = Tables<'invoices'>;
export type InvoiceItem = Tables<'invoice_items'>;
export type Payment = Tables<'payments'>;

export interface InvoiceWithParty extends Invoice {
  customer: { name: string; phone?: string | null; email?: string | null; address?: string | null; city?: string | null; pan_number?: string | null } | null;
  vendor: { name: string; phone?: string | null; email?: string | null; address?: string | null; city?: string | null; pan_number?: string | null } | null;
}

export interface InvoiceDetail extends InvoiceWithParty {
  invoice_items: InvoiceItem[];
}

interface UseInvoiceListParams {
  type?: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

const DEFAULT_PAGE_SIZE = 50;

function getRange(page = 1, pageSize = DEFAULT_PAGE_SIZE) {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

function formatDocumentNumber(
  type: string | undefined,
  invoicePrefix: string | undefined,
  nextInvoiceNum: number,
  fallback?: string | null
) {
  const serial = String(nextInvoiceNum || 1).padStart(4, '0');
  if (type === 'purchase') return `PUR-${serial}`;
  if (type === 'quotation') return `QTN-${serial}`;
  if (type === 'sale') return `${invoicePrefix || 'INV'}-${serial}`;
  return fallback || `${invoicePrefix || 'INV'}-${serial}`;
}

const MAX_INVOICE_NUMBER_RESERVE_RETRIES = 10;

async function reserveNextInvoiceNumber(businessId: string) {
  for (let attempt = 0; attempt < MAX_INVOICE_NUMBER_RESERVE_RETRIES; attempt += 1) {
    const { data: currentBusiness, error: businessErr } = await localDb
      .from('businesses')
      .select('invoice_prefix, next_invoice_num')
      .eq('id', businessId)
      .single();
    if (businessErr) throw businessErr;
    if (!currentBusiness) throw new Error('Business not found');

    const reservedInvoiceNum = Number(currentBusiness.next_invoice_num || 1);
    const updatedNextInvoiceNum = reservedInvoiceNum + 1;

    const { data: reservedRow, error: reserveErr } = await localDb
      .from('businesses')
      .update({ next_invoice_num: updatedNextInvoiceNum })
      .eq('id', businessId)
      .eq('next_invoice_num', reservedInvoiceNum)
      .select('next_invoice_num')
      .single();
    if (reserveErr) throw reserveErr;

    if (reservedRow) {
      return {
        invoicePrefix: currentBusiness.invoice_prefix || undefined,
        reservedInvoiceNum,
        updatedNextInvoiceNum,
      };
    }
  }

  throw new Error('Could not reserve next invoice number. Please try again.');
}

export function useInvoices() {
  const { business, setNextInvoiceNum } = useBusiness();
  const qc = useQueryClient();
  const key = ['invoices', business?.id];

  const query = useQuery({
    queryKey: key,
    enabled: !!business?.id,
    queryFn: async () => {
      const { data, error } = await localDb
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
      const paidAmount = Number(invoice.paid_amount || 0);
      const {
        invoicePrefix,
        reservedInvoiceNum,
        updatedNextInvoiceNum,
      } = await reserveNextInvoiceNumber(business!.id);
      setNextInvoiceNum(updatedNextInvoiceNum);

      const invoiceNumber = formatDocumentNumber(
        invoice.type,
        invoicePrefix,
        reservedInvoiceNum,
        invoice.invoice_number
      );
      const invoicePayload = { ...invoice, invoice_number: invoiceNumber };

      // Determine status based on payment
      let finalStatus = desiredStatus;
      if (desiredStatus === 'issued' && paidAmount > 0) {
        const total = Number(invoice.total_amount || 0);
        finalStatus = paidAmount >= total ? 'paid' : 'partially_paid';
      }

      // Insert invoice as draft first so trigger doesn't fire before items exist
      const { error: invErr } = await localDb.from('invoices').insert({
        ...invoicePayload,
        id: invoiceId,
        business_id: business!.id,
        status: 'draft' as any,
      });
      if (invErr) throw invErr;

      if (items.length > 0) {
        const { error: itemsErr } = await localDb.from('invoice_items').insert(
          items.map((item, idx) => ({
            ...item,
            invoice_id: invoiceId,
            sort_order: idx,
          }))
        );
        if (itemsErr) throw itemsErr;
      }

      // Now update status to desired value so the trigger fires with items present
      if (finalStatus !== 'draft') {
        const { error: statusErr } = await localDb
          .from('invoices')
          .update({ status: finalStatus as any, updated_at: new Date().toISOString() })
          .eq('id', invoiceId);
        if (statusErr) throw statusErr;
      }

      // Record payment if amount received
      if (paidAmount > 0 && desiredStatus !== 'draft') {
        const partyId = invoicePayload.customer_id || invoicePayload.vendor_id || null;
        const { nepalNow, formatLocalDate } = await import('@/lib/nepal-date');
        const now = nepalNow();
        const { adToBS, formatBSShort } = await import('@/lib/bs-calendar');
        const bsDate = adToBS(now);

        const { error: payErr } = await localDb.from('payments').insert({
          business_id: business!.id,
          invoice_id: invoiceId,
          party_id: partyId,
          amount: paidAmount,
          method: 'cash' as any,
          status: 'completed' as any,
          payment_date_ad: formatLocalDate(now),
          payment_date_bs: formatBSShort(bsDate),
          notes: `Payment received on invoice ${invoicePayload.invoice_number}`,
        });
        if (payErr) throw payErr;
      }

      return invoiceId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ['items', business?.id] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['all_payments'] });
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
      const { business_id, ...invoiceUpdates } = invoice;
      const { data: existingInvoice, error: invErr } = await localDb
        .from('invoices')
        .update({ ...invoiceUpdates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('business_id', business!.id)
        .select('id')
        .single();
      if (invErr) throw invErr;

      if (items !== undefined) {
        if (!existingInvoice) throw new Error('Invoice not found');

        // Delete existing items and re-insert
        const { error: delErr } = await localDb
          .from('invoice_items')
          .delete()
          .eq('invoice_id', id);
        if (delErr) throw delErr;

        if (items.length > 0) {
          const { error: itemsErr } = await localDb.from('invoice_items').insert(
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
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ['invoice', business?.id, id] });
    },
  });

  const cancelInvoice = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await localDb
        .from('invoices')
        .update({ status: 'cancelled' as any, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('business_id', business!.id)
        .select('id')
        .single();
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ['invoice', business?.id, id] });
      qc.invalidateQueries({ queryKey: ['items', business?.id] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  return { invoices: query.data || [], isLoading: query.isLoading, createInvoice, updateInvoice, cancelInvoice };
}

export function useInvoiceList({
  type,
  status = 'all',
  search = '',
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
}: UseInvoiceListParams = {}) {
  const { business } = useBusiness();
  const { from, to } = getRange(page, pageSize);
  const cleanSearch = search.trim();

  return useQuery({
    queryKey: ['invoice_list', business?.id, type, status, cleanSearch, page, pageSize],
    enabled: !!business?.id,
    queryFn: async () => {
      let query = localDb
        .from('invoices')
        .select('*, customer:parties!invoices_customer_id_fkey(name), vendor:parties!invoices_vendor_id_fkey(name)', { count: 'exact' })
        .eq('business_id', business!.id)
        .is('deleted_at', null);

      if (type) query = query.eq('type', type as any);
      if (status !== 'all') query = query.eq('status', status as any);
      if (cleanSearch) query = query.ilike('invoice_number', `%${cleanSearch}%`);

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      return { data: data as InvoiceWithParty[], count: count || 0 };
    },
  });
}

export function useInvoiceDetail(id: string | undefined) {
  const { business } = useBusiness();

  return useQuery({
    queryKey: ['invoice', business?.id, id],
    enabled: !!id && !!business?.id,
    queryFn: async () => {
      const { data, error } = await localDb
        .from('invoices')
        .select('*, customer:parties!invoices_customer_id_fkey(name, phone, email, address, city, pan_number), vendor:parties!invoices_vendor_id_fkey(name, phone, email, address, city, pan_number), invoice_items(*)')
        .eq('id', id!)
        .eq('business_id', business!.id)
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
    queryKey: ['payments', business?.id, invoiceId],
    enabled: !!invoiceId && !!business?.id,
    queryFn: async () => {
      const { data, error } = await localDb
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
      if (payment.invoice_id) {
        const { data: invoice, error: invoiceErr } = await localDb
          .from('invoices')
          .select('id')
          .eq('id', payment.invoice_id)
          .eq('business_id', business!.id)
          .single();
        if (invoiceErr) throw invoiceErr;
        if (!invoice) throw new Error('Invoice not found');
      }

      const { data, error } = await localDb
        .from('payments')
        .insert({ ...payment, business_id: business!.id })
        .select()
        .single();
      if (error) throw error;

      // Update invoice paid_amount and balance_due
      if (payment.invoice_id) {
        const { data: inv } = await localDb
          .from('invoices')
          .select('paid_amount, total_amount')
          .eq('id', payment.invoice_id)
          .eq('business_id', business!.id)
          .single();
        if (inv) {
          const newPaid = Number(inv.paid_amount) + Number(payment.amount);
          const newBalance = Number(inv.total_amount) - newPaid;
          const newStatus = newBalance <= 0 ? 'paid' : newPaid > 0 ? 'partially_paid' : undefined;
          await localDb
            .from('invoices')
            .update({
              paid_amount: newPaid,
              balance_due: Math.max(0, newBalance),
              ...(newStatus ? { status: newStatus } : {}),
            })
            .eq('id', payment.invoice_id)
            .eq('business_id', business!.id);
        }
      }

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments', business?.id, invoiceId] });
      qc.invalidateQueries({ queryKey: ['invoice', business?.id, invoiceId] });
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
      const { data, error } = await localDb
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
