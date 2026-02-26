import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface Business {
  id: string;
  name: string;
  type: string;
  pan_number: string | null;
  is_vat_registered: boolean;
  address: string;
  city: string;
  phone: string;
  invoice_prefix: string;
  next_invoice_num: number;
}

interface BusinessContextType {
  business: Business | null;
  businesses: Business[];
  role: string | null;
  loading: boolean;
  switchBusiness: (id: string) => void;
  refetch: () => void;
}

const BusinessContext = createContext<BusinessContextType | undefined>(undefined);

export function BusinessProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [business, setBusiness] = useState<Business | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBusinesses = useCallback(async () => {
    if (!user) {
      setBusiness(null);
      setBusinesses([]);
      setRole(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Get user's business memberships
    const { data: memberships } = await supabase
      .from('business_users')
      .select('business_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (!memberships || memberships.length === 0) {
      setBusinesses([]);
      setBusiness(null);
      setRole(null);
      setLoading(false);
      return;
    }

    const bizIds = memberships.map((m) => m.business_id);
    const { data: bizzes } = await supabase
      .from('businesses')
      .select('*')
      .in('id', bizIds)
      .is('deleted_at', null);

    const bizList = (bizzes || []) as Business[];
    setBusinesses(bizList);

    // Get active business from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('active_business_id')
      .eq('user_id', user.id)
      .single();

    const activeId = profile?.active_business_id;
    const activeBiz = bizList.find((b) => b.id === activeId) || bizList[0] || null;
    setBusiness(activeBiz);

    if (activeBiz) {
      const membership = memberships.find((m) => m.business_id === activeBiz.id);
      setRole(membership?.role || null);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }
    fetchBusinesses();
  }, [user, authLoading, fetchBusinesses]);

  const switchBusiness = async (id: string) => {
    const biz = businesses.find((b) => b.id === id);
    if (biz && user) {
      setBusiness(biz);
      await supabase.from('profiles').update({ active_business_id: id }).eq('user_id', user.id);
    }
  };

  return (
    <BusinessContext.Provider value={{ business, businesses, role, loading, switchBusiness, refetch: fetchBusinesses }}>
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness() {
  const context = useContext(BusinessContext);
  if (!context) throw new Error('useBusiness must be used within BusinessProvider');
  return context;
}
