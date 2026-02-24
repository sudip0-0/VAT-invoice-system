import { useState, useMemo } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { useSalesReport, useVATSummary, usePartyLedger } from '@/hooks/useReports';
import { useParties } from '@/hooks/useParties';
import { formatNPR } from '@/lib/nepal-format';

function getDefaultDateRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to = now.toISOString().slice(0, 10);
  return { from, to };
}

function exportCSV(headers: string[], rows: string[][], filename: string) {
  const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const defaults = getDefaultDateRange();
  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo, setDateTo] = useState(defaults.to);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Reports</h1>
      </div>

      <div className="flex items-end gap-3">
        <div>
          <Label className="text-xs">From</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 text-sm w-40" />
        </div>
        <div>
          <Label className="text-xs">To</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 text-sm w-40" />
        </div>
      </div>

      <Tabs defaultValue="sales">
        <TabsList className="h-8">
          <TabsTrigger value="sales" className="text-xs px-3">Sales / Purchase</TabsTrigger>
          <TabsTrigger value="vat" className="text-xs px-3">VAT Summary</TabsTrigger>
          <TabsTrigger value="ledger" className="text-xs px-3">Party Ledger</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="mt-4">
          <SalesReport dateFrom={dateFrom} dateTo={dateTo} />
        </TabsContent>
        <TabsContent value="vat" className="mt-4">
          <VATReport dateFrom={dateFrom} dateTo={dateTo} />
        </TabsContent>
        <TabsContent value="ledger" className="mt-4">
          <PartyLedgerReport dateFrom={dateFrom} dateTo={dateTo} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SalesReport({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const [typeFilter, setTypeFilter] = useState<'all' | 'sale' | 'purchase'>('all');
  const { data, isLoading } = useSalesReport(dateFrom, dateTo);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (typeFilter === 'all') return data.rows;
    return data.rows.filter((r) => r.type === typeFilter);
  }, [data, typeFilter]);

  const filteredTotals = useMemo(() => {
    return filtered.reduce(
      (acc, r) => ({
        sub_total: acc.sub_total + r.sub_total,
        discount: acc.discount + r.discount,
        taxable: acc.taxable + r.taxable,
        vat: acc.vat + r.vat,
        total: acc.total + r.total,
      }),
      { sub_total: 0, discount: 0, taxable: 0, vat: 0, total: 0 }
    );
  }, [filtered]);

  const handleExport = () => {
    const headers = ['Date (BS)', 'Invoice #', 'Party', 'Type', 'Sub Total', 'Discount', 'Taxable', 'VAT', 'Total'];
    const rows = filtered.map((r) => [r.date_bs, r.invoice_number, r.party_name, r.type, String(r.sub_total), String(r.discount), String(r.taxable), String(r.vat), String(r.total)]);
    exportCSV(headers, rows, `sales-report-${dateFrom}-${dateTo}.csv`);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Tabs value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
          <TabsList className="h-7">
            <TabsTrigger value="all" className="text-[11px] px-2">All</TabsTrigger>
            <TabsTrigger value="sale" className="text-[11px] px-2">Sales</TabsTrigger>
            <TabsTrigger value="purchase" className="text-[11px] px-2">Purchases</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button variant="outline" size="sm" className="ml-auto gap-1 text-xs" onClick={handleExport} disabled={!filtered.length}>
          <Download className="h-3 w-3" /> Export CSV
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No invoices in this period.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Invoice #</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Party</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Type</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Sub Total</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Discount</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Taxable</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">VAT</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 text-muted-foreground">{r.date_bs}</td>
                    <td className="px-3 py-2 font-medium text-foreground">{r.invoice_number}</td>
                    <td className="px-3 py-2 text-foreground">{r.party_name}</td>
                    <td className="px-3 py-2">
                      <span className={`text-[11px] font-medium ${r.type === 'sale' ? 'text-green-600 dark:text-green-400' : 'text-primary'}`}>
                        {r.type === 'sale' ? 'Sale' : 'Purchase'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-foreground">{formatNPR(r.sub_total, { showSymbol: false })}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{r.discount > 0 ? formatNPR(r.discount, { showSymbol: false }) : '—'}</td>
                    <td className="px-3 py-2 text-right text-foreground">{formatNPR(r.taxable, { showSymbol: false })}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{r.vat > 0 ? formatNPR(r.vat, { showSymbol: false }) : '—'}</td>
                    <td className="px-3 py-2 text-right font-medium text-foreground">{formatNPR(r.total, { showSymbol: false })}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-foreground/20 bg-muted/30">
                  <td colSpan={4} className="px-3 py-2 font-semibold text-foreground">Total ({filtered.length} invoices)</td>
                  <td className="px-3 py-2 text-right font-semibold text-foreground">{formatNPR(filteredTotals.sub_total, { showSymbol: false })}</td>
                  <td className="px-3 py-2 text-right font-semibold text-muted-foreground">{formatNPR(filteredTotals.discount, { showSymbol: false })}</td>
                  <td className="px-3 py-2 text-right font-semibold text-foreground">{formatNPR(filteredTotals.taxable, { showSymbol: false })}</td>
                  <td className="px-3 py-2 text-right font-semibold text-muted-foreground">{formatNPR(filteredTotals.vat, { showSymbol: false })}</td>
                  <td className="px-3 py-2 text-right font-bold text-foreground">{formatNPR(filteredTotals.total, { showSymbol: false })}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function VATReport({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data, isLoading } = useVATSummary(dateFrom, dateTo);

  const handleExport = () => {
    if (!data?.length) return;
    const headers = ['VAT Period', 'Sales Taxable', 'Sales VAT', 'Purchase Taxable', 'Purchase VAT', 'Net VAT'];
    const rows = data.map((r) => [r.period, String(r.sales_taxable), String(r.sales_vat), String(r.purchase_taxable), String(r.purchase_vat), String(r.net_vat)]);
    exportCSV(headers, rows, `vat-summary-${dateFrom}-${dateTo}.csv`);
  };

  const totals = useMemo(() => {
    if (!data) return { sales_taxable: 0, sales_vat: 0, purchase_taxable: 0, purchase_vat: 0, net_vat: 0 };
    return data.reduce(
      (acc, r) => ({
        sales_taxable: acc.sales_taxable + r.sales_taxable,
        sales_vat: acc.sales_vat + r.sales_vat,
        purchase_taxable: acc.purchase_taxable + r.purchase_taxable,
        purchase_vat: acc.purchase_vat + r.purchase_vat,
        net_vat: acc.net_vat + r.net_vat,
      }),
      { sales_taxable: 0, sales_vat: 0, purchase_taxable: 0, purchase_vat: 0, net_vat: 0 }
    );
  }, [data]);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={handleExport} disabled={!data?.length}>
          <Download className="h-3 w-3" /> Export CSV
        </Button>
      </div>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : !data?.length ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No VAT invoices in this period.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">VAT Period</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Sales Taxable</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Sales VAT</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Purchase Taxable</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Purchase VAT</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Net VAT</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r) => (
                  <tr key={r.period} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-medium text-foreground">{r.period}</td>
                    <td className="px-3 py-2 text-right text-foreground">{formatNPR(r.sales_taxable, { showSymbol: false })}</td>
                    <td className="px-3 py-2 text-right text-foreground">{formatNPR(r.sales_vat, { showSymbol: false })}</td>
                    <td className="px-3 py-2 text-right text-foreground">{formatNPR(r.purchase_taxable, { showSymbol: false })}</td>
                    <td className="px-3 py-2 text-right text-foreground">{formatNPR(r.purchase_vat, { showSymbol: false })}</td>
                    <td className={`px-3 py-2 text-right font-medium ${r.net_vat >= 0 ? 'text-destructive' : 'text-success'}`}>
                      {formatNPR(r.net_vat, { showSymbol: false })}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-foreground/20 bg-muted/30">
                  <td className="px-3 py-2 font-semibold text-foreground">Total</td>
                  <td className="px-3 py-2 text-right font-semibold text-foreground">{formatNPR(totals.sales_taxable, { showSymbol: false })}</td>
                  <td className="px-3 py-2 text-right font-semibold text-foreground">{formatNPR(totals.sales_vat, { showSymbol: false })}</td>
                  <td className="px-3 py-2 text-right font-semibold text-foreground">{formatNPR(totals.purchase_taxable, { showSymbol: false })}</td>
                  <td className="px-3 py-2 text-right font-semibold text-foreground">{formatNPR(totals.purchase_vat, { showSymbol: false })}</td>
                  <td className={`px-3 py-2 text-right font-bold ${totals.net_vat >= 0 ? 'text-destructive' : 'text-success'}`}>
                    {formatNPR(totals.net_vat, { showSymbol: false })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function PartyLedgerReport({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data: parties = [] } = useParties();
  const [selectedParty, setSelectedParty] = useState<string>('');
  const { data, isLoading } = usePartyLedger(selectedParty || undefined, dateFrom, dateTo);

  const handleExport = () => {
    if (!data?.entries.length) return;
    const partyName = parties.find((p) => p.id === selectedParty)?.name || 'party';
    const headers = ['Date (BS)', 'Time', 'Description', 'Debit', 'Credit', 'Balance'];
    const rows = data.entries.map((e) => [e.date_bs, e.time, e.description, String(e.debit), String(e.credit), String(e.balance)]);
    exportCSV(headers, rows, `ledger-${partyName}-${dateFrom}-${dateTo}.csv`);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-3">
        <div className="w-64">
          <Label className="text-xs">Select Party</Label>
          <Select value={selectedParty} onValueChange={setSelectedParty}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Choose party..." /></SelectTrigger>
            <SelectContent>
              {parties.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} <span className="text-muted-foreground ml-1 capitalize">({p.type})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {data?.entries.length ? (
          <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={handleExport}>
            <Download className="h-3 w-3" /> Export CSV
          </Button>
        ) : null}
      </div>

      {!selectedParty ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Select a party to view their ledger.
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : !data?.entries.length ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No transactions in this period.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                     <th className="px-3 py-2 text-left font-medium text-muted-foreground">Date (BS)</th>
                     <th className="px-3 py-2 text-left font-medium text-muted-foreground">Time</th>
                     <th className="px-3 py-2 text-left font-medium text-muted-foreground">Description</th>
                     <th className="px-3 py-2 text-right font-medium text-muted-foreground">Debit</th>
                     <th className="px-3 py-2 text-right font-medium text-muted-foreground">Credit</th>
                     <th className="px-3 py-2 text-right font-medium text-muted-foreground">Balance</th>
                   </tr>
                 </thead>
                 <tbody>
                   {data.entries.map((e, i) => (
                     <tr key={i} className="border-b border-border last:border-0">
                       <td className="px-3 py-2 text-muted-foreground">{e.date_bs}</td>
                       <td className="px-3 py-2 text-muted-foreground text-[11px]">{e.time}</td>
                       <td className="px-3 py-2 text-foreground">{e.description}</td>
                       <td className="px-3 py-2 text-right text-foreground">{e.debit > 0 ? formatNPR(e.debit, { showSymbol: false }) : '—'}</td>
                       <td className="px-3 py-2 text-right text-foreground">{e.credit > 0 ? formatNPR(e.credit, { showSymbol: false }) : '—'}</td>
                       <td className={`px-3 py-2 text-right font-medium ${e.balance >= 0 ? 'text-foreground' : 'text-success'}`}>
                         {formatNPR(Math.abs(e.balance), { showSymbol: false })} {e.balance < 0 ? 'Cr' : 'Dr'}
                       </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-foreground/20 bg-muted/30">
                   <td colSpan={5} className="px-3 py-2 font-semibold text-foreground">Closing Balance</td>
                    <td className={`px-3 py-2 text-right font-bold ${data.closingBalance >= 0 ? 'text-foreground' : 'text-success'}`}>
                      {formatNPR(Math.abs(data.closingBalance), { showSymbol: false })} {data.closingBalance < 0 ? 'Cr' : 'Dr'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
