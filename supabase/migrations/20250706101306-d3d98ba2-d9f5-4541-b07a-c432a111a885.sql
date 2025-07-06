-- Add the missing admin user to user_accounts table
INSERT INTO public.user_accounts (
  id,
  username,
  email,
  password_hash,
  full_name,
  role,
  is_active,
  department_id
) VALUES (
  gen_random_uuid(),
  'ankitm',
  'ankitm@grammyelectronics.com',
  'hashed_password_placeholder', -- This will need to be updated with actual auth
  'Ankit M',
  'admin',
  true,
  (SELECT id FROM departments WHERE name = 'Management' LIMIT 1)
)
ON CONFLICT (email) DO NOTHING;