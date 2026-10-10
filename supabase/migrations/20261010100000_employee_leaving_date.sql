-- An employee's leaving date. From that date the employee is inactive, and so is
-- their ERP login (same email), so a person who has left cannot open the ERP.
-- A login switched off this way is not switched on again by itself: if the
-- leaving date is taken back, an admin turns the login on in Users & Access.

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS leaving_date date,
  ADD COLUMN IF NOT EXISTS leaving_reason text;

CREATE OR REPLACE FUNCTION public.ist_today() RETURNS date
LANGUAGE sql STABLE SET search_path TO '' AS $$ SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date $$;
GRANT EXECUTE ON FUNCTION public.ist_today() TO authenticated;

-- Status follows the leaving date.
CREATE OR REPLACE FUNCTION public.employees_leaving_status() RETURNS trigger
LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN
  IF NEW.leaving_date IS NOT NULL AND NEW.leaving_date < NEW.hire_date THEN
    RAISE EXCEPTION 'Leaving date % is before the joining date %', to_char(NEW.leaving_date, 'DD-MM-YYYY'), to_char(NEW.hire_date, 'DD-MM-YYYY');
  END IF;
  IF NEW.leaving_date IS NOT NULL AND NEW.leaving_date <= public.ist_today() THEN
    IF NEW.status IN ('active', 'on_leave') THEN NEW.status := 'inactive'; END IF;
  ELSIF TG_OP = 'UPDATE' AND OLD.leaving_date IS NOT NULL AND OLD.leaving_date <= public.ist_today()
        AND NEW.leaving_date IS DISTINCT FROM OLD.leaving_date
        AND OLD.status = 'inactive' AND NEW.status = 'inactive' THEN
    -- The leaving date was taken back or moved ahead: working again.
    NEW.status := 'active';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_employees_leaving ON public.employees;
CREATE TRIGGER trg_employees_leaving BEFORE INSERT OR UPDATE OF leaving_date, status ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.employees_leaving_status();

-- Logins of people whose leaving date has come.
CREATE OR REPLACE FUNCTION public.employees_close_logins() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF NEW.leaving_date IS NOT NULL AND NEW.leaving_date <= public.ist_today() AND NULLIF(trim(NEW.email), '') IS NOT NULL THEN
    UPDATE public.user_accounts SET is_active = false, updated_at = now()
     WHERE lower(email) = lower(trim(NEW.email)) AND is_active AND role <> 'admin';
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_employees_close_logins ON public.employees;
CREATE TRIGGER trg_employees_close_logins AFTER INSERT OR UPDATE OF leaving_date, status, email ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.employees_close_logins();

-- Run every night (and whenever the HR page opens): dates that have now come.
CREATE OR REPLACE FUNCTION public.employees_apply_leaving() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE n integer;
BEGIN
  UPDATE public.employees SET status = 'inactive', updated_at = now()
   WHERE leaving_date <= public.ist_today() AND status IN ('active', 'on_leave');
  GET DIAGNOSTICS n = ROW_COUNT;
  UPDATE public.user_accounts ua SET is_active = false, updated_at = now()
    FROM public.employees e
   WHERE e.leaving_date <= public.ist_today() AND NULLIF(trim(e.email), '') IS NOT NULL
     AND lower(ua.email) = lower(trim(e.email)) AND ua.is_active AND ua.role <> 'admin';
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.employees_apply_leaving() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.employees_apply_leaving() TO authenticated;

SELECT public.employees_apply_leaving();

-- Employees are read column by column (salary, IDs and bank stay hidden); the
-- leaving date and reason are not sensitive.
GRANT SELECT (leaving_date, leaving_reason) ON public.employees TO authenticated;
