-- OQC verdicts had nowhere to live.
--
-- The app writes production_orders.status = 'OQC_PASSED' / 'OQC_FAILED' after final
-- inspection, but schedule_status had neither, so every OQC verdict failed at the
-- database and the "OQC Rejections" screen could never return a row.
--
-- Mapping OQC_PASSED onto COMPLETED was the obvious shortcut and is wrong: the
-- pending-OQC queue is exactly the set of COMPLETED orders not yet inspected, so
-- collapsing them makes "awaiting inspection" and "passed inspection" the same set
-- and the queue never empties.
--
-- Adding both members keeps the three states distinct:
--   COMPLETED   produced, awaiting final inspection
--   OQC_PASSED  inspected and cleared for dispatch
--   OQC_FAILED  inspected and held for rework
ALTER TYPE public.schedule_status ADD VALUE IF NOT EXISTS 'OQC_PASSED' AFTER 'COMPLETED';
ALTER TYPE public.schedule_status ADD VALUE IF NOT EXISTS 'OQC_FAILED' AFTER 'OQC_PASSED';
