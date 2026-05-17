import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FilePlus2, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { localDb } from '@/integrations/local-db/client';
import { useBusiness } from '@/contexts/BusinessContext';
import { formatNPR } from '@/lib/nepal-format';
import StatusBadge from '@/components/shared/StatusBadge';
import type { InvoiceWithParty } from '@/hooks/useInvoices';

export default function CorrectionNotesPage() {
  const navigate = useNavigate();
  const { business } = useBusiness();
  const [search, setSearch] = useState('');
  const cleanSearch = search.trim();

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['correction_notes', business?.id, cleanSearch],
    enabled: !!business?.id,
    queryFn: async () => {
      let query = localDb
        .from('invoices')
        .select('*, customer:parties!invoices_customer_id_fkey(name), vendor:parties!invoices_vendor_id_fkey(name)')
        .eq('business_id', business!.id)
        .is('deleted_at', null)
        .in('type', ['sale_return', 'purchase_return']);
      if (cleanSearch) query = query.ilike('invoice_number', `%${cleanSearch}%`);
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return data as InvoiceWithParty[];
    },
  });

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Credit / Debit Notes</h1>
          <p className="text-xs text-muted-foreground">Create draft notes from an issued invoice, adjust lines as needed, then issue the note while the original invoice stays unchanged.</p>
        </div>
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => navigate('/invoices')}>
          <FilePlus2 className="h-3.5 w-3.5" /> Select Invoice
        </Button>
      </div>

      <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground max-w-xs">
        <Search className="h-3.5 w-3.5" />
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search notes..."
          className="w-full bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
        />
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
        ) : notes.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No correction notes found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Note #</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Type</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Original Invoice</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Party</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">VAT</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Total</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {notes.map((note) => (
                  <tr key={note.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate(`/invoices/${note.id}`)}>
                    <td className="px-4 py-3 font-medium text-foreground">{note.invoice_number}</td>
                    <td className="px-4 py-3 text-muted-foreground">{note.type === 'sale_return' ? 'Credit Note' : 'Debit Note'}</td>
                    <td className="px-4 py-3 text-foreground">{note.original_invoice_number || note.reference_number || '-'}</td>
                    <td className="px-4 py-3 text-foreground">{note.buyer_name || note.customer?.name || note.vendor?.name || '-'}</td>
                    <td className="px-4 py-3 text-right text-foreground">{formatNPR(note.vat_amount, { showSymbol: false })}</td>
                    <td className="px-4 py-3 text-right font-medium text-foreground">{formatNPR(note.total_amount, { showSymbol: false })}</td>
                    <td className="px-4 py-3"><StatusBadge status={note.status.toUpperCase()} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
