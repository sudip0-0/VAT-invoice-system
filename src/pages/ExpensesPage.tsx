import { useMemo, useState } from 'react';
import { Download, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useExpenses } from '@/hooks/useReports';
import { useToast } from '@/hooks/use-toast';
import { formatNPR } from '@/lib/nepal-format';
import { adToBS, formatBSShort } from '@/lib/bs-calendar';
import { formatLocalDate, nepalNow } from '@/lib/nepal-date';

function defaultRange() {
  const now = nepalNow();
  return {
    from: formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: formatLocalDate(now),
  };
}

export default function ExpensesPage() {
  const { toast } = useToast();
  const initial = useMemo(() => defaultRange(), []);
  const [dateFrom, setDateFrom] = useState(initial.from);
  const [dateTo, setDateTo] = useState(initial.to);
  const { data: expenses = [], isLoading, createExpense, deleteExpense } = useExpenses(dateFrom, dateTo);
  const [form, setForm] = useState({
    expense_date_ad: initial.to,
    category: 'General',
    description: '',
    amount: '',
    payment_method: 'cash',
    reference: '',
  });

  const total = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);

  const handleAdd = async () => {
    const amount = Number(form.amount);
    if (!form.description.trim() || !Number.isFinite(amount) || amount <= 0) {
      toast({ title: 'Expense needs a description and positive amount', variant: 'destructive' });
      return;
    }
    try {
      await createExpense.mutateAsync({
        category: form.category.trim() || 'General',
        description: form.description.trim(),
        amount,
        expense_date_ad: form.expense_date_ad,
        expense_date_bs: formatBSShort(adToBS(new Date(`${form.expense_date_ad}T00:00:00`))),
        payment_method: form.payment_method as any,
        reference: form.reference.trim() || null,
      });
      setForm((current) => ({ ...current, description: '', amount: '', reference: '' }));
      toast({ title: 'Expense added' });
    } catch (error) {
      toast({ title: 'Could not add expense', description: error instanceof Error ? error.message : 'Try again', variant: 'destructive' });
    }
  };

  const handleExport = () => {
    const headers = ['Date AD', 'Date BS', 'Category', 'Description', 'Amount', 'Method', 'Reference'];
    const rows = expenses.map((expense) => [
      expense.expense_date_ad,
      expense.expense_date_bs,
      expense.category,
      expense.description,
      String(expense.amount),
      expense.payment_method,
      expense.reference || '',
    ]);
    const csv = [headers.join(','), ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `expenses-${dateFrom}-${dateTo}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 animate-fade-in max-w-4xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Expenses</h1>
          <p className="text-xs text-muted-foreground">Operating expenses used by Profit &amp; Loss reports.</p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={handleExport} disabled={expenses.length === 0}>
          <Download className="h-3.5 w-3.5" /> Export CSV
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 rounded-lg border border-border bg-card p-3">
        <div>
          <Label className="text-xs">From</Label>
          <Input type="date" className="h-8 text-xs" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">To</Label>
          <Input type="date" className="h-8 text-xs" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Add Expense</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Date</Label>
            <Input type="date" className="h-8 text-xs" value={form.expense_date_ad} onChange={(e) => setForm((f) => ({ ...f, expense_date_ad: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs">Amount</Label>
            <Input type="number" min="0" step="0.01" className="h-8 text-xs" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs">Category</Label>
            <Input className="h-8 text-xs" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs">Reference</Label>
            <Input className="h-8 text-xs" value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Description</Label>
            <Input className="h-8 text-xs" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Rent, salary, fuel..." />
          </div>
        </div>
        <Button size="sm" className="gap-1 text-xs" onClick={handleAdd} disabled={createExpense.isPending}>
          <Plus className="h-3.5 w-3.5" /> Save Expense
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <h2 className="text-sm font-semibold text-foreground">Expense List</h2>
          <span className="text-xs font-semibold text-destructive">{formatNPR(total)}</span>
        </div>
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : expenses.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No expenses in this date range.</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Date</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Category</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Description</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">Amount</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => (
                <tr key={expense.id} className="border-t border-border">
                  <td className="px-3 py-2 text-foreground">{expense.expense_date_bs}</td>
                  <td className="px-3 py-2 text-muted-foreground">{expense.category}</td>
                  <td className="px-3 py-2 text-foreground">{expense.description}</td>
                  <td className="px-3 py-2 text-right font-medium text-destructive">{formatNPR(Number(expense.amount), { showSymbol: false })}</td>
                  <td className="px-3 py-2 text-right">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteExpense.mutate(expense.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
