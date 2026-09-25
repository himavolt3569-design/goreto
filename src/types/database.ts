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
      categories: {
        Row: {
          created_at: string
          description: string
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
      couriers: {
        Row: {
          created_at: string
          id: string
          integration_mode: Database["public"]["Enums"]["courier_integration_mode"]
          is_active: boolean
          logo_path: string | null
          name: string
          slug: string
          support_phone: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          integration_mode?: Database["public"]["Enums"]["courier_integration_mode"]
          is_active?: boolean
          logo_path?: string | null
          name: string
          slug: string
          support_phone?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          integration_mode?: Database["public"]["Enums"]["courier_integration_mode"]
          is_active?: boolean
          logo_path?: string | null
          name?: string
          slug?: string
          support_phone?: string | null
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
          canceled_at: string | null
          cancellation_reason: string | null
          confirmed_at: string | null
          contact_email: string
          contact_name: string
          contact_phone_e164: string
          coupon_code: string | null
          coupon_id: string | null
          courier_service_id: string | null
          created_at: string
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
        }
        Insert: {
          canceled_at?: string | null
          cancellation_reason?: string | null
          confirmed_at?: string | null
          contact_email: string
          contact_name: string
          contact_phone_e164: string
          coupon_code?: string | null
          coupon_id?: string | null
          courier_service_id?: string | null
          created_at?: string
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
        }
        Update: {
          canceled_at?: string | null
          cancellation_reason?: string | null
          confirmed_at?: string | null
          contact_email?: string
          contact_name?: string
          contact_phone_e164?: string
          coupon_code?: string | null
          coupon_id?: string | null
          courier_service_id?: string | null
          created_at?: string
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
        }
        Relationships: [
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
      shipment_events: {
        Row: {
          created_at: string
          id: string
          latitude: number | null
          location_label: string | null
          longitude: number | null
          message: string
          occurred_at: string
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
          courier_id: string | null
          courier_service_id: string | null
          created_at: string
          delivered_at: string | null
          estimated_delivery_from: string | null
          estimated_delivery_to: string | null
          id: string
          order_id: string
          status: Database["public"]["Enums"]["shipment_status"]
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          courier_id?: string | null
          courier_service_id?: string | null
          created_at?: string
          delivered_at?: string | null
          estimated_delivery_from?: string | null
          estimated_delivery_to?: string | null
          id?: string
          order_id: string
          status?: Database["public"]["Enums"]["shipment_status"]
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          courier_id?: string | null
          courier_service_id?: string | null
          created_at?: string
          delivered_at?: string | null
          estimated_delivery_from?: string | null
          estimated_delivery_to?: string | null
          id?: string
          order_id?: string
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
          cod_enabled: boolean
          cod_max_order_paisa: number | null
          country_code: string
          created_at: string
          currency: string
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
          cod_enabled?: boolean
          cod_max_order_paisa?: number | null
          country_code?: string
          created_at?: string
          currency?: string
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
          cod_enabled?: boolean
          cod_max_order_paisa?: number | null
          country_code?: string
          created_at?: string
          currency?: string
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
      admin_mark_refunded: { Args: { p_order_id: string }; Returns: undefined }
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
      admin_revenue_series: {
        Args: { p_bucket: string; p_from: string; p_to: string }
        Returns: {
          bucket: string
          orders: number
          sales_paisa: number
        }[]
      }
      admin_set_product_status: {
        Args: {
          p_product_id: string
          p_status: Database["public"]["Enums"]["product_status"]
        }
        Returns: Database["public"]["Enums"]["product_status"]
      }
      admin_transition_order: {
        Args: {
          p_order_id: string
          p_reason: string
          p_status: Database["public"]["Enums"]["order_status"]
        }
        Returns: Database["public"]["Enums"]["order_status"]
      }
      bootstrap_owner: {
        Args: { p_clerk_user_id: string; p_replace_existing?: boolean }
        Returns: {
          demoted_owner_id: string
          owner_id: string
        }[]
      }
      current_profile_id: { Args: never; Returns: string }
      has_permission: {
        Args: { permission: Database["public"]["Enums"]["staff_permission"] }
        Returns: boolean
      }
      is_owner: { Args: never; Returns: boolean }
      mark_clerk_profile_deleted: {
        Args: { p_clerk_user_id: string }
        Returns: undefined
      }
      npt_day_start: { Args: { p_day: string }; Returns: string }
      product_rating_summaries: {
        Args: { product_ids: string[] }
        Returns: {
          product_id: string
          rating_avg: number
          rating_count: number
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
      courier_integration_mode: "manual" | "api"
      media_kind: "image" | "video"
      municipality_type:
        | "metropolitan_city"
        | "sub_metropolitan_city"
        | "municipality"
        | "rural_municipality"
      newsletter_source: "homepage" | "checkout" | "account"
      newsletter_status: "subscribed" | "unsubscribed"
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
