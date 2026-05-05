import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useInvoices, useTaxRates } from '@/hooks/useInvoices';
import { useParties } from '@/hooks/useParties';
import { useItems } from '@/hooks/useItems';
import { useBusiness } from '@/contexts/BusinessContext';
import { formatNPR } from '@/lib/nepal-format';
import { type BSDate, todayBS, formatBSShort, getVATPeriod, adToBS } from '@/lib/bs-calendar';
import { nepalTodayISO } from '@/lib/nepal-date';
import BSDatePicker from '@/components/shared/BSDatePicker';
import ItemCombobox from '@/components/invoices/ItemCombobox';

interface LineItem {
  key: string;
  item_id: string | null;
  name: string;
  unit: string;
  quantity: number;
  rate: number;
  discount_pct: number;
  discount_amt: number;
  vat_rate: number;
  taxable_amount: number;
  vat_amount: number;
  total_amount: number;
  is_custom: boolean;
}

function newLine(): LineItem {
  return {
    key: crypto.randomUUID(), item_id: null, name: '', unit: 'PCS',
    quantity: 1, rate: 0, discount_pct: 0, discount_amt: 0,
    vat_rate: 0, taxable_amount: 0, vat_amount: 0, total_amount: 0,
    is_custom: false,
  };
}

function calcLine(line: LineItem): LineItem {
  const gross = line.quantity * line.rate;
  const discAmt = line.discount_pct > 0 ? gross * (line.discount_pct / 100) : 0;
  const taxable = gross - discAmt;
  const vat = taxable * (line.vat_rate / 100);
  return { ...line, discount_amt: discAmt, taxable_amount: taxable, vat_amount: vat, total_amount: taxable + vat };
}

