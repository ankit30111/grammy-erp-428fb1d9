import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

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
    const { phone_number, message } = await req.json()
    console.log('Direct WhatsApp test to:', phone_number)

    // Get WhatsApp API credentials
    const whatsappToken = Deno.env.get('META_WHATSAPP_ACCESS_TOKEN')
    const phoneNumberId = Deno.env.get('META_WHATSAPP_PHONE_NUMBER_ID')
    
    console.log('WhatsApp credentials check:', {
      hasAccessToken: !!whatsappToken,
      accessTokenLength: whatsappToken?.length || 0,
      hasPhoneNumberId: !!phoneNumberId,
      phoneNumberId: phoneNumberId || 'NOT_SET'
    })

    if (!whatsappToken || !phoneNumberId) {
      throw new Error('WhatsApp API credentials not configured')
    }

    // Format phone number
    let whatsappNumber = phone_number.replace(/[^\d]/g, '')
    if (!whatsappNumber.startsWith('91')) {
      whatsappNumber = '91' + whatsappNumber
    }
    
    console.log('Formatted number:', whatsappNumber)

    // Prepare message payload
    const messagePayload = {
      messaging_product: 'whatsapp',
      to: whatsappNumber,
      type: 'text',
      text: {
        body: message
      }
    }

    console.log('Sending direct test message:', {
      url: `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      to: whatsappNumber,
      messageLength: message.length
    })

    // Send WhatsApp message
    const messageResponse = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${whatsappToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messagePayload)
    })

    const messageResult = await messageResponse.json()
    
    console.log('WhatsApp API response:', {
      status: messageResponse.status,
      statusText: messageResponse.statusText,
      success: messageResponse.ok,
      result: messageResult
    })

    if (!messageResponse.ok) {
      console.error('WhatsApp API error:', {
        status: messageResponse.status,
        errorDetails: messageResult
      })
      
      // Provide specific error messages for common issues
      let errorMessage = `WhatsApp API error: ${messageResult.error?.message || 'Unknown error'}`
      
      if (messageResult.error?.code === 131026) {
        errorMessage = `Message undeliverable: Number ${whatsappNumber} may not be a valid WhatsApp number or not added as test recipient`
      } else if (messageResult.error?.code === 131047) {
        errorMessage = 'Re-engagement message - this number needs to message your business first'
      } else if (messageResult.error?.code === 131014) {
        errorMessage = 'Message template required - use approved template or send within 24h window'
      }
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: errorMessage,
          error_code: messageResult.error?.code,
          whatsapp_number: whatsappNumber
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Direct test message sent successfully:', messageResult.messages?.[0]?.id)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message_id: messageResult.messages?.[0]?.id,
        whatsapp_number: whatsappNumber,
        message: 'Test message sent successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in direct WhatsApp test:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})