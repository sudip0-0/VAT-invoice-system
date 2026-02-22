import { useState } from 'react';
import { Plus, Search, Filter, Download } from 'lucide-react';
import { mockInvoices } from '@/lib/mock-data';
import { formatNPR } from '@/lib/nepal-format';
import StatusBadge from '@/components/shared/StatusBadge';

type TabType = 'ALL' | 'SALE' | 'PURCHASE';
type StatusFilter = 'ALL' | 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';

export default function InvoicesPage() {
  const [tab, setTab] = useState<TabType>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [search, setSearch] = useState('');

  const filtered = mockInvoices.filter((inv) => {
    if (tab !== 'ALL' && inv.type !== tab) return false;
    if (statusFilter !== 'ALL' && inv.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return inv.invoiceNumber.toLowerCase().includes(q) ||
        (inv.customerName || '').toLowerCase().includes(q) ||
        (inv.vendorName || '').toLowerCase().includes(q);
    }
    return true;
  });

  const tabs: { label: string; value: TabType }[] = [
    { label: 'All', value: 'ALL' },
    { label: 'Sales', value: 'SALE' },
    { label: 'Purchases', value: 'PURCHASE' },
  ];

  const statuses: { label: string; value: StatusFilter }[] = [
    { label: 'All Status', value: 'ALL' },
    { label: 'Draft', value: 'DRAFT' },
    { label: 'Issued', value: 'ISSUED' },
    { label: 'Partial', value: 'PARTIALLY_PAID' },
    { label: 'Paid', value: 'PAID' },
    { label: 'Overdue', value: 'OVERDUE' },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Invoices / Bills</h1>
        <button className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90 transition-opacity">
          <Plus className="h-3.5 w-3.5" />
          New Invoice
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === t.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground flex-1 max-w-xs">
          <Search className="h-3.5 w-3.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoices..."
            className="w-full bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex gap-1">
          {statuses.map((s) => (
            <button
              key={s.value}
              onClick={() => setStatusFilter(s.value)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                statusFilter === s.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
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
                <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer">
                  <td className="px-4 py-3">
                    <span className="font-medium text-foreground">{inv.invoiceNumber}</span>
                    {inv.isVatInvoice && (
                      <span className="ml-1.5 text-[10px] text-accent font-medium">VAT</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-foreground">{inv.customerName || inv.vendorName}</td>
                  <td className="px-4 py-3 text-muted-foreground">{inv.issuedDateBS}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] font-medium ${inv.type === 'SALE' ? 'text-success' : 'text-primary'}`}>
                      {inv.type === 'SALE' ? 'Sale' : 'Purchase'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-foreground">
                    {formatNPR(inv.totalAmount, { showSymbol: false })}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-foreground">
                    {inv.balanceDue > 0 ? formatNPR(inv.balanceDue, { showSymbol: false }) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={inv.status} />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No invoices found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
