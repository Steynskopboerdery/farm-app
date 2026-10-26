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
      animal_events: {
        Row: {
          animal_id: string | null
          created_at: string
          created_by: string | null
          date: string
          deleted_at: string | null
          farm_id: string
          from_camp_id: string | null
          group_id: string | null
          id: string
          notes: string | null
          product: string | null
          quantity: number | null
          to_camp_id: string | null
          type: string
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          animal_id?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          deleted_at?: string | null
          farm_id: string
          from_camp_id?: string | null
          group_id?: string | null
          id?: string
          notes?: string | null
          product?: string | null
          quantity?: number | null
          to_camp_id?: string | null
          type: string
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          animal_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          deleted_at?: string | null
          farm_id?: string
          from_camp_id?: string | null
          group_id?: string | null
          id?: string
          notes?: string | null
          product?: string | null
          quantity?: number | null
          to_camp_id?: string | null
          type?: string
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "animal_events_farm_id_animal_id_fkey"
            columns: ["farm_id", "animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["farm_id", "id"]
          },
          {
            foreignKeyName: "animal_events_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animal_events_farm_id_from_camp_id_fkey"
            columns: ["farm_id", "from_camp_id"]
            isOneToOne: false
            referencedRelation: "camps"
            referencedColumns: ["farm_id", "id"]
          },
          {
            foreignKeyName: "animal_events_farm_id_group_id_fkey"
            columns: ["farm_id", "group_id"]
            isOneToOne: false
            referencedRelation: "livestock_groups"
            referencedColumns: ["farm_id", "id"]
          },
          {
            foreignKeyName: "animal_events_farm_id_to_camp_id_fkey"
            columns: ["farm_id", "to_camp_id"]
            isOneToOne: false
            referencedRelation: "camps"
            referencedColumns: ["farm_id", "id"]
          },
        ]
      }
      animals: {
        Row: {
          birth_date: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          farm_id: string
          group_id: string | null
          id: string
          is_sample: boolean
          notes: string | null
          sex: string | null
          species: string
          status: string
          tag: string
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          farm_id: string
          group_id?: string | null
          id?: string
          is_sample?: boolean
          notes?: string | null
          sex?: string | null
          species: string
          status?: string
          tag: string
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          farm_id?: string
          group_id?: string | null
          id?: string
          is_sample?: boolean
          notes?: string | null
          sex?: string | null
          species?: string
          status?: string
          tag?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "animals_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animals_farm_id_group_id_fkey"
            columns: ["farm_id", "group_id"]
            isOneToOne: false
            referencedRelation: "livestock_groups"
            referencedColumns: ["farm_id", "id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          farm_id: string | null
          id: number
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          farm_id?: string | null
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          farm_id?: string | null
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      breeding_plans: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          expected_birth_end: string | null
          expected_birth_start: string | null
          farm_id: string
          gestation_days: number
          group_id: string
          id: string
          joining_end_date: string | null
          joining_start_date: string
          males_used: number | null
          notes: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          expected_birth_end?: string | null
          expected_birth_start?: string | null
          farm_id: string
          gestation_days: number
          group_id: string
          id?: string
          joining_end_date?: string | null
          joining_start_date: string
          males_used?: number | null
          notes?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          expected_birth_end?: string | null
          expected_birth_start?: string | null
          farm_id?: string
          gestation_days?: number
          group_id?: string
          id?: string
          joining_end_date?: string | null
          joining_start_date?: string
          males_used?: number | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "breeding_plans_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "breeding_plans_farm_id_group_id_fkey"
            columns: ["farm_id", "group_id"]
            isOneToOne: false
            referencedRelation: "livestock_groups"
            referencedColumns: ["farm_id", "id"]
          },
        ]
      }
      camps: {
        Row: {
          boundary_geojson: Json | null
          boundary_source: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          farm_id: string
          hectares: number | null
          id: string
          is_sample: boolean
          name: string
          notes: string | null
          pasture_type: string | null
          updated_at: string
        }
        Insert: {
          boundary_geojson?: Json | null
          boundary_source?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          farm_id: string
          hectares?: number | null
          id?: string
          is_sample?: boolean
          name: string
          notes?: string | null
          pasture_type?: string | null
          updated_at?: string
        }
        Update: {
          boundary_geojson?: Json | null
          boundary_source?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          farm_id?: string
          hectares?: number | null
          id?: string
          is_sample?: boolean
          name?: string
          notes?: string | null
          pasture_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "camps_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      costs: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string | null
          date: string
          deleted_at: string | null
          description: string | null
          farm_id: string
          field_id: string | null
          group_id: string | null
          id: string
          season_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          created_by?: string | null
          date: string
          deleted_at?: string | null
          description?: string | null
          farm_id: string
          field_id?: string | null
          group_id?: string | null
          id?: string
          season_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          date?: string
          deleted_at?: string | null
          description?: string | null
          farm_id?: string
          field_id?: string | null
          group_id?: string | null
          id?: string
          season_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "costs_farm_id_field_id_fkey"
            columns: ["farm_id", "field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["farm_id", "id"]
          },
          {
            foreignKeyName: "costs_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "costs_farm_id_group_id_fkey"
            columns: ["farm_id", "group_id"]
            isOneToOne: false
            referencedRelation: "livestock_groups"
            referencedColumns: ["farm_id", "id"]
          },
          {
            foreignKeyName: "costs_farm_id_season_id_fkey"
            columns: ["farm_id", "season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["farm_id", "id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          contact_person: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string | null
          farm_id: string
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
          vat_number: string | null
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          farm_id: string
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          vat_number?: string | null
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          farm_id?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          vat_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      farm_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string
          farm_id: string
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email: string
          farm_id: string
          id?: string
          role?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string
          farm_id?: string
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "farm_invites_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      farm_members: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          display_name: string | null
          email: string | null
          farm_id: string
          id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          display_name?: string | null
          email?: string | null
          farm_id: string
          id?: string
          role: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          display_name?: string | null
          email?: string | null
          farm_id?: string
          id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "farm_members_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      farm_settings: {
        Row: {
          address: string | null
          bank_account_name: string | null
          bank_account_number: string | null
          bank_account_type: string | null
          bank_branch_code: string | null
          bank_name: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string | null
          farm_id: string
          invoice_footer: string | null
          invoice_prefix: string
          legal_name: string | null
          next_invoice_number: number
          payment_terms_days: number
          phone: string | null
          updated_at: string
          vat_number: string | null
          vat_rate: number
          vat_registered: boolean
        }
        Insert: {
          address?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_account_type?: string | null
          bank_branch_code?: string | null
          bank_name?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          farm_id: string
          invoice_footer?: string | null
          invoice_prefix?: string
          legal_name?: string | null
          next_invoice_number?: number
          payment_terms_days?: number
          phone?: string | null
          updated_at?: string
          vat_number?: string | null
          vat_rate?: number
          vat_registered?: boolean
        }
        Update: {
          address?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_account_type?: string | null
          bank_branch_code?: string | null
          bank_name?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          farm_id?: string
          invoice_footer?: string | null
          invoice_prefix?: string
          legal_name?: string | null
          next_invoice_number?: number
          payment_terms_days?: number
          phone?: string | null
          updated_at?: string
          vat_number?: string | null
          vat_rate?: number
          vat_registered?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "farm_settings_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: true
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      farms: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          location_text: string | null
          map_center_lat: number | null
          map_center_lng: number | null
          map_zoom: number | null
          name: string
          total_hectares: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          location_text?: string | null
          map_center_lat?: number | null
          map_center_lng?: number | null
          map_zoom?: number | null
          name: string
          total_hectares?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          location_text?: string | null
          map_center_lat?: number | null
          map_center_lng?: number | null
          map_zoom?: number | null
          name?: string
          total_hectares?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      field_operations: {
        Row: {
          cost: number | null
          created_at: string
          created_by: string | null
          date: string
          deleted_at: string | null
          farm_id: string
          field_id: string
          id: string
          inventory_item_id: string | null
          notes: string | null
          product: string | null
          rate: number | null
          rate_unit: string | null
          season_id: string | null
          total_amount: number | null
          type: string
          unit: string | null
          updated_at: string
          withholding_period_days: number | null
        }
        Insert: {
          cost?: number | null
          created_at?: string
          created_by?: string | null
          date: string
          deleted_at?: string | null
          farm_id: string
          field_id: string
          id?: string
          inventory_item_id?: string | null
          notes?: string | null
          product?: string | null
          rate?: number | null
          rate_unit?: string | null
          season_id?: string | null
          total_amount?: number | null
          type: string
          unit?: string | null
          updated_at?: string
          withholding_period_days?: number | null
        }
        Update: {
          cost?: number | null
          created_at?: string
          created_by?: string | null
          date?: string
          deleted_at?: string | null
          farm_id?: string
          field_id?: string
          id?: string
          inventory_item_id?: string | null
          notes?: string | null
          product?: string | null
          rate?: number | null
          rate_unit?: string | null
          season_id?: string | null
          total_amount?: number | null
          type?: string
          unit?: string | null
          updated_at?: string
          withholding_period_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "field_operations_farm_id_field_id_fkey"
            columns: ["farm_id", "field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["farm_id", "id"]
          },
          {
            foreignKeyName: "field_operations_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_operations_farm_id_inventory_item_id_fkey"
            columns: ["farm_id", "inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["farm_id", "id"]
          },
          {
            foreignKeyName: "field_operations_farm_id_season_id_fkey"
            columns: ["farm_id", "season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["farm_id", "id"]
          },
        ]
      }
      fields: {
        Row: {
          boundary_geojson: Json | null
          boundary_source: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          farm_id: string
          hectares: number | null
          id: string
          is_sample: boolean
          name: string
          notes: string | null
          soil_type: string | null
          updated_at: string
        }
        Insert: {
          boundary_geojson?: Json | null
          boundary_source?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          farm_id: string
          hectares?: number | null
          id?: string
          is_sample?: boolean
          name: string
          notes?: string | null
          soil_type?: string | null
          updated_at?: string
        }
        Update: {
          boundary_geojson?: Json | null
          boundary_source?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          farm_id?: string
          hectares?: number | null
          id?: string
          is_sample?: boolean
          name?: string
          notes?: string | null
          soil_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fields_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      harvests: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          deleted_at: string | null
          farm_id: string
          field_id: string
          hectares_harvested: number | null
          id: string
          notes: string | null
          season_id: string | null
          tons: number
          updated_at: string
          yield_per_ha: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date: string
          deleted_at?: string | null
          farm_id: string
          field_id: string
          hectares_harvested?: number | null
          id?: string
          notes?: string | null
          season_id?: string | null
          tons: number
          updated_at?: string
          yield_per_ha?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          deleted_at?: string | null
          farm_id?: string
          field_id?: string
          hectares_harvested?: number | null
          id?: string
          notes?: string | null
          season_id?: string | null
          tons?: number
          updated_at?: string
          yield_per_ha?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "harvests_farm_id_field_id_fkey"
            columns: ["farm_id", "field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["farm_id", "id"]
          },
          {
            foreignKeyName: "harvests_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "harvests_farm_id_season_id_fkey"
            columns: ["farm_id", "season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["farm_id", "id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          farm_id: string
          id: string
          name: string
          notes: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          farm_id: string
          id?: string
          name: string
          notes?: string | null
          unit: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          farm_id?: string
          id?: string
          name?: string
          notes?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          deleted_at: string | null
          farm_id: string
          field_operation_id: string | null
          id: string
          item_id: string
          notes: string | null
          quantity: number
          unit_cost: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date: string
          deleted_at?: string | null
          farm_id: string
          field_operation_id?: string | null
          id?: string
          item_id: string
          notes?: string | null
          quantity: number
          unit_cost?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          deleted_at?: string | null
          farm_id?: string
          field_operation_id?: string | null
          id?: string
          item_id?: string
          notes?: string | null
          quantity?: number
          unit_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_farm_id_field_operation_id_fkey"
            columns: ["farm_id", "field_operation_id"]
            isOneToOne: false
            referencedRelation: "field_operations"
            referencedColumns: ["farm_id", "id"]
          },
          {
            foreignKeyName: "inventory_movements_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_farm_id_item_id_fkey"
            columns: ["farm_id", "item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["farm_id", "id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          deleted_at: string | null
          due_date: string | null
          farm_id: string
          id: string
          invoice_number: string
          issue_date: string
          notes: string | null
          paid_at: string | null
          pdf_path: string | null
          sale_id: string | null
          sent_at: string | null
          status: string
          subtotal: number | null
          total: number | null
          updated_at: string
          vat_amount: number | null
          vat_rate: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          deleted_at?: string | null
          due_date?: string | null
          farm_id: string
          id?: string
          invoice_number: string
          issue_date?: string
          notes?: string | null
          paid_at?: string | null
          pdf_path?: string | null
          sale_id?: string | null
          sent_at?: string | null
          status?: string
          subtotal?: number | null
          total?: number | null
          updated_at?: string
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          deleted_at?: string | null
          due_date?: string | null
          farm_id?: string
          id?: string
          invoice_number?: string
          issue_date?: string
          notes?: string | null
          paid_at?: string | null
          pdf_path?: string | null
          sale_id?: string | null
          sent_at?: string | null
          status?: string
          subtotal?: number | null
          total?: number | null
          updated_at?: string
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_farm_id_customer_id_fkey"
            columns: ["farm_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["farm_id", "id"]
          },
          {
            foreignKeyName: "invoices_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_farm_id_sale_id_fkey"
            columns: ["farm_id", "sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["farm_id", "id"]
          },
        ]
      }
      livestock_groups: {
        Row: {
          breed: string | null
          camp_id: string | null
          class: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          farm_id: string
          id: string
          is_sample: boolean
          name: string
          notes: string | null
          quantity: number
          species: string
          updated_at: string
        }
        Insert: {
          breed?: string | null
          camp_id?: string | null
          class: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          farm_id: string
          id?: string
          is_sample?: boolean
          name: string
          notes?: string | null
          quantity?: number
          species: string
          updated_at?: string
        }
        Update: {
          breed?: string | null
          camp_id?: string | null
          class?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          farm_id?: string
          id?: string
          is_sample?: boolean
          name?: string
          notes?: string | null
          quantity?: number
          species?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "livestock_groups_farm_id_camp_id_fkey"
            columns: ["farm_id", "camp_id"]
            isOneToOne: false
            referencedRelation: "camps"
            referencedColumns: ["farm_id", "id"]
          },
          {
            foreignKeyName: "livestock_groups_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      mineral_advice_rules: {
        Row: {
          active: boolean
          comparison: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          farm_id: string
          id: string
          nutrient: string
          species: string
          suggestion: string
          threshold: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          comparison: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          farm_id: string
          id?: string
          nutrient: string
          species: string
          suggestion: string
          threshold: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          comparison?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          farm_id?: string
          id?: string
          nutrient?: string
          species?: string
          suggestion?: string
          threshold?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mineral_advice_rules_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      pasture_tests: {
        Row: {
          calcium_pct: number | null
          camp_id: string
          created_at: string
          created_by: string | null
          date: string
          deleted_at: string | null
          farm_id: string
          id: string
          magnesium_pct: number | null
          notes: string | null
          phosphorus_pct: number | null
          protein_pct: number | null
          updated_at: string
        }
        Insert: {
          calcium_pct?: number | null
          camp_id: string
          created_at?: string
          created_by?: string | null
          date: string
          deleted_at?: string | null
          farm_id: string
          id?: string
          magnesium_pct?: number | null
          notes?: string | null
          phosphorus_pct?: number | null
          protein_pct?: number | null
          updated_at?: string
        }
        Update: {
          calcium_pct?: number | null
          camp_id?: string
          created_at?: string
          created_by?: string | null
          date?: string
          deleted_at?: string | null
          farm_id?: string
          id?: string
          magnesium_pct?: number | null
          notes?: string | null
          phosphorus_pct?: number | null
          protein_pct?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pasture_tests_farm_id_camp_id_fkey"
            columns: ["farm_id", "camp_id"]
            isOneToOne: false
            referencedRelation: "camps"
            referencedColumns: ["farm_id", "id"]
          },
          {
            foreignKeyName: "pasture_tests_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          date: string
          deleted_at: string | null
          farm_id: string
          id: string
          invoice_id: string
          method: string | null
          reference: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          date: string
          deleted_at?: string | null
          farm_id: string
          id?: string
          invoice_id: string
          method?: string | null
          reference?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          date?: string
          deleted_at?: string | null
          farm_id?: string
          id?: string
          invoice_id?: string
          method?: string | null
          reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_farm_id_invoice_id_fkey"
            columns: ["farm_id", "invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["farm_id", "id"]
          },
        ]
      }
      planning_estimates: {
        Row: {
          cost_per_head_per_year: number | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          farm_id: string
          id: string
          input_cost_per_ha: number | null
          is_sample: boolean
          kind: string
          name: string
          notes: string | null
          price_per_t: number | null
          updated_at: string
          yield_t_per_ha: number | null
        }
        Insert: {
          cost_per_head_per_year?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          farm_id: string
          id?: string
          input_cost_per_ha?: number | null
          is_sample?: boolean
          kind: string
          name: string
          notes?: string | null
          price_per_t?: number | null
          updated_at?: string
          yield_t_per_ha?: number | null
        }
        Update: {
          cost_per_head_per_year?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          farm_id?: string
          id?: string
          input_cost_per_ha?: number | null
          is_sample?: boolean
          kind?: string
          name?: string
          notes?: string | null
          price_per_t?: number | null
          updated_at?: string
          yield_t_per_ha?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "planning_estimates_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      plantings: {
        Row: {
          created_at: string
          created_by: string | null
          crop: string
          cultivar: string | null
          deleted_at: string | null
          expected_harvest_date: string | null
          farm_id: string
          field_id: string
          id: string
          notes: string | null
          planting_date: string | null
          season_id: string
          seed_kg: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          crop: string
          cultivar?: string | null
          deleted_at?: string | null
          expected_harvest_date?: string | null
          farm_id: string
          field_id: string
          id?: string
          notes?: string | null
          planting_date?: string | null
          season_id: string
          seed_kg?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          crop?: string
          cultivar?: string | null
          deleted_at?: string | null
          expected_harvest_date?: string | null
          farm_id?: string
          field_id?: string
          id?: string
          notes?: string | null
          planting_date?: string | null
          season_id?: string
          seed_kg?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plantings_farm_id_field_id_fkey"
            columns: ["farm_id", "field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["farm_id", "id"]
          },
          {
            foreignKeyName: "plantings_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plantings_farm_id_season_id_fkey"
            columns: ["farm_id", "season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["farm_id", "id"]
          },
        ]
      }
      sale_items: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string
          farm_id: string
          field_id: string | null
          group_id: string | null
          id: string
          quantity: number
          sale_id: string
          unit: string | null
          unit_price: number
          updated_at: string
          vat_applicable: boolean
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description: string
          farm_id: string
          field_id?: string | null
          group_id?: string | null
          id?: string
          quantity: number
          sale_id: string
          unit?: string | null
          unit_price: number
          updated_at?: string
          vat_applicable?: boolean
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string
          farm_id?: string
          field_id?: string | null
          group_id?: string | null
          id?: string
          quantity?: number
          sale_id?: string
          unit?: string | null
          unit_price?: number
          updated_at?: string
          vat_applicable?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_farm_id_field_id_fkey"
            columns: ["farm_id", "field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["farm_id", "id"]
          },
          {
            foreignKeyName: "sale_items_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_farm_id_group_id_fkey"
            columns: ["farm_id", "group_id"]
            isOneToOne: false
            referencedRelation: "livestock_groups"
            referencedColumns: ["farm_id", "id"]
          },
          {
            foreignKeyName: "sale_items_farm_id_sale_id_fkey"
            columns: ["farm_id", "sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["farm_id", "id"]
          },
        ]
      }
      sales: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          date: string
          deleted_at: string | null
          description: string | null
          farm_id: string
          id: string
          notes: string | null
          season_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          date: string
          deleted_at?: string | null
          description?: string | null
          farm_id: string
          id?: string
          notes?: string | null
          season_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          date?: string
          deleted_at?: string | null
          description?: string | null
          farm_id?: string
          id?: string
          notes?: string | null
          season_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_farm_id_customer_id_fkey"
            columns: ["farm_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["farm_id", "id"]
          },
          {
            foreignKeyName: "sales_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_farm_id_season_id_fkey"
            columns: ["farm_id", "season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["farm_id", "id"]
          },
        ]
      }
      seasons: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          farm_id: string
          id: string
          is_sample: boolean
          label: string | null
          notes: string | null
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          farm_id: string
          id?: string
          is_sample?: boolean
          label?: string | null
          notes?: string | null
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          farm_id?: string
          id?: string
          is_sample?: boolean
          label?: string | null
          notes?: string | null
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "seasons_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      shearing_plans: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          done_date: string | null
          farm_id: string
          group_id: string
          id: string
          kg_wool: number | null
          notes: string | null
          planned_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          done_date?: string | null
          farm_id: string
          group_id: string
          id?: string
          kg_wool?: number | null
          notes?: string | null
          planned_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          done_date?: string | null
          farm_id?: string
          group_id?: string
          id?: string
          kg_wool?: number | null
          notes?: string | null
          planned_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shearing_plans_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shearing_plans_farm_id_group_id_fkey"
            columns: ["farm_id", "group_id"]
            isOneToOne: false
            referencedRelation: "livestock_groups"
            referencedColumns: ["farm_id", "id"]
          },
        ]
      }
      species_reference: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          farm_id: string
          gestation_days: number
          id: string
          species: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          farm_id: string
          gestation_days: number
          id?: string
          species: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          farm_id?: string
          gestation_days?: number
          id?: string
          species?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "species_reference_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          camp_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          done_at: string | null
          due_date: string | null
          farm_id: string
          field_id: string | null
          group_id: string | null
          id: string
          is_sample: boolean
          notes: string | null
          status: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          camp_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          done_at?: string | null
          due_date?: string | null
          farm_id: string
          field_id?: string | null
          group_id?: string | null
          id?: string
          is_sample?: boolean
          notes?: string | null
          status?: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          camp_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          done_at?: string | null
          due_date?: string | null
          farm_id?: string
          field_id?: string | null
          group_id?: string | null
          id?: string
          is_sample?: boolean
          notes?: string | null
          status?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_farm_id_camp_id_fkey"
            columns: ["farm_id", "camp_id"]
            isOneToOne: false
            referencedRelation: "camps"
            referencedColumns: ["farm_id", "id"]
          },
          {
            foreignKeyName: "tasks_farm_id_field_id_fkey"
            columns: ["farm_id", "field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["farm_id", "id"]
          },
          {
            foreignKeyName: "tasks_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_farm_id_group_id_fkey"
            columns: ["farm_id", "group_id"]
            isOneToOne: false
            referencedRelation: "livestock_groups"
            referencedColumns: ["farm_id", "id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invites: { Args: never; Returns: number }
      create_farm: {
        Args: { p_location?: string; p_name: string }
        Returns: string
      }
      load_sample_data: { Args: { p_farm: string }; Returns: undefined }
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
