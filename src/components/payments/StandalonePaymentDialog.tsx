import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { adToBS, formatBSShort } from '@/lib/bs-calendar';
import { nepalTodayISO, parseLocalDate } from '@/lib/nepal-date';
import { useParties } from '@/hooks/useParties';

interface StandalonePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  direction: 'in' | 'out';
  onSubmit: (data: Record<string, any>) => void;
  loading?: boolean;
}

const METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'esewa', label: 'eSewa' },
  { value: 'khalti', label: 'Khalti' },
  { value: 'fonepay', label: 'FonePay' },
  { value: 'connectips', label: 'ConnectIPS' },
  { value: 'cheque', label: 'Cheque' },
];

export default function StandalonePaymentDialog({
  open,
  onOpenChange,
  direction,
  onSubmit,
  loading,
}: StandalonePaymentDialogProps) {
  const today = nepalTodayISO();
  const { data: parties = [] } = useParties();

  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [partyId, setPartyId] = useState('none');
  const [dateAd, setDateAd] = useState(today);
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  const dateBs = (() => {
    try { return formatBSShort(adToBS(parseLocalDate(dateAd))); }
    catch { return ''; }
  })();

  const filteredParties = parties.filter((p) => {
    if (direction === 'in') return p.type === 'customer' || p.type === 'both';
    return p.type === 'vendor' || p.type === 'both';
  });

  const resetForm = () => {
    setAmount('');
    setMethod('cash');
    setPartyId('none');
    setDateAd(today);
    setReference('');
    setNotes('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt || amt <= 0 || amt > 99999999) return;

    onSubmit({
      party_id: partyId !== 'none' ? partyId : null,
      invoice_id: null,
      amount: amt,
      method,
      payment_date_ad: dateAd,
      payment_date_bs: dateBs,
      reference: reference.trim().slice(0, 100) || null,
      notes: notes.trim().slice(0, 500) || null,
      status: 'completed',
    });
    resetForm();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">
            Record Payment {direction === 'in' ? 'In' : 'Out'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Amount (NPR) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max="99999999"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-9 text-sm"
                required
              />
            </div>
            <div>
              <Label className="text-xs">Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs">
                {direction === 'in' ? 'Customer' : 'Vendor'} (optional)
              </Label>
              <Select value={partyId} onValueChange={setPartyId}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select party" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {filteredParties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Payment Date</Label>
              <Input
                type="date"
                value={dateAd}
                onChange={(e) => setDateAd(e.target.value)}
                className="h-9 text-sm"
              />
              {dateBs && <span className="text-[10px] text-muted-foreground">BS: {dateBs}</span>}
            </div>
            <div>
              <Label className="text-xs">Reference</Label>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="h-9 text-sm"
                placeholder="Txn ID, receipt #"
                maxLength={100}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-sm min-h-[50px]"
              maxLength={500}
              placeholder="e.g. Advance payment, deposit..."
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading}>
              Record Payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
