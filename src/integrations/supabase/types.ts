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
      user_accounts: {
        Row: {
          created_at: string
          created_by: string | null
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
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          password_hash?: string
          role?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      vendors: {
        Row: {
          address: string
          bank_account_number: string
          contact_number: string
          created_at: string
          created_by: string | null
          email: string
          gst_number: string
          id: string
          ifsc_code: string
          is_active: boolean
          name: string
          updated_at: string
          vendor_code: string
        }
        Insert: {
          address: string
          bank_account_number: string
          contact_number: string
          created_at?: string
          created_by?: string | null
          email: string
          gst_number: string
          id?: string
          ifsc_code: string
          is_active?: boolean
          name: string
          updated_at?: string
          vendor_code: string
        }
        Update: {
          address?: string
          bank_account_number?: string
          contact_number?: string
          created_at?: string
          created_by?: string | null
          email?: string
          gst_number?: string
          id?: string
          ifsc_code?: string
          is_active?: boolean
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
      generate_spare_order_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
    }
    Enums: {
      bom_type: "main_assembly" | "sub_assembly" | "accessory"
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
    },
  },
} as const
