
-- Create production_serial_numbers table to manage serial number assignments
CREATE TABLE public.production_serial_numbers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  production_order_id UUID NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
  starting_serial_number TEXT,
  ending_serial_number TEXT,
  quantity INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  assigned_by UUID,
  assigned_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  UNIQUE(production_order_id)
);

-- Add RLS policies
ALTER TABLE public.production_serial_numbers ENABLE ROW LEVEL SECURITY;

-- Allow all users to view serial number assignments
CREATE POLICY "Allow read access to production serial numbers" ON public.production_serial_numbers
  FOR SELECT USING (true);

-- Allow all users to insert serial number assignments
CREATE POLICY "Allow insert access to production serial numbers" ON public.production_serial_numbers
  FOR INSERT WITH CHECK (true);

-- Allow all users to update serial number assignments
CREATE POLICY "Allow update access to production serial numbers" ON public.production_serial_numbers
  FOR UPDATE USING (true);

-- Add trigger for updated_at
CREATE TRIGGER production_serial_numbers_updated_at
  BEFORE UPDATE ON public.production_serial_numbers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add index for better performance
CREATE INDEX idx_production_serial_numbers_production_order_id ON public.production_serial_numbers(production_order_id);
CREATE INDEX idx_production_serial_numbers_status ON public.production_serial_numbers(status);
