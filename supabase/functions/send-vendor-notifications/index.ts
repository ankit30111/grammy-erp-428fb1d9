import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Posts the queued vendor quality claims.
 *
 * It does not compose anything. raise_vendor_capa() rendered the subject and the
 * body when PPC ruled on the discrepancy, and this only carries them - so what a
 * vendor received is a stored fact rather than something reproduced later from a
 * template that has since been edited. These mails are the paper trail behind a
 * debit note; "roughly what we would send today" is not good enough for that.
 *
 * Safe to call repeatedly: it takes QUEUED rows only, and marks each one the
 * moment its provider call returns. Calling it twice concurrently is the one
 * case worth watching - both would see the same QUEUED rows - so the claim is
 * done with a conditional update and a row is only sent if this invocation was
 * the one that moved it out of QUEUED.
 */

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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const apiKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('VENDOR_MAIL_FROM')

  // Said plainly rather than failing as a generic 500. Until the key and the
  // verified sender exist, claims keep queuing and nothing is lost - the mails
  // simply sit in the outbox where they can be read.
  if (!apiKey || !from) {
    return json({
      sent: 0,
      skipped: 'not configured',
      detail:
        'Set RESEND_API_KEY and VENDOR_MAIL_FROM in the project secrets. Claims stay queued until then.',
    }, 200)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: queued, error } = await supabase
    .from('vendor_notifications')
    .select('id, to_email, cc_email, subject, body, attempts')
    .eq('status', 'QUEUED')
    .order('created_at')
    .limit(25)

  if (error) return json({ error: error.message }, 500)

  let sent = 0
  const failures: { id: string; error: string }[] = []

  for (const row of queued ?? []) {
    // Claim the row first. If another invocation already moved it, the update
    // matches nothing and this one leaves it alone rather than sending twice.
    const { data: claimed } = await supabase
      .from('vendor_notifications')
      .update({ status: 'SENT', attempts: (row.attempts ?? 0) + 1 })
      .eq('id', row.id)
      .eq('status', 'QUEUED')
      .select('id')
    if (!claimed?.length) continue

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [row.to_email],
          ...(row.cc_email ? { cc: [row.cc_email] } : {}),
          subject: row.subject,
          text: row.body,
        }),
      })

      const payload = await res.json().catch(() => ({}))

      if (!res.ok) {
        // Back to QUEUED, with the provider's own words kept. A claim that
        // failed to send must not look sent, and "delivery failed" without the
        // reason is the message that wastes the next hour.
        await supabase
          .from('vendor_notifications')
          .update({
            status: 'FAILED',
            last_error: payload?.message ?? `HTTP ${res.status}`,
          })
          .eq('id', row.id)
        failures.push({ id: row.id, error: payload?.message ?? `HTTP ${res.status}` })
        continue
      }

      await supabase
        .from('vendor_notifications')
        .update({ sent_at: new Date().toISOString(), provider_id: payload?.id ?? null, last_error: null })
        .eq('id', row.id)
      sent++
    } catch (e) {
      await supabase
        .from('vendor_notifications')
        .update({ status: 'FAILED', last_error: String(e) })
        .eq('id', row.id)
      failures.push({ id: row.id, error: String(e) })
    }
  }

  return json({ sent, failed: failures.length, failures })
})
