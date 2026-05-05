import { useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Search, Wallet, Plus } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useAllPayments, type PaymentWithDetails } from '@/hooks/usePayments';
import { formatNPR } from '@/lib/nepal-format';
import StandalonePaymentDialog from '@/components/payments/StandalonePaymentDialog';
import { toast } from 'sonner';
import PaginationControls from '@/components/shared/PaginationControls';

const PAGE_SIZE = 50;

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  bank_transfer: 'Bank Transfer',
  esewa: 'eSewa',
  khalti: 'Khalti',
  fonepay: 'FonePay',
  connectips: 'ConnectIPS',
  cheque: 'Cheque',
  credit: 'Credit',
};

function PaymentTable({ payments, type }: { payments: PaymentWithDetails[]; type: 'in' | 'out' }) {
  if (payments.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        No {type === 'in' ? 'incoming' : 'outgoing'} payments found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Date</th>
            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Party</th>
            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Invoice</th>
            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Method</th>
            <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Amount</th>
            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Reference</th>
            <th className="px-4 py-2.5 text-center font-medium text-muted-foreground">Status</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                {new Date(p.payment_date_ad).toLocaleDateString('en-GB', {
                  day: '2-digit', month: 'short', year: 'numeric',
                })}
                {p.payment_date_bs && (
                  <span className="ml-1.5 text-[10px] block text-muted-foreground/70">
                    BS: {p.payment_date_bs}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 font-medium text-foreground">
                {p.party?.name || '—'}
              </td>
              <td className="px-4 py-3">
                {p.invoice ? (
                  <Link
                    to={`/invoices/${p.invoice_id}`}
                    className="text-primary hover:underline font-mono text-[11px]"
                  >
                    {p.invoice.invoice_number}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {METHOD_LABELS[p.method] || p.method}
              </td>
              <td className="px-4 py-3 text-right font-medium text-foreground">
                {formatNPR(p.amount)}
              </td>
              <td className="px-4 py-3 text-muted-foreground font-mono text-[11px]">
                {p.reference || '—'}
              </td>
              <td className="px-4 py-3 text-center">
                <Badge
                  variant="outline"
                  className={`text-[10px] ${
                    p.status === 'completed'
                      ? 'border-emerald-500/30 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30'
                      : p.status === 'pending'
                      ? 'border-yellow-500/30 text-yellow-600 bg-yellow-50 dark:bg-yellow-950/30'
                      : 'border-destructive/30 text-destructive bg-destructive/5'
                  }`}
                >
                  {p.status}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PaymentsPage() {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'in' | 'out'>('in');
  const [pageIn, setPageIn] = useState(1);
  const [pageOut, setPageOut] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: payments = [], isLoading, recordStandalonePayment } = useAllPayments();

  useEffect(() => {
    setPageIn(1);
    setPageOut(1);
  }, [search]);

  const { paymentsIn, paymentsOut, statsIn, statsOut } = useMemo(() => {
    // ... keep existing code
    const inTypes = new Set(['sale', 'sale_return']);
    const outTypes = new Set(['purchase', 'purchase_return']);

    let pIn: PaymentWithDetails[] = [];
    let pOut: PaymentWithDetails[] = [];

    for (const p of payments) {
      const invType = p.invoice?.type;
      if (invType && inTypes.has(invType)) {
        pIn.push(p);
      } else if (invType && outTypes.has(invType)) {
        pOut.push(p);
      } else if (!invType && p.party?.type === 'vendor') {
        // Standalone payment to a vendor = payment out
        pOut.push(p);
      } else {
        pIn.push(p);
      }
    }

    const q = search.toLowerCase();
    const filterFn = (p: PaymentWithDetails) => {
      if (!q) return true;
      return (
        p.party?.name?.toLowerCase().includes(q) ||
        p.invoice?.invoice_number?.toLowerCase().includes(q) ||
        p.reference?.toLowerCase().includes(q) ||
        p.method?.toLowerCase().includes(q)
      );
    };

    pIn = pIn.filter(filterFn);
    pOut = pOut.filter(filterFn);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const sumMonth = (arr: PaymentWithDetails[]) =>
      arr
        .filter((p) => p.status === 'completed' && new Date(p.payment_date_ad) >= monthStart)
        .reduce((s, p) => s + p.amount, 0);

    return {
      paymentsIn: pIn,
      paymentsOut: pOut,
      statsIn: { total: pIn.reduce((s, p) => s + (p.status === 'completed' ? p.amount : 0), 0), month: sumMonth(pIn), count: pIn.length },
      statsOut: { total: pOut.reduce((s, p) => s + (p.status === 'completed' ? p.amount : 0), 0), month: sumMonth(pOut), count: pOut.length },
    };
  }, [payments, search]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(paymentsIn.length / PAGE_SIZE));
    if (pageIn > totalPages) {
      setPageIn(totalPages);
    }
  }, [paymentsIn.length, pageIn]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(paymentsOut.length / PAGE_SIZE));
    if (pageOut > totalPages) {
      setPageOut(totalPages);
    }
  }, [paymentsOut.length, pageOut]);

  const paginatedPaymentsIn = useMemo(() => {
    const from = (pageIn - 1) * PAGE_SIZE;
    return paymentsIn.slice(from, from + PAGE_SIZE);
  }, [paymentsIn, pageIn]);

  const paginatedPaymentsOut = useMemo(() => {
    const from = (pageOut - 1) * PAGE_SIZE;
    return paymentsOut.slice(from, from + PAGE_SIZE);
  }, [paymentsOut, pageOut]);

  const handleRecordPayment = (data: Record<string, any>) => {
    recordStandalonePayment.mutate(data as any, {
      onSuccess: () => {
        toast.success('Payment recorded successfully');
        setDialogOpen(false);
      },
      onError: (err: any) => {
        toast.error(err.message || 'Failed to record payment');
      },
    });
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Payments</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground max-w-xs">
            <Search className="h-3.5 w-3.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search payments..."
              className="w-full bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <Button size="sm" className="gap-1.5 text-xs" onClick={() => setDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Record Payment
          </Button>
        </div>
      </div>

      <StandalonePaymentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        direction={activeTab}
        onSubmit={handleRecordPayment}
        loading={recordStandalonePayment.isPending}
      />

      <Tabs defaultValue="in" className="space-y-4" onValueChange={(v) => setActiveTab(v as 'in' | 'out')}>
        <TabsList className="grid w-full max-w-xs grid-cols-2">
          <TabsTrigger value="in" className="gap-1.5 text-xs">
            <ArrowDownLeft className="h-3.5 w-3.5" /> Payment In
          </TabsTrigger>
          <TabsTrigger value="out" className="gap-1.5 text-xs">
            <ArrowUpRight className="h-3.5 w-3.5" /> Payment Out
          </TabsTrigger>
        </TabsList>

        <TabsContent value="in" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="border-border">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-lg bg-emerald-500/10 p-2.5">
                  <ArrowDownLeft className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">This Month</p>
                  <p className="text-lg font-bold text-foreground">{formatNPR(statsIn.month, { compact: true })}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-lg bg-primary/10 p-2.5">
                  <Wallet className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Received</p>
                  <p className="text-lg font-bold text-foreground">{formatNPR(statsIn.total, { compact: true })}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-lg bg-muted p-2.5">
                  <ArrowDownLeft className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Transactions</p>
                  <p className="text-lg font-bold text-foreground">{statsIn.count}</p>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            {isLoading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
            ) : (
              <PaymentTable payments={paginatedPaymentsIn} type="in" />
            )}
            <PaginationControls page={pageIn} pageSize={PAGE_SIZE} total={paymentsIn.length} onPageChange={setPageIn} />
          </div>
        </TabsContent>

        <TabsContent value="out" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="border-border">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-lg bg-destructive/10 p-2.5">
                  <ArrowUpRight className="h-4 w-4 text-destructive" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">This Month</p>
                  <p className="text-lg font-bold text-foreground">{formatNPR(statsOut.month, { compact: true })}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-lg bg-primary/10 p-2.5">
                  <Wallet className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Paid</p>
                  <p className="text-lg font-bold text-foreground">{formatNPR(statsOut.total, { compact: true })}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-lg bg-muted p-2.5">
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Transactions</p>
                  <p className="text-lg font-bold text-foreground">{statsOut.count}</p>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            {isLoading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
            ) : (
              <PaymentTable payments={paginatedPaymentsOut} type="out" />
            )}
            <PaginationControls page={pageOut} pageSize={PAGE_SIZE} total={paymentsOut.length} onPageChange={setPageOut} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
