import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FilePlus2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDocumentTemplates, parseTemplatePayload } from '@/hooks/useDocumentTemplates';
import { useInvoices } from '@/hooks/useInvoices';
import { useBusiness } from '@/contexts/BusinessContext';
import { useToast } from '@/hooks/use-toast';
import { calculateVATLine, reconcileLineTotals, getVATRateForTaxType, type LineTaxType } from '@/lib/vat-compliance';
import { formatBSShort, getVATPeriod, todayBS } from '@/lib/bs-calendar';
import { nepalTodayISO } from '@/lib/nepal-date';

export default function TemplatesPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { business } = useBusiness();
  const { data: templates = [], isLoading, deleteTemplate, markTemplateSpawned } = useDocumentTemplates();
  const { createInvoice } = useInvoices();
  const [busyId, setBusyId] = useState<string | null>(null);

  const createDraftFromTemplate = async (templateId: string, advanceSchedule = false) => {
    const template = templates.find((row) => row.id === templateId);
    if (!template) return;
    const payload = parseTemplatePayload(template.payload);
    if (!payload.lines.length) {
      toast({ title: 'Template has no lines', variant: 'destructive' });
      return;
    }

    setBusyId(templateId);
    try {
      const lines = payload.lines.map((line) => {
        const taxType = (line.tax_type || (payload.is_vat_invoice ? 'vat_13' : 'non_taxable')) as LineTaxType;
        const vatRate = Number(line.vat_rate ?? getVATRateForTaxType(taxType));
        const totals = calculateVATLine({
          quantity: Number(line.quantity) || 0,
          rate: Number(line.rate) || 0,
          discount_pct: Number(line.discount_pct) || 0,
          tax_type: taxType,
          vat_rate: vatRate,
        });
        return {
          item_id: line.item_id || null,
          name: line.name,
          unit: line.unit || 'PCS',
          hsn_code: line.hsn_code || null,
          quantity: Number(line.quantity) || 0,
          rate: Number(line.rate) || 0,
          discount_pct: Number(line.discount_pct) || 0,
          discount_amt: totals.discount_amt,
          tax_type: taxType,
          vat_rate: vatRate,
          taxable_amount: totals.taxable_amount,
          vat_amount: totals.vat_amount,
          total_amount: totals.total_amount,
        };
      });
      const totals = reconcileLineTotals(lines);
      const invoiceNumber = `INV-${String(business?.next_sales_invoice_num || business?.next_invoice_num || 1).padStart(4, '0')}`;
      const id = await createInvoice.mutateAsync({
        invoice: {
          invoice_number: invoiceNumber,
          type: 'sale',
          status: 'draft',
          customer_id: payload.party_id || null,
          is_vat_invoice: !!payload.is_vat_invoice,
          issued_date_ad: nepalTodayISO(),
          issued_date_bs: formatBSShort(todayBS()),
          due_date_ad: null,
          due_date_bs: null,
          vat_period: payload.is_vat_invoice ? getVATPeriod(todayBS()) : null,
          sub_total: totals.taxable_amount,
          discount_amount: totals.discount_amount,
          taxable_amount: totals.taxable_amount,
          vat_amount: totals.vat_amount,
          total_amount: totals.total_amount,
          paid_amount: 0,
          balance_due: totals.total_amount,
          notes: payload.notes || `From template: ${template.name}`,
        },
        items: lines,
      });

      if (advanceSchedule && template.schedule === 'monthly') {
        const next = new Date(`${nepalTodayISO()}T00:00:00`);
        next.setMonth(next.getMonth() + 1);
        const nextRun = next.toISOString().slice(0, 10);
        await markTemplateSpawned.mutateAsync({ id: template.id, next_run_ad: nextRun });
      }

      toast({ title: 'Draft invoice created from template' });
      navigate(`/invoices/${id}/edit`);
    } catch (error) {
      toast({ title: 'Could not create draft', description: error instanceof Error ? error.message : 'Try again', variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-foreground">Invoice Templates</h1>
        <p className="text-xs text-muted-foreground">Reusable sale drafts. Recurring templates spawn drafts only — never auto-issue.</p>
      </div>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : templates.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No templates yet. Save one from New Sale.</div>
        ) : (
          <div className="divide-y divide-border">
            {templates.map((template) => (
              <div key={template.id} className="flex items-start justify-between gap-3 p-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">{template.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {template.document_type} · schedule: {template.schedule}
                    {template.next_run_ad ? ` · next ${template.next_run_ad}` : ''}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" className="gap-1 text-xs" disabled={busyId === template.id} onClick={() => createDraftFromTemplate(template.id)}>
                    <FilePlus2 className="h-3.5 w-3.5" /> Create Draft
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteTemplate.mutate(template.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
