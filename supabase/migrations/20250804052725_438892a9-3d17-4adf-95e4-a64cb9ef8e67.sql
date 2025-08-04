-- CRITICAL SECURITY FIX: Enable RLS on all tables that have policies but RLS disabled
-- This fixes the most critical security vulnerability exposing all data

-- Enable RLS on core business tables
ALTER TABLE public.approval_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.container_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.container_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_complaint_batch_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_complaint_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_complaint_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finished_goods_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grn ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grn_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hourly_production ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_containers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iqc_vendor_capa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kit_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kit_preparation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.line_rejections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_blocking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_requests ENABLE ROW LEVEL SECURITY;

-- CRITICAL: Enable RLS on employee and attendance tables (currently missing)
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_training ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for employee data access
CREATE POLICY "HR and admin can view all employees" 
ON public.employees 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_accounts ua
    JOIN public.departments d ON ua.department_id = d.id
    WHERE ua.id = auth.uid() 
    AND (d.name = 'HR' OR ua.role = 'admin')
  )
);

CREATE POLICY "HR and admin can create employees" 
ON public.employees 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_accounts ua
    JOIN public.departments d ON ua.department_id = d.id
    WHERE ua.id = auth.uid() 
    AND (d.name = 'HR' OR ua.role = 'admin')
  )
);

CREATE POLICY "HR and admin can update employees" 
ON public.employees 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.user_accounts ua
    JOIN public.departments d ON ua.department_id = d.id
    WHERE ua.id = auth.uid() 
    AND (d.name = 'HR' OR ua.role = 'admin')
  )
);

-- Attendance policies
CREATE POLICY "HR and admin can view all attendance" 
ON public.attendance 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_accounts ua
    JOIN public.departments d ON ua.department_id = d.id
    WHERE ua.id = auth.uid() 
    AND (d.name = 'HR' OR ua.role = 'admin')
  )
);

CREATE POLICY "HR and admin can manage attendance" 
ON public.attendance 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_accounts ua
    JOIN public.departments d ON ua.department_id = d.id
    WHERE ua.id = auth.uid() 
    AND (d.name = 'HR' OR ua.role = 'admin')
  )
);

-- Employee skills and training policies
CREATE POLICY "HR can manage employee skills" 
ON public.employee_skills 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_accounts ua
    JOIN public.departments d ON ua.department_id = d.id
    WHERE ua.id = auth.uid() 
    AND (d.name = 'HR' OR ua.role = 'admin')
  )
);

CREATE POLICY "HR can manage employee training" 
ON public.employee_training 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_accounts ua
    JOIN public.departments d ON ua.department_id = d.id
    WHERE ua.id = auth.uid() 
    AND (d.name = 'HR' OR ua.role = 'admin')
  )
);

-- Strengthen department access policies (currently too permissive)
DROP POLICY IF EXISTS "Allow read access to departments" ON public.departments;
DROP POLICY IF EXISTS "Allow read access to department_permissions" ON public.department_permissions;

CREATE POLICY "Authenticated users can view departments" 
ON public.departments 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view department permissions" 
ON public.department_permissions 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Add admin-only policies for department management
CREATE POLICY "Admin can manage departments" 
ON public.departments 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_accounts 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admin can manage department permissions" 
ON public.department_permissions 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_accounts 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Create audit log table for sensitive operations
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  old_values jsonb,
  new_values jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and HR can view audit logs" 
ON public.audit_logs 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_accounts ua
    JOIN public.departments d ON ua.department_id = d.id
    WHERE ua.id = auth.uid() 
    AND (d.name = 'HR' OR ua.role = 'admin')
  )
);

-- Function to log sensitive operations
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action text,
  p_table_name text,
  p_record_id uuid DEFAULT NULL,
  p_old_values jsonb DEFAULT NULL,
  p_new_values jsonb DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    action,
    table_name,
    record_id,
    old_values,
    new_values
  ) VALUES (
    auth.uid(),
    p_action,
    p_table_name,
    p_record_id,
    p_old_values,
    p_new_values
  );
END;
$$;