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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: string | null
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor: string | null
          created_at: string
          diff: Json | null
          entity: string
          entity_id: string
          id: string
        }
        Insert: {
          action: string
          actor?: string | null
          created_at?: string
          diff?: Json | null
          entity: string
          entity_id: string
          id?: string
        }
        Update: {
          action?: string
          actor?: string | null
          created_at?: string
          diff?: Json | null
          entity?: string
          entity_id?: string
          id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          default_limit: number | null
          icon: string | null
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          default_limit?: number | null
          icon?: string | null
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          default_limit?: number | null
          icon?: string | null
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      expense_comments: {
        Row: {
          body: string
          created_at: string
          expense_id: string
          id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          expense_id: string
          id?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          expense_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_comments_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_reports: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_notes: string | null
          description: string | null
          end_date: string | null
          id: string
          start_date: string | null
          status: Database["public"]["Enums"]["report_status"]
          submitted_at: string | null
          title: string
          type: Database["public"]["Enums"]["report_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          submitted_at?: string | null
          title: string
          type?: Database["public"]["Enums"]["report_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          submitted_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["report_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          currency: string
          decided_at: string | null
          decided_by: string | null
          decision_notes: string | null
          expense_date: string
          id: string
          merchant: string | null
          notes: string | null
          ocr_raw: Json | null
          policy_flags: Json
          receipt_path: string | null
          reimbursed_at: string | null
          report_id: string | null
          status: Database["public"]["Enums"]["expense_status"]
          submitted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          currency?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          expense_date?: string
          id?: string
          merchant?: string | null
          notes?: string | null
          ocr_raw?: Json | null
          policy_flags?: Json
          receipt_path?: string | null
          reimbursed_at?: string | null
          report_id?: string | null
          status?: Database["public"]["Enums"]["expense_status"]
          submitted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          currency?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          expense_date?: string
          id?: string
          merchant?: string | null
          notes?: string | null
          ocr_raw?: Json | null
          policy_flags?: Json
          receipt_path?: string | null
          reimbursed_at?: string | null
          report_id?: string | null
          status?: Database["public"]["Enums"]["expense_status"]
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "expense_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      policies: {
        Row: {
          active: boolean
          ai_generated: boolean
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          rule_json: Json
          severity: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          ai_generated?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          rule_json: Json
          severity?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          ai_generated?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          rule_json?: Json
          severity?: string
          updated_at?: string
        }
        Relationships: []
      }
      policy_violations: {
        Row: {
          created_at: string
          expense_id: string
          id: string
          message: string
          policy_id: string | null
          policy_name: string
          severity: string
        }
        Insert: {
          created_at?: string
          expense_id: string
          id?: string
          message: string
          policy_id?: string | null
          policy_name: string
          severity: string
        }
        Update: {
          created_at?: string
          expense_id?: string
          id?: string
          message?: string
          policy_id?: string | null
          policy_name?: string
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_violations_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_violations_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          department: string | null
          full_name: string | null
          id: string
          manager_id: string | null
          phone: string | null
          phone_country: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          full_name?: string | null
          id: string
          manager_id?: string | null
          phone?: string | null
          phone_country?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          full_name?: string | null
          id?: string
          manager_id?: string | null
          phone?: string | null
          phone_country?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_jobs: {
        Row: {
          consumed: boolean
          created_at: string
          error: string | null
          expense_id: string | null
          finished_at: string | null
          id: string
          receipt_path: string
          result_json: Json | null
          started_at: string | null
          status: Database["public"]["Enums"]["receipt_job_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          consumed?: boolean
          created_at?: string
          error?: string | null
          expense_id?: string | null
          finished_at?: string | null
          id?: string
          receipt_path: string
          result_json?: Json | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["receipt_job_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          consumed?: boolean
          created_at?: string
          error?: string | null
          expense_id?: string | null
          finished_at?: string | null
          id?: string
          receipt_path?: string
          result_json?: Json | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["receipt_job_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_reports: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          spec_json: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          spec_json: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          spec_json?: Json
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_policy_violations: {
        Args: { _expense_id: string; _violations: Json }
        Returns: undefined
      }
      get_app_setting: { Args: { _key: string }; Returns: string }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      manages: { Args: { _target: string }; Returns: boolean }
      record_audit: {
        Args: {
          _action: string
          _diff?: Json
          _entity: string
          _entity_id: string
        }
        Returns: undefined
      }
      set_app_setting: {
        Args: { _key: string; _value: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "employee" | "manager" | "finance" | "admin" | "contractor"
      expense_status:
        | "draft"
        | "submitted"
        | "approved"
        | "rejected"
        | "reimbursed"
      receipt_job_status: "queued" | "processing" | "done" | "failed"
      report_status:
        | "draft"
        | "submitted"
        | "approved"
        | "rejected"
        | "reimbursed"
      report_type: "trip" | "project" | "general"
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
      app_role: ["employee", "manager", "finance", "admin", "contractor"],
      expense_status: [
        "draft",
        "submitted",
        "approved",
        "rejected",
        "reimbursed",
      ],
      receipt_job_status: ["queued", "processing", "done", "failed"],
      report_status: [
        "draft",
        "submitted",
        "approved",
        "rejected",
        "reimbursed",
      ],
      report_type: ["trip", "project", "general"],
    },
  },
} as const
