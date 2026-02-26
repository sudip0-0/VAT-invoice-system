import { useState, useMemo } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Download, AlertTriangle, ChevronRight } from 'lucide-react';
import {
  useSalesReport, useVATSummary, useProfitLoss, useBillWiseProfit,
  useCashFlow, usePartyStatement, useSalePurchaseByParty, useStockSummary, useAllParties,
} from '@/hooks/useReports';
import {
  useItemWiseSalesPurchase, useLowStockAlert, useDayBook, useCNDNRegister,
  useOutstandingReport, useVATReturnSummary, useDailySummary,
} from '@/hooks/useReportsExtra';
import {
  useTrialBalance, useBalanceSheetSummary, useTopSellingItems, useVATAnnex,
} from '@/hooks/useReportsExtra2';
import {
  usePartyReportByItem, useItemReportByParty, useItemWiseProfit,
} from '@/hooks/useReportsExtra3';
import { formatNPR } from '@/lib/nepal-format';
import { nepalNow, formatLocalDate } from '@/lib/nepal-date';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend, Cell,
} from 'recharts';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';

function getDefaultDateRange() {
  const now = nepalNow();
  const from = formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1));
  const to = formatLocalDate(now);
  return { from, to };
}

type PresetKey = 'today' | 'this-week' | 'this-month' | 'last-month' | 'last-quarter' | 'this-fy';

function getPresetRange(key: PresetKey): { from: string; to: string } {
  const now = nepalNow();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  switch (key) {
    case 'today':
      return { from: formatLocalDate(now), to: formatLocalDate(now) };
    case 'this-week': {
      const day = now.getDay();
      const startOfWeek = new Date(y, m, d - day);
      return { from: formatLocalDate(startOfWeek), to: formatLocalDate(now) };
    }
    case 'this-month':
      return { from: formatLocalDate(new Date(y, m, 1)), to: formatLocalDate(now) };
    case 'last-month': {
      const firstLastMonth = new Date(y, m - 1, 1);
      const lastLastMonth = new Date(y, m, 0);
      return { from: formatLocalDate(firstLastMonth), to: formatLocalDate(lastLastMonth) };
    }
    case 'last-quarter': {
      const qStart = Math.floor(m / 3) * 3;
      const lastQStart = new Date(y, qStart - 3, 1);
      const lastQEnd = new Date(y, qStart, 0);
      return { from: formatLocalDate(lastQStart), to: formatLocalDate(lastQEnd) };
    }
    case 'this-fy': {
      const fyStartYear = m < 6 || (m === 6 && d < 16) ? y - 1 : y;
      return { from: `${fyStartYear}-07-16`, to: formatLocalDate(now) };
    }
    default:
      return getDefaultDateRange();
  }
}

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'this-week', label: 'This Week' },
  { key: 'this-month', label: 'This Month' },
  { key: 'last-month', label: 'Last Month' },
  { key: 'last-quarter', label: 'Last Quarter' },
  { key: 'this-fy', label: 'This FY' },
];

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

// ── Report categories & navigation ──

interface ReportItem {
  key: string;
  label: string;
}

interface ReportCategory {
  id: string;
  label: string;
  reports: ReportItem[];
}

const REPORT_CATEGORIES: ReportCategory[] = [
  {
    id: 'sales',
    label: '📊 Sales & Purchase',
    reports: [
      { key: 'sales', label: 'Sales / Purchase' },
      { key: 'item-wise', label: 'Item-wise S/P' },
      { key: 'sp-party', label: 'S/P by Party' },
      { key: 'party-by-item', label: 'Party Report by Item' },
      { key: 'item-by-party', label: 'Item Report by Party' },
      { key: 'top-selling', label: 'Top Selling Items' },
    ],
  },
  {
    id: 'profit',
    label: '💰 Profit & Analysis',
    reports: [
      { key: 'pnl', label: 'Profit & Loss' },
      { key: 'bill-profit', label: 'Bill-wise Profit' },
      { key: 'item-profit', label: 'Item-wise Profit' },
    ],
  },
  {
    id: 'financial',
    label: '🏦 Financial',
    reports: [
      { key: 'trial-balance', label: 'Trial Balance' },
      { key: 'balance-sheet', label: 'Balance Sheet' },
      { key: 'cashflow', label: 'Cash Flow' },
      { key: 'daybook', label: 'Day Book' },
      { key: 'daily-summary', label: 'Daily Summary' },
    ],
  },
  {
    id: 'party',
    label: '👥 Party & Outstanding',
    reports: [
      { key: 'party-stmt', label: 'Party Statement' },
      { key: 'outstanding', label: 'Outstanding' },
      { key: 'all-parties', label: 'All Parties' },
      { key: 'cndn', label: 'CN / DN Register' },
    ],
  },
  {
    id: 'tax',
    label: '🧾 Tax & Compliance',
    reports: [
      { key: 'vat', label: 'VAT Summary' },
      { key: 'vat-return', label: 'VAT Return' },
      { key: 'vat-annex', label: 'VAT Annex' },
    ],
  },
  {
    id: 'inventory',
    label: '📦 Inventory',
    reports: [
      { key: 'stock', label: 'Stock Summary' },
      { key: 'low-stock', label: 'Low Stock Alert' },
    ],
  },
];

