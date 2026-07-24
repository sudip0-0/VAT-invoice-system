import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useBusiness } from "@/contexts/BusinessContext";
import { localDb } from "@/integrations/local-db/client";
import type { TablesInsert } from "@/integrations/local-db/types";
import { nepalTodayISO } from "@/lib/nepal-date";

export interface DocumentTemplatePayload {
  party_id?: string | null;
  is_vat_invoice?: boolean;
  notes?: string;
  lines: Array<{
    item_id?: string | null;
    name: string;
    unit?: string | null;
    hsn_code?: string | null;
    quantity: number;
    rate: number;
    discount_pct?: number;
    tax_type?: string | null;
    vat_rate?: number | null;
  }>;
}

export function useDocumentTemplates() {
  const { business } = useBusiness();
  const qc = useQueryClient();
  const key = ["document-templates", business?.id];

  const query = useQuery({
    queryKey: key,
    enabled: !!business?.id,
    queryFn: async () => {
      const { data, error } = await localDb
        .from("document_templates")
        .select("*")
        .eq("business_id", business!.id)
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const saveTemplate = useMutation({
    mutationFn: async (input: {
      name: string;
      document_type?: string;
      payload: DocumentTemplatePayload;
      schedule?: "none" | "monthly";
      next_run_ad?: string | null;
    }) => {
      const row: TablesInsert<"document_templates"> = {
        business_id: business!.id,
        name: input.name.trim(),
        document_type: input.document_type || "sale",
        payload: JSON.stringify(input.payload),
        schedule: input.schedule || "none",
        next_run_ad: input.schedule === "monthly"
          ? (input.next_run_ad || nepalTodayISO())
          : null,
      };
      const { data, error } = await localDb.from("document_templates").insert(row).select("id").single();
      if (error) throw error;
      return data!.id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await localDb
        .from("document_templates")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
        .eq("business_id", business!.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const markTemplateSpawned = useMutation({
    mutationFn: async ({ id, next_run_ad }: { id: string; next_run_ad: string | null }) => {
      const { error } = await localDb
        .from("document_templates")
        .update({ next_run_ad, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("business_id", business!.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { ...query, saveTemplate, deleteTemplate, markTemplateSpawned };
}

export function parseTemplatePayload(raw: string): DocumentTemplatePayload {
  try {
    const parsed = JSON.parse(raw);
    return {
      party_id: parsed.party_id || null,
      is_vat_invoice: !!parsed.is_vat_invoice,
      notes: parsed.notes || "",
      lines: Array.isArray(parsed.lines) ? parsed.lines : [],
    };
  } catch {
    return { lines: [] };
  }
}
