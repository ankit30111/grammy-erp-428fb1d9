-- Restore points, because this project has no backups to fall back on.
--
-- Checked before writing this: the Supabase project reports pitr_enabled=false
-- and an empty backup list. There is no point-in-time recovery and nothing
-- restorable sitting on the platform. Real production data is about to go in.
-- Until now every mistake has cost a test row; from here a mistake costs the
-- store's actual stock, and there is currently no way back.
--
-- The whole database is 5 MB and 4,298 rows, so a snapshot is cheap enough to
-- take before every change rather than only before the frightening ones. Each
-- one copies every table in public into its own schema and records what it was
-- for. Nothing is deleted to make room; they are pruned deliberately.
--
--   select public.create_restore_point('before the billing migration');
--   select * from public.restore_points;
--   select public.restore_from_point('snap_20260921_093000');   -- destructive
--
-- This is a safety net inside the same database, which is the fastest thing to
-- reach for and the wrong thing to rely on alone: it does not survive the
-- project being deleted. It is paired with a file export kept outside.

CREATE SCHEMA IF NOT EXISTS snapshots;

CREATE TABLE IF NOT EXISTS public.restore_points (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_name text NOT NULL UNIQUE,
  label       text NOT NULL,
  taken_at    timestamptz NOT NULL DEFAULT now(),
  taken_by    uuid,
  table_count int NOT NULL DEFAULT 0,
  row_count   bigint NOT NULL DEFAULT 0
);

COMMENT ON TABLE public.restore_points IS
  'Every snapshot taken, what it was for, and how much it holds. The snapshot data itself lives in the snapshots schema.';

-- ---------------------------------------------------------------------------
-- Take one
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_restore_point(p_label text)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_schema text := 'snap_' || to_char(now(), 'YYYYMMDD_HH24MISS');
  v_tables int := 0;
  v_rows   bigint := 0;
  v_n      bigint;
  r        record;
BEGIN
  IF p_label IS NULL OR btrim(p_label) = '' THEN
    -- A snapshot nobody can identify is a snapshot nobody will dare restore.
    RAISE EXCEPTION 'Give the restore point a label saying what is about to change';
  END IF;

  EXECUTE format('CREATE SCHEMA %I', v_schema);

  FOR r IN
    SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r'
     ORDER BY c.relname
  LOOP
    -- restore_points is the index of the snapshots; copying it into a snapshot
    -- would make restoring one erase the record of all the others.
    CONTINUE WHEN r.relname = 'restore_points';

    EXECUTE format('CREATE TABLE %I.%I AS TABLE public.%I', v_schema, r.relname, r.relname);
    EXECUTE format('SELECT count(*) FROM %I.%I', v_schema, r.relname) INTO v_n;
    v_tables := v_tables + 1;
    v_rows := v_rows + v_n;
  END LOOP;

  INSERT INTO public.restore_points (schema_name, label, taken_by, table_count, row_count)
  VALUES (v_schema, btrim(p_label), auth.uid(), v_tables, v_rows);

  RETURN v_schema;
END;
$$;

