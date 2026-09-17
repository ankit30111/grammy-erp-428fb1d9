import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const TOKEN = "245ba0d47c032fb2172aaa49e1162663";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (url.searchParams.get("token") !== TOKEN) {
    return new Response("forbidden", { status: 403 });
  }
  const table = url.searchParams.get("table") ?? "";
  if (!/^[a-z_]+$/.test(table)) {
    return new Response("bad table", { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const all: unknown[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(from, from + page - 1);
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }
    all.push(...(data ?? []));
    if (!data || data.length < page) break;
  }

  return new Response(JSON.stringify(all), {
    headers: { "content-type": "application/json" },
  });
});
