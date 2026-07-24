import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { localDb } from '@/integrations/local-db/client';
import { useBusiness } from '@/contexts/BusinessContext';
import { useAuth } from '@/contexts/AuthContext';
import type { Tables, TablesInsert } from '@/integrations/local-db/types';
import { canDirectlyEditInvoice, validateInvoiceIssuePreflight } from '@/lib/vat-compliance';
import { calculateAuditEventHash, verifyAuditHashChain } from '@/lib/audit-chain';
import { adToBS, formatBSShort, getFiscalYear, getVATPeriod, todayBS } from '@/lib/bs-calendar';
import { parseLocalDate } from '@/lib/nepal-date';

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
const DOCUMENT_COUNTERS = {
  sale: 'next_sales_invoice_num',
  purchase: 'next_purchase_bill_num',
  quotation: 'next_quotation_num',
  sale_return: 'next_credit_note_num',
  purchase_return: 'next_debit_note_num',
} as const;

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
  if (type === 'sale_return') return `CN-${serial}`;
  if (type === 'purchase_return') return `DN-${serial}`;
  if (type === 'sale') return `${invoicePrefix || 'INV'}-${serial}`;
  return fallback || `${invoicePrefix || 'INV'}-${serial}`;
}

function getDocumentCounterColumn(type: string | undefined) {
  if (type === 'purchase') return DOCUMENT_COUNTERS.purchase;
  if (type === 'quotation') return DOCUMENT_COUNTERS.quotation;
  if (type === 'sale_return') return DOCUMENT_COUNTERS.sale_return;
  if (type === 'purchase_return') return DOCUMENT_COUNTERS.purchase_return;
  return DOCUMENT_COUNTERS.sale;
}

function parseDocumentSerial(invoiceNumber: string | null | undefined): number | null {
  const match = invoiceNumber?.match(/(\d+)$/);
  return match ? Number(match[1]) : null;
}

async function getNextSerialAfterExistingFiscalDocuments(
  businessId: string,
  type: string | undefined,
  fiscalYear: string
) {
  const { data, error } = await localDb
    .from('invoices')
    .select('invoice_number, issued_date_ad, fiscal_year, document_serial')
    .eq('business_id', businessId)
    .eq('type', (type || 'sale') as any)
    .is('deleted_at', null);
  if (error) throw error;

  const maxSerial = (data || []).reduce((max, row) => {
    const rowFiscalYear = row.fiscal_year || getFiscalYear(adToBS(parseLocalDate(row.issued_date_ad)));
    if (rowFiscalYear !== fiscalYear) return max;
    const serial = Number(row.document_serial || parseDocumentSerial(row.invoice_number) || 0);
    return serial > max ? serial : max;
  }, 0);

  return maxSerial + 1;
}

async function findOrCreateDocumentSequence(
  businessId: string,
  type: string | undefined,
  fiscalYear: string
) {
  const documentType = type || 'sale';
  const { data: existing, error: existingErr } = await localDb
    .from('document_sequences')
    .select('*')
    .eq('business_id', businessId)
    .eq('document_type', documentType as any)
    .eq('fiscal_year', fiscalYear)
    .single();
  if (existingErr) throw existingErr;
  if (existing) return existing;

  const nextSerial = await getNextSerialAfterExistingFiscalDocuments(businessId, type, fiscalYear);
  const sequenceId = crypto.randomUUID();
  const { data: inserted, error: insertErr } = await localDb
    .from('document_sequences')
    .insert({
      id: sequenceId,
      business_id: businessId,
      document_type: documentType as any,
      fiscal_year: fiscalYear,
      next_serial: nextSerial,
    })
    .select('*')
    .single();
  if (insertErr) throw insertErr;
  if (!inserted) throw new Error('Could not create document sequence');
  return inserted;
}

const MAX_INVOICE_NUMBER_RESERVE_RETRIES = 10;

