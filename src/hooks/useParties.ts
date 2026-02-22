import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type Party = Tables<'parties'>;
export type PartyInsert = TablesInsert<'parties'>;
export type PartyUpdate = TablesUpdate<'parties'>;

export function useParties() {
  const { business } = useBusiness();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['parties', business?.id],
    queryFn: async () => {
      if (!business) return [];
      const { data, error } = await supabase
        .from('parties')
        .select('*')
        .eq('business_id', business.id)
        .is('deleted_at', null)
        .order('name');
      if (error) throw error;
      return data as Party[];
    },
    enabled: !!business,
  });

  const createParty = useMutation({
    mutationFn: async (party: Omit<PartyInsert, 'business_id'>) => {
      if (!business) throw new Error('No business');
      const { data, error } = await supabase
        .from('parties')
        .insert({ ...party, business_id: business.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['parties', business?.id] }),
  });

  const updateParty = useMutation({
    mutationFn: async ({ id, ...updates }: PartyUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('parties')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['parties', business?.id] }),
  });

  const deleteParty = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('parties')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['parties', business?.id] }),
  });

  return { ...query, createParty, updateParty, deleteParty };
}
