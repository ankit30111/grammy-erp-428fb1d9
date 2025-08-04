-- Fix user_accounts table schema issue
-- The password_hash column should be nullable since Supabase Auth handles authentication
ALTER TABLE user_accounts ALTER COLUMN password_hash DROP NOT NULL;

-- Set a default value to indicate passwords are managed by Supabase Auth
ALTER TABLE user_accounts ALTER COLUMN password_hash SET DEFAULT 'managed_by_supabase_auth';