-- Every night at 00:05 India time (18:35 UTC) leaving dates that have come are applied.
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'employees-leaving';
SELECT cron.schedule('employees-leaving', '35 18 * * *', $$SELECT public.employees_apply_leaving()$$);
