import { useQuery } from '@tanstack/react-query';
import { localDb } from '@/integrations/local-db/client';
import { useBusiness } from '@/contexts/BusinessContext';

export interface SetupReadinessItem {
  id: string;
  label: string;
  complete: boolean;
  actionPath?: string;
}

export function useSetupReadiness() {
  const { business } = useBusiness();

  return useQuery({
    queryKey: ['setup-readiness', business?.id],
    enabled: !!business?.id,
    queryFn: async () => {
      const [taxRates, parties, items] = await Promise.all([
        localDb.from('tax_rates').select('id').eq('business_id', business!.id).eq('is_active', true),
        localDb.from('parties').select('id').eq('business_id', business!.id).is('deleted_at', null).limit(1),
        localDb.from('items').select('id').eq('business_id', business!.id).is('deleted_at', null).limit(1),
      ]);
      if (taxRates.error) throw taxRates.error;
      if (parties.error) throw parties.error;
      if (items.error) throw items.error;

      const lastBackupAt = localStorage.getItem(`last-backup-at:${business!.id}`);
      const backupAcknowledged = localStorage.getItem(`backup-reminder-ack:${business!.id}`) === 'true';
      const businessProfileComplete = Boolean(
        business?.name?.trim() && business?.address?.trim() && business?.city?.trim() && business?.phone?.trim()
      );

      const checklist: SetupReadinessItem[] = [
        { id: 'business-profile', label: 'Complete business profile', complete: businessProfileComplete, actionPath: '/settings' },
        { id: 'vat-status', label: 'Confirm VAT registration status', complete: typeof business?.is_vat_registered === 'boolean', actionPath: '/settings' },
        {
          id: 'business-pan',
          label: 'Add PAN/VAT number for VAT invoices',
          complete: !business?.is_vat_registered || Boolean(business?.pan_number?.trim()),
          actionPath: '/settings',
        },
        { id: 'tax-rates', label: 'Keep at least one active tax rate', complete: Boolean(taxRates.data?.length), actionPath: '/settings' },
        { id: 'party', label: 'Add first customer or vendor', complete: Boolean(parties.data?.length), actionPath: '/parties' },
        { id: 'item', label: 'Add first item or service', complete: Boolean(items.data?.length), actionPath: '/inventory' },
        { id: 'backup', label: 'Create backup or acknowledge backup reminder', complete: Boolean(lastBackupAt || backupAcknowledged), actionPath: '/settings' },
      ];

      const completed = checklist.filter((item) => item.complete).length;
      return {
        checklist,
        completed,
        total: checklist.length,
        ready: completed === checklist.length,
        lastBackupAt,
      };
    },
  });
}
