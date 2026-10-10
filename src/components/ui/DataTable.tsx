import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  align?: "left" | "right";
  className?: string;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  rowHref?: (row: T) => string | undefined;
  rowClassName?: (row: T) => string | undefined;
  empty?: ReactNode;
  footer?: ReactNode;
  caption?: string;
}

/**
 * Tabular schedule (DESIGN.md): canvas header with ink rule, hairline rows, numbers right.
 * On a phone the first column freezes and the rest scroll sideways.
 */
export function DataTable<T>({ columns, rows, rowKey, rowHref, rowClassName, empty, footer, caption }: Props<T>) {
  if (!rows.length && empty) return <>{empty}</>;
  return (
    <div className="crosshairs border border-hairline bg-paper">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead>
            <tr className="border-b border-ink bg-canvas">
              {columns.map((c, i) => (
                <th key={c.key} scope="col" className={cn("label-technical h-10 px-3 whitespace-nowrap text-steel", c.align === "right" && "text-right", i === 0 && "sticky left-0 z-10 bg-canvas", c.className)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {rows.map((r) => {
              const href = rowHref?.(r);
              return (
                <tr key={rowKey(r)} className={cn("group", href && "hover:bg-surface-low", rowClassName?.(r))}>
                  {columns.map((c, i) => (
                    <td key={c.key} className={cn("h-11 px-3 py-2 body-md align-middle", c.align === "right" && "text-right font-display tabular whitespace-nowrap", i === 0 && "sticky left-0 z-10 bg-paper group-hover:bg-surface-low", c.className)}>
                      {href && i === 0 ? (
                        <Link href={href} className="font-medium text-ink underline-offset-4 hover:text-hazard hover:underline">
                          {c.cell(r)}
                        </Link>
                      ) : (
                        c.cell(r)
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
          {footer ? <tfoot className="border-t border-ink bg-canvas">{footer}</tfoot> : null}
        </table>
      </div>
    </div>
  );
}
