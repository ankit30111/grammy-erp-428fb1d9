-- Add basic departments to the departments table
INSERT INTO public.departments (name, description) VALUES
  ('Management', 'Management and Administration'),
  ('Production', 'Manufacturing and Production Operations'),
  ('Quality', 'Quality Control and Assurance'),
  ('Store', 'Inventory and Materials Management'),
  ('Purchase', 'Procurement and Purchasing'),
  ('Planning', 'Production Planning and Control'),
  ('HR', 'Human Resources'),
  ('Sales', 'Sales and Marketing'),
  ('R&D', 'Research and Development')
ON CONFLICT (name) DO NOTHING;