export default function ReportsPage() {
  const defaults = getDefaultDateRange();
  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo, setDateTo] = useState(defaults.to);
  const [activePreset, setActivePreset] = useState<PresetKey | null>('this-month');
  const [activeReport, setActiveReport] = useState('sales');

  const applyPreset = (key: PresetKey) => {
    const range = getPresetRange(key);
    setDateFrom(range.from);
    setDateTo(range.to);
    setActivePreset(key);
  };

  const handleDateChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value);
    setActivePreset(null);
  };

  // Find active category for default accordion open
  const activeCategoryId = REPORT_CATEGORIES.find(c => c.reports.some(r => r.key === activeReport))?.id || 'sales';

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Reports</h1>
      </div>

      {/* Date controls */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <Button
              key={p.key}
              variant={activePreset === p.key ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-[11px] px-2.5"
              onClick={() => applyPreset(p.key)}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <div>
          <Label className="text-xs">From</Label>
          <Input type="date" value={dateFrom} onChange={handleDateChange(setDateFrom)} className="h-9 text-sm w-40" />
        </div>
        <div>
          <Label className="text-xs">To</Label>
          <Input type="date" value={dateTo} onChange={handleDateChange(setDateTo)} className="h-9 text-sm w-40" />
        </div>
      </div>

      {/* Layout: sidebar + content */}
      <div className="flex gap-4 min-h-[500px]">
        {/* Sidebar */}
        <div className="w-56 shrink-0 hidden md:block">
          <div className="rounded-lg border border-border bg-card overflow-hidden sticky top-4">
            <Accordion type="multiple" defaultValue={[activeCategoryId]}>
              {REPORT_CATEGORIES.map((cat) => (
                <AccordionItem key={cat.id} value={cat.id} className="border-b last:border-0">
                  <AccordionTrigger className="px-3 py-2.5 text-xs font-semibold text-foreground hover:no-underline">
                    {cat.label}
                  </AccordionTrigger>
                  <AccordionContent className="pb-1">
                    <div className="flex flex-col">
                      {cat.reports.map((r) => (
                        <button
                          key={r.key}
                          onClick={() => setActiveReport(r.key)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs text-left transition-colors ${
                            activeReport === r.key
                              ? 'bg-primary/10 text-primary font-medium border-l-2 border-primary'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                          }`}
                        >
                          <ChevronRight className={`h-3 w-3 shrink-0 ${activeReport === r.key ? 'opacity-100' : 'opacity-0'}`} />
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>

        {/* Mobile: dropdown-style tabs */}
        <div className="md:hidden w-full mb-3">
          <select
            value={activeReport}
            onChange={(e) => setActiveReport(e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            {REPORT_CATEGORIES.map(cat => (
              <optgroup key={cat.id} label={cat.label}>
                {cat.reports.map(r => (
                  <option key={r.key} value={r.key}>{r.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Report content */}
        <div className="flex-1 min-w-0">
          {activeReport === 'sales' && <SalesReport dateFrom={dateFrom} dateTo={dateTo} />}
          {activeReport === 'item-wise' && <ItemWiseReport dateFrom={dateFrom} dateTo={dateTo} />}
          {activeReport === 'vat' && <VATReport dateFrom={dateFrom} dateTo={dateTo} />}
          {activeReport === 'vat-return' && <VATReturnReport dateFrom={dateFrom} dateTo={dateTo} />}
          {activeReport === 'pnl' && <PnLReport dateFrom={dateFrom} dateTo={dateTo} />}
          {activeReport === 'bill-profit' && <BillProfitReport dateFrom={dateFrom} dateTo={dateTo} />}
          {activeReport === 'item-profit' && <ItemProfitReport dateFrom={dateFrom} dateTo={dateTo} />}
          {activeReport === 'cashflow' && <CashFlowReport dateFrom={dateFrom} dateTo={dateTo} />}
          {activeReport === 'daybook' && <DayBookReport dateFrom={dateFrom} dateTo={dateTo} />}
          {activeReport === 'daily-summary' && <DailySummaryReport dateFrom={dateFrom} dateTo={dateTo} />}
          {activeReport === 'outstanding' && <OutstandingReportView dateFrom={dateFrom} dateTo={dateTo} />}
          {activeReport === 'party-stmt' && <PartyStatementReport dateFrom={dateFrom} dateTo={dateTo} />}
          {activeReport === 'sp-party' && <SalePurchaseByPartyReport dateFrom={dateFrom} dateTo={dateTo} />}
          {activeReport === 'party-by-item' && <PartyByItemReport dateFrom={dateFrom} dateTo={dateTo} />}
          {activeReport === 'item-by-party' && <ItemByPartyReport dateFrom={dateFrom} dateTo={dateTo} />}
          {activeReport === 'cndn' && <CNDNRegisterReport dateFrom={dateFrom} dateTo={dateTo} />}
          {activeReport === 'stock' && <StockSummaryReport />}
          {activeReport === 'low-stock' && <LowStockAlertReport />}
          {activeReport === 'all-parties' && <AllPartiesReport />}
          {activeReport === 'trial-balance' && <TrialBalanceReport dateFrom={dateFrom} dateTo={dateTo} />}
          {activeReport === 'balance-sheet' && <BalanceSheetReport dateTo={dateTo} />}
          {activeReport === 'top-selling' && <TopSellingReport dateFrom={dateFrom} dateTo={dateTo} />}
          {activeReport === 'vat-annex' && <VATAnnexReport dateFrom={dateFrom} dateTo={dateTo} />}
        </div>
      </div>
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

  const chartData = [
    { name: 'Sales', value: data.totalSales },
    { name: 'COGS', value: data.totalCOGS },
    { name: 'Gross Profit', value: Math.max(0, data.grossProfit) },
    { name: 'Net Profit', value: Math.max(0, data.netProfit) },
  ];

  const barColors = ['hsl(var(--primary))', 'hsl(var(--destructive))', 'hsl(142, 71%, 45%)', 'hsl(142, 71%, 35%)'];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">P&L Overview</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} barSize={40}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <RechartsTooltip formatter={(value: number) => formatNPR(value)} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={barColors[i]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
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

// ───────── Item-wise Profit (NEW) ─────────
function ItemProfitReport({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data, isLoading } = useItemWiseProfit(dateFrom, dateTo);
  const handleExport = () => { if (!data?.rows.length) return; exportCSV(['Item', 'Code', 'Unit', 'Qty Sold', 'Sale Amt', 'Cost Amt', 'Profit', 'Margin %'], data.rows.map(r => [r.item_name, r.code || '', r.unit, String(r.qty_sold), String(r.sale_amount), String(r.cost_amount), String(r.profit), r.margin_pct.toFixed(1)]), `item-profit-${dateFrom}-${dateTo}.csv`); };

  return (
    <div className="space-y-3">
      {data?.totals && (
        <div className="flex gap-3 flex-wrap">
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="text-xs text-muted-foreground">Total Revenue</div>
            <div className="text-lg font-bold text-foreground">{formatNPR(data.totals.sale_amount)}</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="text-xs text-muted-foreground">Total Cost</div>
            <div className="text-lg font-bold text-muted-foreground">{formatNPR(data.totals.cost_amount)}</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="text-xs text-muted-foreground">Total Profit</div>
            <div className={`text-lg font-bold ${data.totals.profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>{formatNPR(data.totals.profit)}</div>
          </div>
        </div>
      )}
      <div className="flex justify-end"><ExportButton onClick={handleExport} disabled={!data?.rows.length} /></div>
      <ReportTable loading={isLoading} empty={!data?.rows.length}>
        <thead><tr className="border-b border-border bg-muted/50">
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Item</th>
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Code</th>
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Unit</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Qty Sold</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Sale Amt</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Cost Amt</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Profit</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Margin %</th>
        </tr></thead>
        <tbody>{(data?.rows || []).map((r, i) => (
          <tr key={i} className="border-b border-border last:border-0">
            <td className="px-3 py-2 font-medium text-foreground">{r.item_name}</td>
            <td className="px-3 py-2 text-muted-foreground">{r.code || '—'}</td>
            <td className="px-3 py-2 text-muted-foreground">{r.unit}</td>
            <td className="px-3 py-2 text-right text-foreground">{r.qty_sold}</td>
            <td className="px-3 py-2 text-right text-foreground">{formatNPR(r.sale_amount, { showSymbol: false })}</td>
            <td className="px-3 py-2 text-right text-muted-foreground">{formatNPR(r.cost_amount, { showSymbol: false })}</td>
            <td className={`px-3 py-2 text-right font-medium ${r.profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>{formatNPR(r.profit, { showSymbol: false })}</td>
            <td className="px-3 py-2 text-right text-muted-foreground">{r.margin_pct.toFixed(1)}%</td>
          </tr>
        ))}</tbody>
        {data?.totals && <tfoot><tr className="border-t-2 border-foreground/20 bg-muted/30">
          <td colSpan={3} className="px-3 py-2 font-semibold text-foreground">Total ({data.rows.length} items)</td>
          <td className="px-3 py-2 text-right font-semibold text-foreground">{data.totals.qty_sold}</td>
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

  const chartData = useMemo(() => {
    if (!data?.rows.length) return [];
    const map = new Map<string, { date_bs: string; inflow: number; outflow: number }>();
    for (const r of data.rows) {
      const existing = map.get(r.date_bs) || { date_bs: r.date_bs, inflow: 0, outflow: 0 };
      existing.inflow += r.inflow;
      existing.outflow += r.outflow;
      map.set(r.date_bs, existing);
    }
    return Array.from(map.values());
  }, [data]);

  return (
    <div className="space-y-4">
      {chartData.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Inflow vs Outflow Trend</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date_bs" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} angle={-35} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <RechartsTooltip formatter={(value: number) => formatNPR(value)} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="inflow" name="Inflow" fill="hsl(142, 71%, 45%)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="outflow" name="Outflow" fill="hsl(var(--destructive))" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
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

// ───────── Party Report by Item (NEW) ─────────
function PartyByItemReport({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data, isLoading } = usePartyReportByItem(dateFrom, dateTo);
  const [expanded, setExpanded] = useState<string | null>(null);

  const handleExport = () => {
    if (!data?.length) return;
    const rows: string[][] = [];
    for (const p of data) {
      for (const it of p.items) {
        rows.push([p.party_name, p.party_type, it.item_name, it.code || '', it.unit, String(it.qty), String(it.amount)]);
      }
    }
    exportCSV(['Party', 'Type', 'Item', 'Code', 'Unit', 'Qty', 'Amount'], rows, `party-by-item-${dateFrom}-${dateTo}.csv`);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end"><ExportButton onClick={handleExport} disabled={!data?.length} /></div>
      <ReportTable loading={isLoading} empty={!data?.length}>
        <thead><tr className="border-b border-border bg-muted/50">
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Party</th>
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Type</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Items</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Total Amount</th>
        </tr></thead>
        <tbody>{(data || []).map((p, i) => (
          <>
            <tr key={`party-${i}`} className="border-b border-border cursor-pointer hover:bg-muted/30" onClick={() => setExpanded(expanded === p.party_name ? null : p.party_name)}>
              <td className="px-3 py-2 font-medium text-foreground">
                <span className="mr-1 text-muted-foreground">{expanded === p.party_name ? '▼' : '▶'}</span>
                {p.party_name}
              </td>
              <td className="px-3 py-2 text-muted-foreground capitalize">{p.party_type}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">{p.items.length}</td>
              <td className="px-3 py-2 text-right font-medium text-foreground">{formatNPR(p.total_amount, { showSymbol: false })}</td>
            </tr>
            {expanded === p.party_name && p.items.map((it, j) => (
              <tr key={`item-${i}-${j}`} className="border-b border-border bg-muted/20">
                <td className="px-3 py-1.5 pl-8 text-foreground">{it.item_name}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{it.code || '—'} · {it.unit}</td>
                <td className="px-3 py-1.5 text-right text-foreground">{it.qty}</td>
                <td className="px-3 py-1.5 text-right text-foreground">{formatNPR(it.amount, { showSymbol: false })}</td>
              </tr>
            ))}
          </>
        ))}</tbody>
      </ReportTable>
    </div>
  );
}

// ───────── Item Report by Party (NEW) ─────────
function ItemByPartyReport({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data, isLoading } = useItemReportByParty(dateFrom, dateTo);
  const [expanded, setExpanded] = useState<string | null>(null);

  const handleExport = () => {
    if (!data?.length) return;
    const rows: string[][] = [];
    for (const it of data) {
      for (const p of it.parties) {
        rows.push([it.item_name, it.code || '', it.unit, p.party_name, p.party_type, String(p.qty), String(p.amount)]);
      }
    }
    exportCSV(['Item', 'Code', 'Unit', 'Party', 'Type', 'Qty', 'Amount'], rows, `item-by-party-${dateFrom}-${dateTo}.csv`);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end"><ExportButton onClick={handleExport} disabled={!data?.length} /></div>
      <ReportTable loading={isLoading} empty={!data?.length}>
        <thead><tr className="border-b border-border bg-muted/50">
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Item</th>
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Code</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Total Qty</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Total Amount</th>
        </tr></thead>
        <tbody>{(data || []).map((it, i) => (
          <>
            <tr key={`item-${i}`} className="border-b border-border cursor-pointer hover:bg-muted/30" onClick={() => setExpanded(expanded === it.item_name ? null : it.item_name)}>
              <td className="px-3 py-2 font-medium text-foreground">
                <span className="mr-1 text-muted-foreground">{expanded === it.item_name ? '▼' : '▶'}</span>
                {it.item_name}
              </td>
              <td className="px-3 py-2 text-muted-foreground">{it.code || '—'} · {it.unit}</td>
              <td className="px-3 py-2 text-right text-foreground">{it.total_qty}</td>
              <td className="px-3 py-2 text-right font-medium text-foreground">{formatNPR(it.total_amount, { showSymbol: false })}</td>
            </tr>
            {expanded === it.item_name && it.parties.map((p, j) => (
              <tr key={`party-${i}-${j}`} className="border-b border-border bg-muted/20">
                <td className="px-3 py-1.5 pl-8 text-foreground">{p.party_name}</td>
                <td className="px-3 py-1.5 text-muted-foreground capitalize">{p.party_type}</td>
                <td className="px-3 py-1.5 text-right text-foreground">{p.qty}</td>
                <td className="px-3 py-1.5 text-right text-foreground">{formatNPR(p.amount, { showSymbol: false })}</td>
              </tr>
            ))}
          </>
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

// ───────── Item-wise Sales/Purchase ─────────
function ItemWiseReport({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data, isLoading } = useItemWiseSalesPurchase(dateFrom, dateTo);
  const handleExport = () => { if (!data?.rows.length) return; exportCSV(['Item', 'Code', 'Unit', 'Qty Sold', 'Sales Amt', 'Qty Purchased', 'Purchase Amt'], data.rows.map(r => [r.item_name, r.code || '', r.unit, String(r.qty_sold), String(r.sales_amount), String(r.qty_purchased), String(r.purchase_amount)]), `item-wise-${dateFrom}-${dateTo}.csv`); };

  return (
    <div className="space-y-3">
      <div className="flex justify-end"><ExportButton onClick={handleExport} disabled={!data?.rows.length} /></div>
      <ReportTable loading={isLoading} empty={!data?.rows.length}>
        <thead><tr className="border-b border-border bg-muted/50">
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Item</th>
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Code</th>
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Unit</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Qty Sold</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Sales Amt</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Qty Purchased</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Purchase Amt</th>
        </tr></thead>
        <tbody>{(data?.rows || []).map((r, i) => (
          <tr key={i} className="border-b border-border last:border-0">
            <td className="px-3 py-2 font-medium text-foreground">{r.item_name}</td>
            <td className="px-3 py-2 text-muted-foreground">{r.code || '—'}</td>
            <td className="px-3 py-2 text-muted-foreground">{r.unit}</td>
            <td className="px-3 py-2 text-right text-foreground">{r.qty_sold}</td>
            <td className="px-3 py-2 text-right text-green-600 dark:text-green-400">{r.sales_amount > 0 ? formatNPR(r.sales_amount, { showSymbol: false }) : '—'}</td>
            <td className="px-3 py-2 text-right text-foreground">{r.qty_purchased}</td>
            <td className="px-3 py-2 text-right text-primary">{r.purchase_amount > 0 ? formatNPR(r.purchase_amount, { showSymbol: false }) : '—'}</td>
          </tr>
        ))}</tbody>
        {data?.totals && <tfoot><tr className="border-t-2 border-foreground/20 bg-muted/30">
          <td colSpan={3} className="px-3 py-2 font-semibold text-foreground">Total ({data.rows.length} items)</td>
          <td className="px-3 py-2 text-right font-semibold text-foreground">{data.totals.qty_sold}</td>
          <td className="px-3 py-2 text-right font-semibold text-green-600 dark:text-green-400">{formatNPR(data.totals.sales_amount, { showSymbol: false })}</td>
          <td className="px-3 py-2 text-right font-semibold text-foreground">{data.totals.qty_purchased}</td>
          <td className="px-3 py-2 text-right font-semibold text-primary">{formatNPR(data.totals.purchase_amount, { showSymbol: false })}</td>
        </tr></tfoot>}
      </ReportTable>
    </div>
  );
}

// ───────── Low Stock Alert ─────────
function LowStockAlertReport() {
  const { data, isLoading } = useLowStockAlert();
  const handleExport = () => { if (!data?.length) return; exportCSV(['Item', 'Code', 'Unit', 'Current Stock', 'Alert Level', 'Purchase Price', 'Sale Price'], data.map(r => [r.item_name, r.code || '', r.unit, String(r.current_stock), String(r.low_stock_alert), String(r.purchase_price), String(r.sale_price)]), 'low-stock-alert.csv'); };

  return (
    <div className="space-y-3">
      {data && data.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <span className="text-sm font-medium text-destructive">{data.length} item(s) below stock alert level</span>
        </div>
      )}
      <div className="flex justify-end"><ExportButton onClick={handleExport} disabled={!data?.length} /></div>
      <ReportTable loading={isLoading} empty={!data?.length}>
        <thead><tr className="border-b border-border bg-muted/50">
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Item</th>
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Code</th>
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Unit</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Current Stock</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Alert Level</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Purchase ₨</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Sale ₨</th>
        </tr></thead>
        <tbody>{(data || []).map((r, i) => (
          <tr key={i} className="border-b border-border last:border-0">
            <td className="px-3 py-2 font-medium text-foreground">{r.item_name}</td>
            <td className="px-3 py-2 text-muted-foreground">{r.code || '—'}</td>
            <td className="px-3 py-2 text-muted-foreground">{r.unit}</td>
            <td className={`px-3 py-2 text-right font-medium ${r.current_stock <= 0 ? 'text-destructive' : 'text-foreground'}`}>{r.current_stock}</td>
            <td className="px-3 py-2 text-right text-muted-foreground">{r.low_stock_alert}</td>
            <td className="px-3 py-2 text-right text-foreground">{formatNPR(r.purchase_price, { showSymbol: false })}</td>
            <td className="px-3 py-2 text-right text-foreground">{formatNPR(r.sale_price, { showSymbol: false })}</td>
          </tr>
        ))}</tbody>
      </ReportTable>
    </div>
  );
}

// ───────── Day Book ─────────
function DayBookReport({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data, isLoading } = useDayBook(dateFrom, dateTo);
  const handleExport = () => { if (!data?.entries.length) return; exportCSV(['Date', 'Time', 'Type', 'Ref #', 'Party', 'Description', 'Debit', 'Credit'], data.entries.map(r => [r.date_bs, r.time, r.type, r.ref_number, r.party_name, r.description, String(r.debit), String(r.credit)]), `daybook-${dateFrom}-${dateTo}.csv`); };

  return (
    <div className="space-y-3">
      <div className="flex justify-end"><ExportButton onClick={handleExport} disabled={!data?.entries.length} /></div>
      <ReportTable loading={isLoading} empty={!data?.entries.length}>
        <thead><tr className="border-b border-border bg-muted/50">
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Date</th>
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Time</th>
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Type</th>
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Ref #</th>
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Party</th>
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Description</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Debit</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Credit</th>
        </tr></thead>
        <tbody>{(data?.entries || []).map((r, i) => (
          <tr key={i} className="border-b border-border last:border-0">
            <td className="px-3 py-2 text-muted-foreground">{r.date_bs}</td>
            <td className="px-3 py-2 text-muted-foreground">{r.time}</td>
            <td className="px-3 py-2"><span className={`text-[11px] font-medium ${r.type === 'invoice' ? 'text-primary' : 'text-green-600 dark:text-green-400'}`}>{r.type === 'invoice' ? 'Invoice' : 'Payment'}</span></td>
            <td className="px-3 py-2 font-medium text-foreground">{r.ref_number}</td>
            <td className="px-3 py-2 text-foreground">{r.party_name}</td>
            <td className="px-3 py-2 text-foreground">{r.description}</td>
            <td className="px-3 py-2 text-right text-foreground">{r.debit > 0 ? formatNPR(r.debit, { showSymbol: false }) : '—'}</td>
            <td className="px-3 py-2 text-right text-foreground">{r.credit > 0 ? formatNPR(r.credit, { showSymbol: false }) : '—'}</td>
          </tr>
        ))}</tbody>
        {data?.totals && <tfoot><tr className="border-t-2 border-foreground/20 bg-muted/30">
          <td colSpan={6} className="px-3 py-2 font-semibold text-foreground">Total ({data.entries.length} entries)</td>
          <td className="px-3 py-2 text-right font-semibold text-foreground">{formatNPR(data.totals.debit, { showSymbol: false })}</td>
          <td className="px-3 py-2 text-right font-semibold text-foreground">{formatNPR(data.totals.credit, { showSymbol: false })}</td>
        </tr></tfoot>}
      </ReportTable>
    </div>
  );
}

// ───────── CN / DN Register ─────────
function CNDNRegisterReport({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data, isLoading } = useCNDNRegister(dateFrom, dateTo);
  const handleExport = () => { if (!data?.rows.length) return; exportCSV(['Date', 'Number', 'Party', 'Type', 'Amount', 'Status'], data.rows.map(r => [r.date_bs, r.invoice_number, r.party_name, r.type, String(r.total_amount), r.status]), `cndn-register-${dateFrom}-${dateTo}.csv`); };

  return (
    <div className="space-y-3">
      {data && (
        <div className="flex gap-3">
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="text-xs text-muted-foreground">Credit Notes (Sales Returns)</div>
            <div className="text-lg font-bold text-foreground">{formatNPR(data.totals.credit_notes)}</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="text-xs text-muted-foreground">Debit Notes (Purchase Returns)</div>
            <div className="text-lg font-bold text-foreground">{formatNPR(data.totals.debit_notes)}</div>
          </div>
        </div>
      )}
      <div className="flex justify-end"><ExportButton onClick={handleExport} disabled={!data?.rows.length} /></div>
      <ReportTable loading={isLoading} empty={!data?.rows.length}>
        <thead><tr className="border-b border-border bg-muted/50">
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Date</th>
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Number</th>
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Party</th>
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Type</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Amount</th>
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Status</th>
        </tr></thead>
        <tbody>{(data?.rows || []).map((r, i) => (
          <tr key={i} className="border-b border-border last:border-0">
            <td className="px-3 py-2 text-muted-foreground">{r.date_bs}</td>
            <td className="px-3 py-2 font-medium text-foreground">{r.invoice_number}</td>
            <td className="px-3 py-2 text-foreground">{r.party_name}</td>
            <td className="px-3 py-2"><span className={`text-[11px] font-medium ${r.type === 'Credit Note' ? 'text-green-600 dark:text-green-400' : 'text-primary'}`}>{r.type}</span></td>
            <td className="px-3 py-2 text-right font-medium text-foreground">{formatNPR(r.total_amount, { showSymbol: false })}</td>
            <td className="px-3 py-2 text-muted-foreground capitalize">{r.status}</td>
          </tr>
        ))}</tbody>
      </ReportTable>
    </div>
  );
}

// ───────── Outstanding Report ─────────
function OutstandingReportView({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const [typeFilter, setTypeFilter] = useState<'all' | 'Receivable' | 'Payable'>('all');
  const { data, isLoading } = useOutstandingReport(dateFrom, dateTo);
  const filtered = useMemo(() => {
    if (!data) return [];
    return typeFilter === 'all' ? data.rows : data.rows.filter(r => r.type === typeFilter);
  }, [data, typeFilter]);
  const totals = useMemo(() => filtered.reduce((a, r) => ({ total_amount: a.total_amount + r.total_amount, paid_amount: a.paid_amount + r.paid_amount, balance_due: a.balance_due + r.balance_due }), { total_amount: 0, paid_amount: 0, balance_due: 0 }), [filtered]);
  const handleExport = () => { if (!filtered.length) return; exportCSV(['Invoice #', 'Date', 'Due Date', 'Party', 'Type', 'Total', 'Paid', 'Balance Due', 'Days Overdue'], filtered.map(r => [r.invoice_number, r.date_bs, r.due_date_bs || '—', r.party_name, r.type, String(r.total_amount), String(r.paid_amount), String(r.balance_due), String(r.days_overdue)]), `outstanding-${dateFrom}-${dateTo}.csv`); };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Tabs value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
          <TabsList className="h-7"><TabsTrigger value="all" className="text-[11px] px-2">All</TabsTrigger><TabsTrigger value="Receivable" className="text-[11px] px-2">Receivables</TabsTrigger><TabsTrigger value="Payable" className="text-[11px] px-2">Payables</TabsTrigger></TabsList>
        </Tabs>
        <ExportButton onClick={handleExport} disabled={!filtered.length} />
      </div>
      <ReportTable loading={isLoading} empty={!filtered.length}>
        <thead><tr className="border-b border-border bg-muted/50">
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Invoice #</th>
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Date</th>
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Due Date</th>
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Party</th>
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Type</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Total</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Paid</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Balance Due</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Overdue</th>
        </tr></thead>
        <tbody>{filtered.map((r, i) => (
          <tr key={i} className="border-b border-border last:border-0">
            <td className="px-3 py-2 font-medium text-foreground">{r.invoice_number}</td>
            <td className="px-3 py-2 text-muted-foreground">{r.date_bs}</td>
            <td className="px-3 py-2 text-muted-foreground">{r.due_date_bs || '—'}</td>
            <td className="px-3 py-2 text-foreground">{r.party_name}</td>
            <td className="px-3 py-2"><span className={`text-[11px] font-medium ${r.type === 'Receivable' ? 'text-green-600 dark:text-green-400' : 'text-primary'}`}>{r.type}</span></td>
            <td className="px-3 py-2 text-right text-foreground">{formatNPR(r.total_amount, { showSymbol: false })}</td>
            <td className="px-3 py-2 text-right text-muted-foreground">{formatNPR(r.paid_amount, { showSymbol: false })}</td>
            <td className="px-3 py-2 text-right font-medium text-foreground">{formatNPR(r.balance_due, { showSymbol: false })}</td>
            <td className={`px-3 py-2 text-right font-medium ${r.days_overdue > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>{r.days_overdue > 0 ? `${r.days_overdue}d` : '—'}</td>
          </tr>
        ))}</tbody>
        <tfoot><tr className="border-t-2 border-foreground/20 bg-muted/30">
          <td colSpan={5} className="px-3 py-2 font-semibold text-foreground">Total ({filtered.length})</td>
          <td className="px-3 py-2 text-right font-semibold text-foreground">{formatNPR(totals.total_amount, { showSymbol: false })}</td>
          <td className="px-3 py-2 text-right font-semibold text-muted-foreground">{formatNPR(totals.paid_amount, { showSymbol: false })}</td>
          <td className="px-3 py-2 text-right font-bold text-foreground">{formatNPR(totals.balance_due, { showSymbol: false })}</td>
          <td />
        </tr></tfoot>
      </ReportTable>
    </div>
  );
}

// ───────── VAT Return Summary ─────────
function VATReturnReport({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data, isLoading } = useVATReturnSummary(dateFrom, dateTo);

  if (isLoading) return <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">Loading…</div>;
  if (!data) return <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">No data.</div>;

  return (
    <div className="space-y-4 max-w-lg">
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Particulars</th>
            <th className="px-4 py-2 text-right font-medium text-muted-foreground">Amount</th>
            <th className="px-4 py-2 text-right font-medium text-muted-foreground">VAT</th>
          </tr></thead>
          <tbody>
            {data.sections.map((r, i) => {
              const isNet = r.label.startsWith('Net');
              return (
                <tr key={i} className={`border-b border-border last:border-0 ${isNet ? 'bg-muted/30' : ''}`}>
                  <td className={`px-4 py-3 ${isNet ? 'font-semibold' : ''} text-foreground`}>{r.label}</td>
                  <td className="px-4 py-3 text-right text-foreground">{formatNPR(r.amount, { showSymbol: false })}</td>
                  <td className="px-4 py-3 text-right text-foreground">{r.vat > 0 ? formatNPR(r.vat, { showSymbol: false }) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot><tr className="border-t-2 border-foreground/20 bg-muted/40">
            <td className="px-4 py-3 font-bold text-foreground">{data.netVATPayable >= 0 ? 'VAT Payable' : 'VAT Refundable'}</td>
            <td />
            <td className={`px-4 py-3 text-right font-bold ${data.netVATPayable >= 0 ? 'text-destructive' : 'text-green-600 dark:text-green-400'}`}>
              {formatNPR(Math.abs(data.netVATPayable))}
            </td>
          </tr></tfoot>
        </table>
      </div>
    </div>
  );
}

// ───────── Daily Summary / Tally Sheet ─────────
function DailySummaryReport({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data, isLoading } = useDailySummary(dateFrom, dateTo);
  const handleExport = () => { if (!data?.rows.length) return; exportCSV(['Date (BS)', 'Date (AD)', 'Sales', 'Purchases', 'Payments In', 'Payments Out', 'Invoices', 'Payments'], data.rows.map(r => [r.date_bs, r.date_ad, String(r.total_sales), String(r.total_purchases), String(r.total_payments_in), String(r.total_payments_out), String(r.invoice_count), String(r.payment_count)]), `daily-summary-${dateFrom}-${dateTo}.csv`); };

  return (
    <div className="space-y-4">
      {data && data.rows.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Daily Sales vs Purchases</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.rows} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date_bs" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} angle={-35} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <RechartsTooltip formatter={(value: number) => formatNPR(value)} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="total_sales" name="Sales" fill="hsl(142, 71%, 45%)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="total_purchases" name="Purchases" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="flex justify-end"><ExportButton onClick={handleExport} disabled={!data?.rows.length} /></div>
      <ReportTable loading={isLoading} empty={!data?.rows.length}>
        <thead><tr className="border-b border-border bg-muted/50">
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Date (BS)</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Sales</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Purchases</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Payments In</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Payments Out</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Invoices</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Payments</th>
        </tr></thead>
        <tbody>{(data?.rows || []).map((r, i) => (
          <tr key={i} className="border-b border-border last:border-0">
            <td className="px-3 py-2 font-medium text-foreground">{r.date_bs}</td>
            <td className="px-3 py-2 text-right text-green-600 dark:text-green-400">{r.total_sales > 0 ? formatNPR(r.total_sales, { showSymbol: false }) : '—'}</td>
            <td className="px-3 py-2 text-right text-primary">{r.total_purchases > 0 ? formatNPR(r.total_purchases, { showSymbol: false }) : '—'}</td>
            <td className="px-3 py-2 text-right text-green-600 dark:text-green-400">{r.total_payments_in > 0 ? formatNPR(r.total_payments_in, { showSymbol: false }) : '—'}</td>
            <td className="px-3 py-2 text-right text-destructive">{r.total_payments_out > 0 ? formatNPR(r.total_payments_out, { showSymbol: false }) : '—'}</td>
            <td className="px-3 py-2 text-right text-muted-foreground">{r.invoice_count}</td>
            <td className="px-3 py-2 text-right text-muted-foreground">{r.payment_count}</td>
          </tr>
        ))}</tbody>
        {data?.totals && <tfoot><tr className="border-t-2 border-foreground/20 bg-muted/30">
          <td className="px-3 py-2 font-semibold text-foreground">Total ({data.rows.length} days)</td>
          <td className="px-3 py-2 text-right font-semibold text-green-600 dark:text-green-400">{formatNPR(data.totals.total_sales, { showSymbol: false })}</td>
          <td className="px-3 py-2 text-right font-semibold text-primary">{formatNPR(data.totals.total_purchases, { showSymbol: false })}</td>
          <td className="px-3 py-2 text-right font-semibold text-green-600 dark:text-green-400">{formatNPR(data.totals.total_payments_in, { showSymbol: false })}</td>
          <td className="px-3 py-2 text-right font-semibold text-destructive">{formatNPR(data.totals.total_payments_out, { showSymbol: false })}</td>
          <td className="px-3 py-2 text-right font-semibold text-muted-foreground">{data.totals.invoice_count}</td>
          <td className="px-3 py-2 text-right font-semibold text-muted-foreground">{data.totals.payment_count}</td>
        </tr></tfoot>}
      </ReportTable>
    </div>
  );
}

// ───────── Trial Balance ─────────
function TrialBalanceReport({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data, isLoading } = useTrialBalance(dateFrom, dateTo);
  const handleExport = () => { if (!data?.rows.length) return; exportCSV(['Account', 'Type', 'Debit', 'Credit'], data.rows.map(r => [r.account_name, r.type, String(r.debit), String(r.credit)]), `trial-balance-${dateFrom}-${dateTo}.csv`); };

  return (
    <div className="space-y-3 max-w-2xl">
      <div className="flex justify-end"><ExportButton onClick={handleExport} disabled={!data?.rows.length} /></div>
      <ReportTable loading={isLoading} empty={!data?.rows.length}>
        <thead><tr className="border-b border-border bg-muted/50">
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Account</th>
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Type</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Debit (Dr)</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Credit (Cr)</th>
        </tr></thead>
        <tbody>{(data?.rows || []).map((r, i) => (
          <tr key={i} className="border-b border-border last:border-0">
            <td className="px-3 py-2 font-medium text-foreground">{r.account_name}</td>
            <td className="px-3 py-2 text-muted-foreground capitalize">{r.type}</td>
            <td className="px-3 py-2 text-right text-foreground">{r.debit > 0 ? formatNPR(r.debit, { showSymbol: false }) : '—'}</td>
            <td className="px-3 py-2 text-right text-foreground">{r.credit > 0 ? formatNPR(r.credit, { showSymbol: false }) : '—'}</td>
          </tr>
        ))}</tbody>
        {data && <tfoot><tr className="border-t-2 border-foreground/20 bg-muted/30">
          <td colSpan={2} className="px-3 py-2 font-bold text-foreground">Total</td>
          <td className="px-3 py-2 text-right font-bold text-foreground">{formatNPR(data.totalDebit, { showSymbol: false })}</td>
          <td className="px-3 py-2 text-right font-bold text-foreground">{formatNPR(data.totalCredit, { showSymbol: false })}</td>
        </tr></tfoot>}
      </ReportTable>
      {data && Math.abs(data.totalDebit - data.totalCredit) > 0.01 && (
        <div className="text-xs text-muted-foreground italic">Note: Difference of {formatNPR(Math.abs(data.totalDebit - data.totalCredit))} — this simplified trial balance may not fully balance without a complete chart of accounts.</div>
      )}
    </div>
  );
}

// ───────── Balance Sheet Summary ─────────
function BalanceSheetReport({ dateTo }: { dateTo: string }) {
  const { data, isLoading } = useBalanceSheetSummary(dateTo);

  if (isLoading) return <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">Loading…</div>;
  if (!data) return <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">No data.</div>;

  const renderSection = (section: typeof data.assets) => (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-4 py-2 bg-muted/50 font-semibold text-sm text-foreground">{section.label}</div>
      <table className="w-full text-sm">
        <tbody>
          {section.items.map((item, i) => (
            <tr key={i} className="border-b border-border last:border-0">
              <td className="px-4 py-2.5 text-foreground">{item.name}</td>
              <td className="px-4 py-2.5 text-right text-foreground">{formatNPR(item.amount, { showSymbol: false })}</td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr className="border-t-2 border-foreground/20 bg-muted/30">
          <td className="px-4 py-2 font-bold text-foreground">Total {section.label}</td>
          <td className="px-4 py-2 text-right font-bold text-foreground">{formatNPR(section.total)}</td>
        </tr></tfoot>
      </table>
    </div>
  );

  return (
    <div className="space-y-4 max-w-lg">
      {renderSection(data.assets)}
      {renderSection(data.liabilities)}
      <div className="rounded-lg border border-border bg-card p-4 flex justify-between items-center">
        <span className="font-bold text-foreground">Owner's Equity (Assets − Liabilities)</span>
        <span className={`text-lg font-bold ${data.equity >= 0 ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>{formatNPR(data.equity)}</span>
      </div>
      <p className="text-xs text-muted-foreground italic">Note: This is a simplified balance sheet derived from invoice and payment data. It does not include a full chart of accounts.</p>
    </div>
  );
}

// ───────── Top Selling Items ─────────
function TopSellingReport({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data, isLoading } = useTopSellingItems(dateFrom, dateTo);
  const handleExport = () => { if (!data?.rows.length) return; exportCSV(['Item', 'Code', 'Unit', 'Qty Sold', 'Revenue', 'Avg Rate'], data.rows.map(r => [r.item_name, r.code || '', r.unit, String(r.qty_sold), String(r.total_revenue), String(r.avg_rate.toFixed(2))]), `top-selling-${dateFrom}-${dateTo}.csv`); };

  const chartData = useMemo(() => (data?.rows || []).slice(0, 10).map(r => ({ name: r.item_name.length > 15 ? r.item_name.substring(0, 15) + '…' : r.item_name, revenue: r.total_revenue })), [data]);

  return (
    <div className="space-y-4">
      {chartData.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Top 10 Items by Revenue</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={80} />
              <RechartsTooltip formatter={(value: number) => formatNPR(value)} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="revenue" name="Revenue" fill="hsl(142, 71%, 45%)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {data && (
        <div className="flex gap-3">
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="text-xs text-muted-foreground">Total Revenue</div>
            <div className="text-lg font-bold text-foreground">{formatNPR(data.totalRevenue)}</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="text-xs text-muted-foreground">Total Qty Sold</div>
            <div className="text-lg font-bold text-foreground">{data.totalQty}</div>
          </div>
        </div>
      )}

      <div className="flex justify-end"><ExportButton onClick={handleExport} disabled={!data?.rows.length} /></div>
      <ReportTable loading={isLoading} empty={!data?.rows.length}>
        <thead><tr className="border-b border-border bg-muted/50">
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">#</th>
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Item</th>
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Code</th>
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Unit</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Qty Sold</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Revenue</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Avg Rate</th>
        </tr></thead>
        <tbody>{(data?.rows || []).map((r, i) => (
          <tr key={i} className="border-b border-border last:border-0">
            <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
            <td className="px-3 py-2 font-medium text-foreground">{r.item_name}</td>
            <td className="px-3 py-2 text-muted-foreground">{r.code || '—'}</td>
            <td className="px-3 py-2 text-muted-foreground">{r.unit}</td>
            <td className="px-3 py-2 text-right text-foreground">{r.qty_sold}</td>
            <td className="px-3 py-2 text-right font-medium text-green-600 dark:text-green-400">{formatNPR(r.total_revenue, { showSymbol: false })}</td>
            <td className="px-3 py-2 text-right text-muted-foreground">{formatNPR(r.avg_rate, { showSymbol: false })}</td>
          </tr>
        ))}</tbody>
      </ReportTable>
    </div>
  );
}

// ───────── VAT Annex Report ─────────
function VATAnnexReport({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const [annexType, setAnnexType] = useState<'sales' | 'purchases'>('sales');
  const { data, isLoading } = useVATAnnex(dateFrom, dateTo, annexType);
  const annexLabel = annexType === 'sales' ? 'Annex 1 – Sales' : 'Annex 2 – Purchases';
  const partyLabel = annexType === 'sales' ? 'Buyer' : 'Supplier';
  const handleExport = () => { if (!data?.rows.length) return; exportCSV(['SN', 'Invoice #', 'Date', `${partyLabel} PAN`, `${partyLabel} Name`, 'Total Amount', 'Exempt', 'Taxable', 'VAT'], data.rows.map(r => [String(r.sn), r.invoice_number, r.date_bs, r.buyer_pan, r.buyer_name, String(r.total_sales), String(r.exempt_sales), String(r.taxable_amount), String(r.vat_amount)]), `vat-annex-${annexType}-${dateFrom}-${dateTo}.csv`); };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Tabs value={annexType} onValueChange={(v) => setAnnexType(v as any)}>
          <TabsList className="h-7">
            <TabsTrigger value="sales" className="text-[11px] px-2">Annex 1 (Sales)</TabsTrigger>
            <TabsTrigger value="purchases" className="text-[11px] px-2">Annex 2 (Purchases)</TabsTrigger>
          </TabsList>
        </Tabs>
        <ExportButton onClick={handleExport} disabled={!data?.rows.length} />
      </div>
      <h3 className="text-sm font-semibold text-foreground">{annexLabel}</h3>
      <ReportTable loading={isLoading} empty={!data?.rows.length}>
        <thead><tr className="border-b border-border bg-muted/50">
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">SN</th>
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Invoice #</th>
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Date</th>
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">{partyLabel} PAN</th>
          <th className="px-3 py-2 text-left font-medium text-muted-foreground">{partyLabel} Name</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Total</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Exempt</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Taxable</th>
          <th className="px-3 py-2 text-right font-medium text-muted-foreground">VAT</th>
        </tr></thead>
        <tbody>{(data?.rows || []).map((r) => (
          <tr key={r.sn} className="border-b border-border last:border-0">
            <td className="px-3 py-2 text-muted-foreground">{r.sn}</td>
            <td className="px-3 py-2 font-medium text-foreground">{r.invoice_number}</td>
            <td className="px-3 py-2 text-muted-foreground">{r.date_bs}</td>
            <td className="px-3 py-2 text-foreground">{r.buyer_pan || '—'}</td>
            <td className="px-3 py-2 text-foreground">{r.buyer_name}</td>
            <td className="px-3 py-2 text-right text-foreground">{formatNPR(r.total_sales, { showSymbol: false })}</td>
            <td className="px-3 py-2 text-right text-muted-foreground">{r.exempt_sales > 0 ? formatNPR(r.exempt_sales, { showSymbol: false }) : '—'}</td>
            <td className="px-3 py-2 text-right text-foreground">{r.taxable_amount > 0 ? formatNPR(r.taxable_amount, { showSymbol: false }) : '—'}</td>
            <td className="px-3 py-2 text-right text-foreground">{r.vat_amount > 0 ? formatNPR(r.vat_amount, { showSymbol: false }) : '—'}</td>
          </tr>
        ))}</tbody>
        {data?.totals && <tfoot><tr className="border-t-2 border-foreground/20 bg-muted/30">
          <td colSpan={5} className="px-3 py-2 font-semibold text-foreground">Total ({data.rows.length})</td>
          <td className="px-3 py-2 text-right font-semibold text-foreground">{formatNPR(data.totals.total_sales, { showSymbol: false })}</td>
          <td className="px-3 py-2 text-right font-semibold text-muted-foreground">{formatNPR(data.totals.exempt_sales, { showSymbol: false })}</td>
          <td className="px-3 py-2 text-right font-semibold text-foreground">{formatNPR(data.totals.taxable_amount, { showSymbol: false })}</td>
          <td className="px-3 py-2 text-right font-bold text-foreground">{formatNPR(data.totals.vat_amount, { showSymbol: false })}</td>
        </tr></tfoot>}
      </ReportTable>
    </div>
  );
}
