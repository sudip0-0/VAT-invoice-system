import { useQuery } from '@tanstack/react-query';
import { localDb } from '@/integrations/local-db/client';
import { useBusiness } from '@/contexts/BusinessContext';
import { nepalTodayISO } from '@/lib/nepal-date';

export interface ReceivableAlert {
  id: string;
  invoice_number: string;
  buyer_name: string | null;
  due_date_ad: string | null;
  balance_due: number;
  customer_name?: string | null;
}

export function useReceivablesAlerts(limit = 8) {
  const { business } = useBusiness();
  const today = nepalTodayISO();

  return useQuery({
    queryKey: ['receivables-alerts', business?.id, today, limit],
    enabled: !!business?.id,
    queryFn: async () => {
      const { data, error } = await localDb
        .from('invoices')
        .select('id, invoice_number, buyer_name, due_date_ad, balance_due, status, type, customer:parties!invoices_customer_id_fkey(name)')
        .eq('business_id', business!.id)
        .eq('type', 'sale' as any)
        .is('deleted_at', null)
        .in('status', ['issued', 'partially_paid', 'overdue'] as any)
        .order('due_date_ad', { ascending: true })
        .limit(100);
      if (error) throw error;

      const overdue = (data || [])
        .filter((row: any) => Number(row.balance_due || 0) > 0 && row.due_date_ad && String(row.due_date_ad) < today)
        .slice(0, limit)
        .map((row: any) => ({
          id: row.id as string,
          invoice_number: row.invoice_number as string,
          buyer_name: (row.buyer_name || row.customer?.name || null) as string | null,
          due_date_ad: row.due_date_ad as string | null,
          balance_due: Number(row.balance_due || 0),
        }));

      return { items: overdue as ReceivableAlert[], count: overdue.length };
    },
  });
}
