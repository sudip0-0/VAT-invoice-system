import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { mockParties } from '@/lib/mock-data';
import { formatNPR } from '@/lib/nepal-format';

type TabType = 'ALL' | 'CUSTOMER' | 'VENDOR';

export default function PartiesPage() {
  const [tab, setTab] = useState<TabType>('ALL');
  const [search, setSearch] = useState('');

  const filtered = mockParties.filter((p) => {
    if (tab === 'CUSTOMER' && p.type === 'VENDOR') return false;
    if (tab === 'VENDOR' && p.type === 'CUSTOMER') return false;
    if (search) {
      const q = search.toLowerCase();
      return p.name.toLowerCase().includes(q) || (p.phone || '').includes(q) || (p.panNumber || '').includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Parties</h1>
        <button className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90 transition-opacity">
          <Plus className="h-3.5 w-3.5" />
          Add Party
        </button>
      </div>

      <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
        {(['ALL', 'CUSTOMER', 'VENDOR'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'ALL' ? 'All' : t === 'CUSTOMER' ? 'Customers' : 'Vendors'}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground max-w-xs">
        <Search className="h-3.5 w-3.5" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search parties..."
          className="w-full bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
        />
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Type</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Phone</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">PAN</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Balance</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer">
                  <td className="px-4 py-3 font-medium text-foreground">{p.name}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] font-medium ${p.type === 'CUSTOMER' ? 'text-success' : 'text-primary'}`}>
                      {p.type === 'CUSTOMER' ? 'Customer' : p.type === 'VENDOR' ? 'Vendor' : 'Both'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.phone || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono">{p.panNumber || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    {p.balance !== 0 ? (
                      <span className={`font-medium ${p.balance > 0 ? 'text-success' : 'text-destructive'}`}>
                        {formatNPR(Math.abs(p.balance), { showSymbol: false })}
                        <span className="ml-1 text-[10px] text-muted-foreground">{p.balance > 0 ? 'Recv' : 'Pay'}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
