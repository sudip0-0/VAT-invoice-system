import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { useInvoices } from '@/hooks/useInvoices';
import { formatNPR } from '@/lib/nepal-format';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import StatusBadge from '@/components/shared/StatusBadge';

type InvoiceType = 'all' | 'sale' | 'purchase';

export default function InvoicesPage() {
  const navigate = useNavigate();
  const { invoices, isLoading } = useInvoices();
  const [tab, setTab] = useState<InvoiceType>('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const filtered = invoices.filter((inv) => {
    if (tab !== 'all' && inv.type !== tab) return false;
    if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return inv.invoice_number.toLowerCase().includes(q) ||
        (inv.customer?.name || '').toLowerCase().includes(q) ||
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
        <h1 className="text-xl font-bold text-foreground">Invoices / Bills</h1>
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => navigate('/invoices/new')}>
          <Plus className="h-3.5 w-3.5" /> New Invoice
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as InvoiceType)}>
          <TabsList className="h-8">
            <TabsTrigger value="all" className="text-xs px-3">All ({invoices.length})</TabsTrigger>
            <TabsTrigger value="sale" className="text-xs px-3">Sales</TabsTrigger>
            <TabsTrigger value="purchase" className="text-xs px-3">Purchases</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground max-w-xs">
          <Search className="h-3.5 w-3.5" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoices..." className="w-full bg-transparent outline-none text-foreground placeholder:text-muted-foreground" />
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
            {invoices.length === 0 ? 'No invoices yet. Create your first!' : 'No matching invoices.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Invoice #</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Party</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Date (BS)</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Type</th>
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
                    <td className="px-4 py-3 text-foreground">{inv.customer?.name || inv.vendor?.name || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{inv.issued_date_bs}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-medium ${inv.type === 'sale' ? 'text-green-600 dark:text-green-400' : 'text-primary'}`}>
                        {inv.type === 'sale' ? 'Sale' : 'Purchase'}
                      </span>
                    </td>
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
