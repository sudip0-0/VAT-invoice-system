import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { adToBS, formatBSShort } from '@/lib/bs-calendar';

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  partyId: string | null;
  balanceDue: number;
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

export default function PaymentDialog({ open, onOpenChange, invoiceId, partyId, balanceDue, onSubmit, loading }: PaymentDialogProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [amount, setAmount] = useState(String(balanceDue));
  const [method, setMethod] = useState('cash');
  const [dateAd, setDateAd] = useState(today);
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  const dateBs = (() => {
    try { return formatBSShort(adToBS(new Date(dateAd))); }
    catch { return ''; }
  })();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt || amt <= 0) return;
    onSubmit({
      invoice_id: invoiceId,
      party_id: partyId,
      amount: amt,
      method,
      payment_date_ad: dateAd,
      payment_date_bs: dateBs,
      reference: reference.trim() || null,
      notes: notes.trim() || null,
      status: 'completed',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Record Payment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Amount *</Label>
              <Input type="number" step="0.01" min="0" max={balanceDue} value={amount} onChange={(e) => setAmount(e.target.value)} className="h-9 text-sm" required />
              <span className="text-[10px] text-muted-foreground">Balance: NPR {balanceDue.toFixed(2)}</span>
            </div>
            <div>
              <Label className="text-xs">Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Payment Date</Label>
              <Input type="date" value={dateAd} onChange={(e) => setDateAd(e.target.value)} className="h-9 text-sm" />
              {dateBs && <span className="text-[10px] text-muted-foreground">BS: {dateBs}</span>}
            </div>
            <div>
              <Label className="text-xs">Reference</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} className="h-9 text-sm" placeholder="Txn ID, cheque #" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="text-sm min-h-[50px]" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" size="sm" disabled={loading}>Record Payment</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
