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
import { localDb } from '@/integrations/local-db/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Plus, Trash2, Save, ShieldCheck } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import SetupReadinessChecklist from '@/components/SetupReadinessChecklist';
import { verifyAuditHashChain } from '@/lib/audit-chain';
import { useInvoices } from '@/hooks/useInvoices';
import { calculateVATLine, reconcileLineTotals, STATUTORY_VAT_RATE } from '@/lib/vat-compliance';
import { formatBSShort, getVATPeriod, todayBS } from '@/lib/bs-calendar';
import { nepalTodayISO } from '@/lib/nepal-date';
import { updatePasswordSchema } from '@/lib/schemas/auth';

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
          <TabsTrigger value="setup" className="text-xs px-3">Setup</TabsTrigger>
          <TabsTrigger value="tax" className="text-xs px-3">Tax Rates</TabsTrigger>
          <TabsTrigger value="cbms" className="text-xs px-3">CBMS</TabsTrigger>
          <TabsTrigger value="user" className="text-xs px-3">My Profile</TabsTrigger>
          <TabsTrigger value="data" className="text-xs px-3">Data</TabsTrigger>
        </TabsList>

        <TabsContent value="business" className="mt-4">
          <BusinessProfileTab />
        </TabsContent>
        <TabsContent value="setup" className="mt-4">
          <SetupReadinessChecklist />
        </TabsContent>
        <TabsContent value="tax" className="mt-4">
          <TaxRatesTab />
        </TabsContent>
        <TabsContent value="cbms" className="mt-4">
          <CBMSStatusTab />
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

