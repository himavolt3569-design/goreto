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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string
          description: string
          hero_eyebrow: string
          hero_image_alt: string
          hero_image_path: string | null
          hero_text: string
          hero_title: string
          id: string
          image_path: string | null
          is_active: boolean
          parent_id: string | null
          slug: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          hero_eyebrow?: string
          hero_image_alt?: string
          hero_image_path?: string | null
          hero_text?: string
          hero_title?: string
          id?: string
          image_path?: string | null
          is_active?: boolean
          parent_id?: string | null
          slug: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          hero_eyebrow?: string
          hero_image_alt?: string
          hero_image_path?: string | null
          hero_text?: string
          hero_title?: string
          id?: string
          image_path?: string | null
          is_active?: boolean
          parent_id?: string | null
          slug?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_products: {
        Row: {
          collection_id: string
          product_id: string
          sort_order: number
        }
        Insert: {
          collection_id: string
          product_id: string
          sort_order?: number
        }
        Update: {
          collection_id?: string
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "collection_products_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_inventory"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "collection_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          created_at: string
          description: string
          ends_at: string | null
          eyebrow: string
          hero_image_alt: string
          hero_image_path: string | null
          id: string
          is_active: boolean
          slug: string
          sort_order: number
          starts_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          ends_at?: string | null
          eyebrow?: string
          hero_image_alt?: string
          hero_image_path?: string | null
          id?: string
          is_active?: boolean
          slug: string
          sort_order?: number
          starts_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          ends_at?: string | null
          eyebrow?: string
          hero_image_alt?: string
          hero_image_path?: string | null
          id?: string
          is_active?: boolean
          slug?: string
          sort_order?: number
          starts_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      coupons: {
        Row: {
          amount_off_paisa: number | null
          code: string
          created_at: string
          description: string
          ends_at: string | null
          id: string
          is_active: boolean
          max_discount_paisa: number | null
          min_order_paisa: number | null
          percent_off: number | null
          starts_at: string
          times_used: number
          type: Database["public"]["Enums"]["coupon_type"]
          updated_at: string
          usage_limit: number | null
          usage_limit_per_customer: number | null
        }
        Insert: {
          amount_off_paisa?: number | null
          code: string
          created_at?: string
          description?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          max_discount_paisa?: number | null
          min_order_paisa?: number | null
          percent_off?: number | null
          starts_at: string
          times_used?: number
          type: Database["public"]["Enums"]["coupon_type"]
          updated_at?: string
          usage_limit?: number | null
          usage_limit_per_customer?: number | null
        }
        Update: {
          amount_off_paisa?: number | null
          code?: string
          created_at?: string
          description?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          max_discount_paisa?: number | null
          min_order_paisa?: number | null
          percent_off?: number | null
          starts_at?: string
          times_used?: number
          type?: Database["public"]["Enums"]["coupon_type"]
          updated_at?: string
          usage_limit?: number | null
          usage_limit_per_customer?: number | null
        }
        Relationships: []
      }
      courier_api_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          duration_ms: number | null
          error_code: string | null
          error_message: string | null
          id: string
          order_id: string | null
          provider: string
          success: boolean
          trace_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          order_id?: string | null
          provider: string
          success: boolean
          trace_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          order_id?: string | null
          provider?: string
          success?: boolean
          trace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courier_api_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_api_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_handoffs: {
        Row: {
          attempts: number
          channel: Database["public"]["Enums"]["courier_handoff_channel"]
          courier_id: string | null
          created_at: string
          first_sent_at: string | null
          id: string
          last_sent_at: string | null
          last_sent_by: string | null
          order_id: string
          shipment_id: string
          status: Database["public"]["Enums"]["courier_handoff_status"]
          updated_at: string
        }
        Insert: {
          attempts?: number
          channel?: Database["public"]["Enums"]["courier_handoff_channel"]
          courier_id?: string | null
          created_at?: string
          first_sent_at?: string | null
          id?: string
          last_sent_at?: string | null
          last_sent_by?: string | null
          order_id: string
          shipment_id: string
          status?: Database["public"]["Enums"]["courier_handoff_status"]
          updated_at?: string
        }
        Update: {
          attempts?: number
          channel?: Database["public"]["Enums"]["courier_handoff_channel"]
          courier_id?: string | null
          created_at?: string
          first_sent_at?: string | null
          id?: string
          last_sent_at?: string | null
          last_sent_by?: string | null
          order_id?: string
          shipment_id?: string
          status?: Database["public"]["Enums"]["courier_handoff_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courier_handoffs_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_handoffs_last_sent_by_fkey"
            columns: ["last_sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_handoffs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_handoffs_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_provider_accounts: {
        Row: {
          auto_book: boolean
          booking_endpoint: string
          box_presets: Json
          created_at: string
          declare_insurance: boolean
          default_delivery_option: string
          default_height_cm: number
          default_item_category: string | null
          default_length_cm: number
          default_open_box: boolean
          default_weight_grams: number | null
          default_width_cm: number
          external_seller_id: string | null
          id: string
          linked_at: string | null
          origin_address_details: string | null
          origin_daraz_address_id: string | null
          origin_email: string | null
          origin_latitude: number | null
          origin_longitude: number | null
          origin_name: string | null
          origin_phone_e164: string | null
          phone_format: string
          pickup_synced_at: string | null
          pickup_warehouse_code: string | null
          platform_name: string | null
          provider: string
          return_synced_at: string | null
          return_warehouse_code: string | null
          solution_codes: string[]
          undeliverable_option: string
          updated_at: string
          xspace_case_template_id: number | null
          xspace_category_id: string | null
        }
        Insert: {
          auto_book?: boolean
          booking_endpoint?: string
          box_presets?: Json
          created_at?: string
          declare_insurance?: boolean
          default_delivery_option?: string
          default_height_cm?: number
          default_item_category?: string | null
          default_length_cm?: number
          default_open_box?: boolean
          default_weight_grams?: number | null
          default_width_cm?: number
          external_seller_id?: string | null
          id?: string
          linked_at?: string | null
          origin_address_details?: string | null
          origin_daraz_address_id?: string | null
          origin_email?: string | null
          origin_latitude?: number | null
          origin_longitude?: number | null
          origin_name?: string | null
          origin_phone_e164?: string | null
          phone_format?: string
          pickup_synced_at?: string | null
          pickup_warehouse_code?: string | null
          platform_name?: string | null
          provider: string
          return_synced_at?: string | null
          return_warehouse_code?: string | null
          solution_codes?: string[]
          undeliverable_option?: string
          updated_at?: string
          xspace_case_template_id?: number | null
          xspace_category_id?: string | null
        }
        Update: {
          auto_book?: boolean
          booking_endpoint?: string
          box_presets?: Json
          created_at?: string
          declare_insurance?: boolean
          default_delivery_option?: string
          default_height_cm?: number
          default_item_category?: string | null
          default_length_cm?: number
          default_open_box?: boolean
          default_weight_grams?: number | null
          default_width_cm?: number
          external_seller_id?: string | null
          id?: string
          linked_at?: string | null
          origin_address_details?: string | null
          origin_daraz_address_id?: string | null
          origin_email?: string | null
          origin_latitude?: number | null
          origin_longitude?: number | null
          origin_name?: string | null
          origin_phone_e164?: string | null
          phone_format?: string
          pickup_synced_at?: string | null
          pickup_warehouse_code?: string | null
          platform_name?: string | null
          provider?: string
          return_synced_at?: string | null
          return_warehouse_code?: string | null
          solution_codes?: string[]
          undeliverable_option?: string
          updated_at?: string
          xspace_case_template_id?: number | null
          xspace_category_id?: string | null
        }
        Relationships: []
      }
      courier_remittances: {
        Row: {
          created_at: string
          deductions_paisa: number
          expected_paisa: number
          gross_paisa: number
          id: string
          net_paisa: number | null
          note: string | null
          parcel_count: number
          provider: string
          recorded_by: string | null
          reference: string
          statement_date: string
        }
        Insert: {
          created_at?: string
          deductions_paisa?: number
          expected_paisa: number
          gross_paisa: number
          id?: string
          net_paisa?: number | null
          note?: string | null
          parcel_count: number
          provider: string
          recorded_by?: string | null
          reference: string
          statement_date: string
        }
        Update: {
          created_at?: string
          deductions_paisa?: number
          expected_paisa?: number
          gross_paisa?: number
          id?: string
          net_paisa?: number | null
          note?: string | null
          parcel_count?: number
          provider?: string
          recorded_by?: string | null
          reference?: string
          statement_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "courier_remittances_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_services: {
        Row: {
          courier_id: string
          created_at: string
          description: string
          estimated_max_days: number
          estimated_min_days: number
          id: string
          is_active: boolean
          name: string
          provider_option: string | null
          service_code: string
          service_level: Database["public"]["Enums"]["service_level"]
          updated_at: string
        }
        Insert: {
          courier_id: string
          created_at?: string
          description?: string
          estimated_max_days: number
          estimated_min_days: number
          id?: string
          is_active?: boolean
          name: string
          provider_option?: string | null
          service_code: string
          service_level: Database["public"]["Enums"]["service_level"]
          updated_at?: string
        }
        Update: {
          courier_id?: string
          created_at?: string
          description?: string
          estimated_max_days?: number
          estimated_min_days?: number
          id?: string
          is_active?: boolean
          name?: string
          provider_option?: string | null
          service_code?: string
          service_level?: Database["public"]["Enums"]["service_level"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courier_services_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_support_cases: {
        Row: {
          case_id: string
          created_at: string
          created_by: string | null
          id: string
          order_id: string | null
          provider: string
          rating: number | null
          status: string | null
          subject: string
          synced_at: string | null
          tracking_number: string | null
        }
        Insert: {
          case_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          order_id?: string | null
          provider: string
          rating?: number | null
          status?: string | null
          subject: string
          synced_at?: string | null
          tracking_number?: string | null
        }
        Update: {
          case_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          order_id?: string | null
          provider?: string
          rating?: number | null
          status?: string | null
          subject?: string
          synced_at?: string | null
          tracking_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courier_support_cases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_support_cases_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_webhook_inbox: {
        Row: {
          attempts: number
          body_sha256: string
          error: string | null
          id: string
          payload: Json
          processed_at: string | null
          provider: string
          received_at: string
        }
        Insert: {
          attempts?: number
          body_sha256: string
          error?: string | null
          id?: string
          payload: Json
          processed_at?: string | null
          provider: string
          received_at?: string
        }
        Update: {
          attempts?: number
          body_sha256?: string
          error?: string | null
          id?: string
          payload?: Json
          processed_at?: string | null
          provider?: string
          received_at?: string
        }
        Relationships: []
      }
      couriers: {
        Row: {
          api_provider: string | null
          created_at: string
          dispatch_whatsapp_e164: string | null
          id: string
          integration_mode: Database["public"]["Enums"]["courier_integration_mode"]
          is_active: boolean
          logo_path: string | null
          name: string
          slug: string
          support_phone: string | null
          tracking_url_template: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          api_provider?: string | null
          created_at?: string
          dispatch_whatsapp_e164?: string | null
          id?: string
          integration_mode?: Database["public"]["Enums"]["courier_integration_mode"]
          is_active?: boolean
          logo_path?: string | null
          name: string
          slug: string
          support_phone?: string | null
          tracking_url_template?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          api_provider?: string | null
          created_at?: string
          dispatch_whatsapp_e164?: string | null
          id?: string
          integration_mode?: Database["public"]["Enums"]["courier_integration_mode"]
          is_active?: boolean
          logo_path?: string | null
          name?: string
          slug?: string
          support_phone?: string | null
          tracking_url_template?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      customer_addresses: {
        Row: {
          created_at: string
          district_code: string
          id: string
          is_default: boolean
          label: string
          latitude: number | null
          longitude: number | null
          municipality_code: string
          phone_e164: string
          postal_code: string | null
          province_code: string
          recipient_name: string
          street_landmark: string
          updated_at: string
          user_id: string
          ward: number
        }
        Insert: {
          created_at?: string
          district_code: string
          id?: string
          is_default?: boolean
          label?: string
          latitude?: number | null
          longitude?: number | null
          municipality_code: string
          phone_e164: string
          postal_code?: string | null
          province_code: string
          recipient_name: string
          street_landmark: string
          updated_at?: string
          user_id: string
          ward: number
        }
        Update: {
          created_at?: string
          district_code?: string
          id?: string
          is_default?: boolean
          label?: string
          latitude?: number | null
          longitude?: number | null
          municipality_code?: string
          phone_e164?: string
          postal_code?: string | null
          province_code?: string
          recipient_name?: string
          street_landmark?: string
          updated_at?: string
          user_id?: string
          ward?: number
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_district_code_fkey"
            columns: ["district_code"]
            isOneToOne: false
            referencedRelation: "nepal_districts"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "customer_addresses_municipality_code_fkey"
            columns: ["municipality_code"]
            isOneToOne: false
            referencedRelation: "nepal_municipalities"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "customer_addresses_province_code_fkey"
            columns: ["province_code"]
            isOneToOne: false
            referencedRelation: "nepal_provinces"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "customer_addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daraz_locations: {
        Row: {
          daraz_address_id: string
          daraz_city: string | null
          municipality_code: string
          updated_at: string
        }
        Insert: {
          daraz_address_id: string
          daraz_city?: string | null
          municipality_code: string
          updated_at?: string
        }
        Update: {
          daraz_address_id?: string
          daraz_city?: string | null
          municipality_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daraz_locations_municipality_code_fkey"
            columns: ["municipality_code"]
            isOneToOne: true
            referencedRelation: "nepal_municipalities"
            referencedColumns: ["code"]
          },
        ]
      }
      delivery_rates: {
        Row: {
          courier_service_id: string
          created_at: string
          estimated_max_days: number | null
          estimated_min_days: number | null
          id: string
          is_active: boolean
          max_weight_grams: number | null
          min_order_paisa: number | null
          min_weight_grams: number | null
          price_paisa: number
          updated_at: string
          zone_id: string
        }
        Insert: {
          courier_service_id: string
          created_at?: string
          estimated_max_days?: number | null
          estimated_min_days?: number | null
          id?: string
          is_active?: boolean
          max_weight_grams?: number | null
          min_order_paisa?: number | null
          min_weight_grams?: number | null
          price_paisa: number
          updated_at?: string
          zone_id: string
        }
        Update: {
          courier_service_id?: string
          created_at?: string
          estimated_max_days?: number | null
          estimated_min_days?: number | null
          id?: string
          is_active?: boolean
          max_weight_grams?: number | null
          min_order_paisa?: number | null
          min_weight_grams?: number | null
          price_paisa?: number
          updated_at?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_rates_courier_service_id_fkey"
            columns: ["courier_service_id"]
            isOneToOne: false
            referencedRelation: "courier_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_rates_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_zones: {
        Row: {
          created_at: string
          description: string
          district_codes: string[]
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          district_codes?: string[]
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          district_codes?: string[]
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      nepal_districts: {
        Row: {
          code: string
          name: string
          province_code: string
          sort_order: number
        }
        Insert: {
          code: string
          name: string
          province_code: string
          sort_order?: number
        }
        Update: {
          code?: string
          name?: string
          province_code?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "nepal_districts_province_code_fkey"
            columns: ["province_code"]
            isOneToOne: false
            referencedRelation: "nepal_provinces"
            referencedColumns: ["code"]
          },
        ]
      }
      nepal_municipalities: {
        Row: {
          code: string
          district_code: string
          latitude: number | null
          longitude: number | null
          name: string
          postal_code: string | null
          type: Database["public"]["Enums"]["municipality_type"]
          ward_count: number
        }
        Insert: {
          code: string
          district_code: string
          latitude?: number | null
          longitude?: number | null
          name: string
          postal_code?: string | null
          type: Database["public"]["Enums"]["municipality_type"]
          ward_count: number
        }
        Update: {
          code?: string
          district_code?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          postal_code?: string | null
          type?: Database["public"]["Enums"]["municipality_type"]
          ward_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "nepal_municipalities_district_code_fkey"
            columns: ["district_code"]
            isOneToOne: false
            referencedRelation: "nepal_districts"
            referencedColumns: ["code"]
          },
        ]
      }
      nepal_provinces: {
        Row: {
          code: string
          name: string
          number: number
          sort_order: number
        }
        Insert: {
          code: string
          name: string
          number: number
          sort_order?: number
        }
        Update: {
          code?: string
          name?: string
          number?: number
          sort_order?: number
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          email: string
          id: string
          profile_id: string | null
          source: Database["public"]["Enums"]["newsletter_source"]
          status: Database["public"]["Enums"]["newsletter_status"]
          subscribed_at: string
          unsubscribed_at: string | null
        }
        Insert: {
          email: string
          id?: string
          profile_id?: string | null
          source: Database["public"]["Enums"]["newsletter_source"]
          status?: Database["public"]["Enums"]["newsletter_status"]
          subscribed_at?: string
          unsubscribed_at?: string | null
        }
        Update: {
          email?: string
          id?: string
          profile_id?: string | null
          source?: Database["public"]["Enums"]["newsletter_source"]
          status?: Database["public"]["Enums"]["newsletter_status"]
          subscribed_at?: string
          unsubscribed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_subscribers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          href: string
          id: string
          kind: Database["public"]["Enums"]["notification_kind"]
          order_id: string | null
          read_at: string | null
          recipient_id: string
          title: string
        }
        Insert: {
          body?: string
          created_at?: string
          href: string
          id?: string
          kind: Database["public"]["Enums"]["notification_kind"]
          order_id?: string | null
          read_at?: string | null
          recipient_id: string
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          href?: string
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          order_id?: string | null
          read_at?: string | null
          recipient_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          image_path: string | null
          line_total_paisa: number
          order_id: string
          product_id: string | null
          product_title: string
          quantity: number
          sku: string
          unit_price_paisa: number
          variant_id: string | null
          variant_title: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          image_path?: string | null
          line_total_paisa: number
          order_id: string
          product_id?: string | null
          product_title: string
          quantity: number
          sku: string
          unit_price_paisa: number
          variant_id?: string | null
          variant_title?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          image_path?: string | null
          line_total_paisa?: number
          order_id?: string
          product_id?: string | null
          product_title?: string
          quantity?: number
          sku?: string
          unit_price_paisa?: number
          variant_id?: string | null
          variant_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_inventory"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "admin_inventory"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          accepted_via: Database["public"]["Enums"]["order_acceptance"] | null
          canceled_at: string | null
          canceled_by: string | null
          cancellation_reason: string | null
          channel: Database["public"]["Enums"]["order_channel"]
          confirmed_at: string | null
          contact_email: string | null
          contact_name: string
          contact_phone_e164: string
          coupon_code: string | null
          coupon_id: string | null
          courier_service_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          customer_note: string | null
          delivered_at: string | null
          delivery_fee_paisa: number
          delivery_snapshot: Json
          discount_paisa: number
          guest_tracking_hash: string | null
          id: string
          order_number: string
          packed_at: string | null
          payment_collected_at: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_status: Database["public"]["Enums"]["payment_status"]
          refunded_at: string | null
          shipped_at: string | null
          shipping_address: Json
          status: Database["public"]["Enums"]["order_status"]
          subtotal_paisa: number
          total_paisa: number
          updated_at: string
          user_id: string | null
          whatsapp_e164: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          accepted_via?: Database["public"]["Enums"]["order_acceptance"] | null
          canceled_at?: string | null
          canceled_by?: string | null
          cancellation_reason?: string | null
          channel?: Database["public"]["Enums"]["order_channel"]
          confirmed_at?: string | null
          contact_email?: string | null
          contact_name: string
          contact_phone_e164: string
          coupon_code?: string | null
          coupon_id?: string | null
          courier_service_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_note?: string | null
          delivered_at?: string | null
          delivery_fee_paisa?: number
          delivery_snapshot: Json
          discount_paisa?: number
          guest_tracking_hash?: string | null
          id?: string
          order_number: string
          packed_at?: string | null
          payment_collected_at?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          refunded_at?: string | null
          shipped_at?: string | null
          shipping_address: Json
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_paisa: number
          total_paisa: number
          updated_at?: string
          user_id?: string | null
          whatsapp_e164?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          accepted_via?: Database["public"]["Enums"]["order_acceptance"] | null
          canceled_at?: string | null
          canceled_by?: string | null
          cancellation_reason?: string | null
          channel?: Database["public"]["Enums"]["order_channel"]
          confirmed_at?: string | null
          contact_email?: string | null
          contact_name?: string
          contact_phone_e164?: string
          coupon_code?: string | null
          coupon_id?: string | null
          courier_service_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_note?: string | null
          delivered_at?: string | null
          delivery_fee_paisa?: number
          delivery_snapshot?: Json
          discount_paisa?: number
          guest_tracking_hash?: string | null
          id?: string
          order_number?: string
          packed_at?: string | null
          payment_collected_at?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          refunded_at?: string | null
          shipped_at?: string | null
          shipping_address?: Json
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_paisa?: number
          total_paisa?: number
          updated_at?: string
          user_id?: string | null
          whatsapp_e164?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_canceled_by_fkey"
            columns: ["canceled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_courier_service_id_fkey"
            columns: ["courier_service_id"]
            isOneToOne: false
            referencedRelation: "courier_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_ar_assets: {
        Row: {
          asset_format: string
          asset_path: string
          calibration: Json
          created_at: string
          id: string
          is_active: boolean
          mode: Database["public"]["Enums"]["ar_mode"]
          placement: Database["public"]["Enums"]["ar_placement"]
          product_id: string
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          asset_format: string
          asset_path: string
          calibration?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          mode: Database["public"]["Enums"]["ar_mode"]
          placement: Database["public"]["Enums"]["ar_placement"]
          product_id: string
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          asset_format?: string
          asset_path?: string
          calibration?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          mode?: Database["public"]["Enums"]["ar_mode"]
          placement?: Database["public"]["Enums"]["ar_placement"]
          product_id?: string
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_ar_assets_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_inventory"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_ar_assets_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_ar_assets_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "admin_inventory"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "product_ar_assets_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_media: {
        Row: {
          alt_text: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["media_kind"]
          product_id: string
          sort_order: number
          storage_path: string
          variant_id: string | null
        }
        Insert: {
          alt_text?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["media_kind"]
          product_id: string
          sort_order?: number
          storage_path: string
          variant_id?: string | null
        }
        Update: {
          alt_text?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["media_kind"]
          product_id?: string
          sort_order?: number
          storage_path?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_media_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_inventory"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_media_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_media_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "admin_inventory"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "product_media_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          option_values: Json
          price_paisa: number | null
          product_id: string
          sku: string
          sort_order: number
          stock_quantity: number
          title: string | null
          updated_at: string
          weight_grams: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          option_values?: Json
          price_paisa?: number | null
          product_id: string
          sku: string
          sort_order?: number
          stock_quantity?: number
          title?: string | null
          updated_at?: string
          weight_grams?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          option_values?: Json
          price_paisa?: number | null
          product_id?: string
          sku?: string
          sort_order?: number
          stock_quantity?: number
          title?: string | null
          updated_at?: string
          weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_inventory"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          archived_at: string | null
          base_price_paisa: number
          care_instructions: string
          category_id: string
          compare_at_price_paisa: number | null
          created_at: string
          description: string
          id: string
          is_bestseller: boolean
          is_featured: boolean
          is_limited_edition: boolean
          is_sponsored: boolean
          low_stock_threshold: number
          options: Json
          published_at: string | null
          search_vector: unknown
          short_description: string
          slug: string
          specs: Json
          status: Database["public"]["Enums"]["product_status"]
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          base_price_paisa: number
          care_instructions?: string
          category_id: string
          compare_at_price_paisa?: number | null
          created_at?: string
          description?: string
          id?: string
          is_bestseller?: boolean
          is_featured?: boolean
          is_limited_edition?: boolean
          is_sponsored?: boolean
          low_stock_threshold?: number
          options?: Json
          published_at?: string | null
          search_vector?: unknown
          short_description?: string
          slug: string
          specs?: Json
          status?: Database["public"]["Enums"]["product_status"]
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          base_price_paisa?: number
          care_instructions?: string
          category_id?: string
          compare_at_price_paisa?: number | null
          created_at?: string
          description?: string
          id?: string
          is_bestseller?: boolean
          is_featured?: boolean
          is_limited_edition?: boolean
          is_sponsored?: boolean
          low_stock_threshold?: number
          options?: Json
          published_at?: string | null
          search_vector?: unknown
          short_description?: string
          slug?: string
          specs?: Json
          status?: Database["public"]["Enums"]["product_status"]
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          clerk_updated_at: string | null
          clerk_user_id: string
          created_at: string
          deleted_at: string | null
          email: string | null
          full_name: string | null
          id: string
          phone_e164: string | null
          role: Database["public"]["Enums"]["profile_role"]
          updated_at: string
        }
        Insert: {
          clerk_updated_at?: string | null
          clerk_user_id: string
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone_e164?: string | null
          role?: Database["public"]["Enums"]["profile_role"]
          updated_at?: string
        }
        Update: {
          clerk_updated_at?: string | null
          clerk_user_id?: string
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone_e164?: string | null
          role?: Database["public"]["Enums"]["profile_role"]
          updated_at?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          body: string
          created_at: string
          id: string
          moderated_at: string | null
          moderated_by: string | null
          moderation_note: string | null
          order_item_id: string | null
          product_id: string
          rating: number
          status: Database["public"]["Enums"]["review_status"]
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_note?: string | null
          order_item_id?: string | null
          product_id: string
          rating: number
          status?: Database["public"]["Enums"]["review_status"]
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_note?: string | null
          order_item_id?: string | null
          product_id?: string
          rating?: number
          status?: Database["public"]["Enums"]["review_status"]
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_moderated_by_fkey"
            columns: ["moderated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_inventory"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_courier_finance: {
        Row: {
          actual_fee_paisa: number | null
          cod_remittance_id: string | null
          estimated_fee_paisa: number | null
          shipment_id: string
          updated_at: string
        }
        Insert: {
          actual_fee_paisa?: number | null
          cod_remittance_id?: string | null
          estimated_fee_paisa?: number | null
          shipment_id: string
          updated_at?: string
        }
        Update: {
          actual_fee_paisa?: number | null
          cod_remittance_id?: string | null
          estimated_fee_paisa?: number | null
          shipment_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_courier_finance_cod_remittance_id_fkey"
            columns: ["cod_remittance_id"]
            isOneToOne: false
            referencedRelation: "courier_remittances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_courier_finance_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: true
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_events: {
        Row: {
          created_at: string
          id: string
          latitude: number | null
          location_label: string | null
          longitude: number | null
          message: string
          occurred_at: string
          provider_event_key: string | null
          shipment_id: string
          source: Database["public"]["Enums"]["shipment_event_source"]
          status: Database["public"]["Enums"]["shipment_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          latitude?: number | null
          location_label?: string | null
          longitude?: number | null
          message: string
          occurred_at: string
          provider_event_key?: string | null
          shipment_id: string
          source: Database["public"]["Enums"]["shipment_event_source"]
          status: Database["public"]["Enums"]["shipment_status"]
        }
        Update: {
          created_at?: string
          id?: string
          latitude?: number | null
          location_label?: string | null
          longitude?: number | null
          message?: string
          occurred_at?: string
          provider_event_key?: string | null
          shipment_id?: string
          source?: Database["public"]["Enums"]["shipment_event_source"]
          status?: Database["public"]["Enums"]["shipment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "shipment_events_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          assigned_at: string | null
          awb_printed_at: string | null
          booked_at: string | null
          courier_id: string | null
          courier_service_id: string | null
          created_at: string
          delivered_at: string | null
          delivery_option: string | null
          estimated_delivery_from: string | null
          estimated_delivery_to: string | null
          first_mile_type: string | null
          id: string
          last_mile_provider: string | null
          order_id: string
          package_height_cm: number | null
          package_length_cm: number | null
          package_weight_grams: number | null
          package_width_cm: number | null
          pickup_cutoff_at: string | null
          provider: string | null
          provider_auto_book_failed_at: string | null
          provider_booking_attempts: number
          provider_canceled_at: string | null
          provider_needs_action: boolean
          provider_package_code: string | null
          provider_receiver: Json | null
          provider_reference: string | null
          provider_status: string | null
          provider_synced_at: string | null
          ready_to_ship_at: string | null
          status: Database["public"]["Enums"]["shipment_status"]
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          awb_printed_at?: string | null
          booked_at?: string | null
          courier_id?: string | null
          courier_service_id?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_option?: string | null
          estimated_delivery_from?: string | null
          estimated_delivery_to?: string | null
          first_mile_type?: string | null
          id?: string
          last_mile_provider?: string | null
          order_id: string
          package_height_cm?: number | null
          package_length_cm?: number | null
          package_weight_grams?: number | null
          package_width_cm?: number | null
          pickup_cutoff_at?: string | null
          provider?: string | null
          provider_auto_book_failed_at?: string | null
          provider_booking_attempts?: number
          provider_canceled_at?: string | null
          provider_needs_action?: boolean
          provider_package_code?: string | null
          provider_receiver?: Json | null
          provider_reference?: string | null
          provider_status?: string | null
          provider_synced_at?: string | null
          ready_to_ship_at?: string | null
          status?: Database["public"]["Enums"]["shipment_status"]
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          awb_printed_at?: string | null
          booked_at?: string | null
          courier_id?: string | null
          courier_service_id?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_option?: string | null
          estimated_delivery_from?: string | null
          estimated_delivery_to?: string | null
          first_mile_type?: string | null
          id?: string
          last_mile_provider?: string | null
          order_id?: string
          package_height_cm?: number | null
          package_length_cm?: number | null
          package_weight_grams?: number | null
          package_width_cm?: number | null
          pickup_cutoff_at?: string | null
          provider?: string | null
          provider_auto_book_failed_at?: string | null
          provider_booking_attempts?: number
          provider_canceled_at?: string | null
          provider_needs_action?: boolean
          provider_package_code?: string | null
          provider_receiver?: Json | null
          provider_reference?: string | null
          provider_status?: string | null
          provider_synced_at?: string | null
          ready_to_ship_at?: string | null
          status?: Database["public"]["Enums"]["shipment_status"]
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipments_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_courier_service_id_fkey"
            columns: ["courier_service_id"]
            isOneToOne: false
            referencedRelation: "courier_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_invitations: {
        Row: {
          accepted_at: string | null
          accepted_profile_id: string | null
          clerk_invitation_id: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          permissions: Database["public"]["Enums"]["staff_permission"][]
          revoked_at: string | null
          status: Database["public"]["Enums"]["staff_invitation_status"]
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_profile_id?: string | null
          clerk_invitation_id?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          permissions?: Database["public"]["Enums"]["staff_permission"][]
          revoked_at?: string | null
          status?: Database["public"]["Enums"]["staff_invitation_status"]
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_profile_id?: string | null
          clerk_invitation_id?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          permissions?: Database["public"]["Enums"]["staff_permission"][]
          revoked_at?: string | null
          status?: Database["public"]["Enums"]["staff_invitation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_invitations_accepted_profile_id_fkey"
            columns: ["accepted_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_permissions: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          permission_key: Database["public"]["Enums"]["staff_permission"]
          profile_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          permission_key: Database["public"]["Enums"]["staff_permission"]
          profile_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          permission_key?: Database["public"]["Enums"]["staff_permission"]
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_permissions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_permissions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      store_settings: {
        Row: {
          auto_accept_website_orders: boolean
          auto_accept_whatsapp_orders: boolean
          cod_enabled: boolean
          cod_max_order_paisa: number | null
          country_code: string
          courier_assignment_mode: Database["public"]["Enums"]["courier_assignment_mode"]
          created_at: string
          currency: string
          default_courier_id: string | null
          default_low_stock_threshold: number
          dispatch_municipality_code: string | null
          feature_flags: Json
          id: string
          order_number_prefix: string
          phone_country_code: string
          returns_window_days: number
          singleton: boolean
          social_links: Json
          store_name: string
          support_email: string | null
          support_phone_e164: string | null
          tagline: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          auto_accept_website_orders?: boolean
          auto_accept_whatsapp_orders?: boolean
          cod_enabled?: boolean
          cod_max_order_paisa?: number | null
          country_code?: string
          courier_assignment_mode?: Database["public"]["Enums"]["courier_assignment_mode"]
          created_at?: string
          currency?: string
          default_courier_id?: string | null
          default_low_stock_threshold?: number
          dispatch_municipality_code?: string | null
          feature_flags?: Json
          id?: string
          order_number_prefix?: string
          phone_country_code?: string
          returns_window_days?: number
          singleton?: boolean
          social_links?: Json
          store_name: string
          support_email?: string | null
          support_phone_e164?: string | null
          tagline?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          auto_accept_website_orders?: boolean
          auto_accept_whatsapp_orders?: boolean
          cod_enabled?: boolean
          cod_max_order_paisa?: number | null
          country_code?: string
          courier_assignment_mode?: Database["public"]["Enums"]["courier_assignment_mode"]
          created_at?: string
          currency?: string
          default_courier_id?: string | null
          default_low_stock_threshold?: number
          dispatch_municipality_code?: string | null
          feature_flags?: Json
          id?: string
          order_number_prefix?: string
          phone_country_code?: string
          returns_window_days?: number
          singleton?: boolean
          social_links?: Json
          store_name?: string
          support_email?: string | null
          support_phone_e164?: string | null
          tagline?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_settings_default_courier_id_fkey"
            columns: ["default_courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_settings_dispatch_municipality_code_fkey"
            columns: ["dispatch_municipality_code"]
            isOneToOne: false
            referencedRelation: "nepal_municipalities"
            referencedColumns: ["code"]
          },
        ]
      }
      wishlist_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_inventory"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "wishlist_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlist_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      admin_inventory: {
        Row: {
          category_title: string | null
          low_stock_threshold: number | null
          option_values: Json | null
          product_id: string | null
          product_slug: string | null
          product_status: Database["public"]["Enums"]["product_status"] | null
          product_title: string | null
          sku: string | null
          stock_quantity: number | null
          stock_state: string | null
          updated_at: string | null
          variant_active: boolean | null
          variant_id: string | null
          variant_title: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_order_core: {
        Args: {
          p_actor: string
          p_courier_id: string
          p_order_id: string
          p_via: Database["public"]["Enums"]["order_acceptance"]
        }
        Returns: Json
      }
      account_delete_address: { Args: { p_id: string }; Returns: undefined }
      account_reviewable_products: {
        Args: never
        Returns: {
          delivered_at: string
          image_path: string
          product_id: string
          slug: string
          title: string
        }[]
      }
      account_save_address: {
        Args: {
          p_district_code: string
          p_id: string
          p_label: string
          p_latitude?: number
          p_longitude?: number
          p_make_default: boolean
          p_municipality_code: string
          p_phone_e164: string
          p_postal_code: string
          p_province_code: string
          p_recipient_name: string
          p_street_landmark: string
          p_ward: number
        }
        Returns: string
      }
      account_set_default_address: {
        Args: { p_id: string }
        Returns: undefined
      }
      account_summary: {
        Args: never
        Returns: {
          billed_order_count: number
          billed_paisa: number
          in_progress_count: number
          order_count: number
          pending_order_count: number
          pending_paisa: number
        }[]
      }
      account_tracking_events: {
        Args: { p_limit?: number }
        Returns: {
          location_label: string
          message: string
          occurred_at: string
          order_number: string
          status: Database["public"]["Enums"]["shipment_status"]
        }[]
      }
      admin_accept_order: {
        Args: { p_courier_id?: string; p_order_id: string }
        Returns: Json
      }
      admin_accept_preview: { Args: { p_order_id: string }; Returns: Json }
      admin_add_shipment_event: {
        Args: {
          p_location: string
          p_message: string
          p_order_id: string
          p_status: Database["public"]["Enums"]["shipment_status"]
        }
        Returns: undefined
      }
      admin_adjust_stock: {
        Args: { p_delta: number; p_variant_id: string }
        Returns: number
      }
      admin_analytics_breakdown: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      admin_apply_provider_history: {
        Args: { p_history: Json; p_order_id: string }
        Returns: Json
      }
      admin_assert_linkable_customer: {
        Args: { p_customer_id: string }
        Returns: undefined
      }
      admin_assert_range: {
        Args: { p_from: string; p_to: string }
        Returns: undefined
      }
      admin_assign_courier: {
        Args: {
          p_courier_id: string
          p_order_id: string
          p_tracking_number: string
        }
        Returns: undefined
      }
      admin_attention_counts: {
        Args: never
        Returns: {
          low_stock_variants: number
          pending_orders: number
          pending_reviews: number
          sold_out_variants: number
        }[]
      }
      admin_category_product_counts: {
        Args: never
        Returns: {
          active_product_count: number
          category_id: string
          product_count: number
        }[]
      }
      admin_clear_provider_booking: {
        Args: { p_order_id: string; p_provider: string; p_reason: string }
        Returns: undefined
      }
      admin_coupon_order_counts: {
        Args: never
        Returns: {
          coupon_id: string
          order_count: number
        }[]
      }
      admin_courier_overview: { Args: { p_provider: string }; Returns: Json }
      admin_create_order: {
        Args: {
          p_address: Json
          p_contact: Json
          p_coupon_code: string
          p_courier_service_id: string
          p_customer_id: string
          p_customer_note: string
          p_items: Json
          p_whatsapp_e164: string
        }
        Returns: Json
      }
      admin_customer_summaries: {
        Args: {
          p_limit: number
          p_offset: number
          p_search: string
          p_sort: string
        }
        Returns: {
          billed_paisa: number
          created_at: string
          email: string
          full_name: string
          id: string
          last_order_at: string
          order_count: number
          pending_paisa: number
          phone_e164: string
          total_count: number
        }[]
      }
      admin_dashboard_kpis: {
        Args: {
          p_from: string
          p_prev_from: string
          p_prev_to: string
          p_to: string
        }
        Returns: Json
      }
      admin_delete_category: {
        Args: { p_category_id: string }
        Returns: string
      }
      admin_delete_product: {
        Args: { p_product_id: string }
        Returns: string[]
      }
      admin_delete_remittance: {
        Args: { p_remittance_id: string }
        Returns: undefined
      }
      admin_delivery_history_counts: {
        Args: never
        Returns: {
          record_id: string
          record_type: string
          use_count: number
        }[]
      }
      admin_log_courier_call: {
        Args: {
          p_action: string
          p_duration_ms: number
          p_error_code: string
          p_error_message: string
          p_order_id: string
          p_provider: string
          p_success: boolean
          p_trace_id: string
        }
        Returns: undefined
      }
      admin_mark_awb_printed: {
        Args: { p_order_id: string; p_provider: string }
        Returns: undefined
      }
      admin_mark_provider_ready: {
        Args: { p_order_id: string; p_provider: string }
        Returns: undefined
      }
      admin_mark_refunded: { Args: { p_order_id: string }; Returns: undefined }
      admin_order_quote: {
        Args: {
          p_contact_email?: string
          p_coupon_code?: string
          p_courier_service_id?: string
          p_customer_id?: string
          p_items: Json
          p_municipality_code?: string
        }
        Returns: Json
      }
      admin_ordered_variant_ids: {
        Args: { p_product_id: string }
        Returns: string[]
      }
      admin_orphaned_storage_objects: {
        Args: { p_bucket: string; p_older_than?: string }
        Returns: {
          created_at: string
          name: string
          size_bytes: number
        }[]
      }
      admin_outstanding_cod: {
        Args: never
        Returns: {
          order_count: number
          total_paisa: number
        }[]
      }
      admin_payment_summary: {
        Args: { p_from: string; p_to: string }
        Returns: {
          order_count: number
          payment_status: Database["public"]["Enums"]["payment_status"]
          total_paisa: number
        }[]
      }
      admin_product_has_orders: {
        Args: { p_product_id: string }
        Returns: boolean
      }
      admin_provider_booking_reference: {
        Args: { p_order_id: string; p_provider: string }
        Returns: string
      }
      admin_record_courier_handoff: {
        Args: { p_order_id: string }
        Returns: Json
      }
      admin_record_provider_booking: {
        Args: { p_booking: Json; p_order_id: string; p_provider: string }
        Returns: undefined
      }
      admin_record_provider_feedback: {
        Args: {
          p_feedback: string
          p_order_id: string
          p_provider: string
          p_reattempt_on: string
        }
        Returns: undefined
      }
      admin_record_provider_receiver_update: {
        Args: { p_order_id: string; p_provider: string; p_receiver: Json }
        Returns: undefined
      }
      admin_record_remittance: {
        Args: {
          p_deductions_paisa: number
          p_gross_paisa: number
          p_note: string
          p_provider: string
          p_reference: string
          p_statement_date: string
          p_tracking_numbers: string[]
        }
        Returns: Json
      }
      admin_record_support_case: {
        Args: {
          p_case_id: string
          p_order_id: string
          p_provider: string
          p_subject: string
          p_tracking_number: string
        }
        Returns: string
      }
      admin_reorder_product_media: {
        Args: { p_media_ids: string[]; p_product_id: string }
        Returns: undefined
      }
      admin_revenue_series: {
        Args: { p_bucket: string; p_from: string; p_to: string }
        Returns: {
          bucket: string
          orders: number
          sales_paisa: number
        }[]
      }
      admin_save_collection: {
        Args: {
          p_collection: Json
          p_collection_id: string
          p_product_ids: string[]
        }
        Returns: Json
      }
      admin_save_product: {
        Args: {
          p_collection_ids: string[]
          p_product: Json
          p_product_id: string
          p_variants: Json
        }
        Returns: Json
      }
      admin_set_product_status: {
        Args: {
          p_product_id: string
          p_status: Database["public"]["Enums"]["product_status"]
        }
        Returns: Database["public"]["Enums"]["product_status"]
      }
      admin_set_staff_role: {
        Args: {
          p_permissions?: Database["public"]["Enums"]["staff_permission"][]
          p_profile_id: string
          p_role: Database["public"]["Enums"]["profile_role"]
        }
        Returns: undefined
      }
      admin_staff_names: {
        Args: { p_ids: string[] }
        Returns: {
          full_name: string
          id: string
        }[]
      }
      admin_transition_order: {
        Args: {
          p_order_id: string
          p_reason: string
          p_status: Database["public"]["Enums"]["order_status"]
        }
        Returns: Database["public"]["Enums"]["order_status"]
      }
      admin_update_provider_account: {
        Args: { p_patch: Json; p_provider: string }
        Returns: undefined
      }
      admin_update_support_case: {
        Args: {
          p_case_id: string
          p_provider: string
          p_rating: number
          p_status: string
        }
        Returns: undefined
      }
      apply_staff_invitation: {
        Args: { p_profile_id: string }
        Returns: boolean
      }
      auto_courier_for_order: {
        Args: { p_order_id: string }
        Returns: {
          courier_id: string
          courier_name: string
          source: string
        }[]
      }
      bootstrap_owner: {
        Args: { p_clerk_user_id: string; p_replace_existing?: boolean }
        Returns: {
          demoted_owner_id: string
          owner_id: string
        }[]
      }
      category_has_children: {
        Args: { p_category_id: string }
        Returns: boolean
      }
      checkout_price: {
        Args: {
          p_contact_email: string
          p_coupon_code: string
          p_courier_service_id: string
          p_items: Json
          p_municipality_code: string
          p_profile_id: string
        }
        Returns: Json
      }
      checkout_quote: {
        Args: {
          p_contact_email?: string
          p_coupon_code?: string
          p_courier_service_id?: string
          p_items: Json
          p_municipality_code?: string
        }
        Returns: Json
      }
      courier_apply_provider_history: {
        Args: { p_history: Json; p_shipment_id: string }
        Returns: Json
      }
      courier_auto_book_candidates: {
        Args: { p_limit?: number; p_provider: string }
        Returns: {
          order_id: string
        }[]
      }
      courier_auto_book_failed: {
        Args: { p_order_id: string; p_reason: string }
        Returns: undefined
      }
      courier_provider_booking_reference: {
        Args: { p_order_id: string; p_provider: string }
        Returns: string
      }
      courier_record_provider_booking: {
        Args: { p_booking: Json; p_order_id: string; p_provider: string }
        Returns: undefined
      }
      create_order_core: {
        Args: {
          p_address: Json
          p_channel: Database["public"]["Enums"]["order_channel"]
          p_contact: Json
          p_coupon_code: string
          p_courier_service_id: string
          p_created_by: string
          p_customer_note: string
          p_items: Json
          p_require_tracking_hash: boolean
          p_tracking_hash: string
          p_user_id: string
          p_whatsapp_e164: string
        }
        Returns: Json
      }
      current_profile_id: { Args: never; Returns: string }
      get_order_tracking: {
        Args: { p_order_number: string; p_secret?: string }
        Returns: Json
      }
      has_permission: {
        Args: { permission: Database["public"]["Enums"]["staff_permission"] }
        Returns: boolean
      }
      is_owner: { Args: never; Returns: boolean }
      mark_clerk_profile_deleted: {
        Args: { p_clerk_user_id: string }
        Returns: undefined
      }
      nearest_municipality: {
        Args: { p_latitude: number; p_longitude: number }
        Returns: {
          distance_km: number
          district_code: string
          municipality_code: string
          postal_code: string
          province_code: string
        }[]
      }
      notify_new_order: {
        Args: { p_auto_accept: string; p_order_id: string }
        Returns: undefined
      }
      npt_day_start: { Args: { p_day: string }; Returns: string }
      place_order: {
        Args: {
          p_address: Json
          p_contact: Json
          p_coupon_code: string
          p_courier_service_id: string
          p_customer_note: string
          p_items: Json
          p_tracking_hash: string
        }
        Returns: Json
      }
      product_rating_breakdown: {
        Args: { p_product_slug: string }
        Returns: {
          rating: number
          review_count: number
        }[]
      }
      product_rating_summaries: {
        Args: { product_ids: string[] }
        Returns: {
          product_id: string
          rating_avg: number
          rating_count: number
        }[]
      }
      product_reviews: {
        Args: { p_limit?: number; p_offset?: number; p_product_slug: string }
        Returns: {
          author_name: string
          body: string
          created_at: string
          rating: number
          review_id: string
          title: string
          verified: boolean
        }[]
      }
      provider_bookable_shipment: {
        Args: { p_order_id: string; p_provider: string }
        Returns: {
          assigned_at: string | null
          awb_printed_at: string | null
          booked_at: string | null
          courier_id: string | null
          courier_service_id: string | null
          created_at: string
          delivered_at: string | null
          delivery_option: string | null
          estimated_delivery_from: string | null
          estimated_delivery_to: string | null
          first_mile_type: string | null
          id: string
          last_mile_provider: string | null
          order_id: string
          package_height_cm: number | null
          package_length_cm: number | null
          package_weight_grams: number | null
          package_width_cm: number | null
          pickup_cutoff_at: string | null
          provider: string | null
          provider_auto_book_failed_at: string | null
          provider_booking_attempts: number
          provider_canceled_at: string | null
          provider_needs_action: boolean
          provider_package_code: string | null
          provider_receiver: Json | null
          provider_reference: string | null
          provider_status: string | null
          provider_synced_at: string | null
          ready_to_ship_at: string | null
          status: Database["public"]["Enums"]["shipment_status"]
          tracking_number: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "shipments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      provider_booked_shipment: {
        Args: { p_order_id: string; p_provider: string }
        Returns: {
          assigned_at: string | null
          awb_printed_at: string | null
          booked_at: string | null
          courier_id: string | null
          courier_service_id: string | null
          created_at: string
          delivered_at: string | null
          delivery_option: string | null
          estimated_delivery_from: string | null
          estimated_delivery_to: string | null
          first_mile_type: string | null
          id: string
          last_mile_provider: string | null
          order_id: string
          package_height_cm: number | null
          package_length_cm: number | null
          package_weight_grams: number | null
          package_width_cm: number | null
          pickup_cutoff_at: string | null
          provider: string | null
          provider_auto_book_failed_at: string | null
          provider_booking_attempts: number
          provider_canceled_at: string | null
          provider_needs_action: boolean
          provider_package_code: string | null
          provider_receiver: Json | null
          provider_reference: string | null
          provider_status: string | null
          provider_synced_at: string | null
          ready_to_ship_at: string | null
          status: Database["public"]["Enums"]["shipment_status"]
          tracking_number: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "shipments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      provider_booking_reference_core: {
        Args: { p_order_id: string; p_provider: string }
        Returns: string
      }
      provider_history_core: {
        Args: { p_history: Json; p_shipment_id: string }
        Returns: Json
      }
      provider_record_booking_core: {
        Args: {
          p_actor: string
          p_booking: Json
          p_order_id: string
          p_provider: string
        }
        Returns: undefined
      }
      search_products: {
        Args: {
          category_slug?: string
          max_price_paisa?: number
          min_price_paisa?: number
          page_limit?: number
          page_offset?: number
          q?: string
          sort?: string
        }
        Returns: {
          base_price_paisa: number
          category_id: string
          cover_alt: string
          cover_path: string
          id: string
          is_bestseller: boolean
          is_limited_edition: boolean
          is_sponsored: boolean
          published_at: string
          slug: string
          title: string
          total_count: number
        }[]
      }
      storefront_testimonials: {
        Args: { max_count?: number }
        Returns: {
          author_name: string
          product_slug: string
          product_title: string
          quote: string
          review_id: string
        }[]
      }
      submit_review: {
        Args: {
          p_body: string
          p_product_slug: string
          p_rating: number
          p_title: string
        }
        Returns: string
      }
      sync_clerk_profile: {
        Args: {
          p_clerk_updated_at: string
          p_clerk_user_id: string
          p_email: string
          p_full_name: string
          p_phone_e164: string
        }
        Returns: string
      }
    }
    Enums: {
      ar_mode: "live_2d" | "live_3d" | "photo_ai"
      ar_placement:
        | "ear"
        | "face"
        | "neck"
        | "wrist"
        | "hand"
        | "upper_body"
        | "full_body"
        | "freeform"
      coupon_type: "fixed" | "percentage"
      courier_assignment_mode: "auto" | "manual"
      courier_handoff_channel: "whatsapp_link" | "daraz_api"
      courier_handoff_status: "pending" | "sent" | "superseded"
      courier_integration_mode: "manual" | "api"
      media_kind: "image" | "video"
      municipality_type:
        | "metropolitan_city"
        | "sub_metropolitan_city"
        | "municipality"
        | "rural_municipality"
      newsletter_source: "homepage" | "checkout" | "account"
      newsletter_status: "subscribed" | "unsubscribed"
      notification_kind:
        | "order_pending"
        | "order_auto_accepted"
        | "courier_attention"
      order_acceptance: "staff" | "auto"
      order_channel: "website" | "whatsapp"
      order_status:
        | "pending_confirmation"
        | "confirmed"
        | "processing"
        | "packed"
        | "shipped"
        | "delivered"
        | "canceled"
      payment_method: "cod"
      payment_status: "pending" | "collected" | "failed" | "refunded"
      product_status: "draft" | "active" | "archived"
      profile_role: "customer" | "owner" | "staff"
      review_status: "pending" | "published" | "rejected"
      service_level: "standard" | "express" | "pickup"
      shipment_event_source:
        | "system"
        | "staff"
        | "courier_manual"
        | "courier_api"
      shipment_status:
        | "awaiting_assignment"
        | "assigned"
        | "picked_up"
        | "in_transit"
        | "out_for_delivery"
        | "delivered"
        | "exception"
        | "returned"
      staff_invitation_status: "pending" | "accepted" | "revoked"
      staff_permission:
        | "analytics.read"
        | "catalog.read"
        | "catalog.write"
        | "inventory.write"
        | "orders.read"
        | "orders.write"
        | "customers.read"
        | "reviews.manage"
        | "promotions.manage"
        | "content.manage"
        | "ar.manage"
        | "delivery.manage"
        | "settings.manage"
        | "staff.manage"
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
      ar_mode: ["live_2d", "live_3d", "photo_ai"],
      ar_placement: [
        "ear",
        "face",
        "neck",
        "wrist",
        "hand",
        "upper_body",
        "full_body",
        "freeform",
      ],
      coupon_type: ["fixed", "percentage"],
      courier_assignment_mode: ["auto", "manual"],
      courier_handoff_channel: ["whatsapp_link", "daraz_api"],
      courier_handoff_status: ["pending", "sent", "superseded"],
      courier_integration_mode: ["manual", "api"],
      media_kind: ["image", "video"],
      municipality_type: [
        "metropolitan_city",
        "sub_metropolitan_city",
        "municipality",
        "rural_municipality",
      ],
      newsletter_source: ["homepage", "checkout", "account"],
      newsletter_status: ["subscribed", "unsubscribed"],
      notification_kind: [
        "order_pending",
        "order_auto_accepted",
        "courier_attention",
      ],
      order_acceptance: ["staff", "auto"],
      order_channel: ["website", "whatsapp"],
      order_status: [
        "pending_confirmation",
        "confirmed",
        "processing",
        "packed",
        "shipped",
        "delivered",
        "canceled",
      ],
      payment_method: ["cod"],
      payment_status: ["pending", "collected", "failed", "refunded"],
      product_status: ["draft", "active", "archived"],
      profile_role: ["customer", "owner", "staff"],
      review_status: ["pending", "published", "rejected"],
      service_level: ["standard", "express", "pickup"],
      shipment_event_source: [
        "system",
        "staff",
        "courier_manual",
        "courier_api",
      ],
      shipment_status: [
        "awaiting_assignment",
        "assigned",
        "picked_up",
        "in_transit",
        "out_for_delivery",
        "delivered",
        "exception",
        "returned",
      ],
      staff_invitation_status: ["pending", "accepted", "revoked"],
      staff_permission: [
        "analytics.read",
        "catalog.read",
        "catalog.write",
        "inventory.write",
        "orders.read",
        "orders.write",
        "customers.read",
        "reviews.manage",
        "promotions.manage",
        "content.manage",
        "ar.manage",
        "delivery.manage",
        "settings.manage",
        "staff.manage",
      ],
    },
  },
} as const
