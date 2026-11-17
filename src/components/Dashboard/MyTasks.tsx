import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

interface Task { key: string; area: string; title: string; waiting: number; oldest: string | null; link: string }

/** Days between a date and today, in words. */
const age = (iso: string | null) => {
  if (!iso) return "";
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Math.round((today.getTime() - new Date(iso.slice(0, 10) + "T00:00:00").getTime()) / 86_400_000);
  return days > 1 ? `oldest ${days} days` : days === 1 ? "oldest from yesterday" : days === 0 ? "from today" : `due in ${-days} day${days === -1 ? "" : "s"}`;
};

export function useMyTasks() {
  return useQuery({
    queryKey: ["my-tasks"], refetchInterval: 30_000, refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("my_tasks");
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });
}

/**
 * "Waiting for you": the work each department has pending, taken from the
 * records themselves. Nobody sends a task; it appears when the work exists and
 * disappears when the work is done.
 */
export function MyTasks() {
  const { data: tasks = [], isLoading, error } = useMyTasks();
  const areas = [...new Set(tasks.map((t) => t.area))];
  const total = tasks.reduce((n, t) => n + t.waiting, 0);

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold">Waiting for you</h2>
          {!isLoading && !error && <span className="text-sm text-muted-foreground">{total ? `${total.toLocaleString("en-IN")} item${total === 1 ? "" : "s"} in ${tasks.length} task${tasks.length === 1 ? "" : "s"}` : ""}</span>}
        </div>

        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p>
          : error ? <p className="text-sm text-destructive">{(error as any).message}</p>
          : !tasks.length ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-success" /> Nothing is waiting for your department.</p>
          ) : (
            <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
              {areas.map((area) => (
                <section key={area} className="space-y-1">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{area}</h3>
                  <ul className="divide-y rounded-md border">
                    {tasks.filter((t) => t.area === area).map((t) => (
                      <li key={t.key}>
                        <Link to={t.link} className="group flex items-center gap-3 px-3 py-2 hover:bg-muted/50">
                          <span className="min-w-[2.25rem] rounded bg-primary/10 px-1.5 py-0.5 text-center text-sm font-semibold tabular-nums text-primary">{t.waiting.toLocaleString("en-IN")}</span>
                          <span className="min-w-0 flex-1 text-sm">{t.title}<span className="block text-xs text-muted-foreground">{age(t.oldest)}</span></span>
                          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
      </CardContent>
    </Card>
  );
}
