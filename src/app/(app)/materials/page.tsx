import type { Metadata } from "next";
import Link from "next/link";
import { QueryFilters } from "@/components/common/QueryFilters";
import { SearchBox } from "@/components/common/SearchBox";
import { StatusFilter } from "@/components/common/StatusFilter";
import { MaterialButton } from "@/components/materials/MaterialButton";
import { PurchaseOrderButton } from "@/components/materials/PurchaseOrderButton";
import { ReceiptButton } from "@/components/materials/ReceiptButton";
import { UsageButton } from "@/components/materials/UsageButton";
import { Chip } from "@/components/ui/Chip";
import { type Column, DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Money } from "@/components/ui/Money";
import { Pagination } from "@/components/ui/Pagination";
import { Tabs } from "@/components/ui/Tabs";
import { TitleBlock } from "@/components/ui/TitleBlock";
import { can, canSeeMoney } from "@/lib/access";
import { formatDateShort, todayIso } from "@/lib/dates";
import { PHASE_LABEL } from "@/lib/domain";
import { formatQty } from "@/lib/qty";
import { requirePageActor } from "@/server/auth/session";
import { listMaterials, materialOptions } from "@/server/services/materials.service";
import { projectOptions } from "@/server/services/projects.service";
import type { Paged } from "@/server/pagination";
import { listPurchaseOrders, listReceipts, listUsages, projectStockSummary, type StockLine, stockByProject } from "@/server/services/stock.service";
import { vendorOptions } from "@/server/services/vendors.service";

export const metadata: Metadata = { title: "Materials" };

const q = (n: number, unit?: string) => `${formatQty(n)}${unit ? ` ${unit}` : ""}`;

