import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { Party } from '@/hooks/useParties';

interface PartyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  party?: Party | null;
  onSave: (data: PartyFormData) => Promise<void>;
  loading?: boolean;
}

export interface PartyFormData {
  name: string;
  type: 'customer' | 'vendor' | 'both';
  phone: string;
  email: string;
  pan_number: string;
  address: string;
  city: string;
  opening_balance: number;
  credit_limit: number | null;
  credit_days: number | null;
  notes: string;
}

const defaultForm: PartyFormData = {
  name: '',
  type: 'customer',
  phone: '',
  email: '',
  pan_number: '',
  address: '',
  city: '',
  opening_balance: 0,
  credit_limit: null,
  credit_days: 30,
  notes: '',
};

export default function PartyDialog({ open, onOpenChange, party, onSave, loading }: PartyDialogProps) {
  const [form, setForm] = useState<PartyFormData>(defaultForm);
  const isEdit = !!party;

  useEffect(() => {
    if (party) {
      setForm({
        name: party.name,
        type: party.type,
        phone: party.phone || '',
        email: party.email || '',
        pan_number: party.pan_number || '',
        address: party.address || '',
        city: party.city || '',
        opening_balance: party.opening_balance,
        credit_limit: party.credit_limit,
        credit_days: party.credit_days,
        notes: party.notes || '',
      });
    } else {
      setForm(defaultForm);
    }
  }, [party, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(form);
  };

  const update = (field: keyof PartyFormData, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Party' : 'Add New Party'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => update('name', e.target.value)} required placeholder="Party name" />
            </div>
            <div>
              <Label>Type *</Label>
              <Select value={form.type} onValueChange={(v) => update('type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="vendor">Vendor</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="98XXXXXXXX" />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="email@example.com" />
            </div>
            <div>
              <Label>PAN Number</Label>
              <Input value={form.pan_number} onChange={(e) => update('pan_number', e.target.value)} placeholder="9-digit PAN" maxLength={9} />
            </div>
            <div>
              <Label>City</Label>
              <Input value={form.city} onChange={(e) => update('city', e.target.value)} placeholder="Kathmandu" />
            </div>
            <div>
              <Label>Address</Label>
              <Input value={form.address} onChange={(e) => update('address', e.target.value)} placeholder="Street address" />
            </div>
            <div>
              <Label>Opening Balance (NPR)</Label>
              <Input type="number" value={form.opening_balance} onChange={(e) => update('opening_balance', parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <Label>Credit Limit (NPR)</Label>
              <Input type="number" value={form.credit_limit ?? ''} onChange={(e) => update('credit_limit', e.target.value ? parseFloat(e.target.value) : null)} placeholder="No limit" />
            </div>
            <div>
              <Label>Credit Days</Label>
              <Input type="number" value={form.credit_days ?? ''} onChange={(e) => update('credit_days', e.target.value ? parseInt(e.target.value) : null)} />
            </div>
            <div className="col-span-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} placeholder="Optional notes..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !form.name.trim()}>
              {loading ? 'Saving...' : isEdit ? 'Update Party' : 'Add Party'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
