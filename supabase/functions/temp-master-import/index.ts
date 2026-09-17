// TEMPORARY one-off master-data importer used during the schema cutover.
// Delete immediately after the restore is verified.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const TOKEN = "cutover-9f2c1ab7-4e5d-4c8a-9b31-7d0e6f5a2c44";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method", { status: 405 });
  let body: { token?: string; table?: string; rows?: unknown[] };
  try {
    body = await req.json();
  } catch {
    return new Response("bad json", { status: 400 });
  }
  if (body.token !== TOKEN) return new Response("forbidden", { status: 403 });
  if (!body.table || !Array.isArray(body.rows)) {
    return new Response("bad payload", { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { error, count } = await supabase
    .from(body.table)
    .insert(body.rows, { count: "exact" });

  if (error) {
    return new Response(JSON.stringify({ error: error.message, details: error.details }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ inserted: count ?? body.rows.length }), {
    headers: { "Content-Type": "application/json" },
  });
});
