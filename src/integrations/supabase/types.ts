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
      actuarial_metrics: {
        Row: {
          contingencies: number | null
          created_at: string
          credibility: number | null
          development_factor: number | null
          fixed_expense_ratio: number | null
          id: string
          indicated_level_effect: number | null
          investment_income: number | null
          lae_amount: number | null
          lae_ratio: number | null
          loss_ratio: number | null
          period_quarter: number
          period_year: number
          prior_year_loss: number | null
          projected_loss: number | null
          selected_change: number | null
          selected_profit: number | null
          target_expense_ratio: number | null
          target_loss_ratio: number | null
          total_expense_ratio: number | null
          trend_factor: number | null
          ultimate_loss: number | null
          updated_at: string
          variable_expense_ratio: number | null
        }
        Insert: {
          contingencies?: number | null
          created_at?: string
          credibility?: number | null
          development_factor?: number | null
          fixed_expense_ratio?: number | null
          id?: string
          indicated_level_effect?: number | null
          investment_income?: number | null
          lae_amount?: number | null
          lae_ratio?: number | null
          loss_ratio?: number | null
          period_quarter: number
          period_year: number
          prior_year_loss?: number | null
          projected_loss?: number | null
          selected_change?: number | null
          selected_profit?: number | null
          target_expense_ratio?: number | null
          target_loss_ratio?: number | null
          total_expense_ratio?: number | null
          trend_factor?: number | null
          ultimate_loss?: number | null
          updated_at?: string
          variable_expense_ratio?: number | null
        }
        Update: {
          contingencies?: number | null
          created_at?: string
          credibility?: number | null
          development_factor?: number | null
          fixed_expense_ratio?: number | null
          id?: string
          indicated_level_effect?: number | null
          investment_income?: number | null
          lae_amount?: number | null
          lae_ratio?: number | null
          loss_ratio?: number | null
          period_quarter?: number
          period_year?: number
          prior_year_loss?: number | null
          projected_loss?: number | null
          selected_change?: number | null
          selected_profit?: number | null
          target_expense_ratio?: number | null
          target_loss_ratio?: number | null
          total_expense_ratio?: number | null
          trend_factor?: number | null
          ultimate_loss?: number | null
          updated_at?: string
          variable_expense_ratio?: number | null
        }
        Relationships: []
      }
      claim_reviews: {
        Row: {
          age_bucket: string
          area: string
          assigned_at: string | null
          assigned_to: string | null
          claim_id: string
          completed_at: string | null
          created_at: string
          high_eval: number | null
          id: string
          loss_description: string
          low_eval: number | null
          notes: string | null
          reserves: number
          status: string
          updated_at: string
        }
        Insert: {
          age_bucket: string
          area: string
          assigned_at?: string | null
          assigned_to?: string | null
          claim_id: string
          completed_at?: string | null
          created_at?: string
          high_eval?: number | null
          id?: string
          loss_description: string
          low_eval?: number | null
          notes?: string | null
          reserves?: number
          status?: string
          updated_at?: string
        }
        Update: {
          age_bucket?: string
          area?: string
          assigned_at?: string | null
          assigned_to?: string | null
          claim_id?: string
          completed_at?: string | null
          created_at?: string
          high_eval?: number | null
          id?: string
          loss_description?: string
          low_eval?: number | null
          notes?: string | null
          reserves?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      coverage_rate_changes: {
        Row: {
          coverage: string
          created_at: string
          id: string
          indicated_change: number | null
          loss_ratio: number | null
          period_year: number
          premium_volume: number | null
          selected_change: number | null
          trend: string | null
          updated_at: string
        }
        Insert: {
          coverage: string
          created_at?: string
          id?: string
          indicated_change?: number | null
          loss_ratio?: number | null
          period_year: number
          premium_volume?: number | null
          selected_change?: number | null
          trend?: string | null
          updated_at?: string
        }
        Update: {
          coverage?: string
          created_at?: string
          id?: string
          indicated_change?: number | null
          loss_ratio?: number | null
          period_year?: number
          premium_volume?: number | null
          selected_change?: number | null
          trend?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      inventory_snapshots: {
        Row: {
          age_181_365: number
          age_365_plus: number
          age_61_180: number
          age_under_60: number
          cp1_claims: number
          cp1_rate: number
          created_at: string
          id: string
          no_eval_count: number
          no_eval_reserves: number
          snapshot_date: string
          total_claims: number
          total_high_eval: number
          total_low_eval: number
          total_reserves: number
          type_group_breakdown: Json | null
          updated_at: string
        }
        Insert: {
          age_181_365?: number
          age_365_plus?: number
          age_61_180?: number
          age_under_60?: number
          cp1_claims?: number
          cp1_rate?: number
          created_at?: string
          id?: string
          no_eval_count?: number
          no_eval_reserves?: number
          snapshot_date: string
          total_claims: number
          total_high_eval?: number
          total_low_eval?: number
          total_reserves?: number
          type_group_breakdown?: Json | null
          updated_at?: string
        }
        Update: {
          age_181_365?: number
          age_365_plus?: number
          age_61_180?: number
          age_under_60?: number
          cp1_claims?: number
          cp1_rate?: number
          created_at?: string
          id?: string
          no_eval_count?: number
          no_eval_reserves?: number
          snapshot_date?: string
          total_claims?: number
          total_high_eval?: number
          total_low_eval?: number
          total_reserves?: number
          type_group_breakdown?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      litigation_matters: {
        Row: {
          claimant: string | null
          class: string | null
          created_at: string
          days_open: number | null
          department: string | null
          discipline: string | null
          filing_date: string | null
          id: string
          indemnities_amount: number | null
          location: string | null
          matter_id: string
          matter_lead: string | null
          resolution: string | null
          resolution_date: string | null
          severity: string | null
          status: string | null
          team: string | null
          total_amount: number | null
          type: string | null
          updated_at: string
        }
        Insert: {
          claimant?: string | null
          class?: string | null
          created_at?: string
          days_open?: number | null
          department?: string | null
          discipline?: string | null
          filing_date?: string | null
          id?: string
          indemnities_amount?: number | null
          location?: string | null
          matter_id: string
          matter_lead?: string | null
          resolution?: string | null
          resolution_date?: string | null
          severity?: string | null
          status?: string | null
          team?: string | null
          total_amount?: number | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          claimant?: string | null
          class?: string | null
          created_at?: string
          days_open?: number | null
          department?: string | null
          discipline?: string | null
          filing_date?: string | null
          id?: string
          indemnities_amount?: number | null
          location?: string | null
          matter_id?: string
          matter_lead?: string | null
          resolution?: string | null
          resolution_date?: string | null
          severity?: string | null
          status?: string | null
          team?: string | null
          total_amount?: number | null
          type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      lor_offers: {
        Row: {
          accident_description: string | null
          area: string | null
          bi_phase: string | null
          claim_number: string
          created_at: string
          days_old: number | null
          expires_date: string
          extended_date: string
          high_eval: number | null
          id: string
          low_eval: number | null
          offer_amount: number
          outcome_date: string | null
          outcome_notes: string | null
          reserves: number | null
          settlement_status: string | null
          status: string
          updated_at: string
        }
        Insert: {
          accident_description?: string | null
          area?: string | null
          bi_phase?: string | null
          claim_number: string
          created_at?: string
          days_old?: number | null
          expires_date: string
          extended_date: string
          high_eval?: number | null
          id?: string
          low_eval?: number | null
          offer_amount: number
          outcome_date?: string | null
          outcome_notes?: string | null
          reserves?: number | null
          settlement_status?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          accident_description?: string | null
          area?: string | null
          bi_phase?: string | null
          claim_number?: string
          created_at?: string
          days_old?: number | null
          expires_date?: string
          extended_date?: string
          high_eval?: number | null
          id?: string
          low_eval?: number | null
          offer_amount?: number
          outcome_date?: string | null
          outcome_notes?: string | null
          reserves?: number | null
          settlement_status?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      loss_development: {
        Row: {
          created_at: string
          ibnr: number | null
          id: string
          incurred_losses: number | null
          paid_losses: number | null
          period_quarter: number
          period_year: number
          reported_losses: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          ibnr?: number | null
          id?: string
          incurred_losses?: number | null
          paid_losses?: number | null
          period_quarter: number
          period_year: number
          reported_losses?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          ibnr?: number | null
          id?: string
          incurred_losses?: number | null
          paid_losses?: number | null
          period_quarter?: number
          period_year?: number
          reported_losses?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      open_exposure: {
        Row: {
          created_at: string
          id: string
          insurance_expectancy: number | null
          matter_id: string
          net_exposure: number | null
          phase: string | null
          reserves: number | null
          type_group: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          insurance_expectancy?: number | null
          matter_id: string
          net_exposure?: number | null
          phase?: string | null
          reserves?: number | null
          type_group?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          insurance_expectancy?: number | null
          matter_id?: string
          net_exposure?: number | null
          phase?: string | null
          reserves?: number | null
          type_group?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "open_exposure_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "litigation_matters"
            referencedColumns: ["matter_id"]
          },
        ]
      }
      pain_levels: {
        Row: {
          created_at: string
          id: string
          matter_id: string
          notes: string | null
          pain_level: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          matter_id: string
          notes?: string | null
          pain_level: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          matter_id?: string
          notes?: string | null
          pain_level?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pain_levels_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: true
            referencedRelation: "litigation_matters"
            referencedColumns: ["matter_id"]
          },
        ]
      }
      report_downloads: {
        Row: {
          downloaded_at: string
          file_format: string
          id: string
          metadata: Json | null
          report_name: string
          report_type: string
          row_count: number | null
        }
        Insert: {
          downloaded_at?: string
          file_format?: string
          id?: string
          metadata?: Json | null
          report_name: string
          report_type: string
          row_count?: number | null
        }
        Update: {
          downloaded_at?: string
          file_format?: string
          id?: string
          metadata?: Json | null
          report_name?: string
          report_type?: string
          row_count?: number | null
        }
        Relationships: []
      }
      reviewers: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      state_bi_limits: {
        Row: {
          created_at: string
          id: string
          limit_2022: number | null
          limit_2023: number | null
          limit_2025: number | null
          notes: string | null
          state: string
          trigger_80_pct: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          limit_2022?: number | null
          limit_2023?: number | null
          limit_2025?: number | null
          notes?: string | null
          state: string
          trigger_80_pct?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          limit_2022?: number | null
          limit_2023?: number | null
          limit_2025?: number | null
          notes?: string | null
          state?: string
          trigger_80_pct?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      state_rate_changes: {
        Row: {
          created_at: string
          effective_date: string | null
          filing_status: string | null
          id: string
          indicated_change: number | null
          loss_ratio: number | null
          period_year: number
          policy_volume: number | null
          selected_change: number | null
          state: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          effective_date?: string | null
          filing_status?: string | null
          id?: string
          indicated_change?: number | null
          loss_ratio?: number | null
          period_year: number
          policy_volume?: number | null
          selected_change?: number | null
          state: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          effective_date?: string | null
          filing_status?: string | null
          id?: string
          indicated_change?: number | null
          loss_ratio?: number | null
          period_year?: number
          policy_volume?: number | null
          selected_change?: number | null
          state?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
