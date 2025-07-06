-- Fix user profile ID mismatch for ankitm@grammyelectronics.com
-- Update the user_accounts ID to match the Supabase Auth user ID
UPDATE user_accounts 
SET id = '77ef8f1b-c986-4d0b-900f-4badfb095687'
WHERE id = '122afa15-a4ac-4c13-90a1-e62517bddab2' 
AND email = 'ankitm@grammyelectronics.com';