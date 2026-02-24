import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { Item } from '@/hooks/useItems';

interface StockAdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: Item | null;
  onSubmit: (data: { item_id: string; quantity: number; direction: 'in' | 'out'; reason: string }) => void;
  loading?: boolean;
}

const REASONS_IN = ['Stock count correction', 'Returned goods', 'Opening stock adjustment', 'Other'];
const REASONS_OUT = ['Damaged goods', 'Expired goods', 'Lost/Missing', 'Stock count correction', 'Other'];

export default function StockAdjustmentDialog({ open, onOpenChange, item, onSubmit, loading }: StockAdjustmentDialogProps) {
  const [direction, setDirection] = useState<'in' | 'out'>('in');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');

  useEffect(() => {
    if (open) {
      setDirection('in');
      setQuantity('');
      setReason('');
      setCustomReason('');
    }
  }, [open]);

  const reasons = direction === 'in' ? REASONS_IN : REASONS_OUT;
  const finalReason = reason === 'Other' ? customReason.trim() : reason;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!item || !quantity || Number(quantity) <= 0 || !finalReason) return;
    if (direction === 'out' && Number(quantity) > item.current_stock) return;
    onSubmit({ item_id: item.id, quantity: Number(quantity), direction, reason: finalReason });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Adjust Stock</DialogTitle>
        </DialogHeader>
        {item && (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Item</Label>
              <p className="text-sm font-medium text-foreground">{item.name} {item.code ? `(${item.code})` : ''}</p>
              <p className="text-xs text-muted-foreground">Current Stock: <span className="font-medium text-foreground">{item.current_stock}</span></p>
            </div>

            <div>
              <Label className="text-xs">Type *</Label>
              <Select value={direction} onValueChange={(v) => { setDirection(v as 'in' | 'out'); setReason(''); }}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">Add Stock (IN)</SelectItem>
                  <SelectItem value="out">Remove Stock (OUT)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Quantity *</Label>
              <Input
                type="number"
                step="1"
                min="1"
                max={direction === 'out' ? item.current_stock : undefined}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="h-9 text-sm"
                required
              />
              {direction === 'out' && quantity && Number(quantity) > item.current_stock && (
                <p className="text-xs text-destructive mt-1">Cannot exceed current stock ({item.current_stock})</p>
              )}
            </div>

            <div>
              <Label className="text-xs">Reason *</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select reason" /></SelectTrigger>
                <SelectContent>
                  {reasons.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {reason === 'Other' && (
              <div>
                <Label className="text-xs">Specify Reason *</Label>
                <Textarea value={customReason} onChange={(e) => setCustomReason(e.target.value)} className="text-sm min-h-[60px]" required />
              </div>
            )}

            {quantity && Number(quantity) > 0 && (
              <div className="rounded-md bg-muted/50 p-2.5 text-xs">
                New stock will be: <span className="font-semibold text-foreground">
                  {direction === 'in' ? item.current_stock + Number(quantity) : item.current_stock - Number(quantity)}
                </span>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" size="sm" disabled={loading || !finalReason || !quantity || Number(quantity) <= 0 || (direction === 'out' && Number(quantity) > item.current_stock)}>
                {loading ? 'Saving…' : 'Adjust Stock'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
