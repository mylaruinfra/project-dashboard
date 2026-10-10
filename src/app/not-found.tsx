import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6">
      <p className="headline-md">Page not found</p>
      <Link href="/dashboard" className="label-technical text-hazard">
        Go to dashboard
      </Link>
    </main>
  );
}
