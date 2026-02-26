import { useState, useMemo } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import {
  useSalesReport, useVATSummary, useProfitLoss, useBillWiseProfit,
  useCashFlow, usePartyStatement, useSalePurchaseByParty, useStockSummary, useAllParties,
} from '@/hooks/useReports';
import { formatNPR } from '@/lib/nepal-format';
import { nepalNow, formatLocalDate } from '@/lib/nepal-date';

function getDefaultDateRange() {
  const now = nepalNow();
  const from = formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1));
  const to = formatLocalDate(now);
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

// Reusable table wrapper
function ReportTable({ children, loading, empty }: { children: React.ReactNode; loading: boolean; empty: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {loading ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
      ) : empty ? (
        <div className="p-8 text-center text-sm text-muted-foreground">No data found for this period.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">{children}</table>
        </div>
      )}
    </div>
  );
}

function ExportButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <Button variant="outline" size="sm" className="ml-auto gap-1 text-xs" onClick={onClick} disabled={disabled}>
      <Download className="h-3 w-3" /> Export CSV
    </Button>
  );
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
        <TabsList className="h-auto flex-wrap gap-1">
          <TabsTrigger value="sales" className="text-xs px-3">Sales / Purchase</TabsTrigger>
          <TabsTrigger value="vat" className="text-xs px-3">VAT Summary</TabsTrigger>
          <TabsTrigger value="pnl" className="text-xs px-3">Profit & Loss</TabsTrigger>
          <TabsTrigger value="bill-profit" className="text-xs px-3">Bill-wise Profit</TabsTrigger>
          <TabsTrigger value="cashflow" className="text-xs px-3">Cash Flow</TabsTrigger>
          <TabsTrigger value="party-stmt" className="text-xs px-3">Party Statement</TabsTrigger>
          <TabsTrigger value="sp-party" className="text-xs px-3">Sale/Purchase by Party</TabsTrigger>
          <TabsTrigger value="stock" className="text-xs px-3">Stock Summary</TabsTrigger>
          <TabsTrigger value="all-parties" className="text-xs px-3">All Parties</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="mt-4"><SalesReport dateFrom={dateFrom} dateTo={dateTo} /></TabsContent>
        <TabsContent value="vat" className="mt-4"><VATReport dateFrom={dateFrom} dateTo={dateTo} /></TabsContent>
        <TabsContent value="pnl" className="mt-4"><PnLReport dateFrom={dateFrom} dateTo={dateTo} /></TabsContent>
        <TabsContent value="bill-profit" className="mt-4"><BillProfitReport dateFrom={dateFrom} dateTo={dateTo} /></TabsContent>
        <TabsContent value="cashflow" className="mt-4"><CashFlowReport dateFrom={dateFrom} dateTo={dateTo} /></TabsContent>
        <TabsContent value="party-stmt" className="mt-4"><PartyStatementReport dateFrom={dateFrom} dateTo={dateTo} /></TabsContent>
        <TabsContent value="sp-party" className="mt-4"><SalePurchaseByPartyReport dateFrom={dateFrom} dateTo={dateTo} /></TabsContent>
        <TabsContent value="stock" className="mt-4"><StockSummaryReport /></TabsContent>
        <TabsContent value="all-parties" className="mt-4"><AllPartiesReport /></TabsContent>
      </Tabs>
    </div>
  );
}