async function reserveNextInvoiceNumber(businessId: string, type: string | undefined, issuedDateAd: string | undefined) {
  const counterColumn = getDocumentCounterColumn(type);
  const fiscalYear = getFiscalYear(adToBS(parseLocalDate(issuedDateAd || new Date().toISOString().slice(0, 10))));
  for (let attempt = 0; attempt < MAX_INVOICE_NUMBER_RESERVE_RETRIES; attempt += 1) {
    const { data: currentBusiness, error: businessErr } = await localDb
      .from('businesses')
      .select('invoice_prefix, next_invoice_num, next_sales_invoice_num, next_purchase_bill_num, next_quotation_num, next_credit_note_num, next_debit_note_num')
      .eq('id', businessId)
      .single();
    if (businessErr) throw businessErr;
    if (!currentBusiness) throw new Error('Business not found');

    const currentSequence = await findOrCreateDocumentSequence(businessId, type, fiscalYear);
    const currentCounter = Number(currentSequence.next_serial || 1);
    const nextAfterExisting = await getNextSerialAfterExistingFiscalDocuments(businessId, type, fiscalYear);
    const reservedInvoiceNum = Math.max(currentCounter, nextAfterExisting);
    const updatedNextInvoiceNum = reservedInvoiceNum + 1;

    const { data: reservedRow, error: reserveErr } = await localDb
      .from('document_sequences')
      .update({ next_serial: updatedNextInvoiceNum, updated_at: new Date().toISOString() })
      .eq('id', currentSequence.id)
      .eq('next_serial', currentCounter)
      .select('next_serial')
      .single();
    if (reserveErr) throw reserveErr;

    if (reservedRow) {
      await localDb
        .from('businesses')
        .update({
          [counterColumn]: updatedNextInvoiceNum,
          ...(type === 'sale' ? { next_invoice_num: updatedNextInvoiceNum } : {}),
        })
        .eq('id', businessId);

      return {
        invoicePrefix: currentBusiness.invoice_prefix || undefined,
        reservedInvoiceNum,
        updatedNextInvoiceNum,
        fiscalYear,
      };
    }
  }

  throw new Error('Could not reserve next invoice number. Please try again.');
}

async function logInvoiceEvent({
  businessId,
  invoiceId,
  userId,
  action,
  details,
}: {
  businessId: string;
  invoiceId: string;
  userId?: string | null;
  action: string;
  details?: Record<string, unknown>;
}) {
  const { data: previousEvents, error: previousErr } = await localDb
    .from('invoice_events')
    .select('event_hash')
    .eq('invoice_id', invoiceId)
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (previousErr) throw previousErr;

  const createdAt = new Date().toISOString();
  const previousHash = previousEvents?.[0]?.event_hash || "";
  const serializedDetails = details ? JSON.stringify(details) : null;
  const eventHash = await calculateAuditEventHash({
    business_id: businessId,
    invoice_id: invoiceId,
    action,
    details: serializedDetails,
    created_at: createdAt,
    previous_hash: previousHash,
  });

  const { error } = await localDb.from('invoice_events').insert({
    business_id: businessId,
    invoice_id: invoiceId,
    user_id: userId || null,
    action,
    details: serializedDetails,
    previous_hash: previousHash || null,
    event_hash: eventHash,
    created_at: createdAt,
  });
  if (error) throw error;
}

async function getStockByItemId(items: Array<{ item_id?: string | null }>) {
  const itemIds = Array.from(new Set(items.map((item) => item.item_id).filter(Boolean))) as string[];
  if (itemIds.length === 0) return {};

  const { data, error } = await localDb
    .from('items')
    .select('id, name, type, current_stock')
    .in('id', itemIds);
  if (error) throw error;

  return Object.fromEntries(
    (data || []).map((item: any) => [
      item.id,
      { name: item.name, type: item.type, current_stock: Number(item.current_stock || 0) },
    ])
  );
}

