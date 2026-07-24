import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { localDb } from '@/integrations/local-db/client';
import { useBusiness } from '@/contexts/BusinessContext';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/local-db/types';

export type Item = Tables<'items'>;
export type ItemInsert = TablesInsert<'items'>;
export type ItemUpdate = TablesUpdate<'items'>;

interface UseItemListParams {
  type?: string;
  lowStockOnly?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}

const DEFAULT_PAGE_SIZE = 50;

function getRange(page = 1, pageSize = DEFAULT_PAGE_SIZE) {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

export function useItems() {
  const { business } = useBusiness();
  const qc = useQueryClient();
  const key = ['items', business?.id];

  const query = useQuery({
    queryKey: key,
    enabled: !!business?.id,
    queryFn: async () => {
      const { data, error } = await localDb
        .from('items')
        .select('*')
        .eq('business_id', business!.id)
        .is('deleted_at', null)
        .order('name');
      if (error) throw error;
      return data as Item[];
    },
  });

  const createItem = useMutation({
    mutationFn: async (item: Omit<ItemInsert, 'business_id'>) => {
      const { data, error } = await localDb
        .from('items')
        .insert({ ...item, business_id: business!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ['setup-readiness', business?.id] });
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...updates }: ItemUpdate & { id: string }) => {
      const { error } = await localDb.from('items').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ['setup-readiness', business?.id] });
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await localDb
        .from('items')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ['setup-readiness', business?.id] });
    },
  });

  const adjustStock = useMutation({
    mutationFn: async ({ item_id, quantity, direction, reason }: { item_id: string; quantity: number; direction: 'in' | 'out'; reason: string }) => {
      const response = await localDb.stock.adjust({
        business_id: business!.id,
        item_id,
        quantity,
        direction,
        reason: `manual: ${reason}`,
      });
      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ['stock_movements'] });
    },
  });

  return { items: query.data || [], isLoading: query.isLoading, createItem, updateItem, deleteItem, adjustStock };
}

export function useItemList({
  type,
  lowStockOnly = false,
  search = '',
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
}: UseItemListParams = {}) {
  const { business } = useBusiness();
  const qc = useQueryClient();
  const { from, to } = getRange(page, pageSize);
  const cleanSearch = search.trim();

  const query = useQuery({
    queryKey: ['item_list', business?.id, type, lowStockOnly, cleanSearch, page, pageSize],
    enabled: !!business?.id,
    queryFn: async () => {
      let query = localDb
        .from('items')
        .select('*', { count: 'exact' })
        .eq('business_id', business!.id)
        .is('deleted_at', null);

      if (type && type !== 'all') query = query.eq('type', type as any);
      if (lowStockOnly) {
        query = query
          .eq('type', 'product' as any);
      }
      if (cleanSearch) {
        query = query.or(`name.ilike.%${cleanSearch}%,code.ilike.%${cleanSearch}%`);
      }

      if (lowStockOnly) {
        const { data, error } = await query.order('name');
        if (error) throw error;
        const lowStockItems = (data as Item[]).filter((item) =>
          item.low_stock_alert != null && Number(item.current_stock) <= Number(item.low_stock_alert)
        );
        return { data: lowStockItems.slice(from, to + 1), count: lowStockItems.length };
      }

      const { data, error, count } = await query.order('name').range(from, to);
      if (error) throw error;
      return { data: data as Item[], count: count || 0 };
    },
  });

  const createItem = useMutation({
    mutationFn: async (item: Omit<ItemInsert, 'business_id'>) => {
      const { data, error } = await localDb
        .from('items')
        .insert({ ...item, business_id: business!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['item_list', business?.id] });
      qc.invalidateQueries({ queryKey: ['items', business?.id] });
      qc.invalidateQueries({ queryKey: ['setup-readiness', business?.id] });
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...updates }: ItemUpdate & { id: string }) => {
      const { error } = await localDb.from('items').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['item_list', business?.id] });
      qc.invalidateQueries({ queryKey: ['items', business?.id] });
      qc.invalidateQueries({ queryKey: ['setup-readiness', business?.id] });
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await localDb
        .from('items')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['item_list', business?.id] });
      qc.invalidateQueries({ queryKey: ['items', business?.id] });
    },
  });

  const adjustStock = useMutation({
    mutationFn: async ({ item_id, quantity, direction, reason }: { item_id: string; quantity: number; direction: 'in' | 'out'; reason: string }) => {
      const response = await localDb.stock.adjust({
        business_id: business!.id,
        item_id,
        quantity,
        direction,
        reason: `manual: ${reason}`,
      });
      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['item_list', business?.id] });
      qc.invalidateQueries({ queryKey: ['items', business?.id] });
      qc.invalidateQueries({ queryKey: ['stock_movements'] });
    },
  });

  return {
    items: query.data?.data || [],
    count: query.data?.count || 0,
    isLoading: query.isLoading,
    createItem,
    updateItem,
    deleteItem,
    adjustStock,
  };
}

export function useItemCategories() {
  const { business } = useBusiness();
  const qc = useQueryClient();
  const key = ['item_categories', business?.id];

  const query = useQuery({
    queryKey: key,
    enabled: !!business?.id,
    queryFn: async () => {
      const { data, error } = await localDb
        .from('item_categories')
        .select('*')
        .eq('business_id', business!.id)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const createCategory = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await localDb
        .from('item_categories')
        .insert({ name, business_id: business!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { categories: query.data || [], isLoading: query.isLoading, createCategory };
}
