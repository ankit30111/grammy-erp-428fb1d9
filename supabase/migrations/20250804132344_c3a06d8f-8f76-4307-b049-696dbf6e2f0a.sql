-- Fix security issues by updating function search paths

-- Update handle_new_auth_user function to have proper search path
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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