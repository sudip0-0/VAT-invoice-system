import { TrendingUp, TrendingDown, IndianRupee, AlertTriangle, Users } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { formatNPR } from '@/lib/nepal-format';
import { todayBS, getFiscalYear, formatBS } from '@/lib/bs-calendar';
import { mockDashboardData, mockInvoices } from '@/lib/mock-data';
import StatusBadge from '@/components/shared/StatusBadge';

const data = mockDashboardData;
const today = todayBS();

const kpiCards = [
  {
    label: "Today's Sales",
    value: data.todaySales,
    icon: TrendingUp,
    accent: 'success' as const,
  },
  {
    label: 'Total Receivables',
    value: data.totalReceivables,
    icon: IndianRupee,
    accent: 'warning' as const,
  },
  {
    label: 'Total Payables',
    value: data.totalPayables,
    icon: TrendingDown,
    accent: 'destructive' as const,
  },
  {
    label: 'Low Stock Items',
    value: data.lowStockItems,
    icon: AlertTriangle,
    accent: 'warning' as const,
    isCount: true,
  },
];

const accentColorMap = {
  success: 'text-success',
  warning: 'text-warning',
  destructive: 'text-destructive',
};

const accentBgMap = {
  success: 'bg-success/10',
  warning: 'bg-warning/10',
  destructive: 'bg-destructive/10',
};

export default function Dashboard() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          FY {getFiscalYear(today)} • {formatBS(today)}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi) => (
          <div key={kpi.label} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">{kpi.label}</span>
              <div className={`rounded-md p-1.5 ${accentBgMap[kpi.accent]}`}>
                <kpi.icon className={`h-3.5 w-3.5 ${accentColorMap[kpi.accent]}`} />
              </div>
            </div>
            <p className="text-lg font-bold text-foreground">
              {kpi.isCount ? kpi.value : formatNPR(kpi.value, { compact: true })}
            </p>
          </div>
        ))}
      </div>

      {/* Chart + Recent Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sales chart */}
        <div className="lg:col-span-2 rounded-lg border border-border bg-card p-4">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Sales vs Purchases (This Month)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.recentSalesData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number) => formatNPR(value)}
                />
                <Bar dataKey="sales" fill="hsl(var(--chart-3))" radius={[3, 3, 0, 0]} name="Sales" />
                <Bar dataKey="purchases" fill="hsl(var(--chart-4))" radius={[3, 3, 0, 0]} name="Purchases" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Invoices */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Recent Invoices</h2>
          <div className="space-y-3">
            {mockInvoices.slice(0, 5).map((inv) => (
              <div key={inv.id} className="flex items-center justify-between text-xs">
                <div>
                  <p className="font-medium text-foreground">{inv.customerName || inv.vendorName}</p>
                  <p className="text-muted-foreground">{inv.invoiceNumber}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-foreground">{formatNPR(inv.totalAmount, { showSymbol: false })}</p>
                  <StatusBadge status={inv.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Monthly Sales</p>
          <p className="text-base font-bold text-foreground">{formatNPR(data.monthSales, { compact: true })}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Monthly Purchases</p>
          <p className="text-base font-bold text-foreground">{formatNPR(data.monthPurchases, { compact: true })}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Total Customers</p>
          <p className="text-base font-bold text-foreground">{data.totalCustomers}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Net This Month</p>
          <p className={`text-base font-bold ${data.monthSales - data.monthPurchases < 0 ? 'text-destructive' : 'text-success'}`}>
            {formatNPR(data.monthSales - data.monthPurchases, { compact: true })}
          </p>
        </div>
      </div>
    </div>
  );
}
