
-- =============================================
-- DASH MODULE - Complete Database Schema
-- =============================================

-- Enums
CREATE TYPE public.dash_product_category AS ENUM (
  'Party Speaker', 'Tower Speaker', 'Soundbar', 'Multimedia Speaker', 
  'Portable Speaker', 'Home Theatre', 'Subwoofer', 'Other'
);

CREATE TYPE public.dash_product_status AS ENUM ('Active', 'Discontinued');

CREATE TYPE public.dash_factory_order_status AS ENUM (
  'Draft', 'Ordered', 'In Production', 'Dispatched', 'Received', 'QC Pending', 'QC Done'
);

CREATE TYPE public.dash_qc_status AS ENUM ('Pending', 'Passed', 'Failed', 'Partial');

CREATE TYPE public.dash_customer_type AS ENUM ('Distributor', 'Dealer', 'Retailer', 'Institutional');

CREATE TYPE public.dash_payment_status AS ENUM ('Pending', 'Partial', 'Paid');

CREATE TYPE public.dash_dispatch_status AS ENUM ('Pending', 'Dispatched', 'Delivered');

CREATE TYPE public.dash_repair_status AS ENUM (
  'Open', 'Assigned', 'In Progress', 'Awaiting Parts', 'Repaired', 'Replaced', 'Closed'
);

CREATE TYPE public.dash_movement_type AS ENUM (
  'GRN_RECEIPT', 'SALES_DISPATCH', 'DAMAGE', 'RETURN', 'ADJUSTMENT', 'TRANSFER'
);

CREATE TYPE public.dash_artwork_type AS ENUM ('box_artwork', 'product_artwork', 'marketing_creative');

CREATE TYPE public.dash_spare_dispatch_type AS ENUM ('Service', 'Customer', 'Warehouse');

-- =============================================
-- 1. dash_products - Product/SKU Master
-- =============================================
CREATE TABLE public.dash_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name TEXT NOT NULL,
  model_number TEXT NOT NULL UNIQUE,
  category public.dash_product_category NOT NULL DEFAULT 'Other',
  description TEXT,
  technical_specs JSONB DEFAULT '{}',
  mrp NUMERIC(12,2) NOT NULL DEFAULT 0,
  dealer_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  distributor_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  barcode_ean TEXT,
  warranty_period_months INTEGER NOT NULL DEFAULT 12,
  status public.dash_product_status NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dash_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view dash products" ON public.dash_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert dash products" ON public.dash_products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update dash products" ON public.dash_products FOR UPDATE TO authenticated USING (true);

-- =============================================
-- 2. dash_product_artwork
-- =============================================
CREATE TABLE public.dash_product_artwork (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.dash_products(id) ON DELETE CASCADE,
  file_type public.dash_artwork_type NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  uploaded_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dash_product_artwork ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage dash artwork" ON public.dash_product_artwork FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- 3. dash_factory_orders
-- =============================================
CREATE TABLE public.dash_factory_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fo_number TEXT NOT NULL UNIQUE,
  product_id UUID NOT NULL REFERENCES public.dash_products(id),
  quantity_ordered INTEGER NOT NULL DEFAULT 0,
  cost_per_unit NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  expected_production_date DATE,
  dispatch_date DATE,
  shipment_tracking_number TEXT,
  factory_invoice_url TEXT,
  status public.dash_factory_order_status NOT NULL DEFAULT 'Draft',
  batch_number TEXT,
  qc_status public.dash_qc_status NOT NULL DEFAULT 'Pending',
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dash_factory_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view dash factory orders" ON public.dash_factory_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert dash factory orders" ON public.dash_factory_orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update dash factory orders" ON public.dash_factory_orders FOR UPDATE TO authenticated USING (true);

-- =============================================
-- 4. dash_inventory
-- =============================================
CREATE TABLE public.dash_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.dash_products(id),
  batch_number TEXT,
  total_stock INTEGER NOT NULL DEFAULT 0,
  reserved_stock INTEGER NOT NULL DEFAULT 0,
  damaged_stock INTEGER NOT NULL DEFAULT 0,
  in_transit_stock INTEGER NOT NULL DEFAULT 0,
  location TEXT DEFAULT 'DASH Warehouse',
  low_stock_threshold INTEGER NOT NULL DEFAULT 10,
  unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dash_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage dash inventory" ON public.dash_inventory FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- 5. dash_inventory_movements
-- =============================================
CREATE TABLE public.dash_inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.dash_products(id),
  batch_number TEXT,
  movement_type public.dash_movement_type NOT NULL,
  quantity INTEGER NOT NULL,
  reference_id UUID,
  reference_type TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dash_inventory_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage dash movements" ON public.dash_inventory_movements FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- 6. dash_customers
-- =============================================
CREATE TABLE public.dash_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  customer_type public.dash_customer_type NOT NULL DEFAULT 'Dealer',
  gst_number TEXT,
  credit_limit NUMERIC(14,2) NOT NULL DEFAULT 0,
  outstanding_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  territory TEXT,
  assigned_sales_manager TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dash_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view dash customers" ON public.dash_customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert dash customers" ON public.dash_customers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update dash customers" ON public.dash_customers FOR UPDATE TO authenticated USING (true);

-- =============================================
-- 7. dash_sales_orders
-- =============================================
CREATE TABLE public.dash_sales_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  so_number TEXT NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES public.dash_customers(id),
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  scheme_details TEXT,
  payment_status public.dash_payment_status NOT NULL DEFAULT 'Pending',
  dispatch_status public.dash_dispatch_status NOT NULL DEFAULT 'Pending',
  e_invoice_url TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dash_sales_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage dash sales orders" ON public.dash_sales_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- 8. dash_sales_order_items
-- =============================================
CREATE TABLE public.dash_sales_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id UUID NOT NULL REFERENCES public.dash_sales_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.dash_products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  batch_number TEXT
);