export function useInvoices() {
  const { business, setNextDocumentNum } = useBusiness();
  const { user } = useAuth();
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
      const desiredStatus = invoice.status || 'draft';
      const paidAmount = Number(invoice.paid_amount || 0);
      const stockByItemId = await getStockByItemId(items);
      const preflight = validateInvoiceIssuePreflight({
        type: invoice.type,
        status: desiredStatus,
        isVatInvoice: Boolean(invoice.is_vat_invoice),
        isBusinessVatRegistered: Boolean(business?.is_vat_registered),
        businessPan: business?.pan_number,
        buyerPan: invoice.buyer_pan,
        totals: {
          discountAmount: Number(invoice.discount_amount || 0),
          taxableAmount: Number(invoice.taxable_amount || 0),
          vatAmount: Number(invoice.vat_amount || 0),
          totalAmount: Number(invoice.total_amount || 0),
        },
        lines: items,
        stockByItemId,
      });
      if (!preflight.ok) {
        throw new Error(preflight.errors[0]);
      }

      const fiscalYear = getFiscalYear(
        adToBS(parseLocalDate(invoice.issued_date_ad || new Date().toISOString().slice(0, 10)))
      );

      const response = await localDb.documents.createAndIssue({
        invoice: {
          ...invoice,
          business_id: business!.id,
          fiscal_year: fiscalYear,
          status: desiredStatus,
          paid_amount: paidAmount,
        },
        items: items as Array<Record<string, unknown>>,
        paymentAmount: paidAmount,
      });
      if (response.error) throw response.error;
      if (!response.data?.id) throw new Error('Could not create document');

      const serial = Number(String(response.data.invoice_number).match(/(\d+)$/)?.[1] || 0);
      if (serial > 0) {
        setNextDocumentNum(invoice.type, serial + 1);
      }

      return response.data.id;
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
      const { data: existingInvoice, error: existingErr } = await localDb
        .from('invoices')
        .select('id, type, status, is_vat_invoice, buyer_pan')
        .eq('id', id)
        .eq('business_id', business!.id)
        .single();
      if (existingErr) throw existingErr;
      if (!existingInvoice) throw new Error('Invoice not found');
      if (!canDirectlyEditInvoice(existingInvoice)) {
        throw new Error('Issued VAT invoices cannot be edited directly');
      }
      const nextIsVatInvoice = invoiceUpdates.is_vat_invoice ?? existingInvoice.is_vat_invoice;
      const nextBuyerPan = invoiceUpdates.buyer_pan ?? existingInvoice.buyer_pan;
      if (items !== undefined) {
        const stockByItemId = await getStockByItemId(items);
        const preflight = validateInvoiceIssuePreflight({
          type: invoiceUpdates.type || existingInvoice.type,
          status: invoiceUpdates.status || existingInvoice.status,
          isVatInvoice: Boolean(nextIsVatInvoice),
          isBusinessVatRegistered: Boolean(business?.is_vat_registered),
          businessPan: business?.pan_number,
          buyerPan: nextBuyerPan,
          totals: {
            discountAmount: Number(invoiceUpdates.discount_amount || 0),
            taxableAmount: Number(invoiceUpdates.taxable_amount || 0),
            vatAmount: Number(invoiceUpdates.vat_amount || 0),
            totalAmount: Number(invoiceUpdates.total_amount || 0),
          },
          lines: items,
          stockByItemId,
          fiscalYear: invoiceUpdates.fiscal_year,
          documentSerial: invoiceUpdates.document_serial,
        });
        if (!preflight.ok) {
          throw new Error(preflight.errors[0]);
        }
      }

      const { error: invErr } = await localDb
        .from('invoices')
        .update({ ...invoiceUpdates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('business_id', business!.id);
      if (invErr) throw invErr;

      if (items !== undefined) {
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

      await logInvoiceEvent({
        businessId: business!.id,
        invoiceId: id,
        userId: user?.id,
        action: 'updated',
        details: { status: invoiceUpdates.status, type: invoiceUpdates.type, line_items_replaced: items !== undefined },
      });

      return id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ['invoice', business?.id, id] });
      qc.invalidateQueries({ queryKey: ['invoice_events', business?.id, id] });
      qc.invalidateQueries({ queryKey: ['invoice_audit_verification', business?.id, id] });
    },
  });

  const cancelInvoice = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const trimmedReason = reason.trim();
      if (!trimmedReason) throw new Error('Cancellation reason is required');
      const { error } = await localDb
        .from('invoices')
        .update({
          status: 'cancelled' as any,
          cancellation_reason: trimmedReason,
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('business_id', business!.id)
        .select('id')
        .single();
      if (error) throw error;
      await logInvoiceEvent({
        businessId: business!.id,
        invoiceId: id,
        userId: user?.id,
        action: 'cancelled',
        details: { reason: trimmedReason },
      });
      return id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ['invoice', business?.id, id] });
      qc.invalidateQueries({ queryKey: ['items', business?.id] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['invoice_events', business?.id, id] });
      qc.invalidateQueries({ queryKey: ['invoice_audit_verification', business?.id, id] });
    },
  });

  const recordInvoicePrint = useMutation({
    mutationFn: async (id: string) => {
      const { data: invoice, error: fetchErr } = await localDb
        .from('invoices')
        .select('print_count')
        .eq('id', id)
        .eq('business_id', business!.id)
        .single();
      if (fetchErr) throw fetchErr;
      if (!invoice) throw new Error('Invoice not found');

      const { error } = await localDb
        .from('invoices')
        .update({
          print_count: Number(invoice.print_count || 0) + 1,
          last_printed_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('business_id', business!.id);
      if (error) throw error;
      await logInvoiceEvent({
        businessId: business!.id,
        invoiceId: id,
        userId: user?.id,
        action: 'printed',
        details: { print_count: Number(invoice.print_count || 0) + 1 },
      });
    },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['invoice', business?.id, id] });
      qc.invalidateQueries({ queryKey: ['invoice_events', business?.id, id] });
      qc.invalidateQueries({ queryKey: ['invoice_audit_verification', business?.id, id] });
    },
  });

  const recordInvoiceExport = useMutation({
    mutationFn: async ({ id, format }: { id: string; format: string }) => {
      await logInvoiceEvent({
        businessId: business!.id,
        invoiceId: id,
        userId: user?.id,
        action: 'exported',
        details: { format },
      });
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['invoice_events', business?.id, id] });
      qc.invalidateQueries({ queryKey: ['invoice_audit_verification', business?.id, id] });
    },
  });

  const createCorrectionNote = useMutation({
    mutationFn: async ({
      originalInvoiceId,
      noteType,
      reason,
      category = 'other',
      selections,
    }: {
      originalInvoiceId: string;
      noteType: 'credit' | 'debit';
      reason: string;
      category?: 'return' | 'rate_adjustment' | 'other';
      selections?: Array<{
        sourceLineId?: string;
        item_id?: string | null;
        name: string;
        unit?: string | null;
        hsn_code?: string | null;
        quantity: number;
        rate: number;
        discount_pct?: number;
        tax_type?: string | null;
        vat_rate?: number | null;
        maxQuantity: number;
      }>;
    }) => {
      const { buildPartialCorrectionItems } = await import('@/lib/correction-notes');
      const correctionReason = reason.trim();
      if (!correctionReason) throw new Error('Correction reason is required');
      const { data: originalInvoice, error: originalErr } = await localDb
        .from('invoices')
        .select('*, invoice_items(*)')
        .eq('id', originalInvoiceId)
        .eq('business_id', business!.id)
        .single();
      if (originalErr) throw originalErr;
      if (!originalInvoice) throw new Error('Original invoice not found');
      if (originalInvoice.status === 'draft') throw new Error('Correction notes require an issued invoice');

      const { data: priorNotes, error: priorErr } = await localDb
        .from('invoices')
        .select('id, invoice_items(item_id, name, quantity)')
        .eq('business_id', business!.id)
        .eq('original_invoice_id', originalInvoiceId)
        .is('deleted_at', null);
      if (priorErr) throw priorErr;

      const priorLines = (priorNotes || []).flatMap((note: any) => note.invoice_items || []);
      const { remainingCorrectableQuantities } = await import('@/lib/correction-notes');
      const remaining = remainingCorrectableQuantities(originalInvoice.invoice_items || [], priorLines);

      const defaultSelections = (originalInvoice.invoice_items || []).map((item: InvoiceItem) => {
        const key = item.id || `${item.item_id || 'none'}::${item.name}`;
        const maxQuantity = remaining.get(key) ?? Number(item.quantity || 0);
        return {
          sourceLineId: item.id,
          item_id: item.item_id,
          name: item.name,
          unit: item.unit,
          hsn_code: item.hsn_code,
          quantity: maxQuantity,
          rate: item.rate,
          discount_pct: item.discount_pct,
          tax_type: item.tax_type,
          vat_rate: item.vat_rate,
          maxQuantity,
        };
      }).filter((line) => line.maxQuantity > 0);

      const chosen = (selections && selections.length > 0 ? selections : defaultSelections)
        .map((line) => ({
          ...line,
          maxQuantity: line.maxQuantity ?? remaining.get(line.sourceLineId || `${line.item_id || 'none'}::${line.name}`) ?? line.quantity,
        }));

      const { lines, totals } = buildPartialCorrectionItems(chosen);

      const correctionType = noteType === 'credit' ? 'sale_return' : 'purchase_return';
      const newId = await createInvoice.mutateAsync({
        invoice: {
          invoice_number: correctionType === 'sale_return'
            ? `CN-${String(business?.next_credit_note_num || 1).padStart(4, '0')}`
            : `DN-${String(business?.next_debit_note_num || 1).padStart(4, '0')}`,
          type: correctionType as any,
          status: 'draft',
          customer_id: originalInvoice.customer_id,
          vendor_id: originalInvoice.vendor_id,
          buyer_name: originalInvoice.buyer_name,
          buyer_pan: originalInvoice.buyer_pan,
          buyer_phone: originalInvoice.buyer_phone,
          buyer_address: originalInvoice.buyer_address,
          is_vat_invoice: originalInvoice.is_vat_invoice,
          issued_date_ad: new Date().toISOString().slice(0, 10),
          issued_date_bs: formatBSShort(todayBS()),
          due_date_ad: null,
          due_date_bs: null,
          vat_period: originalInvoice.is_vat_invoice ? getVATPeriod(todayBS()) : null,
          sub_total: totals.sub_total ?? totals.taxable_amount,
          discount_amount: totals.discount_amount,
          taxable_amount: totals.taxable_amount,
          vat_amount: totals.vat_amount,
          total_amount: totals.total_amount,
          paid_amount: 0,
          balance_due: 0,
          original_invoice_id: originalInvoice.id,
          original_invoice_number: originalInvoice.invoice_number,
          correction_reason: `${category}: ${correctionReason}`,
          correction_type: noteType,
          notes: correctionReason,
          reference_number: originalInvoice.invoice_number,
        },
        items: lines,
      });

      await logInvoiceEvent({
        businessId: business!.id,
        invoiceId: originalInvoice.id,
        userId: user?.id,
        action: noteType === 'credit' ? 'credit_note_created' : 'debit_note_created',
        details: { note_invoice_id: newId, reason: correctionReason, category, status: 'draft_for_line_review', line_count: lines.length },
      });

      return newId;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ['invoice', business?.id, id] });
      qc.invalidateQueries({ queryKey: ['invoice_events'] });
      qc.invalidateQueries({ queryKey: ['items', business?.id] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  return { invoices: query.data || [], isLoading: query.isLoading, createInvoice, updateInvoice, cancelInvoice, recordInvoicePrint, recordInvoiceExport, createCorrectionNote };
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
  const { user } = useAuth();
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

        await logInvoiceEvent({
          businessId: business!.id,
          invoiceId: payment.invoice_id,
          userId: user?.id,
          action: 'payment_recorded',
          details: { amount: payment.amount, method: payment.method, status: payment.status || 'completed' },
        });
      }

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments', business?.id, invoiceId] });
      qc.invalidateQueries({ queryKey: ['invoice', business?.id, invoiceId] });
      qc.invalidateQueries({ queryKey: ['invoice_events', business?.id, invoiceId] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  return { payments: query.data || [], isLoading: query.isLoading, recordPayment };
}

export function useInvoiceEvents(invoiceId: string | undefined) {
  const { business } = useBusiness();

  return useQuery({
    queryKey: ['invoice_events', business?.id, invoiceId],
    enabled: !!invoiceId && !!business?.id,
    queryFn: async () => {
      const { data, error } = await localDb
        .from('invoice_events')
        .select('*')
        .eq('invoice_id', invoiceId!)
        .eq('business_id', business!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Tables<'invoice_events'>[];
    },
  });
}

export function useInvoiceAuditVerification(invoiceId: string | undefined) {
  const { business } = useBusiness();

  return useQuery({
    queryKey: ['invoice_audit_verification', business?.id, invoiceId],
    enabled: !!invoiceId && !!business?.id,
    queryFn: async () => {
      const { data, error } = await localDb
        .from('invoice_events')
        .select('*')
        .eq('invoice_id', invoiceId!)
        .eq('business_id', business!.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return verifyAuditHashChain(data || []);
    },
  });
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
