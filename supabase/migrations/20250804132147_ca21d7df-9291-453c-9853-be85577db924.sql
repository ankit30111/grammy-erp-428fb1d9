-- Step 1: Sync all auth.users to user_accounts table with proper conflict handling
-- This will ensure all users who can login are also visible in the management interface

-- First, let's create a function to safely sync auth users to user_accounts
CREATE OR REPLACE FUNCTION sync_auth_users_to_accounts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  auth_user RECORD;
  new_username TEXT;
  username_counter INTEGER;
BEGIN
  -- Loop through all auth.users that don't have corresponding user_accounts records
  FOR auth_user IN 
    SELECT au.id, au.email, au.raw_user_meta_data
    FROM auth.users au
    LEFT JOIN public.user_accounts ua ON au.id = ua.id
    WHERE ua.id IS NULL
      AND NOT EXISTS (SELECT 1 FROM public.user_accounts WHERE email = au.email) -- Avoid email conflicts
  LOOP
    -- Generate unique username from email
    new_username := SPLIT_PART(auth_user.email, '@', 1);
    username_counter := 1;
    
    -- Ensure username is unique
    WHILE EXISTS (SELECT 1 FROM public.user_accounts WHERE username = new_username) LOOP
      new_username := SPLIT_PART(auth_user.email, '@', 1) || username_counter::text;
      username_counter := username_counter + 1;
    END LOOP;
    
    -- Insert the missing user_accounts record
    INSERT INTO public.user_accounts (
      id,
      username,
      email,
      full_name,
      role,
      is_active,
      created_at,
      updated_at
    ) VALUES (
      auth_user.id,
      new_username,
      auth_user.email,
      COALESCE(auth_user.raw_user_meta_data->>'full_name', ''),
      'user', -- Default role
      true,    -- Default active
      now(),
      now()
    );
    
    RAISE NOTICE 'Synced user: % with username: %', auth_user.email, new_username;
  END LOOP;
  
  -- Report any auth users that have email conflicts but different IDs
  FOR auth_user IN 
    SELECT au.id as auth_id, au.email, ua.id as account_id
    FROM auth.users au
    INNER JOIN public.user_accounts ua ON au.email = ua.email
    WHERE au.id != ua.id
  LOOP
    RAISE NOTICE 'Email conflict found: auth_id=% account_id=% email=%', auth_user.auth_id, auth_user.account_id, auth_user.email;
  END LOOP;
END;
$$;

-- Execute the sync function
SELECT sync_auth_users_to_accounts();

-- Step 2: Create a trigger to automatically sync new auth users to user_accounts
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_username TEXT;
  username_counter INTEGER := 1;
BEGIN
  -- Only proceed if user doesn't already exist in user_accounts
  IF NOT EXISTS (SELECT 1 FROM public.user_accounts WHERE id = NEW.id OR email = NEW.email) THEN
    -- Generate unique username from email
    new_username := SPLIT_PART(NEW.email, '@', 1);
    
    -- Ensure username is unique
    WHILE EXISTS (SELECT 1 FROM public.user_accounts WHERE username = new_username) LOOP
      new_username := SPLIT_PART(NEW.email, '@', 1) || username_counter::text;
      username_counter := username_counter + 1;
    END LOOP;
    
    -- Insert into user_accounts
    INSERT INTO public.user_accounts (
      id,
      username,
      email,
      full_name,
      role,
      is_active,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,
      new_username,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      'user',
      true,
      now(),
      now()
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for new auth users (only if not exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

-- Clean up the sync function as it's no longer needed
DROP FUNCTION IF EXISTS sync_auth_users_to_accounts();