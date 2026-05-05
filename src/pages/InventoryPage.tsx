import { useEffect, useState } from 'react';
import { Plus, Search, Pencil, Trash2, ArrowLeftRight, PackagePlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useItemList, useItemCategories } from '@/hooks/useItems';
import { formatNPR } from '@/lib/nepal-format';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import ItemDialog from '@/components/inventory/ItemDialog';
import StockAdjustmentDialog from '@/components/inventory/StockAdjustmentDialog';
import type { Item } from '@/hooks/useItems';
import type { ItemFormData } from '@/components/inventory/ItemDialog';
import PaginationControls from '@/components/shared/PaginationControls';

const PAGE_SIZE = 50;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong';
}

export default function InventoryPage() {
  const { categories } = useItemCategories();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [deletingItem, setDeletingItem] = useState<Item | null>(null);
  const [adjustingItem, setAdjustingItem] = useState<Item | null>(null);

  useEffect(() => {
    setPage(1);
  }, [tab, search]);

  const { items, count, isLoading, createItem, updateItem, deleteItem, adjustStock } = useItemList({
    type: tab === 'product' || tab === 'service' ? tab : 'all',
    lowStockOnly: tab === 'low_stock',
    search,
    page,
    pageSize: PAGE_SIZE,
  });

  const handleSubmit = async (data: ItemFormData) => {
    try {
      if (editingItem) {
        await updateItem.mutateAsync({ id: editingItem.id, ...data });
        toast({ title: 'Item updated' });
      } else {
        await createItem.mutateAsync(data);
        toast({ title: 'Item added' });
      }
      setDialogOpen(false);
      setEditingItem(null);
    } catch (e: unknown) {
      toast({ title: 'Error', description: getErrorMessage(e), variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!deletingItem) return;
    try {
      await deleteItem.mutateAsync(deletingItem.id);
      toast({ title: 'Item deleted' });
    } catch (e: unknown) {
      toast({ title: 'Error', description: getErrorMessage(e), variant: 'destructive' });
    }
    setDeletingItem(null);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Inventory</h1>
        <div className="flex items-center gap-2">
          <Link to="/inventory/movements">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <ArrowLeftRight className="h-3.5 w-3.5" /> Stock Movements
            </Button>
          </Link>
          <Button size="sm" className="gap-1.5 text-xs" onClick={() => { setEditingItem(null); setDialogOpen(true); }}>
            <Plus className="h-3.5 w-3.5" /> Add Item
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="h-8">
            <TabsTrigger value="all" className="text-xs px-3">All</TabsTrigger>
            <TabsTrigger value="product" className="text-xs px-3">Products</TabsTrigger>
            <TabsTrigger value="service" className="text-xs px-3">Services</TabsTrigger>
            <TabsTrigger value="low_stock" className="text-xs px-3 text-destructive">Low Stock</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground max-w-xs">
          <Search className="h-3.5 w-3.5" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items..." className="w-full bg-transparent outline-none text-foreground placeholder:text-muted-foreground" />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">{count === 0 ? 'No items found.' : 'No items on this page.'}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Code</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Item Name</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Type</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Unit</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Sale Price</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Purchase Price</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Stock</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const isLow = item.low_stock_alert != null && item.current_stock <= item.low_stock_alert;
                  return (
                    <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground font-mono">{item.code || '—'}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{item.name}</td>
                      <td className="px-4 py-3 text-muted-foreground capitalize">{item.type}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.unit}</td>
                      <td className="px-4 py-3 text-right text-foreground">{formatNPR(item.sale_price, { showSymbol: false })}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{item.purchase_price != null ? formatNPR(item.purchase_price, { showSymbol: false }) : '—'}</td>
                      <td className="px-4 py-3 text-right">
                        {item.type === 'product' ? (
                          <>
                            <span className={`font-medium ${isLow ? 'text-destructive' : 'text-foreground'}`}>{item.current_stock}</span>
                            {isLow && <span className="ml-1 text-[10px] text-destructive">Low</span>}
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {item.type === 'product' && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Adjust Stock" onClick={() => setAdjustingItem(item)}>
                              <PackagePlus className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingItem(item); setDialogOpen(true); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeletingItem(item)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <PaginationControls page={page} pageSize={PAGE_SIZE} total={count} onPageChange={setPage} />
      </div>

      <ItemDialog
        open={dialogOpen}
        onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditingItem(null); }}
        item={editingItem}
        categories={categories}
        onSubmit={handleSubmit}
        loading={createItem.isPending || updateItem.isPending}
      />

      <AlertDialog open={!!deletingItem} onOpenChange={(o) => !o && setDeletingItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete "{deletingItem?.name}"?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <StockAdjustmentDialog
        open={!!adjustingItem}
        onOpenChange={(o) => !o && setAdjustingItem(null)}
        item={adjustingItem}
        onSubmit={async (data) => {
          try {
            await adjustStock.mutateAsync(data);
            toast({ title: 'Stock adjusted successfully' });
            setAdjustingItem(null);
          } catch (e: unknown) {
            toast({ title: 'Error', description: getErrorMessage(e), variant: 'destructive' });
          }
        }}
        loading={adjustStock.isPending}
      />
    </div>
  );
}
