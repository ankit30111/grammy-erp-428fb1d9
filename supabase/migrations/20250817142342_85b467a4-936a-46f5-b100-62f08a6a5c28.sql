-- Fix RLS policies for store_discrepancies to allow admin users with null department_id
DROP POLICY IF EXISTS "Store and admin can manage store discrepancies" ON store_discrepancies;
DROP POLICY IF EXISTS "Store and admin can view store discrepancies" ON store_discrepancies;

-- Create new policies using LEFT JOIN to handle admin users with null department_id
CREATE POLICY "Store and admin can manage store discrepancies"
ON store_discrepancies
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM user_accounts ua
    LEFT JOIN departments d ON ua.department_id = d.id
    WHERE ua.id = auth.uid() 
    AND (ua.role = 'admin' OR d.name = 'Store')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM user_accounts ua
    LEFT JOIN departments d ON ua.department_id = d.id
    WHERE ua.id = auth.uid() 
    AND (ua.role = 'admin' OR d.name = 'Store')
  )
);

CREATE POLICY "Store and admin can view store discrepancies"
ON store_discrepancies
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM user_accounts ua
    LEFT JOIN departments d ON ua.department_id = d.id
    WHERE ua.id = auth.uid() 
    AND (ua.role = 'admin' OR d.name = 'Store')
  )
);

-- Add RLS policies for inventory table (if they don't exist)
CREATE POLICY "Store and admin can manage inventory"
ON inventory
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM user_accounts ua
    LEFT JOIN departments d ON ua.department_id = d.id
    WHERE ua.id = auth.uid() 
    AND (ua.role = 'admin' OR d.name = 'Store')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM user_accounts ua
    LEFT JOIN departments d ON ua.department_id = d.id
    WHERE ua.id = auth.uid() 
    AND (ua.role = 'admin' OR d.name = 'Store')
  )
);

CREATE POLICY "Authenticated users can view inventory"
ON inventory
FOR SELECT
TO authenticated
USING (true);