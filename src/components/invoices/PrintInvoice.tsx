import { forwardRef } from 'react';
import { formatNPR } from '@/lib/nepal-format';
import { amountInWords } from '@/lib/amount-in-words';
import type { InvoiceDetail } from '@/hooks/useInvoices';

interface PrintInvoiceProps {
  invoice: InvoiceDetail;
  business: {
    name: string;
    address?: string;
    city?: string;
    phone?: string;
    email?: string | null;
    pan_number?: string | null;
    is_vat_registered?: boolean;
  };
}

const PrintInvoice = forwardRef<HTMLDivElement, PrintInvoiceProps>(
  ({ invoice, business }, ref) => {
    const party = invoice.customer || invoice.vendor;
    const lineItems = (invoice.invoice_items || []).sort((a, b) => a.sort_order - b.sort_order);
    const isCancelled = invoice.status === 'cancelled';
    const hasDiscount = lineItems.some((l) => l.discount_amt > 0);
    const isSale = invoice.type === 'sale';

    return (
      <div ref={ref} className="print-invoice font-sans text-black bg-white p-8 max-w-[210mm] mx-auto">
        {/* Watermark for cancelled */}
        {isCancelled && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <span className="text-7xl font-bold text-red-300 opacity-30 rotate-[-30deg] select-none">
              CANCELLED
            </span>
          </div>
        )}

        {/* Header: Tax Invoice title */}
        <div className="text-center border-b-2 border-black pb-3 mb-4">
          <h1 className="text-lg font-bold tracking-wide uppercase">
            {invoice.is_vat_invoice ? 'TAX INVOICE' : isSale ? 'INVOICE' : 'PURCHASE BILL'}
          </h1>
          {invoice.is_vat_invoice && (
            <p className="text-[10px] text-gray-600 mt-0.5">
              (As per Rule 23(1)(kha) of Value Added Tax Rules, 2053)
            </p>
          )}
        </div>

        {/* Seller / Business Info */}
        <div className="flex justify-between mb-4">
          <div className="space-y-0.5">
            <h2 className="text-base font-bold">{business.name}</h2>
            <p className="text-xs text-gray-700">
              {business.address}{business.city ? `, ${business.city}` : ''}
            </p>
            {business.phone && <p className="text-xs text-gray-700">Phone: {business.phone}</p>}
            {business.email && <p className="text-xs text-gray-700">Email: {business.email}</p>}
            {business.pan_number && (
              <p className="text-xs font-semibold">
                {business.is_vat_registered ? 'VAT PAN' : 'PAN'}: {business.pan_number}
              </p>
            )}
          </div>
          <div className="text-right space-y-0.5">
            <p className="text-xs">
              <span className="font-semibold">Invoice No:</span>{' '}
              <span className="font-mono font-bold">{invoice.invoice_number}</span>
            </p>
            <p className="text-xs">
              <span className="font-semibold">Date (BS):</span> {invoice.issued_date_bs}
            </p>
            <p className="text-xs">
              <span className="font-semibold">Date (AD):</span>{' '}
              {new Date(invoice.issued_date_ad).toLocaleDateString('en-GB')}
            </p>
            {invoice.due_date_bs && (
              <p className="text-xs">
                <span className="font-semibold">Due Date:</span> {invoice.due_date_bs}
              </p>
            )}
            {invoice.vat_period && (
              <p className="text-xs">
                <span className="font-semibold">VAT Period:</span> {invoice.vat_period}
              </p>
            )}
          </div>
        </div>

        {/* Buyer Info */}
        <div className="border border-gray-400 rounded p-3 mb-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div>
              <span className="font-semibold">{isSale ? "Buyer's Name" : "Seller's Name"}:</span>{' '}
              {(party as any)?.name || '—'}
            </div>
            <div>
              <span className="font-semibold">PAN No:</span>{' '}
              {(party as any)?.pan_number || invoice.buyer_pan || '—'}
            </div>
            <div>
              <span className="font-semibold">Address:</span>{' '}
              {(party as any)?.address || '—'}
              {(party as any)?.city ? `, ${(party as any).city}` : ''}
            </div>
            <div>
              <span className="font-semibold">Phone:</span>{' '}
              {(party as any)?.phone || '—'}
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <table className="w-full text-xs border-collapse mb-4">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-400 px-2 py-1.5 text-left w-8">S.N.</th>
              <th className="border border-gray-400 px-2 py-1.5 text-left">Particulars</th>
              <th className="border border-gray-400 px-2 py-1.5 text-right w-12">Qty</th>
              <th className="border border-gray-400 px-2 py-1.5 text-left w-12">Unit</th>
              <th className="border border-gray-400 px-2 py-1.5 text-right w-20">Rate</th>
              {hasDiscount && (
                <th className="border border-gray-400 px-2 py-1.5 text-right w-16">Discount</th>
              )}
              <th className="border border-gray-400 px-2 py-1.5 text-right w-24">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, idx) => (
              <tr key={item.id}>
                <td className="border border-gray-400 px-2 py-1 text-center">{idx + 1}</td>
                <td className="border border-gray-400 px-2 py-1 font-medium">
                  {item.name}
                  {item.description && (
                    <span className="block text-[10px] text-gray-500">{item.description}</span>
                  )}
                </td>
                <td className="border border-gray-400 px-2 py-1 text-right">{item.quantity}</td>
                <td className="border border-gray-400 px-2 py-1">{item.unit}</td>
                <td className="border border-gray-400 px-2 py-1 text-right">
                  {formatNPR(item.rate, { showSymbol: false })}
                </td>
                {hasDiscount && (
                  <td className="border border-gray-400 px-2 py-1 text-right">
                    {item.discount_amt > 0 ? formatNPR(item.discount_amt, { showSymbol: false }) : '—'}
                  </td>
                )}
                <td className="border border-gray-400 px-2 py-1 text-right font-medium">
                  {formatNPR(item.taxable_amount || (item.quantity * item.rate - item.discount_amt), { showSymbol: false })}
                </td>
              </tr>
            ))}
            {/* Empty rows for IRD compliance (minimum visual rows) */}
            {lineItems.length < 3 &&
              Array.from({ length: 3 - lineItems.length }).map((_, i) => (
                <tr key={`empty-${i}`}>
                  <td className="border border-gray-400 px-2 py-1 text-center text-gray-300">&nbsp;</td>
                  <td className="border border-gray-400 px-2 py-1">&nbsp;</td>
                  <td className="border border-gray-400 px-2 py-1">&nbsp;</td>
                  <td className="border border-gray-400 px-2 py-1">&nbsp;</td>
                  <td className="border border-gray-400 px-2 py-1">&nbsp;</td>
                  {hasDiscount && <td className="border border-gray-400 px-2 py-1">&nbsp;</td>}
                  <td className="border border-gray-400 px-2 py-1">&nbsp;</td>
                </tr>
              ))}
          </tbody>
        </table>

        {/* Totals Section */}
        <div className="flex justify-end mb-4">
          <div className="w-72 text-xs">
            <div className="flex justify-between py-1 border-b border-gray-300">
              <span>Sub Total</span>
              <span className="font-medium">{formatNPR(invoice.sub_total, { showSymbol: false })}</span>
            </div>
            {invoice.discount_amount > 0 && (
              <div className="flex justify-between py-1 border-b border-gray-300">
                <span>Discount</span>
                <span>({formatNPR(invoice.discount_amount, { showSymbol: false })})</span>
              </div>
            )}
            {invoice.is_vat_invoice && (
              <>
                <div className="flex justify-between py-1 border-b border-gray-300">
                  <span>Taxable Amount</span>
                  <span className="font-medium">{formatNPR(invoice.taxable_amount, { showSymbol: false })}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-300">
                  <span>VAT (13%)</span>
                  <span className="font-medium">{formatNPR(invoice.vat_amount, { showSymbol: false })}</span>
                </div>
              </>
            )}
            <div className="flex justify-between py-1.5 border-b-2 border-black font-bold text-sm">
              <span>Total Amount</span>
              <span>{formatNPR(invoice.total_amount)}</span>
            </div>
          </div>
        </div>

        {/* Amount in Words */}
        <div className="border border-gray-400 rounded p-2 mb-4">
          <p className="text-[10px] uppercase font-semibold text-gray-500 mb-0.5">Amount in Words</p>
          <p className="text-xs font-medium italic">
            Nepali Rupees {amountInWords(invoice.total_amount)}
          </p>
        </div>

        {/* Notes & Terms */}
        {(invoice.notes || invoice.terms_conditions) && (
          <div className="mb-4 text-xs space-y-1">
            {invoice.notes && (
              <div>
                <span className="font-semibold">Notes: </span>
                <span className="text-gray-700">{invoice.notes}</span>
              </div>
            )}
            {invoice.terms_conditions && (
              <div>
                <span className="font-semibold">Terms & Conditions: </span>
                <span className="text-gray-700">{invoice.terms_conditions}</span>
              </div>
            )}
          </div>
        )}

        {/* Signature Section */}
        <div className="grid grid-cols-3 gap-3 mt-6 pt-2 text-xs text-center">
          <div>
            <div className="border-t border-gray-400 pt-1 mt-6">
              <p className="font-semibold">Prepared By</p>
            </div>
          </div>
          <div>
            <div className="border-t border-gray-400 pt-1 mt-6">
              <p className="font-semibold">Received By</p>
            </div>
          </div>
          <div>
            <div className="border-t border-gray-400 pt-1 mt-6">
              <p className="font-semibold">Authorized Signatory</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-2 border-t border-gray-300 text-center">
          <p className="text-[9px] text-gray-400">
            This is a computer-generated invoice. No signature is required for amounts below NPR 5,000.
          </p>
        </div>
      </div>
    );
  }
);

PrintInvoice.displayName = 'PrintInvoice';
export default PrintInvoice;
