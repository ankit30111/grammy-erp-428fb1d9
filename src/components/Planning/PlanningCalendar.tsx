import { useState } from "react";
import {
  addMonths, eachDayOfInterval, endOfMonth, format, getDay, isBefore, isSameDay, isSameMonth, isToday, parseISO,
  startOfDay, startOfMonth,
} from "date-fns";
import { CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { KIND_STYLE, STATUS_LABEL, type VoucherRow } from "./voucherRows";

const n = (v: number) => Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 });

/**
 * The production calendar. Each day shows how many finished-good and
 * sub-assembly vouchers fall on it, by colour. Today and later days open the
 * list for that day; past days only show the colours.
 */
export const PlanningCalendar = ({ vouchers, onScheduleOn }: {
  vouchers: VoucherRow[];
  onScheduleOn: (date: string) => void;
}) => {
  const thisMonth = startOfMonth(new Date());
  const [month, setMonth] = useState(thisMonth);
  const [selected, setSelected] = useState<Date | null>(null);
  const start = startOfDay(new Date());

  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const cells: (Date | null)[] = [...Array(getDay(days[0])).fill(null), ...days];
  const on = (d: Date) => vouchers.filter((v) => isSameDay(parseISO(v.schedule.scheduled_date), d));
  const dayList = selected ? on(selected) : [];

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle>Production Calendar · {format(month, "MMMM yyyy")}</CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Previous month" disabled={isSameMonth(month, thisMonth)}
                  onClick={() => setMonth((m) => addMonths(m, -1))}><ChevronLeft /></Button>
          <Button variant="outline" size="sm" onClick={() => setMonth(thisMonth)}>This month</Button>
          <Button variant="outline" size="icon" aria-label="Next month" onClick={() => setMonth((m) => addMonths(m, 1))}><ChevronRight /></Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          {(["FG", "SA"] as const).map((k) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className={cn("h-3 w-3 rounded-sm", KIND_STYLE[k].dot)} /> {KIND_STYLE[k].label}
            </span>
          ))}
        </div>

        <div className="overflow-x-auto">
          <div className="grid grid-cols-7 gap-1 min-w-[560px]">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-1.5 text-center text-xs font-semibold text-muted-foreground">{d}</div>
            ))}
            {cells.map((date, i) => {
              if (!date) return <div key={i} />;
              const list = on(date);
              const fg = list.filter((v) => v.kind === "FG");
              const sa = list.filter((v) => v.kind === "SA");
              const past = isBefore(date, start);
              const isSel = !!selected && isSameDay(selected, date);
              return (
                <button
                  key={i}
                  type="button"
                  disabled={past}
                  onClick={() => setSelected(date)}
                  className={cn(
                    "h-20 rounded-md border p-1.5 text-left flex flex-col gap-1 transition-colors",
                    past ? "bg-muted/40 text-muted-foreground cursor-default" : "hover:border-primary",
                    isToday(date) && "border-primary",
                    isSel && "ring-2 ring-primary",
                  )}
                >
                  <span className="text-xs font-medium">{format(date, "d")}</span>
                  <div className="flex flex-wrap gap-1 mt-auto">
                    {fg.length > 0 && (
                      <span className={cn("rounded px-1.5 text-[11px] font-semibold", KIND_STYLE.FG.chip, past && "opacity-60")}>
                        FG {fg.length}
                      </span>
                    )}
                    {sa.length > 0 && (
                      <span className={cn("rounded px-1.5 text-[11px] font-semibold", KIND_STYLE.SA.chip, past && "opacity-60")}>
                        SA {sa.length}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {selected && (
          <div className="rounded-md border">
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b">
              <div className="text-sm font-semibold">{format(selected, "EEEE, d MMMM yyyy")}</div>
              <Button size="sm" variant="outline" onClick={() => onScheduleOn(format(selected, "yyyy-MM-dd"))}>
                <CalendarPlus /> Schedule on this date
              </Button>
            </div>
            {dayList.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">Nothing scheduled on this day.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Voucher</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="hidden md:table-cell">For</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="hidden sm:table-cell">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dayList.map((v) => (
                    <TableRow key={v.schedule.id}>
                      <TableCell className="whitespace-nowrap">
                        <span className={cn("inline-block h-2.5 w-2.5 rounded-sm mr-2", KIND_STYLE[v.kind].dot)} />
                        <span className="font-mono">{v.order?.voucher_number}</span>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{v.product?.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{v.product?.part_code}</div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{v.forLabel}</TableCell>
                      <TableCell className="text-right">{n(v.schedule.quantity)}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">{STATUS_LABEL[v.status] ?? v.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