export default async function MaterialsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const [sp, actor] = await Promise.all([searchParams, requirePageActor()]);
  const [projects, materials, vendors] = await Promise.all([projectOptions(actor), materialOptions(actor), vendorOptions(actor)]);
  const money = canSeeMoney(actor);
  const tabs = [
    ["stock", "Stock"],
    ["deliveries", "Deliveries"],
    ["usage", "Usage"],
    ...(money ? [["orders", "Purchase orders"]] : []),
    ["catalogue", "Catalogue"],
  ] as [string, string][];
  const tab = tabs.some(([k]) => k === sp.tab) ? sp.tab! : "stock";
  const projectId = sp.projectId && projects.some((p) => p.id === sp.projectId) ? sp.projectId : undefined;
  const today = todayIso();
  const field = can(actor, "field.write");
  const href = (t: string) => `/materials?tab=${t}${projectId ? `&projectId=${projectId}` : ""}`;

  return (
    <>
      <TitleBlock eyebrow="Stores" title="Materials" cells={[{ label: "Flow", value: "Purchased → received → used → remaining" }]} />
      <Tabs active={tab} items={tabs.map(([k, label]) => ({ key: k, label, href: href(k) }))} />
      {tab !== "catalogue" && tab !== "orders" ? (
        <QueryFilters filters={[{ kind: "select", name: "projectId", label: "Project", options: projects.map((p) => ({ value: p.id, label: p.name })), placeholder: "All projects" }]} />
      ) : null}
      {!projects.length && tab !== "catalogue" ? <EmptyState title="No projects" body="You are not assigned to any project." /> : null}

      {tab === "stock" && projects.length ? await (async () => {
        const buttons = (stock?: Record<string, number>) => field ? <><ReceiptButton projects={projects} materials={materials} vendors={vendors} projectId={projectId} today={today} /><UsageButton projects={projects} materials={materials} projectId={projectId} today={today} stock={stock} /></> : null;
        if (!projectId) {
          const data = await stockByProject(actor, { page: sp.page });
          return <StockTab actorMoney={money} lines={data.rows} actions={buttons()} paging={data} />;
        }
        const lines = await projectStockSummary(actor, projectId);
        return <StockTab actorMoney={money} lines={lines} actions={buttons(Object.fromEntries(lines.map((l) => [l.materialId, l.remaining])))} />;
      })() : null}

      {tab === "deliveries" && projects.length ? await (async () => {
        const data = await listReceipts(actor, { ...sp, projectId });
        type R = (typeof data.rows)[number];
        const cols: Column<R>[] = [
          { key: "date", header: "Date", cell: (r) => formatDateShort(r.date) },
          ...(projectId ? [] : [{ key: "project", header: "Project", cell: (r: R) => r.projectName }]),
          { key: "mat", header: "Material", cell: (r) => <span className={r.status === "VOID" ? "text-steel line-through" : ""}>{r.materialName}</span> },
          { key: "qty", header: "Qty", align: "right", cell: (r) => q(r.qty, r.unit) },
          { key: "vendor", header: "Vendor", cell: (r) => r.vendorName ?? "—" },
          { key: "challan", header: "Challan", cell: (r) => <span className="flex gap-1">{r.challanNo ?? "—"}{r.status === "VOID" ? <Chip tone="error">Void</Chip> : null}{r.source === "AI" ? <Chip>AI</Chip> : null}</span> },
          { key: "po", header: "PO", cell: (r) => r.poNumber ?? "—" },
        ];
        return (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <StatusFilter basePath="/materials" current={sp.status ?? "ACTIVE"} params={{ tab: "deliveries", projectId }} options={[{ value: "ACTIVE", label: "Active" }, { value: "VOID", label: "Void" }, { value: "ALL", label: "All" }]} />
              {field ? <ReceiptButton projects={projects} materials={materials} vendors={vendors} projectId={projectId} today={today} /> : null}
            </div>
            <DataTable columns={cols} rows={data.rows} rowKey={(r) => r.id} rowHref={(r) => `/materials/deliveries/${r.id}`} empty={<EmptyState title="No deliveries yet" />} />
            <Pagination page={data.page} pageCount={data.pageCount} total={data.total} pageSize={data.pageSize} />
          </>
        );
      })() : null}

      {tab === "usage" && projects.length ? await (async () => {
        const [data, stock] = await Promise.all([listUsages(actor, { ...sp, projectId }), projectId ? projectStockSummary(actor, projectId) : Promise.resolve(null)]);
        type R = (typeof data.rows)[number];
        const cols: Column<R>[] = [
          { key: "date", header: "Date", cell: (r) => formatDateShort(r.date) },
          ...(projectId ? [] : [{ key: "project", header: "Project", cell: (r: R) => r.projectName }]),
          { key: "mat", header: "Material", cell: (r) => <span className={r.status === "VOID" ? "text-steel line-through" : ""}>{r.materialName}</span> },
          { key: "qty", header: "Qty", align: "right", cell: (r) => q(r.qty, r.unit) },
          { key: "phase", header: "Phase", cell: (r) => (r.phase ? PHASE_LABEL[r.phase] : "—") },
          { key: "where", header: "Slab / activity", cell: (r) => [r.slabName, r.activityName].filter(Boolean).join(" · ") || "—" },
          { key: "st", header: "", cell: (r) => (r.status === "VOID" ? <Chip tone="error">Void</Chip> : null) },
        ];
        return (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <StatusFilter basePath="/materials" current={sp.status ?? "ACTIVE"} params={{ tab: "usage", projectId }} options={[{ value: "ACTIVE", label: "Active" }, { value: "VOID", label: "Void" }, { value: "ALL", label: "All" }]} />
              {field ? <UsageButton projects={projects} materials={materials} projectId={projectId} today={today} variant="primary" stock={stock ? Object.fromEntries(stock.map((l) => [l.materialId, l.remaining])) : undefined} /> : null}
            </div>
            <DataTable columns={cols} rows={data.rows} rowKey={(r) => r.id} rowHref={(r) => `/materials/usage/${r.id}`} empty={<EmptyState title="No material used yet" />} />
            <Pagination page={data.page} pageCount={data.pageCount} total={data.total} pageSize={data.pageSize} />
          </>
        );
      })() : null}

      {tab === "orders" && money ? await (async () => {
        const data = await listPurchaseOrders(actor, sp);
        type R = (typeof data.rows)[number];
        const cols: Column<R>[] = [
          { key: "num", header: "PO", cell: (r) => r.number },
          { key: "date", header: "Date", cell: (r) => formatDateShort(r.date) },
          { key: "project", header: "Project", cell: (r) => r.projectName },
          { key: "vendor", header: "Vendor", cell: (r) => r.vendorName },
          { key: "status", header: "Status", cell: (r) => <Chip tone={r.status === "OPEN" ? "hazard" : r.status === "VOID" ? "error" : "muted"}>{r.status === "OPEN" ? "Open" : r.status === "VOID" ? "Void" : "Closed"}</Chip> },
          { key: "total", header: "Total", align: "right", cell: (r) => <Money value={r.total} /> },
        ];
        return (
          <>
            <div className="mb-3 flex justify-end">{can(actor, "finance.write") ? <PurchaseOrderButton projects={projects} materials={materials} vendors={vendors} today={today} /> : null}</div>
            <QueryFilters filters={[{ kind: "select", name: "projectId", label: "Project", options: projects.map((p) => ({ value: p.id, label: p.name })), placeholder: "All projects" }, { kind: "select", name: "status", label: "Status", options: [{ value: "OPEN", label: "Open" }, { value: "CLOSED", label: "Closed" }, { value: "VOID", label: "Void" }], placeholder: "All" }]} />
            <DataTable columns={cols} rows={data.rows} rowKey={(r) => r.id} rowHref={(r) => `/materials/orders/${r.id}`} empty={<EmptyState title="No purchase orders" body="Purchase orders are optional." />} />
            <Pagination page={data.page} pageCount={data.pageCount} total={data.total} pageSize={data.pageSize} />
          </>
        );
      })() : null}

      {tab === "catalogue" ? await (async () => {
        const data = await listMaterials(actor, sp);
        type R = (typeof data.rows)[number];
        const cols: Column<R>[] = [
          { key: "name", header: "Material", cell: (r) => r.name },
          { key: "unit", header: "Unit", cell: (r) => r.unit },
          { key: "cat", header: "Category", cell: (r) => r.category ?? "—" },
          { key: "st", header: "Status", cell: (r) => (r.status === "ACTIVE" ? <Chip tone="indigo">Active</Chip> : <Chip>Inactive</Chip>) },
        ];
        return (
          <>
            <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <SearchBox placeholder="Search materials" />
              <div className="flex flex-wrap gap-2">
                <StatusFilter basePath="/materials" current={sp.status ?? "ACTIVE"} params={{ tab: "catalogue", q: sp.q }} options={[{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }, { value: "ALL", label: "All" }]} />
                {can(actor, "master.write") ? <MaterialButton /> : null}
              </div>
            </div>
            <DataTable columns={cols} rows={data.rows} rowKey={(r) => r.id} rowHref={(r) => `/materials/catalogue/${r.id}`} />
            <Pagination page={data.page} pageCount={data.pageCount} total={data.total} pageSize={data.pageSize} />
          </>
        );
      })() : null}
    </>
  );
}