function CBMSStatusTab() {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">IRD CBMS / E-billing Status</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Not configured. This desktop app does not submit invoices to IRD, does not have an IRD-approved CBMS integration, and does not claim e-billing certification.
        </p>
      </div>
      <div className="grid gap-2 text-xs">
        <div className="rounded-md border border-border p-3">
          <p className="font-medium text-foreground">Configuration</p>
          <p className="text-muted-foreground">Requires IRD/accountant confirmation before any statutory e-billing use.</p>
        </div>
        <div className="rounded-md border border-border p-3">
          <p className="font-medium text-foreground">Integration</p>
          <p className="text-muted-foreground">Not implemented. No API credentials, submission IDs, or IRD acknowledgements are stored.</p>
        </div>
        <div className="rounded-md border border-border p-3">
          <p className="font-medium text-foreground">Operator action</p>
          <p className="text-muted-foreground">Use local invoices and reports only after accountant review; do not present exports as IRD-submitted records.</p>
        </div>
      </div>
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
    if (form.is_vat_registered && !form.pan_number.trim()) {
      toast({ title: 'PAN/VAT number is required for VAT-registered businesses', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await localDb
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
      const { data, error } = await localDb
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
      const { error } = await localDb.from('tax_rates').insert({
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
      const { error } = await localDb.from('tax_rates').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteRate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await localDb.from('tax_rates').delete().eq('id', id);
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
              <Select value={newType} onValueChange={(value) => {
                setNewType(value);
                if (value === 'vat_13') setNewRate('13');
                if (value === 'exempt' || value === 'zero_rated' || value === 'non_taxable') setNewRate('0');
              }}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TAX_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Rate (%)</Label>
              <Input type="number" step="0.01" min="0" value={newRate} onChange={(e) => setNewRate(e.target.value)} className="h-9 text-sm" disabled={newType === 'vat_13'} />
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
      const { data, error } = await localDb
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
    const { error } = await localDb
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
    const parsed = updatePasswordSchema.safeParse({ currentPassword: currentPw, password: newPw });
    if (!parsed.success) {
      toast({ title: parsed.error.issues[0]?.message || 'Invalid password', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await localDb.auth.updateUser({
      currentPassword: parsed.data.currentPassword,
      password: parsed.data.password,
    });
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
            <Label htmlFor="settings-current-password" className="text-xs">Current Password</Label>
            <Input
              id="settings-current-password"
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              className="h-9 text-sm"
              placeholder="Current password"
              autoComplete="current-password"
            />
          </div>
          <div>
            <Label htmlFor="settings-new-password" className="text-xs">New Password</Label>
            <Input
              id="settings-new-password"
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              className="h-9 text-sm"
              placeholder="Min 8 characters"
              autoComplete="new-password"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button size="sm" variant="outline" className="text-xs" onClick={handleChangePassword} disabled={saving || !newPw || !currentPw}>
            Update Password
          </Button>
        </div>
      </div>
    </div>
  );
}

function DesktopDataTab() {
  const { toast } = useToast();
  const { business } = useBusiness();
  const qc = useQueryClient();
  const { createInvoice } = useInvoices();
  const [busyAction, setBusyAction] = useState<'backup' | 'restore' | 'verify' | 'demo' | null>(null);
  const [auditStatus, setAuditStatus] = useState<'not_checked' | 'verified' | 'warning' | 'failed'>(
    () => (localStorage.getItem(`audit-verification-status:${business?.id || 'none'}`) as any) || 'not_checked'
  );
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(() =>
    business?.id ? localStorage.getItem(`last-backup-at:${business.id}`) : null
  );

  useEffect(() => {
    if (!business?.id) return;
    setAuditStatus((localStorage.getItem(`audit-verification-status:${business.id}`) as any) || 'not_checked');
    setLastBackupAt(localStorage.getItem(`last-backup-at:${business.id}`));
  }, [business?.id]);

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
      const timestamp = new Date().toISOString();
      if (business?.id) {
        localStorage.setItem(`last-backup-at:${business.id}`, timestamp);
        localStorage.removeItem(`backup-reminder-ack:${business.id}`);
        setLastBackupAt(timestamp);
        qc.invalidateQueries({ queryKey: ['setup-readiness', business.id] });
      }
      toast({ title: 'Backup created', description: response.data?.path || 'Database backup saved.' });
    }
  };

  const handleRestore = async () => {
    if (!window.desktopApi) {
      toast({ title: 'Desktop runtime unavailable', description: 'Restore is only available in the Electron desktop app.', variant: 'destructive' });
      return;
    }

    const confirmed = window.confirm(
      'Restore will replace the current database. A pre-restore safety copy is created automatically. Backups include local password hashes — only restore trusted files. Continue?'
    );
    if (!confirmed) return;

    setBusyAction('restore');
    const response = await window.desktopApi.system.restoreBackup();
    setBusyAction(null);

    if (response.error) {
      toast({ title: 'Restore failed', description: response.error.message, variant: 'destructive' });
      return;
    }

    if (!response.data?.canceled) {
      if (business?.id) {
        localStorage.setItem(`audit-verification-status:${business.id}`, 'warning');
        setAuditStatus('warning');
      }
      toast({
        title: 'Backup restored',
        description: response.data?.safetyPath
          ? `Safety copy: ${response.data.safetyPath}. Restart and verify audit chains.`
          : 'Restart the app and verify invoice audit hash chains before relying on restored records.',
      });
    }
  };

  const handleOpenLogs = async () => {
    if (!window.desktopApi?.system.openLogs) {
      toast({ title: 'Desktop runtime unavailable', variant: 'destructive' });
      return;
    }
    const result = await window.desktopApi.system.openLogs();
    if (!result.ok) {
      toast({ title: 'Could not open logs', description: result.error, variant: 'destructive' });
    }
  };

  const handleAcknowledgeBackupReminder = () => {
    if (!business?.id) return;
    localStorage.setItem(`backup-reminder-ack:${business.id}`, 'true');
    qc.invalidateQueries({ queryKey: ['setup-readiness', business.id] });
    toast({ title: 'Backup reminder acknowledged' });
  };

  const handleVerifyAuditChains = async () => {
    if (!business?.id) return;
    try {
      setBusyAction('verify');
      const { data, error } = await localDb
        .from('invoice_events')
        .select('*')
        .eq('business_id', business.id)
        .order('created_at', { ascending: true });
      if (error) throw error;

      const grouped = new Map<string, any[]>();
      for (const event of data || []) {
        const list = grouped.get(event.invoice_id) || [];
        list.push(event);
        grouped.set(event.invoice_id, list);
      }

      let failed = false;
      let warning = grouped.size === 0;
      for (const events of grouped.values()) {
        const result = await verifyAuditHashChain(events);
        if (!result.valid) {
          failed = true;
          break;
        }
      }

      const nextStatus = failed ? 'failed' : warning ? 'warning' : 'verified';
      localStorage.setItem(`audit-verification-status:${business.id}`, nextStatus);
      setAuditStatus(nextStatus);
      toast({
        title: nextStatus === 'verified' ? 'Audit chains verified' : nextStatus === 'warning' ? 'No audit events found' : 'Audit verification failed',
        variant: nextStatus === 'failed' ? 'destructive' : undefined,
      });
    } catch (e: any) {
      setAuditStatus('failed');
      toast({ title: 'Audit verification failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusyAction(null);
    }
  };

  const handleCreateDemoData = async () => {
    if (!business?.id) return;
    if (!business.is_vat_registered || !business.pan_number?.trim()) {
      toast({ title: 'Demo data needs a VAT test business', description: 'Mark this test business as VAT registered and add a 9-digit PAN before creating VAT demo data.', variant: 'destructive' });
      return;
    }
    try {
      setBusyAction('demo');
      const { data: existingSample, error: existingErr } = await localDb
        .from('parties')
        .select('id')
        .eq('business_id', business.id)
        .ilike('name', 'Sample VAT Customer%')
        .limit(1);
      if (existingErr) throw existingErr;
      if (existingSample?.length) {
        toast({ title: 'Demo data already exists', description: 'Sample records were not added again.' });
        return;
      }

      const customerId = crypto.randomUUID();
      const vendorId = crypto.randomUUID();
      const productId = crypto.randomUUID();
      const serviceId = crypto.randomUUID();
      const todayAd = nepalTodayISO();
      const todayBs = todayBS();
      const todayBsText = formatBSShort(todayBs);
      const now = new Date().toISOString();

      await localDb.from('parties').insert([
        {
          id: customerId,
          business_id: business.id,
          type: 'customer',
          name: 'Sample VAT Customer',
          phone: '9800000000',
          pan_number: '123456789',
          address: 'Sample Market Road',
          city: 'Kathmandu',
          notes: 'Sample/test data',
        },
        {
          id: vendorId,
          business_id: business.id,
          type: 'vendor',
          name: 'Sample VAT Vendor',
          phone: '9811111111',
          pan_number: '987654321',
          address: 'Sample Supplier Marg',
          city: 'Lalitpur',
          notes: 'Sample/test data',
        },
      ]);

      await localDb.from('items').insert([
        {
          id: productId,
          business_id: business.id,
          code: 'SAMPLE-PROD',
          name: 'Sample Taxable Product',
          description: 'Sample/test data',
          type: 'product',
          unit: 'PCS',
          purchase_price: 700,
          sale_price: 1000,
          opening_stock: 25,
          current_stock: 25,
          low_stock_alert: 5,
          hsn_code: 'SAMPLE',
        },
        {
          id: serviceId,
          business_id: business.id,
          code: 'SAMPLE-SVC',
          name: 'Sample Service',
          description: 'Sample/test data',
          type: 'service',
          unit: 'JOB',
          sale_price: 1500,
          opening_stock: 0,
          current_stock: 0,
          hsn_code: 'SERVICE',
        },
      ]);

      const saleLine = calculateVATLine({ quantity: 2, rate: 1000, tax_type: 'vat_13' });
      const saleTotals = reconcileLineTotals([saleLine]);
      const saleId = await createInvoice.mutateAsync({
        invoice: {
          invoice_number: `${business.invoice_prefix || 'INV'}-${String(business.next_sales_invoice_num || business.next_invoice_num || 1).padStart(4, '0')}`,
          type: 'sale',
          status: 'issued',
          customer_id: customerId,
          buyer_name: 'Sample VAT Customer',
          buyer_pan: '123456789',
          buyer_phone: '9800000000',
          buyer_address: 'Sample Market Road, Kathmandu',
          is_vat_invoice: true,
          issued_date_ad: todayAd,
          issued_date_bs: todayBsText,
          vat_period: getVATPeriod(todayBs),
          sub_total: 2000,
          discount_amount: saleTotals.discount_amount,
          taxable_amount: saleTotals.taxable_amount,
          vat_amount: saleTotals.vat_amount,
          total_amount: saleTotals.total_amount,
          paid_amount: 1000,
          balance_due: saleTotals.total_amount - 1000,
          notes: 'Sample/test data',
        },
        items: [{
          item_id: productId,
          hsn_code: 'SAMPLE',
          name: 'Sample Taxable Product',
          unit: 'PCS',
          quantity: 2,
          rate: 1000,
          discount_pct: 0,
          discount_amt: saleLine.discount_amt,
          tax_type: 'vat_13',
          vat_rate: STATUTORY_VAT_RATE,
          taxable_amount: saleLine.taxable_amount,
          vat_amount: saleLine.vat_amount,
          total_amount: saleLine.total_amount,
        }],
      });

      const purchaseLine = calculateVATLine({ quantity: 3, rate: 700, tax_type: 'vat_13' });
      const purchaseTotals = reconcileLineTotals([purchaseLine]);
      await createInvoice.mutateAsync({
        invoice: {
          invoice_number: `PUR-${String(business.next_purchase_bill_num || 1).padStart(4, '0')}`,
          type: 'purchase',
          status: 'issued',
          vendor_id: vendorId,
          buyer_name: 'Sample VAT Vendor',
          buyer_pan: '987654321',
          is_vat_invoice: true,
          issued_date_ad: todayAd,
          issued_date_bs: todayBsText,
          vat_period: getVATPeriod(todayBs),
          sub_total: 2100,
          discount_amount: purchaseTotals.discount_amount,
          taxable_amount: purchaseTotals.taxable_amount,
          vat_amount: purchaseTotals.vat_amount,
          total_amount: purchaseTotals.total_amount,
          paid_amount: 0,
          balance_due: purchaseTotals.total_amount,
          notes: 'Sample/test data',
        },
        items: [{
          item_id: productId,
          hsn_code: 'SAMPLE',
          name: 'Sample Taxable Product',
          unit: 'PCS',
          quantity: 3,
          rate: 700,
          discount_pct: 0,
          discount_amt: purchaseLine.discount_amt,
          tax_type: 'vat_13',
          vat_rate: STATUTORY_VAT_RATE,
          taxable_amount: purchaseLine.taxable_amount,
          vat_amount: purchaseLine.vat_amount,
          total_amount: purchaseLine.total_amount,
        }],
      });

      await createInvoice.mutateAsync({
        invoice: {
          invoice_number: `CN-${String(business.next_credit_note_num || 1).padStart(4, '0')}`,
          type: 'sale_return',
          status: 'draft',
          customer_id: customerId,
          buyer_name: 'Sample VAT Customer',
          buyer_pan: '123456789',
          is_vat_invoice: true,
          issued_date_ad: todayAd,
          issued_date_bs: todayBsText,
          vat_period: getVATPeriod(todayBs),
          sub_total: 1000,
          discount_amount: 0,
          taxable_amount: 1000,
          vat_amount: 130,
          total_amount: 1130,
          paid_amount: 0,
          balance_due: 0,
          original_invoice_id: saleId,
          original_invoice_number: 'Sample sale invoice',
          correction_reason: 'Sample/test data partial return review',
          correction_type: 'credit',
          notes: 'Sample/test data',
          reference_number: 'Sample sale invoice',
        },
        items: [{
          item_id: productId,
          hsn_code: 'SAMPLE',
          name: 'Sample Taxable Product',
          unit: 'PCS',
          quantity: 1,
          rate: 1000,
          discount_pct: 0,
          discount_amt: 0,
          tax_type: 'vat_13',
          vat_rate: STATUTORY_VAT_RATE,
          taxable_amount: 1000,
          vat_amount: 130,
          total_amount: 1130,
        }],
      });

      await localDb.from('expenses').insert({
        business_id: business.id,
        category: 'Sample',
        description: 'Sample/test data office expense',
        amount: 500,
        expense_date_ad: todayAd,
        expense_date_bs: todayBsText,
        payment_method: 'cash',
        notes: 'Sample/test data',
        created_at: now,
        updated_at: now,
      });

      qc.invalidateQueries();
      toast({ title: 'Demo data created', description: 'Sample customer, vendor, items, invoices, payment, correction note, and expense were added.' });
    } catch (e: any) {
      toast({ title: 'Demo data failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusyAction(null);
    }
  };

  const auditStatusLabel = {
    not_checked: 'Not checked',
    verified: 'Verified',
    warning: 'Warning',
    failed: 'Failed',
  }[auditStatus];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Local Data</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            This desktop app stores invoices, stock, reports, and settings in a local SQLite database on this machine.
          </p>
        </div>
        <div className="grid gap-2 text-xs">
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <p className="font-medium text-foreground">Last backup</p>
              <p className="text-muted-foreground">{lastBackupAt ? new Date(lastBackupAt).toLocaleString() : 'No backup recorded on this device.'}</p>
            </div>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={handleAcknowledgeBackupReminder}>
              Acknowledge
            </Button>
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <p className="font-medium text-foreground">Audit verification</p>
              <p className="text-muted-foreground">Status: {auditStatusLabel}</p>
            </div>
            {auditStatus === 'verified' ? (
              <CheckCircle2 className="h-4 w-4 text-success" />
            ) : auditStatus === 'failed' ? (
              <AlertTriangle className="h-4 w-4 text-destructive" />
            ) : (
              <ShieldCheck className="h-4 w-4 text-warning" />
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Backups are checksummed (`.sha256` sidecar) and include local account password hashes. Store them privately. Installer builds are unsigned in this channel — see TESTER_GUIDE.
          </p>
          <Button size="sm" className="text-xs" onClick={handleBackup} disabled={busyAction !== null}>
            {busyAction === 'backup' ? 'Creating Backup...' : 'Create Backup'}
          </Button>
          <Button size="sm" variant="outline" className="text-xs" onClick={handleRestore} disabled={busyAction !== null}>
            {busyAction === 'restore' ? 'Restoring Backup...' : 'Restore Backup'}
          </Button>
          <Button size="sm" variant="outline" className="text-xs" onClick={handleOpenLogs} disabled={busyAction !== null}>
            Open Logs Folder
          </Button>
          <Button size="sm" variant="outline" className="text-xs" onClick={handleVerifyAuditChains} disabled={busyAction !== null}>
            {busyAction === 'verify' ? 'Verifying...' : 'Verify Audit Chains'}
          </Button>
          <Button size="sm" variant="outline" className="text-xs" onClick={handleCreateDemoData} disabled={busyAction !== null}>
            {busyAction === 'demo' ? 'Creating Demo...' : 'Create Demo Data'}
          </Button>
        </div>
      </div>
    </div>
  );
}
