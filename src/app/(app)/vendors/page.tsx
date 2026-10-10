import type { Metadata } from "next";
import { QueryFilters } from "@/components/common/QueryFilters";
import { SearchBox } from "@/components/common/SearchBox";
import { VendorButton } from "@/components/parties/VendorButton";
import { Chip } from "@/components/ui/Chip";
import { type Column, DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Money } from "@/components/ui/Money";
import { Pagination } from "@/components/ui/Pagination";
import { TitleBlock } from "@/components/ui/TitleBlock";
import { can, canSeeMoney } from "@/lib/access";
import { VENDOR_TYPE_LABEL, VENDOR_TYPES } from "@/lib/domain";
import { requirePageActor } from "@/server/auth/session";
import { listVendors } from "@/server/services/vendors.service";

export const metadata: Metadata = { title: "Vendors / Contractors" };

export default async function VendorsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const [sp, actor] = await Promise.all([searchParams, requirePageActor()]);
  const data = await listVendors(actor, sp);
  type R = (typeof data.rows)[number];
  const cols: Column<R>[] = [
    { key: "name", header: "Name", cell: (r) => <span className={r.status === "INACTIVE" ? "text-steel" : ""}>{r.name}</span> },
    { key: "type", header: "Type", cell: (r) => <Chip tone={r.type === "MATERIAL_VENDOR" ? "indigo" : r.type.includes("CONTRACTOR") ? "hazard" : "muted"}>{VENDOR_TYPE_LABEL[r.type]}</Chip> },
    { key: "phone", header: "Phone", cell: (r) => (r.phone ? <a href={`tel:${r.phone}`} className="text-hazard">{r.phone}</a> : "—") },
    { key: "gst", header: "GSTIN", cell: (r) => r.gstin ?? "—" },
    { key: "st", header: "Status", cell: (r) => (r.status === "ACTIVE" ? <Chip tone="indigo">Active</Chip> : <Chip>Inactive</Chip>) },
  ];
  if (canSeeMoney(actor)) cols.push({ key: "pend", header: "Pending", align: "right", cell: (r) => (r.pending !== null && r.pending < 0 ? <span className="text-indigo">Advance <Money value={-r.pending} /></span> : <Money value={r.pending} />) });
  return (
    <>
      <TitleBlock eyebrow="Register" title="Vendors / Contractors" cells={[{ label: "Showing", value: `${data.total}` }]} actions={can(actor, "master.write") ? <VendorButton /> : null} />
      <div className="mb-3">
        <SearchBox placeholder="Search by name" />
      </div>
      <QueryFilters
        filters={[
          { kind: "select", name: "type", label: "Type", options: VENDOR_TYPES.map((t) => ({ value: t, label: VENDOR_TYPE_LABEL[t] })), placeholder: "All types" },
          { kind: "select", name: "status", label: "Status", options: [{ value: "INACTIVE", label: "Inactive" }, { value: "ALL", label: "All" }], placeholder: "Active" },
        ]}
      />
      <DataTable columns={cols} rows={data.rows} rowKey={(r) => r.id} rowHref={(r) => `/vendors/${r.id}`} empty={<EmptyState title="No vendors found" />} />
      <Pagination page={data.page} pageCount={data.pageCount} total={data.total} pageSize={data.pageSize} />
    </>
  );
}
