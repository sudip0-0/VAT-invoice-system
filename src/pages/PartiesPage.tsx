import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';
import { useParties, type PartyWithBalance } from '@/hooks/useParties';
import { formatNPR } from '@/lib/nepal-format';
import PartyDialog, { type PartyFormData } from '@/components/parties/PartyDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

type TabType = 'all' | 'customer' | 'vendor';

export default function PartiesPage() {
  const [tab, setTab] = useState<TabType>('all');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editParty, setEditParty] = useState<PartyWithBalance | null>(null);
  const [deleteParty, setDeleteParty] = useState<PartyWithBalance | null>(null);
  const [saving, setSaving] = useState(false);

  const navigate = useNavigate();
  const { data: parties = [], isLoading, createParty, updateParty, deleteParty: deletePartyMutation } = useParties();
  const { toast } = useToast();

  const filtered = parties.filter((p) => {
    if (tab !== 'all' && p.type !== tab && p.type !== 'both') return false;
    if (search) {
      const q = search.toLowerCase();
      return p.name.toLowerCase().includes(q) || (p.phone || '').includes(q) || (p.pan_number || '').includes(q);
    }
    return true;
  });

  const handleSave = async (data: PartyFormData) => {
    setSaving(true);
    try {
      if (editParty) {
        await updateParty.mutateAsync({ id: editParty.id, ...data });
        toast({ title: 'Party updated' });
      } else {
        await createParty.mutateAsync(data);
        toast({ title: 'Party added' });
      }
      setDialogOpen(false);
      setEditParty(null);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteParty) return;
    try {
      await deletePartyMutation.mutateAsync(deleteParty.id);
      toast({ title: 'Party deleted' });
      setDeleteParty(null);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const openCreate = () => { setEditParty(null); setDialogOpen(true); };
  const openEdit = (p: PartyWithBalance) => { setEditParty(p); setDialogOpen(true); };

  const tabs: { label: string; value: TabType }[] = [
    { label: 'All', value: 'all' },
    { label: 'Customers', value: 'customer' },
    { label: 'Vendors', value: 'vendor' },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Parties</h1>
        <button onClick={openCreate} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90 transition-opacity">
          <Plus className="h-3.5 w-3.5" />
          Add Party
        </button>
      </div>

      <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
        {tabs.map((t) => (
          <button key={t.value} onClick={() => setTab(t.value)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === t.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground max-w-xs">
        <Search className="h-3.5 w-3.5" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search parties..." className="w-full bg-transparent outline-none text-foreground placeholder:text-muted-foreground" />
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Type</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Phone</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">PAN</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Balance</th>
                <th className="px-4 py-2.5 text-center font-medium text-muted-foreground w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  {parties.length === 0 ? 'No parties yet. Add your first customer or vendor.' : 'No parties match your search.'}
                </td></tr>
              ) : filtered.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">
                    <button onClick={() => navigate(`/parties/${p.id}`)} className="hover:underline text-left">
                      {p.name}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] font-medium ${p.type === 'customer' ? 'text-success' : p.type === 'vendor' ? 'text-primary' : 'text-accent'}`}>
                      {p.type === 'customer' ? 'Customer' : p.type === 'vendor' ? 'Vendor' : 'Both'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.phone || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono">{p.pan_number || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    {p.ledger_balance !== 0 ? (
                      <span className={`font-medium ${p.ledger_balance > 0 ? 'text-success' : 'text-destructive'}`}>
                        {formatNPR(Math.abs(p.ledger_balance), { showSymbol: false })}
                        <span className="ml-1 text-[10px] text-muted-foreground">{p.ledger_balance > 0 ? 'Recv' : 'Pay'}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => openEdit(p)} className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setDeleteParty(p)} className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <PartyDialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditParty(null); }}
        party={editParty} onSave={handleSave} loading={saving} />

      <AlertDialog open={!!deleteParty} onOpenChange={(o) => { if (!o) setDeleteParty(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteParty?.name}?</AlertDialogTitle>
            <AlertDialogDescription>This party will be soft-deleted. Related invoices will not be affected.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
