export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
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
      bom: {
        Row: {
          bom_type: Database["public"]["Enums"]["bom_type"]
          created_at: string
          created_by: string | null
          id: string
          product_id: string
          quantity: number
          raw_material_id: string
          updated_at: string
        }
        Insert: {
          bom_type: Database["public"]["Enums"]["bom_type"]
          created_at?: string
          created_by?: string | null
          id?: string
          product_id: string
          quantity: number
          raw_material_id: string
          updated_at?: string
        }
        Update: {
          bom_type?: Database["public"]["Enums"]["bom_type"]
          created_at?: string
          created_by?: string | null
          id?: string
          product_id?: string
          quantity?: number
          raw_material_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bom_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bom_product_id"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
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
          address: string
          contact_number: string
          created_at: string
          created_by: string | null
          customer_code: string
          email: string
          gst_number: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          address: string
          contact_number: string
          created_at?: string
          created_by?: string | null
          customer_code: string
          email: string
          gst_number?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          address?: string
          contact_number?: string
          created_at?: string
          created_by?: string | null
          customer_code?: string
          email?: string
          gst_number?: string | null
          id?: string
          is_active?: boolean
          name?: string
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
          id: string
          lot_number: string | null
          product_id: string
          quantity: number
        }
        Insert: {
          created_at?: string
          dispatch_order_id: string
          id?: string
          lot_number?: string | null
          product_id: string
          quantity: number
        }
        Update: {
          created_at?: string
          dispatch_order_id?: string
          id?: string
          lot_number?: string | null
          product_id?: string
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
            foreignKeyName: "dispatch_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatch_orders: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          customer_warehouse_id: string
          dispatch_date: string
          dispatch_order_number: string
          id: string
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          customer_warehouse_id: string
          dispatch_date?: string
          dispatch_order_number: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          customer_warehouse_id?: string
          dispatch_date?: string
          dispatch_order_number?: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
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
        ]
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
          last_name: string
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
          last_name: string
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
          last_name?: string
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
          location: string | null
          lot_number: string | null
          product_id: string
          production_date: string | null
          quality_status: string | null
          quantity: number
        }
        Insert: {
          created_at?: string
          id?: string
          location?: string | null
          lot_number?: string | null
          product_id: string
          production_date?: string | null
          quality_status?: string | null
          quantity?: number
        }
        Update: {
          created_at?: string
          id?: string
          location?: string | null
          lot_number?: string | null
          product_id?: string
          production_date?: string | null
          quality_status?: string | null
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "finished_goods_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      grn: {
        Row: {
          created_at: string
          grn_number: string
          id: string
          notes: string | null
          purchase_order_id: string
          received_by: string | null
          received_date: string
          status: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          grn_number: string
          id?: string
          notes?: string | null
          purchase_order_id: string
          received_by?: string | null
          received_date?: string
          status?: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          grn_number?: string
          id?: string
          notes?: string | null
          purchase_order_id?: string
          received_by?: string | null
          received_date?: string
          status?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
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
          accepted_quantity: number | null
          created_at: string
          grn_id: string
          id: string
          iqc_approved_at: string | null
          iqc_approved_by: string | null
          iqc_status: string | null
          po_quantity: number
          raw_material_id: string
          received_quantity: number
          rejected_quantity: number | null
          store_confirmed: boolean | null
          store_confirmed_at: string | null
          store_confirmed_by: string | null
        }
        Insert: {
          accepted_quantity?: number | null
          created_at?: string
          grn_id: string
          id?: string
          iqc_approved_at?: string | null
          iqc_approved_by?: string | null
          iqc_status?: string | null
          po_quantity: number
          raw_material_id: string
          received_quantity?: number
          rejected_quantity?: number | null
          store_confirmed?: boolean | null
          store_confirmed_at?: string | null
          store_confirmed_by?: string | null
        }
        Update: {
          accepted_quantity?: number | null
          created_at?: string
          grn_id?: string
          id?: string
          iqc_approved_at?: string | null
          iqc_approved_by?: string | null
          iqc_status?: string | null
          po_quantity?: number
          raw_material_id?: string
          received_quantity?: number
          rejected_quantity?: number | null
          store_confirmed?: boolean | null
          store_confirmed_at?: string | null
          store_confirmed_by?: string | null
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
            foreignKeyName: "grn_items_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          bin_location: string | null
          created_at: string
          id: string
          last_updated: string
          location: string | null
          minimum_stock: number | null
          quantity: number
          raw_material_id: string
        }
        Insert: {
          bin_location?: string | null
          created_at?: string
          id?: string
          last_updated?: string
          location?: string | null
          minimum_stock?: number | null
          quantity?: number
          raw_material_id: string
        }
        Update: {
          bin_location?: string | null
          created_at?: string
          id?: string
          last_updated?: string
          location?: string | null
          minimum_stock?: number | null
          quantity?: number
          raw_material_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      kit_items: {
        Row: {
          actual_quantity: number | null
          created_at: string
          id: string
          kit_preparation_id: string
          raw_material_id: string
          required_quantity: number
          verified_by_production: boolean | null
        }
        Insert: {
          actual_quantity?: number | null
          created_at?: string
          id?: string
          kit_preparation_id: string
          raw_material_id: string
          required_quantity: number
          verified_by_production?: boolean | null
        }
        Update: {
          actual_quantity?: number | null
          created_at?: string
          id?: string
          kit_preparation_id?: string
          raw_material_id?: string
          required_quantity?: number
          verified_by_production?: boolean | null
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
            foreignKeyName: "kit_items_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      kit_preparation: {
        Row: {
          created_at: string
          id: string
          kit_number: string
          prepared_at: string | null
          prepared_by: string | null
          production_order_id: string
          sent_to_production_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          kit_number: string
          prepared_at?: string | null
          prepared_by?: string | null
          production_order_id: string
          sent_to_production_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          kit_number?: string
          prepared_at?: string | null
          prepared_by?: string | null
          production_order_id?: string
          sent_to_production_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "kit_preparation_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      material_blocking: {
        Row: {
          blocked_at: string
          id: string
          production_schedule_id: string
          quantity_blocked: number
          raw_material_id: string
          released_at: string | null
          status: string
        }
        Insert: {
          blocked_at?: string
          id?: string
          production_schedule_id: string
          quantity_blocked: number
          raw_material_id: string
          released_at?: string | null
          status?: string
        }
        Update: {
          blocked_at?: string
          id?: string
          production_schedule_id?: string
          quantity_blocked?: number
          raw_material_id?: string
          released_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_blocking_production_schedule_id_fkey"
            columns: ["production_schedule_id"]
            isOneToOne: false
            referencedRelation: "production_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_blocking_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      material_requests: {
        Row: {
          approved_by: string | null
          approved_quantity: number | null
          created_at: string
          id: string
          production_order_id: string
          raw_material_id: string
          reason: string | null
          requested_by: string | null
          requested_quantity: number
          status: string
        }
        Insert: {
          approved_by?: string | null
          approved_quantity?: number | null
          created_at?: string
          id?: string
          production_order_id: string
          raw_material_id: string
          reason?: string | null
          requested_by?: string | null
          requested_quantity: number
          status?: string
        }
        Update: {
          approved_by?: string | null
          approved_quantity?: number | null
          created_at?: string
          id?: string
          production_order_id?: string
          raw_material_id?: string
          reason?: string | null
          requested_by?: string | null
          requested_quantity?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_requests_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_requests_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "user_accounts"
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
      production_orders: {
        Row: {
          created_at: string
          id: string
          kit_status: string | null
          product_id: string
          production_schedule_id: string
          quantity: number
          scheduled_date: string
          status: string
          updated_at: string
          voucher_number: string
        }
        Insert: {
          created_at?: string
          id?: string
          kit_status?: string | null
          product_id: string
          production_schedule_id: string
          quantity: number
          scheduled_date: string
          status?: string
          updated_at?: string
          voucher_number: string
        }
        Update: {
          created_at?: string
          id?: string
          kit_status?: string | null
          product_id?: string
          production_schedule_id?: string
          quantity?: number
          scheduled_date?: string
          status?: string
          updated_at?: string
          voucher_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_production_schedule_id_fkey"
            columns: ["production_schedule_id"]
            isOneToOne: false
            referencedRelation: "production_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      production_schedules: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          production_line: string
          projection_id: string
          quantity: number
          scheduled_date: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          production_line: string
          projection_id: string
          quantity: number
          scheduled_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          production_line?: string
          projection_id?: string
          quantity?: number
          scheduled_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_schedules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_accounts"
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
      products: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          product_code: string
          specifications: string | null
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          product_code: string
          specifications?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          product_code?: string
          specifications?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      projections: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          delivery_month: string
          id: string
          product_id: string
          quantity: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          delivery_month: string
          id?: string
          product_id: string
          quantity: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          delivery_month?: string
          id?: string
          product_id?: string
          quantity?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projections_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projections_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projections_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          created_at: string
          id: string
          purchase_order_id: string
          quantity: number
          raw_material_id: string
          total_price: number | null
          unit_price: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          purchase_order_id: string
          quantity: number
          raw_material_id: string
          total_price?: number | null
          unit_price?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          purchase_order_id?: string
          quantity?: number
          raw_material_id?: string
          total_price?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          created_by: string | null
          expected_delivery_date: string | null
          id: string
          notes: string | null
          po_date: string
          po_number: string
          status: string
          total_amount: number | null
          updated_at: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          po_date?: string
          po_number: string
          status?: string
          total_amount?: number | null
          updated_at?: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          po_date?: string
          po_number?: string
          status?: string
          total_amount?: number | null
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      raw_materials: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          material_code: string
          name: string
          specification: string | null
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          material_code: string
          name: string
          specification?: string | null
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          material_code?: string
          name?: string
          specification?: string | null
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "raw_materials_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
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
          packed: boolean
          quantity: number
          raw_material_id: string
          spare_order_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          packed?: boolean
          quantity: number
          raw_material_id: string
          spare_order_id: string
        }
        Update: {
          created_at?: string
          id?: string
          packed?: boolean
          quantity?: number
          raw_material_id?: string
          spare_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spare_order_items_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
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
          customer_id: string
          id: string
          notes: string | null
          order_date: string
          spare_order_number: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          notes?: string | null
          order_date?: string
          spare_order_number: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          notes?: string | null
          order_date?: string
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
          department_id: string | null
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          password_hash: string
          role: string
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          email: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          password_hash: string
          role?: string
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          password_hash?: string
          role?: string
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_accounts_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          address: string
          bank_account_number: string
          contact_number: string
          contact_person_name: string | null
          created_at: string
          created_by: string | null
          email: string
          gst_certificate_url: string | null
          gst_number: string
          id: string
          ifsc_code: string
          is_active: boolean
          msme_certificate_url: string | null
          name: string
          updated_at: string
          vendor_code: string
        }
        Insert: {
          address: string
          bank_account_number: string
          contact_number: string
          contact_person_name?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          gst_certificate_url?: string | null
          gst_number: string
          id?: string
          ifsc_code: string
          is_active?: boolean
          msme_certificate_url?: string | null
          name: string
          updated_at?: string
          vendor_code: string
        }
        Update: {
          address?: string
          bank_account_number?: string
          contact_number?: string
          contact_person_name?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          gst_certificate_url?: string | null
          gst_number?: string
          id?: string
          ifsc_code?: string
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
      generate_dispatch_order_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_grn_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_kit_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_po_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_spare_order_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
    }
    Enums: {
      bom_type: "main_assembly" | "sub_assembly" | "accessory"
      employee_status: "active" | "inactive" | "terminated" | "on_leave"
      performance_rating:
        | "excellent"
        | "good"
        | "satisfactory"
        | "needs_improvement"
        | "unsatisfactory"
      skill_level: "beginner" | "intermediate" | "advanced" | "expert"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      bom_type: ["main_assembly", "sub_assembly", "accessory"],
      employee_status: ["active", "inactive", "terminated", "on_leave"],
      performance_rating: [
        "excellent",
        "good",
        "satisfactory",
        "needs_improvement",
        "unsatisfactory",
      ],
      skill_level: ["beginner", "intermediate", "advanced", "expert"],
    },
  },
} as const