export default function QuotationCreatePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { business } = useBusiness();
  const { createInvoice } = useInvoices();
  const { data: parties = [] } = useParties();
  const { items: inventoryItems } = useItems();
  const { data: taxRates = [] } = useTaxRates();

  const todayBs = todayBS();
  const todayAd = nepalTodayISO();

  const [partyId, setPartyId] = useState('');
  const [issuedDateBs, setIssuedDateBs] = useState<BSDate>(todayBs);
  const [issuedDateAd, setIssuedDateAd] = useState(todayAd);
  const [dueDateBs, setDueDateBs] = useState<BSDate | null>(null);
  const [dueDateAd, setDueDateAd] = useState('');
  const [isVat, setIsVat] = useState(business?.is_vat_registered ?? false);
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineItem[]>([newLine()]);

  const vatRate = useMemo(() => {
    const vat13 = taxRates.find((t) => t.type === 'vat_13');
    return vat13?.rate ?? 13;
  }, [taxRates]);

  const customers = useMemo(() => parties.filter((p) => p.type === 'customer' || p.type === 'both'), [parties]);

  const updateLine = useCallback((key: string, updates: Partial<LineItem>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? calcLine({ ...l, ...updates }) : l)));
  }, []);

  const selectItem = useCallback((key: string, itemId: string) => {
    const item = inventoryItems.find((i) => i.id === itemId);
    if (!item) return;
    updateLine(key, { item_id: itemId, name: item.name, unit: item.unit, rate: item.sale_price, vat_rate: isVat ? vatRate : 0, is_custom: false });
  }, [inventoryItems, isVat, vatRate, updateLine]);

  const addLine = () => setLines((prev) => [...prev, newLine()]);
  const removeLine = (key: string) => setLines((prev) => prev.length > 1 ? prev.filter((l) => l.key !== key) : prev);

  const totals = useMemo(() => {
    const subTotal = lines.reduce((s, l) => s + l.quantity * l.rate, 0);
    const discountAmount = lines.reduce((s, l) => s + l.discount_amt, 0);
    const taxableAmount = lines.reduce((s, l) => s + l.taxable_amount, 0);
    const vatAmount = lines.reduce((s, l) => s + l.vat_amount, 0);
    const totalAmount = lines.reduce((s, l) => s + l.total_amount, 0);
    return { subTotal, discountAmount, taxableAmount, vatAmount, totalAmount };
  }, [lines]);

  const quotationNumber = `QTN-${String(business?.next_invoice_num || 1).padStart(4, '0')}`;
  const issuedBs = formatBSShort(issuedDateBs);
  const dueBs = dueDateBs ? formatBSShort(dueDateBs) : null;

  const handleSave = async (status: 'draft' | 'issued') => {
    if (!partyId) { toast({ title: 'Select a customer', variant: 'destructive' }); return; }
    if (lines.every((l) => !l.name.trim())) { toast({ title: 'Add at least one item', variant: 'destructive' }); return; }

    const validLines = lines.filter((l) => l.name.trim());
    const selectedParty = parties.find((p) => p.id === partyId);

    try {
      await createInvoice.mutateAsync({
        invoice: {
          invoice_number: quotationNumber,
          type: 'quotation',
          status,
          customer_id: partyId,
          vendor_id: null,
          buyer_pan: selectedParty?.pan_number || null,
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
          balance_due: 0,
          notes: notes || null,
        },
        items: validLines.map((l) => ({
          item_id: l.item_id, name: l.name, unit: l.unit, quantity: l.quantity, rate: l.rate,
          discount_pct: l.discount_pct, discount_amt: l.discount_amt,
          vat_rate: l.vat_rate, taxable_amount: l.taxable_amount, vat_amount: l.vat_amount, total_amount: l.total_amount,
        })),
      });
      toast({ title: `Quotation ${status === 'draft' ? 'saved as draft' : 'sent'}` });
      navigate('/quotations');
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4 animate-fade-in max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/quotations')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-bold text-foreground">New Quotation</h1>
        <span className="ml-auto text-sm font-mono text-muted-foreground">{quotationNumber}</span>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <Label className="text-xs">Customer *</Label>
            <Select value={partyId} onValueChange={setPartyId}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                {customers.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Date (BS)</Label>
            <BSDatePicker value={issuedDateBs} onChange={(bs, ad) => { setIssuedDateBs(bs); setIssuedDateAd(ad.toISOString().slice(0, 10)); }} className="w-full" />
            <span className="text-[10px] text-muted-foreground">AD: {issuedDateAd}</span>
          </div>
          <div>
            <Label className="text-xs">Valid Until (BS)</Label>
            <BSDatePicker value={dueDateBs} onChange={(bs, ad) => { setDueDateBs(bs); setDueDateAd(ad.toISOString().slice(0, 10)); }} placeholder="Optional" className="w-full" />
            {dueBs && <span className="text-[10px] text-muted-foreground">AD: {dueDateAd}</span>}
          </div>
        </div>
        {business?.is_vat_registered && (
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={isVat} onChange={(e) => {
              setIsVat(e.target.checked);
              setLines((prev) => prev.map((l) => calcLine({ ...l, vat_rate: e.target.checked ? vatRate : 0 })));
            }} className="rounded" />
            Include VAT (13%)
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
                      mode="quotation"
                      onSelect={(itemId) => selectItem(line.key, itemId)}
                      onCustom={() => updateLine(line.key, { item_id: null, name: '', is_custom: true })}
                    />
                    {line.is_custom && (
                      <Input value={line.name} onChange={(e) => updateLine(line.key, { name: e.target.value })} placeholder="Item name" className="h-7 text-xs mt-1" />
                    )}
                  </td>
                  <td className="px-3 py-2"><Input type="number" min="0" step="1" value={line.quantity} onChange={(e) => updateLine(line.key, { quantity: Number(e.target.value) })} className="h-8 text-xs text-right w-16 border-0 bg-transparent shadow-none px-0" /></td>
                  <td className="px-3 py-2 text-muted-foreground">{line.unit}</td>
                  <td className="px-3 py-2"><Input type="number" min="0" step="0.01" value={line.rate} onChange={(e) => updateLine(line.key, { rate: Number(e.target.value) })} className="h-8 text-xs text-right w-24 border-0 bg-transparent shadow-none px-0" /></td>
                  <td className="px-3 py-2"><Input type="number" min="0" max="100" step="0.1" value={line.discount_pct} onChange={(e) => updateLine(line.key, { discount_pct: Number(e.target.value) })} className="h-8 text-xs text-right w-16 border-0 bg-transparent shadow-none px-0" /></td>
                  {isVat && <td className="px-3 py-2 text-right text-muted-foreground">{formatNPR(line.vat_amount, { showSymbol: false })}</td>}
                  <td className="px-3 py-2 text-right font-medium text-foreground">{formatNPR(line.total_amount, { showSymbol: false })}</td>
                  <td className="px-3 py-2"><Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeLine(line.key)}><Trash2 className="h-3 w-3" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-2 border-t border-border">
          <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={addLine}><Plus className="h-3 w-3" /> Add Line</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="text-sm min-h-[80px]" placeholder="Terms, conditions, notes..." />
        </div>
        <div className="rounded-lg border border-border bg-card p-4 space-y-2 text-sm">
          <div className="flex justify-between text-muted-foreground"><span>Sub Total</span><span>{formatNPR(totals.subTotal, { showSymbol: false })}</span></div>
          {totals.discountAmount > 0 && <div className="flex justify-between text-muted-foreground"><span>Discount</span><span>-{formatNPR(totals.discountAmount, { showSymbol: false })}</span></div>}
          {isVat && (
            <>
              <div className="flex justify-between text-muted-foreground"><span>Taxable Amount</span><span>{formatNPR(totals.taxableAmount, { showSymbol: false })}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>VAT (13%)</span><span>{formatNPR(totals.vatAmount, { showSymbol: false })}</span></div>
            </>
          )}
          <div className="flex justify-between font-bold text-foreground border-t border-border pt-2"><span>Total</span><span>{formatNPR(totals.totalAmount)}</span></div>
        </div>
      </div>

      <div className="flex gap-2 justify-end pb-4">
        <Button variant="outline" size="sm" onClick={() => navigate('/quotations')}>Cancel</Button>
        <Button variant="secondary" size="sm" onClick={() => handleSave('draft')} disabled={createInvoice.isPending}>Save Draft</Button>
        <Button size="sm" onClick={() => handleSave('issued')} disabled={createInvoice.isPending}>Send Quotation</Button>
      </div>
    </div>
  );
}
