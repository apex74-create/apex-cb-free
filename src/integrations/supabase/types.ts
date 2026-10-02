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
      content_posts: {
        Row: {
          body: string
          created_at: string
          excerpt: string
          id: string
          publish_target: string
          published_at: string | null
          slug: string
          source_kind: string
          source_refs: Json
          status: string
          tags: string[]
          title: string
          updated_at: string
          user_id: string
          whoop: Json
        }
        Insert: {
          body: string
          created_at?: string
          excerpt?: string
          id?: string
          publish_target?: string
          published_at?: string | null
          slug: string
          source_kind?: string
          source_refs?: Json
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
          user_id: string
          whoop?: Json
        }
        Update: {
          body?: string
          created_at?: string
          excerpt?: string
          id?: string
          publish_target?: string
          published_at?: string | null
          slug?: string
          source_kind?: string
          source_refs?: Json
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
          whoop?: Json
        }
        Relationships: []
      }
      devices: {
        Row: {
          created_at: string
          device_key: string
          id: string
          kind: string
          label: string
          last_seen: string
          screen: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_key: string
          id?: string
          kind?: string
          label?: string
          last_seen?: string
          screen?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_key?: string
          id?: string
          kind?: string
          label?: string
          last_seen?: string
          screen?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      entitlements: {
        Row: {
          current_period_end: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          current_period_end?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          current_period_end?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      field_observations: {
        Row: {
          block: string
          created_at: string
          id: string
          lat_grid: number | null
          lon_grid: number | null
          observed: string
          report_age_min: number | null
          reported: string
          trend: string
          user_id: string
          verdict: number
        }
        Insert: {
          block: string
          created_at?: string
          id?: string
          lat_grid?: number | null
          lon_grid?: number | null
          observed: string
          report_age_min?: number | null
          reported: string
          trend: string
          user_id: string
          verdict: number
        }
        Update: {
          block?: string
          created_at?: string
          id?: string
          lat_grid?: number | null
          lon_grid?: number | null
          observed?: string
          report_age_min?: number | null
          reported?: string
          trend?: string
          user_id?: string
          verdict?: number
        }
        Relationships: []
      }
      field_reports: {
        Row: {
          app_version: string | null
          cell: string
          created_at: string
          device_class: string | null
          downlink: number | null
          id: string
          jitter_ms: number | null
          lat: number
          link_type: string | null
          lon: number
          pressure: number | null
          pressure_trend: number | null
          rtt_ms: number | null
          signal_score: number | null
          temp_f: number | null
        }
        Insert: {
          app_version?: string | null
          cell: string
          created_at?: string
          device_class?: string | null
          downlink?: number | null
          id?: string
          jitter_ms?: number | null
          lat: number
          link_type?: string | null
          lon: number
          pressure?: number | null
          pressure_trend?: number | null
          rtt_ms?: number | null
          signal_score?: number | null
          temp_f?: number | null
        }
        Update: {
          app_version?: string | null
          cell?: string
          created_at?: string
          device_class?: string | null
          downlink?: number | null
          id?: string
          jitter_ms?: number | null
          lat?: number
          link_type?: string | null
          lon?: number
          pressure?: number | null
          pressure_trend?: number | null
          rtt_ms?: number | null
          signal_score?: number | null
          temp_f?: number | null
        }
        Relationships: []
      }
      licence_devices: {
        Row: {
          created_at: string
          device_pubkey: string
          id: string
          label: string | null
          last_seen: string
          signature_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_pubkey: string
          id?: string
          label?: string | null
          last_seen?: string
          signature_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_pubkey?: string
          id?: string
          label?: string | null
          last_seen?: string
          signature_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      licences: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          licence_key: string
          order_ref: string | null
          product_slug: string
          source: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          licence_key: string
          order_ref?: string | null
          product_slug: string
          source?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          licence_key?: string
          order_ref?: string | null
          product_slug?: string
          source?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      product_downloads: {
        Row: {
          available: boolean
          created_at: string
          id: string
          kind: string
          label: string
          product_id: string
          requires_licence: boolean
          sha256: string | null
          size_bytes: number | null
          sort_order: number
          url: string
          version: string | null
        }
        Insert: {
          available?: boolean
          created_at?: string
          id?: string
          kind?: string
          label: string
          product_id: string
          requires_licence?: boolean
          sha256?: string | null
          size_bytes?: number | null
          sort_order?: number
          url: string
          version?: string | null
        }
        Update: {
          available?: boolean
          created_at?: string
          id?: string
          kind?: string
          label?: string
          product_id?: string
          requires_licence?: boolean
          sha256?: string | null
          size_bytes?: number | null
          sort_order?: number
          url?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_downloads_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          app_path: string | null
          category: string
          companion_slug: string | null
          created_at: string
          description: string
          external_url: string | null
          featured: boolean
          id: string
          name: string
          price_usd: number | null
          repo: string | null
          repo_public: boolean
          slug: string
          sort_order: number
          status: string
          tagline: string
          unlocks: string[]
          updated_at: string
        }
        Insert: {
          app_path?: string | null
          category?: string
          companion_slug?: string | null
          created_at?: string
          description?: string
          external_url?: string | null
          featured?: boolean
          id?: string
          name: string
          price_usd?: number | null
          repo?: string | null
          repo_public?: boolean
          slug: string
          sort_order?: number
          status?: string
          tagline?: string
          unlocks?: string[]
          updated_at?: string
        }
        Update: {
          app_path?: string | null
          category?: string
          companion_slug?: string | null
          created_at?: string
          description?: string
          external_url?: string | null
          featured?: boolean
          id?: string
          name?: string
          price_usd?: number | null
          repo?: string | null
          repo_public?: boolean
          slug?: string
          sort_order?: number
          status?: string
          tagline?: string
          unlocks?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
        }
        Relationships: []
      }
      safe_use_attestations: {
        Row: {
          accepted_at: string
          id: string
          pack: string
          policy_version: string
          user_id: string
        }
        Insert: {
          accepted_at?: string
          id?: string
          pack: string
          policy_version: string
          user_id: string
        }
        Update: {
          accepted_at?: string
          id?: string
          pack?: string
          policy_version?: string
          user_id?: string
        }
        Relationships: []
      }
      scan_events: {
        Row: {
          created_at: string
          device_key: string
          id: string
          kind: string
          label: string | null
          lat: number | null
          lon: number | null
          payload: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          device_key: string
          id?: string
          kind: string
          label?: string | null
          lat?: number | null
          lon?: number | null
          payload?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          device_key?: string
          id?: string
          kind?: string
          label?: string | null
          lat?: number | null
          lon?: number | null
          payload?: Json
          user_id?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          created_at: string
          device_key: string
          id: string
          report: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_key: string
          id?: string
          report: string
          title?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_key?: string
          id?: string
          report?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      watch_reports: {
        Row: {
          browser: string | null
          created_at: string
          device_profile: Json
          diagnosis: Json | null
          id: string
          notes: string | null
          os_version: string | null
          recording_path: string | null
          symptom: string
          user_id: string | null
          watch_model: string | null
        }
        Insert: {
          browser?: string | null
          created_at?: string
          device_profile?: Json
          diagnosis?: Json | null
          id?: string
          notes?: string | null
          os_version?: string | null
          recording_path?: string | null
          symptom: string
          user_id?: string | null
          watch_model?: string | null
        }
        Update: {
          browser?: string | null
          created_at?: string
          device_profile?: Json
          diagnosis?: Json | null
          id?: string
          notes?: string | null
          os_version?: string | null
          recording_path?: string | null
          symptom?: string
          user_id?: string | null
          watch_model?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      field_array_cells: {
        Args: { _limit?: number; _minutes?: number }
        Returns: {
          cell: string
          lat: number
          lon: number
          newest: string
          nodes: number
          pressure: number
          pressure_trend: number
          signal_score: number
          temp_f: number
        }[]
      }
      field_array_nearby: {
        Args: {
          _lat: number
          _lon: number
          _minutes?: number
          _radius_deg?: number
        }
        Returns: {
          cells: number
          newest: string
          nodes: number
          pressure: number
          pressure_trend: number
          signal_score: number
          temp_f: number
        }[]
      }
      owner_email: { Args: never; Returns: string }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
