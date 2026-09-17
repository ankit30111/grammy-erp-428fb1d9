import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
      return json({ error: 'Server not configured for user administration.' }, 500)
    }

    let payload: { userId?: string; newPassword?: string }
    try {
      payload = await req.json()
    } catch {
      return json({ error: 'Invalid request body' }, 400)
    }
    const { userId, newPassword } = payload

    if (!userId || !newPassword) {
      return json({ error: 'userId and newPassword are required' }, 400)
    }
    if (newPassword.length < 6) {
      return json({ error: 'Password must be at least 6 characters long.' }, 400)
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'You are not signed in. Sign in again and retry.' }, 401)
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token)
    if (authError || !user) {
      console.error('Authentication error:', authError?.message)
      return json({ error: 'Your session has expired. Sign in again and retry.' }, 401)
    }

    // Role is read with the service role: the `role` column is revoked from the
    // `authenticated` role, so a user-scoped read can never see it.
    const { data: userAccount, error: userError } = await adminClient
      .from('user_accounts')
      .select('role, is_active')
      .eq('id', user.id)
      .maybeSingle()

    if (userError) {
      console.error('Caller lookup failed:', userError.message)
      return json({ error: 'Could not verify your permissions. Try again.' }, 500)
    }
    if (!userAccount || userAccount.role !== 'admin' || !userAccount.is_active) {
      return json({ error: 'Only an active administrator can reset passwords.' }, 403)
    }

    const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
      password: newPassword,
    })

    if (updateError) {
      console.error('Password update error:', updateError.message)
      return json({ error: `Failed to update password: ${updateError.message}` }, 400)
    }

    console.log(`Password updated for user ${userId} by admin ${user.id}`)
    return json({ success: true, message: 'Password updated successfully' })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Unexpected error:', msg)
    return json({ error: `Unexpected error: ${msg}` }, 500)
  }
})
