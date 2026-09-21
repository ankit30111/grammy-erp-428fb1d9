import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlantId } from "@/hooks/usePlantId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Search, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/**
 * Where every piece of a part went, read from the stock ledger.
 *
 * This screen used to report "Discrepancy: -8,900 units" on Z-015, from arithmetic
 * it made up: Total GRN Receipts 99,000 minus Production Dispatches 8,500 gives an
 * Expected 90,500, against a Current 81,600. Every part of that was wrong.
 * "Receipts 99,000" was not what was received - 100,000 arrived, 99,000 is what
 * IQC passed. And it subtracted two of the eight kinds of movement in the ledger
 * and called the remainder a discrepancy, so the 9,000 the store counted short and
 * the +100 kit feedback correction were simply missing from the sum.
 *
 * The number it printed was not a finding about the stock. It was the size of what
 * the screen had forgotten to look at. That is worse than showing nothing, because
 * it will be believed on the day it matters.
 *
 * Nothing is computed here now. part_stock_statement() classifies every ledger row
 * into a stage and a department, and the arithmetic closes by construction - the
 * last line says so, and says so loudly when it does not.
 */

interface StatementRow {
  seq: number;
  section: "FLOW" | "ELSEWHERE" | "CHECK";
  event_at: string | null;
  label: string;
  department: string | null;
  quantity: number;
  running_balance: number | null;
  is_unexplained: boolean;
  balances: boolean | null;
  note: string | null;
}

const fmt = (n: number) => Number(n).toLocaleString();

