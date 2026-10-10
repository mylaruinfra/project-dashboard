import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { requirePageActor } from "@/server/auth/session";
import { pendingDraftCount } from "@/server/services/drafts.service";
import { getCompanyName } from "@/server/services/settings.service";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const actor = await requirePageActor();
  const [company, pending] = await Promise.all([getCompanyName(), pendingDraftCount(actor)]);
  return (
    <AppShell user={{ name: actor.name, role: actor.role }} company={company} pendingDrafts={pending}>
      {children}
    </AppShell>
  );
}
