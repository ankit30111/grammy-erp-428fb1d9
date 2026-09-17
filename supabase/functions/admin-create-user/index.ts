import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateUserRequest {
  email?: string
  password?: string
  fullName?: string
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
    if (req.method !== 'POST') {
      return json({ success: false, message: 'Method not allowed' }, 405)
    }

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    if (!serviceRoleKey || !supabaseUrl) {
      console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
      return json(
        { success: false, message: 'Server not configured for user administration. Contact the administrator.' },
        500,
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // --- Caller authorisation -------------------------------------------------
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ success: false, message: 'You are not signed in. Sign in again and retry.' }, 401)
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      console.error('Authentication failed:', authError?.message)
      return json({ success: false, message: 'Your session has expired. Sign in again and retry.' }, 401)
    }

    // Role is read with the service role because the `role` column is revoked
    // from the `authenticated` role — a user-scoped read would always fail.
    const { data: callerAccount, error: callerError } = await supabaseAdmin
      .from('user_accounts')
      .select('role, is_active')
      .eq('id', user.id)
      .maybeSingle()

    if (callerError) {
      console.error('Caller lookup failed:', callerError.message)
      return json({ success: false, message: 'Could not verify your permissions. Try again.' }, 500)
    }
    if (!callerAccount || callerAccount.role !== 'admin' || !callerAccount.is_active) {
      return json({ success: false, message: 'Only an active administrator can create users.' }, 403)
    }

    // --- Input validation -----------------------------------------------------
    let body: CreateUserRequest
    try {
      body = await req.json()
    } catch {
      return json({ success: false, message: 'Invalid request body' }, 400)
    }

    const email = (body.email ?? '').trim().toLowerCase()
    const password = body.password ?? ''
    const fullName = (body.fullName ?? '').trim()

    if (!email || !password) {
      return json({ success: false, message: 'Email and password are required.' }, 400)
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ success: false, message: 'That email address is not valid.' }, 400)
    }
    if (password.length < 6) {
      return json({ success: false, message: 'Password must be at least 6 characters long.' }, 400)
    }

    // --- Existing-state checks ------------------------------------------------
    const { data: authList, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    })
    if (listError) {
      console.error('listUsers failed:', listError.message)
      return json({ success: false, message: 'Could not check existing users. Try again.' }, 500)
    }
    const existingAuthUser = authList?.users?.find(
      (u) => (u.email ?? '').toLowerCase() === email,
    )
    if (existingAuthUser) {
      return json(
        { success: false, message: 'A user with this email already exists. Select them from the list instead.' },
        409,
      )
    }

    // Leftover account row from a previously failed creation (no matching auth
    // user). Remove it so the email can be reused.
    const { data: orphanRows, error: orphanError } = await supabaseAdmin
      .from('user_accounts')
      .select('id, email')
      .eq('email', email)
    if (orphanError) {
      console.error('Orphan lookup failed:', orphanError.message)
      return json({ success: false, message: 'Could not check existing accounts. Try again.' }, 500)
    }
    for (const row of orphanRows ?? []) {
      const { data: { user: stillThere } } = await supabaseAdmin.auth.admin.getUserById(row.id)
      if (stillThere) {
        return json(
          { success: false, message: 'A user with this email already exists. Select them from the list instead.' },
          409,
        )
      }
      const { error: cleanupError } = await supabaseAdmin
        .from('user_accounts')
        .delete()
        .eq('id', row.id)
      if (cleanupError) {
        console.error('Failed to clear orphan account row:', cleanupError.message)
        return json(
          { success: false, message: 'An incomplete account with this email exists and could not be cleared. Contact support.' },
          409,
        )
      }
      console.log('Cleared orphan user_accounts row for', email)
    }

    // --- Create the auth user -------------------------------------------------
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })

    if (createError || !created?.user) {
      const msg = createError?.message ?? 'Unknown error'
      console.error('createUser failed:', msg)
      let friendly = `Could not create the sign-in account: ${msg}`
      if (/already registered|already been registered|exists/i.test(msg)) {
        friendly = 'A user with this email already exists.'
      } else if (/password/i.test(msg)) {
        friendly = `Password rejected: ${msg}`
      }
      return json({ success: false, message: friendly }, 400)
    }

    const authUserId = created.user.id

    // A database trigger (on_auth_user_created → handle_new_auth_user) already
    // inserts the matching public.user_accounts row. Reconcile rather than
    // insert a second time, which previously raised a unique violation.
    const rollback = async (reason: string) => {
      console.error('Rolling back created user:', reason)
      await supabaseAdmin.from('user_accounts').delete().eq('id', authUserId)
      await supabaseAdmin.auth.admin.deleteUser(authUserId)
    }

    let accountRow: { id: string } | null = null
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data } = await supabaseAdmin
        .from('user_accounts')
        .select('id')
        .eq('id', authUserId)
        .maybeSingle()
      if (data) {
        accountRow = data
        break
      }
      await new Promise((r) => setTimeout(r, 200))
    }

    if (accountRow) {
      const { error: updateError } = await supabaseAdmin
        .from('user_accounts')
        .update({
          email,
          full_name: fullName,
          is_active: true,
          created_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', authUserId)
      if (updateError) {
        await rollback(updateError.message)
        return json(
          { success: false, message: `Could not finish setting up the account: ${updateError.message}` },
          400,
        )
      }
    } else {
      // No trigger row — create it ourselves with a unique username.
      let username = email.split('@')[0]
      const { data: clash } = await supabaseAdmin
        .from('user_accounts')
        .select('username')
        .eq('username', username)
        .maybeSingle()
      if (clash) username = `${username}_${Date.now().toString().slice(-4)}`

      const { error: insertError } = await supabaseAdmin.from('user_accounts').insert({
        id: authUserId,
        username,
        email,
        full_name: fullName,
        role: 'user',
        is_active: true,
        created_by: user.id,
      })
      if (insertError) {
        await rollback(insertError.message)
        let friendly = `Could not create the account record: ${insertError.message}`
        if (insertError.code === '23505') friendly = 'A user with this email or username already exists.'
        if (insertError.code === '23503') friendly = 'Invalid reference data provided.'
        return json({ success: false, message: friendly }, 400)
      }
    }

    console.log('User created successfully:', authUserId, email)

    return json({
      success: true,
      message: `User created: ${email}`,
      user: { id: authUserId, email },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Unexpected error:', msg)
    return json({ success: false, message: `Unexpected error: ${msg}` }, 500)
  }
})
