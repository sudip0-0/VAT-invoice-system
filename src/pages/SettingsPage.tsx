import { useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useBusiness } from '@/contexts/BusinessContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Save } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const BUSINESS_TYPES = ['kirana', 'wholesale', 'retail', 'restaurant', 'pharmacy', 'service', 'manufacturer', 'other'];
const TAX_TYPES = [
  { value: 'vat_13', label: 'VAT 13%' },
  { value: 'exempt', label: 'Exempt' },
  { value: 'zero_rated', label: 'Zero Rated' },
  { value: 'non_taxable', label: 'Non Taxable' },
];

export default function SettingsPage() {
  return (
    <div className="space-y-4 animate-fade-in max-w-3xl">
      <h1 className="text-xl font-bold text-foreground">Settings</h1>

      <Tabs defaultValue="business">
        <TabsList className="h-8">
          <TabsTrigger value="business" className="text-xs px-3">Business Profile</TabsTrigger>
          <TabsTrigger value="tax" className="text-xs px-3">Tax Rates</TabsTrigger>
          <TabsTrigger value="user" className="text-xs px-3">My Profile</TabsTrigger>
          <TabsTrigger value="data" className="text-xs px-3">Data</TabsTrigger>
        </TabsList>

        <TabsContent value="business" className="mt-4">
          <BusinessProfileTab />
        </TabsContent>
        <TabsContent value="tax" className="mt-4">
          <TaxRatesTab />
        </TabsContent>
        <TabsContent value="user" className="mt-4">
          <UserProfileTab />
        </TabsContent>
        <TabsContent value="data" className="mt-4">
          <DesktopDataTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BusinessProfileTab() {
  const { business, refetch } = useBusiness();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', type: 'retail', address: '', city: '', phone: '', email: '',
    pan_number: '', is_vat_registered: false, invoice_prefix: 'INV', province: '',
  });

  useEffect(() => {
    if (business) {
      setForm({
        name: business.name,
        type: business.type,
        address: business.address,
        city: business.city,
        phone: business.phone,
        email: (business as any).email || '',
        pan_number: business.pan_number || '',
        is_vat_registered: business.is_vat_registered,
        invoice_prefix: business.invoice_prefix,
        province: (business as any).province || '',
      });
    }
  }, [business]);

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!business) return;
    setSaving(true);
    const { error } = await supabase
      .from('businesses')
      .update({
        name: form.name,
        type: form.type as any,
        address: form.address,
        city: form.city,
        phone: form.phone,
        email: form.email || null,
        pan_number: form.pan_number || null,
        is_vat_registered: form.is_vat_registered,
        invoice_prefix: form.invoice_prefix,
        province: form.province || null,
      })
      .eq('id', business.id);
    setSaving(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Business updated' });
      refetch();
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <Label className="text-xs">Business Name *</Label>
          <Input value={form.name} onChange={(e) => set('name', e.target.value)} className="h-9 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Type</Label>
          <Select value={form.type} onValueChange={(v) => set('type', v)}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {BUSINESS_TYPES.map((t) => (
                <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">PAN Number</Label>
          <Input value={form.pan_number} onChange={(e) => set('pan_number', e.target.value)} className="h-9 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Phone</Label>
          <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} className="h-9 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Email</Label>
          <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className="h-9 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Address</Label>
          <Input value={form.address} onChange={(e) => set('address', e.target.value)} className="h-9 text-sm" />
        </div>
        <div>
          <Label className="text-xs">City</Label>
          <Input value={form.city} onChange={(e) => set('city', e.target.value)} className="h-9 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Province</Label>
          <Input value={form.province} onChange={(e) => set('province', e.target.value)} className="h-9 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Invoice Prefix</Label>
          <Input value={form.invoice_prefix} onChange={(e) => set('invoice_prefix', e.target.value)} className="h-9 text-sm w-28" />
        </div>
        <div className="flex items-center gap-3 pt-4">
          <Switch checked={form.is_vat_registered} onCheckedChange={(v) => set('is_vat_registered', v)} />
          <Label className="text-xs">VAT Registered</Label>
        </div>
      </div>
      <div className="flex justify-end">
        <Button size="sm" className="gap-1.5 text-xs" onClick={handleSave} disabled={saving}>
          <Save className="h-3.5 w-3.5" /> Save Changes
        </Button>
      </div>
    </div>
  );
}

function TaxRatesTab() {
  const { business } = useBusiness();
  const { toast } = useToast();
  const qc = useQueryClient();
  const key = ['tax_rates_settings', business?.id];

  const { data: taxRates = [], isLoading } = useQuery({
    queryKey: key,
    enabled: !!business?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tax_rates')
        .select('*')
        .eq('business_id', business!.id)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('vat_13');
  const [newRate, setNewRate] = useState('13');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const addRate = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('tax_rates').insert({
        business_id: business!.id,
        name: newName.trim(),
        type: newType as any,
        rate: Number(newRate),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast({ title: 'Tax rate added' });
      setShowAdd(false);
      setNewName('');
      setNewRate('13');
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('tax_rates').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteRate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tax_rates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast({ title: 'Tax rate deleted' });
      setDeletingId(null);
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setShowAdd(true)}>
          <Plus className="h-3.5 w-3.5" /> Add Tax Rate
        </Button>
      </div>

      {showAdd && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Name *</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} className="h-9 text-sm" placeholder="e.g. VAT 13%" />
            </div>
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TAX_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Rate (%)</Label>
              <Input type="number" step="0.01" min="0" value={newRate} onChange={(e) => setNewRate(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button size="sm" onClick={() => addRate.mutate()} disabled={!newName.trim() || addRate.isPending}>Add</Button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : taxRates.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No tax rates configured.</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Type</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Rate</th>
                <th className="px-4 py-2.5 text-center font-medium text-muted-foreground">Active</th>
                <th className="px-4 py-2.5 text-center font-medium text-muted-foreground">Default</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {taxRates.map((tr) => (
                <tr key={tr.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium text-foreground">{tr.name}</td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">{tr.type.replace('_', ' ')}</td>
                  <td className="px-4 py-3 text-right text-foreground">{tr.rate}%</td>
                  <td className="px-4 py-3 text-center">
                    <Switch checked={tr.is_active} onCheckedChange={(v) => toggleActive.mutate({ id: tr.id, is_active: v })} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    {tr.is_default && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">Default</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeletingId(tr.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tax Rate</AlertDialogTitle>
            <AlertDialogDescription>This may affect existing invoices using this rate. Continue?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingId && deleteRate.mutate(deletingId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function UserProfileTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('name, phone')
        .eq('user_id', user!.id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setPhone(profile.phone || '');
    }
  }, [profile]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ name, phone: phone || null })
      .eq('user_id', user.id);
    setSaving(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Profile updated' });
    }
  };

  const handleChangePassword = async () => {
    if (!newPw || newPw.length < 6) {
      toast({ title: 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setSaving(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Password updated' });
      setCurrentPw('');
      setNewPw('');
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Profile</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Email</Label>
            <Input value={user?.email || ''} disabled className="h-9 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-9 text-sm" />
          </div>
        </div>
        <div className="flex justify-end">
          <Button size="sm" className="gap-1.5 text-xs" onClick={handleSaveProfile} disabled={saving}>
            <Save className="h-3.5 w-3.5" /> Save Profile
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Change Password</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">New Password</Label>
            <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} className="h-9 text-sm" placeholder="Min 6 characters" />
          </div>
        </div>
        <div className="flex justify-end">
          <Button size="sm" variant="outline" className="text-xs" onClick={handleChangePassword} disabled={saving || !newPw}>
            Update Password
          </Button>
        </div>
      </div>
    </div>
  );
}

function DesktopDataTab() {
  const { toast } = useToast();
  const [busyAction, setBusyAction] = useState<'backup' | 'restore' | null>(null);

  const handleBackup = async () => {
    if (!window.desktopApi) {
      toast({ title: 'Desktop runtime unavailable', description: 'Backups are only available in the Electron desktop app.', variant: 'destructive' });
      return;
    }

    setBusyAction('backup');
    const response = await window.desktopApi.system.createBackup();
    setBusyAction(null);

    if (response.error) {
      toast({ title: 'Backup failed', description: response.error.message, variant: 'destructive' });
      return;
    }

    if (!response.data?.canceled) {
      toast({ title: 'Backup created', description: response.data?.path || 'Database backup saved.' });
    }
  };

  const handleRestore = async () => {
    if (!window.desktopApi) {
      toast({ title: 'Desktop runtime unavailable', description: 'Restore is only available in the Electron desktop app.', variant: 'destructive' });
      return;
    }

    setBusyAction('restore');
    const response = await window.desktopApi.system.restoreBackup();
    setBusyAction(null);

    if (response.error) {
      toast({ title: 'Restore failed', description: response.error.message, variant: 'destructive' });
      return;
    }

    if (!response.data?.canceled) {
      toast({ title: 'Backup restored', description: 'Restart the app or refresh this window to reload restored data.' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Local Data</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            This desktop app stores invoices, stock, reports, and settings in a local SQLite database on this machine.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" className="text-xs" onClick={handleBackup} disabled={busyAction !== null}>
            {busyAction === 'backup' ? 'Creating Backup...' : 'Create Backup'}
          </Button>
          <Button size="sm" variant="outline" className="text-xs" onClick={handleRestore} disabled={busyAction !== null}>
            {busyAction === 'restore' ? 'Restoring Backup...' : 'Restore Backup'}
          </Button>
        </div>
      </div>
    </div>
  );
}
