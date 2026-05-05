import { useQuery } from '@tanstack/react-query';
import { localDb } from '@/integrations/local-db/client';
import { useBusiness } from '@/contexts/BusinessContext';
import { nepalNow, formatLocalDate } from '@/lib/nepal-date';

export function useDashboardData() {
  const { business } = useBusiness();

  return useQuery({
    queryKey: ['dashboard', business?.id],
    enabled: !!business?.id,
    queryFn: async () => {
      const bizId = business!.id;
      const now = nepalNow();
      const todayStr = formatLocalDate(now);
      const monthStart = formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1));

      const [
        todaySalesRes,
        receivablesRes,
        payablesRes,
        monthSalesRes,
        monthPurchasesRes,
        itemsRes,
        customersRes,
        recentInvoicesRes,
      ] = await Promise.all([
        localDb
          .from('invoices')
          .select('total_amount')
          .eq('business_id', bizId)
          .is('deleted_at', null)
          .eq('type', 'sale' as any)
          .neq('status', 'cancelled' as any)
          .gte('issued_date_ad', todayStr)
          .lte('issued_date_ad', todayStr),
        localDb
          .from('invoices')
          .select('balance_due')
          .eq('business_id', bizId)
          .is('deleted_at', null)
          .eq('type', 'sale' as any)
          .neq('status', 'cancelled' as any)
          .neq('status', 'paid' as any),
        localDb
          .from('invoices')
          .select('balance_due')
          .eq('business_id', bizId)
          .is('deleted_at', null)
          .eq('type', 'purchase' as any)
          .neq('status', 'cancelled' as any)
          .neq('status', 'paid' as any),
        localDb
          .from('invoices')
          .select('total_amount')
          .eq('business_id', bizId)
          .is('deleted_at', null)
          .eq('type', 'sale' as any)
          .neq('status', 'cancelled' as any)
          .gte('issued_date_ad', monthStart),
        localDb
          .from('invoices')
          .select('total_amount')
          .eq('business_id', bizId)
          .is('deleted_at', null)
          .eq('type', 'purchase' as any)
          .neq('status', 'cancelled' as any)
          .gte('issued_date_ad', monthStart),
        localDb
          .from('items')
          .select('id, name, current_stock, low_stock_alert, type')
          .eq('business_id', bizId)
          .is('deleted_at', null)
          .eq('is_active', true),
        localDb
          .from('parties')
          .select('id', { count: 'exact', head: true })
          .eq('business_id', bizId)
          .is('deleted_at', null)
          .eq('is_active', true)
          .in('type', ['customer' as any, 'both' as any]),
        localDb
          .from('invoices')
          .select('*, customer:parties!invoices_customer_id_fkey(name), vendor:parties!invoices_vendor_id_fkey(name)')
          .eq('business_id', bizId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      if (todaySalesRes.error) throw todaySalesRes.error;
      if (receivablesRes.error) throw receivablesRes.error;
      if (payablesRes.error) throw payablesRes.error;
      if (monthSalesRes.error) throw monthSalesRes.error;
      if (monthPurchasesRes.error) throw monthPurchasesRes.error;
      if (itemsRes.error) throw itemsRes.error;
      if (customersRes.error) throw customersRes.error;
      if (recentInvoicesRes.error) throw recentInvoicesRes.error;

      const items = itemsRes.data || [];
      const lowStockItems = items.filter(
        (i) => i.type === 'product' && i.low_stock_alert != null && i.current_stock <= i.low_stock_alert
      );

      return {
        todaySales: (todaySalesRes.data || []).reduce((s, i) => s + Number(i.total_amount), 0),
        totalReceivables: (receivablesRes.data || []).reduce((s, i) => s + Number(i.balance_due), 0),
        totalPayables: (payablesRes.data || []).reduce((s, i) => s + Number(i.balance_due), 0),
        lowStockCount: lowStockItems.length,
        lowStockItems: lowStockItems.slice(0, 5),
        monthSales: (monthSalesRes.data || []).reduce((s, i) => s + Number(i.total_amount), 0),
        monthPurchases: (monthPurchasesRes.data || []).reduce((s, i) => s + Number(i.total_amount), 0),
        totalCustomers: customersRes.count || 0,
        recentInvoices: recentInvoicesRes.data || [],
      };
    },
  });
}
