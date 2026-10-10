import Link from "next/link";
import { cn } from "@/lib/cn";

export interface TabItem {
  key: string;
  label: string;
  href: string;
}

/** Link tabs that scroll sideways on a phone. */
export function Tabs({ items, active }: { items: TabItem[]; active: string }) {
  return (
    <nav aria-label="Sections" className="-mx-4 mb-5 overflow-x-auto border-b border-ink px-4 md:mx-0 md:px-0">
      <ul className="flex min-w-max">
        {items.map((t) => (
          <li key={t.key}>
            <Link
              href={t.href}
              scroll={false}
              aria-current={t.key === active ? "page" : undefined}
              className={cn(
                "label-technical flex min-h-11 items-center border-b-[3px] px-3 transition-colors",
                t.key === active ? "border-hazard text-ink" : "border-transparent text-steel hover:text-ink",
              )}
            >
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
