import type { Metadata } from "next";
import { SearchBox } from "@/components/common/SearchBox";
import { CompanyForm } from "@/components/settings/CompanyForm";
import { PasswordButton } from "@/components/settings/PasswordButton";
import { UserButton } from "@/components/settings/UserButton";
import { Chip } from "@/components/ui/Chip";
import { type Column, DataTable } from "@/components/ui/DataTable";
import { DescriptionList } from "@/components/ui/DescriptionList";
import { LinkButton } from "@/components/ui/LinkButton";
import { Pagination } from "@/components/ui/Pagination";
import { Panel } from "@/components/ui/Panel";
import { Tabs } from "@/components/ui/Tabs";
import { TitleBlock } from "@/components/ui/TitleBlock";
import { can } from "@/lib/access";
import { ROLE_LABEL } from "@/lib/domain";
import { aiEnabled } from "@/server/ai";
import { requirePageActor } from "@/server/auth/session";
import { getCompanyName } from "@/server/services/settings.service";
import { listUsers } from "@/server/services/users.service";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const [sp, actor] = await Promise.all([searchParams, requirePageActor()]);
  const tabs = [["account", "My account"], ...(can(actor, "settings.manage") ? [["company", "Company"]] : []), ...(can(actor, "user.manage") ? [["users", "Users"]] : [])] as [string, string][];
  const tab = tabs.some(([k]) => k === sp.tab) ? sp.tab! : "account";

  return (
    <>
      <TitleBlock eyebrow="System" title="Settings" />
      <Tabs active={tab} items={tabs.map(([k, l]) => ({ key: k, label: l, href: `/settings?tab=${k}` }))} />

      {tab === "account" ? (
        <Panel title="My account" action={<PasswordButton />}>
          <DescriptionList rows={[{ label: "Name", value: actor.name }, { label: "Email", value: actor.email }, { label: "Role", value: ROLE_LABEL[actor.role] }]} />
        </Panel>
      ) : null}

      {tab === "company" && can(actor, "settings.manage") ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Panel title="Company">
            <CompanyForm companyName={await getCompanyName()} />
          </Panel>
          <Panel title="Other settings">
            <DescriptionList
              rows={[
                { label: "Labor daily rates", value: <LinkButton href="/labor?tab=rates" variant="ghost" size="sm">Open</LinkButton> },
                { label: "Material catalogue", value: <LinkButton href="/materials?tab=catalogue" variant="ghost" size="sm">Open</LinkButton> },
                { label: "AI document reader", value: aiEnabled() ? <Chip tone="indigo">On</Chip> : <Chip>Off: set an API key in .env</Chip> },
              ]}
            />
          </Panel>
        </div>
      ) : null}

      {tab === "users" && can(actor, "user.manage") ? await (async () => {
        const data = await listUsers(actor, sp);
        type R = (typeof data.rows)[number];
        const cols: Column<R>[] = [
          { key: "n", header: "Name", cell: (r) => <span className={r.status === "INACTIVE" ? "text-steel line-through" : ""}>{r.name}</span> },
          { key: "e", header: "Email", cell: (r) => r.email },
          { key: "r", header: "Role", cell: (r) => <Chip tone={r.role === "ADMIN" ? "ink" : r.role === "ENGINEER" ? "hazard" : "indigo"}>{ROLE_LABEL[r.role]}</Chip> },
          { key: "s", header: "Status", cell: (r) => (r.status === "ACTIVE" ? <Chip tone="indigo">Active</Chip> : <Chip>Inactive</Chip>) },
        ];
        return (
          <>
            <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <SearchBox placeholder="Search users" />
              <UserButton />
            </div>
            <DataTable columns={cols} rows={data.rows} rowKey={(r) => r.id} rowHref={(r) => `/settings/users/${r.id}`} />
            <Pagination page={data.page} pageCount={data.pageCount} total={data.total} pageSize={data.pageSize} />
          </>
        );
      })() : null}
    </>
  );
}
