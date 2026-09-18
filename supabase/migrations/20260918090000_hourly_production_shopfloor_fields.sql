-- hourly_production lost two fields the shop floor actually types in.
--
-- Checked before restoring them: both are operator INPUTS, parsed straight from
-- form fields in HourlyProductionDialog and HourlyProductionEntry - they are not
-- derived from anything the table already holds. Downtime in particular cannot be
-- reconstructed from produced/rejected counts. So they are raw data and belong on
-- the row.
--
-- (Had efficiency been computed from other columns I would have left it out and
-- calculated it in the UI - storing a derived number is how a value ends up with
-- two owners that disagree.)

ALTER TABLE public.hourly_production
  ADD COLUMN downtime_minutes      integer NOT NULL DEFAULT 0
    CHECK (downtime_minutes >= 0 AND downtime_minutes <= 60),
  ADD COLUMN efficiency_percentage integer
    CHECK (efficiency_percentage IS NULL OR (efficiency_percentage >= 0 AND efficiency_percentage <= 200));

COMMENT ON COLUMN public.hourly_production.downtime_minutes IS
  'Minutes lost in this hour slot, entered by the line operator. 0-60.';
COMMENT ON COLUMN public.hourly_production.efficiency_percentage IS
  'Operator-entered efficiency for the hour. Nullable: absent means not recorded, which is different from zero.';
