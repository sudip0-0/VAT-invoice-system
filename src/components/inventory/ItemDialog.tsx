import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { Item } from '@/hooks/useItems';

interface ItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: Item | null;
  categories: { id: string; name: string }[];
  onSubmit: (data: Record<string, any>) => void;
  loading?: boolean;
}

const UNITS = ['PCS', 'KG', 'LTR', 'MTR', 'BOX', 'PKT', 'SET', 'DOZ', 'BAG', 'PAIR'];

export default function ItemDialog({ open, onOpenChange, item, categories, onSubmit, loading }: ItemDialogProps) {
  const [form, setForm] = useState({
    name: '',
    code: '',
    type: 'product' as 'product' | 'service',
    unit: 'PCS',
    sale_price: '',
    purchase_price: '',
    opening_stock: '',
    low_stock_alert: '',
    category_id: '',
    hsn_code: '',
    description: '',
  });

  useEffect(() => {
    if (item) {
      setForm({
        name: item.name,
        code: item.code || '',
        type: item.type,
        unit: item.unit,
        sale_price: String(item.sale_price),
        purchase_price: item.purchase_price != null ? String(item.purchase_price) : '',
        opening_stock: String(item.opening_stock),
        low_stock_alert: item.low_stock_alert != null ? String(item.low_stock_alert) : '',
        category_id: item.category_id || '',
        hsn_code: item.hsn_code || '',
        description: item.description || '',
      });
    } else {
      setForm({ name: '', code: '', type: 'product', unit: 'PCS', sale_price: '', purchase_price: '', opening_stock: '0', low_stock_alert: '', category_id: '', hsn_code: '', description: '' });
    }
  }, [item, open]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.sale_price) return;
    onSubmit({
      name: form.name.trim(),
      code: form.code.trim() || null,
      type: form.type,
      unit: form.unit,
      sale_price: Number(form.sale_price),
      purchase_price: form.purchase_price ? Number(form.purchase_price) : null,
      opening_stock: Number(form.opening_stock || 0),
      current_stock: item ? undefined : Number(form.opening_stock || 0),
      low_stock_alert: form.low_stock_alert ? Number(form.low_stock_alert) : null,
      category_id: form.category_id || null,
      hsn_code: form.hsn_code.trim() || null,
      description: form.description.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">{item ? 'Edit Item' : 'Add Item'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs">Item Name *</Label>
              <Input value={form.name} onChange={(e) => set('name', e.target.value)} className="h-9 text-sm" required />
            </div>
            <div>
              <Label className="text-xs">Code / SKU</Label>
              <Input value={form.code} onChange={(e) => set('code', e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={form.type} onValueChange={(v) => set('type', v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="product">Product</SelectItem>
                  <SelectItem value="service">Service</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Unit</Label>
              <Select value={form.unit} onValueChange={(v) => set('unit', v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {categories.length > 0 && (
              <div>
                <Label className="text-xs">Category</Label>
                <Select value={form.category_id} onValueChange={(v) => set('category_id', v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-xs">Sale Price *</Label>
              <Input type="number" step="0.01" min="0" value={form.sale_price} onChange={(e) => set('sale_price', e.target.value)} className="h-9 text-sm" required />
            </div>
            <div>
              <Label className="text-xs">Purchase Price</Label>
              <Input type="number" step="0.01" min="0" value={form.purchase_price} onChange={(e) => set('purchase_price', e.target.value)} className="h-9 text-sm" />
            </div>
            {form.type === 'product' && (
              <>
                <div>
                  <Label className="text-xs">{item ? 'Opening Stock' : 'Opening Stock'}</Label>
                  <Input type="number" step="1" min="0" value={form.opening_stock} onChange={(e) => set('opening_stock', e.target.value)} className="h-9 text-sm" disabled={!!item} />
                </div>
                <div>
                  <Label className="text-xs">Low Stock Alert</Label>
                  <Input type="number" step="1" min="0" value={form.low_stock_alert} onChange={(e) => set('low_stock_alert', e.target.value)} className="h-9 text-sm" placeholder="e.g. 10" />
                </div>
              </>
            )}
            <div>
              <Label className="text-xs">HSN Code</Label>
              <Input value={form.hsn_code} onChange={(e) => set('hsn_code', e.target.value)} className="h-9 text-sm" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} className="text-sm min-h-[60px]" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" size="sm" disabled={loading}>{item ? 'Update' : 'Add Item'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
