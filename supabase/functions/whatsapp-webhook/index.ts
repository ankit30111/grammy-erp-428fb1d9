import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    if (req.method === 'GET') {
      // Handle webhook verification
      const url = new URL(req.url)
      const mode = url.searchParams.get('hub.mode')
      const token = url.searchParams.get('hub.verify_token')
      const challenge = url.searchParams.get('hub.challenge')

      // You should set this token in your Meta Developer Console
      const verifyToken = Deno.env.get('WHATSAPP_VERIFY_TOKEN') || 'your_verify_token'

      console.log('Webhook verification attempt:', { mode, token, challenge })

      if (mode === 'subscribe' && token === verifyToken) {
        console.log('Webhook verified successfully')
        return new Response(challenge, { status: 200 })
      } else {
        console.log('Webhook verification failed')
        return new Response('Forbidden', { status: 403 })
      }
    }

    if (req.method === 'POST') {
      // Handle webhook events
      const body = await req.json()
      console.log('Webhook received:', JSON.stringify(body, null, 2))

      // Process message status updates
      if (body.entry && body.entry[0] && body.entry[0].changes) {
        for (const change of body.entry[0].changes) {
          if (change.value && change.value.statuses) {
            for (const status of change.value.statuses) {
              console.log('Message status update:', {
                messageId: status.id,
                status: status.status,
                timestamp: status.timestamp,
                recipientId: status.recipient_id
              })

              // Update notification status in database
              const { error: updateError } = await supabase
                .from('whatsapp_notifications')
                .update({
                  delivery_status: status.status,
                  delivered_at: status.status === 'delivered' ? new Date().toISOString() : null,
                  read_at: status.status === 'read' ? new Date().toISOString() : null,
                  failed_at: status.status === 'failed' ? new Date().toISOString() : null,
                  updated_at: new Date().toISOString()
                })
                .eq('whatsapp_message_id', status.id)

              if (updateError) {
                console.error('Error updating notification status:', updateError)
              } else {
                console.log('Updated notification status:', status.id, status.status)
              }
            }
          }

          // Process incoming messages (replies)
          if (change.value && change.value.messages) {
            for (const message of change.value.messages) {
              console.log('Incoming message:', {
                messageId: message.id,
                from: message.from,
                text: message.text?.body,
                timestamp: message.timestamp
              })

              // Log incoming replies
              const { error: replyError } = await supabase
                .from('whatsapp_replies')
                .insert({
                  whatsapp_message_id: message.id,
                  sender_number: message.from,
                  message_content: message.text?.body || '',
                  received_at: new Date(parseInt(message.timestamp) * 1000).toISOString()
                })

              if (replyError) {
                console.error('Error logging reply:', replyError)
              }
            }
          }
        }
      }

      return new Response('OK', { status: 200 })
    }

    return new Response('Method not allowed', { status: 405 })

  } catch (error) {
    console.error('Webhook error:', error)
    return new Response('Internal server error', { status: 500 })
  }
})