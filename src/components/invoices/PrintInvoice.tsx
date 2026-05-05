//Printinvoice.tsx
import { forwardRef } from "react";
import { formatNPR } from "@/lib/nepal-format";
import { amountInWords } from "@/lib/amount-in-words";
import type { InvoiceDetail } from "@/hooks/useInvoices";
import { STATUTORY_VAT_RATE } from "@/lib/vat-compliance";

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
  pageSize?: "a4" | "a5";
}

const PrintInvoice = forwardRef<HTMLDivElement, PrintInvoiceProps>(
  ({ invoice, business, pageSize = "a5" }, ref) => {
    const party = invoice.customer || invoice.vendor;
    const lineItems = (invoice.invoice_items || []).sort((a, b) => a.sort_order - b.sort_order);
    const isCancelled = invoice.status === "cancelled";
    const isSale = invoice.type === "sale";

    const adIssueDate = new Date(invoice.issued_date_ad);
    const adIssueDateDisplay = adIssueDate.toLocaleDateString("en-GB");
    const printedDateTime = new Date().toLocaleString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });

    const partyName = invoice.buyer_name || party?.name || "-";
    const partyAddress = invoice.buyer_address || `${party?.address || "-"}${party?.city ? `, ${party.city}` : ""}`;
    const partyPan = invoice.buyer_pan || party?.pan_number || "-";
    const remarkText = invoice.notes || (isSale ? "SALES" : "PURCHASE");
    const taxableAmount = invoice.is_vat_invoice ? invoice.taxable_amount : invoice.sub_total;
    const vatAmount = invoice.is_vat_invoice ? invoice.vat_amount : 0;
    const taxExempted = invoice.is_vat_invoice
      ? lineItems
        .filter((item) => item.tax_type === "exempt" || item.tax_type === "non_taxable")
        .reduce((sum, item) => sum + Number(item.total_amount), 0)
      : invoice.sub_total;

    return (
      <div ref={ref} className={`print-invoice print-invoice-${pageSize} relative bg-white text-black mx-auto`}>
        {isCancelled && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <span className="rotate-[-30deg] select-none text-7xl font-bold text-red-300 opacity-30">
              CANCELLED
            </span>
          </div>
        )}

        <div className="invoice-paper border border-black leading-tight">
          {/* Header */}
          <div className="invoice-header border-b border-black px-4 py-3 text-center">
            <h1 className="invoice-business-name font-semibold uppercase">{business.name}</h1>
            <p className="mt-1">
              {business.address || ""}
              {business.city ? `, ${business.city}` : ""}
            </p>
            <p className="mt-1">Tel : {business.phone || "-"}</p>
            <p className="mt-1">
              {business.is_vat_registered ? "VAT NO" : "PAN NO"} : {business.pan_number || "-"}
            </p>
          </div>

          {/* Title */}
          <div className="invoice-title border-b border-black py-2 text-center">
            <h2 className="font-semibold uppercase">
              {invoice.is_vat_invoice ? "Tax Invoice" : isSale ? "Invoice" : "Purchase Bill"}
            </h2>
          </div>

          {/* Customer & Bill Info */}
          <div className="invoice-info-grid border-b border-black p-3">
            <div className="invoice-detail-box border border-black px-3 py-2">
              <p className="mb-2 text-[16px] italic">Customer Details</p>
              <p className="text-[18px] font-semibold uppercase">{partyName}</p>
              <p className="mt-2 uppercase">{partyAddress}</p>
              <p className="mt-2 font-medium">PAN/VAT NO : {partyPan}</p>
            </div>

            <div className="invoice-detail-box border border-black px-3 py-2">
              <p className="mb-2 text-[16px] italic">Bill Details</p>
              <div className="invoice-bill-grid">
                <span>Bill No</span>
                <span>:</span>
                <span className="font-semibold">{invoice.invoice_number}</span>

                <span>Bill Miti</span>
                <span>:</span>
                <span>{invoice.issued_date_bs || "-"}</span>

                <span>Date</span>
                <span>:</span>
                <span>{adIssueDateDisplay}</span>

                <span>Bill Type</span>
                <span>:</span>
                <span className="capitalize">{invoice.balance_due > 0 ? "Credit" : "Cash"}</span>
              </div>
            </div>
          </div>

          {/* Main Table — line items + summary merged */}
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="w-[6%] border-b border-r border-black px-1 py-1 text-left">S.N.</th>
                <th className="w-[10%] border-b border-r border-black px-1 py-1 text-left">HSCode</th>
                <th className="w-[39%] border-b border-r border-black px-1 py-1 text-left">Description</th>
                <th className="w-[11%] border-b border-r border-black px-1 py-1 text-right">Qty</th>
                <th className="w-[8%] border-b border-r border-black px-1 py-1 text-center">Unit</th>
                <th className="w-[13%] border-b border-r border-black px-1 py-1 text-right">Rate</th>
                <th className="w-[13%] border-b border-black px-1 py-1 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {/* Line items */}
              {lineItems.map((item, idx) => {
                const amount = Number(item.total_amount) - Number(item.vat_amount);
                return (
                  <tr key={item.id} className="invoice-item-row align-top">
                    <td className="border-r border-black px-1 py-1 text-center">{idx + 1}</td>
                    <td className="border-r border-black px-1 py-1 text-left">{item.hsn_code || "-"}</td>
                    <td className="border-r border-black px-1 py-1">
                      <div>
                        <span className="font-medium">{item.name}</span>
                      </div>
                    </td>
                    <td className="border-r border-black px-1 py-1 text-right">
                      {Number(item.quantity).toFixed(2)}
                    </td>
                    <td className="border-r border-black px-1 py-1 text-center">{item.unit}</td>
                    <td className="border-r border-black px-1 py-1 text-right">
                      {formatNPR(item.rate, { showSymbol: false })}
                    </td>
                    <td className="px-1 py-1 text-right">{formatNPR(amount, { showSymbol: false })}</td>
                  </tr>
                );
              })}

              {/* Filler row */}
              <tr className="invoice-item-filler" aria-hidden="true">
                <td className="border-r border-black">&nbsp;</td>
                <td className="border-r border-black">&nbsp;</td>
                <td className="border-r border-black">&nbsp;</td>
                <td className="border-r border-black">&nbsp;</td>
                <td className="border-r border-black">&nbsp;</td>
                <td className="border-r border-black">&nbsp;</td>
                <td>&nbsp;</td>
              </tr>

              {/* ── Summary rows merged into the same table ── */}

              {/* Row 1: Remarks (rowSpan=6) + Basic Total */}
              <tr className="border-t border-black">
                <td
                  colSpan={3}
                  rowSpan={6}
                  className="border-t border-r border-black px-2 py-1 align-top"
                >
                  <div className="border-b border-black pb-1 mb-1">
                    <span className="font-semibold">Remarks:</span> {remarkText}
                  </div>
                  <div className="invoice-words-box border-b border-black pb-2 mb-1 flex items-end">
                    <p className="text-[11px]">
                      <span className="font-semibold">In Words: </span>
                      {amountInWords(invoice.total_amount)}
                    </p>
                  </div>
                  <div>
                    <p>*Goods once sold will not be taken back</p>
                    <p>*E&OE</p>
                  </div>
                </td>
                <td colSpan={2} className="border-t border-r border-black px-2 py-1">
                  Basic Total
                </td>
                <td colSpan={2} className="border-t border-black px-2 py-1 text-right font-semibold">
                  {formatNPR(invoice.sub_total, { showSymbol: false })}
                </td>
              </tr>

              {/* Row 2: Discount */}
              <tr>
                <td colSpan={2} className="border-t border-r border-black px-2 py-1">
                  Discount
                </td>
                <td colSpan={2} className="border-t border-black px-2 py-1 text-right">
                  {formatNPR(invoice.discount_amount, { showSymbol: false })}
                </td>
              </tr>

              {/* Row 3: Tax Exempted */}
              <tr>
                <td colSpan={2} className="border-t border-r border-black px-2 py-1">
                  Tax Exempted
                </td>
                <td colSpan={2} className="border-t border-black px-2 py-1 text-right">
                  {formatNPR(taxExempted, { showSymbol: false })}
                </td>
              </tr>

              {/* Row 4: Taxable Amount */}
              <tr>
                <td colSpan={2} className="border-t border-r border-black px-2 py-1">
                  Taxable Amount
                </td>
                <td colSpan={2} className="border-t border-black px-2 py-1 text-right">
                  {formatNPR(taxableAmount, { showSymbol: false })}
                </td>
              </tr>

              {/* Row 5: VAT */}
              <tr>
                <td colSpan={2} className="border-t border-r border-black px-2 py-1">
                  Vat {STATUTORY_VAT_RATE}%
                </td>
                <td colSpan={2} className="border-t border-black px-2 py-1 text-right ">
                  {formatNPR(invoice.is_vat_invoice ? vatAmount : 0, { showSymbol: false })}
                </td>
              </tr>

              {/* Row 6: Grand Total */}
              <tr>
                <td
                  colSpan={2}
                  className="border-t border-b border-r border-black px-2 py-1"
                >
                  Grand Total
                </td>
                <td
                  colSpan={2}
                  className="border-t border-b border-black px-2 py-1 text-right font-semibold"
                >
                  {formatNPR(invoice.total_amount, { showSymbol: false })}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Signature row */}
          <div className="grid grid-cols-3 px-3 py-4 text-center">
            <div>
              <div className="invoice-signature-line">Prepared By</div>
            </div>
            <div>
              <div className="invoice-signature-line">Customer Sign & Stamp</div>
            </div>
            <div>
              <div className="invoice-signature-line">For: {business.name}</div>
            </div>
          </div>

          <div className="px-3 pb-2 text-right">Printed Date & Time : {printedDateTime}</div>
        </div>
      </div>
    );
  }
);

PrintInvoice.displayName = "PrintInvoice";
export default PrintInvoice;
