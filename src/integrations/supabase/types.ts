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
      cast_events: {
        Row: {
          banner_image_url: string | null
          banner_tagline: string | null
          banner_title: string | null
          code: string
          created_at: string
          ends_at: string | null
          floor_depth_m: number
          floor_width_m: number
          id: string
          overlay_url: string | null
          owner_id: string
          site_lat: number | null
          site_lon: number | null
          site_zoom: number | null
          snapshot_url: string | null
          starts_at: string | null
          status: string
          summary: string
          swag_text: string | null
          swag_url: string | null
          ticket_url: string | null
          title: string
          visibility: string
        }
        Insert: {
          banner_image_url?: string | null
          banner_tagline?: string | null
          banner_title?: string | null
          code: string
          created_at?: string
          ends_at?: string | null
          floor_depth_m?: number
          floor_width_m?: number
          id?: string
          overlay_url?: string | null
          owner_id: string
          site_lat?: number | null
          site_lon?: number | null
          site_zoom?: number | null
          snapshot_url?: string | null
          starts_at?: string | null
          status?: string
          summary?: string
          swag_text?: string | null
          swag_url?: string | null
          ticket_url?: string | null
          title: string
          visibility?: string
        }
        Update: {
          banner_image_url?: string | null
          banner_tagline?: string | null
          banner_title?: string | null
          code?: string
          created_at?: string
          ends_at?: string | null
          floor_depth_m?: number
          floor_width_m?: number
          id?: string
          overlay_url?: string | null
          owner_id?: string
          site_lat?: number | null
          site_lon?: number | null
          site_zoom?: number | null
          snapshot_url?: string | null
          starts_at?: string | null
          status?: string
          summary?: string
          swag_text?: string | null
          swag_url?: string | null
          ticket_url?: string | null
          title?: string
          visibility?: string
        }
        Relationships: []
      }
      cast_floor_items: {
        Row: {
          assignee_id: string | null
          created_at: string
          d_m: number
          done: boolean
          due_at: string | null
          event_id: string
          id: string
          kind: string
          label: string
          layer: string
          owner_id: string
          parent_item_id: string | null
          points: Json
          release_at: string | null
          rot_deg: number
          sort_order: number
          stock: Json
          w_m: number
          x_m: number
          z_m: number
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          d_m?: number
          done?: boolean
          due_at?: string | null
          event_id: string
          id?: string
          kind: string
          label: string
          layer?: string
          owner_id: string
          parent_item_id?: string | null
          points?: Json
          release_at?: string | null
          rot_deg?: number
          sort_order?: number
          stock?: Json
          w_m?: number
          x_m: number
          z_m: number
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          d_m?: number
          done?: boolean
          due_at?: string | null
          event_id?: string
          id?: string
          kind?: string
          label?: string
          layer?: string
          owner_id?: string
          parent_item_id?: string | null
          points?: Json
          release_at?: string | null
          rot_deg?: number
          sort_order?: number
          stock?: Json
          w_m?: number
          x_m?: number
          z_m?: number
        }
        Relationships: [
          {
            foreignKeyName: "cast_floor_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "cast_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cast_floor_items_parent_item_id_fkey"
            columns: ["parent_item_id"]
            isOneToOne: false
            referencedRelation: "cast_floor_items"
            referencedColumns: ["id"]
          },
        ]
      }
      cast_listings: {
        Row: {
          available: boolean
          created_at: string
          description: string
          id: string
          owner_id: string
          title: string
          vendor_id: string
        }
        Insert: {
          available?: boolean
          created_at?: string
          description?: string
          id?: string
          owner_id: string
          title: string
          vendor_id: string
        }
        Update: {
          available?: boolean
          created_at?: string
          description?: string
          id?: string
          owner_id?: string
          title?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cast_listings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "cast_vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      cast_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          reservation_id: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          reservation_id: string
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          reservation_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cast_messages_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "cast_reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      cast_places: {
        Row: {
          description: string
          event_id: string
          id: string
          kind: string
          label: string
          owner_id: string
          x_m: number
          z_m: number
        }
        Insert: {
          description?: string
          event_id: string
          id?: string
          kind: string
          label: string
          owner_id: string
          x_m: number
          z_m: number
        }
        Update: {
          description?: string
          event_id?: string
          id?: string
          kind?: string
          label?: string
          owner_id?: string
          x_m?: number
          z_m?: number
        }
        Relationships: [
          {
            foreignKeyName: "cast_places_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "cast_events"
            referencedColumns: ["id"]
          },
        ]
      }
      cast_reservations: {
        Row: {
          attendee_id: string
          created_at: string
          id: string
          listing_id: string
          pickup_place_id: string | null
          status: string
          vendor_id: string
        }
        Insert: {
          attendee_id: string
          created_at?: string
          id?: string
          listing_id: string
          pickup_place_id?: string | null
          status?: string
          vendor_id: string
        }
        Update: {
          attendee_id?: string
          created_at?: string
          id?: string
          listing_id?: string
          pickup_place_id?: string | null
          status?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cast_reservations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "cast_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cast_reservations_pickup_place_id_fkey"
            columns: ["pickup_place_id"]
            isOneToOne: false
            referencedRelation: "cast_places"
            referencedColumns: ["id"]
          },
        ]
      }
      cast_schedule: {
        Row: {
          ends_at: string | null
          event_id: string
          id: string
          location: string
          owner_id: string
          starts_at: string
          title: string
        }
        Insert: {
          ends_at?: string | null
          event_id: string
          id?: string
          location?: string
          owner_id: string
          starts_at: string
          title: string
        }
        Update: {
          ends_at?: string | null
          event_id?: string
          id?: string
          location?: string
          owner_id?: string
          starts_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "cast_schedule_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "cast_events"
            referencedColumns: ["id"]
          },
        ]
      }
      cast_vendors: {
        Row: {
          created_at: string
          description: string
          event_id: string
          id: string
          name: string
          owner_id: string
          status: string
          x_m: number
          z_m: number
        }
        Insert: {
          created_at?: string
          description?: string
          event_id: string
          id?: string
          name: string
          owner_id: string
          status?: string
          x_m: number
          z_m: number
        }
        Update: {
          created_at?: string
          description?: string
          event_id?: string
          id?: string
          name?: string
          owner_id?: string
          status?: string
          x_m?: number
          z_m?: number
        }
        Relationships: [
          {
            foreignKeyName: "cast_vendors_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "cast_events"
            referencedColumns: ["id"]
          },
        ]
      }
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
      family_test_access: {
        Row: {
          created_at: string
          expires_at: string
          granted_by: string
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          granted_by: string
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          granted_by?: string
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      field_observations: {
        Row: {
          block: string
          client_id: string | null
          created_at: string
          id: string
          lat_grid: number | null
          lon_grid: number | null
          note: string | null
          observed: string
          observed_at: string | null
          report_age_min: number | null
          reported: string
          trend: string
          user_id: string
          verdict: number
        }
        Insert: {
          block: string
          client_id?: string | null
          created_at?: string
          id?: string
          lat_grid?: number | null
          lon_grid?: number | null
          note?: string | null
          observed: string
          observed_at?: string | null
          report_age_min?: number | null
          reported: string
          trend: string
          user_id: string
          verdict: number
        }
        Update: {
          block?: string
          client_id?: string | null
          created_at?: string
          id?: string
          lat_grid?: number | null
          lon_grid?: number | null
          note?: string | null
          observed?: string
          observed_at?: string | null
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
      fork_key_requests: {
        Row: {
          created_at: string
          email: string
          github_username: string
          id: string
          intended_use: string
          pr_url: string | null
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          github_username: string
          id?: string
          intended_use: string
          pr_url?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          github_username?: string
          id?: string
          intended_use?: string
          pr_url?: string | null
          status?: string
        }
        Relationships: []
      }
      free_install_receipts: {
        Row: {
          device_class: string | null
          installed_at: string
          language: string | null
          receipt_id: string
          region: string | null
        }
        Insert: {
          device_class?: string | null
          installed_at?: string
          language?: string | null
          receipt_id: string
          region?: string | null
        }
        Update: {
          device_class?: string | null
          installed_at?: string
          language?: string | null
          receipt_id?: string
          region?: string | null
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
      reserved_callsigns: {
        Row: {
          created_at: string
          owner_id: string | null
          prefix: string
        }
        Insert: {
          created_at?: string
          owner_id?: string | null
          prefix: string
        }
        Update: {
          created_at?: string
          owner_id?: string | null
          prefix?: string
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
      shield_devices: {
        Row: {
          created_at: string
          id: string
          label: string
          last_seen_at: string | null
          token_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string
          last_seen_at?: string | null
          token_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          last_seen_at?: string | null
          token_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      shield_readings: {
        Row: {
          accuracy_m: number | null
          bssid: string | null
          channel: number | null
          device_id: string | null
          id: number
          lat: number | null
          lng: number | null
          observed_at: string
          received_at: string
          rssi: number | null
          source: string
          ssid: string | null
          user_id: string
        }
        Insert: {
          accuracy_m?: number | null
          bssid?: string | null
          channel?: number | null
          device_id?: string | null
          id?: never
          lat?: number | null
          lng?: number | null
          observed_at: string
          received_at?: string
          rssi?: number | null
          source: string
          ssid?: string | null
          user_id: string
        }
        Update: {
          accuracy_m?: number | null
          bssid?: string | null
          channel?: number | null
          device_id?: string | null
          id?: never
          lat?: number | null
          lng?: number | null
          observed_at?: string
          received_at?: string
          rssi?: number | null
          source?: string
          ssid?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shield_readings_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "shield_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      study_checkins: {
        Row: {
          cadence_days: number
          created_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cadence_days?: number
          created_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cadence_days?: number
          created_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      venue_floor_templates: {
        Row: {
          city: string
          created_at: string
          floor_depth_m: number
          floor_width_m: number
          id: string
          layout: Json
          name: string
          note: string
          site_lat: number
          site_lon: number
          site_status: string
          slug: string
          source_url: string
        }
        Insert: {
          city: string
          created_at?: string
          floor_depth_m: number
          floor_width_m: number
          id?: string
          layout?: Json
          name: string
          note: string
          site_lat: number
          site_lon: number
          site_status: string
          slug: string
          source_url: string
        }
        Update: {
          city?: string
          created_at?: string
          floor_depth_m?: number
          floor_width_m?: number
          id?: string
          layout?: Json
          name?: string
          note?: string
          site_lat?: number
          site_lon?: number
          site_status?: string
          slug?: string
          source_url?: string
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
      can_use_callsign: { Args: { _callsign: string }; Returns: boolean }
      cast_assign_subfloor: {
        Args: { _email: string; _item: string }
        Returns: undefined
      }
      cast_subfloor_assignee: { Args: { _item: string }; Returns: string }
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
      free_install_breakdown: {
        Args: never
        Returns: {
          device_class: string
          installs: number
          language: string
          region: string
        }[]
      }
      free_install_count: { Args: never; Returns: number }
      has_mesh_builder: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_shield_connected: { Args: { _user_id: string }; Returns: boolean }
      owner_email: { Args: never; Returns: string }
      record_free_install:
        | { Args: { _receipt_id: string }; Returns: number }
        | {
            Args: {
              _device_class?: string
              _language?: string
              _receipt_id: string
              _region?: string
            }
            Returns: undefined
          }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
