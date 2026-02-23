import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { useInvoices } from '@/hooks/useInvoices';
import { formatNPR } from '@/lib/nepal-format';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/shared/StatusBadge';

export default function PurchasesPage() {
  const navigate = useNavigate();
  const { invoices, isLoading } = useInvoices();
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const purchases = invoices.filter((inv) => inv.type === 'purchase');

  const filtered = purchases.filter((inv) => {
    if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return inv.invoice_number.toLowerCase().includes(q) ||
        (inv.vendor?.name || '').toLowerCase().includes(q);
    }
    return true;
  });

  const statuses = [
    { label: 'All', value: 'all' },
    { label: 'Draft', value: 'draft' },
    { label: 'Issued', value: 'issued' },
    { label: 'Partial', value: 'partially_paid' },
    { label: 'Paid', value: 'paid' },
    { label: 'Overdue', value: 'overdue' },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Purchase Bills</h1>
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => navigate('/purchases/new')}>
          <Plus className="h-3.5 w-3.5" /> New Purchase
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground max-w-xs">
          <Search className="h-3.5 w-3.5" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search purchases..." className="w-full bg-transparent outline-none text-foreground placeholder:text-muted-foreground" />
        </div>
      </div>

      <div className="flex gap-1 flex-wrap">
        {statuses.map((s) => (
          <button
            key={s.value}
            onClick={() => setStatusFilter(s.value)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
              statusFilter === s.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            {purchases.length === 0 ? 'No purchase bills yet. Create your first!' : 'No matching purchases.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Bill #</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Vendor</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Date (BS)</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Total</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Balance Due</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => (
                  <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate(`/invoices/${inv.id}`)}>
                    <td className="px-4 py-3">
                      <span className="font-medium text-foreground">{inv.invoice_number}</span>
                      {inv.is_vat_invoice && <span className="ml-1.5 text-[10px] text-primary font-medium">VAT</span>}
                    </td>
                    <td className="px-4 py-3 text-foreground">{inv.vendor?.name || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{inv.issued_date_bs}</td>
                    <td className="px-4 py-3 text-right font-medium text-foreground">
                      {formatNPR(inv.total_amount, { showSymbol: false })}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-foreground">
                      {inv.balance_due > 0 ? formatNPR(inv.balance_due, { showSymbol: false }) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={inv.status.toUpperCase()} />
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