// ───────── Sales / Purchase ─────────
function SalesReport({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const [typeFilter, setTypeFilter] = useState<'all' | 'sale' | 'purchase'>('all');
  const { data, isLoading } = useSalesReport(dateFrom, dateTo);
  const filtered = useMemo(() => {
    if (!data) return [];
    return typeFilter === 'all' ? data.rows : data.rows.filter((r) => r.type === typeFilter);
  }, [data, typeFilter]);
  const totals = useMemo(() => filtered.reduce((a, r) => ({ sub_total: a.sub_total + r.sub_total, discount: a.discount + r.discount, taxable: a.taxable + r.taxable, vat: a.vat + r.vat, total: a.total + r.total }), { sub_total: 0, discount: 0, taxable: 0, vat: 0, total: 0 }), [filtered]);
  const handleExport = () => exportCSV(['Date (BS)', 'Invoice #', 'Party', 'Type', 'Sub Total', 'Discount', 'Taxable', 'VAT', 'Total'], filtered.map(r => [r.date_bs, r.invoice_number, r.party_name, r.type, String(r.sub_total), String(r.discount), String(r.taxable), String(r.vat), String(r.total)]), `sales-report-${dateFrom}-${dateTo}.csv`);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Tabs value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
          <TabsList className="h-7"><TabsTrigger value="all" className="text-[11px] px-2">All</TabsTrigger><TabsTrigger value="sale" className="text-[11px] px-2">Sales</TabsTrigger><TabsTrigger value="purchase" className="text-[11px] px-2">Purchases</TabsTrigger></TabsList>
        </Tabs>
        <ExportButton onClick={handleExport} disabled={!filtered.length} />
      </div>
      <ReportTable loading={isLoading} empty={filtered.length === 0}>
        <thead><tr className="border-b border-border bg-muted/50">
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Date</th>
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Invoice #</th>
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Party</th>
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Type</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Sub Total</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Discount</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Taxable</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">VAT</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Total</th>
        </tr></thead>
        <tbody>{filtered.map((r, i) => (
          <tr key={i} className="border-b border-border last:border-0">
            <td className="px-3 py-2 text-muted-foreground">{r.date_bs}</td>
            <td className="px-3 py-2 font-medium text-foreground">{r.invoice_number}</td>
            <td className="px-3 py-2 text-foreground">{r.party_name}</td>
            <td className="px-3 py-2"><span className={`text-[11px] font-medium ${r.type === 'sale' ? 'text-green-600 dark:text-green-400' : 'text-primary'}`}>{r.type === 'sale' ? 'Sale' : 'Purchase'}</span></td>
            <td className="px-3 py-2 text-right text-foreground">{formatNPR(r.sub_total, { showSymbol: false })}</td>
            <td className="px-3 py-2 text-right text-muted-foreground">{r.discount > 0 ? formatNPR(r.discount, { showSymbol: false }) : '—'}</td>
            <td className="px-3 py-2 text-right text-foreground">{formatNPR(r.taxable, { showSymbol: false })}</td>
            <td className="px-3 py-2 text-right text-muted-foreground">{r.vat > 0 ? formatNPR(r.vat, { showSymbol: false }) : '—'}</td>
            <td className="px-3 py-2 text-right font-medium text-foreground">{formatNPR(r.total, { showSymbol: false })}</td>
          </tr>
        ))}</tbody>
        <tfoot><tr className="border-t-2 border-foreground/20 bg-muted/30">
          <td colSpan={4} className="px-3 py-2 font-semibold text-foreground">Total ({filtered.length})</td>
          <td className="px-3 py-2 text-right font-semibold text-foreground">{formatNPR(totals.sub_total, { showSymbol: false })}</td>
          <td className="px-3 py-2 text-right font-semibold text-muted-foreground">{formatNPR(totals.discount, { showSymbol: false })}</td>
          <td className="px-3 py-2 text-right font-semibold text-foreground">{formatNPR(totals.taxable, { showSymbol: false })}</td>
          <td className="px-3 py-2 text-right font-semibold text-muted-foreground">{formatNPR(totals.vat, { showSymbol: false })}</td>
          <td className="px-3 py-2 text-right font-bold text-foreground">{formatNPR(totals.total, { showSymbol: false })}</td>
        </tr></tfoot>
      </ReportTable>
    </div>
  );
}

