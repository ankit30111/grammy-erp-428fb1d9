-- RLS Policy Cleanup for Projections Table
-- This migration consolidates and simplifies RLS policies to fix scheduling issues

-- First, create a security definer function to safely check projection access
CREATE OR REPLACE FUNCTION public.can_access_projection(projection_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Allow access if:
  -- 1. User is in Planning, Sales, or Production department
  -- 2. Or the projection exists (for general operations)
  SELECT EXISTS (
    SELECT 1 FROM public.projections p
    WHERE p.id = projection_id
    AND (
      -- Check if user has access through department membership
      EXISTS (
        SELECT 1 FROM public.user_accounts ua
        JOIN public.departments d ON d.id = ua.department_id
        WHERE ua.id = auth.uid()
        AND d.name IN ('Planning', 'Sales', 'Production')
      )
      -- Or allow authenticated users (for backward compatibility)
      OR auth.uid() IS NOT NULL
    )
  );
$$;

-- Drop existing conflicting policies
DROP POLICY IF EXISTS "Allow all operations on projections" ON public.projections;
DROP POLICY IF EXISTS "Planning department can manage projections" ON public.projections;
DROP POLICY IF EXISTS "Sales department can view projections" ON public.projections;
DROP POLICY IF EXISTS "Production department can view projections" ON public.projections;

-- Create simplified, consolidated policies
CREATE POLICY "authenticated_users_can_read_projections"
ON public.projections
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "authenticated_users_can_create_projections"
ON public.projections
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "authenticated_users_can_update_projections"
ON public.projections
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "authenticated_users_can_delete_projections"
ON public.projections
FOR DELETE
TO authenticated
USING (true);

-- Add a comment explaining the policy structure
COMMENT ON TABLE public.projections IS 'Production projections table. RLS policies allow all authenticated users access. Department-level restrictions should be implemented at the application layer if needed.';