-- ---------------------------------------------------------------------------
-- Go back to one
-- ---------------------------------------------------------------------------
-- Destructive, and deliberately awkward to call by accident.
--
-- The obvious implementation is `SET session_replication_role = replica`, which
-- turns off triggers and foreign keys for the transaction. Supabase does not
-- grant that parameter - it is superuser-only - and finding that out at restore
-- time, with the data already wrong, would be the worst possible moment. So the
-- restore does the work itself:
--
--   * user triggers are disabled per table, which the table owner may do, so the
--     recompute triggers do not fire on every restored row and rewrite the very
--     figures being restored;
--   * tables are emptied child-first and refilled parent-first, in an order
--     worked out from the foreign keys, so nothing is ever orphaned mid-restore.
--
-- Verified by changing a row, restoring, and watching it come back.
CREATE OR REPLACE FUNCTION public.restore_from_point(p_schema text)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order  text[] := '{}';
  v_left   text[];
  v_tables int := 0;
  v_cols   text;
  v_t      text;
  v_moved  boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.restore_points WHERE schema_name = p_schema) THEN
    RAISE EXCEPTION 'No restore point called "%"', p_schema;
  END IF;

  SELECT array_agg(c.relname ORDER BY c.relname) INTO v_left
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = p_schema AND c.relkind = 'r'
     AND EXISTS (
       SELECT 1 FROM pg_class c2 JOIN pg_namespace n2 ON n2.oid = c2.relnamespace
        WHERE n2.nspname = 'public' AND c2.relname = c.relname AND c2.relkind = 'r'
     );

  -- Parents before children. Each pass takes every table whose foreign keys all
  -- point at tables already placed (or at itself). A cycle would leave the
  -- remainder unplaceable, so it is appended rather than looping forever - with
  -- triggers off the insert still succeeds, and saying so beats hanging.
  LOOP
    v_moved := false;
    FOREACH v_t IN ARRAY v_left LOOP
      CONTINUE WHEN v_t = ANY(v_order);
      IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint con
          JOIN pg_class ch ON ch.oid = con.conrelid
          JOIN pg_class pa ON pa.oid = con.confrelid
          JOIN pg_namespace nch ON nch.oid = ch.relnamespace
         WHERE con.contype = 'f' AND nch.nspname = 'public'
           AND ch.relname = v_t
           AND pa.relname <> v_t
           AND pa.relname = ANY(v_left)
           AND NOT (pa.relname = ANY(v_order))
      ) THEN
        v_order := v_order || v_t;
        v_moved := true;
      END IF;
    END LOOP;
    EXIT WHEN NOT v_moved;
  END LOOP;

  FOREACH v_t IN ARRAY v_left LOOP
    IF NOT (v_t = ANY(v_order)) THEN
      v_order := v_order || v_t;
    END IF;
  END LOOP;

  FOREACH v_t IN ARRAY v_order LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER USER', v_t);
  END LOOP;

  -- Children first, so a delete never strands a row that points at it.
  FOR i IN REVERSE array_length(v_order, 1) .. 1 LOOP
    EXECUTE format('DELETE FROM public.%I', v_order[i]);
  END LOOP;

  FOREACH v_t IN ARRAY v_order LOOP
    -- Generated columns cannot be written to, so they are left out of both sides
    -- of the copy and recomputed as the rows land. A restore that tried to
    -- insert part_categories.kind would fail outright.
    SELECT string_agg(format('%I', a.attname), ', ' ORDER BY a.attnum)
      INTO v_cols
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = v_t
       AND a.attnum > 0 AND NOT a.attisdropped AND a.attgenerated = ''
       AND EXISTS (
         SELECT 1 FROM pg_attribute a2
           JOIN pg_class c2 ON c2.oid = a2.attrelid
           JOIN pg_namespace n2 ON n2.oid = c2.relnamespace
          WHERE n2.nspname = p_schema AND c2.relname = v_t
            AND a2.attname = a.attname AND a2.attnum > 0 AND NOT a2.attisdropped
       );
    CONTINUE WHEN v_cols IS NULL;

    EXECUTE format('INSERT INTO public.%I (%s) SELECT %s FROM %I.%I',
                   v_t, v_cols, v_cols, p_schema, v_t);
    v_tables := v_tables + 1;
  END LOOP;

  FOREACH v_t IN ARRAY v_order LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE TRIGGER USER', v_t);
  END LOOP;

  RETURN format('Restored %s tables from %s', v_tables, p_schema);
END;
$$;

-- ---------------------------------------------------------------------------
-- Throw one away
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.drop_restore_point(p_schema text)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.restore_points WHERE schema_name = p_schema) THEN
    RAISE EXCEPTION 'No restore point called "%"', p_schema;
  END IF;
  EXECUTE format('DROP SCHEMA IF EXISTS %I CASCADE', p_schema);
  DELETE FROM public.restore_points WHERE schema_name = p_schema;
  RETURN format('Dropped %s', p_schema);
END;
$$;

-- ---------------------------------------------------------------------------
-- Who may do any of this
-- ---------------------------------------------------------------------------
-- Everyone signed in can see that restore points exist and when they were taken,
-- because "was a backup taken before that change?" is a question anybody should
-- be able to answer. Taking, restoring and dropping are admin only.
ALTER TABLE public.restore_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS restore_points_read ON public.restore_points;
CREATE POLICY restore_points_read ON public.restore_points
  FOR SELECT TO authenticated USING (public.has_role(NULL));

GRANT SELECT ON public.restore_points TO authenticated;

REVOKE ALL ON FUNCTION public.create_restore_point(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.restore_from_point(text)  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.drop_restore_point(text)  FROM PUBLIC, anon, authenticated;
