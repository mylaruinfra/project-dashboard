"use client";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return <EmptyState title="Something went wrong" body="The page could not load. Try again; if it keeps happening, tell your admin." action={<Button variant="secondary" onClick={reset}>Try again</Button>} />;
}
