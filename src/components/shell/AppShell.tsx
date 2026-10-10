"use client";

import { LogOut, Menu, Upload } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { ROLE_LABEL, type Role } from "@/lib/domain";
import { BOTTOM, NAV, navFor } from "./nav";

interface Props {
  user: { name: string; role: Role };
  company: string;
  pendingDrafts: number;
  children: ReactNode;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function AppShell({ user, company, pendingDrafts, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [more, setMore] = useState(false);
  const signOut = async () => {
    await api("/api/auth/logout", { body: {} });
    router.replace("/login");
    router.refresh();
  };
  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const nav = navFor(user.role, NAV);
  const bottom = navFor(user.role, BOTTOM);
  const bottomHrefs = new Set(bottom.map((b) => b.href));

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-ink bg-ink text-white lg:flex">
        <Link href="/dashboard" className="flex h-16 items-center gap-3 border-b border-white/15 px-5">
          <span className="flex size-7 items-center justify-center bg-hazard font-display font-bold">S</span>
          <span className="min-w-0">
            <span className="block font-display text-base font-bold tracking-tight uppercase">SiteBook</span>
            <span className="label-code block truncate text-white/60">{company}</span>
          </span>
        </Link>
        <nav aria-label="Main" className="flex-1 overflow-y-auto py-3">
          <ul>
            {nav.map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href}
                  aria-current={active(n.href) ? "page" : undefined}
                  className={cn("flex min-h-11 items-center gap-3 border-l-[3px] px-5 body-md transition-colors", active(n.href) ? "border-hazard bg-white/10 text-white" : "border-transparent text-white/75 hover:bg-white/5 hover:text-white")}
                >
                  <n.icon className="size-4 shrink-0" aria-hidden />
                  <span className="truncate">{n.label}</span>
                </Link>
              </li>
            ))}
            {bottomHrefs.has("/upload") ? (
              <li>
                <Link href="/upload" aria-current={active("/upload") ? "page" : undefined} className={cn("flex min-h-11 items-center gap-3 border-l-[3px] px-5 body-md", active("/upload") ? "border-hazard bg-white/10" : "border-transparent text-white/75 hover:text-white")}>
                  <Upload className="size-4 shrink-0" aria-hidden />
                  <span>Upload bill / challan</span>
                  {pendingDrafts > 0 ? <span className="label-code ml-auto bg-hazard px-1.5 py-0.5 text-white">{pendingDrafts}</span> : null}
                </Link>
              </li>
            ) : null}
          </ul>
        </nav>
        <div className="flex items-center gap-3 border-t border-white/15 p-4">
          <span className="flex size-8 shrink-0 items-center justify-center bg-white font-display text-xs font-bold text-ink">{initials(user.name)}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-display text-sm font-semibold">{user.name}</span>
            <span className="label-code block text-white/60">{ROLE_LABEL[user.role]}</span>
          </span>
          <button type="button" onClick={signOut} className="flex size-11 items-center justify-center text-white/70 hover:text-white" aria-label="Sign out" title="Sign out">
            <LogOut className="size-4" />
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Phone top bar */}
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-ink bg-paper px-4 lg:hidden">
          <Link href="/dashboard" className="flex min-h-11 items-center gap-2">
            <span className="flex size-7 items-center justify-center bg-hazard font-display font-bold text-white">S</span>
            <span className="font-display text-base font-bold tracking-tight uppercase">SiteBook</span>
          </Link>
          <span className="flex items-center gap-2">
            <span className="text-right">
              <span className="block max-w-32 truncate font-display text-xs font-semibold">{user.name}</span>
              <span className="label-code block text-steel">{ROLE_LABEL[user.role]}</span>
            </span>
            <span className="flex size-8 items-center justify-center bg-ink font-display text-xs font-bold text-white">{initials(user.name)}</span>
          </span>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-4 pb-28 md:px-6 lg:px-8 lg:pt-8 lg:pb-12">{children}</main>
      </div>

      {/* Phone bottom bar */}
      <nav aria-label="Quick" className="fixed inset-x-0 bottom-0 z-40 border-t border-ink bg-paper pb-[env(safe-area-inset-bottom)] lg:hidden">
        <ul className="grid grid-cols-1" style={{ gridTemplateColumns: `repeat(${bottom.length + 1}, minmax(0, 1fr))` }}>
          {bottom.map((b) => (
            <li key={b.href}>
              <Link href={b.href} aria-current={active(b.href) ? "page" : undefined} className={cn("relative flex h-14 flex-col items-center justify-center gap-1", active(b.href) ? "text-hazard" : "text-ink")}>
                {active(b.href) ? <span className="absolute inset-x-3 top-0 h-[3px] bg-hazard" aria-hidden /> : null}
                <b.icon className="size-5" aria-hidden />
                <span className="label-code">{b.label}</span>
                {b.href === "/upload" && pendingDrafts > 0 ? <span className="absolute top-1.5 right-[calc(50%-1.25rem)] size-2 rounded-dot bg-hazard" aria-label={`${pendingDrafts} waiting`} /> : null}
              </Link>
            </li>
          ))}
          <li>
            <button type="button" onClick={() => setMore(true)} className="flex h-14 w-full flex-col items-center justify-center gap-1 text-ink">
              <Menu className="size-5" aria-hidden />
              <span className="label-code">More</span>
            </button>
          </li>
        </ul>
      </nav>

      <Modal open={more} onClose={() => setMore(false)} title="More">
        <ul className="-mx-4 -my-4 divide-y divide-hairline">
          {nav
            .filter((n) => !bottomHrefs.has(n.href))
            .map((n) => (
              <li key={n.href}>
                <Link href={n.href} onClick={() => setMore(false)} className="flex min-h-12 items-center gap-3 px-4 body-lg">
                  <n.icon className="size-5 text-steel" aria-hidden />
                  {n.label}
                </Link>
              </li>
            ))}
          <li>
            <button type="button" onClick={signOut} className="flex min-h-12 w-full items-center gap-3 px-4 body-lg text-hazard">
              <LogOut className="size-5" aria-hidden />
              Sign out
            </button>
          </li>
        </ul>
      </Modal>
    </div>
  );
}
