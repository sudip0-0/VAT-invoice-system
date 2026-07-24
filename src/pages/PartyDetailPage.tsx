import { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Pencil, Phone, Mail, MapPin, Download, FileText, CreditCard, Plus } from 'lucide-react';
import { useParties, type PartyWithBalance } from '@/hooks/useParties';
import { usePartyLedger } from '@/hooks/useReports';
import { useAllPayments } from '@/hooks/usePayments';
import { formatNPR } from '@/lib/nepal-format';
import { nepalNow, formatLocalDate } from '@/lib/nepal-date';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PartyDialog, { type PartyFormData } from '@/components/parties/PartyDialog';
import StandalonePaymentDialog from '@/components/payments/StandalonePaymentDialog';
import { useToast } from '@/hooks/use-toast';
import PageBreadcrumbs from '@/components/shared/PageBreadcrumbs';

function getDefaultDateRange() {
  const now = nepalNow();
  const from = formatLocalDate(new Date(now.getFullYear(), 0, 1));
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

export default function PartyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: parties = [], isLoading: partiesLoading, updateParty } = useParties();
  const party = useMemo(() => parties.find((p) => p.id === id), [parties, id]);

  const defaults = getDefaultDateRange();
  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo, setDateTo] = useState(defaults.to);
  const [editOpen, setEditOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentDirection, setPaymentDirection] = useState<'in' | 'out'>('in');
  const [saving, setSaving] = useState(false);
  const { recordStandalonePayment } = useAllPayments();

  const { data: ledgerData, isLoading: ledgerLoading } = usePartyLedger(id, dateFrom, dateTo);

  const handleSave = async (data: PartyFormData) => {
    if (!party) return;
    setSaving(true);
    try {
      await updateParty.mutateAsync({ id: party.id, ...data });
      toast({ title: 'Party updated' });
      setEditOpen(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    if (!ledgerData?.entries.length || !party) return;
    const headers = ['Date (BS)', 'Time', 'Description', 'Debit', 'Credit', 'Balance'];
    const rows = ledgerData.entries.map((e) => [e.date_bs, e.time, e.description, String(e.debit), String(e.credit), String(e.balance)]);
    exportCSV(headers, rows, `ledger-${party.name}-${dateFrom}-${dateTo}.csv`);
  };

  if (partiesLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>;
  }

  if (!party) {
    return (
      <div className="space-y-4 animate-fade-in">
        <button onClick={() => navigate('/parties')} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Parties
        </button>
        <div className="p-8 text-center text-sm text-muted-foreground">Party not found.</div>
      </div>
    );
  }

  const balanceColor = party.ledger_balance > 0 ? 'text-success' : party.ledger_balance < 0 ? 'text-destructive' : 'text-muted-foreground';
  const balanceLabel = party.ledger_balance > 0 ? 'Receivable' : party.ledger_balance < 0 ? 'Payable' : 'Settled';

  return (
    <div className="space-y-5 animate-fade-in">
      <PageBreadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Parties', href: '/parties' },
          { label: party.name },
        ]}
      />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Back to parties"
            onClick={() => navigate('/parties')}
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-foreground">{party.name}</h1>
            <span className={`text-[11px] font-medium capitalize ${party.type === 'customer' ? 'text-success' : party.type === 'vendor' ? 'text-primary' : 'text-accent'}`}>
              {party.type}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => {
              setPaymentDirection(party.type === 'vendor' ? 'out' : 'in');
              setPaymentOpen(true);
            }}
          >
            <Plus className="h-3 w-3" /> Record Payment
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setEditOpen(true)}>
            <Pencil className="h-3 w-3" /> Edit
          </Button>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Contact Info */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-2.5">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contact</h3>
          <div className="space-y-1.5 text-sm">
            {party.phone && (
              <div className="flex items-center gap-2 text-foreground">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                {party.phone}
              </div>
            )}
            {party.email && (
              <div className="flex items-center gap-2 text-foreground">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                {party.email}
              </div>
            )}
            {(party.address || party.city) && (
              <div className="flex items-center gap-2 text-foreground">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                {[party.address, party.city].filter(Boolean).join(', ')}
              </div>
            )}
            {!party.phone && !party.email && !party.address && !party.city && (
              <p className="text-muted-foreground text-xs">No contact info</p>
            )}
          </div>
        </div>

        {/* Financial Info */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-2.5">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Financial</h3>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">PAN</span>
              <span className="font-mono text-foreground">{party.pan_number || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Opening Balance</span>
              <span className="text-foreground">{formatNPR(party.opening_balance, { showSymbol: false })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Credit Limit</span>
              <span className="text-foreground">{party.credit_limit != null ? formatNPR(party.credit_limit, { showSymbol: false }) : 'No limit'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Credit Days</span>
              <span className="text-foreground">{party.credit_days ?? '—'}</span>
            </div>
          </div>
        </div>

        {/* Balance Card */}
        <div className="rounded-lg border border-border bg-card p-4 flex flex-col items-center justify-center">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Current Balance</h3>
          <p className={`text-2xl font-bold ${balanceColor}`}>
            {formatNPR(Math.abs(party.ledger_balance), { showSymbol: true })}
          </p>
          <span className={`text-xs font-medium mt-1 ${balanceColor}`}>{balanceLabel}</span>
        </div>
      </div>

      {/* Notes */}
      {party.notes && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Notes</h3>
          <p className="text-sm text-foreground whitespace-pre-wrap">{party.notes}</p>
        </div>
      )}

      {/* Ledger Section */}
      <div className="space-y-3">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">Transaction Ledger</h2>
          </div>
          <div className="flex items-end gap-3">
            <div>
              <Label className="text-xs">From</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 text-xs w-36" />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 text-xs w-36" />
            </div>
            {ledgerData?.entries.length ? (
              <Button variant="outline" size="sm" className="gap-1 text-xs h-8" onClick={handleExport}>
                <Download className="h-3 w-3" /> CSV
              </Button>
            ) : null}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {ledgerLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : !ledgerData?.entries.length ? (
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
                  {ledgerData.entries.map((e, i) => (
                    <tr key={i} className={`border-b border-border last:border-0 ${i === 0 ? 'bg-muted/30 italic' : ''}`}>
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
                    <td className={`px-3 py-2 text-right font-bold ${ledgerData.closingBalance >= 0 ? 'text-foreground' : 'text-success'}`}>
                      {formatNPR(Math.abs(ledgerData.closingBalance), { showSymbol: false })} {ledgerData.closingBalance < 0 ? 'Cr' : 'Dr'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      <PartyDialog open={editOpen} onOpenChange={setEditOpen} party={party} onSave={handleSave} loading={saving} />
      <StandalonePaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        direction={paymentDirection}
        loading={recordStandalonePayment.isPending}
        onSubmit={(data) => {
          recordStandalonePayment.mutate(
            { ...data, party_id: party.id } as any,
            {
              onSuccess: () => {
                toast({ title: 'Payment recorded' });
                setPaymentOpen(false);
              },
              onError: (err: any) => {
                toast({ title: 'Error', description: err.message, variant: 'destructive' });
              },
            }
          );
        }}
      />
    </div>
  );
}
