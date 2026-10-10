import type { Metadata } from "next";
import { SearchBox } from "@/components/common/SearchBox";
import { StatusFilter } from "@/components/common/StatusFilter";
import { ClientButton } from "@/components/parties/ClientButton";
import { Chip } from "@/components/ui/Chip";
import { type Column, DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { TitleBlock } from "@/components/ui/TitleBlock";
import { can } from "@/lib/access";
import { requirePageActor } from "@/server/auth/session";
import { listClients } from "@/server/services/clients.service";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const [sp, actor] = await Promise.all([searchParams, requirePageActor()]);
  const data = await listClients(actor, sp);
  type R = (typeof data.rows)[number];
  const cols: Column<R>[] = [
    { key: "name", header: "Client", cell: (r) => r.name },
    { key: "contact", header: "Contact", cell: (r) => r.contactPerson ?? "—" },
    { key: "phone", header: "Phone", cell: (r) => (r.phone ? <a href={`tel:${r.phone}`} className="text-hazard">{r.phone}</a> : "—") },
    { key: "email", header: "Email", cell: (r) => r.email ?? "—" },
    { key: "st", header: "Status", cell: (r) => (r.status === "ACTIVE" ? <Chip tone="indigo">Active</Chip> : <Chip>Inactive</Chip>) },
  ];
  return (
    <>
      <TitleBlock eyebrow="Register" title="Clients" cells={[{ label: "Showing", value: `${data.total}` }]} actions={can(actor, "master.write") ? <ClientButton /> : null} />
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <SearchBox placeholder="Search clients" />
        <StatusFilter basePath="/clients" current={sp.status ?? "ACTIVE"} params={{ q: sp.q }} options={[{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }, { value: "ALL", label: "All" }]} />
      </div>
      <DataTable columns={cols} rows={data.rows} rowKey={(r) => r.id} rowHref={(r) => `/clients/${r.id}`} empty={<EmptyState title="No clients found" />} />
      <Pagination page={data.page} pageCount={data.pageCount} total={data.total} pageSize={data.pageSize} />
    </>
  );
}