// ───────── VAT Summary ─────────
function VATReport({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data, isLoading } = useVATSummary(dateFrom, dateTo);
  const totals = useMemo(() => {
    if (!data) return { sales_taxable: 0, sales_vat: 0, purchase_taxable: 0, purchase_vat: 0, net_vat: 0 };
    return data.reduce((a, r) => ({ sales_taxable: a.sales_taxable + r.sales_taxable, sales_vat: a.sales_vat + r.sales_vat, purchase_taxable: a.purchase_taxable + r.purchase_taxable, purchase_vat: a.purchase_vat + r.purchase_vat, net_vat: a.net_vat + r.net_vat }), { sales_taxable: 0, sales_vat: 0, purchase_taxable: 0, purchase_vat: 0, net_vat: 0 });
  }, [data]);
  const handleExport = () => { if (!data?.length) return; exportCSV(['VAT Period', 'Sales Taxable', 'Sales VAT', 'Purchase Taxable', 'Purchase VAT', 'Net VAT'], data.map(r => [r.period, String(r.sales_taxable), String(r.sales_vat), String(r.purchase_taxable), String(r.purchase_vat), String(r.net_vat)]), `vat-summary-${dateFrom}-${dateTo}.csv`); };

  return (
    <div className="space-y-3">
      <div className="flex justify-end"><ExportButton onClick={handleExport} disabled={!data?.length} /></div>
      <ReportTable loading={isLoading} empty={!data?.length}>
        <thead><tr className="border-b border-border bg-muted/50">
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">VAT Period</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Sales Taxable</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Sales VAT</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Purchase Taxable</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Purchase VAT</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Net VAT</th>
        </tr></thead>
        <tbody>{(data || []).map(r => (
          <tr key={r.period} className="border-b border-border last:border-0">
            <td className="px-3 py-2 font-medium text-foreground">{r.period}</td>
            <td className="px-3 py-2 text-right text-foreground">{formatNPR(r.sales_taxable, { showSymbol: false })}</td>
            <td className="px-3 py-2 text-right text-foreground">{formatNPR(r.sales_vat, { showSymbol: false })}</td>
            <td className="px-3 py-2 text-right text-foreground">{formatNPR(r.purchase_taxable, { showSymbol: false })}</td>
            <td className="px-3 py-2 text-right text-foreground">{formatNPR(r.purchase_vat, { showSymbol: false })}</td>
            <td className={`px-3 py-2 text-right font-medium ${r.net_vat >= 0 ? 'text-destructive' : 'text-green-600 dark:text-green-400'}`}>{formatNPR(r.net_vat, { showSymbol: false })}</td>
          </tr>
        ))}</tbody>
        <tfoot><tr className="border-t-2 border-foreground/20 bg-muted/30">
          <td className="px-3 py-2 font-semibold text-foreground">Total</td>
          <td className="px-3 py-2 text-right font-semibold text-foreground">{formatNPR(totals.sales_taxable, { showSymbol: false })}</td>
          <td className="px-3 py-2 text-right font-semibold text-foreground">{formatNPR(totals.sales_vat, { showSymbol: false })}</td>
          <td className="px-3 py-2 text-right font-semibold text-foreground">{formatNPR(totals.purchase_taxable, { showSymbol: false })}</td>
          <td className="px-3 py-2 text-right font-semibold text-foreground">{formatNPR(totals.purchase_vat, { showSymbol: false })}</td>
          <td className={`px-3 py-2 text-right font-bold ${totals.net_vat >= 0 ? 'text-destructive' : 'text-green-600 dark:text-green-400'}`}>{formatNPR(totals.net_vat, { showSymbol: false })}</td>
        </tr></tfoot>
      </ReportTable>
    </div>
  );
}

