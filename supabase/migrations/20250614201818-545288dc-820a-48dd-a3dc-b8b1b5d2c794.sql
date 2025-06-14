
-- Add RLS policies for production_material_discrepancies table
CREATE POLICY "Users can insert production discrepancies" 
  ON public.production_material_discrepancies 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

CREATE POLICY "Users can view production discrepancies" 
  ON public.production_material_discrepancies 
  FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Users can update production discrepancies" 
  ON public.production_material_discrepancies 
  FOR UPDATE 
  TO authenticated 
  USING (true);
