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
import { type BSDate, adToBS, formatBSShort, todayBS, getVATPeriod } from '@/lib/bs-calendar';
import { nepalTodayISO } from '@/lib/nepal-date';
import BSDatePicker from '@/components/shared/BSDatePicker';
import ItemCombobox from '@/components/invoices/ItemCombobox';
import PartyCombobox from '@/components/invoices/PartyCombobox';
import { STATUTORY_VAT_RATE, canIssueVATInvoice, getVATRateForTaxType, reconcileLineTotals, roundMoney } from '@/lib/vat-compliance';
import {
  LINE_TAX_TYPES,
  calcDocumentLine as calcLine,
  newDocumentLine as newLine,
  type DocumentLineItem as LineItem,
} from '@/components/documents/document-lines';

export default function PurchaseCreatePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { business } = useBusiness();
  const { createInvoice } = useInvoices();
  const { data: parties = [] } = useParties();
  const { items: inventoryItems } = useItems();

  const todayBs = todayBS();
  const todayAd = nepalTodayISO();

  const [vendorId, setVendorId] = useState('');
  const [issuedDateBs, setIssuedDateBs] = useState<BSDate>(todayBs);
  const [issuedDateAd, setIssuedDateAd] = useState(todayAd);
  const [dueDateBs, setDueDateBs] = useState<BSDate | null>(null);
  const [dueDateAd, setDueDateAd] = useState('');
  const [isVat, setIsVat] = useState(business?.is_vat_registered ?? false);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineItem[]>([newLine()]);
  const [skuCode, setSkuCode] = useState('');

  const vendors = useMemo(() => {
    return parties.filter((p) => p.type === 'vendor' || p.type === 'both');
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
      rate: item.purchase_price ?? item.sale_price,
      tax_type: isVat ? 'vat_13' : 'non_taxable',
      vat_rate: isVat ? STATUTORY_VAT_RATE : 0,
      is_custom: false,
    });
  }, [inventoryItems, isVat, updateLine]);

  const addLine = () => setLines((prev) => [...prev, newLine()]);
  const removeLine = (key: string) => setLines((prev) => prev.length > 1 ? prev.filter((l) => l.key !== key) : prev);

  const addOrIncrementByCode = useCallback((rawCode: string) => {
    const code = rawCode.trim();
    if (!code) return;
    const item = inventoryItems.find((row) => (row.code || '').toLowerCase() === code.toLowerCase());
    if (!item) {
      toast({ title: 'Unknown SKU / barcode', description: `No item with code "${code}"`, variant: 'destructive' });
      setSkuCode('');
      return;
    }
    setLines((prev) => {
      const existing = prev.find((line) => line.item_id === item.id);
      if (existing) {
        return prev.map((line) =>
          line.key === existing.key
            ? calcLine({ ...line, quantity: Number(line.quantity || 0) + 1 })
            : line
        );
      }
      const blank = prev.find((line) => !line.item_id && !line.name.trim());
      const nextLine = calcLine({
        ...(blank || newLine()),
        item_id: item.id,
        hsn_code: item.hsn_code || null,
        name: item.name,
        unit: item.unit,
        quantity: 1,
        rate: item.purchase_price ?? item.sale_price,
        tax_type: isVat ? 'vat_13' : 'non_taxable',
        vat_rate: isVat ? STATUTORY_VAT_RATE : 0,
        is_custom: false,
      });
      if (blank) {
        return prev.map((line) => (line.key === blank.key ? nextLine : line));
      }
      return [...prev, nextLine];
    });
    setSkuCode('');
    toast({ title: `Added ${item.name}` });
  }, [inventoryItems, isVat, toast]);

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

  const invoiceNumber = `PUR-${String(business?.next_purchase_bill_num || 1).padStart(4, '0')}`;
  const issuedBs = formatBSShort(issuedDateBs);
  const dueBs = dueDateBs ? formatBSShort(dueDateBs) : null;

  const handleSave = async (status: 'draft' | 'issued') => {
    if (!vendorId) {
      toast({ title: 'Select a vendor', variant: 'destructive' });
      return;
    }
    if (lines.every((l) => !l.name.trim())) {
      toast({ title: 'Add at least one item', variant: 'destructive' });
      return;
    }
    if (!canIssueVATInvoice(isVat, Boolean(business?.is_vat_registered))) {
      toast({ title: 'VAT purchases require a VAT-registered business', variant: 'destructive' });
      return;
    }

    const validLines = lines.filter((l) => l.name.trim());
    const selectedVendor = parties.find((p) => p.id === vendorId);

    try {
      await createInvoice.mutateAsync({
        invoice: {
          invoice_number: invoiceNumber,
          type: 'purchase',
          status,
          customer_id: null,
          vendor_id: vendorId,
          buyer_pan: business?.pan_number || null,
          is_vat_invoice: isVat,
          issued_date_ad: issuedDateAd,
          issued_date_bs: issuedBs,
          due_date_ad: dueDateAd || null,
          due_date_bs: dueBs,
          vat_period: isVat ? getVATPeriod(adToBS(new Date(issuedDateAd))) : null,
          reference_number: referenceNumber || null,
          sub_total: totals.subTotal,
          discount_amount: totals.discountAmount,
          taxable_amount: totals.taxableAmount,
          vat_amount: totals.vatAmount,
          total_amount: totals.totalAmount,
          balance_due: totals.totalAmount,
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
      toast({ title: `Purchase bill ${status === 'draft' ? 'saved as draft' : 'recorded'}` });
      navigate('/purchases');
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4 animate-fade-in max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/purchases')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-bold text-foreground">New Purchase Bill</h1>
        <span className="ml-auto text-sm font-mono text-muted-foreground">{invoiceNumber}</span>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Vendor *</Label>
            <PartyCombobox
              parties={vendors}
              value={vendorId}
              mode="vendor"
              onSelect={setVendorId}
            />
          </div>
          <div>
            <Label className="text-xs">Vendor Invoice #</Label>
            <Input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} className="h-9 text-sm" placeholder="Vendor ref..." />
          </div>
          <div>
            <Label className="text-xs">Bill Date (BS)</Label>
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
            VAT Purchase ({STATUTORY_VAT_RATE}%)
          </label>
        )}
      </div>

      {/* Line items */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="flex flex-wrap items-end gap-2 border-b border-border px-3 py-2">
          <div className="flex-1 min-w-[180px]">
            <Label className="text-xs">SKU / Barcode</Label>
            <Input
              value={skuCode}
              onChange={(e) => setSkuCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addOrIncrementByCode(skuCode);
                }
              }}
              className="h-8 text-xs"
              placeholder="Scan or type item code, then Enter"
              autoComplete="off"
            />
          </div>
          <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => addOrIncrementByCode(skuCode)}>
            Add by Code
          </Button>
        </div>
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
                      mode="purchase"
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
                      type="number" min="0" step="1"
                      value={line.quantity}
                      onChange={(e) => updateLine(line.key, { quantity: Number(e.target.value) })}
                      className="h-8 text-xs text-right w-16 border-0 bg-transparent shadow-none px-0"
                    />
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{line.unit}</td>
                  <td className="px-3 py-2">
                    <Input
                      type="number" min="0" step="0.01"
                      value={line.rate}
                      onChange={(e) => updateLine(line.key, { rate: Number(e.target.value) })}
                      className="h-8 text-xs text-right w-24 border-0 bg-transparent shadow-none px-0"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number" min="0" max="100" step="0.1"
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
        </div>
      </div>

      <div className="flex gap-2 justify-end pb-4">
        <Button variant="outline" size="sm" onClick={() => navigate('/purchases')}>Cancel</Button>
        <Button variant="secondary" size="sm" onClick={() => handleSave('draft')} disabled={createInvoice.isPending}>
          Save Draft
        </Button>
        <Button size="sm" onClick={() => handleSave('issued')} disabled={createInvoice.isPending}>
          Record Purchase
        </Button>
      </div>
    </div>
  );
}
