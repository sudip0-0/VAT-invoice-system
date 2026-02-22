export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      business_users: {
        Row: {
          business_id: string
          id: string
          is_active: boolean
          joined_at: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          business_id: string
          id?: string
          is_active?: boolean
          joined_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          business_id?: string
          id?: string
          is_active?: boolean
          joined_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_users_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          address: string
          city: string
          created_at: string
          currency: string
          deleted_at: string | null
          email: string | null
          fiscal_year_start: number
          id: string
          invoice_prefix: string
          is_vat_registered: boolean
          logo_url: string | null
          name: string
          next_invoice_num: number
          pan_number: string | null
          phone: string
          province: string | null
          type: Database["public"]["Enums"]["business_type"]
          updated_at: string
        }
        Insert: {
          address?: string
          city?: string
          created_at?: string
          currency?: string
          deleted_at?: string | null
          email?: string | null
          fiscal_year_start?: number
          id?: string
          invoice_prefix?: string
          is_vat_registered?: boolean
          logo_url?: string | null
          name: string
          next_invoice_num?: number
          pan_number?: string | null
          phone?: string
          province?: string | null
          type?: Database["public"]["Enums"]["business_type"]
          updated_at?: string
        }
        Update: {
          address?: string
          city?: string
          created_at?: string
          currency?: string
          deleted_at?: string | null
          email?: string | null
          fiscal_year_start?: number
          id?: string
          invoice_prefix?: string
          is_vat_registered?: boolean
          logo_url?: string | null
          name?: string
          next_invoice_num?: number
          pan_number?: string | null
          phone?: string
          province?: string | null
          type?: Database["public"]["Enums"]["business_type"]
          updated_at?: string
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          description: string | null
          discount_amt: number
          discount_pct: number
          id: string
          invoice_id: string
          item_id: string | null
          name: string
          quantity: number
          rate: number
          sort_order: number
          tax_rate_id: string | null
          taxable_amount: number
          total_amount: number
          unit: string
          vat_amount: number
          vat_rate: number
        }
        Insert: {
          description?: string | null
          discount_amt?: number
          discount_pct?: number
          id?: string
          invoice_id: string
          item_id?: string | null
          name: string
          quantity?: number
          rate?: number
          sort_order?: number
          tax_rate_id?: string | null
          taxable_amount?: number
          total_amount?: number
          unit?: string
          vat_amount?: number
          vat_rate?: number
        }
        Update: {
          description?: string | null
          discount_amt?: number
          discount_pct?: number
          id?: string
          invoice_id?: string
          item_id?: string | null
          name?: string
          quantity?: number
          rate?: number
          sort_order?: number
          tax_rate_id?: string | null
          taxable_amount?: number
          total_amount?: number
          unit?: string
          vat_amount?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_tax_rate_id_fkey"
            columns: ["tax_rate_id"]
            isOneToOne: false
            referencedRelation: "tax_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          balance_due: number
          business_id: string
          buyer_pan: string | null
          created_at: string
          customer_id: string | null
          deleted_at: string | null
          discount_amount: number
          due_date_ad: string | null
          due_date_bs: string | null
          id: string
          invoice_number: string
          is_vat_invoice: boolean
          issued_date_ad: string
          issued_date_bs: string
          notes: string | null
          paid_amount: number
          reference_number: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          sub_total: number
          taxable_amount: number
          terms_conditions: string | null
          total_amount: number
          type: Database["public"]["Enums"]["invoice_type"]
          updated_at: string
          vat_amount: number
          vat_period: string | null
          vendor_id: string | null
        }
        Insert: {
          balance_due?: number
          business_id: string
          buyer_pan?: string | null
          created_at?: string
          customer_id?: string | null
          deleted_at?: string | null
          discount_amount?: number
          due_date_ad?: string | null
          due_date_bs?: string | null
          id?: string
          invoice_number: string
          is_vat_invoice?: boolean
          issued_date_ad?: string
          issued_date_bs: string
          notes?: string | null
          paid_amount?: number
          reference_number?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          sub_total?: number
          taxable_amount?: number
          terms_conditions?: string | null
          total_amount?: number
          type?: Database["public"]["Enums"]["invoice_type"]
          updated_at?: string
          vat_amount?: number
          vat_period?: string | null
          vendor_id?: string | null
        }
        Update: {
          balance_due?: number
          business_id?: string
          buyer_pan?: string | null
          created_at?: string
          customer_id?: string | null
          deleted_at?: string | null
          discount_amount?: number
          due_date_ad?: string | null
          due_date_bs?: string | null
          id?: string
          invoice_number?: string
          is_vat_invoice?: boolean
          issued_date_ad?: string
          issued_date_bs?: string
          notes?: string | null
          paid_amount?: number
          reference_number?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          sub_total?: number
          taxable_amount?: number
          terms_conditions?: string | null
          total_amount?: number
          type?: Database["public"]["Enums"]["invoice_type"]
          updated_at?: string
          vat_amount?: number
          vat_period?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      item_categories: {
        Row: {
          business_id: string
          created_at: string
          id: string
          name: string
          parent_id: string | null
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "item_categories_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "item_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          business_id: string
          category_id: string | null
          code: string | null
          created_at: string
          current_stock: number
          deleted_at: string | null
          description: string | null
          hsn_code: string | null
          id: string
          is_active: boolean
          low_stock_alert: number | null
          name: string
          opening_stock: number
          purchase_price: number | null
          sale_price: number
          tax_rate_id: string | null
          type: Database["public"]["Enums"]["item_type"]
          unit: string
          updated_at: string
        }
        Insert: {
          business_id: string
          category_id?: string | null
          code?: string | null
          created_at?: string
          current_stock?: number
          deleted_at?: string | null
          description?: string | null
          hsn_code?: string | null
          id?: string
          is_active?: boolean
          low_stock_alert?: number | null
          name: string
          opening_stock?: number
          purchase_price?: number | null
          sale_price?: number
          tax_rate_id?: string | null
          type?: Database["public"]["Enums"]["item_type"]
          unit?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          category_id?: string | null
          code?: string | null
          created_at?: string
          current_stock?: number
          deleted_at?: string | null
          description?: string | null
          hsn_code?: string | null
          id?: string
          is_active?: boolean
          low_stock_alert?: number | null
          name?: string
          opening_stock?: number
          purchase_price?: number | null
          sale_price?: number
          tax_rate_id?: string | null
          type?: Database["public"]["Enums"]["item_type"]
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "item_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_tax_rate_id_fkey"
            columns: ["tax_rate_id"]
            isOneToOne: false
            referencedRelation: "tax_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      parties: {
        Row: {
          address: string | null
          business_id: string
          city: string | null
          created_at: string
          credit_days: number | null
          credit_limit: number | null
          deleted_at: string | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          opening_balance: number
          pan_number: string | null
          phone: string | null
          type: Database["public"]["Enums"]["party_type"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          business_id: string
          city?: string | null
          created_at?: string
          credit_days?: number | null
          credit_limit?: number | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          opening_balance?: number
          pan_number?: string | null
          phone?: string | null
          type?: Database["public"]["Enums"]["party_type"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          business_id?: string
          city?: string | null
          created_at?: string
          credit_days?: number | null
          credit_limit?: number | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          opening_balance?: number
          pan_number?: string | null
          phone?: string | null
          type?: Database["public"]["Enums"]["party_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parties_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          bank_name: string | null
          business_id: string
          cheque_date: string | null
          cheque_number: string | null
          created_at: string
          gateway_ref_id: string | null
          id: string
          invoice_id: string | null
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          party_id: string | null
          payment_date_ad: string
          payment_date_bs: string
          reference: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount?: number
          bank_name?: string | null
          business_id: string
          cheque_date?: string | null
          cheque_number?: string | null
          created_at?: string
          gateway_ref_id?: string | null
          id?: string
          invoice_id?: string | null
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          party_id?: string | null
          payment_date_ad?: string
          payment_date_bs: string
          reference?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          bank_name?: string | null
          business_id?: string
          cheque_date?: string | null
          cheque_number?: string | null
          created_at?: string
          gateway_ref_id?: string | null
          id?: string
          invoice_id?: string | null
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          party_id?: string | null
          payment_date_ad?: string
          payment_date_bs?: string
          reference?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_business_id: string | null
          avatar_url: string | null
          created_at: string
          id: string
          name: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active_business_id?: string | null
          avatar_url?: string | null
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active_business_id?: string | null
          avatar_url?: string | null
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tax_rates: {
        Row: {
          business_id: string
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          rate: number
          type: Database["public"]["Enums"]["tax_type"]
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          rate?: number
          type: Database["public"]["Enums"]["tax_type"]
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          rate?: number
          type?: Database["public"]["Enums"]["tax_type"]
        }
        Relationships: [
          {
            foreignKeyName: "tax_rates_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_business_role: {
        Args: { _business_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      is_business_member: {
        Args: { _business_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "owner" | "manager" | "staff" | "accountant"
      business_type:
        | "kirana"
        | "wholesale"
        | "retail"
        | "restaurant"
        | "pharmacy"
        | "service"
        | "manufacturer"
        | "other"
      invoice_status:
        | "draft"
        | "issued"
        | "partially_paid"
        | "paid"
        | "overdue"
        | "cancelled"
      invoice_type:
        | "sale"
        | "purchase"
        | "sale_return"
        | "purchase_return"
        | "quotation"
        | "delivery_challan"
      item_type: "product" | "service"
      party_type: "customer" | "vendor" | "both"
      payment_method:
        | "cash"
        | "esewa"
        | "khalti"
        | "fonepay"
        | "connectips"
        | "bank_transfer"
        | "cheque"
        | "credit"
      payment_status: "pending" | "completed" | "failed" | "refunded"
      tax_type: "vat_13" | "exempt" | "zero_rated" | "non_taxable"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "manager", "staff", "accountant"],
      business_type: [
        "kirana",
        "wholesale",
        "retail",
        "restaurant",
        "pharmacy",
        "service",
        "manufacturer",
        "other",
      ],
      invoice_status: [
        "draft",
        "issued",
        "partially_paid",
        "paid",
        "overdue",
        "cancelled",
      ],
      invoice_type: [
        "sale",
        "purchase",
        "sale_return",
        "purchase_return",
        "quotation",
        "delivery_challan",
      ],
      item_type: ["product", "service"],
      party_type: ["customer", "vendor", "both"],
      payment_method: [
        "cash",
        "esewa",
        "khalti",
        "fonepay",
        "connectips",
        "bank_transfer",
        "cheque",
        "credit",
      ],
      payment_status: ["pending", "completed", "failed", "refunded"],
      tax_type: ["vat_13", "exempt", "zero_rated", "non_taxable"],
    },
  },
} as const
