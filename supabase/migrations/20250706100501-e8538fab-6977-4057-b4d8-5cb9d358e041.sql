-- Add the missing admin user to user_accounts table
INSERT INTO public.user_accounts (
  id,
  email,
  full_name,
  role,
  is_active,
  department_id
) VALUES (
  gen_random_uuid(),
  'ankitm@grammyelectronics.com',
  'Ankit M',
  'admin',
  true,
  (SELECT id FROM departments WHERE name = 'Management' LIMIT 1)
)
ON CONFLICT (email) DO NOTHING;