function StockTab({ lines, actorMoney, actions, paging }: { lines: (StockLine & { projectId?: string; projectName?: string })[]; actorMoney: boolean; actions: React.ReactNode; paging?: Paged<unknown> }) {
  const cols: Column<StockLine & { projectId?: string; projectName?: string }>[] = [
    ...(paging ? [{ key: "project", header: "Project", cell: (r: StockLine & { projectId?: string; projectName?: string }) => <Link href={`/materials?tab=stock&projectId=${r.projectId}`} className="hover:text-hazard">{r.projectName}</Link> }] : []),
    { key: "name", header: "Material", cell: (r) => <Link href={`/materials/catalogue/${r.materialId}`} className="hover:text-hazard">{r.name}</Link> },
    { key: "ord", header: "Ordered", align: "right", cell: (r) => (r.ordered ? q(r.ordered) : "—") },
    { key: "pur", header: "Purchased", align: "right", cell: (r) => q(r.purchased) },
    { key: "rec", header: "Received", align: "right", cell: (r) => q(r.received) },
    { key: "used", header: "Used", align: "right", cell: (r) => q(r.used) },
    { key: "rem", header: "Remaining", align: "right", cell: (r) => <span className="font-bold">{q(r.remaining, r.unit)}</span> },
    { key: "pend", header: "Not yet delivered", align: "right", cell: (r) => (r.pendingDelivery ? <span className="text-hazard">{q(r.pendingDelivery)}</span> : "—") },
  ];
  if (actorMoney) cols.push({ key: "val", header: "Purchase value", align: "right", cell: (r) => <Money value={r.purchasedValue} /> });
  return (
    <>
      <div className="mb-3 flex flex-wrap justify-end gap-2">{actions}</div>
      <DataTable columns={cols} rows={lines} rowKey={(r) => `${r.projectId ?? ""}:${r.materialId}`} empty={<EmptyState title="No materials yet" body="Record a purchase (Transactions) or a delivery to start." />} />
      {paging ? <Pagination page={paging.page} pageCount={paging.pageCount} total={paging.total} pageSize={paging.pageSize} /> : null}
      <p className="body-sm mt-2 text-steel">Stock can never go below zero: material use is limited to what has been received.</p>
    </>
  );
}
