import { useQuery } from '@tanstack/react-query';
import { localDb } from '@/integrations/local-db/client';
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

interface UseStockMovementsParams {
  itemId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

const DEFAULT_PAGE_SIZE = 50;

function getRange(page = 1, pageSize = DEFAULT_PAGE_SIZE) {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

export function useStockMovements(params?: string | UseStockMovementsParams) {
  const { business } = useBusiness();
  const normalized = typeof params === 'string' ? { itemId: params } : (params || {});
  const { itemId, search = '', page = 1, pageSize = DEFAULT_PAGE_SIZE } = normalized;
  const { from, to } = getRange(page, pageSize);
  const cleanSearch = search.trim();

  return useQuery({
    queryKey: ['stock_movements', business?.id, itemId, cleanSearch, page, pageSize],
    enabled: !!business?.id,
    queryFn: async () => {
      let query = localDb
        .from('stock_movements')
        .select('*, item:items!stock_movements_item_id_fkey(name, code), invoice:invoices!stock_movements_invoice_id_fkey(invoice_number, type)', { count: 'exact' })
        .eq('business_id', business!.id)
        .order('created_at', { ascending: false });

      if (itemId) {
        query = query.eq('item_id', itemId);
      }
      if (cleanSearch) {
        query = query.ilike('reason', `%${cleanSearch}%`);
      }

      const { data, error, count } = await query.range(from, to);
      if (error) throw error;
      return { data: data as unknown as StockMovement[], count: count || 0 };
    },
  });
}
