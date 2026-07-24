import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useInvoices } from '@/hooks/useInvoices';
import { useParties } from '@/hooks/useParties';
import { useItems } from '@/hooks/useItems';
import { useBusiness } from '@/contexts/BusinessContext';
import { formatNPR } from '@/lib/nepal-format';
import { type BSDate, adToBS, bsToAD, formatBSShort, todayBS, getVATPeriod } from '@/lib/bs-calendar';
import { nepalTodayISO } from '@/lib/nepal-date';
import BSDatePicker from '@/components/shared/BSDatePicker';
import ItemCombobox from '@/components/invoices/ItemCombobox';
import PartyCombobox from '@/components/invoices/PartyCombobox';
import CashCustomerDialog from '@/components/invoices/CashCustomerDialog';
import {
  CASH_CUSTOMER_ID,
  CASH_CUSTOMER_NAME,
  type CashCustomerDetails,
  emptyCashCustomerDetails,
} from '@/lib/cash-customer';
import { STATUTORY_VAT_RATE, getVATRateForTaxType, reconcileLineTotals, roundMoney, validateInvoiceIssuePreflight } from '@/lib/vat-compliance';
import {
  LINE_TAX_TYPES,
  calcDocumentLine as calcLine,
  newDocumentLine as newLine,
  type DocumentLineItem as LineItem,
} from '@/components/documents/document-lines';

export type DocumentEditorType = 'sale';

