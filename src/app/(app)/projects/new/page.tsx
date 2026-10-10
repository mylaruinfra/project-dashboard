import type { Metadata } from "next";
import { ProjectWizard } from "@/components/projects/ProjectWizard";
import { TitleBlock } from "@/components/ui/TitleBlock";
import { todayIso } from "@/lib/dates";
import { requirePageActor } from "@/server/auth/session";
import { denyUnless } from "@/server/http/page";
import { can } from "@/server/permissions";
import { clientOptions } from "@/server/services/clients.service";

export const metadata: Metadata = { title: "New project" };

export default async function NewProjectPage() {
  const actor = await requirePageActor();
  denyUnless(can(actor, "project.write"));
  const clients = await clientOptions(actor);
  return (
    <>
      <TitleBlock eyebrow="Projects" title="Create new project" />
      <ProjectWizard clients={clients} today={todayIso()} />
    </>
  );
}
