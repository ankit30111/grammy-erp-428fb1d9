import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * What a table shows when it has nothing to show.
 *
 * Two problems this replaces, both visible on the Sales and Purchase screens:
 *
 *   * While loading, most screens showed nothing at all and a few showed the
 *     word "Loading..." centred in an empty page - each with its own wording.
 *     On a slow connection on the factory floor that reads as a broken page.
 *   * When empty, the header row still stretched the full width of the screen
 *     with the rows missing underneath, so eight column names sat spread across
 *     1,400 pixels above nothing. The column headings became the loudest thing
 *     on the page.
 *
 * Skeleton rows fix the first: the shape of the answer appears immediately and
 * the page does not jump when the data lands. A single quiet line fixes the
 * second, and it says what to do next rather than only that there is nothing -
 * "No parts yet" leaves you looking for the button.
 */

export const TableSkeleton = ({
  columns,
  rows = 5,
}: {
  columns: number;
  rows?: number;
}) => (
  <>
    {Array.from({ length: rows }).map((_, r) => (
      <TableRow key={r} className="hover:bg-transparent">
        {Array.from({ length: columns }).map((_, c) => (
          <TableCell key={c} className="py-2.5">
            {/* Widths vary down the column so it reads as rows of text rather
                than a block of grey bars. */}
            <Skeleton
              className="h-4"
              style={{ width: `${[85, 62, 74, 55, 68][(r + c) % 5]}%` }}
            />
          </TableCell>
        ))}
      </TableRow>
    ))}
  </>
);

export const TableEmpty = ({
  columns,
  message,
  hint,
  action,
}: {
  columns: number;
  message: string;
  /** What to do about it. Leave out only when there is genuinely nothing to do. */
  hint?: ReactNode;
  action?: ReactNode;
}) => (
  <TableRow className="hover:bg-transparent">
    <TableCell colSpan={columns} className="py-14 text-center">
      <p className="text-sm font-medium text-foreground/80">{message}</p>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </TableCell>
  </TableRow>
);

/**
 * The scroll container every table sits in.
 *
 * Only the table scrolls sideways, never the page. A wide table that is allowed
 * to push the layout takes the sidebar and the header with it, and the whole app
 * slides under the mouse.
 */
export const TableScroll = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div className={cn("w-full overflow-x-auto", className)}>{children}</div>
);
