import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { mockItems } from '@/lib/mock-data';
import { formatNPR } from '@/lib/nepal-format';

export default function InventoryPage() {
  const [search, setSearch] = useState('');

  const filtered = mockItems.filter((item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return item.name.toLowerCase().includes(q) || (item.code || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Inventory</h1>
        <button className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90 transition-opacity">
          <Plus className="h-3.5 w-3.5" />
          Add Item
        </button>
      </div>

      <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground max-w-xs">
        <Search className="h-3.5 w-3.5" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search items..."
          className="w-full bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
        />
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Code</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Item Name</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Unit</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Sale Price</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Purchase Price</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Stock</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const isLow = item.lowStockAlert && item.currentStock <= item.lowStockAlert;
                return (
                  <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer">
                    <td className="px-4 py-3 text-muted-foreground font-mono">{item.code || '—'}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{item.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{item.unit}</td>
                    <td className="px-4 py-3 text-right text-foreground">{formatNPR(item.salePrice, { showSymbol: false })}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{item.purchasePrice ? formatNPR(item.purchasePrice, { showSymbol: false }) : '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-medium ${isLow ? 'text-destructive' : 'text-foreground'}`}>
                        {item.currentStock}
                      </span>
                      {isLow && <span className="ml-1 text-[10px] text-destructive">Low</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
