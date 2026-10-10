"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";

interface Props {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  /** Search param used for the page number (lets two lists share a page). */
  param?: string;
}

export function Pagination({ page, pageCount, total, pageSize, param = "page" }: Props) {
  const pathname = usePathname();
  const params = useSearchParams();
  if (total === 0) return null;
  const href = (p: number) => {
    const sp = new URLSearchParams(params.toString());
    if (p <= 1) sp.delete(param);
    else sp.set(param, String(p));
    const qs = sp.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const pages = Array.from(new Set([1, page - 1, page, page + 1, pageCount])).filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  const cell = "inline-flex size-11 items-center justify-center border border-hairline bg-paper font-display text-sm font-semibold tabular";
  return (
    <nav aria-label="Pages" className="mt-3 flex flex-wrap items-center justify-between gap-3">
      <p className="body-sm text-steel tabular">
        {from}–{to} of {total}
      </p>
      {pageCount > 1 ? (
        <ul className="flex items-center gap-1">
          <li>
            {page > 1 ? (
              <Link href={href(page - 1)} className={cell} aria-label="Previous page">
                <ChevronLeft className="size-4" />
              </Link>
            ) : (
              <span className={cn(cell, "opacity-40")} aria-hidden>
                <ChevronLeft className="size-4" />
              </span>
            )}
          </li>
          {pages.map((p, i) => (
            <li key={p} className="flex items-center gap-1">
              {i > 0 && p - pages[i - 1]! > 1 ? <span className="px-1 text-steel">…</span> : null}
              <Link href={href(p)} aria-current={p === page ? "page" : undefined} className={cn(cell, p === page && "border-ink bg-ink text-white")}>
                {p}
              </Link>
            </li>
          ))}
          <li>
            {page < pageCount ? (
              <Link href={href(page + 1)} className={cell} aria-label="Next page">
                <ChevronRight className="size-4" />
              </Link>
            ) : (
              <span className={cn(cell, "opacity-40")} aria-hidden>
                <ChevronRight className="size-4" />
              </span>
            )}
          </li>
        </ul>
      ) : null}
    </nav>
  );
}
