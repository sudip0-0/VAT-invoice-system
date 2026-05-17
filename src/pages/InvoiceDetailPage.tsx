import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Printer, CreditCard, Pencil, Ban, FileOutput, Share2, FilePlus2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useInvoiceAuditVerification, useInvoiceDetail, useInvoiceEvents, useInvoicePayments, useInvoices } from '@/hooks/useInvoices';
import { useBusiness } from '@/contexts/BusinessContext';
import { useToast } from '@/hooks/use-toast';
import { formatNPR } from '@/lib/nepal-format';
import { amountInWords } from '@/lib/amount-in-words';
import StatusBadge from '@/components/shared/StatusBadge';
import PaymentDialog from '@/components/invoices/PaymentDialog';
import PrintInvoice from '@/components/invoices/PrintInvoice';
import { nepalTodayISO } from '@/lib/nepal-date';
import { formatBSShort, getVATPeriod, todayBS } from '@/lib/bs-calendar';
import { canDirectlyEditInvoice } from '@/lib/vat-compliance';

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { business } = useBusiness();
  const { data: invoice, isLoading } = useInvoiceDetail(id);
  const { payments, recordPayment } = useInvoicePayments(id);
  const { data: invoiceEvents = [] } = useInvoiceEvents(id);
  const { data: auditVerification } = useInvoiceAuditVerification(id);
  const { cancelInvoice, createCorrectionNote, createInvoice, recordInvoiceExport, recordInvoicePrint } = useInvoices();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [printOptionsOpen, setPrintOptionsOpen] = useState(false);
  const [printSize, setPrintSize] = useState<"a4" | "a5">("a5");
  const [showPrint, setShowPrint] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionType, setCorrectionType] = useState<'credit' | 'debit'>('credit');
  const [correctionReason, setCorrectionReason] = useState('');

  const handlePrint = () => {
    if (id) {
      recordInvoicePrint.mutate(id);
    }
    setShowPrint(true);
    setPrintOptionsOpen(false);
    const printStyle = document.createElement('style');
    printStyle.id = 'invoice-print-page-size';
    printStyle.textContent = `@media print { @page { size: ${printSize.toUpperCase()}; margin: ${printSize === 'a4' ? '8mm' : '6mm'}; } }`;
    document.head.appendChild(printStyle);
    // Wait for the print template to render, then trigger print
    requestAnimationFrame(() => {
      setTimeout(() => {
        window.print();
        // Keep template visible briefly after print dialog closes
        const onAfterPrint = () => {
          setShowPrint(false);
          printStyle.remove();
          window.removeEventListener('afterprint', onAfterPrint);
        };
        window.addEventListener('afterprint', onAfterPrint);
        // Fallback: hide after 60s if afterprint never fires
        setTimeout(() => {
          setShowPrint(false);
          printStyle.remove();
        }, 60000);
      }, 200);
    });
  };

  const handlePayment = async (data: Record<string, any>) => {
    try {
      await recordPayment.mutateAsync(data as any);
      toast({ title: 'Payment recorded' });
      setPaymentOpen(false);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleCancel = async () => {
    try {
      await cancelInvoice.mutateAsync({ id: id!, reason: cancelReason });
      toast({ title: 'Invoice cancelled' });
      setCancelOpen(false);
      setCancelReason('');
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleCorrectionNote = async () => {
    try {
      const newId = await createCorrectionNote.mutateAsync({
        originalInvoiceId: id!,
        noteType: correctionType,
        reason: correctionReason,
      });
      toast({ title: correctionType === 'credit' ? 'Draft credit note created' : 'Draft debit note created' });
      setCorrectionOpen(false);
      setCorrectionReason('');
      navigate(`/invoices/${newId}/edit`);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  useEffect(() => {
    if (searchParams.get('print') !== '1') return;
    setPrintOptionsOpen(true);
    navigate(`/invoices/${id}`, { replace: true });
  }, [id, navigate, searchParams]);

  if (isLoading) return <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>;
  if (!invoice) return <div className="p-8 text-center text-sm text-muted-foreground">Invoice not found.</div>;

  const party = invoice.customer || invoice.vendor;
  const displayParty = {
    name: invoice.buyer_name || (party as any)?.name || '',
    address: invoice.buyer_address || [(party as any)?.address, (party as any)?.city].filter(Boolean).join(', '),
    phone: invoice.buyer_phone || (party as any)?.phone || '',
    pan_number: invoice.buyer_pan || (party as any)?.pan_number || '',
  };
  const partyId = invoice.customer_id || invoice.vendor_id;
  const lineItems = (invoice.invoice_items || []).sort((a, b) => a.sort_order - b.sort_order);
  const isCancelled = invoice.status === 'cancelled';
  const canEdit = canDirectlyEditInvoice(invoice);
  const isQuotation = invoice.type === 'quotation';
  const isCreditNote = invoice.type === 'sale_return';
  const isDebitNote = invoice.type === 'purchase_return';
  const isCorrectionNote = isCreditNote || isDebitNote;
  const backPath = isQuotation ? '/quotations' : '/invoices';

  const handleWhatsAppShare = () => {
    if (id) {
      recordInvoiceExport.mutate({ id, format: 'whatsapp_share' });
    }
    const partyName = displayParty.name || 'Customer';
    const typeName = invoice.type === 'quotation' ? 'Quotation' : invoice.type === 'sale' ? 'Invoice' : 'Purchase Bill';
    const lines = [
      `*${typeName}: ${invoice.invoice_number}*`,
      `From: ${business?.name || ''}`,
      `To: ${partyName}`,
      `Date (BS): ${invoice.issued_date_bs}`,
      '',
      `*Total: ${formatNPR(invoice.total_amount)}*`,
    ];
    if (invoice.balance_due > 0) {
      lines.push(`Balance Due: ${formatNPR(invoice.balance_due)}`);
    }
    if (invoice.due_date_bs) {
      lines.push(`Due Date: ${invoice.due_date_bs}`);
    }
    lines.push('', `View: ${window.location.href}`);
    const text = encodeURIComponent(lines.join('\n'));
    const partyPhone = displayParty.phone.replace(/[^0-9]/g, '') || '';
    const url = partyPhone
      ? `https://wa.me/${partyPhone.startsWith('977') ? partyPhone : '977' + partyPhone}?text=${text}`
      : `https://wa.me/?text=${text}`;
    window.open(url, '_blank');
  };

  const handleConvertToInvoice = async () => {
    try {
      const todayAd = nepalTodayISO();
      const todayBsDate = todayBS();
      const todayBs = formatBSShort(todayBsDate);
      const newId = await createInvoice.mutateAsync({
        invoice: {
          invoice_number: `${business?.invoice_prefix || 'INV'}-${String(business?.next_sales_invoice_num || business?.next_invoice_num || 1).padStart(4, '0')}`,
          type: 'sale',
          status: 'draft',
          customer_id: invoice.customer_id,
          vendor_id: null,
          buyer_name: invoice.buyer_name,
          buyer_pan: invoice.buyer_pan,
          buyer_phone: invoice.buyer_phone,
          buyer_address: invoice.buyer_address,
          is_vat_invoice: invoice.is_vat_invoice,
          issued_date_ad: todayAd,
          issued_date_bs: todayBs,
          due_date_ad: invoice.due_date_ad,
          due_date_bs: invoice.due_date_bs,
          vat_period: invoice.is_vat_invoice ? getVATPeriod(todayBsDate) : null,
          sub_total: invoice.sub_total,
          discount_amount: invoice.discount_amount,
          taxable_amount: invoice.taxable_amount,
          vat_amount: invoice.vat_amount,
          total_amount: invoice.total_amount,
          balance_due: invoice.total_amount,
          notes: invoice.notes,
          reference_number: invoice.reference_number || invoice.invoice_number,
        },
        items: lineItems.map((l) => ({
          item_id: l.item_id,
          hsn_code: l.hsn_code,
          name: l.name,
          unit: l.unit,
          quantity: l.quantity,
          rate: l.rate,
          discount_pct: l.discount_pct,
          discount_amt: l.discount_amt,
          tax_type: l.tax_type,
          vat_rate: l.vat_rate,
          taxable_amount: l.taxable_amount,
          vat_amount: l.vat_amount,
          total_amount: l.total_amount,
        })),
      });
      toast({ title: 'Invoice created from quotation' });
      navigate(`/invoices/${newId}/edit`);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4 animate-fade-in max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 print:hidden">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(backPath)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-bold text-foreground">{invoice.invoice_number}</h1>
        <StatusBadge status={invoice.status.toUpperCase()} />
        <div className="ml-auto flex gap-2">
          {isQuotation && !isCancelled && (
            <Button size="sm" className="gap-1.5 text-xs" onClick={handleConvertToInvoice} disabled={createInvoice.isPending}>
              <FileOutput className="h-3.5 w-3.5" /> Convert to Invoice
            </Button>
          )}
          {canEdit && (
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => navigate(`/invoices/${id}/edit`)}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          )}
          {!isCancelled && !isQuotation && invoice.balance_due > 0 && (
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setPaymentOpen(true)}>
              <CreditCard className="h-3.5 w-3.5" /> Record Payment
            </Button>
          )}
          {!isCancelled && !isQuotation && !isCorrectionNote && invoice.status !== 'draft' && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs"
              onClick={() => {
                setCorrectionType(invoice.type === 'purchase' ? 'debit' : 'credit');
                setCorrectionOpen(true);
              }}
            >
              <FilePlus2 className="h-3.5 w-3.5" /> CN / DN
            </Button>
          )}
          {!isCancelled && (
            <Button size="sm" variant="outline" className="gap-1.5 text-xs text-destructive hover:text-destructive" onClick={() => setCancelOpen(true)}>
              <Ban className="h-3.5 w-3.5" /> Cancel
            </Button>
          )}
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={handleWhatsAppShare}>
            <Share2 className="h-3.5 w-3.5" /> WhatsApp
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setPrintOptionsOpen(true)}>
            <Printer className="h-3.5 w-3.5" /> Print / PDF
          </Button>
        </div>
      </div>

      {/* Printable Invoice */}
      <div className="rounded-lg border border-border bg-card p-6 print:border-0 print:shadow-none print:p-0">
        {/* Business + Party header */}
        <div className="flex justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-foreground">{business?.name}</h2>
            <p className="text-xs text-muted-foreground">{business?.address}{business?.city ? `, ${business.city}` : ''}</p>
            <p className="text-xs text-muted-foreground">{business?.phone}</p>
            {business?.pan_number && <p className="text-xs text-muted-foreground">PAN: {business.pan_number}</p>}
          </div>
          <div className="text-right">
            <h3 className="text-sm font-semibold text-foreground">
              {invoice.type === 'quotation' ? 'QUOTATION' : isCreditNote ? 'CREDIT NOTE' : isDebitNote ? 'DEBIT NOTE' : invoice.type === 'sale' ? 'SALES INVOICE' : 'PURCHASE BILL'}
              {invoice.is_vat_invoice && ' (VAT)'}
            </h3>
            <p className="text-sm font-mono font-bold text-foreground">{invoice.invoice_number}</p>
            <p className="text-xs text-muted-foreground mt-1">Date (BS): {invoice.issued_date_bs}</p>
            <p className="text-xs text-muted-foreground">Date (AD): {new Date(invoice.issued_date_ad).toLocaleDateString()}</p>
            {invoice.due_date_bs && <p className="text-xs text-muted-foreground">Due: {invoice.due_date_bs}</p>}
            {invoice.vat_period && <p className="text-xs text-muted-foreground">VAT Period: {invoice.vat_period}</p>}
            {invoice.original_invoice_number && <p className="text-xs text-muted-foreground">Original Invoice: {invoice.original_invoice_number}</p>}
            {invoice.print_count > 0 && <p className="text-xs text-muted-foreground">Printed: {invoice.print_count} time{invoice.print_count === 1 ? '' : 's'}</p>}
            {isCancelled && <p className="text-xs font-bold text-destructive mt-1">CANCELLED</p>}
          </div>
        </div>

        {/* Bill To */}
        <div className="mb-4 p-3 rounded-md bg-muted/50 print:bg-transparent print:border print:border-border">
          <p className="text-[10px] uppercase text-muted-foreground font-medium mb-1">
            {invoice.type === 'sale' ? 'Bill To' : 'Bill From'}
          </p>
          <p className="text-sm font-medium text-foreground">{displayParty.name || '—'}</p>
          {displayParty.address && <p className="text-xs text-muted-foreground">{displayParty.address}</p>}
          {displayParty.phone && <p className="text-xs text-muted-foreground">Phone: {displayParty.phone}</p>}
          {displayParty.pan_number && <p className="text-xs text-muted-foreground">PAN: {displayParty.pan_number}</p>}
        </div>

        {/* Line Items */}
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b-2 border-foreground/20">
                <th className="px-2 py-2 text-left font-semibold text-foreground w-8">#</th>
                <th className="px-2 py-2 text-left font-semibold text-foreground">Item</th>
                <th className="px-2 py-2 text-right font-semibold text-foreground w-14">Qty</th>
                <th className="px-2 py-2 text-left font-semibold text-foreground w-12">Unit</th>
                <th className="px-2 py-2 text-right font-semibold text-foreground w-20">Rate</th>
                {lineItems.some((l) => l.discount_amt > 0) && (
                  <th className="px-2 py-2 text-right font-semibold text-foreground w-16">Disc.</th>
                )}
                {invoice.is_vat_invoice && (
                  <th className="px-2 py-2 text-right font-semibold text-foreground w-16">VAT</th>
                )}
                <th className="px-2 py-2 text-right font-semibold text-foreground w-24">Total</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, idx) => (
                <tr key={item.id} className="border-b border-border">
                  <td className="px-2 py-2 text-muted-foreground">{idx + 1}</td>
                  <td className="px-2 py-2 text-foreground font-medium">{item.name}</td>
                  <td className="px-2 py-2 text-right text-foreground">{item.quantity}</td>
                  <td className="px-2 py-2 text-muted-foreground">{item.unit}</td>
                  <td className="px-2 py-2 text-right text-foreground">{formatNPR(item.rate, { showSymbol: false })}</td>
                  {lineItems.some((l) => l.discount_amt > 0) && (
                    <td className="px-2 py-2 text-right text-muted-foreground">
                      {item.discount_amt > 0 ? formatNPR(item.discount_amt, { showSymbol: false }) : '—'}
                    </td>
                  )}
                  {invoice.is_vat_invoice && (
                    <td className="px-2 py-2 text-right text-muted-foreground">
                      {formatNPR(item.vat_amount, { showSymbol: false })}
                    </td>
                  )}
                  <td className="px-2 py-2 text-right font-medium text-foreground">
                    {formatNPR(item.total_amount, { showSymbol: false })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-64 space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Sub Total</span>
              <span>{formatNPR(invoice.sub_total, { showSymbol: false })}</span>
            </div>
            {invoice.discount_amount > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Discount</span>
                <span>-{formatNPR(invoice.discount_amount, { showSymbol: false })}</span>
              </div>
            )}
            {invoice.is_vat_invoice && (
              <>
                <div className="flex justify-between text-muted-foreground">
                  <span>Taxable Amount</span>
                  <span>{formatNPR(invoice.taxable_amount, { showSymbol: false })}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>VAT (13%)</span>
                  <span>{formatNPR(invoice.vat_amount, { showSymbol: false })}</span>
                </div>
              </>
            )}
            <div className="flex justify-between font-bold text-foreground border-t border-border pt-1">
              <span>Total</span>
              <span>{formatNPR(invoice.total_amount)}</span>
            </div>
            {invoice.paid_amount > 0 && (
              <div className="flex justify-between text-success">
                <span>Paid</span>
                <span>{formatNPR(invoice.paid_amount, { showSymbol: false })}</span>
              </div>
            )}
            {invoice.balance_due > 0 && (
              <div className="flex justify-between font-bold text-destructive">
                <span>Balance Due</span>
                <span>{formatNPR(invoice.balance_due)}</span>
              </div>
            )}
          </div>
        </div>

        {invoice.notes && (
          <div className="mt-4 pt-3 border-t border-border">
            <p className="text-[10px] uppercase text-muted-foreground font-medium mb-1">Notes</p>
            <p className="text-xs text-muted-foreground">{invoice.notes}</p>
          </div>
        )}

        {isCorrectionNote && invoice.correction_reason && (
          <div className="mt-4 pt-3 border-t border-border">
            <p className="text-[10px] uppercase text-muted-foreground font-medium mb-1">Correction Reason</p>
            <p className="text-xs text-foreground">{invoice.correction_reason}</p>
          </div>
        )}

        {isCancelled && invoice.cancellation_reason && (
          <div className="mt-4 pt-3 border-t border-border">
            <p className="text-[10px] uppercase text-muted-foreground font-medium mb-1">Cancellation Reason</p>
            <p className="text-xs text-destructive">{invoice.cancellation_reason}</p>
          </div>
        )}

        {/* Amount in Words */}
        <div className="mt-4 pt-3 border-t border-border">
          <p className="text-[10px] uppercase text-muted-foreground font-medium mb-1">Amount in Words</p>
          <p className="text-xs text-foreground italic">
            Nepali Rupees {amountInWords(invoice.total_amount)}
          </p>
        </div>
      </div>

      {/* Payments History */}
      {payments.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4 print:hidden">
          <h3 className="text-sm font-semibold text-foreground mb-3">Payment History</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Method</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Amount</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Reference</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 text-foreground">{p.payment_date_bs}</td>
                    <td className="px-3 py-2 text-muted-foreground capitalize">{p.method.replace('_', ' ')}</td>
                    <td className="px-3 py-2 text-right font-medium text-foreground">{formatNPR(p.amount, { showSymbol: false })}</td>
                    <td className="px-3 py-2 text-muted-foreground">{p.reference || '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`text-[11px] font-medium ${p.status === 'completed' ? 'text-success' : 'text-warning'}`}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {invoiceEvents.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4 print:hidden">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-foreground">Invoice Audit Log</h3>
            {auditVerification && (
              <span className={`text-[11px] font-medium ${auditVerification.valid ? 'text-success' : 'text-destructive'}`}>
                Hash chain: {auditVerification.valid ? 'verified' : 'broken'}
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Time</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Action</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">User</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Hash</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Details</th>
                </tr>
              </thead>
              <tbody>
                {invoiceEvents.map((event) => (
                  <tr key={event.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 text-foreground">{new Date(event.created_at).toLocaleString()}</td>
                    <td className="px-3 py-2 font-medium text-foreground capitalize">{event.action.replace(/_/g, ' ')}</td>
                    <td className="px-3 py-2 text-muted-foreground">{event.user_id || 'System'}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{event.event_hash ? event.event_hash.slice(0, 12) : 'legacy'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{event.details || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <PaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        invoiceId={invoice.id}
        partyId={partyId}
        balanceDue={invoice.balance_due}
        onSubmit={handlePayment}
        loading={recordPayment.isPending}
      />

      <Dialog open={printOptionsOpen} onOpenChange={setPrintOptionsOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Print Invoice</DialogTitle>
            <DialogDescription>
              Choose a paper size and preview the invoice before printing.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
            <RadioGroup value={printSize} onValueChange={(value) => setPrintSize(value as "a4" | "a5")} className="grid gap-2">
              <Label className="flex cursor-pointer items-center gap-3 rounded-md border border-border p-3">
                <RadioGroupItem value="a4" />
                <span>
                  <span className="block text-sm font-semibold">A4</span>
                  <span className="block text-xs text-muted-foreground">210 x 297 mm</span>
                </span>
              </Label>
              <Label className="flex cursor-pointer items-center gap-3 rounded-md border border-border p-3">
                <RadioGroupItem value="a5" />
                <span>
                  <span className="block text-sm font-semibold">A5</span>
                  <span className="block text-xs text-muted-foreground">148 x 210 mm</span>
                </span>
              </Label>
            </RadioGroup>

            <div className="max-h-[65vh] overflow-auto rounded-md border border-border bg-muted/30 p-4">
              <div className={`print-preview-scale print-preview-scale-${printSize}`}>
                <PrintInvoice invoice={invoice} business={business!} pageSize={printSize} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPrintOptionsOpen(false)}>
              Cancel
            </Button>
            <Button className="gap-1.5" onClick={handlePrint}>
              <Printer className="h-4 w-4" /> Print / PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={correctionOpen} onOpenChange={setCorrectionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Correction Note</DialogTitle>
            <DialogDescription>
              This creates a draft note that references {invoice.invoice_number}; edit the note lines before issuing it. The issued invoice stays unchanged.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <RadioGroup value={correctionType} onValueChange={(value) => setCorrectionType(value as 'credit' | 'debit')} className="grid gap-2">
              <Label className="flex cursor-pointer items-center gap-3 rounded-md border border-border p-3">
                <RadioGroupItem value="credit" />
                <span>
                  <span className="block text-sm font-semibold">Credit Note</span>
                  <span className="block text-xs text-muted-foreground">Sales return or downward sales adjustment.</span>
                </span>
              </Label>
              <Label className="flex cursor-pointer items-center gap-3 rounded-md border border-border p-3">
                <RadioGroupItem value="debit" />
                <span>
                  <span className="block text-sm font-semibold">Debit Note</span>
                  <span className="block text-xs text-muted-foreground">Purchase return or accountant-approved adjustment.</span>
                </span>
              </Label>
            </RadioGroup>
            <div className="space-y-2">
              <Label className="text-xs">Reason *</Label>
              <Textarea
                value={correctionReason}
                onChange={(event) => setCorrectionReason(event.target.value)}
                placeholder="Return, rate correction, discount correction, damaged goods, or accountant-approved reason..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCorrectionOpen(false)}>Cancel</Button>
            <Button onClick={handleCorrectionNote} disabled={!correctionReason.trim() || createCorrectionNote.isPending}>
              Create Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation */}
      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark invoice <strong>{invoice.invoice_number}</strong> as cancelled. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Cancellation Reason *</Label>
            <Textarea
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              className="text-sm"
              placeholder="Enter the business reason for cancellation..."
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCancelReason('')}>Keep Invoice</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={!cancelReason.trim() || cancelInvoice.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Cancel Invoice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Print Template — portaled to body so print CSS can target it */}
      {createPortal(
        <div className={`${showPrint ? 'print-template-active' : 'print-template-hidden'} print-template-${printSize}`}>
          <PrintInvoice invoice={invoice} business={business!} pageSize={printSize} />
        </div>,
        document.body
      )}
    </div>
  );
}
