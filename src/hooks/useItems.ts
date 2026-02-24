import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type Item = Tables<'items'>;
export type ItemInsert = TablesInsert<'items'>;
export type ItemUpdate = TablesUpdate<'items'>;

export function useItems() {
  const { business } = useBusiness();
  const qc = useQueryClient();
  const key = ['items', business?.id];

  const query = useQuery({
    queryKey: key,
    enabled: !!business?.id,
    queryFn: async () => {
      const { data, error } = await supabase
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
      const { data, error } = await supabase
        .from('items')
        .insert({ ...item, business_id: business!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...updates }: ItemUpdate & { id: string }) => {
      const { error } = await supabase.from('items').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('items')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const adjustStock = useMutation({
    mutationFn: async ({ item_id, quantity, direction, reason }: { item_id: string; quantity: number; direction: 'in' | 'out'; reason: string }) => {
      // Get current stock
      const { data: item, error: fetchErr } = await supabase
        .from('items')
        .select('current_stock')
        .eq('id', item_id)
        .single();
      if (fetchErr) throw fetchErr;

      const oldStock = Number(item.current_stock);
      const newStock = direction === 'in' ? oldStock + quantity : oldStock - quantity;
      if (newStock < 0) throw new Error('Stock cannot go below zero');

      // Update item stock
      const { error: updateErr } = await supabase
        .from('items')
        .update({ current_stock: newStock, updated_at: new Date().toISOString() })
        .eq('id', item_id);
      if (updateErr) throw updateErr;

      // Insert stock movement record
      const { error: moveErr } = await supabase
        .from('stock_movements')
        .insert({
          business_id: business!.id,
          item_id,
          quantity,
          direction,
          reason: `manual: ${reason}`,
          stock_before: oldStock,
          stock_after: newStock,
        });
      if (moveErr) throw moveErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ['stock_movements'] });
    },
  });

  return { items: query.data || [], isLoading: query.isLoading, createItem, updateItem, deleteItem, adjustStock };
}

export function useItemCategories() {
  const { business } = useBusiness();
  const qc = useQueryClient();
  const key = ['item_categories', business?.id];

  const query = useQuery({
    queryKey: key,
    enabled: !!business?.id,
    queryFn: async () => {
      const { data, error } = await supabase
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
      const { data, error } = await supabase
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