// ───────── Profit & Loss ─────────
function PnLReport({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data, isLoading } = useProfitLoss(dateFrom, dateTo);

  if (isLoading) return <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">Loading…</div>;
  if (!data) return <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">No data.</div>;

  const rows = [
    { label: 'Total Sales Revenue', value: data.totalSales, bold: true },
    { label: 'Less: Cost of Goods Sold (COGS)', value: -data.totalCOGS },
    { label: 'Gross Profit', value: data.grossProfit, bold: true, highlight: true },
    { label: 'Total Purchases', value: data.totalPurchases, info: true },
    { label: 'Sales Discount Given', value: data.totalSalesDiscount, info: true },
    { label: 'Sales VAT Collected', value: data.totalSalesVAT, info: true },
    { label: 'Purchase VAT Paid', value: data.totalPurchaseVAT, info: true },
    { label: 'Net Profit', value: data.netProfit, bold: true, highlight: true },
  ];

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden max-w-lg">
      <table className="w-full text-sm">
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={`border-b border-border last:border-0 ${r.highlight ? 'bg-muted/30' : ''}`}>
              <td className={`px-4 py-3 ${r.bold ? 'font-semibold' : ''} ${r.info ? 'text-muted-foreground pl-8' : 'text-foreground'}`}>{r.label}</td>
              <td className={`px-4 py-3 text-right ${r.bold ? 'font-semibold' : ''} ${r.value < 0 ? 'text-destructive' : 'text-foreground'}`}>
                {formatNPR(Math.abs(r.value))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ───────── Bill-wise Profit ─────────
function BillProfitReport({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data, isLoading } = useBillWiseProfit(dateFrom, dateTo);
  const handleExport = () => { if (!data?.rows.length) return; exportCSV(['Date', 'Invoice #', 'Party', 'Sale Amt', 'Cost', 'Profit', 'Margin %'], data.rows.map(r => [r.date_bs, r.invoice_number, r.party_name, String(r.sale_amount), String(r.cost_amount), String(r.profit), r.margin_pct.toFixed(1)]), `bill-profit-${dateFrom}-${dateTo}.csv`); };

  return (
    <div className="space-y-3">
      <div className="flex justify-end"><ExportButton onClick={handleExport} disabled={!data?.rows.length} /></div>
      <ReportTable loading={isLoading} empty={!data?.rows.length}>
        <thead><tr className="border-b border-border bg-muted/50">
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Date</th>
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Invoice #</th>
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Party</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Sale Amt</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Cost</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Profit</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Margin %</th>
        </tr></thead>
        <tbody>{(data?.rows || []).map((r, i) => (
          <tr key={i} className="border-b border-border last:border-0">
            <td className="px-3 py-2 text-muted-foreground">{r.date_bs}</td>
            <td className="px-3 py-2 font-medium text-foreground">{r.invoice_number}</td>
            <td className="px-3 py-2 text-foreground">{r.party_name}</td>
            <td className="px-3 py-2 text-right text-foreground">{formatNPR(r.sale_amount, { showSymbol: false })}</td>
            <td className="px-3 py-2 text-right text-muted-foreground">{formatNPR(r.cost_amount, { showSymbol: false })}</td>
            <td className={`px-3 py-2 text-right font-medium ${r.profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>{formatNPR(r.profit, { showSymbol: false })}</td>
            <td className="px-3 py-2 text-right text-muted-foreground">{r.margin_pct.toFixed(1)}%</td>
          </tr>
        ))}</tbody>
        {data?.totals && <tfoot><tr className="border-t-2 border-foreground/20 bg-muted/30">
          <td colSpan={3} className="px-3 py-2 font-semibold text-foreground">Total ({data.rows.length} invoices)</td>
          <td className="px-3 py-2 text-right font-semibold text-foreground">{formatNPR(data.totals.sale_amount, { showSymbol: false })}</td>
          <td className="px-3 py-2 text-right font-semibold text-muted-foreground">{formatNPR(data.totals.cost_amount, { showSymbol: false })}</td>
          <td className={`px-3 py-2 text-right font-bold ${data.totals.profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>{formatNPR(data.totals.profit, { showSymbol: false })}</td>
          <td className="px-3 py-2 text-right text-muted-foreground">{data.totals.sale_amount > 0 ? ((data.totals.profit / data.totals.sale_amount) * 100).toFixed(1) : '0.0'}%</td>
        </tr></tfoot>}
      </ReportTable>
    </div>
  );
}

// ───────── Cash Flow ─────────
function CashFlowReport({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data, isLoading } = useCashFlow(dateFrom, dateTo);
  const handleExport = () => { if (!data?.rows.length) return; exportCSV(['Date', 'Description', 'Method', 'Inflow', 'Outflow'], data.rows.map(r => [r.date_bs, r.description, r.method, String(r.inflow), String(r.outflow)]), `cashflow-${dateFrom}-${dateTo}.csv`); };

  return (
    <div className="space-y-3">
      {data && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="text-xs text-muted-foreground">Total Inflow</div>
            <div className="text-lg font-bold text-green-600 dark:text-green-400">{formatNPR(data.totals.inflow)}</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="text-xs text-muted-foreground">Total Outflow</div>
            <div className="text-lg font-bold text-destructive">{formatNPR(data.totals.outflow)}</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="text-xs text-muted-foreground">Net Cash Flow</div>
            <div className={`text-lg font-bold ${data.net >= 0 ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>{formatNPR(data.net)}</div>
          </div>
        </div>
      )}
      <div className="flex justify-end"><ExportButton onClick={handleExport} disabled={!data?.rows.length} /></div>
      <ReportTable loading={isLoading} empty={!data?.rows.length}>
        <thead><tr className="border-b border-border bg-muted/50">
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Date</th>
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Description</th>
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Method</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Inflow</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Outflow</th>
        </tr></thead>
        <tbody>{(data?.rows || []).map((r, i) => (
          <tr key={i} className="border-b border-border last:border-0">
            <td className="px-3 py-2 text-muted-foreground">{r.date_bs}</td>
            <td className="px-3 py-2 text-foreground">{r.description}</td>
            <td className="px-3 py-2 text-muted-foreground capitalize">{r.method}</td>
            <td className="px-3 py-2 text-right text-green-600 dark:text-green-400">{r.inflow > 0 ? formatNPR(r.inflow, { showSymbol: false }) : '—'}</td>
            <td className="px-3 py-2 text-right text-destructive">{r.outflow > 0 ? formatNPR(r.outflow, { showSymbol: false }) : '—'}</td>
          </tr>
        ))}</tbody>
      </ReportTable>
    </div>
  );
}

// ───────── Party Statement ─────────
function PartyStatementReport({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data, isLoading } = usePartyStatement(dateFrom, dateTo);
  const handleExport = () => { if (!data?.length) return; exportCSV(['Party', 'Type', 'Opening Bal', 'Invoiced', 'Paid', 'Closing Bal'], data.map(r => [r.party_name, r.party_type, String(r.opening_balance), String(r.total_invoiced), String(r.total_paid), String(r.closing_balance)]), `party-statement-${dateFrom}-${dateTo}.csv`); };

  return (
    <div className="space-y-3">
      <div className="flex justify-end"><ExportButton onClick={handleExport} disabled={!data?.length} /></div>
      <ReportTable loading={isLoading} empty={!data?.length}>
        <thead><tr className="border-b border-border bg-muted/50">
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Party</th>
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Type</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Opening Bal</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Invoiced</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Paid</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Closing Bal</th>
        </tr></thead>
        <tbody>{(data || []).map(r => (
          <tr key={r.party_id} className="border-b border-border last:border-0">
            <td className="px-3 py-2 font-medium text-foreground">{r.party_name}</td>
            <td className="px-3 py-2 text-muted-foreground capitalize">{r.party_type}</td>
            <td className="px-3 py-2 text-right text-foreground">{formatNPR(r.opening_balance, { showSymbol: false })}</td>
            <td className="px-3 py-2 text-right text-foreground">{formatNPR(r.total_invoiced, { showSymbol: false })}</td>
            <td className="px-3 py-2 text-right text-foreground">{formatNPR(r.total_paid, { showSymbol: false })}</td>
            <td className={`px-3 py-2 text-right font-medium ${r.closing_balance >= 0 ? 'text-foreground' : 'text-green-600 dark:text-green-400'}`}>
              {formatNPR(Math.abs(r.closing_balance), { showSymbol: false })} {r.closing_balance < 0 ? 'Cr' : 'Dr'}
            </td>
          </tr>
        ))}</tbody>
      </ReportTable>
    </div>
  );
}

// ───────── Sale/Purchase by Party ─────────
function SalePurchaseByPartyReport({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data, isLoading } = useSalePurchaseByParty(dateFrom, dateTo);
  const handleExport = () => { if (!data?.length) return; exportCSV(['Party', 'Type', 'Sales', 'Purchases', 'Total', 'Invoices'], data.map(r => [r.party_name, r.party_type, String(r.total_sales), String(r.total_purchases), String(r.total_amount), String(r.invoice_count)]), `sp-by-party-${dateFrom}-${dateTo}.csv`); };

  return (
    <div className="space-y-3">
      <div className="flex justify-end"><ExportButton onClick={handleExport} disabled={!data?.length} /></div>
      <ReportTable loading={isLoading} empty={!data?.length}>
        <thead><tr className="border-b border-border bg-muted/50">
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Party</th>
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Type</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Sales</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Purchases</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Total</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Invoices</th>
        </tr></thead>
        <tbody>{(data || []).map((r, i) => (
          <tr key={i} className="border-b border-border last:border-0">
            <td className="px-3 py-2 font-medium text-foreground">{r.party_name}</td>
            <td className="px-3 py-2 text-muted-foreground capitalize">{r.party_type}</td>
            <td className="px-3 py-2 text-right text-green-600 dark:text-green-400">{r.total_sales > 0 ? formatNPR(r.total_sales, { showSymbol: false }) : '—'}</td>
            <td className="px-3 py-2 text-right text-primary">{r.total_purchases > 0 ? formatNPR(r.total_purchases, { showSymbol: false }) : '—'}</td>
            <td className="px-3 py-2 text-right font-medium text-foreground">{formatNPR(r.total_amount, { showSymbol: false })}</td>
            <td className="px-3 py-2 text-right text-muted-foreground">{r.invoice_count}</td>
          </tr>
        ))}</tbody>
      </ReportTable>
    </div>
  );
}

// ───────── Stock Summary ─────────
function StockSummaryReport() {
  const { data, isLoading } = useStockSummary();
  const handleExport = () => { if (!data?.rows.length) return; exportCSV(['Item', 'Code', 'Unit', 'Opening', 'Current', 'Purchase Price', 'Sale Price', 'Stock Value'], data.rows.map(r => [r.item_name, r.code || '', r.unit, String(r.opening_stock), String(r.current_stock), String(r.purchase_price), String(r.sale_price), String(r.stock_value)]), 'stock-summary.csv'); };

  return (
    <div className="space-y-3">
      {data && <div className="rounded-lg border border-border bg-card p-3 inline-block">
        <span className="text-xs text-muted-foreground">Total Stock Value: </span>
        <span className="font-bold text-foreground">{formatNPR(data.totalValue)}</span>
      </div>}
      <div className="flex justify-end"><ExportButton onClick={handleExport} disabled={!data?.rows.length} /></div>
      <ReportTable loading={isLoading} empty={!data?.rows.length}>
        <thead><tr className="border-b border-border bg-muted/50">
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Item</th>
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Code</th>
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Unit</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Opening</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Current</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Purchase ₨</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Sale ₨</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Stock Value</th>
        </tr></thead>
        <tbody>{(data?.rows || []).map((r, i) => (
          <tr key={i} className="border-b border-border last:border-0">
            <td className="px-3 py-2 font-medium text-foreground">{r.item_name}</td>
            <td className="px-3 py-2 text-muted-foreground">{r.code || '—'}</td>
            <td className="px-3 py-2 text-muted-foreground">{r.unit}</td>
            <td className="px-3 py-2 text-right text-foreground">{r.opening_stock}</td>
            <td className={`px-3 py-2 text-right font-medium ${r.current_stock <= 0 ? 'text-destructive' : 'text-foreground'}`}>{r.current_stock}</td>
            <td className="px-3 py-2 text-right text-foreground">{formatNPR(r.purchase_price, { showSymbol: false })}</td>
            <td className="px-3 py-2 text-right text-foreground">{formatNPR(r.sale_price, { showSymbol: false })}</td>
            <td className="px-3 py-2 text-right font-medium text-foreground">{formatNPR(r.stock_value, { showSymbol: false })}</td>
          </tr>
        ))}</tbody>
      </ReportTable>
    </div>
  );
}

// ───────── All Parties ─────────
function AllPartiesReport() {
  const { data, isLoading } = useAllParties();
  const [typeFilter, setTypeFilter] = useState<'all' | 'customer' | 'vendor' | 'both'>('all');
  const filtered = useMemo(() => {
    if (!data) return [];
    return typeFilter === 'all' ? data : data.filter(p => p.type === typeFilter);
  }, [data, typeFilter]);
  const handleExport = () => { if (!filtered.length) return; exportCSV(['Name', 'Type', 'Phone', 'City', 'Opening Balance', 'Active'], filtered.map(r => [r.name, r.type, r.phone || '', r.city || '', String(r.opening_balance), r.is_active ? 'Yes' : 'No']), 'all-parties.csv'); };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Tabs value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
          <TabsList className="h-7">
            <TabsTrigger value="all" className="text-[11px] px-2">All</TabsTrigger>
            <TabsTrigger value="customer" className="text-[11px] px-2">Customers</TabsTrigger>
            <TabsTrigger value="vendor" className="text-[11px] px-2">Vendors</TabsTrigger>
            <TabsTrigger value="both" className="text-[11px] px-2">Both</TabsTrigger>
          </TabsList>
        </Tabs>
        <ExportButton onClick={handleExport} disabled={!filtered.length} />
      </div>
      <ReportTable loading={isLoading} empty={!filtered.length}>
        <thead><tr className="border-b border-border bg-muted/50">
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Name</th>
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Type</th>
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Phone</th>
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">City</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Opening Bal</th>
          <th className="px-3 py-2 text-center font-medium text-muted-foreground">Active</th>
        </tr></thead>
        <tbody>{filtered.map(r => (
          <tr key={r.id} className="border-b border-border last:border-0">
            <td className="px-3 py-2 font-medium text-foreground">{r.name}</td>
            <td className="px-3 py-2 text-muted-foreground capitalize">{r.type}</td>
            <td className="px-3 py-2 text-foreground">{r.phone || '—'}</td>
            <td className="px-3 py-2 text-foreground">{r.city || '—'}</td>
            <td className="px-3 py-2 text-right text-foreground">{formatNPR(r.opening_balance, { showSymbol: false })}</td>
            <td className="px-3 py-2 text-center">{r.is_active ? <span className="text-green-600 dark:text-green-400 text-[11px] font-medium">Active</span> : <span className="text-muted-foreground text-[11px]">Inactive</span>}</td>
          </tr>
        ))}</tbody>
      </ReportTable>
    </div>
  );
}
