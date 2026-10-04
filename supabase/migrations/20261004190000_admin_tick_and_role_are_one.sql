-- Undo the rename: the "Admin" department is how admins are made.
UPDATE public.departments SET name = 'Admin' WHERE name = 'All modules';

-- The Admin tick (department) and the Role (Admin / User) were two switches
-- that could disagree: the PLM account had the Admin tick removed but its Role
-- still said Admin, so it stayed admin. They are now one switch, kept in step
-- both ways: tick Admin -> role admin; untick -> role user; and the reverse.
CREATE OR REPLACE FUNCTION public.admin_tick_to_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE r record := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
BEGIN
  IF (SELECT name FROM public.departments WHERE id = r.department_id) <> 'Admin' THEN RETURN NULL; END IF;
  UPDATE public.user_accounts
     SET role = CASE WHEN EXISTS (SELECT 1 FROM public.user_departments ud JOIN public.departments d ON d.id = ud.department_id
                                    WHERE ud.user_id = r.user_id AND d.name = 'Admin') THEN 'admin' ELSE 'user' END
   WHERE id = r.user_id
     AND role IS DISTINCT FROM CASE WHEN EXISTS (SELECT 1 FROM public.user_departments ud JOIN public.departments d ON d.id = ud.department_id
                                    WHERE ud.user_id = r.user_id AND d.name = 'Admin') THEN 'admin' ELSE 'user' END;
  RETURN NULL;
END $function$;
DROP TRIGGER IF EXISTS trg_admin_tick_to_role ON public.user_departments;
CREATE TRIGGER trg_admin_tick_to_role AFTER INSERT OR DELETE ON public.user_departments
  FOR EACH ROW EXECUTE FUNCTION public.admin_tick_to_role();

CREATE OR REPLACE FUNCTION public.admin_role_to_tick()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_dept uuid := (SELECT id FROM public.departments WHERE name = 'Admin' LIMIT 1);
BEGIN
  IF v_dept IS NULL OR NEW.role IS NOT DISTINCT FROM OLD.role THEN RETURN NULL; END IF;
  IF NEW.role = 'admin' THEN
    INSERT INTO public.user_departments (user_id, department_id, granted_by)
    SELECT NEW.id, v_dept, auth.uid()
     WHERE NOT EXISTS (SELECT 1 FROM public.user_departments WHERE user_id = NEW.id AND department_id = v_dept);
  ELSE
    DELETE FROM public.user_departments WHERE user_id = NEW.id AND department_id = v_dept;
  END IF;
  RETURN NULL;
END $function$;
DROP TRIGGER IF EXISTS trg_admin_role_to_tick ON public.user_accounts;
CREATE TRIGGER trg_admin_role_to_tick AFTER UPDATE OF role ON public.user_accounts
  FOR EACH ROW EXECUTE FUNCTION public.admin_role_to_tick();

-- Line everyone up: admin if either switch said admin, except the PLM account,
-- whose Admin tick was removed on purpose.
UPDATE public.user_accounts ua SET role = 'admin'
 WHERE ua.role <> 'admin' AND EXISTS (SELECT 1 FROM public.user_departments ud JOIN public.departments d ON d.id = ud.department_id
                                       WHERE ud.user_id = ua.id AND d.name = 'Admin');
INSERT INTO public.user_departments (user_id, department_id)
SELECT ua.id, d.id FROM public.user_accounts ua, public.departments d
 WHERE d.name = 'Admin' AND ua.role = 'admin'
   AND NOT EXISTS (SELECT 1 FROM public.user_departments ud WHERE ud.user_id = ua.id AND ud.department_id = d.id);
