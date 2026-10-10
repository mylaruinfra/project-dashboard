"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { controlClass } from "@/components/ui/Input";

/** Search that writes ?q= on submit. */
export function SearchBox({ placeholder = "Search" }: { placeholder?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  return (
    <form
      role="search"
      className="relative w-full md:max-w-xs"
      onSubmit={(e) => {
        e.preventDefault();
        const sp = new URLSearchParams(params.toString());
        if (q.trim()) sp.set("q", q.trim());
        else sp.delete("q");
        sp.delete("page");
        router.push(`${pathname}?${sp.toString()}`);
      }}
    >
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-steel" aria-hidden />
      <input type="search" aria-label={placeholder} placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} className={controlClass(false, "pl-9")} />
    </form>
  );
}