const InventoryDiagnostics = () => {
  const plantId = usePlantId();
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const [partCode, setPartCode] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["part-stock-statement", partCode, plantId],
    enabled: !!partCode && !!plantId,
    queryFn: async () => {
      const { data: part, error: partError } = await supabase
        .from("parts")
        .select("id, part_code, name, uom")
        .eq("part_code", partCode!)
        .maybeSingle();
      if (partError) throw partError;
      if (!part) throw new Error(`No part with code ${partCode}`);

      const { data: rows, error: stmtError } = await supabase.rpc("part_stock_statement", {
        p_part_id: part.id,
        p_plant_id: plantId!,
      });
      if (stmtError) throw stmtError;
      return { part, rows: (rows ?? []) as StatementRow[] };
    },
  });

  const run = () => {
    const code = input.trim().toUpperCase();
    if (!code) {
      toast({
        title: "Enter a part code",
        description: "For example Z-015.",
        variant: "destructive",
      });
      return;
    }
    setPartCode(code);
  };

  const rows = data?.rows ?? [];
  const flow = rows.filter((r) => r.section === "FLOW");
  const elsewhere = rows.filter((r) => r.section === "ELSEWHERE");
  const check = rows.find((r) => r.section === "CHECK");
  // Received is the CHECK row's running_balance, not the first flow row's. Reading
  // it off flow[0] assumed the statement always opens with a receipt, which is only
  // true until somebody looks at a part whose first movement was an adjustment.
  const received = Number(check?.running_balance ?? 0);
  // Straight from the function. This used to be decided by testing whether the
  // note began with the word "Balances" - so the banner could say "This does not
  // balance" directly above the sentence "Balances against the 100,000 received".
  const balances = check?.balances === true;

  // The function's shape and this screen's expectations are two halves of one
  // change, and they can be deployed separately. When they disagree the filters
  // above match nothing and the page renders empty tables under a scary red
  // banner, which reads as "your stock is wrong" rather than "this page is out of
  // date". It happened, on this screen, to this data. So it says so instead.
  const shapeMismatch = rows.length > 0 && (flow.length === 0 || !check);

  const when = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(undefined, {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    }) : "";

  const signed = (n: number) =>
    `${Number(n) > 0 ? "+" : ""}${Number(n).toLocaleString()}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Where the stock went
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Every movement of one part, from the ledger — what arrived, what each
          department did with it, and where it is now.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-2">
          <Input
            placeholder="Part code, e.g. Z-015"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1"
            onKeyDown={(e) => e.key === "Enter" && run()}
          />
          <Button onClick={run} disabled={isLoading}>
            <Search className="h-4 w-4 mr-2" />
            {isLoading ? "Checking…" : "Check"}
          </Button>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
            {(error as Error).message}
          </div>
        )}

        {data && (
          <div className="space-y-6">
            <div className="rounded-lg border p-3">
              <div className="text-lg font-medium font-mono">{data.part.part_code}</div>
              <div className="text-sm text-muted-foreground">{data.part.name}</div>
            </div>

            {rows.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">
                This part has never moved in this plant.
              </div>
            ) : shapeMismatch ? (
              <div className="rounded-md border border-amber-500/40 bg-amber-50 dark:bg-amber-950/20 p-4 text-sm space-y-1">
                <div className="font-medium">This page is out of date with the database</div>
                <p>
                  The stock statement came back in a shape this screen does not
                  recognise, so it has not been rendered. Nothing is wrong with your
                  stock — this page needs redeploying to match the database.
                </p>
                <p className="text-xs text-muted-foreground">
                  Sections received: {[...new Set(rows.map((r) => r.section))].join(", ") || "none"}
                </p>
              </div>
            ) : (
              <>
                {/*
                  The running column is the point of this screen. Reading down it
                  answers "what was the number after each step, and whose hands was
                  it in" - which is the question an audit asks. A list of movements
                  with a separate closing balance does not answer it.
                */}
                <div className="rounded-lg border p-4">
                  <div className="text-sm text-muted-foreground">
                    Received into this plant
                  </div>
                  <div className="text-3xl font-semibold font-mono">
                    {fmt(received)}{" "}
                    <span className="text-base font-normal text-muted-foreground">
                      {data.part.uom}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div>
                    <h4 className="font-semibold">How it got to where it is</h4>
                    <p className="text-xs text-muted-foreground">
                      Every movement in order, with the running total after each one.
                      The column ends at what is in the main store now.
                    </p>
                  </div>
                  <div className="rounded-lg border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="whitespace-nowrap">When</TableHead>
                          <TableHead>What happened</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead className="text-right">Change</TableHead>
                          <TableHead className="text-right">Running total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {flow.map((r) => (
                          <TableRow
                            key={r.seq}
                            className={r.is_unexplained ? "bg-destructive/5" : undefined}
                          >
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {when(r.event_at)}
                            </TableCell>
                            <TableCell>
                              <span className={r.is_unexplained ? "font-medium text-destructive" : ""}>
                                {r.label}
                              </span>
                              {r.note && (
                                <span className="block text-xs text-muted-foreground">
                                  {r.note}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {r.department ?? "—"}
                            </TableCell>
                            <TableCell
                              className={`text-right font-mono ${
                                r.is_unexplained
                                  ? "text-destructive font-semibold"
                                  : Number(r.quantity) < 0
                                  ? "text-amber-600"
                                  : Number(r.quantity) > 0
                                  ? "text-green-700"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {Number(r.quantity) === 0 ? "—" : signed(r.quantity)}
                            </TableCell>
                            <TableCell className="text-right font-mono font-semibold">
                              {fmt(r.running_balance ?? 0)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="space-y-2">
                  <div>
                    <h4 className="font-semibold">Where all of it is</h4>
                    <p className="text-xs text-muted-foreground">
                      Not deductions from the column above — the other places the same
                      material went. These add up to everything received.
                    </p>
                  </div>
                  <div className="rounded-lg border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Where</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {elsewhere.map((r) => (
                          <TableRow
                            key={r.seq}
                            className={r.is_unexplained ? "bg-destructive/5" : undefined}
                          >
                            <TableCell>
                              <span className={r.is_unexplained ? "font-medium text-destructive" : ""}>
                                {r.label}
                              </span>
                              {r.note && (
                                <span className="block text-xs text-muted-foreground">
                                  {r.note}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {r.department ?? "—"}
                            </TableCell>
                            <TableCell
                              className={`text-right font-mono ${
                                r.is_unexplained ? "text-destructive font-semibold" : ""
                              }`}
                            >
                              {fmt(r.quantity)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                {check && (
                  <div
                    className={`rounded-lg border p-4 flex items-start gap-3 ${
                      balances
                        ? "border-green-600/40 bg-green-50 dark:bg-green-950/20"
                        : "border-destructive/40 bg-destructive/10"
                    }`}
                  >
                    {balances ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="font-medium">
                        {balances
                          ? `Every one of the ${fmt(received)} is accounted for`
                          : "This does not balance"}
                      </div>
                      <p className="text-sm text-muted-foreground">{check.note}</p>
                      {!balances && (
                        <p className="text-sm mt-1">
                          Accounted for {fmt(check.quantity)} against{" "}
                          {fmt(received)} received. The difference is
                          movement this statement does not yet classify — not missing
                          stock.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {rows.some((r) => r.is_unexplained) && (
                  <div className="rounded-md border border-amber-500/40 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm flex gap-2">
                    <Badge variant="destructive" className="shrink-0 h-fit">
                      Open
                    </Badge>
                    <span>
                      The short quantity is a real gap, not an arithmetic error. It is
                      waiting for somebody to rule on it in{" "}
                      <strong>Purchase Discrepancies → Store Discrepancies</strong> —
                      short supply from the vendor, a miscount, or a write-off.
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default InventoryDiagnostics;