/** Shared document create editor (sale). Purchase/quotation pages reuse document-lines helpers. */
export default function DocumentEditor({ documentType = 'sale' }: { documentType?: DocumentEditorType }) {
  void documentType;
  const navigate = useNavigate();
  const { toast } = useToast();
  const { business } = useBusiness();
  const { createInvoice } = useInvoices();
  const { data: parties = [] } = useParties();
  const { items: inventoryItems } = useItems();

  const todayBs = todayBS();
  const todayAd = nepalTodayISO();

  const [partyId, setPartyId] = useState('');
  const [cashCustomerDetails, setCashCustomerDetails] = useState<CashCustomerDetails>(emptyCashCustomerDetails());
  const [cashCustomerOpen, setCashCustomerOpen] = useState(false);
  const [issuedDateBs, setIssuedDateBs] = useState<BSDate>(todayBs);
  const [issuedDateAd, setIssuedDateAd] = useState(todayAd);
  const [dueDateBs, setDueDateBs] = useState<BSDate | null>(null);
  const [dueDateAd, setDueDateAd] = useState('');
  const [isVat, setIsVat] = useState(business?.is_vat_registered ?? false);
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineItem[]>([newLine()]);
  const [receivedAmount, setReceivedAmount] = useState<number>(0);

  const filteredParties = useMemo(() => {
    return parties.filter((p) => p.type === 'customer' || p.type === 'both');
  }, [parties]);

  const updateLine = useCallback((key: string, updates: Partial<LineItem>) => {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? calcLine({ ...l, ...updates }) : l))
    );
  }, []);

  const selectItem = useCallback((key: string, itemId: string) => {
    const item = inventoryItems.find((i) => i.id === itemId);
    if (!item) return;
    updateLine(key, {
      item_id: itemId,
      hsn_code: item.hsn_code || null,
      name: item.name,
      unit: item.unit,
      rate: item.sale_price,
      tax_type: isVat ? 'vat_13' : 'non_taxable',
      vat_rate: isVat ? STATUTORY_VAT_RATE : 0,
      is_custom: false,
    });
  }, [inventoryItems, isVat, updateLine]);

  const addLine = () => setLines((prev) => [...prev, newLine()]);
  const removeLine = (key: string) => setLines((prev) => prev.length > 1 ? prev.filter((l) => l.key !== key) : prev);

  const totals = useMemo(() => {
    const subTotal = roundMoney(lines.reduce((s, l) => s + l.quantity * l.rate, 0));
    const reconciled = reconcileLineTotals(lines);
    return {
      subTotal,
      discountAmount: reconciled.discount_amount,
      taxableAmount: reconciled.taxable_amount,
      vatAmount: reconciled.vat_amount,
      totalAmount: reconciled.total_amount,
    };
  }, [lines]);

  const invoiceNumber = `${business?.invoice_prefix || 'INV'}-${String(business?.next_sales_invoice_num || business?.next_invoice_num || 1).padStart(4, '0')}`;

  const issuedBs = formatBSShort(issuedDateBs);

  const dueBs = dueDateBs ? formatBSShort(dueDateBs) : null;

  const handlePartySelect = (selectedPartyId: string) => {
    setPartyId(selectedPartyId);
    if (selectedPartyId === CASH_CUSTOMER_ID) {
      setCashCustomerOpen(true);
    }
  };

  const handleSave = async (status: 'draft' | 'issued') => {
    if (!partyId) {
      toast({ title: 'Select a party', variant: 'destructive' });
      return;
    }
    if (lines.every((l) => !l.name.trim())) {
      toast({ title: 'Add at least one item', variant: 'destructive' });
      return;
    }
    const validLines = lines.filter((l) => l.name.trim());
    const selectedParty = parties.find((p) => p.id === partyId);
    const isCashCustomer = partyId === CASH_CUSTOMER_ID;
    const buyerPan = isCashCustomer ? cashCustomerDetails.panNumber || null : selectedParty?.pan_number || null;
    const stockByItemId = Object.fromEntries(
      inventoryItems.map((item) => [item.id, { current_stock: Number(item.current_stock || 0), type: item.type, name: item.name }])
    );
    const preflight = validateInvoiceIssuePreflight({
      type: 'sale',
      status,
      isVatInvoice: isVat,
      isBusinessVatRegistered: Boolean(business?.is_vat_registered),
      businessPan: business?.pan_number,
      buyerPan,
      totals,
      lines: validLines,
      stockByItemId,
    });
    if (!preflight.ok) {
      toast({ title: 'Cannot issue invoice', description: preflight.errors[0], variant: 'destructive' });
      return;
    }

    try {
      const newInvoiceId = await createInvoice.mutateAsync({
        invoice: {
          invoice_number: invoiceNumber,
          type: 'sale',
          status,
          customer_id: isCashCustomer ? null : partyId,
          vendor_id: null,
          buyer_name: isCashCustomer ? cashCustomerDetails.name || CASH_CUSTOMER_NAME : selectedParty?.name || null,
          buyer_pan: buyerPan,
          buyer_phone: isCashCustomer ? cashCustomerDetails.phone || null : selectedParty?.phone || null,
          buyer_address: isCashCustomer ? cashCustomerDetails.address || null : [selectedParty?.address, selectedParty?.city].filter(Boolean).join(', ') || null,
          is_vat_invoice: isVat,
          issued_date_ad: issuedDateAd,
          issued_date_bs: issuedBs,
          due_date_ad: dueDateAd || null,
          due_date_bs: dueBs,
          vat_period: isVat ? getVATPeriod(adToBS(new Date(issuedDateAd))) : null,
          sub_total: totals.subTotal,
          discount_amount: totals.discountAmount,
          taxable_amount: totals.taxableAmount,
          vat_amount: totals.vatAmount,
          total_amount: totals.totalAmount,
          paid_amount: receivedAmount,
          balance_due: totals.totalAmount - receivedAmount,
          notes: notes || null,
        },
        items: validLines.map((l) => ({
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
      toast({ title: `Sale ${status === 'draft' ? 'saved as draft' : 'issued'}` });
      if (status === 'issued') {
        navigate(`/invoices/${newInvoiceId}?print=1`);
      } else {
        navigate('/invoices');
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4 animate-fade-in max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/invoices')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-bold text-foreground">New Sale</h1>
        <span className="ml-auto text-sm font-mono text-muted-foreground">{invoiceNumber}</span>
      </div>

      {/* Top section */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Customer *</Label>
            <PartyCombobox
              parties={filteredParties}
              value={partyId}
              mode="customer"
              onSelect={handlePartySelect}
            />
          </div>
          <div>
            <Label className="text-xs">Issue Date (BS)</Label>
            <BSDatePicker
              value={issuedDateBs}
              onChange={(bs, ad) => {
                setIssuedDateBs(bs);
                setIssuedDateAd(ad.toISOString().slice(0, 10));
              }}
              className="w-full"
            />
            <span className="text-[10px] text-muted-foreground">AD: {issuedDateAd}</span>
          </div>
          <div>
            <Label className="text-xs">Due Date (BS)</Label>
            <BSDatePicker
              value={dueDateBs}
              onChange={(bs, ad) => {
                setDueDateBs(bs);
                setDueDateAd(ad.toISOString().slice(0, 10));
              }}
              placeholder="Optional"
              className="w-full"
            />
            {dueBs && <span className="text-[10px] text-muted-foreground">AD: {dueDateAd}</span>}
          </div>
        </div>
        {business?.is_vat_registered && (
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={isVat} onChange={(e) => {
              setIsVat(e.target.checked);
              setLines((prev) => prev.map((l) => {
                const taxType = e.target.checked ? 'vat_13' : 'non_taxable';
                return calcLine({ ...l, tax_type: taxType, vat_rate: getVATRateForTaxType(taxType) });
              }));
            }} className="rounded" />
            VAT Invoice ({STATUTORY_VAT_RATE}%)
          </label>
        )}
      </div>

      {/* Line items */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground w-8">#</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground min-w-[200px]">Item</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground w-16">Qty</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground w-16">Unit</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground w-24">Rate</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground w-16">Disc%</th>
                {isVat && <th className="px-3 py-2 text-left font-medium text-muted-foreground w-28">Tax</th>}
                {isVat && <th className="px-3 py-2 text-right font-medium text-muted-foreground w-20">VAT</th>}
                <th className="px-3 py-2 text-right font-medium text-muted-foreground w-24">Total</th>
                <th className="px-3 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr key={line.key} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                  <td className="px-3 py-2">
                    <ItemCombobox
                      items={inventoryItems}
                      value={line.item_id}
                      displayName={line.name}
                      mode="sale"
                      onSelect={(itemId) => selectItem(line.key, itemId)}
                      onCustom={() => updateLine(line.key, { item_id: null, hsn_code: null, name: '', is_custom: true })}
                    />
                    {line.is_custom && (
                      <Input
                        value={line.name}
                        onChange={(e) => updateLine(line.key, { name: e.target.value })}
                        placeholder="Item name"
                        className="h-7 text-xs mt-1"
                      />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={line.quantity}
                      onChange={(e) => updateLine(line.key, { quantity: Number(e.target.value) })}
                      className="h-8 text-xs text-right w-16 border-0 bg-transparent shadow-none px-0"
                    />
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{line.unit}</td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.rate}
                      onChange={(e) => updateLine(line.key, { rate: Number(e.target.value) })}
                      className="h-8 text-xs text-right w-24 border-0 bg-transparent shadow-none px-0"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={line.discount_pct}
                      onChange={(e) => updateLine(line.key, { discount_pct: Number(e.target.value) })}
                      className="h-8 text-xs text-right w-16 border-0 bg-transparent shadow-none px-0"
                    />
                  </td>
                  {isVat && (
                    <td className="px-3 py-2">
                      <Select
                        value={line.tax_type}
                        onValueChange={(value: LineTaxType) => updateLine(line.key, { tax_type: value, vat_rate: getVATRateForTaxType(value) })}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {LINE_TAX_TYPES.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                  )}
                  {isVat && (
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      {formatNPR(line.vat_amount, { showSymbol: false })}
                    </td>
                  )}
                  <td className="px-3 py-2 text-right font-medium text-foreground">
                    {formatNPR(line.total_amount, { showSymbol: false })}
                  </td>
                  <td className="px-3 py-2">
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeLine(line.key)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-2 border-t border-border">
          <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={addLine}>
            <Plus className="h-3 w-3" /> Add Line
          </Button>
        </div>
      </div>

      {/* Summary + Notes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="text-sm min-h-[80px]" placeholder="Internal notes..." />
        </div>
        <div className="rounded-lg border border-border bg-card p-4 space-y-2 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Sub Total</span>
            <span>{formatNPR(totals.subTotal, { showSymbol: false })}</span>
          </div>
          {totals.discountAmount > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Discount</span>
              <span>-{formatNPR(totals.discountAmount, { showSymbol: false })}</span>
            </div>
          )}
          {isVat && (
            <>
              <div className="flex justify-between text-muted-foreground">
                <span>Taxable Amount</span>
                <span>{formatNPR(totals.taxableAmount, { showSymbol: false })}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>VAT ({STATUTORY_VAT_RATE}%)</span>
                <span>{formatNPR(totals.vatAmount, { showSymbol: false })}</span>
              </div>
            </>
          )}
          <div className="flex justify-between font-bold text-foreground border-t border-border pt-2">
            <span>Total</span>
            <span>{formatNPR(totals.totalAmount)}</span>
          </div>
          <div className="flex justify-between items-center text-muted-foreground">
            <span>Received</span>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={receivedAmount}
              onChange={(e) => setReceivedAmount(Number(e.target.value))}
              className="h-7 text-xs text-right w-28"
            />
          </div>
          <div className="flex justify-between text-sm font-medium text-foreground">
            <span>Balance Due</span>
            <span>{formatNPR(totals.totalAmount - receivedAmount)}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end pb-4">
        <Button variant="outline" size="sm" onClick={() => navigate('/invoices')}>Cancel</Button>
        <Button variant="secondary" size="sm" onClick={() => handleSave('draft')} disabled={createInvoice.isPending}>
          Save Draft
        </Button>
        <Button size="sm" onClick={() => handleSave('issued')} disabled={createInvoice.isPending}>
          Issue Sale
        </Button>
      </div>

      <CashCustomerDialog
        open={cashCustomerOpen}
        value={cashCustomerDetails}
        onOpenChange={setCashCustomerOpen}
        onSave={setCashCustomerDetails}
      />
    </div>
  );
}
