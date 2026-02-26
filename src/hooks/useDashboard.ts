import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';
import { nepalNow, formatLocalDate } from '@/lib/nepal-date';

export function useDashboardData() {
  const { business } = useBusiness();

  return useQuery({
    queryKey: ['dashboard', business?.id],
    enabled: !!business?.id,
    queryFn: async () => {
      const bizId = business!.id;

      // Fetch invoices, items, parties in parallel
      const [invoicesRes, itemsRes, partiesRes] = await Promise.all([
        supabase
          .from('invoices')
          .select('*, customer:parties!invoices_customer_id_fkey(name), vendor:parties!invoices_vendor_id_fkey(name)')
          .eq('business_id', bizId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
        supabase
          .from('items')
          .select('id, name, current_stock, low_stock_alert, type')
          .eq('business_id', bizId)
          .is('deleted_at', null)
          .eq('is_active', true),
        supabase
          .from('parties')
          .select('id, type')
          .eq('business_id', bizId)
          .is('deleted_at', null)
          .eq('is_active', true),
      ]);

      const invoices = invoicesRes.data || [];
      const items = itemsRes.data || [];
      const parties = partiesRes.data || [];

      const now = nepalNow();
      const todayStr = formatLocalDate(now);
      const monthStart = formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1));

      // Today's sales
      const todaySales = invoices
        .filter((i) => i.type === 'sale' && i.status !== 'cancelled' && i.issued_date_ad.slice(0, 10) === todayStr)
        .reduce((s, i) => s + Number(i.total_amount), 0);

      // Receivables: balance_due on sale invoices
      const totalReceivables = invoices
        .filter((i) => i.type === 'sale' && i.status !== 'cancelled' && i.status !== 'paid')
        .reduce((s, i) => s + Number(i.balance_due), 0);

      // Payables: balance_due on purchase invoices
      const totalPayables = invoices
        .filter((i) => i.type === 'purchase' && i.status !== 'cancelled' && i.status !== 'paid')
        .reduce((s, i) => s + Number(i.balance_due), 0);

      // Low stock
      const lowStockItems = items.filter(
        (i) => i.type === 'product' && i.low_stock_alert != null && i.current_stock <= i.low_stock_alert
      );

      // Monthly totals
      const monthInvoices = invoices.filter(
        (i) => i.status !== 'cancelled' && i.issued_date_ad.slice(0, 10) >= monthStart
      );
      const monthSales = monthInvoices
        .filter((i) => i.type === 'sale')
        .reduce((s, i) => s + Number(i.total_amount), 0);
      const monthPurchases = monthInvoices
        .filter((i) => i.type === 'purchase')
        .reduce((s, i) => s + Number(i.total_amount), 0);

      const totalCustomers = parties.filter((p) => p.type === 'customer' || p.type === 'both').length;

      // Recent 5 invoices
      const recentInvoices = invoices.slice(0, 5);

      return {
        todaySales,
        totalReceivables,
        totalPayables,
        lowStockCount: lowStockItems.length,
        lowStockItems,
        monthSales,
        monthPurchases,
        totalCustomers,
        recentInvoices,
      };
    },
  });
}
