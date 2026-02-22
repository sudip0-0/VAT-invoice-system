import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';


const businessTypes = [
  { value: 'kirana', label: 'Kirana / General Store' },
  { value: 'wholesale', label: 'Wholesale' },
  { value: 'retail', label: 'Retail Shop' },
  { value: 'restaurant', label: 'Restaurant / Cafe' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'service', label: 'Service Business' },
  { value: 'manufacturer', label: 'Manufacturer' },
  { value: 'other', label: 'Other' },
];

export default function BusinessSetupPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [type, setType] = useState('retail');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [isVat, setIsVat] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError('');
    setLoading(true);

    try {
      const businessId = crypto.randomUUID();

      // Create business (without .select() to avoid SELECT RLS check before business_users exists)
      const { error: bizError } = await supabase
        .from('businesses')
        .insert({
          id: businessId,
          name,
          type: type as any,
          address,
          city,
          phone,
          pan_number: panNumber || null,
          is_vat_registered: isVat,
        });

      if (bizError) throw bizError;

      // Add user as owner
      const { error: buError } = await supabase
        .from('business_users')
        .insert({
          business_id: businessId,
          user_id: user.id,
          role: 'owner' as any,
        });

      if (buError) throw buError;

      // Update profile with active business
      await supabase
        .from('profiles')
        .update({ active_business_id: businessId })
        .eq('user_id', user.id);

      // Create default tax rates
      await supabase.from('tax_rates').insert([
        { business_id: businessId, name: 'VAT 13%', type: 'vat_13' as any, rate: 13.0, is_default: true },
        { business_id: businessId, name: 'Exempt', type: 'exempt' as any, rate: 0, is_default: false },
        { business_id: businessId, name: 'Zero Rated', type: 'zero_rated' as any, rate: 0, is_default: false },
      ]);

      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Failed to create business');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md animate-fade-in">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-accent font-bold text-accent-foreground">V</div>
          <h1 className="text-xl font-bold text-foreground">Set Up Your Business</h1>
          <p className="text-sm text-muted-foreground mt-1">Enter your business details to get started</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>}

          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Business Name *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
              className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              placeholder="e.g., ABC Traders Pvt. Ltd." />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Business Type *</label>
            <select value={type} onChange={(e) => setType(e.target.value)}
              className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring">
              {businessTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">City *</label>
              <input type="text" value={city} onChange={(e) => setCity(e.target.value)} required
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                placeholder="Kathmandu" />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Phone *</label>
              <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} required
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                placeholder="01-4XXXXXX" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Address *</label>
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} required
              className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              placeholder="New Road, Kathmandu" />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">PAN Number</label>
            <input type="text" value={panNumber} onChange={(e) => setPanNumber(e.target.value)}
              className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              placeholder="9-digit PAN (optional)" maxLength={9} />
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="vat" checked={isVat} onChange={(e) => setIsVat(e.target.checked)}
              className="h-4 w-4 rounded border-input" />
            <label htmlFor="vat" className="text-sm text-foreground">VAT Registered</label>
          </div>

          <button type="submit" disabled={loading}
            className="w-full rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50">
            {loading ? 'Creating...' : 'Create Business & Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
