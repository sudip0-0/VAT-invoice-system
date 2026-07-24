import { TrendingUp, TrendingDown, IndianRupee, AlertTriangle } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { formatNPR } from '@/lib/nepal-format';
import { todayBS, getFiscalYear, formatBS } from '@/lib/bs-calendar';
import { useDashboardData } from '@/hooks/useDashboard';
import StatusBadge from '@/components/shared/StatusBadge';
import SetupReadinessChecklist from '@/components/SetupReadinessChecklist';
import { useDocumentTemplates } from '@/hooks/useDocumentTemplates';
import { nepalTodayISO } from '@/lib/nepal-date';
import { useToast } from '@/hooks/use-toast';

const today = todayBS();

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
  const { data, isLoading } = useDashboardData();
  const { data: templates = [] } = useDocumentTemplates();
  const { toast } = useToast();
  const notifiedRef = useRef(false);

  useEffect(() => {
    if (notifiedRef.current || !templates.length) return;
    const todayAd = nepalTodayISO();
    const due = templates.filter(
      (template) => template.schedule === 'monthly' && template.next_run_ad && template.next_run_ad <= todayAd
    );
    if (due.length > 0) {
      notifiedRef.current = true;
      toast({
        title: `${due.length} recurring draft${due.length === 1 ? '' : 's'} ready`,
        description: 'Open Templates to create draft invoices from due schedules.',
      });
    }
  }, [templates, toast]);

  const kpiCards = [
    { label: "Today's Sales", value: data?.todaySales ?? 0, icon: TrendingUp, accent: 'success' as const },
    { label: 'Total Receivables', value: data?.totalReceivables ?? 0, icon: IndianRupee, accent: 'warning' as const },
    { label: 'Total Payables', value: data?.totalPayables ?? 0, icon: TrendingDown, accent: 'destructive' as const },
    { label: 'Low Stock Items', value: data?.lowStockCount ?? 0, icon: AlertTriangle, accent: 'warning' as const, isCount: true },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            FY {getFiscalYear(today)} • {formatBS(today)}
          </p>
        </div>
        <Link to="/templates" className="text-xs text-primary hover:underline">Templates</Link>
      </div>

      <SetupReadinessChecklist compact />

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
              {isLoading ? '—' : kpi.isCount ? kpi.value : formatNPR(kpi.value, { compact: true })}
            </p>
          </div>
        ))}
      </div>

      {/* Recent Invoices + Low Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Invoices */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Recent Invoices</h2>
          {isLoading ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : !data?.recentInvoices.length ? (
            <p className="text-xs text-muted-foreground">No invoices yet.</p>
          ) : (
            <div className="space-y-3">
              {data.recentInvoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between text-xs">
                  <div>
                    <p className="font-medium text-foreground">
                      {inv.buyer_name || inv.customer?.name || inv.vendor?.name || '—'}
                    </p>
                    <p className="text-muted-foreground">{inv.invoice_number}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-foreground">{formatNPR(inv.total_amount, { showSymbol: false })}</p>
                    <StatusBadge status={inv.status.toUpperCase()} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low Stock Alerts */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Low Stock Alerts</h2>
          {isLoading ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : !data?.lowStockItems.length ? (
            <p className="text-xs text-muted-foreground">All stock levels are healthy.</p>
          ) : (
            <div className="space-y-2">
              {data.lowStockItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">{item.name}</span>
                  <span className="text-destructive font-medium">
                    {item.current_stock} / {item.low_stock_alert}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Monthly Sales</p>
          <p className="text-base font-bold text-foreground">
            {isLoading ? '—' : formatNPR(data?.monthSales ?? 0, { compact: true })}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Monthly Purchases</p>
          <p className="text-base font-bold text-foreground">
            {isLoading ? '—' : formatNPR(data?.monthPurchases ?? 0, { compact: true })}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Total Customers</p>
          <p className="text-base font-bold text-foreground">
            {isLoading ? '—' : data?.totalCustomers ?? 0}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Net This Month</p>
          <p className={`text-base font-bold ${(data?.monthSales ?? 0) - (data?.monthPurchases ?? 0) < 0 ? 'text-destructive' : 'text-success'}`}>
            {isLoading ? '—' : formatNPR((data?.monthSales ?? 0) - (data?.monthPurchases ?? 0), { compact: true })}
          </p>
        </div>
      </div>
    </div>
  );
}
