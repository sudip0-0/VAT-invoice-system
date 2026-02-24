import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';

export interface StockMovement {
  id: string;
  business_id: string;
  item_id: string;
  invoice_id: string | null;
  quantity: number;
  direction: 'in' | 'out';
  reason: string;
  stock_before: number;
  stock_after: number;
  created_at: string;
  item: { name: string; code: string | null } | null;
  invoice: { invoice_number: string; type: string } | null;
}

export function useStockMovements(itemId?: string) {
  const { business } = useBusiness();

  return useQuery({
    queryKey: ['stock_movements', business?.id, itemId],
    enabled: !!business?.id,
    queryFn: async () => {
      let query = supabase
        .from('stock_movements')
        .select('*, item:items!stock_movements_item_id_fkey(name, code), invoice:invoices!stock_movements_invoice_id_fkey(invoice_number, type)')
        .eq('business_id', business!.id)
        .order('created_at', { ascending: false })
        .limit(200);

      if (itemId) {
        query = query.eq('item_id', itemId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as StockMovement[];
    },
  });
}
