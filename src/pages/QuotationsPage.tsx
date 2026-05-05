import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { useInvoiceList } from '@/hooks/useInvoices';
import { formatNPR } from '@/lib/nepal-format';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/shared/StatusBadge';
import PaginationControls from '@/components/shared/PaginationControls';

const PAGE_SIZE = 50;

export default function QuotationsPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, search]);

  const { data, isLoading } = useInvoiceList({
    type: 'quotation',
    status: statusFilter,
    search,
    page,
    pageSize: PAGE_SIZE,
  });
  const quotations = data?.data || [];
  const total = data?.count || 0;

  const statuses = [
    { label: 'All', value: 'all' },
    { label: 'Draft', value: 'draft' },
    { label: 'Issued', value: 'issued' },
    { label: 'Cancelled', value: 'cancelled' },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Quotations</h1>
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => navigate('/quotations/new')}>
          <Plus className="h-3.5 w-3.5" /> New Quotation
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground max-w-xs">
          <Search className="h-3.5 w-3.5" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search quotations..." className="w-full bg-transparent outline-none text-foreground placeholder:text-muted-foreground" />
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
        ) : quotations.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            {total === 0 ? 'No quotations found.' : 'No quotations on this page.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Quotation #</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Customer</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Date (BS)</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Total</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {quotations.map((inv) => (
                  <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate(`/invoices/${inv.id}`)}>
                    <td className="px-4 py-3">
                      <span className="font-medium text-foreground">{inv.invoice_number}</span>
                    </td>
                    <td className="px-4 py-3 text-foreground">{inv.customer?.name || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{inv.issued_date_bs}</td>
                    <td className="px-4 py-3 text-right font-medium text-foreground">
                      {formatNPR(inv.total_amount, { showSymbol: false })}
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
        <PaginationControls page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      </div>
    </div>
  );
}
