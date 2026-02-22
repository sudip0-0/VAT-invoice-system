import { useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, CreditCard, Pencil, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useInvoiceDetail, useInvoicePayments, useInvoices } from '@/hooks/useInvoices';
import { useBusiness } from '@/contexts/BusinessContext';
import { useToast } from '@/hooks/use-toast';
import { formatNPR } from '@/lib/nepal-format';
import StatusBadge from '@/components/shared/StatusBadge';
import PaymentDialog from '@/components/invoices/PaymentDialog';

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { business } = useBusiness();
  const { data: invoice, isLoading } = useInvoiceDetail(id);
  const { payments, recordPayment } = useInvoicePayments(id);
  const { cancelInvoice } = useInvoices();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => window.print();

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
      await cancelInvoice.mutateAsync(id!);
      toast({ title: 'Invoice cancelled' });
      setCancelOpen(false);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  if (isLoading) return <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>;
  if (!invoice) return <div className="p-8 text-center text-sm text-muted-foreground">Invoice not found.</div>;

  const party = invoice.customer || invoice.vendor;
  const partyId = invoice.customer_id || invoice.vendor_id;
  const lineItems = (invoice.invoice_items || []).sort((a, b) => a.sort_order - b.sort_order);
  const isCancelled = invoice.status === 'cancelled';
  const canEdit = !isCancelled && invoice.status !== 'paid';

  return (
    <div className="space-y-4 animate-fade-in max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 print:hidden">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/invoices')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-bold text-foreground">{invoice.invoice_number}</h1>
        <StatusBadge status={invoice.status.toUpperCase()} />
        <div className="ml-auto flex gap-2">
          {canEdit && (
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => navigate(`/invoices/${id}/edit`)}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          )}
          {!isCancelled && invoice.balance_due > 0 && (
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setPaymentOpen(true)}>
              <CreditCard className="h-3.5 w-3.5" /> Record Payment
            </Button>
          )}
          {!isCancelled && (
            <Button size="sm" variant="outline" className="gap-1.5 text-xs text-destructive hover:text-destructive" onClick={() => setCancelOpen(true)}>
              <Ban className="h-3.5 w-3.5" /> Cancel
            </Button>
          )}
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={handlePrint}>
            <Printer className="h-3.5 w-3.5" /> Print
          </Button>
        </div>
      </div>

      {/* Printable Invoice */}
      <div ref={printRef} className="rounded-lg border border-border bg-card p-6 print:border-0 print:shadow-none print:p-0">
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
              {invoice.type === 'sale' ? 'SALES INVOICE' : 'PURCHASE BILL'}
              {invoice.is_vat_invoice && ' (VAT)'}
            </h3>
            <p className="text-sm font-mono font-bold text-foreground">{invoice.invoice_number}</p>
            <p className="text-xs text-muted-foreground mt-1">Date (BS): {invoice.issued_date_bs}</p>
            <p className="text-xs text-muted-foreground">Date (AD): {new Date(invoice.issued_date_ad).toLocaleDateString()}</p>
            {invoice.due_date_bs && <p className="text-xs text-muted-foreground">Due: {invoice.due_date_bs}</p>}
            {invoice.vat_period && <p className="text-xs text-muted-foreground">VAT Period: {invoice.vat_period}</p>}
            {isCancelled && <p className="text-xs font-bold text-destructive mt-1">CANCELLED</p>}
          </div>
        </div>

        {/* Bill To */}
        <div className="mb-4 p-3 rounded-md bg-muted/50 print:bg-transparent print:border print:border-border">
          <p className="text-[10px] uppercase text-muted-foreground font-medium mb-1">
            {invoice.type === 'sale' ? 'Bill To' : 'Bill From'}
          </p>
          <p className="text-sm font-medium text-foreground">{(party as any)?.name || '—'}</p>
          {(party as any)?.address && <p className="text-xs text-muted-foreground">{(party as any).address}{(party as any).city ? `, ${(party as any).city}` : ''}</p>}
          {(party as any)?.phone && <p className="text-xs text-muted-foreground">Phone: {(party as any).phone}</p>}
          {(party as any)?.pan_number && <p className="text-xs text-muted-foreground">PAN: {(party as any).pan_number}</p>}
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

      <PaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        invoiceId={invoice.id}
        partyId={partyId}
        balanceDue={invoice.balance_due}
        onSubmit={handlePayment}
        loading={recordPayment.isPending}
      />

      {/* Cancel Confirmation */}
      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark invoice <strong>{invoice.invoice_number}</strong> as cancelled. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Invoice</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Cancel Invoice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
