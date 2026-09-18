-- Two gaps the rebuild left, both confirmed with Ankit on 2026-09-18.
--
-- 1. LINE ASSIGNMENT
--    The old system stored production lines on the voucher as a JSONB map keyed
--    by BOM category: {sub_assembly: "Line 1", main_assembly: "Line 2"}. That was
--    wrong twice over: it keyed by category rather than by what is actually being
--    built, and it stored the line's NAME, so renaming a line silently orphaned
--    every voucher referencing it.
--
--    The rebuild replaced it with a single production_line_id on the order, which
--    is wrong the other way: a voucher sometimes runs on one line and sometimes
--    splits across several.
--
--    Correct model: a voucher has many line assignments, each naming the line and
--    the part being built there. part_id NULL means the finished good itself;
--    part_id set means that sub-assembly from the BOM. Lines are plant assets
--    named "Line 1", "Line 2" - a line is never a category.
--
--    production_order_lines is the single owner of line assignment.
--    production_orders.production_line_id is therefore dropped: keeping both would
--    be two writers for one fact, which is the defect class this rebuild exists to
--    remove.
--
-- 2. REJECTION ATTRIBUTION
--    line_rejections lost rejected_by / remarks / rejection_date. That is real
--    operational data: the "User Mishandling" verdict is meaningless without
--    knowing who, and the HR performance review screen reads it.
--
-- Safe to run: production_orders, production_schedules and line_rejections are all
-- empty (verified before writing this), so nothing needs backfilling.

-- ---------------------------------------------------------------------------
-- 1. production_order_lines
-- ---------------------------------------------------------------------------
CREATE TABLE public.production_order_lines (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id uuid NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
  production_line_id  uuid NOT NULL REFERENCES public.production_lines(id),
  -- NULL = the finished good itself. Set = a sub-assembly from the BOM.
  part_id             uuid REFERENCES public.parts(id),
  -- NULL = the whole order quantity runs on this line.
  quantity            numeric CHECK (quantity IS NULL OR quantity > 0),
  notes               text,
  created_by          uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- NULLs compare as distinct in a plain UNIQUE, so the "whole voucher" case needs
-- its own partial index or it could be inserted twice for the same line.
CREATE UNIQUE INDEX production_order_lines_fg_uniq
  ON public.production_order_lines (production_order_id, production_line_id)
  WHERE part_id IS NULL;

CREATE UNIQUE INDEX production_order_lines_part_uniq
  ON public.production_order_lines (production_order_id, production_line_id, part_id)
  WHERE part_id IS NOT NULL;

CREATE INDEX production_order_lines_order_idx ON public.production_order_lines (production_order_id);
CREATE INDEX production_order_lines_line_idx  ON public.production_order_lines (production_line_id);

ALTER TABLE public.production_order_lines ENABLE ROW LEVEL SECURITY;

-- Plant scope is inherited from the parent order, matching production_orders.
CREATE POLICY production_order_lines_read ON public.production_order_lines
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.production_orders o
    WHERE o.id = production_order_id AND public.in_plant(o.plant_id)
  ));

CREATE POLICY production_order_lines_write ON public.production_order_lines
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.production_orders o
    WHERE o.id = production_order_id
      AND public.in_plant(o.plant_id) AND public.has_role('production')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.production_orders o
    WHERE o.id = production_order_id
      AND public.in_plant(o.plant_id) AND public.has_role('production')
  ));

CREATE TRIGGER trg_production_order_lines_touch
  BEFORE UPDATE ON public.production_order_lines
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- One owner for line assignment.
ALTER TABLE public.production_orders DROP COLUMN production_line_id;

-- ---------------------------------------------------------------------------
-- 2. line_rejections attribution
-- ---------------------------------------------------------------------------
ALTER TABLE public.line_rejections
  ADD COLUMN rejected_by     uuid REFERENCES public.employees(id),
  ADD COLUMN remarks         text,
  ADD COLUMN rejection_date  date NOT NULL DEFAULT CURRENT_DATE;

CREATE INDEX line_rejections_rejected_by_idx
  ON public.line_rejections (rejected_by) WHERE rejected_by IS NOT NULL;

COMMENT ON COLUMN public.line_rejections.rejected_by IS
  'Employee attributed with the rejection. Feeds the User Mishandling verdict and HR performance reviews.';
