import { Fragment, type CSSProperties, type ReactNode, useState } from "react";

import { cn } from "@/lib/utils";

export interface DataTableColumn<Row> {
  key: string;
  header: string;
  width: number | "auto";
  align?: "left" | "right";
  truncate?: boolean;
}

export interface DataTableRenderContext {
  expanded: boolean;
  toggleExpanded: () => void;
}

interface DataTableProps<Row extends Record<string, unknown>> {
  columns: DataTableColumn<Row>[];
  rows: Row[];
  renderCell: (row: Row, column: DataTableColumn<Row>, context: DataTableRenderContext) => ReactNode;
  getRowState?: (row: Row) => "ok" | "warn" | "bad" | null;
  footer?: Partial<Record<string, ReactNode>>;
  onRowExpand?: (row: Row) => void;
  renderExpanded?: (row: Row) => ReactNode;
  getRowKey?: (row: Row, index: number) => string;
  maxHeight?: number | string;
  className?: string;
}

const stripeClasses = {
  ok: "shadow-[inset_3px_0_0_hsl(var(--success))]",
  warn: "shadow-[inset_3px_0_0_hsl(var(--warning))]",
  bad: "shadow-[inset_3px_0_0_hsl(var(--destructive))]",
};

export function DataTable<Row extends Record<string, unknown>>({
  columns,
  rows,
  renderCell,
  getRowState,
  footer,
  onRowExpand,
  renderExpanded,
  getRowKey,
  maxHeight = "min(64vh, 620px)",
  className,
}: DataTableProps<Row>) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const wrapperStyle: CSSProperties = { maxHeight: typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight };
  const flexibleColumns = columns.filter((column) => column.width === "auto").length;

  if (flexibleColumns !== 1) {
    console.warn("DataTable requires exactly one flexible column with width: auto.");
  }

  const rowKey = (row: Row, index: number) => getRowKey?.(row, index) ?? String(row.id ?? row.key ?? index);

  return (
    <div className={cn("w-full overflow-x-hidden overflow-y-auto border-y border-border", className)} style={wrapperStyle}>
      <table className="w-full table-fixed border-collapse">
        <colgroup>
          {columns.map((column) => (
            <col key={column.key} style={{ width: column.width === "auto" ? "auto" : `${column.width}px` }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  "sticky top-0 z-30 h-8 whitespace-nowrap border-b border-border bg-surface-2 px-[11px] font-mono text-[9.5px] font-medium uppercase tracking-[0.09em] text-muted-foreground",
                  column.align === "right" ? "text-right" : "text-left",
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const key = rowKey(row, index);
            const isGroup = row.__group === true;
            if (isGroup) {
              return (
                <tr key={key} className="h-7 bg-sunken">
                  <td colSpan={columns.length} className="px-[11px] font-mono text-[9.5px] font-semibold uppercase tracking-[0.11em] text-foreground">
                    <div className="flex items-center justify-between gap-3">
                      <span>{String(row.label ?? "")}</span>
                      <span className="text-muted-foreground">{String(row.count ?? "")}</span>
                    </div>
                  </td>
                </tr>
              );
            }

            const expanded = expandedRows.has(key);
            const toggleExpanded = () => {
              setExpandedRows((current) => {
                const next = new Set(current);
                if (next.has(key)) next.delete(key);
                else next.add(key);
                return next;
              });
              onRowExpand?.(row);
            };
            const rowState = getRowState?.(row) ?? null;

            return (
              <Fragment key={key}>
                <tr className="group h-[38px] transition-colors hover:bg-surface-2">
                  {columns.map((column, columnIndex) => {
                    const content = renderCell(row, column, { expanded, toggleExpanded });
                    const title = column.truncate && (typeof content === "string" || typeof content === "number") ? String(content) : undefined;
                    return (
                      <td
                        key={column.key}
                        title={title}
                        className={cn(
                          "h-[38px] border-b border-hairline px-[11px] text-[12.5px] text-foreground",
                          column.align === "right" && "text-right font-mono tabular-nums",
                          column.truncate && "overflow-hidden text-ellipsis whitespace-nowrap",
                          columnIndex === 0 && rowState && stripeClasses[rowState],
                          columnIndex === 0 && !rowState && "shadow-[inset_3px_0_0_transparent]",
                        )}
                      >
                        {content}
                      </td>
                    );
                  })}
                </tr>
                {expanded && renderExpanded && (
                  <tr>
                    <td colSpan={columns.length} className="border-b border-hairline bg-surface-2 px-[11px] py-3">
                      {renderExpanded(row)}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
        {footer && (
          <tfoot>
            <tr className="sticky bottom-0 z-30 h-[38px] border-t border-border bg-surface-2 font-semibold">
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    "px-[11px] text-[12.5px]",
                    column.align === "right" && "text-right font-mono tabular-nums",
                  )}
                >
                  {footer[column.key]}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
