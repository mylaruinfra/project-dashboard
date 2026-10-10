import type { Metadata } from "next";
import Link from "next/link";
import { VoidButton } from "@/components/common/VoidButton";
import { PasswordButton } from "@/components/settings/PasswordButton";
import { UserButton } from "@/components/settings/UserButton";
import { Chip } from "@/components/ui/Chip";
import { DescriptionList } from "@/components/ui/DescriptionList";
import { Panel } from "@/components/ui/Panel";
import { TitleBlock } from "@/components/ui/TitleBlock";
import { can } from "@/lib/access";
import { formatDate } from "@/lib/dates";
import { ROLE_LABEL } from "@/lib/domain";
import { requirePageActor } from "@/server/auth/session";
import { denyUnless, pageData } from "@/server/http/page";
import { getUser } from "@/server/services/users.service";

export const metadata: Metadata = { title: "User" };

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, actor] = await Promise.all([params, requirePageActor()]);
  denyUnless(can(actor, "user.manage"));
  const u = await pageData(getUser(actor, id));
  const active = u.status === "ACTIVE";
  const self = u.id === actor.id;
  return (
    <>
      <TitleBlock
        eyebrow={<Link href="/settings?tab=users" className="hover:text-ink">Users</Link>}
        title={u.name}
        actions={
          <>
            {active ? <Chip tone="indigo">Active</Chip> : <Chip>Inactive</Chip>}
            <UserButton user={u} />
            <PasswordButton userId={u.id} label="Reset password" />
            {!self ? <VoidButton endpoint={`/api/users/${u.id}/status`} extra={{ status: active ? "INACTIVE" : "ACTIVE" }} label={active ? "Deactivate" : "Activate"} title={active ? "Deactivate user" : "Activate user"} message={active ? "They are signed out and cannot sign in. Their records stay." : "They can sign in again."} success="Saved" variant={active ? "destructive" : "secondary"} confirmTone={active ? "destructive" : "primary"} /> : null}
          </>
        }
        cells={[
          { label: "Role", value: ROLE_LABEL[u.role] },
          { label: "Email", value: u.email },
          { label: "Phone", value: u.phone ?? "—" },
          { label: "Since", value: formatDate(u.createdAt) },
        ]}
      />
      <Panel title="Assigned projects">
        {u.projects.length ? (
          <DescriptionList rows={u.projects.map((p) => ({ label: p.code, value: <Link className="text-hazard" href={`/projects/${p.id}?tab=team`}>{p.name}</Link> }))} />
        ) : (
          <p className="body-sm p-4 text-steel">{u.role === "ENGINEER" ? "Not assigned to any project. Assign from a project's Team tab." : "Not needed: this role sees every project."}</p>
        )}
      </Panel>
    </>
  );
}
