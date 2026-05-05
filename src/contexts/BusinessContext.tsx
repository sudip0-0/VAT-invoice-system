import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { localDb } from '@/integrations/local-db/client';

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
  next_sales_invoice_num: number;
  next_purchase_bill_num: number;
  next_quotation_num: number;
}

interface BusinessContextType {
  business: Business | null;
  businesses: Business[];
  role: string | null;
  loading: boolean;
  switchBusiness: (id: string) => Promise<void>;
  setNextInvoiceNum: (nextInvoiceNum: number) => void;
  setNextDocumentNum: (type: string | undefined, nextDocumentNum: number) => void;
  refetch: () => Promise<void>;
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
    const { data: memberships } = await localDb
      .from('business_users')
      .select('business_id, role, is_active')
      .eq('user_id', user.id);

    const activeMemberships = (memberships || []).filter((m) => m.is_active !== false);

    if (activeMemberships.length === 0) {
      setBusinesses([]);
      setBusiness(null);
      setRole(null);
      setLoading(false);
      return;
    }

    const bizIds = activeMemberships.map((m) => m.business_id);
    const { data: bizzes } = await localDb
      .from('businesses')
      .select('*')
      .in('id', bizIds)
      .is('deleted_at', null);

    const bizList = (bizzes || []) as Business[];
    setBusinesses(bizList);

    // Get active business from profile
    const { data: profile } = await localDb
      .from('profiles')
      .select('active_business_id')
      .eq('user_id', user.id)
      .single();

    const activeId = profile?.active_business_id;
    const activeBiz = bizList.find((b) => b.id === activeId) || bizList[0] || null;
    setBusiness(activeBiz);

    if (activeBiz) {
      const membership = activeMemberships.find((m) => m.business_id === activeBiz.id);
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
      const { data: membership } = await localDb
        .from('business_users')
        .select('role')
        .eq('business_id', id)
        .eq('user_id', user.id)
        .single();
      setRole(membership?.role || null);
      await localDb.from('profiles').update({ active_business_id: id }).eq('user_id', user.id);
    }
  };

  const setNextInvoiceNum = useCallback((nextInvoiceNum: number) => {
    const activeBusinessId = business?.id;
    if (!activeBusinessId) return;

    setBusiness((prev) => (prev ? { ...prev, next_invoice_num: nextInvoiceNum } : prev));
    setBusinesses((prev) =>
      prev.map((biz) => (biz.id === activeBusinessId ? { ...biz, next_invoice_num: nextInvoiceNum } : biz))
    );
  }, [business?.id]);

  const setNextDocumentNum = useCallback((type: string | undefined, nextDocumentNum: number) => {
    const activeBusinessId = business?.id;
    if (!activeBusinessId) return;

    const counterKey =
      type === 'purchase'
        ? 'next_purchase_bill_num'
        : type === 'quotation'
          ? 'next_quotation_num'
          : 'next_sales_invoice_num';

    setBusiness((prev) => (prev ? { ...prev, [counterKey]: nextDocumentNum } : prev));
    setBusinesses((prev) =>
      prev.map((biz) => (biz.id === activeBusinessId ? { ...biz, [counterKey]: nextDocumentNum } : biz))
    );

    if (type === 'sale') {
      setNextInvoiceNum(nextDocumentNum);
    }
  }, [business?.id, setNextInvoiceNum]);

  return (
    <BusinessContext.Provider value={{ business, businesses, role, loading, switchBusiness, setNextInvoiceNum, setNextDocumentNum, refetch: fetchBusinesses }}>
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness() {
  const context = useContext(BusinessContext);
  if (!context) throw new Error('useBusiness must be used within BusinessProvider');
  return context;
}
