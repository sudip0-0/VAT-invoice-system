import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useBusiness } from "@/contexts/BusinessContext";
import { localDb } from "@/integrations/local-db/client";
import type { TablesInsert } from "@/integrations/local-db/types";

export const VAT_ADJUSTMENT_FIELDS = [
  { key: "import_taxable", label: "Import taxable purchases (manual)" },
  { key: "import_vat", label: "Import VAT (manual)" },
  { key: "capitalized_taxable", label: "Capitalized taxable purchases (manual)" },
  { key: "capitalized_vat", label: "Capitalized purchase VAT (manual)" },
  { key: "payment_voucher_ref", label: "Payment voucher reference" },
  { key: "refund_reason", label: "Refund reason note" },
  { key: "other", label: "Other adjustment amount" },
] as const;

export function useVATReturnAdjustments(dateFrom: string, dateTo: string) {
  const { business } = useBusiness();
  const qc = useQueryClient();
  const key = ["vat-return-adjustments", business?.id, dateFrom, dateTo];

  const query = useQuery({
    queryKey: key,
    enabled: !!business?.id && !!dateFrom && !!dateTo,
    queryFn: async () => {
      const { data, error } = await localDb
        .from("vat_return_adjustments")
        .select("*")
        .eq("business_id", business!.id)
        .eq("period_from_ad", dateFrom)
        .eq("period_to_ad", dateTo)
        .order("created_at");
      if (error) throw error;
      return data || [];
    },
  });

  const upsertAdjustment = useMutation({
    mutationFn: async (input: {
      field_key: string;
      amount: number;
      note?: string | null;
      id?: string;
    }) => {
      if (input.id) {
        const { error } = await localDb
          .from("vat_return_adjustments")
          .update({
            amount: input.amount,
            note: input.note || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", input.id)
          .eq("business_id", business!.id);
        if (error) throw error;
        return input.id;
      }

      const payload: TablesInsert<"vat_return_adjustments"> = {
        business_id: business!.id,
        period_from_ad: dateFrom,
        period_to_ad: dateTo,
        field_key: input.field_key,
        amount: input.amount,
        note: input.note || null,
      };
      const { data, error } = await localDb.from("vat_return_adjustments").insert(payload).select("id").single();
      if (error) throw error;
      return data!.id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ["report-vat-return", business?.id, dateFrom, dateTo] });
    },
  });

  const deleteAdjustment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await localDb
        .from("vat_return_adjustments")
        .delete()
        .eq("id", id)
        .eq("business_id", business!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ["report-vat-return", business?.id, dateFrom, dateTo] });
    },
  });

  return { ...query, upsertAdjustment, deleteAdjustment };
}
