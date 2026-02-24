import { useState } from 'react';
import { Search, ArrowDownCircle, ArrowUpCircle, Package } from 'lucide-react';
import { useStockMovements } from '@/hooks/useStockMovements';
import { useItems } from '@/hooks/useItems';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';

const reasonLabels: Record<string, string> = {
  sale: 'Sale',
  purchase: 'Purchase',
  sale_return: 'Sale Return',
  purchase_return: 'Purchase Return',
  cancellation: 'Cancellation',
  adjustment: 'Adjustment',
};

export default function StockMovementsPage() {
  const [selectedItem, setSelectedItem] = useState<string>('all');
  const [search, setSearch] = useState('');

  const { items } = useItems();
  const { data: movements = [], isLoading } = useStockMovements(
    selectedItem !== 'all' ? selectedItem : undefined
  );

  const filtered = movements.filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      m.item?.name?.toLowerCase().includes(q) ||
      m.invoice?.invoice_number?.toLowerCase().includes(q) ||
      m.reason?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Stock Movements</h1>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <Select value={selectedItem} onValueChange={setSelectedItem}>
          <SelectTrigger className="w-[200px] h-8 text-xs">
            <SelectValue placeholder="All Items" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Items</SelectItem>
            {items.filter(i => i.type === 'product').map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground max-w-xs">
          <Search className="h-3.5 w-3.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search movements..."
            className="w-full bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No stock movements found. Movements are recorded automatically when invoices are issued or cancelled.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Item</th>
                  <th className="px-4 py-2.5 text-center font-medium text-muted-foreground">Direction</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Qty</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Before</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">After</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Reason</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Invoice</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {new Date(m.created_at).toLocaleDateString('en-GB', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })}
                      <span className="ml-1.5 text-[10px]">
                        {new Date(m.created_at).toLocaleTimeString('en-GB', {
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {m.item?.name || '—'}
                      {m.item?.code && (
                        <span className="ml-1.5 text-[10px] text-muted-foreground font-mono">
                          ({m.item.code})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {m.direction === 'in' ? (
                        <Badge variant="outline" className="gap-1 text-[10px] border-emerald-500/30 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30">
                          <ArrowDownCircle className="h-3 w-3" /> IN
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-[10px] border-red-500/30 text-red-600 bg-red-50 dark:bg-red-950/30">
                          <ArrowUpCircle className="h-3 w-3" /> OUT
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-foreground">{m.quantity}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{m.stock_before}</td>
                    <td className="px-4 py-3 text-right font-medium text-foreground">{m.stock_after}</td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">
                      {reasonLabels[m.reason] || m.reason}
                    </td>
                    <td className="px-4 py-3">
                      {m.invoice ? (
                        <Link
                          to={`/invoices/${m.invoice_id}`}
                          className="text-primary hover:underline font-mono text-[11px]"
                        >
                          {m.invoice.invoice_number}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