ALTER TABLE public.dash_sales_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage dash SO items" ON public.dash_sales_order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- 9. dash_service_tickets
-- =============================================
CREATE TABLE public.dash_service_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT NOT NULL UNIQUE,
  product_id UUID NOT NULL REFERENCES public.dash_products(id),
  serial_number TEXT,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  warranty_valid BOOLEAN NOT NULL DEFAULT false,
  issue_description TEXT NOT NULL,
  assigned_engineer TEXT,
  repair_status public.dash_repair_status NOT NULL DEFAULT 'Open',
  replacement_approved BOOLEAN NOT NULL DEFAULT false,
  replacement_approval_notes TEXT,
  service_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ
);

ALTER TABLE public.dash_service_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage dash service tickets" ON public.dash_service_tickets FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- 10. dash_service_history
-- =============================================
CREATE TABLE public.dash_service_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.dash_service_tickets(id) ON DELETE CASCADE,
  serial_number TEXT,
  action_type TEXT NOT NULL,
  description TEXT,
  performed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dash_service_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage dash service history" ON public.dash_service_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- 11. dash_spare_parts
-- =============================================
CREATE TABLE public.dash_spare_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spare_code TEXT NOT NULL UNIQUE,
  spare_name TEXT NOT NULL,
  description TEXT,
  linked_product_ids JSONB DEFAULT '[]',
  cost_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  selling_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dash_spare_parts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage dash spares" ON public.dash_spare_parts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- 12. dash_spare_consumption
