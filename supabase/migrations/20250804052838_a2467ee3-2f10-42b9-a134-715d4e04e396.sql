-- Fix remaining RLS disabled tables identified by security linter
-- These tables need RLS enabled to complete the security fix

-- Check for tables that still need RLS enabled
-- Tables that likely need RLS based on the project structure
ALTER TABLE IF EXISTS public.npd_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.npd_bom_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.npd_project_collaboration ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.npd_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.npd_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.oqc_rejections ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pqc_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.production_capa ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.production_discrepancies ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.production_material_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.production_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.production_serial_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.projections ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.raw_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.spare_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.spare_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.store_discrepancies ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.training_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vendors ENABLE ROW LEVEL SECURITY;

-- Create comprehensive RLS policies for the core tables that need them

-- User accounts - critical security table
CREATE POLICY "Users can view their own profile" 
ON public.user_accounts 
FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Admins can view all user accounts" 
ON public.user_accounts 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_accounts 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admins can manage user accounts" 
ON public.user_accounts 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_accounts 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Products table
CREATE POLICY "Authenticated users can view products" 
ON public.products 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin and relevant departments can manage products" 
ON public.products 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_accounts ua
    JOIN public.departments d ON ua.department_id = d.id
    WHERE ua.id = auth.uid() 
    AND (ua.role = 'admin' OR d.name IN ('R&D', 'Production', 'Planning'))
  )
);

-- Raw materials table
CREATE POLICY "Authenticated users can view raw materials" 
ON public.raw_materials 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Store and admin can manage raw materials" 
ON public.raw_materials 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_accounts ua
    JOIN public.departments d ON ua.department_id = d.id
    WHERE ua.id = auth.uid() 
    AND (ua.role = 'admin' OR d.name IN ('Store', 'Purchase', 'Production'))
  )
);

-- Vendors table
CREATE POLICY "Authenticated users can view vendors" 
ON public.vendors 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Purchase and admin can manage vendors" 
ON public.vendors 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_accounts ua
    JOIN public.departments d ON ua.department_id = d.id
    WHERE ua.id = auth.uid() 
    AND (ua.role = 'admin' OR d.name = 'Purchase')
  )
);

-- Production orders and schedules
CREATE POLICY "Production team can view production orders" 
ON public.production_orders 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_accounts ua
    JOIN public.departments d ON ua.department_id = d.id
    WHERE ua.id = auth.uid() 
    AND (ua.role = 'admin' OR d.name IN ('Production', 'Planning', 'Store'))
  )
);

CREATE POLICY "Production and planning can manage production orders" 
ON public.production_orders 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_accounts ua
    JOIN public.departments d ON ua.department_id = d.id
    WHERE ua.id = auth.uid() 
    AND (ua.role = 'admin' OR d.name IN ('Production', 'Planning'))
  )
);

-- Purchase orders
CREATE POLICY "Purchase team can view purchase orders" 
ON public.purchase_orders 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_accounts ua
    JOIN public.departments d ON ua.department_id = d.id
    WHERE ua.id = auth.uid() 
    AND (ua.role = 'admin' OR d.name IN ('Purchase', 'Store', 'Planning'))
  )
);

CREATE POLICY "Purchase can manage purchase orders" 
ON public.purchase_orders 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_accounts ua
    JOIN public.departments d ON ua.department_id = d.id
    WHERE ua.id = auth.uid() 
    AND (ua.role = 'admin' OR d.name = 'Purchase')
  )
);

-- Projections
CREATE POLICY "Planning team can view projections" 
ON public.projections 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_accounts ua
    JOIN public.departments d ON ua.department_id = d.id
    WHERE ua.id = auth.uid() 
    AND (ua.role = 'admin' OR d.name IN ('Planning', 'Sales', 'Production'))
  )
);

CREATE POLICY "Planning can manage projections" 
ON public.projections 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_accounts ua
    JOIN public.departments d ON ua.department_id = d.id
    WHERE ua.id = auth.uid() 
    AND (ua.role = 'admin' OR d.name = 'Planning')
  )
);

-- Fix function search paths for security (sample of critical functions)
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action text,
  p_table_name text,
  p_record_id uuid DEFAULT NULL,
  p_old_values jsonb DEFAULT NULL,
  p_new_values jsonb DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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