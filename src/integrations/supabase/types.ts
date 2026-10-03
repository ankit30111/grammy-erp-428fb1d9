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
          issue_mode: string
          notes: string | null
          parent_part_id: string
          quantity: number | null
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
          issue_mode?: string
          notes?: string | null
          parent_part_id: string
          quantity?: number | null
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
          issue_mode?: string
          notes?: string | null
          parent_part_id?: string
          quantity?: number | null
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
            foreignKeyName: "bom_child_part_id_fkey"
            columns: ["child_part_id"]
            isOneToOne: false
            referencedRelation: "store_receiving_variances"
            referencedColumns: ["part_id"]
          },
          {
            foreignKeyName: "bom_parent_part_id_fkey"
            columns: ["parent_part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_parent_part_id_fkey"
            columns: ["parent_part_id"]
            isOneToOne: false
            referencedRelation: "store_receiving_variances"
            referencedColumns: ["part_id"]
          },
        ]
      }
      bom_change_requests: {
        Row: {
          id: string
          lines: Json
          parent_part_id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string
          submitted_by: string
        }
        Insert: {
          id?: string
          lines: Json
          parent_part_id: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          submitted_by?: string
        }
        Update: {
          id?: string
          lines?: Json
          parent_part_id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          submitted_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "bom_change_requests_parent_part_id_fkey"
            columns: ["parent_part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_change_requests_parent_part_id_fkey"
            columns: ["parent_part_id"]
            isOneToOne: false
            referencedRelation: "store_receiving_variances"
            referencedColumns: ["part_id"]
          },
        ]
      }
      brand_sync_issues: {
        Row: {
          brand: string | null
          created_at: string
          id: number
          kind: string
          message: string
          part_code: string | null
          part_id: string | null
        }
        Insert: {
          brand?: string | null
          created_at?: string
          id?: number
          kind: string
          message: string
          part_code?: string | null
          part_id?: string | null
        }
        Update: {
          brand?: string | null
          created_at?: string
          id?: number
          kind?: string
          message?: string
          part_code?: string | null
          part_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_sync_issues_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_sync_issues_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "store_receiving_variances"
            referencedColumns: ["part_id"]
          },
        ]
      }
      brands: {
        Row: {
          created_at: string
          is_active: boolean
          letter: string
          name: string
        }
        Insert: {
          created_at?: string
          is_active?: boolean
          letter: string
          name: string
        }
        Update: {
          created_at?: string
          is_active?: boolean
          letter?: string
          name?: string
        }
        Relationships: []
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
            foreignKeyName: "capa_grn_item_id_fkey"
            columns: ["grn_item_id"]
            isOneToOne: false
            referencedRelation: "store_receiving_variances"
            referencedColumns: ["grn_item_id"]
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
            foreignKeyName: "capa_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "store_receiving_variances"
            referencedColumns: ["part_id"]
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
            referencedRelation: "store_receiving_variances"
            referencedColumns: ["vendor_id"]
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
          {
            foreignKeyName: "container_materials_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "store_receiving_variances"
            referencedColumns: ["part_id"]
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
            foreignKeyName: "customer_complaint_parts_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "store_receiving_variances"
            referencedColumns: ["part_id"]
          },
          {
            foreignKeyName: "customer_complaint_parts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "store_receiving_variances"
            referencedColumns: ["vendor_id"]
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
            foreignKeyName: "customer_complaints_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "store_receiving_variances"
            referencedColumns: ["part_id"]
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
          approval_status: string
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
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          approval_status?: string
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
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          submitted_by?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          approval_status?: string
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
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          submitted_by?: string | null
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
          email: string | null
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
          email?: string | null
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
          email?: string | null
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
            foreignKeyName: "finished_goods_inventory_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "store_receiving_variances"
            referencedColumns: ["part_id"]
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
            foreignKeyName: "grn_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "store_receiving_variances"
            referencedColumns: ["purchase_order_id"]
          },
          {
            foreignKeyName: "grn_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "store_receiving_variances"
            referencedColumns: ["vendor_id"]
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
          received_in_uom: number | null
          received_quantity: number
          received_uom: string | null
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
          received_in_uom?: number | null
          received_quantity: number
          received_uom?: string | null
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
          received_in_uom?: number | null
          received_quantity?: number
          received_uom?: string | null
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
            foreignKeyName: "grn_items_grn_id_fkey"
            columns: ["grn_id"]
            isOneToOne: false
            referencedRelation: "store_receiving_variances"
            referencedColumns: ["grn_id"]
          },
          {
            foreignKeyName: "grn_items_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grn_items_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "store_receiving_variances"
            referencedColumns: ["part_id"]
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
      grn_variance_resolutions: {
        Row: {
          claim_quantity: number | null
          counted_quantity: number
          created_at: string
          expected_quantity: number
          grn_item_id: string
          id: string
          plant_id: string
          remarks: string
          resolution: Database["public"]["Enums"]["variance_resolution"]
          resolved_at: string
          resolved_by: string | null
          stock_ledger_id: string | null
          updated_at: string
          variance: number | null
        }
        Insert: {
          claim_quantity?: number | null
          counted_quantity: number
          created_at?: string
          expected_quantity: number
          grn_item_id: string
          id?: string
          plant_id: string
          remarks: string
          resolution: Database["public"]["Enums"]["variance_resolution"]
          resolved_at?: string
          resolved_by?: string | null
          stock_ledger_id?: string | null
          updated_at?: string
          variance?: number | null
        }
        Update: {
          claim_quantity?: number | null
          counted_quantity?: number
          created_at?: string
          expected_quantity?: number
          grn_item_id?: string
          id?: string
          plant_id?: string
          remarks?: string
          resolution?: Database["public"]["Enums"]["variance_resolution"]
          resolved_at?: string
          resolved_by?: string | null
          stock_ledger_id?: string | null
          updated_at?: string
          variance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "grn_variance_resolutions_grn_item_id_fkey"
            columns: ["grn_item_id"]
            isOneToOne: true
            referencedRelation: "grn_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grn_variance_resolutions_grn_item_id_fkey"
            columns: ["grn_item_id"]
            isOneToOne: true
            referencedRelation: "store_receiving_variances"
            referencedColumns: ["grn_item_id"]
          },
          {
            foreignKeyName: "grn_variance_resolutions_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grn_variance_resolutions_stock_ledger_id_fkey"
            columns: ["stock_ledger_id"]
            isOneToOne: false
            referencedRelation: "stock_ledger"
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
          {
            foreignKeyName: "import_containers_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "store_receiving_variances"
            referencedColumns: ["purchase_order_id"]
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
            foreignKeyName: "kit_feedback_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "store_receiving_variances"
            referencedColumns: ["part_id"]
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
          {
            foreignKeyName: "kit_items_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "store_receiving_variances"
            referencedColumns: ["part_id"]
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
            foreignKeyName: "line_rejections_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "store_receiving_variances"
            referencedColumns: ["part_id"]
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
            referencedRelation: "store_receiving_variances"
            referencedColumns: ["vendor_id"]
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
      material_movement_log: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          movement_type: string
          notes: string | null
          part_id: string
          quantity: number | null
          reference_id: string | null
          reference_number: string | null
          reference_type: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type: string
          notes?: string | null
          part_id: string
          quantity?: number | null
          reference_id?: string | null
          reference_number?: string | null
          reference_type?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type?: string
          notes?: string | null
          part_id?: string
          quantity?: number | null
          reference_id?: string | null
          reference_number?: string | null
          reference_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_movement_log_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_movement_log_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "store_receiving_variances"
            referencedColumns: ["part_id"]
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
            foreignKeyName: "material_requests_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "store_receiving_variances"
            referencedColumns: ["part_id"]
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
      part_brands: {
        Row: {
          brand: string
          created_at: string
          created_by: string | null
          part_id: string
        }
        Insert: {
          brand: string
          created_at?: string
          created_by?: string | null
          part_id: string
        }
        Update: {
          brand?: string
          created_at?: string
          created_by?: string | null
          part_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "part_brands_brand_fkey"
            columns: ["brand"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["letter"]
          },
          {
            foreignKeyName: "part_brands_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_brands_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "store_receiving_variances"
            referencedColumns: ["part_id"]
          },
        ]
      }
      part_categories: {
        Row: {
          created_at: string
          is_active: boolean
          kind: Database["public"]["Enums"]["part_source_type"] | null
          name: string
          next_sequence: number
          prefix: string
          tier: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["part_source_type"] | null
          name: string
          next_sequence?: number
          prefix: string
          tier: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["part_source_type"] | null
          name?: string
          next_sequence?: number
          prefix?: string
          tier?: string
          updated_at?: string
        }
        Relationships: []
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
          {
            foreignKeyName: "part_specifications_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "store_receiving_variances"
            referencedColumns: ["part_id"]
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
            foreignKeyName: "part_vendors_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "store_receiving_variances"
            referencedColumns: ["part_id"]
          },
          {
            foreignKeyName: "part_vendors_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "store_receiving_variances"
            referencedColumns: ["vendor_id"]
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
          approval_status: string
          brand: string | null
          brand_relevant: boolean
          branded_from: string | null
          branding_required: boolean
          category: string
          cbm_per_unit: number | null
          cir_sheet_url: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          id: string
          iqc_checklist_url: string | null
          is_active: boolean
          last_price_update: string | null
          made_in_house: boolean
          name: string
          oqc_checklist_url: string | null
          part_code: string
          plant_id: string | null
          plm_product_id: string | null
          pqc_checklist_url: string | null
          purchase_factor: number
          purchase_uom: string | null
          rejection_reason: string | null
          remarks: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_type: Database["public"]["Enums"]["part_source_type"]
          sourcing_type: string | null
          spec_version: number
          specification: string | null
          specification_sheet_url: string | null
          submitted_by: string | null
          supplier_country: string | null
          unit_price: number | null
          uom: string
          updated_at: string
          used_in_reference: string | null
        }
        Insert: {
          approval_status?: string
          brand?: string | null
          brand_relevant?: boolean
          branded_from?: string | null
          branding_required?: boolean
          category: string
          cbm_per_unit?: number | null
          cir_sheet_url?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          id?: string
          iqc_checklist_url?: string | null
          is_active?: boolean
          last_price_update?: string | null
          made_in_house?: boolean
          name: string
          oqc_checklist_url?: string | null
          part_code: string
          plant_id?: string | null
          plm_product_id?: string | null
          pqc_checklist_url?: string | null
          purchase_factor?: number
          purchase_uom?: string | null
          rejection_reason?: string | null
          remarks?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_type?: Database["public"]["Enums"]["part_source_type"]
          sourcing_type?: string | null
          spec_version?: number
          specification?: string | null
          specification_sheet_url?: string | null
          submitted_by?: string | null
          supplier_country?: string | null
          unit_price?: number | null
          uom?: string
          updated_at?: string
          used_in_reference?: string | null
        }
        Update: {
          approval_status?: string
          brand?: string | null
          brand_relevant?: boolean
          branded_from?: string | null
          branding_required?: boolean
          category?: string
          cbm_per_unit?: number | null
          cir_sheet_url?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          id?: string
          iqc_checklist_url?: string | null
          is_active?: boolean
          last_price_update?: string | null
          made_in_house?: boolean
          name?: string
          oqc_checklist_url?: string | null
          part_code?: string
          plant_id?: string | null
          plm_product_id?: string | null
          pqc_checklist_url?: string | null
          purchase_factor?: number
          purchase_uom?: string | null
          rejection_reason?: string | null
          remarks?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_type?: Database["public"]["Enums"]["part_source_type"]
          sourcing_type?: string | null
          spec_version?: number
          specification?: string | null
          specification_sheet_url?: string | null
          submitted_by?: string | null
          supplier_country?: string | null
          unit_price?: number | null
          uom?: string
          updated_at?: string
          used_in_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parts_brand_fkey"
            columns: ["brand"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["letter"]
          },
          {
            foreignKeyName: "parts_branded_from_fkey"
            columns: ["branded_from"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parts_branded_from_fkey"
            columns: ["branded_from"]
            isOneToOne: false
            referencedRelation: "store_receiving_variances"
            referencedColumns: ["part_id"]
          },
          {
            foreignKeyName: "parts_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parts_plm_product_id_fkey"
            columns: ["plm_product_id"]
            isOneToOne: false
            referencedRelation: "plm_catch_up"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "parts_plm_product_id_fkey"
            columns: ["plm_product_id"]
            isOneToOne: false
            referencedRelation: "plm_products"
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
      plm_deliverable_template: {
        Row: {
          key: string
          label: string
          sort: number
          stage: number
        }
        Insert: {
          key: string
          label: string
          sort: number
          stage: number
        }
        Update: {
          key?: string
          label?: string
          sort?: number
          stage?: number
        }
        Relationships: []
      }
      plm_deliverables: {
        Row: {
          due_date: string | null
          file_url: string | null
          id: string
          key: string
          note: string | null
          owner: string | null
          product_id: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          due_date?: string | null
          file_url?: string | null
          id?: string
          key: string
          note?: string | null
          owner?: string | null
          product_id: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          due_date?: string | null
          file_url?: string | null
          id?: string
          key?: string
          note?: string | null
          owner?: string | null
          product_id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plm_deliverables_key_fkey"
            columns: ["key"]
            isOneToOne: false
            referencedRelation: "plm_deliverable_template"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "plm_deliverables_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "plm_catch_up"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "plm_deliverables_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "plm_products"
            referencedColumns: ["id"]
          },
        ]
      }
      plm_gates: {
        Row: {
          approved_by_name: string | null
          file_url: string | null
          gate: number
          how: string
          id: string
          note: string | null
          passed_at: string
          passed_by: string | null
          product_id: string
        }
        Insert: {
          approved_by_name?: string | null
          file_url?: string | null
          gate: number
          how: string
          id?: string
          note?: string | null
          passed_at?: string
          passed_by?: string | null
          product_id: string
        }
        Update: {
          approved_by_name?: string | null
          file_url?: string | null
          gate?: number
          how?: string
          id?: string
          note?: string | null
          passed_at?: string
          passed_by?: string | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plm_gates_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "plm_catch_up"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "plm_gates_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "plm_products"
            referencedColumns: ["id"]
          },
        ]
      }
      plm_issues: {
        Row: {
          action: string | null
          closed_on: string | null
          complaint_id: string | null
          created_at: string
          created_by: string | null
          description: string
          id: string
          issue_no: string
          owner: string | null
          product_id: string
          raised_on: string
          remarks: string | null
          severity: string
          source: string
          stage: number
          status: string
          target_date: string | null
          test_id: string | null
          updated_at: string
        }
        Insert: {
          action?: string | null
          closed_on?: string | null
          complaint_id?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          issue_no?: string
          owner?: string | null
          product_id: string
          raised_on?: string
          remarks?: string | null
          severity?: string
          source?: string
          stage: number
          status?: string
          target_date?: string | null
          test_id?: string | null
          updated_at?: string
        }
        Update: {
          action?: string | null
          closed_on?: string | null
          complaint_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          issue_no?: string
          owner?: string | null
          product_id?: string
          raised_on?: string
          remarks?: string | null
          severity?: string
          source?: string
          stage?: number
          status?: string
          target_date?: string | null
          test_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plm_issues_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "customer_complaints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plm_issues_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "plm_catch_up"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "plm_issues_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "plm_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plm_issues_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "plm_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      plm_products: {
        Row: {
          based_on_id: string | null
          bis_letter_url: string | null
          bis_status: string
          business_model: string | null
          category: string | null
          client: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          firmware_version: string | null
          id: string
          kind: string
          name: string
          notes: string | null
          ownership: string
          priority: string
          product_code: string
          stage: number
          start_date: string | null
          status: string
          target_cost: number | null
          target_launch: string | null
          updated_at: string
        }
        Insert: {
          based_on_id?: string | null
          bis_letter_url?: string | null
          bis_status?: string
          business_model?: string | null
          category?: string | null
          client?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          firmware_version?: string | null
          id?: string
          kind?: string
          name: string
          notes?: string | null
          ownership?: string
          priority?: string
          product_code: string
          stage?: number
          start_date?: string | null
          status?: string
          target_cost?: number | null
          target_launch?: string | null
          updated_at?: string
        }
        Update: {
          based_on_id?: string | null
          bis_letter_url?: string | null
          bis_status?: string
          business_model?: string | null
          category?: string | null
          client?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          firmware_version?: string | null
          id?: string
          kind?: string
          name?: string
          notes?: string | null
          ownership?: string
          priority?: string
          product_code?: string
          stage?: number
          start_date?: string | null
          status?: string
          target_cost?: number | null
          target_launch?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plm_products_based_on_id_fkey"
            columns: ["based_on_id"]
            isOneToOne: false
            referencedRelation: "plm_catch_up"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "plm_products_based_on_id_fkey"
            columns: ["based_on_id"]
            isOneToOne: false
            referencedRelation: "plm_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plm_products_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      plm_tests: {
        Row: {
          created_at: string
          id: string
          name: string
          note: string | null
          phase: string
          product_id: string
          report_url: string | null
          result: string
          sort: number
          tested_at: string | null
          tested_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          note?: string | null
          phase: string
          product_id: string
          report_url?: string | null
          result?: string
          sort?: number
          tested_at?: string | null
          tested_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          note?: string | null
          phase?: string
          product_id?: string
          report_url?: string | null
          result?: string
          sort?: number
          tested_at?: string | null
          tested_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plm_tests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "plm_catch_up"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "plm_tests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "plm_products"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "production_order_lines_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "store_receiving_variances"
            referencedColumns: ["part_id"]
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
          handed_over_at: string | null
          handed_over_quantity: number | null
          id: string
          is_pilot: boolean
          parent_order_id: string | null
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
          handed_over_at?: string | null
          handed_over_quantity?: number | null
          id?: string
          is_pilot?: boolean
          parent_order_id?: string | null
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
          handed_over_at?: string | null
          handed_over_quantity?: number | null
          id?: string
          is_pilot?: boolean
          parent_order_id?: string | null
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
            foreignKeyName: "production_orders_parent_order_id_fkey"
            columns: ["parent_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "store_receiving_variances"
            referencedColumns: ["part_id"]
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
          is_pilot: boolean
          notes: string | null
          part_id: string
          plant_id: string
          production_line_id: string | null
          projection_id: string | null
          quantity: number
          scheduled_date: string
          status: Database["public"]["Enums"]["schedule_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_pilot?: boolean
          notes?: string | null
          part_id: string
          plant_id: string
          production_line_id?: string | null
          projection_id?: string | null
          quantity: number
          scheduled_date: string
          status?: Database["public"]["Enums"]["schedule_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_pilot?: boolean
          notes?: string | null
          part_id?: string
          plant_id?: string
          production_line_id?: string | null
          projection_id?: string | null
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
            foreignKeyName: "production_schedules_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "store_receiving_variances"
            referencedColumns: ["part_id"]
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
          {
            foreignKeyName: "projections_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "store_receiving_variances"
            referencedColumns: ["part_id"]
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
            foreignKeyName: "purchase_order_items_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "store_receiving_variances"
            referencedColumns: ["part_id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "store_receiving_variances"
            referencedColumns: ["purchase_order_id"]
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
            referencedRelation: "store_receiving_variances"
            referencedColumns: ["vendor_id"]
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
      released_part_codes: {
        Row: {
          part_code: string
          prefix: string
          released_at: string
          released_by: string | null
          seq: number
        }
        Insert: {
          part_code: string
          prefix: string
          released_at?: string
          released_by?: string | null
          seq: number
        }
        Update: {
          part_code?: string
          prefix?: string
          released_at?: string
          released_by?: string | null
          seq?: number
        }
        Relationships: []
      }
      serial_number_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          created_at: string
          ending_serial_number: string
          id: string
          notes: string | null
          plant_id: string
          production_order_id: string
          quantity: number
          starting_serial_number: string
          status: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          created_at?: string
          ending_serial_number: string
          id?: string
          notes?: string | null
          plant_id: string
          production_order_id: string
          quantity: number
          starting_serial_number: string
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          created_at?: string
          ending_serial_number?: string
          id?: string
          notes?: string | null
          plant_id?: string
          production_order_id?: string
          quantity?: number
          starting_serial_number?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "serial_number_assignments_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "serial_number_assignments_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
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
            foreignKeyName: "shortages_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "store_receiving_variances"
            referencedColumns: ["part_id"]
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
            foreignKeyName: "spare_order_items_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "store_receiving_variances"
            referencedColumns: ["part_id"]
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
            foreignKeyName: "stock_balance_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "store_receiving_variances"
            referencedColumns: ["part_id"]
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
            foreignKeyName: "stock_holds_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "store_receiving_variances"
            referencedColumns: ["part_id"]
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
            foreignKeyName: "stock_ledger_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "store_receiving_variances"
            referencedColumns: ["part_id"]
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
      vendor_contacts: {
        Row: {
          created_at: string
          designation: string | null
          email: string | null
          id: string
          name: string | null
          phone: string | null
          vendor_id: string
        }
        Insert: {
          created_at?: string
          designation?: string | null
          email?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          vendor_id: string
        }
        Update: {
          created_at?: string
          designation?: string | null
          email?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_contacts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "store_receiving_variances"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_contacts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_notifications: {
        Row: {
          attempts: number
          body: string
          capa_id: string | null
          cc_email: string | null
          created_at: string
          created_by: string | null
          id: string
          last_error: string | null
          plant_id: string | null
          provider_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["vendor_notification_status"]
          subject: string
          to_email: string
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          attempts?: number
          body: string
          capa_id?: string | null
          cc_email?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_error?: string | null
          plant_id?: string | null
          provider_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["vendor_notification_status"]
          subject: string
          to_email: string
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          attempts?: number
          body?: string
          capa_id?: string | null
          cc_email?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_error?: string | null
          plant_id?: string | null
          provider_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["vendor_notification_status"]
          subject?: string
          to_email?: string
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_notifications_capa_id_fkey"
            columns: ["capa_id"]
            isOneToOne: false
            referencedRelation: "capa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_notifications_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_notifications_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "store_receiving_variances"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_notifications_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          account_holder_name: string | null
          address: string | null
          approval_status: string
          bank_account_number: string | null
          bank_name: string | null
          contact_designation: string | null
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
          location: string | null
          msme_certificate_url: string | null
          name: string
          pan_number: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          submitted_by: string | null
          supplies: string | null
          updated_at: string
          vendor_code: string
        }
        Insert: {
          account_holder_name?: string | null
          address?: string | null
          approval_status?: string
          bank_account_number?: string | null
          bank_name?: string | null
          contact_designation?: string | null
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
          location?: string | null
          msme_certificate_url?: string | null
          name: string
          pan_number?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          submitted_by?: string | null
          supplies?: string | null
          updated_at?: string
          vendor_code: string
        }
        Update: {
          account_holder_name?: string | null
          address?: string | null
          approval_status?: string
          bank_account_number?: string | null
          bank_name?: string | null
          contact_designation?: string | null
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
          location?: string | null
          msme_certificate_url?: string | null
          name?: string
          pan_number?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          submitted_by?: string | null
          supplies?: string | null
          updated_at?: string
          vendor_code?: string
        }
        Relationships: []
      }
    }
    Views: {
      free_part_prefixes: {
        Row: {
          prefix: string | null
        }
        Relationships: []
      }
      plm_catch_up: {
        Row: {
          name: string | null
          open_vouchers: number | null
          part_codes: string | null
          product_code: string | null
          product_id: string | null
          stage: number | null
          vouchers: string | null
        }
        Relationships: []
      }
      store_receiving_variances: {
        Row: {
          claim_quantity: number | null
          grn_id: string | null
          grn_item_id: string | null
          grn_number: string | null
          invoice_number: string | null
          iqc_accepted_quantity: number | null
          iqc_rejected_quantity: number | null
          is_open: boolean | null
          part_code: string | null
          part_id: string | null
          part_name: string | null
          plant_id: string | null
          po_number: string | null
          purchase_order_id: string | null
          received_date: string | null
          received_quantity: number | null
          resolution: Database["public"]["Enums"]["variance_resolution"] | null
          resolution_id: string | null
          resolution_remarks: string | null
          resolved_at: string | null
          store_confirmed_at: string | null
          store_counted_quantity: number | null
          uom: string | null
          variance: number | null
          vendor_code: string | null
          vendor_id: string | null
          vendor_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grn_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_kit_feedback: {
        Args: { p_feedback_id: string; p_remarks?: string }
        Returns: string
      }
      admin_delete_user: { Args: { p_user_id: string }; Returns: string }
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
      admin_update_user_email: {
        Args: { p_email: string; p_user_id: string }
        Returns: string
      }
      allocate_finished_goods: {
        Args: {
          p_dispatch_order_id: string
          p_part_id: string
          p_quantity: number
        }
        Returns: {
          lot_id: string
          lot_number: string
          taken: number
        }[]
      }
      apply_bom: { Args: { p_lines: Json; p_parent: string }; Returns: Json }
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
      can_approve: { Args: never; Returns: boolean }
      can_edit_customers: { Args: never; Returns: boolean }
      can_edit_masters: { Args: never; Returns: boolean }
      can_edit_plm: { Args: never; Returns: boolean }
      delete_part: { Args: { p_part_id: string }; Returns: Json }
      delete_production_schedule_cascade: {
        Args: { p_schedule_id: string }
        Returns: undefined
      }
      generate_temp_part_code: {
        Args: { part_category?: string }
        Returns: string
      }
      get_customer_finance: {
        Args: { p_customer_id: string }
        Returns: {
          bank_account_number: string
          brand_authorization_url: string
          gst_certificate_url: string
          id: string
          ifsc_code: string
          msme_certificate_url: string
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
      get_vendor_finance: {
        Args: { p_vendor_id: string }
        Returns: {
          account_holder_name: string
          bank_account_number: string
          bank_name: string
          gst_certificate_url: string
          id: string
          ifsc_code: string
          msme_certificate_url: string
          pan_number: string
        }[]
      }
      has_role: { Args: { _module?: string }; Returns: boolean }
      in_department: { Args: { p_names: string[] }; Returns: boolean }
      in_plant: { Args: { _plant_id: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      issue_child_vouchers: {
        Args: {
          p_default_date: string
          p_items: Json
          p_plant_id: string
          p_root_order: string
          p_root_part: string
        }
        Returns: Json
      }
      linked_cover: {
        Args: { p_order_id: string; p_part_id: string }
        Returns: number
      }
      list_departments_with_modules: {
        Args: never
        Returns: {
          department_id: string
          modules: string[]
          name: string
        }[]
      }
      list_logins_without_account: {
        Args: never
        Returns: {
          created_at: string
          email: string
          id: string
          last_sign_in_at: string
        }[]
      }
      list_master_approvals: {
        Args: never
        Returns: {
          code: string
          detail: string
          id: string
          kind: string
          lines: Json
          name: string
          parent_part_id: string
          submitted_at: string
          submitted_by_name: string
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
          has_login: boolean
          id: string
          is_active: boolean
          last_sign_in_at: string
          role: string
          updated_at: string
          username: string
        }[]
      }
      log_material_movement: {
        Args: {
          p_movement_type: string
          p_notes?: string
          p_quantity?: number
          p_raw_material_id: string
          p_reference_id?: string
          p_reference_number?: string
          p_reference_type?: string
        }
        Returns: string
      }
      my_permissions: { Args: never; Returns: Json }
      next_doc_number: {
        Args: { _prefix: string; _seq: unknown }
        Returns: string
      }
      next_part_code: {
        Args: { p_brand?: string; p_prefix: string }
        Returns: string
      }
      next_po_number: { Args: never; Returns: string }
      part_stock_statement: {
        Args: { p_part_id: string; p_plant_id: string }
        Returns: {
          balances: boolean
          department: string
          event_at: string
          is_unexplained: boolean
          label: string
          note: string
          quantity: number
          running_balance: number
          section: string
          seq: number
        }[]
      }
      part_usage: { Args: { p_part_id: string }; Returns: string[] }
      plm_copy_bom: {
        Args: { p_from_part: string; p_to_part: string }
        Returns: Json
      }
      plm_gate_blockers: {
        Args: { p_gate: number; p_product: string }
        Returns: string[]
      }
      plm_link_part: {
        Args: { p_link: boolean; p_part: string; p_product: string }
        Returns: undefined
      }
      plm_metrics: { Args: { p_product: string }; Returns: Json }
      plm_pass_gate: {
        Args: {
          p_approved_by?: string
          p_file_url?: string
          p_gate: number
          p_note?: string
          p_product: string
        }
        Returns: number
      }
      plm_refresh: { Args: { p_product: string }; Returns: number }
      plm_refresh_all: { Args: never; Returns: number }
      plm_release_override: {
        Args: { p_product: string; p_reason: string }
        Returns: number
      }
      plm_schedule_pilot: {
        Args: {
          p_date: string
          p_line_id?: string
          p_part_id: string
          p_plant_id: string
          p_quantity: number
        }
        Returns: Json
      }
      post_stock_count: {
        Args: { p_lines: Json; p_plant_id: string; p_reference?: string }
        Returns: Json
      }
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
      raise_vendor_capa: {
        Args: { p_due_days?: number; p_grn_item_id: string; p_problem?: string }
        Returns: Json
      }
      reactivate_part: { Args: { p_part_id: string }; Returns: undefined }
      receive_finished_goods: {
        Args: { p_production_order_id: string }
        Returns: string
      }
      record_kit_receipt: {
        Args: { p_kit_id: string; p_lines: Json; p_notes?: string }
        Returns: {
          disputed_count: number
        }[]
      }
      reject_kit_feedback: {
        Args: { p_feedback_id: string; p_remarks: string }
        Returns: undefined
      }
      resolve_store_variance: {
        Args: {
          p_grn_item_id: string
          p_remarks: string
          p_resolution: Database["public"]["Enums"]["variance_resolution"]
        }
        Returns: string
      }
      review_bom_change: {
        Args: { p_approve: boolean; p_id: string; p_reason?: string }
        Returns: Json
      }
      review_master: {
        Args: {
          p_approve: boolean
          p_id: string
          p_kind: string
          p_reason?: string
        }
        Returns: undefined
      }
      save_bom: { Args: { p_lines: Json; p_parent: string }; Returns: Json }
      schedule_finished_good: {
        Args: {
          p_date: string
          p_line_id?: string
          p_plant_id: string
          p_projection_id: string
          p_quantity: number
          p_subassemblies?: Json
        }
        Returns: Json
      }
      schedule_subassembly: {
        Args: {
          p_date: string
          p_line_id?: string
          p_notes?: string
          p_parent_order_id?: string
          p_part_id: string
          p_plant_id: string
          p_quantity: number
        }
        Returns: Json
      }
      schedule_subassembly_tree: {
        Args: {
          p_children?: Json
          p_date: string
          p_line_id?: string
          p_parent_order_id?: string
          p_part_id: string
          p_plant_id: string
          p_quantity: number
        }
        Returns: Json
      }
      set_department_modules: {
        Args: { p_department_id: string; p_modules: string[] }
        Returns: undefined
      }
      set_part_branding: {
        Args: { p_brands: string[]; p_part_id: string; p_required: boolean }
        Returns: Json
      }
      set_user_departments: {
        Args: { p_department_ids: string[]; p_user_id: string }
        Returns: undefined
      }
      set_user_plants: {
        Args: { p_plant_ids: string[]; p_user_id: string }
        Returns: undefined
      }
      sync_brand_variants: { Args: never; Returns: Json }
      sync_voucher_holds: {
        Args: { p_production_order_id: string }
        Returns: number
      }
      system_health_check: {
        Args: never
        Returns: {
          area: string
          detail: string
          records: number
          rule: string
          status: string
        }[]
      }
      unit_factor: { Args: { p_from: string; p_to: string }; Returns: number }
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
      variance_resolution:
        | "SHORT_SUPPLY"
        | "IQC_MISCOUNT"
        | "STORE_RECOUNT"
        | "WRITE_OFF"
      vendor_notification_status: "QUEUED" | "SENT" | "FAILED" | "CANCELLED"
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
      variance_resolution: [
        "SHORT_SUPPLY",
        "IQC_MISCOUNT",
        "STORE_RECOUNT",
        "WRITE_OFF",
      ],
      vendor_notification_status: ["QUEUED", "SENT", "FAILED", "CANCELLED"],
    },
  },
} as const
