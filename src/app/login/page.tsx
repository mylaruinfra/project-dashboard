import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";
import { getCompanyName } from "@/server/services/settings.service";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const company = await getCompanyName().catch(() => "Mylaru Infra");
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex size-9 items-center justify-center bg-hazard font-display text-lg font-bold text-white">S</span>
          <div>
            <p className="font-display text-xl font-bold tracking-tight uppercase">SiteBook</p>
            <p className="label-code text-steel">{company}</p>
          </div>
        </div>
        <section className="crosshairs border border-ink bg-paper">
          <header className="border-b border-ink bg-canvas px-4 py-3">
            <h1 className="headline-sm">Sign in</h1>
          </header>
          <LoginForm next={next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard"} />
        </section>
      </div>
    </main>
  );
}