-- =============================================
CREATE TABLE public.dash_spare_consumption (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spare_id UUID NOT NULL REFERENCES public.dash_spare_parts(id),
  ticket_id UUID REFERENCES public.dash_service_tickets(id),
  quantity_used INTEGER NOT NULL DEFAULT 1,
  consumed_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dash_spare_consumption ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage dash spare consumption" ON public.dash_spare_consumption FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- 13. dash_spare_dispatch_log
-- =============================================
CREATE TABLE public.dash_spare_dispatch_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spare_id UUID NOT NULL REFERENCES public.dash_spare_parts(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  dispatched_to TEXT,
  dispatch_type public.dash_spare_dispatch_type NOT NULL DEFAULT 'Service',
  reference_number TEXT,
  notes TEXT,
  dispatched_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dash_spare_dispatch_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage dash spare dispatch" ON public.dash_spare_dispatch_log FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- 14. dash_payments
-- =============================================
CREATE TABLE public.dash_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.dash_customers(id),
  sales_order_id UUID REFERENCES public.dash_sales_orders(id),
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_mode TEXT,
  reference_number TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dash_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage dash payments" ON public.dash_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- Auto-number generation functions
-- =============================================

CREATE OR REPLACE FUNCTION public.generate_dash_fo_number()
RETURNS TEXT LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE
  current_month TEXT;
  next_seq INTEGER;
BEGIN
  current_month := LPAD(EXTRACT(MONTH FROM CURRENT_DATE)::TEXT, 2, '0');
  SELECT COALESCE(MAX(CAST(SUBSTRING(fo_number FROM 'FO-\d{2}-(\d+)') AS INTEGER)), 0) + 1
  INTO next_seq FROM public.dash_factory_orders WHERE fo_number LIKE 'FO-' || current_month || '-%';
  RETURN 'FO-' || current_month || '-' || LPAD(next_seq::TEXT, 3, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_dash_so_number()
RETURNS TEXT LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE
  current_month TEXT;
  next_seq INTEGER;
BEGIN
  current_month := LPAD(EXTRACT(MONTH FROM CURRENT_DATE)::TEXT, 2, '0');
  SELECT COALESCE(MAX(CAST(SUBSTRING(so_number FROM 'DSO-\d{2}-(\d+)') AS INTEGER)), 0) + 1
  INTO next_seq FROM public.dash_sales_orders WHERE so_number LIKE 'DSO-' || current_month || '-%';
  RETURN 'DSO-' || current_month || '-' || LPAD(next_seq::TEXT, 3, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_dash_ticket_number()
RETURNS TEXT LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE
  next_seq INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(ticket_number FROM 'DST-(\d+)') AS INTEGER)), 0) + 1
  INTO next_seq FROM public.dash_service_tickets;
  RETURN 'DST-' || LPAD(next_seq::TEXT, 5, '0');
END;
$$;

-- Triggers for auto-number
CREATE OR REPLACE FUNCTION public.set_dash_fo_number() RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.fo_number IS NULL OR NEW.fo_number = '' THEN
    NEW.fo_number := public.generate_dash_fo_number();
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_dash_fo_number BEFORE INSERT ON public.dash_factory_orders FOR EACH ROW EXECUTE FUNCTION public.set_dash_fo_number();

CREATE OR REPLACE FUNCTION public.set_dash_so_number() RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.so_number IS NULL OR NEW.so_number = '' THEN
    NEW.so_number := public.generate_dash_so_number();
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_dash_so_number BEFORE INSERT ON public.dash_sales_orders FOR EACH ROW EXECUTE FUNCTION public.set_dash_so_number();

CREATE OR REPLACE FUNCTION public.set_dash_ticket_number() RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.ticket_number IS NULL OR NEW.ticket_number = '' THEN
    NEW.ticket_number := public.generate_dash_ticket_number();
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_dash_ticket_number BEFORE INSERT ON public.dash_service_tickets FOR EACH ROW EXECUTE FUNCTION public.set_dash_ticket_number();

-- Updated_at triggers
CREATE TRIGGER trg_dash_products_updated BEFORE UPDATE ON public.dash_products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_dash_factory_orders_updated BEFORE UPDATE ON public.dash_factory_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_dash_inventory_updated BEFORE UPDATE ON public.dash_inventory FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_dash_customers_updated BEFORE UPDATE ON public.dash_customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_dash_sales_orders_updated BEFORE UPDATE ON public.dash_sales_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_dash_service_tickets_updated BEFORE UPDATE ON public.dash_service_tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_dash_spare_parts_updated BEFORE UPDATE ON public.dash_spare_parts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Inventory auto-update on factory order GRN
CREATE OR REPLACE FUNCTION public.dash_update_inventory_on_grn()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = 'Received' AND OLD.status != 'Received' THEN
    INSERT INTO public.dash_inventory (product_id, batch_number, total_stock, unit_cost)
    VALUES (NEW.product_id, NEW.batch_number, NEW.quantity_ordered, NEW.cost_per_unit)
    ON CONFLICT (id) DO NOTHING;
    
    -- Also update if exists by product+batch
    UPDATE public.dash_inventory 
    SET total_stock = total_stock + NEW.quantity_ordered, unit_cost = NEW.cost_per_unit, updated_at = now()
    WHERE product_id = NEW.product_id AND batch_number = NEW.batch_number;
    
    IF NOT FOUND THEN
      INSERT INTO public.dash_inventory (product_id, batch_number, total_stock, unit_cost)
      VALUES (NEW.product_id, NEW.batch_number, NEW.quantity_ordered, NEW.cost_per_unit);
    END IF;

    INSERT INTO public.dash_inventory_movements (product_id, batch_number, movement_type, quantity, reference_id, reference_type, notes)
    VALUES (NEW.product_id, NEW.batch_number, 'GRN_RECEIPT', NEW.quantity_ordered, NEW.id, 'FACTORY_ORDER', 'GRN received for FO: ' || NEW.fo_number);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_dash_grn_inventory AFTER UPDATE ON public.dash_factory_orders FOR EACH ROW EXECUTE FUNCTION public.dash_update_inventory_on_grn();

-- Storage bucket for DASH documents
INSERT INTO storage.buckets (id, name, public) VALUES ('dash-documents', 'dash-documents', true);
CREATE POLICY "Authenticated users can manage dash documents" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'dash-documents') WITH CHECK (bucket_id = 'dash-documents');

-- Indexes for performance
CREATE INDEX idx_dash_products_category ON public.dash_products(category);
CREATE INDEX idx_dash_products_status ON public.dash_products(status);
CREATE INDEX idx_dash_factory_orders_status ON public.dash_factory_orders(status);
CREATE INDEX idx_dash_factory_orders_product ON public.dash_factory_orders(product_id);
CREATE INDEX idx_dash_inventory_product ON public.dash_inventory(product_id);
CREATE INDEX idx_dash_customers_type ON public.dash_customers(customer_type);
CREATE INDEX idx_dash_sales_orders_customer ON public.dash_sales_orders(customer_id);
CREATE INDEX idx_dash_sales_orders_status ON public.dash_sales_orders(payment_status);
CREATE INDEX idx_dash_service_tickets_status ON public.dash_service_tickets(repair_status);
CREATE INDEX idx_dash_service_tickets_serial ON public.dash_service_tickets(serial_number);
CREATE INDEX idx_dash_spare_parts_code ON public.dash_spare_parts(spare_code);
CREATE INDEX idx_dash_payments_customer ON public.dash_payments(customer_id);
