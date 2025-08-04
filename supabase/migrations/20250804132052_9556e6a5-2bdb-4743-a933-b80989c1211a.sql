-- Step 1: Sync all auth.users to user_accounts table
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
  
  RETURN NEW;
END;
$$;

-- Create trigger for new auth users (only if not exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

-- Step 3: Add function to safely delete users from both auth and user_accounts
CREATE OR REPLACE FUNCTION delete_user_completely(user_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete from user_accounts first (due to foreign key constraints)
  DELETE FROM public.user_accounts WHERE id = user_id;
  
  -- Note: We can't directly delete from auth.users in a regular function
  -- This will need to be handled by the admin edge function
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$;

-- Clean up the sync function as it's no longer needed
DROP FUNCTION IF EXISTS sync_auth_users_to_accounts();