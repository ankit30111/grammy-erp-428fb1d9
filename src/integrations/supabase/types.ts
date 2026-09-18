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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      approval_workflows: {
        Row: {
          comments: string | null
          created_at: string
          document_url: string | null
          id: string
          reference_id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string
          submitted_by: string | null
          updated_at: string
          workflow_type: string
        }
        Insert: {
          comments?: string | null
          created_at?: string
          document_url?: string | null
          id?: string
          reference_id: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          submitted_by?: string | null
          updated_at?: string
          workflow_type: string
        }
        Update: {
          comments?: string | null
          created_at?: string
          document_url?: string | null
          id?: string
          reference_id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          submitted_by?: string | null
          updated_at?: string
          workflow_type?: string
        }
        Relationships: []
      }
      attendance: {
        Row: {
          break_hours: number | null
          check_in_time: string | null
          check_out_time: string | null
          created_at: string | null
          date: string
          employee_id: string | null
          id: string
          imported_from_machine: boolean | null
          overtime_hours: number | null
          status: string | null
        }
        Insert: {
          break_hours?: number | null
          check_in_time?: string | null
          check_out_time?: string | null
          created_at?: string | null
          date: string
          employee_id?: string | null
          id?: string
          imported_from_machine?: boolean | null
          overtime_hours?: number | null
          status?: string | null
        }
        Update: {
          break_hours?: number | null
          check_in_time?: string | null
          check_out_time?: string | null
          created_at?: string | null
          date?: string
          employee_id?: string | null
          id?: string
          imported_from_machine?: boolean | null
          overtime_hours?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          from_status: string | null
          id: string
          new_values: Json | null
          old_values: Json | null
          record_id: string
          table_name: string
          to_status: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id: string
          table_name: string
          to_status?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string
          table_name?: string
          to_status?: string | null
        }
        Relationships: []
      }
      bom: {
        Row: {
          child_part_id: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          is_critical: boolean
          notes: string | null
          parent_part_id: string
          quantity: number
          uom: string
          updated_at: string
          version: number
        }
        Insert: {
          child_part_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          is_critical?: boolean
          notes?: string | null
          parent_part_id: string
          quantity: number
          uom?: string
          updated_at?: string
          version?: number
        }
        Update: {
          child_part_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          is_critical?: boolean
          notes?: string | null
          parent_part_id?: string
          quantity?: number
          uom?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "bom_child_part_id_fkey"
            columns: ["child_part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_parent_part_id_fkey"
            columns: ["parent_part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
        ]
      }
      capa: {
        Row: {
          capa_number: string
          closed_at: string | null
          closed_by: string | null
          containment_action: string | null
          corrective_action: string | null
          created_at: string
          document_url: string | null
          due_date: string | null
          grn_item_id: string | null
          id: string
          line_rejection_id: string | null
          part_id: string | null
          plant_id: string | null
          preventive_action: string | null
          problem_statement: string
          production_order_id: string | null
          raised_by: string | null
          root_cause: string | null
          source: string
          status: Database["public"]["Enums"]["capa_status"]
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          capa_number: string
          closed_at?: string | null
          closed_by?: string | null
          containment_action?: string | null
          corrective_action?: string | null
          created_at?: string
          document_url?: string | null
          due_date?: string | null
          grn_item_id?: string | null
          id?: string
          line_rejection_id?: string | null
          part_id?: string | null
          plant_id?: string | null
          preventive_action?: string | null
          problem_statement: string
          production_order_id?: string | null
          raised_by?: string | null
          root_cause?: string | null
          source: string
          status?: Database["public"]["Enums"]["capa_status"]
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          capa_number?: string
          closed_at?: string | null
          closed_by?: string | null
          containment_action?: string | null
          corrective_action?: string | null
          created_at?: string
          document_url?: string | null
          due_date?: string | null
          grn_item_id?: string | null
          id?: string
          line_rejection_id?: string | null
          part_id?: string | null
          plant_id?: string | null
          preventive_action?: string | null
          problem_statement?: string
          production_order_id?: string | null
          raised_by?: string | null
          root_cause?: string | null
          source?: string
          status?: Database["public"]["Enums"]["capa_status"]
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "capa_grn_item_id_fkey"
            columns: ["grn_item_id"]
            isOneToOne: false
            referencedRelation: "grn_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capa_line_rejection_id_fkey"
            columns: ["line_rejection_id"]
            isOneToOne: false
            referencedRelation: "line_rejections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capa_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capa_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capa_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capa_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      capa_checks: {
        Row: {
          capa_id: string
          check_date: string
          checked_by: string | null
          created_at: string
          effective: boolean | null
          id: string
          observation: string | null
        }
        Insert: {
          capa_id: string
          check_date?: string
          checked_by?: string | null
          created_at?: string
          effective?: boolean | null
          id?: string
          observation?: string | null
        }
        Update: {
          capa_id?: string
          check_date?: string
          checked_by?: string | null
          created_at?: string
          effective?: boolean | null
          id?: string
          observation?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "capa_checks_capa_id_fkey"
            columns: ["capa_id"]
            isOneToOne: false
            referencedRelation: "capa"
            referencedColumns: ["id"]
          },
        ]
      }
      container_materials: {
        Row: {
          brand: string | null
          cbm_occupied: number | null
          container_id: string
          created_at: string
          id: string
          material_description: string | null
          model: string | null
          notes: string | null
          part_id: string | null
          quantity: number
          status: string
          unit_cost_allocation: number | null
          updated_at: string
        }
        Insert: {
          brand?: string | null
          cbm_occupied?: number | null
          container_id: string
          created_at?: string
          id?: string
          material_description?: string | null
          model?: string | null
          notes?: string | null
          part_id?: string | null
          quantity: number
          status?: string
          unit_cost_allocation?: number | null
          updated_at?: string
        }
        Update: {
          brand?: string | null
          cbm_occupied?: number | null
          container_id?: string
          created_at?: string
          id?: string
          material_description?: string | null
          model?: string | null
          notes?: string | null
          part_id?: string | null
          quantity?: number
          status?: string
          unit_cost_allocation?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "container_materials_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "import_containers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "container_materials_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_complaint_parts: {
        Row: {
          analysis: string | null
          complaint_id: string
          created_at: string
          id: string
          part_id: string
          quantity: number
          status: string
          updated_at: string
          vendor_id: string | null
          verdict: Database["public"]["Enums"]["rejection_verdict"] | null
        }
        Insert: {
          analysis?: string | null
          complaint_id: string
          created_at?: string
          id?: string
          part_id: string
          quantity: number
          status?: string
          updated_at?: string
          vendor_id?: string | null
          verdict?: Database["public"]["Enums"]["rejection_verdict"] | null
        }
        Update: {
          analysis?: string | null
          complaint_id?: string
          created_at?: string
          id?: string
          part_id?: string
          quantity?: number
          status?: string
          updated_at?: string
          vendor_id?: string | null
          verdict?: Database["public"]["Enums"]["rejection_verdict"] | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_complaint_parts_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "customer_complaints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_complaint_parts_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_complaint_parts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_complaints: {
        Row: {
          capa_id: string | null
          complaint_details: string
          complaint_number: string
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          part_id: string | null
          plant_id: string | null
          quantity: number
          received_date: string
          resolution: string | null
          resolved_at: string | null
          serial_number: string | null
          status: Database["public"]["Enums"]["complaint_status"]
          updated_at: string
        }
        Insert: {
          capa_id?: string | null
          complaint_details: string
          complaint_number: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          part_id?: string | null
          plant_id?: string | null
          quantity?: number
          received_date?: string
          resolution?: string | null
          resolved_at?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["complaint_status"]
          updated_at?: string
        }
        Update: {
          capa_id?: string | null
          complaint_details?: string
          complaint_number?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          part_id?: string | null
          plant_id?: string | null
          quantity?: number
          received_date?: string
          resolution?: string | null
          resolved_at?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["complaint_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_complaints_capa_id_fkey"
            columns: ["capa_id"]
            isOneToOne: false
            referencedRelation: "capa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_complaints_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_complaints_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_complaints_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_warehouses: {
        Row: {
          address: string
          contact_number: string | null
          contact_person: string | null
          created_at: string
          customer_id: string
          id: string
          is_active: boolean
          updated_at: string
          warehouse_name: string
        }
        Insert: {
          address: string
          contact_number?: string | null
          contact_person?: string | null
          created_at?: string
          customer_id: string
          id?: string
          is_active?: boolean
          updated_at?: string
          warehouse_name: string
        }
        Update: {
          address?: string
          contact_number?: string | null
          contact_person?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          warehouse_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_warehouses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          bank_account_number: string | null
          brand_authorization_url: string | null
          brand_name: string | null
          contact_number: string | null
          contact_person_name: string | null
          created_at: string
          created_by: string | null
          customer_code: string
          email: string | null
          gst_certificate_url: string | null
          gst_number: string | null
          id: string
          ifsc_code: string | null
          is_active: boolean
          msme_certificate_url: string | null
          name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          bank_account_number?: string | null
          brand_authorization_url?: string | null
          brand_name?: string | null
          contact_number?: string | null
          contact_person_name?: string | null
          created_at?: string
          created_by?: string | null
          customer_code: string
          email?: string | null
          gst_certificate_url?: string | null
          gst_number?: string | null
          id?: string
          ifsc_code?: string | null
          is_active?: boolean
          msme_certificate_url?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          bank_account_number?: string | null
          brand_authorization_url?: string | null
          brand_name?: string | null
          contact_number?: string | null
          contact_person_name?: string | null
          created_at?: string
          created_by?: string | null
          customer_code?: string
          email?: string | null
          gst_certificate_url?: string | null
          gst_number?: string | null
          id?: string
          ifsc_code?: string | null
          is_active?: boolean
          msme_certificate_url?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      dash_customer_documents: {
        Row: {
          created_at: string
          customer_id: string
          document_type: string
          file_name: string
          file_url: string
          id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          document_type: string
          file_name: string
          file_url: string
          id?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          document_type?: string
          file_name?: string
          file_url?: string
          id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dash_customer_documents_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "dash_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      dash_customers: {
        Row: {
          address: string | null
          assigned_sales_manager: string | null
          bank_account_number: string | null
          bank_ifsc: string | null
          bank_name: string | null
          cancelled_cheque_url: string | null
          city: string | null
          contact_person: string | null
          created_at: string
          created_by: string | null
          credit_limit: number
          customer_name: string
          customer_type: Database["public"]["Enums"]["dash_customer_type"]
          email: string | null
          godown_address: string | null
          gst_certificate_url: string | null
          gst_number: string | null
          id: string
          is_active: boolean
          msme_certificate_url: string | null
          msme_number: string | null
          notes: string | null
          outstanding_balance: number
          owner_name: string | null
          owner_phone: string | null
          pan_number: string | null
          phone: string | null
          pincode: string | null
          primary_address: string | null
          salesman_name: string | null
          state: string | null
          territory: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          assigned_sales_manager?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          cancelled_cheque_url?: string | null
          city?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number
          customer_name: string
          customer_type?: Database["public"]["Enums"]["dash_customer_type"]
          email?: string | null
          godown_address?: string | null
          gst_certificate_url?: string | null
          gst_number?: string | null
          id?: string
          is_active?: boolean
          msme_certificate_url?: string | null
          msme_number?: string | null
          notes?: string | null
          outstanding_balance?: number
          owner_name?: string | null
          owner_phone?: string | null
          pan_number?: string | null
          phone?: string | null
          pincode?: string | null
          primary_address?: string | null
          salesman_name?: string | null
          state?: string | null
          territory?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          assigned_sales_manager?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          cancelled_cheque_url?: string | null
          city?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number
          customer_name?: string
          customer_type?: Database["public"]["Enums"]["dash_customer_type"]
          email?: string | null
          godown_address?: string | null
          gst_certificate_url?: string | null
          gst_number?: string | null
          id?: string
          is_active?: boolean
          msme_certificate_url?: string | null
          msme_number?: string | null
          notes?: string | null
          outstanding_balance?: number
          owner_name?: string | null
          owner_phone?: string | null
          pan_number?: string | null
          phone?: string | null
          pincode?: string | null
          primary_address?: string | null
          salesman_name?: string | null
          state?: string | null
          territory?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      dash_factory_orders: {
        Row: {
          batch_number: string | null
          cost_per_unit: number
          created_at: string
          created_by: string | null
          dispatch_date: string | null
          expected_production_date: string | null
          factory_invoice_url: string | null
          fo_number: string
          id: string
          notes: string | null
          product_id: string
          qc_status: Database["public"]["Enums"]["dash_qc_status"]
          quantity_ordered: number
          shipment_tracking_number: string | null
          status: Database["public"]["Enums"]["dash_factory_order_status"]
          total_cost: number
          updated_at: string
        }
        Insert: {
          batch_number?: string | null
          cost_per_unit?: number
          created_at?: string
          created_by?: string | null
          dispatch_date?: string | null
          expected_production_date?: string | null
          factory_invoice_url?: string | null
          fo_number: string
          id?: string
          notes?: string | null
          product_id: string
          qc_status?: Database["public"]["Enums"]["dash_qc_status"]
          quantity_ordered?: number
          shipment_tracking_number?: string | null
          status?: Database["public"]["Enums"]["dash_factory_order_status"]
          total_cost?: number
          updated_at?: string
        }
        Update: {
          batch_number?: string | null
          cost_per_unit?: number
          created_at?: string
          created_by?: string | null
          dispatch_date?: string | null
          expected_production_date?: string | null
          factory_invoice_url?: string | null
          fo_number?: string
          id?: string
          notes?: string | null
          product_id?: string
          qc_status?: Database["public"]["Enums"]["dash_qc_status"]
          quantity_ordered?: number
          shipment_tracking_number?: string | null
          status?: Database["public"]["Enums"]["dash_factory_order_status"]
          total_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dash_factory_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "dash_products"
            referencedColumns: ["id"]
          },
        ]
      }
      dash_inventory: {
        Row: {
          batch_number: string | null
          created_at: string
          damaged_stock: number
          id: string
          in_transit_stock: number
          location: string | null
          low_stock_threshold: number
          product_id: string
          reserved_stock: number
          total_stock: number
          unit_cost: number
          updated_at: string
        }
        Insert: {
          batch_number?: string | null
          created_at?: string
          damaged_stock?: number
          id?: string
          in_transit_stock?: number
          location?: string | null
          low_stock_threshold?: number
          product_id: string
          reserved_stock?: number
          total_stock?: number
          unit_cost?: number
          updated_at?: string
        }
        Update: {
          batch_number?: string | null
          created_at?: string
          damaged_stock?: number
          id?: string
          in_transit_stock?: number
          location?: string | null
          low_stock_threshold?: number
          product_id?: string
          reserved_stock?: number
          total_stock?: number
          unit_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dash_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "dash_products"
            referencedColumns: ["id"]
          },
        ]
      }
      dash_inventory_movements: {
        Row: {
          batch_number: string | null
          created_at: string
          created_by: string | null
          id: string
          movement_type: Database["public"]["Enums"]["dash_movement_type"]
          notes: string | null
          product_id: string
          quantity: number
          reference_id: string | null
          reference_type: string | null
        }
        Insert: {
          batch_number?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type: Database["public"]["Enums"]["dash_movement_type"]
          notes?: string | null
          product_id: string
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
        }
        Update: {
          batch_number?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type?: Database["public"]["Enums"]["dash_movement_type"]
          notes?: string | null
          product_id?: string
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dash_inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "dash_products"
            referencedColumns: ["id"]
          },
        ]
      }
      dash_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          notes: string | null
          payment_date: string
          payment_mode: string | null
          reference_number: string | null
          sales_order_id: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_mode?: string | null
          reference_number?: string | null
          sales_order_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_mode?: string | null
          reference_number?: string | null
          sales_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dash_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "dash_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dash_payments_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "dash_sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      dash_product_artwork: {
        Row: {
          created_at: string
          file_name: string
          file_type: Database["public"]["Enums"]["dash_artwork_type"]
          file_url: string
          id: string
          product_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_type: Database["public"]["Enums"]["dash_artwork_type"]
          file_url: string
          id?: string
          product_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_type?: Database["public"]["Enums"]["dash_artwork_type"]
          file_url?: string
          id?: string
          product_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dash_product_artwork_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "dash_products"
            referencedColumns: ["id"]
          },
        ]
      }
      dash_product_compliance: {
        Row: {
          bis_certificate_number: string | null
          bis_expiry_date: string | null
          brand_logo_location: string | null
          compliance_notes: string | null
          compliance_status: string
          created_at: string
          id: string
          mrp_label_location_box: string | null
          notes: string | null
          other_certifications: Json | null
          product_id: string
          rating_label_location_box: string | null
          rating_label_location_product: string | null
          updated_at: string
        }
        Insert: {
          bis_certificate_number?: string | null
          bis_expiry_date?: string | null
          brand_logo_location?: string | null
          compliance_notes?: string | null
          compliance_status?: string
          created_at?: string
          id?: string
          mrp_label_location_box?: string | null
          notes?: string | null
          other_certifications?: Json | null
          product_id: string
          rating_label_location_box?: string | null
          rating_label_location_product?: string | null
          updated_at?: string
        }
        Update: {
          bis_certificate_number?: string | null
          bis_expiry_date?: string | null
          brand_logo_location?: string | null
          compliance_notes?: string | null
          compliance_status?: string
          created_at?: string
          id?: string
          mrp_label_location_box?: string | null
          notes?: string | null
          other_certifications?: Json | null
          product_id?: string
          rating_label_location_box?: string | null
          rating_label_location_product?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dash_product_compliance_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "dash_products"
            referencedColumns: ["id"]
          },
        ]
      }
      dash_product_documents: {
        Row: {
          created_at: string
          doc_name: string | null
          doc_type: string | null
          document_type: string
          file_name: string
          file_url: string
          id: string
          is_current: boolean
          product_id: string
          uploaded_by: string | null
          version: number
        }
        Insert: {
          created_at?: string
          doc_name?: string | null
          doc_type?: string | null
          document_type: string
          file_name: string
          file_url: string
          id?: string
          is_current?: boolean
          product_id: string
          uploaded_by?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          doc_name?: string | null
          doc_type?: string | null
          document_type?: string
          file_name?: string
          file_url?: string
          id?: string
          is_current?: boolean
          product_id?: string
          uploaded_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "dash_product_documents_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "dash_products"
            referencedColumns: ["id"]
          },
        ]
      }
      dash_product_qc_checklist: {
        Row: {
          created_at: string | null
          expected_value: string | null
          id: string
          is_mandatory: boolean | null
          parameter_category: string | null
          parameter_name: string
          product_id: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          expected_value?: string | null
          id?: string
          is_mandatory?: boolean | null
          parameter_category?: string | null
          parameter_name: string
          product_id: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          expected_value?: string | null
          id?: string
          is_mandatory?: boolean | null
          parameter_category?: string | null
          parameter_name?: string
          product_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dash_product_qc_checklist_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "dash_products"
            referencedColumns: ["id"]
          },
        ]
      }
      dash_product_spare_parts: {
        Row: {
          created_at: string | null
          current_stock: number | null
          description: string | null
          id: string
          part_name: string
          part_number: string
          product_id: string
          reorder_level: number | null
          selling_price: number | null
          unit_cost: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_stock?: number | null
          description?: string | null
          id?: string
          part_name: string
          part_number: string
          product_id: string
          reorder_level?: number | null
          selling_price?: number | null
          unit_cost?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_stock?: number | null
          description?: string | null
          id?: string
          part_name?: string
          part_number?: string
          product_id?: string
          reorder_level?: number | null
          selling_price?: number | null
          unit_cost?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dash_product_spare_parts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "dash_products"
            referencedColumns: ["id"]
          },
        ]
      }
      dash_product_spares: {
        Row: {
          created_at: string
          id: string
          product_id: string
          spare_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          spare_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          spare_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dash_product_spares_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "dash_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dash_product_spares_spare_id_fkey"
            columns: ["spare_id"]
            isOneToOne: false
            referencedRelation: "dash_spare_parts"
            referencedColumns: ["id"]
          },
        ]
      }
      dash_product_specs: {
        Row: {
          box_contents: string[] | null
          color_variants: string[] | null
          connectivity: string[] | null
          country_of_origin: string | null
          created_at: string | null
          custom_specs: Json | null
          dimensions_h: number | null
          dimensions_l: number | null
          dimensions_w: number | null
          frequency_response: string | null
          id: string
          power_output: string | null
          product_id: string
          updated_at: string | null
          weight_kg: number | null
        }
        Insert: {
          box_contents?: string[] | null
          color_variants?: string[] | null
          connectivity?: string[] | null
          country_of_origin?: string | null
          created_at?: string | null
          custom_specs?: Json | null
          dimensions_h?: number | null
          dimensions_l?: number | null
          dimensions_w?: number | null
          frequency_response?: string | null
          id?: string
          power_output?: string | null
          product_id: string
          updated_at?: string | null
          weight_kg?: number | null
        }
        Update: {
          box_contents?: string[] | null
          color_variants?: string[] | null
          connectivity?: string[] | null
          country_of_origin?: string | null
          created_at?: string | null
          custom_specs?: Json | null
          dimensions_h?: number | null
          dimensions_l?: number | null
          dimensions_w?: number | null
          frequency_response?: string | null
          id?: string
          power_output?: string | null
          product_id?: string
          updated_at?: string | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dash_product_specs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "dash_products"
            referencedColumns: ["id"]
          },
        ]
      }
      dash_products: {
        Row: {
          barcode_ean: string | null
          branding_info: string | null
          category: Database["public"]["Enums"]["dash_product_category"]
          created_at: string
          created_by: string | null
          dealer_price: number
          description: string | null
          distributor_price: number
          dp: number | null
          gross_weight: number | null
          gst_percent: number | null
          hsn_code: string | null
          id: string
          model_number: string
          mrp: number
          net_weight: number | null
          nlc: number | null
          product_name: string
          purchase_price: number | null
          qa_checklist: Json | null
          serial_next_number: number | null
          serial_prefix: string | null
          software_button_details: string | null
          status: Database["public"]["Enums"]["dash_product_status"]
          technical_specs: Json | null
          updated_at: string
          updated_by: string | null
          warranty_period_months: number
        }
        Insert: {
          barcode_ean?: string | null
          branding_info?: string | null
          category?: Database["public"]["Enums"]["dash_product_category"]
          created_at?: string
          created_by?: string | null
          dealer_price?: number
          description?: string | null
          distributor_price?: number
          dp?: number | null
          gross_weight?: number | null
          gst_percent?: number | null
          hsn_code?: string | null
          id?: string
          model_number: string
          mrp?: number
          net_weight?: number | null
          nlc?: number | null
          product_name: string
          purchase_price?: number | null
          qa_checklist?: Json | null
          serial_next_number?: number | null
          serial_prefix?: string | null
          software_button_details?: string | null
          status?: Database["public"]["Enums"]["dash_product_status"]
          technical_specs?: Json | null
          updated_at?: string
          updated_by?: string | null
          warranty_period_months?: number
        }
        Update: {
          barcode_ean?: string | null
          branding_info?: string | null
          category?: Database["public"]["Enums"]["dash_product_category"]
          created_at?: string
          created_by?: string | null
          dealer_price?: number
          description?: string | null
          distributor_price?: number
          dp?: number | null
          gross_weight?: number | null
          gst_percent?: number | null
          hsn_code?: string | null
          id?: string
          model_number?: string
          mrp?: number
          net_weight?: number | null
          nlc?: number | null
          product_name?: string
          purchase_price?: number | null
          qa_checklist?: Json | null
          serial_next_number?: number | null
          serial_prefix?: string | null
          software_button_details?: string | null
          status?: Database["public"]["Enums"]["dash_product_status"]
          technical_specs?: Json | null
          updated_at?: string
          updated_by?: string | null
          warranty_period_months?: number
        }
        Relationships: []
      }
      dash_sales_order_items: {
        Row: {
          batch_number: string | null
          discount_percent: number
          id: string
          line_total: number
          product_id: string
          quantity: number
          sales_order_id: string
          unit_price: number
        }
        Insert: {
          batch_number?: string | null
          discount_percent?: number
          id?: string
          line_total?: number
          product_id: string
          quantity?: number
          sales_order_id: string
          unit_price?: number
        }
        Update: {
          batch_number?: string | null
          discount_percent?: number
          id?: string
          line_total?: number
          product_id?: string
          quantity?: number
          sales_order_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "dash_sales_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "dash_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dash_sales_order_items_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "dash_sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      dash_sales_orders: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          discount_amount: number
          dispatch_status: Database["public"]["Enums"]["dash_dispatch_status"]
          e_invoice_url: string | null
          id: string
          net_amount: number
          notes: string | null
          order_date: string
          payment_status: Database["public"]["Enums"]["dash_payment_status"]
          scheme_details: string | null
          so_number: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          discount_amount?: number
          dispatch_status?: Database["public"]["Enums"]["dash_dispatch_status"]
          e_invoice_url?: string | null
          id?: string
          net_amount?: number
          notes?: string | null
          order_date?: string
          payment_status?: Database["public"]["Enums"]["dash_payment_status"]
          scheme_details?: string | null
          so_number: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          discount_amount?: number
          dispatch_status?: Database["public"]["Enums"]["dash_dispatch_status"]
          e_invoice_url?: string | null
          id?: string
          net_amount?: number
          notes?: string | null
          order_date?: string
          payment_status?: Database["public"]["Enums"]["dash_payment_status"]
          scheme_details?: string | null
          so_number?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dash_sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "dash_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      dash_service_history: {
        Row: {
          action_type: string
          created_at: string
          description: string | null
          id: string
          performed_by: string | null
          serial_number: string | null
          ticket_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          description?: string | null
          id?: string
          performed_by?: string | null
          serial_number?: string | null
          ticket_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          description?: string | null
          id?: string
          performed_by?: string | null
          serial_number?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dash_service_history_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "dash_service_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      dash_service_tickets: {
        Row: {
          assigned_engineer: string | null
          closed_at: string | null
          created_at: string
          customer_name: string
          customer_phone: string | null
          id: string
          issue_description: string
          product_id: string
          repair_status: Database["public"]["Enums"]["dash_repair_status"]
          replacement_approval_notes: string | null
          replacement_approved: boolean
          serial_number: string | null
          service_notes: string | null
          ticket_number: string
          updated_at: string
          warranty_valid: boolean
        }
        Insert: {
          assigned_engineer?: string | null
          closed_at?: string | null
          created_at?: string
          customer_name: string
          customer_phone?: string | null
          id?: string
          issue_description: string
          product_id: string
          repair_status?: Database["public"]["Enums"]["dash_repair_status"]
          replacement_approval_notes?: string | null
          replacement_approved?: boolean
          serial_number?: string | null
          service_notes?: string | null
          ticket_number: string
          updated_at?: string
          warranty_valid?: boolean
        }
        Update: {
          assigned_engineer?: string | null
          closed_at?: string | null
          created_at?: string
          customer_name?: string
          customer_phone?: string | null
          id?: string
          issue_description?: string
          product_id?: string
          repair_status?: Database["public"]["Enums"]["dash_repair_status"]
          replacement_approval_notes?: string | null
          replacement_approved?: boolean
          serial_number?: string | null
          service_notes?: string | null
          ticket_number?: string
          updated_at?: string
          warranty_valid?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "dash_service_tickets_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "dash_products"
            referencedColumns: ["id"]
          },
        ]
      }
      dash_spare_consumption: {
        Row: {
          consumed_by: string | null
          created_at: string
          id: string
          notes: string | null
          quantity_used: number
          spare_id: string
          ticket_id: string | null
        }
        Insert: {
          consumed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          quantity_used?: number
          spare_id: string
          ticket_id?: string | null
        }
        Update: {
          consumed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          quantity_used?: number
          spare_id?: string
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dash_spare_consumption_spare_id_fkey"
            columns: ["spare_id"]
            isOneToOne: false
            referencedRelation: "dash_spare_parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dash_spare_consumption_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "dash_service_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      dash_spare_dispatch_log: {
        Row: {
          created_at: string
          dispatch_type: Database["public"]["Enums"]["dash_spare_dispatch_type"]
          dispatched_by: string | null
          dispatched_to: string | null
          id: string
          notes: string | null
          quantity: number
          reference_number: string | null
          spare_id: string
        }
        Insert: {
          created_at?: string
          dispatch_type?: Database["public"]["Enums"]["dash_spare_dispatch_type"]
          dispatched_by?: string | null
          dispatched_to?: string | null
          id?: string
          notes?: string | null
          quantity?: number
          reference_number?: string | null
          spare_id: string
        }
        Update: {
          created_at?: string
          dispatch_type?: Database["public"]["Enums"]["dash_spare_dispatch_type"]
          dispatched_by?: string | null
          dispatched_to?: string | null
          id?: string
          notes?: string | null
          quantity?: number
          reference_number?: string | null
          spare_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dash_spare_dispatch_log_spare_id_fkey"
            columns: ["spare_id"]
            isOneToOne: false
            referencedRelation: "dash_spare_parts"
            referencedColumns: ["id"]
          },
        ]
      }
      dash_spare_parts: {
        Row: {
          cost_price: number
          created_at: string
          description: string | null
          id: string
          linked_product_ids: Json | null
          low_stock_threshold: number
          selling_price: number
          spare_code: string
          spare_name: string
          stock_quantity: number
          updated_at: string
        }
        Insert: {
          cost_price?: number
          created_at?: string
          description?: string | null
          id?: string
          linked_product_ids?: Json | null
          low_stock_threshold?: number
          selling_price?: number
          spare_code: string
          spare_name: string
          stock_quantity?: number
          updated_at?: string
        }
        Update: {
          cost_price?: number
          created_at?: string
          description?: string | null
          id?: string
          linked_product_ids?: Json | null
          low_stock_threshold?: number
          selling_price?: number
          spare_code?: string
          spare_name?: string
          stock_quantity?: number
          updated_at?: string
        }
        Relationships: []
      }
      department_permissions: {
        Row: {
          created_at: string
          department_id: string
          id: string
          tab_name: string
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          tab_name: string
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          tab_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_permissions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      dispatch_order_items: {
        Row: {
          created_at: string
          dispatch_order_id: string
          finished_goods_inventory_id: string
          id: string
          quantity: number
        }
        Insert: {
          created_at?: string
          dispatch_order_id: string
          finished_goods_inventory_id: string
          id?: string
          quantity: number
        }
        Update: {
          created_at?: string
          dispatch_order_id?: string
          finished_goods_inventory_id?: string
          id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_order_items_dispatch_order_id_fkey"
            columns: ["dispatch_order_id"]
            isOneToOne: false
            referencedRelation: "dispatch_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_order_items_finished_goods_inventory_id_fkey"
            columns: ["finished_goods_inventory_id"]
            isOneToOne: false
            referencedRelation: "finished_goods_inventory"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatch_orders: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          customer_warehouse_id: string | null
          dispatch_date: string
          dispatch_number: string
          gate_out_at: string | null
          id: string
          invoice_number: string | null
          plant_id: string
          status: Database["public"]["Enums"]["dispatch_status"]
          updated_at: string
          vehicle_number: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          customer_warehouse_id?: string | null
          dispatch_date?: string
          dispatch_number: string
          gate_out_at?: string | null
          id?: string
          invoice_number?: string | null
          plant_id: string
          status?: Database["public"]["Enums"]["dispatch_status"]
          updated_at?: string
          vehicle_number?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          customer_warehouse_id?: string | null
          dispatch_date?: string
          dispatch_number?: string
          gate_out_at?: string | null
          id?: string
          invoice_number?: string | null
          plant_id?: string
          status?: Database["public"]["Enums"]["dispatch_status"]
          updated_at?: string
          vehicle_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_orders_customer_warehouse_id_fkey"
            columns: ["customer_warehouse_id"]
            isOneToOne: false
            referencedRelation: "customer_warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_orders_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
      document_counters: {
        Row: {
          doc_family: string
          last_value: number
          period_key: string
        }
        Insert: {
          doc_family: string
          last_value?: number
          period_key: string
        }
        Update: {
          doc_family?: string
          last_value?: number
          period_key?: string
        }
        Relationships: []
      }
      employee_skills: {
        Row: {
          acquired_date: string | null
          certification_expiry: string | null
          certified: boolean | null
          employee_id: string | null
          id: string
          skill_id: string | null
          skill_level: Database["public"]["Enums"]["skill_level"]
        }
        Insert: {
          acquired_date?: string | null
          certification_expiry?: string | null
          certified?: boolean | null
          employee_id?: string | null
          id?: string
          skill_id?: string | null
          skill_level: Database["public"]["Enums"]["skill_level"]
        }
        Update: {
          acquired_date?: string | null
          certification_expiry?: string | null
          certified?: boolean | null
          employee_id?: string | null
          id?: string
          skill_id?: string | null
          skill_level?: Database["public"]["Enums"]["skill_level"]
        }
        Relationships: [
          {
            foreignKeyName: "employee_skills_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_training: {
        Row: {
          completion_date: string | null
          employee_id: string | null
          enrollment_date: string | null
          feedback: string | null
          id: string
          score: number | null
          status: string | null
          training_program_id: string | null
        }
        Insert: {
          completion_date?: string | null
          employee_id?: string | null
          enrollment_date?: string | null
          feedback?: string | null
          id?: string
          score?: number | null
          status?: string | null
          training_program_id?: string | null
        }
        Update: {
          completion_date?: string | null
          employee_id?: string | null
          enrollment_date?: string | null
          feedback?: string | null
          id?: string
          score?: number | null
          status?: string | null
          training_program_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_training_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_training_training_program_id_fkey"
            columns: ["training_program_id"]
            isOneToOne: false
            referencedRelation: "training_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          aadhar_number: string | null
          address: string | null
          bank_account_number: string | null
          bank_name: string | null
          city: string | null
          created_at: string | null
          created_by: string | null
          date_of_birth: string | null
          department: string
          email: string
          employee_code: string
          esic_number: string | null
          first_name: string
          hire_date: string
          id: string
          ifsc_code: string | null
          last_name: string | null
          pan_number: string | null
          phone_number: string
          pincode: string | null
          position: string
          salary: number | null
          state: string | null
          status: Database["public"]["Enums"]["employee_status"]
          updated_at: string | null
        }
        Insert: {
          aadhar_number?: string | null
          address?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          city?: string | null
          created_at?: string | null
          created_by?: string | null
          date_of_birth?: string | null
          department: string
          email: string
          employee_code: string
          esic_number?: string | null
          first_name: string
          hire_date?: string
          id?: string
          ifsc_code?: string | null
          last_name?: string | null
          pan_number?: string | null
          phone_number: string
          pincode?: string | null
          position: string
          salary?: number | null
          state?: string | null
          status?: Database["public"]["Enums"]["employee_status"]
          updated_at?: string | null
        }
        Update: {
          aadhar_number?: string | null
          address?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          city?: string | null
          created_at?: string | null
          created_by?: string | null
          date_of_birth?: string | null
          department?: string
          email?: string
          employee_code?: string
          esic_number?: string | null
          first_name?: string
          hire_date?: string
          id?: string
          ifsc_code?: string | null
          last_name?: string | null
          pan_number?: string | null
          phone_number?: string
          pincode?: string | null
          position?: string
          salary?: number | null
          state?: string | null
          status?: Database["public"]["Enums"]["employee_status"]
          updated_at?: string | null
        }
        Relationships: []
      }
      finished_goods_inventory: {
        Row: {
          created_at: string
          id: string
          lot_number: string | null
          part_id: string
          plant_id: string
          production_order_id: string
          quantity_available: number | null
          quantity_dispatched: number
          quantity_in: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          lot_number?: string | null
          part_id: string
          plant_id: string
          production_order_id: string
          quantity_available?: number | null
          quantity_dispatched?: number
          quantity_in: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          lot_number?: string | null
          part_id?: string
          plant_id?: string
          production_order_id?: string
          quantity_available?: number | null
          quantity_dispatched?: number
          quantity_in?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finished_goods_inventory_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finished_goods_inventory_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finished_goods_inventory_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      grn: {
        Row: {
          created_at: string
          created_by: string | null
          grn_number: string
          id: string
          import_container_id: string | null
          invoice_date: string | null
          invoice_number: string | null
          invoice_quantity: number | null
          notes: string | null
          plant_id: string
          purchase_order_id: string | null
          received_date: string
          status: Database["public"]["Enums"]["grn_status"]
          updated_at: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          grn_number: string
          id?: string
          import_container_id?: string | null
          invoice_date?: string | null
          invoice_number?: string | null
          invoice_quantity?: number | null
          notes?: string | null
          plant_id: string
          purchase_order_id?: string | null
          received_date?: string
          status?: Database["public"]["Enums"]["grn_status"]
          updated_at?: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          grn_number?: string
          id?: string
          import_container_id?: string | null
          invoice_date?: string | null
          invoice_number?: string | null
          invoice_quantity?: number | null
          notes?: string | null
          plant_id?: string
          purchase_order_id?: string | null
          received_date?: string
          status?: Database["public"]["Enums"]["grn_status"]
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grn_import_container_id_fkey"
            columns: ["import_container_id"]
            isOneToOne: false
            referencedRelation: "import_containers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grn_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grn_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grn_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      grn_items: {
        Row: {
          created_at: string
          grn_id: string
          id: string
          iqc_accepted_quantity: number
          iqc_at: string | null
          iqc_by: string | null
          iqc_outcome: Database["public"]["Enums"]["iqc_outcome"]
          iqc_rejected_quantity: number
          iqc_report_url: string | null
          notes: string | null
          part_id: string
          purchase_order_item_id: string | null
          received_quantity: number
          store_confirmed_at: string | null
          store_confirmed_by: string | null
          store_counted_quantity: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          grn_id: string
          id?: string
          iqc_accepted_quantity?: number
          iqc_at?: string | null
          iqc_by?: string | null
          iqc_outcome?: Database["public"]["Enums"]["iqc_outcome"]
          iqc_rejected_quantity?: number
          iqc_report_url?: string | null
          notes?: string | null
          part_id: string
          purchase_order_item_id?: string | null
          received_quantity: number
          store_confirmed_at?: string | null
          store_confirmed_by?: string | null
          store_counted_quantity?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          grn_id?: string
          id?: string
          iqc_accepted_quantity?: number
          iqc_at?: string | null
          iqc_by?: string | null
          iqc_outcome?: Database["public"]["Enums"]["iqc_outcome"]
          iqc_rejected_quantity?: number
          iqc_report_url?: string | null
          notes?: string | null
          part_id?: string
          purchase_order_item_id?: string | null
          received_quantity?: number
          store_confirmed_at?: string | null
          store_confirmed_by?: string | null
          store_counted_quantity?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grn_items_grn_id_fkey"
            columns: ["grn_id"]
            isOneToOne: false
            referencedRelation: "grn"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grn_items_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grn_items_purchase_order_item_id_fkey"
            columns: ["purchase_order_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      hourly_production: {
        Row: {
          created_at: string
          downtime_minutes: number
          efficiency_percentage: number | null
          hour_slot: string
          id: string
          manpower: number | null
          notes: string | null
          produced_quantity: number
          production_line_id: string | null
          production_order_id: string
          recorded_by: string | null
          rejected_quantity: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          downtime_minutes?: number
          efficiency_percentage?: number | null
          hour_slot: string
          id?: string
          manpower?: number | null
          notes?: string | null
          produced_quantity?: number
          production_line_id?: string | null
          production_order_id: string
          recorded_by?: string | null
          rejected_quantity?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          downtime_minutes?: number
          efficiency_percentage?: number | null
          hour_slot?: string
          id?: string
          manpower?: number | null
          notes?: string | null
          produced_quantity?: number
          production_line_id?: string | null
          production_order_id?: string
          recorded_by?: string | null
          rejected_quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hourly_production_production_line_id_fkey"
            columns: ["production_line_id"]
            isOneToOne: false
            referencedRelation: "production_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hourly_production_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      ht_store: {
        Row: {
          account_key: string
          store_key: string
          updated_at: string
          value: Json
        }
        Insert: {
          account_key: string
          store_key: string
          updated_at?: string
          value: Json
        }
        Update: {
          account_key?: string
          store_key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      import_containers: {
        Row: {
          arrived_date: string | null
          china_custom_date: string | null
          container_number: string
          created_at: string
          created_by: string | null
          current_status: Database["public"]["Enums"]["container_status"]
          duty_cost: number | null
          factory_arrival_date: string | null
          freight_cost: number | null
          id: string
          india_custom_date: string | null
          indian_dock_date: string | null
          loaded_date: string | null
          notes: string | null
          ordered_date: string | null
          other_cost: number | null
          planned_arrived: string | null
          planned_factory: string | null
          planned_loaded: string | null
          planned_shipped: string | null
          purchase_order_id: string | null
          shipped_date: string | null
          supplier_info: string | null
          total_cbm: number | null
          updated_at: string
          vessel_name: string | null
        }
        Insert: {
          arrived_date?: string | null
          china_custom_date?: string | null
          container_number: string
          created_at?: string
          created_by?: string | null
          current_status?: Database["public"]["Enums"]["container_status"]
          duty_cost?: number | null
          factory_arrival_date?: string | null
          freight_cost?: number | null
          id?: string
          india_custom_date?: string | null
          indian_dock_date?: string | null
          loaded_date?: string | null
          notes?: string | null
          ordered_date?: string | null
          other_cost?: number | null
          planned_arrived?: string | null
          planned_factory?: string | null
          planned_loaded?: string | null
          planned_shipped?: string | null
          purchase_order_id?: string | null
          shipped_date?: string | null
          supplier_info?: string | null
          total_cbm?: number | null
          updated_at?: string
          vessel_name?: string | null
        }
        Update: {
          arrived_date?: string | null
          china_custom_date?: string | null
          container_number?: string
          created_at?: string
          created_by?: string | null
          current_status?: Database["public"]["Enums"]["container_status"]
          duty_cost?: number | null
          factory_arrival_date?: string | null
          freight_cost?: number | null
          id?: string
          india_custom_date?: string | null
          indian_dock_date?: string | null
          loaded_date?: string | null
          notes?: string | null
          ordered_date?: string | null
          other_cost?: number | null
          planned_arrived?: string | null
          planned_factory?: string | null
          planned_loaded?: string | null
          planned_shipped?: string | null
          purchase_order_id?: string | null
          shipped_date?: string | null
          supplier_info?: string | null
          total_cbm?: number | null
          updated_at?: string
          vessel_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_containers_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      kit_feedback: {
        Row: {
          created_at: string
          id: string
          issued_quantity: number
          kit_item_id: string
          part_id: string
          plant_id: string
          production_order_id: string | null
          raised_at: string
          raised_by: string | null
          reason: string | null
          received_quantity: number
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["kit_feedback_status"]
          stock_ledger_id: string | null
          store_remarks: string | null
          updated_at: string
          variance: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          issued_quantity: number
          kit_item_id: string
          part_id: string
          plant_id: string
          production_order_id?: string | null
          raised_at?: string
          raised_by?: string | null
          reason?: string | null
          received_quantity: number
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["kit_feedback_status"]
          stock_ledger_id?: string | null
          store_remarks?: string | null
          updated_at?: string
          variance?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          issued_quantity?: number
          kit_item_id?: string
          part_id?: string
          plant_id?: string
          production_order_id?: string | null
          raised_at?: string
          raised_by?: string | null
          reason?: string | null
          received_quantity?: number
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["kit_feedback_status"]
          stock_ledger_id?: string | null
          store_remarks?: string | null
          updated_at?: string
          variance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kit_feedback_kit_item_id_fkey"
            columns: ["kit_item_id"]
            isOneToOne: false
            referencedRelation: "kit_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kit_feedback_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kit_feedback_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kit_feedback_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kit_feedback_stock_ledger_id_fkey"
            columns: ["stock_ledger_id"]
            isOneToOne: false
            referencedRelation: "stock_ledger"
            referencedColumns: ["id"]
          },
        ]
      }
      kit_items: {
        Row: {
          created_at: string
          id: string
          issued_quantity: number
          kit_preparation_id: string
          part_id: string
          received_quantity: number | null
          required_quantity: number
          returned_quantity: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          issued_quantity?: number
          kit_preparation_id: string
          part_id: string
          received_quantity?: number | null
          required_quantity: number
          returned_quantity?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          issued_quantity?: number
          kit_preparation_id?: string
          part_id?: string
          received_quantity?: number | null
          required_quantity?: number
          returned_quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kit_items_kit_preparation_id_fkey"
            columns: ["kit_preparation_id"]
            isOneToOne: false
            referencedRelation: "kit_preparation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kit_items_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
        ]
      }
      kit_preparation: {
        Row: {
          created_at: string
          id: string
          kit_number: string
          notes: string | null
          plant_id: string
          prepared_by: string | null
          production_order_id: string
          received_at: string | null
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kit_number: string
          notes?: string | null
          plant_id: string
          prepared_by?: string | null
          production_order_id: string
          received_at?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kit_number?: string
          notes?: string | null
          plant_id?: string
          prepared_by?: string | null
          production_order_id?: string
          received_at?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kit_preparation_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kit_preparation_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      kit_returns: {
        Row: {
          created_at: string
          id: string
          kit_item_id: string
          notes: string | null
          plant_id: string
          quantity: number
          returned_by: string | null
          updated_at: string
          verdict: Database["public"]["Enums"]["rejection_verdict"]
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kit_item_id: string
          notes?: string | null
          plant_id: string
          quantity: number
          returned_by?: string | null
          updated_at?: string
          verdict: Database["public"]["Enums"]["rejection_verdict"]
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kit_item_id?: string
          notes?: string | null
          plant_id?: string
          quantity?: number
          returned_by?: string | null
          updated_at?: string
          verdict?: Database["public"]["Enums"]["rejection_verdict"]
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kit_returns_kit_item_id_fkey"
            columns: ["kit_item_id"]
            isOneToOne: false
            referencedRelation: "kit_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kit_returns_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
      line_rejections: {
        Row: {
          created_at: string
          defect: string
          id: string
          part_id: string | null
          plant_id: string
          production_order_id: string
          quantity: number
          rejected_by: string | null
          rejection_date: string
          remarks: string | null
          reported_by: string | null
          status: string
          updated_at: string
          vendor_id: string | null
          verdict: Database["public"]["Enums"]["rejection_verdict"]
        }
        Insert: {
          created_at?: string
          defect: string
          id?: string
          part_id?: string | null
          plant_id: string
          production_order_id: string
          quantity: number
          rejected_by?: string | null
          rejection_date?: string
          remarks?: string | null
          reported_by?: string | null
          status?: string
          updated_at?: string
          vendor_id?: string | null
          verdict?: Database["public"]["Enums"]["rejection_verdict"]
        }
        Update: {
          created_at?: string
          defect?: string
          id?: string
          part_id?: string | null
          plant_id?: string
          production_order_id?: string
          quantity?: number
          rejected_by?: string | null
          rejection_date?: string
          remarks?: string | null
          reported_by?: string | null
          status?: string
          updated_at?: string
          vendor_id?: string | null
          verdict?: Database["public"]["Enums"]["rejection_verdict"]
        }
        Relationships: [
          {
            foreignKeyName: "line_rejections_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "line_rejections_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "line_rejections_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "line_rejections_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "line_rejections_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      material_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          issued_quantity: number
          notes: string | null
          part_id: string
          plant_id: string
          production_order_id: string | null
          reason: string
          request_number: string
          requested_by: string | null
          requested_quantity: number
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          issued_quantity?: number
          notes?: string | null
          part_id: string
          plant_id: string
          production_order_id?: string | null
          reason: string
          request_number: string
          requested_by?: string | null
          requested_quantity: number
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          issued_quantity?: number
          notes?: string | null
          part_id?: string
          plant_id?: string
          production_order_id?: string | null
          reason?: string
          request_number?: string
          requested_by?: string | null
          requested_quantity?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_requests_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_requests_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_requests_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      npd_benchmarks: {
        Row: {
          attribute: string | null
          competitor_brand: string | null
          competitor_model: string | null
          competitor_value: string | null
          created_at: string
          id: string
          notes: string | null
          our_value: string | null
          project_id: string
          updated_at: string
        }
        Insert: {
          attribute?: string | null
          competitor_brand?: string | null
          competitor_model?: string | null
          competitor_value?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          our_value?: string | null
          project_id: string
          updated_at?: string
        }
        Update: {
          attribute?: string | null
          competitor_brand?: string | null
          competitor_model?: string | null
          competitor_value?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          our_value?: string | null
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "npd_benchmarks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npd_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      npd_bom_materials: {
        Row: {
          created_at: string
          currency: string | null
          description: string | null
          id: string
          notes: string | null
          part_id: string | null
          project_id: string
          proposed_part_code: string | null
          quantity: number
          status: string
          target_price: number | null
          uom: string
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          created_at?: string
          currency?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          part_id?: string | null
          project_id: string
          proposed_part_code?: string | null
          quantity?: number
          status?: string
          target_price?: number | null
          uom?: string
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          created_at?: string
          currency?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          part_id?: string | null
          project_id?: string
          proposed_part_code?: string | null
          quantity?: number
          status?: string
          target_price?: number | null
          uom?: string
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "npd_bom_materials_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "npd_bom_materials_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npd_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "npd_bom_materials_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      npd_projects: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          id: string
          notes: string | null
          owner_id: string | null
          project_code: string
          project_name: string
          stage: Database["public"]["Enums"]["npd_stage"]
          target_launch_date: string | null
          target_part_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          notes?: string | null
          owner_id?: string | null
          project_code: string
          project_name: string
          stage?: Database["public"]["Enums"]["npd_stage"]
          target_launch_date?: string | null
          target_part_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          notes?: string | null
          owner_id?: string | null
          project_code?: string
          project_name?: string
          stage?: Database["public"]["Enums"]["npd_stage"]
          target_launch_date?: string | null
          target_part_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "npd_projects_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "npd_projects_target_part_id_fkey"
            columns: ["target_part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
        ]
      }
      npd_sample_tracking: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          outcome: string | null
          project_id: string
          quantity: number | null
          received_on: string | null
          requested_on: string | null
          sample_round: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          outcome?: string | null
          project_id: string
          quantity?: number | null
          received_on?: string | null
          requested_on?: string | null
          sample_round?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          outcome?: string | null
          project_id?: string
          quantity?: number | null
          received_on?: string | null
          requested_on?: string | null
          sample_round?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "npd_sample_tracking_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "npd_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      part_specifications: {
        Row: {
          changes_description: string | null
          created_at: string
          id: string
          iqc_checklist_url: string | null
          part_id: string
          specification_sheet_url: string | null
          uploaded_by: string | null
          version_number: number
        }
        Insert: {
          changes_description?: string | null
          created_at?: string
          id?: string
          iqc_checklist_url?: string | null
          part_id: string
          specification_sheet_url?: string | null
          uploaded_by?: string | null
          version_number: number
        }
        Update: {
          changes_description?: string | null
          created_at?: string
          id?: string
          iqc_checklist_url?: string | null
          part_id?: string
          specification_sheet_url?: string | null
          uploaded_by?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "part_specifications_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
        ]
      }
      part_vendors: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean | null
          part_id: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean | null
          part_id: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean | null
          part_id?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "part_vendors_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_vendors_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      parts: {
        Row: {
          bom_url: string | null
          category: string
          cbm_per_unit: number | null
          ccl_url: string | null
          created_at: string
          created_by: string | null
          crs_url: string | null
          currency: string | null
          id: string
          iqc_checklist_url: string | null
          is_active: boolean
          last_price_update: string | null
          name: string
          oqc_checklist_url: string | null
          part_code: string
          plant_id: string | null
          pqc_checklist_url: string | null
          source_type: Database["public"]["Enums"]["part_source_type"]
          sourcing_type: string | null
          spec_changes_description: string | null
          spec_version: number
          specification: string | null
          specification_sheet_url: string | null
          supplier_country: string | null
          unit_price: number | null
          uom: string
          updated_at: string
          used_in_reference: string | null
          wi_url: string | null
        }
        Insert: {
          bom_url?: string | null
          category: string
          cbm_per_unit?: number | null
          ccl_url?: string | null
          created_at?: string
          created_by?: string | null
          crs_url?: string | null
          currency?: string | null
          id?: string
          iqc_checklist_url?: string | null
          is_active?: boolean
          last_price_update?: string | null
          name: string
          oqc_checklist_url?: string | null
          part_code: string
          plant_id?: string | null
          pqc_checklist_url?: string | null
          source_type?: Database["public"]["Enums"]["part_source_type"]
          sourcing_type?: string | null
          spec_changes_description?: string | null
          spec_version?: number
          specification?: string | null
          specification_sheet_url?: string | null
          supplier_country?: string | null
          unit_price?: number | null
          uom?: string
          updated_at?: string
          used_in_reference?: string | null
          wi_url?: string | null
        }
        Update: {
          bom_url?: string | null
          category?: string
          cbm_per_unit?: number | null
          ccl_url?: string | null
          created_at?: string
          created_by?: string | null
          crs_url?: string | null
          currency?: string | null
          id?: string
          iqc_checklist_url?: string | null
          is_active?: boolean
          last_price_update?: string | null
          name?: string
          oqc_checklist_url?: string | null
          part_code?: string
          plant_id?: string | null
          pqc_checklist_url?: string | null
          source_type?: Database["public"]["Enums"]["part_source_type"]
          sourcing_type?: string | null
          spec_changes_description?: string | null
          spec_version?: number
          specification?: string | null
          specification_sheet_url?: string | null
          supplier_country?: string | null
          unit_price?: number | null
          uom?: string
          updated_at?: string
          used_in_reference?: string | null
          wi_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parts_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll: {
        Row: {
          allowances: number | null
          basic_salary: number | null
          deductions: number | null
          employee_id: string | null
          gross_salary: number | null
          id: string
          month: number
          net_salary: number | null
          overtime_amount: number | null
          overtime_hours: number | null
          present_days: number | null
          processed_date: string | null
          status: string | null
          total_working_days: number | null
          year: number
        }
        Insert: {
          allowances?: number | null
          basic_salary?: number | null
          deductions?: number | null
          employee_id?: string | null
          gross_salary?: number | null
          id?: string
          month: number
          net_salary?: number | null
          overtime_amount?: number | null
          overtime_hours?: number | null
          present_days?: number | null
          processed_date?: string | null
          status?: string | null
          total_working_days?: number | null
          year: number
        }
        Update: {
          allowances?: number | null
          basic_salary?: number | null
          deductions?: number | null
          employee_id?: string | null
          gross_salary?: number | null
          id?: string
          month?: number
          net_salary?: number | null
          overtime_amount?: number | null
          overtime_hours?: number | null
          present_days?: number | null
          processed_date?: string | null
          status?: string | null
          total_working_days?: number | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_reviews: {
        Row: {
          action_plan: string | null
          areas_for_improvement: string | null
          communication_rating:
            | Database["public"]["Enums"]["performance_rating"]
            | null
          created_at: string | null
          employee_id: string | null
          feedback: string | null
          goals_achieved: string | null
          id: string
          next_review_date: string | null
          overall_rating:
            | Database["public"]["Enums"]["performance_rating"]
            | null
          punctuality_rating:
            | Database["public"]["Enums"]["performance_rating"]
            | null
          review_period_end: string
          review_period_start: string
          reviewer_id: string | null
          teamwork_rating:
            | Database["public"]["Enums"]["performance_rating"]
            | null
          technical_skills_rating:
            | Database["public"]["Enums"]["performance_rating"]
            | null
        }
        Insert: {
          action_plan?: string | null
          areas_for_improvement?: string | null
          communication_rating?:
            | Database["public"]["Enums"]["performance_rating"]
            | null
          created_at?: string | null
          employee_id?: string | null
          feedback?: string | null
          goals_achieved?: string | null
          id?: string
          next_review_date?: string | null
          overall_rating?:
            | Database["public"]["Enums"]["performance_rating"]
            | null
          punctuality_rating?:
            | Database["public"]["Enums"]["performance_rating"]
            | null
          review_period_end: string
          review_period_start: string
          reviewer_id?: string | null
          teamwork_rating?:
            | Database["public"]["Enums"]["performance_rating"]
            | null
          technical_skills_rating?:
            | Database["public"]["Enums"]["performance_rating"]
            | null
        }
        Update: {
          action_plan?: string | null
          areas_for_improvement?: string | null
          communication_rating?:
            | Database["public"]["Enums"]["performance_rating"]
            | null
          created_at?: string | null
          employee_id?: string | null
          feedback?: string | null
          goals_achieved?: string | null
          id?: string
          next_review_date?: string | null
          overall_rating?:
            | Database["public"]["Enums"]["performance_rating"]
            | null
          punctuality_rating?:
            | Database["public"]["Enums"]["performance_rating"]
            | null
          review_period_end?: string
          review_period_start?: string
          reviewer_id?: string | null
          teamwork_rating?:
            | Database["public"]["Enums"]["performance_rating"]
            | null
          technical_skills_rating?:
            | Database["public"]["Enums"]["performance_rating"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "performance_reviews_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      plants: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          code: string
          country: string | null
          created_at: string
          email: string | null
          factory_license_no: string | null
          gstin: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          postal_code: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          code: string
          country?: string | null
          created_at?: string
          email?: string | null
          factory_license_no?: string | null
          gstin?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          code?: string
          country?: string | null
          created_at?: string
          email?: string | null
          factory_license_no?: string | null
          gstin?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pqc_reports: {
        Row: {
          created_at: string
          failed_quantity: number
          id: string
          inspected_at: string
          inspected_by: string | null
          inspected_quantity: number
          notes: string | null
          passed_quantity: number
          plant_id: string
          production_order_id: string
          report_url: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          failed_quantity?: number
          id?: string
          inspected_at?: string
          inspected_by?: string | null
          inspected_quantity: number
          notes?: string | null
          passed_quantity?: number
          plant_id: string
          production_order_id: string
          report_url?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          failed_quantity?: number
          id?: string
          inspected_at?: string
          inspected_by?: string | null
          inspected_quantity?: number
          notes?: string | null
          passed_quantity?: number
          plant_id?: string
          production_order_id?: string
          report_url?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pqc_reports_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pqc_reports_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      production_lines: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          line_type: Database["public"]["Enums"]["production_line_type"]
          location_bay: string | null
          location_building: string | null
          location_floor: string | null
          name: string
          notes: string | null
          plant_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          line_type?: Database["public"]["Enums"]["production_line_type"]
          location_bay?: string | null
          location_building?: string | null
          location_floor?: string | null
          name: string
          notes?: string | null
          plant_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          line_type?: Database["public"]["Enums"]["production_line_type"]
          location_bay?: string | null
          location_building?: string | null
          location_floor?: string | null
          name?: string
          notes?: string | null
          plant_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_lines_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
      production_order_lines: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          part_id: string | null
          production_line_id: string
          production_order_id: string
          quantity: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          part_id?: string | null
          production_line_id: string
          production_order_id: string
          quantity?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          part_id?: string | null
          production_line_id?: string
          production_order_id?: string
          quantity?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_order_lines_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_order_lines_production_line_id_fkey"
            columns: ["production_line_id"]
            isOneToOne: false
            referencedRelation: "production_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_order_lines_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      production_orders: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          part_id: string
          planned_date: string
          plant_id: string
          produced_quantity: number
          production_schedule_id: string | null
          projection_id: string | null
          quantity: number
          started_at: string | null
          status: Database["public"]["Enums"]["schedule_status"]
          updated_at: string
          voucher_number: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          part_id: string
          planned_date?: string
          plant_id: string
          produced_quantity?: number
          production_schedule_id?: string | null
          projection_id?: string | null
          quantity: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["schedule_status"]
          updated_at?: string
          voucher_number: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          part_id?: string
          planned_date?: string
          plant_id?: string
          produced_quantity?: number
          production_schedule_id?: string | null
          projection_id?: string | null
          quantity?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["schedule_status"]
          updated_at?: string
          voucher_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_orders_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_production_schedule_id_fkey"
            columns: ["production_schedule_id"]
            isOneToOne: false
            referencedRelation: "production_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_projection_id_fkey"
            columns: ["projection_id"]
            isOneToOne: false
            referencedRelation: "projections"
            referencedColumns: ["id"]
          },
        ]
      }
      production_schedules: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          part_id: string
          plant_id: string
          production_line_id: string | null
          projection_id: string
          quantity: number
          scheduled_date: string
          status: Database["public"]["Enums"]["schedule_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          part_id: string
          plant_id: string
          production_line_id?: string | null
          projection_id: string
          quantity: number
          scheduled_date: string
          status?: Database["public"]["Enums"]["schedule_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          part_id?: string
          plant_id?: string
          production_line_id?: string | null
          projection_id?: string
          quantity?: number
          scheduled_date?: string
          status?: Database["public"]["Enums"]["schedule_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_schedules_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_schedules_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_schedules_production_line_id_fkey"
            columns: ["production_line_id"]
            isOneToOne: false
            referencedRelation: "production_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_schedules_projection_id_fkey"
            columns: ["projection_id"]
            isOneToOne: false
            referencedRelation: "projections"
            referencedColumns: ["id"]
          },
        ]
      }
      production_serial_numbers: {
        Row: {
          created_at: string
          id: string
          production_order_id: string
          serial_number: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          production_order_id: string
          serial_number: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          production_order_id?: string
          serial_number?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_serial_numbers_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      projections: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          month: string
          notes: string | null
          part_id: string
          produced_quantity: number
          quantity: number
          scheduled_quantity: number
          status: string
          updated_at: string
          vouchered_quantity: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          month: string
          notes?: string | null
          part_id: string
          produced_quantity?: number
          quantity: number
          scheduled_quantity?: number
          status?: string
          updated_at?: string
          vouchered_quantity?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          month?: string
          notes?: string | null
          part_id?: string
          produced_quantity?: number
          quantity?: number
          scheduled_quantity?: number
          status?: string
          updated_at?: string
          vouchered_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "projections_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projections_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          created_at: string
          id: string
          line_total: number | null
          part_id: string
          purchase_order_id: string
          quantity: number
          received_quantity: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          line_total?: number | null
          part_id: string
          purchase_order_id: string
          quantity: number
          received_quantity?: number
          unit_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number | null
          part_id?: string
          purchase_order_id?: string
          quantity?: number
          received_quantity?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          currency: string
          id: string
          is_import: boolean
          notes: string | null
          origin_country: string | null
          plant_id: string
          po_date: string
          po_number: string
          projection_id: string | null
          promised_delivery_date: string | null
          promised_loading_date: string | null
          status: Database["public"]["Enums"]["po_status"]
          total_amount: number
          updated_at: string
          vendor_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          is_import?: boolean
          notes?: string | null
          origin_country?: string | null
          plant_id: string
          po_date?: string
          po_number: string
          projection_id?: string | null
          promised_delivery_date?: string | null
          promised_loading_date?: string | null
          status?: Database["public"]["Enums"]["po_status"]
          total_amount?: number
          updated_at?: string
          vendor_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          is_import?: boolean
          notes?: string | null
          origin_country?: string | null
          plant_id?: string
          po_date?: string
          po_number?: string
          projection_id?: string | null
          promised_delivery_date?: string | null
          promised_loading_date?: string | null
          status?: Database["public"]["Enums"]["po_status"]
          total_amount?: number
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_projection_id_fkey"
            columns: ["projection_id"]
            isOneToOne: false
            referencedRelation: "projections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      rca_reports: {
        Row: {
          capa_id: string
          conclusion: string | null
          created_at: string
          created_by: string | null
          id: string
          report_url: string | null
          updated_at: string
          why1: string | null
          why2: string | null
          why3: string | null
          why4: string | null
          why5: string | null
        }
        Insert: {
          capa_id: string
          conclusion?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          report_url?: string | null
          updated_at?: string
          why1?: string | null
          why2?: string | null
          why3?: string | null
          why4?: string | null
          why5?: string | null
        }
        Update: {
          capa_id?: string
          conclusion?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          report_url?: string | null
          updated_at?: string
          why1?: string | null
          why2?: string | null
          why3?: string | null
          why4?: string | null
          why5?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rca_reports_capa_id_fkey"
            columns: ["capa_id"]
            isOneToOne: false
            referencedRelation: "capa"
            referencedColumns: ["id"]
          },
        ]
      }
      shortages: {
        Row: {
          available_quantity: number
          created_at: string
          id: string
          needed_on: string
          part_id: string
          plant_id: string
          production_order_id: string | null
          production_schedule_id: string | null
          purchase_order_item_id: string | null
          required_quantity: number
          shortage_quantity: number
          status: string
          updated_at: string
        }
        Insert: {
          available_quantity?: number
          created_at?: string
          id?: string
          needed_on: string
          part_id: string
          plant_id: string
          production_order_id?: string | null
          production_schedule_id?: string | null
          purchase_order_item_id?: string | null
          required_quantity: number
          shortage_quantity: number
          status?: string
          updated_at?: string
        }
        Update: {
          available_quantity?: number
          created_at?: string
          id?: string
          needed_on?: string
          part_id?: string
          plant_id?: string
          production_order_id?: string | null
          production_schedule_id?: string | null
          purchase_order_item_id?: string | null
          required_quantity?: number
          shortage_quantity?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shortages_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shortages_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shortages_po_item_fkey"
            columns: ["purchase_order_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shortages_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shortages_production_schedule_id_fkey"
            columns: ["production_schedule_id"]
            isOneToOne: false
            referencedRelation: "production_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      skills: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          id: string
          skill_name: string
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          id?: string
          skill_name: string
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          skill_name?: string
        }
        Relationships: []
      }
      spare_order_items: {
        Row: {
          created_at: string
          id: string
          issued_quantity: number
          part_id: string
          quantity: number
          spare_order_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          issued_quantity?: number
          part_id: string
          quantity: number
          spare_order_id: string
        }
        Update: {
          created_at?: string
          id?: string
          issued_quantity?: number
          part_id?: string
          quantity?: number
          spare_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spare_order_items_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spare_order_items_spare_order_id_fkey"
            columns: ["spare_order_id"]
            isOneToOne: false
            referencedRelation: "spare_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      spare_orders: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          id: string
          notes: string | null
          order_date: string
          plant_id: string
          spare_order_number: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          plant_id: string
          spare_order_number: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          plant_id?: string
          spare_order_number?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "spare_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spare_orders_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_balance: {
        Row: {
          id: string
          location_id: string
          min_stock: number | null
          part_id: string
          plant_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          id?: string
          location_id: string
          min_stock?: number | null
          part_id: string
          plant_id: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          id?: string
          location_id?: string
          min_stock?: number | null
          part_id?: string
          plant_id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_balance_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_balance_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_balance_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_holds: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          location_id: string
          needed_on: string
          part_id: string
          plant_id: string
          production_order_id: string | null
          quantity: number
          reference_id: string | null
          reference_type: string | null
          released_at: string | null
          source: Database["public"]["Enums"]["hold_source"]
          status: Database["public"]["Enums"]["hold_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          location_id: string
          needed_on: string
          part_id: string
          plant_id: string
          production_order_id?: string | null
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          released_at?: string | null
          source: Database["public"]["Enums"]["hold_source"]
          status?: Database["public"]["Enums"]["hold_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          location_id?: string
          needed_on?: string
          part_id?: string
          plant_id?: string
          production_order_id?: string | null
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          released_at?: string | null
          source?: Database["public"]["Enums"]["hold_source"]
          status?: Database["public"]["Enums"]["hold_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_holds_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_holds_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_holds_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_holds_production_order_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_ledger: {
        Row: {
          balance_after: number
          created_at: string
          created_by: string | null
          id: string
          location_id: string
          movement_type: string
          notes: string | null
          part_id: string
          plant_id: string
          qty_delta: number
          reason_code: string | null
          reference_id: string | null
          reference_number: string | null
          reference_type: string | null
        }
        Insert: {
          balance_after: number
          created_at?: string
          created_by?: string | null
          id?: string
          location_id: string
          movement_type: string
          notes?: string | null
          part_id: string
          plant_id: string
          qty_delta: number
          reason_code?: string | null
          reference_id?: string | null
          reference_number?: string | null
          reference_type?: string | null
        }
        Update: {
          balance_after?: number
          created_at?: string
          created_by?: string | null
          id?: string
          location_id?: string
          movement_type?: string
          notes?: string | null
          part_id?: string
          plant_id?: string
          qty_delta?: number
          reason_code?: string | null
          reference_id?: string | null
          reference_number?: string | null
          reference_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_ledger_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_ledger_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_ledger_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_locations: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          location_type: Database["public"]["Enums"]["stock_location_type"]
          name: string
          plant_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          location_type: Database["public"]["Enums"]["stock_location_type"]
          name: string
          plant_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          location_type?: Database["public"]["Enums"]["stock_location_type"]
          name?: string
          plant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_locations_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
      training_programs: {
        Row: {
          cost: number | null
          created_at: string | null
          description: string | null
          duration_hours: number | null
          end_date: string | null
          id: string
          max_participants: number | null
          program_name: string
          start_date: string | null
          trainer_name: string | null
        }
        Insert: {
          cost?: number | null
          created_at?: string | null
          description?: string | null
          duration_hours?: number | null
          end_date?: string | null
          id?: string
          max_participants?: number | null
          program_name: string
          start_date?: string | null
          trainer_name?: string | null
        }
        Update: {
          cost?: number | null
          created_at?: string | null
          description?: string | null
          duration_hours?: number | null
          end_date?: string | null
          id?: string
          max_participants?: number | null
          program_name?: string
          start_date?: string | null
          trainer_name?: string | null
        }
        Relationships: []
      }
      user_accounts: {
        Row: {
          created_at: string
          created_by: string | null
          default_plant_id: string | null
          department_id: string | null
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          password_hash: string | null
          role: string
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          default_plant_id?: string | null
          department_id?: string | null
          email: string
          full_name?: string | null
          id: string
          is_active?: boolean
          password_hash?: string | null
          role?: string
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_plant_id?: string | null
          department_id?: string | null
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          password_hash?: string | null
          role?: string
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_accounts_default_plant_id_fkey"
            columns: ["default_plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_accounts_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_departments: {
        Row: {
          department_id: string
          granted_at: string
          granted_by: string | null
          user_id: string
        }
        Insert: {
          department_id: string
          granted_at?: string
          granted_by?: string | null
          user_id: string
        }
        Update: {
          department_id?: string
          granted_at?: string
          granted_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_departments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_departments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_plants: {
        Row: {
          granted_at: string
          granted_by: string | null
          plant_id: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          plant_id: string
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          plant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_plants_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_plants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          address: string | null
          bank_account_number: string | null
          contact_number: string | null
          contact_person_name: string | null
          created_at: string
          created_by: string | null
          email: string | null
          gst_certificate_url: string | null
          gst_number: string | null
          id: string
          ifsc_code: string | null
          is_active: boolean
          msme_certificate_url: string | null
          name: string
          updated_at: string
          vendor_code: string
        }
        Insert: {
          address?: string | null
          bank_account_number?: string | null
          contact_number?: string | null
          contact_person_name?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          gst_certificate_url?: string | null
          gst_number?: string | null
          id?: string
          ifsc_code?: string | null
          is_active?: boolean
          msme_certificate_url?: string | null
          name: string
          updated_at?: string
          vendor_code: string
        }
        Update: {
          address?: string | null
          bank_account_number?: string | null
          contact_number?: string | null
          contact_person_name?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          gst_certificate_url?: string | null
          gst_number?: string | null
          id?: string
          ifsc_code?: string | null
          is_active?: boolean
          msme_certificate_url?: string | null
          name?: string
          updated_at?: string
          vendor_code?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_kit_feedback: {
        Args: { p_feedback_id: string; p_remarks?: string }
        Returns: string
      }
      admin_list_active_employee_salaries: {
        Args: never
        Returns: {
          employee_code: string
          first_name: string
          id: string
          last_name: string
          salary: number
        }[]
      }
      auth_is_admin: { Args: never; Returns: boolean }
      auth_my_plants: {
        Args: never
        Returns: {
          is_default: boolean
          plant_code: string
          plant_id: string
          plant_name: string
        }[]
      }
      auth_user_can_access_module: {
        Args: { module_name: string }
        Returns: boolean
      }
      auth_user_in_department: { Args: { dept_name: string }; Returns: boolean }
      auth_user_in_plant: { Args: { p_plant_id: string }; Returns: boolean }
      delete_production_schedule_cascade: {
        Args: { p_schedule_id: string }
        Returns: undefined
      }
      generate_dash_fo_number: { Args: never; Returns: string }
      generate_dash_so_number: { Args: never; Returns: string }
      generate_dash_ticket_number: { Args: never; Returns: string }
      get_dash_customer_finance: {
        Args: { p_customer_id: string }
        Returns: {
          bank_account_number: string
          bank_ifsc: string
          bank_name: string
          cancelled_cheque_url: string
          gst_certificate_url: string
          id: string
          msme_certificate_url: string
          msme_number: string
          pan_number: string
        }[]
      }
      get_employee_sensitive: {
        Args: { p_employee_id: string }
        Returns: {
          aadhar_number: string
          bank_account_number: string
          bank_name: string
          date_of_birth: string
          esic_number: string
          id: string
          ifsc_code: string
          pan_number: string
          phone_number: string
          salary: number
        }[]
      }
      get_my_profile: {
        Args: never
        Returns: {
          created_at: string
          department_id: string
          department_name: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          role: string
          updated_at: string
        }[]
      }
      get_plant_sensitive: {
        Args: { p_plant_id: string }
        Returns: {
          email: string
          factory_license_no: string
          gstin: string
          id: string
          phone: string
        }[]
      }
      get_user_departments: {
        Args: { p_user_id: string }
        Returns: {
          department_id: string
          is_primary: boolean
          name: string
        }[]
      }
      get_user_plants: {
        Args: { p_user_id: string }
        Returns: {
          code: string
          is_default: boolean
          name: string
          plant_id: string
        }[]
      }
      has_role: { Args: { _module?: string }; Returns: boolean }
      in_plant: { Args: { _plant_id: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      list_departments_with_modules: {
        Args: never
        Returns: {
          department_id: string
          modules: string[]
          name: string
        }[]
      }
      list_user_accounts_for_admin: {
        Args: never
        Returns: {
          all_department_names: string
          created_at: string
          department_id: string
          department_name: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          role: string
          updated_at: string
          username: string
        }[]
      }
      next_doc_number: {
        Args: { _prefix: string; _seq: unknown }
        Returns: string
      }
      next_po_number: { Args: never; Returns: string }
      post_stock_movement: {
        Args: {
          p_location_id: string
          p_movement_type: string
          p_notes?: string
          p_part_id: string
          p_plant_id: string
          p_qty_delta: number
          p_reason_code?: string
          p_reference_id?: string
          p_reference_number?: string
          p_reference_type?: string
        }
        Returns: Json
      }
      post_stock_movements: { Args: { p_movements: Json }; Returns: Json }
      reject_kit_feedback: {
        Args: { p_feedback_id: string; p_remarks: string }
        Returns: undefined
      }
      set_department_modules: {
        Args: { p_department_id: string; p_modules: string[] }
        Returns: undefined
      }
      set_user_departments: {
        Args: { p_department_ids: string[]; p_user_id: string }
        Returns: undefined
      }
      set_user_plants: {
        Args: { p_plant_ids: string[]; p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      capa_status: "OPEN" | "SUBMITTED" | "ACCEPTED" | "REJECTED" | "CLOSED"
      complaint_status:
        | "OPEN"
        | "UNDER_REVIEW"
        | "PARTS_SENT"
        | "RESOLVED"
        | "CLOSED"
      container_status:
        | "ORDERED"
        | "LOADED"
        | "SHIPPED"
        | "IN_TRANSIT"
        | "INDIA_CUSTOM"
        | "ARRIVED"
        | "AT_FACTORY"
      dash_artwork_type:
        | "box_artwork"
        | "product_artwork"
        | "marketing_creative"
      dash_customer_type:
        | "Distributor"
        | "Dealer"
        | "Retailer"
        | "Institutional"
      dash_dispatch_status: "Pending" | "Dispatched" | "Delivered"
      dash_factory_order_status:
        | "Draft"
        | "Ordered"
        | "In Production"
        | "Dispatched"
        | "Received"
        | "QC Pending"
        | "QC Done"
      dash_movement_type:
        | "GRN_RECEIPT"
        | "SALES_DISPATCH"
        | "DAMAGE"
        | "RETURN"
        | "ADJUSTMENT"
        | "TRANSFER"
      dash_payment_status: "Pending" | "Partial" | "Paid"
      dash_product_category:
        | "Party Speaker"
        | "Tower Speaker"
        | "Soundbar"
        | "Multimedia Speaker"
        | "Portable Speaker"
        | "Home Theatre"
        | "Subwoofer"
        | "Other"
        | "Accessories"
      dash_product_status:
        | "Active"
        | "Discontinued"
        | "Development"
        | "Ready for Production"
      dash_qc_status: "Pending" | "Passed" | "Failed" | "Partial"
      dash_repair_status:
        | "Open"
        | "Assigned"
        | "In Progress"
        | "Awaiting Parts"
        | "Repaired"
        | "Replaced"
        | "Closed"
      dash_spare_dispatch_type: "Service" | "Customer" | "Warehouse"
      dispatch_status:
        | "DRAFT"
        | "PACKED"
        | "GATE_OUT"
        | "DELIVERED"
        | "CANCELLED"
      employee_status: "active" | "inactive" | "terminated" | "on_leave"
      grn_status:
        | "DRAFT"
        | "IQC_PENDING"
        | "IQC_DONE"
        | "STORE_CONFIRMED"
        | "CLOSED"
      hold_source: "VOUCHER" | "SPARE" | "DASH" | "SAMPLE" | "REWORK"
      hold_status: "ACTIVE" | "ISSUED" | "RELEASED"
      iqc_outcome: "PENDING" | "ACCEPTED" | "REJECTED" | "PARTIAL"
      kit_feedback_status: "PENDING" | "ACCEPTED" | "REJECTED"
      npd_stage:
        | "CONCEPT"
        | "DESIGN"
        | "BOM"
        | "SAMPLE"
        | "VALIDATION"
        | "LAUNCHED"
        | "DROPPED"
      part_source_type:
        | "PURCHASED"
        | "ASSEMBLED_STOCKED"
        | "ASSEMBLED_INLINE"
        | "FINISHED_GOOD"
      performance_rating:
        | "excellent"
        | "good"
        | "satisfactory"
        | "needs_improvement"
        | "unsatisfactory"
      po_status:
        | "DRAFT"
        | "PENDING_APPROVAL"
        | "APPROVED"
        | "PARTIALLY_RECEIVED"
        | "RECEIVED"
        | "CANCELLED"
      production_line_type: "LINE" | "SUB_ASSEMBLY"
      rejection_verdict: "DAMAGED" | "FAULTY" | "USABLE"
      schedule_status:
        | "PLANNED"
        | "KIT_PREPARED"
        | "KIT_SENT"
        | "IN_PRODUCTION"
        | "COMPLETED"
        | "OQC_PASSED"
        | "OQC_FAILED"
        | "CANCELLED"
      skill_level: "beginner" | "intermediate" | "advanced" | "expert"
      stock_location_type: "STORE" | "QUARANTINE" | "REJECT"
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
      capa_status: ["OPEN", "SUBMITTED", "ACCEPTED", "REJECTED", "CLOSED"],
      complaint_status: [
        "OPEN",
        "UNDER_REVIEW",
        "PARTS_SENT",
        "RESOLVED",
        "CLOSED",
      ],
      container_status: [
        "ORDERED",
        "LOADED",
        "SHIPPED",
        "IN_TRANSIT",
        "INDIA_CUSTOM",
        "ARRIVED",
        "AT_FACTORY",
      ],
      dash_artwork_type: [
        "box_artwork",
        "product_artwork",
        "marketing_creative",
      ],
      dash_customer_type: [
        "Distributor",
        "Dealer",
        "Retailer",
        "Institutional",
      ],
      dash_dispatch_status: ["Pending", "Dispatched", "Delivered"],
      dash_factory_order_status: [
        "Draft",
        "Ordered",
        "In Production",
        "Dispatched",
        "Received",
        "QC Pending",
        "QC Done",
      ],
      dash_movement_type: [
        "GRN_RECEIPT",
        "SALES_DISPATCH",
        "DAMAGE",
        "RETURN",
        "ADJUSTMENT",
        "TRANSFER",
      ],
      dash_payment_status: ["Pending", "Partial", "Paid"],
      dash_product_category: [
        "Party Speaker",
        "Tower Speaker",
        "Soundbar",
        "Multimedia Speaker",
        "Portable Speaker",
        "Home Theatre",
        "Subwoofer",
        "Other",
        "Accessories",
      ],
      dash_product_status: [
        "Active",
        "Discontinued",
        "Development",
        "Ready for Production",
      ],
      dash_qc_status: ["Pending", "Passed", "Failed", "Partial"],
      dash_repair_status: [
        "Open",
        "Assigned",
        "In Progress",
        "Awaiting Parts",
        "Repaired",
        "Replaced",
        "Closed",
      ],
      dash_spare_dispatch_type: ["Service", "Customer", "Warehouse"],
      dispatch_status: [
        "DRAFT",
        "PACKED",
        "GATE_OUT",
        "DELIVERED",
        "CANCELLED",
      ],
      employee_status: ["active", "inactive", "terminated", "on_leave"],
      grn_status: [
        "DRAFT",
        "IQC_PENDING",
        "IQC_DONE",
        "STORE_CONFIRMED",
        "CLOSED",
      ],
      hold_source: ["VOUCHER", "SPARE", "DASH", "SAMPLE", "REWORK"],
      hold_status: ["ACTIVE", "ISSUED", "RELEASED"],
      iqc_outcome: ["PENDING", "ACCEPTED", "REJECTED", "PARTIAL"],
      kit_feedback_status: ["PENDING", "ACCEPTED", "REJECTED"],
      npd_stage: [
        "CONCEPT",
        "DESIGN",
        "BOM",
        "SAMPLE",
        "VALIDATION",
        "LAUNCHED",
        "DROPPED",
      ],
      part_source_type: [
        "PURCHASED",
        "ASSEMBLED_STOCKED",
        "ASSEMBLED_INLINE",
        "FINISHED_GOOD",
      ],
      performance_rating: [
        "excellent",
        "good",
        "satisfactory",
        "needs_improvement",
        "unsatisfactory",
      ],
      po_status: [
        "DRAFT",
        "PENDING_APPROVAL",
        "APPROVED",
        "PARTIALLY_RECEIVED",
        "RECEIVED",
        "CANCELLED",
      ],
      production_line_type: ["LINE", "SUB_ASSEMBLY"],
      rejection_verdict: ["DAMAGED", "FAULTY", "USABLE"],
      schedule_status: [
        "PLANNED",
        "KIT_PREPARED",
        "KIT_SENT",
        "IN_PRODUCTION",
        "COMPLETED",
        "OQC_PASSED",
        "OQC_FAILED",
        "CANCELLED",
      ],
      skill_level: ["beginner", "intermediate", "advanced", "expert"],
      stock_location_type: ["STORE", "QUARANTINE", "REJECT"],
    },
  },
} as const
