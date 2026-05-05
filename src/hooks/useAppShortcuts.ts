import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBusiness } from '@/contexts/BusinessContext';
import { useToast } from '@/hooks/use-toast';
import { localDb } from '@/integrations/local-db/client';

type ShortcutAction = 'newSale' | 'newPurchase' | 'recentInvoice';

interface ShortcutBinding {
  key: string;
  action: ShortcutAction;
}

type ShortcutEvent = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>;

const SHORTCUT_BINDINGS: ShortcutBinding[] = [
  { key: 's', action: 'newSale' },
  { key: 'p', action: 'newPurchase' },
  { key: 'r', action: 'recentInvoice' },
];

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])"));
}

export function getShortcutAction(event: ShortcutEvent): ShortcutAction | null {
  if ((!event.ctrlKey && !event.metaKey) || !event.shiftKey || event.altKey) {
    return null;
  }

  const key = event.key.toLowerCase();
  const binding = SHORTCUT_BINDINGS.find((shortcut) => shortcut.key === key);
  return binding?.action ?? null;
}

export function useAppShortcuts() {
  const navigate = useNavigate();
  const { business } = useBusiness();
  const { toast } = useToast();

  useEffect(() => {
    const openRecentInvoice = async () => {
      if (!business?.id) {
        navigate('/invoices');
        return;
      }

      const { data, error } = await localDb
        .from('invoices')
        .select('id')
        .eq('business_id', business.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        toast({
          title: 'Could not open recent invoice',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      const latestInvoice = (data as Array<{ id: string }> | null)?.[0];
      if (latestInvoice?.id) {
        navigate(`/invoices/${latestInvoice.id}`);
        return;
      }

      navigate('/invoices');
      toast({ title: 'No invoices yet' });
    };

    const handleKeyDown = async (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || isEditableTarget(event.target)) {
        return;
      }

      const action = getShortcutAction(event);
      if (!action) return;

      event.preventDefault();

      if (action === 'newSale') {
        navigate('/invoices/new');
        return;
      }

      if (action === 'newPurchase') {
        navigate('/purchases/new');
        return;
      }

      try {
        await openRecentInvoice();
      } catch (error: unknown) {
        const description = error instanceof Error ? error.message : 'Unexpected error';
        toast({
          title: 'Could not open recent invoice',
          description,
          variant: 'destructive',
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [business?.id, navigate, toast]);
}
