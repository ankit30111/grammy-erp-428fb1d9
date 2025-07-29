import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WhatsAppMediaResponse {
  id: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { grn_item_id } = await req.json()
    console.log('Processing WhatsApp notification for GRN item:', grn_item_id)

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get WhatsApp API credentials
    const whatsappToken = Deno.env.get('META_WHATSAPP_ACCESS_TOKEN')
    const phoneNumberId = Deno.env.get('META_WHATSAPP_PHONE_NUMBER_ID')

    if (!whatsappToken || !phoneNumberId) {
      throw new Error('WhatsApp API credentials not configured')
    }

    // Fetch GRN item details with related data
    const { data: grnItemData, error: grnError } = await supabase
      .from('grn_items')
      .select(`
        *,
        grn!inner(
          grn_number,
          received_date,
          purchase_order_id,
          vendor_id,
          purchase_orders!inner(
            po_number,
            po_date
          ),
          vendors!inner(
            name,
            whatsapp_number,
            whatsapp_notifications_enabled
          )
        ),
        raw_materials!inner(
          name,
          material_code
        )
      `)
      .eq('id', grn_item_id)
      .single()

    if (grnError || !grnItemData) {
      throw new Error(`Failed to fetch GRN item data: ${grnError?.message}`)
    }

    const vendor = grnItemData.grn.vendors
    const material = grnItemData.raw_materials
    const grn = grnItemData.grn
    const po = grnItemData.grn.purchase_orders

    // Check if vendor has WhatsApp enabled and number configured
    if (!vendor.whatsapp_notifications_enabled) {
      console.log('WhatsApp notifications disabled for vendor:', vendor.name)
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `WhatsApp notifications are disabled for vendor: ${vendor.name}` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!vendor.whatsapp_number) {
      console.log('No WhatsApp number configured for vendor:', vendor.name)
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `No WhatsApp number configured for vendor: ${vendor.name}. Please update vendor details.` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Format WhatsApp number (remove any formatting, ensure it starts with country code)
    let whatsappNumber = vendor.whatsapp_number.replace(/[^\d]/g, '')
    if (!whatsappNumber.startsWith('91')) { // Assuming Indian numbers
      whatsappNumber = '91' + whatsappNumber
    }

    // Prepare message content
    const failureReason = grnItemData.iqc_status === 'REJECTED' ? 'REJECTED' : 'SEGREGATED'
    const failedQty = grnItemData.iqc_status === 'REJECTED' 
      ? grnItemData.rejected_quantity 
      : grnItemData.rejected_quantity + grnItemData.accepted_quantity

    const messageText = `🚨 *IQC FAILURE NOTIFICATION*

Dear ${vendor.name},

We regret to inform you that the following material has failed our Incoming Quality Control inspection:

📋 *MATERIAL DETAILS:*
• Material: ${material.name}
• Material Code: ${material.material_code}
• Status: *${failureReason}*
• Quantity Failed: ${failedQty} units
• Accepted Quantity: ${grnItemData.accepted_quantity || 0} units

📄 *DOCUMENT DETAILS:*
• GRN Number: ${grn.grn_number}
• PO Number: ${po.po_number}
• Received Date: ${new Date(grn.received_date).toLocaleDateString('en-IN')}
• PO Date: ${new Date(po.po_date).toLocaleDateString('en-IN')}

⚠️ *CORRECTIVE ACTION REQUIRED:*
Please submit a CAPA (Corrective and Preventive Action) document addressing the root cause and preventive measures for this quality issue.

📧 For queries, contact our Quality Team.

Thank you for your immediate attention to this matter.

*Quality Control Department*`

    let mediaId: string | null = null

    // Upload IQC report file if available
    if (grnItemData.iqc_report_url) {
      try {
        console.log('Uploading IQC report to WhatsApp:', grnItemData.iqc_report_url)
        
        // Download file from Supabase storage
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('iqc-reports')
          .download(grnItemData.iqc_report_url.split('/').pop()!)

        if (downloadError) {
          console.error('Error downloading file:', downloadError)
        } else {
          // Upload to WhatsApp Media API
          const formData = new FormData()
          formData.append('file', fileData, 'iqc_report.pdf')
          formData.append('type', 'application/pdf')
          formData.append('messaging_product', 'whatsapp')

          const mediaResponse = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/media`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${whatsappToken}`,
            },
            body: formData
          })

          if (mediaResponse.ok) {
            const mediaResult: WhatsAppMediaResponse = await mediaResponse.json()
            mediaId = mediaResult.id
            console.log('Media uploaded successfully:', mediaId)
          } else {
            console.error('Failed to upload media:', await mediaResponse.text())
          }
        }
      } catch (error) {
        console.error('Error handling file upload:', error)
      }
    }

    // Send WhatsApp message
    const messagePayload: any = {
      messaging_product: 'whatsapp',
      to: whatsappNumber,
      type: 'text',
      text: {
        body: messageText
      }
    }

    // If we have media, send it as a separate message
    const messageResponse = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${whatsappToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messagePayload)
    })

    const messageResult = await messageResponse.json()

    if (!messageResponse.ok) {
      throw new Error(`WhatsApp API error: ${JSON.stringify(messageResult)}`)
    }

    // Send media file if available
    if (mediaId) {
      const mediaPayload = {
        messaging_product: 'whatsapp',
        to: whatsappNumber,
        type: 'document',
        document: {
          id: mediaId,
          caption: 'IQC Inspection Report',
          filename: `IQC_Report_${grn.grn_number}_${material.material_code}.pdf`
        }
      }

      await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${whatsappToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mediaPayload)
      })
    }

    // Log notification in database
    const { error: logError } = await supabase
      .from('whatsapp_notifications')
      .insert({
        grn_item_id: grn_item_id,
        vendor_id: vendor.id,
        message_content: messageText,
        file_url: grnItemData.iqc_report_url,
        whatsapp_message_id: messageResult.messages?.[0]?.id,
        status: 'SENT',
        sent_at: new Date().toISOString()
      })

    if (logError) {
      console.error('Error logging notification:', logError)
    }

    // Update GRN item with notification status
    const { error: updateError } = await supabase
      .from('grn_items')
      .update({
        whatsapp_notification_sent: true,
        whatsapp_notification_sent_at: new Date().toISOString()
      })
      .eq('id', grn_item_id)

    if (updateError) {
      console.error('Error updating GRN item:', updateError)
    }

    console.log('WhatsApp notification sent successfully:', messageResult.messages?.[0]?.id)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message_id: messageResult.messages?.[0]?.id,
        vendor: vendor.name,
        whatsapp_number: whatsappNumber
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in WhatsApp notification function:', error)
    
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