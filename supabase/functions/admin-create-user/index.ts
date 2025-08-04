import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateUserRequest {
  email: string
  password: string
  fullName?: string
}

interface CreateUserResponse {
  success: boolean
  message: string
  user?: any
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Admin create user function called:', req.method)
    
    // Verify request method
    if (req.method !== 'POST') {
      console.log('Invalid method:', req.method)
      return new Response(
        JSON.stringify({ success: false, message: 'Method not allowed' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Get the current user to verify admin privileges
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.log('No authorization header')
      return new Response(
        JSON.stringify({ success: false, message: 'Authorization header required' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Auth header present, extracting user...')

    // Extract JWT token from header
    const token = authHeader.replace('Bearer ', '')
    console.log('Token extracted, verifying...')

    // Use admin client to verify the JWT and get user info
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      console.error('Authentication failed:', authError)
      return new Response(
        JSON.stringify({ success: false, message: 'Authentication failed: ' + (authError?.message || 'Unknown error') }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('User authenticated:', user.id)

    // Use admin client to check user role (bypassing RLS)
    const { data: userAccount, error: accountError } = await supabaseAdmin
      .from('user_accounts')
      .select('role')
      .eq('id', user.id)
      .single()

    console.log('User account query result:', { userAccount, accountError })

    if (accountError || !userAccount || userAccount.role !== 'admin') {
      console.error('Admin verification failed:', { accountError, userAccount, userId: user.id })
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Admin privileges required. Current role: ' + (userAccount?.role || 'none') 
        }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Admin verification successful')

    // Parse request body
    const body: CreateUserRequest = await req.json()
    const { email, password, fullName } = body

    // Validate input
    if (!email || !password) {
      return new Response(
        JSON.stringify({ success: false, message: 'Email and password are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ success: false, message: 'Password must be at least 6 characters long' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Create user using admin client
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email for admin created users
      user_metadata: {
        full_name: fullName || ''
      }
    })

    if (createError) {
      console.error('User creation failed:', createError)
      let errorMessage = 'Failed to create user'
      
      if (createError.message.includes('already registered')) {
        errorMessage = 'A user with this email already exists'
      } else {
        errorMessage = createError.message
      }

      return new Response(
        JSON.stringify({ success: false, message: errorMessage }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('User created successfully:', authData.user?.id, email)

    // Create corresponding record in user_accounts table
    const { error: userAccountError } = await supabaseAdmin
      .from('user_accounts')
      .insert({
        id: authData.user!.id,
        username: email.split('@')[0], // Generate username from email
        email: email,
        full_name: fullName || '',
        role: 'user', // Default role
        is_active: true,
        created_by: user.id,
        password_hash: 'managed_by_supabase_auth' // Default value since Auth handles passwords
      })

    if (userAccountError) {
      console.error('Failed to create user_accounts record:', userAccountError)
      
      // Rollback: Delete the auth user since user_accounts creation failed
      await supabaseAdmin.auth.admin.deleteUser(authData.user!.id)
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Failed to create user account record. User creation rolled back.' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('User account record created successfully:', authData.user!.id)

    const response: CreateUserResponse = {
      success: true,
      message: `User created successfully! Email: ${email}`,
      user: {
        id: authData.user?.id,
        email: authData.user?.email
      }
    }

    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: 'An unexpected error occurred while creating the user' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})