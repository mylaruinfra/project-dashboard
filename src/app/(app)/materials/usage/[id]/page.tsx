import type { Metadata } from "next";
import Link from "next/link";
import { History } from "@/components/common/History";
import { VoidButton } from "@/components/common/VoidButton";
import { UsageButton } from "@/components/materials/UsageButton";
import { Chip } from "@/components/ui/Chip";
import { DescriptionList } from "@/components/ui/DescriptionList";
import { Notice } from "@/components/ui/Notice";
import { Panel } from "@/components/ui/Panel";
import { TitleBlock } from "@/components/ui/TitleBlock";
import { can } from "@/lib/access";
import { formatDate, todayIso } from "@/lib/dates";
import { PHASE_LABEL } from "@/lib/domain";
import { formatQty } from "@/lib/qty";
import { requirePageActor } from "@/server/auth/session";
import { pageData } from "@/server/http/page";
import { materialOptions } from "@/server/services/materials.service";
import { projectOptions } from "@/server/services/projects.service";
import { getUsage } from "@/server/services/stock.service";

export const metadata: Metadata = { title: "Material use" };

export default async function UsagePage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, actor] = await Promise.all([params, requirePageActor()]);
  const u = await pageData(getUsage(actor, id));
  const [projects, materials] = await Promise.all([projectOptions(actor), materialOptions(actor)]);
  const active = u.status === "ACTIVE";
  return (
    <>
      <TitleBlock
        eyebrow={<Link href={`/materials?tab=usage&projectId=${u.projectId}`} className="hover:text-ink">Material use · {u.projectName}</Link>}
        title={`${formatQty(u.qty)} ${u.unit} ${u.materialName}`}
        actions={
          <>
            {u.status === "VOID" ? <Chip tone="error">Void</Chip> : null}
            {active && can(actor, "field.write") ? <UsageButton projects={projects} materials={materials} today={todayIso()} usage={u} /> : null}
            {active && can(actor, "record.void") ? <VoidButton endpoint={`/api/usages/${u.id}/void`} label="Void" title="Void this entry" message="The quantity goes back into stock." success="Entry voided" /> : null}
          </>
        }
        cells={[
          { label: "Date", value: formatDate(u.date) },
          { label: "Phase", value: u.phase ? PHASE_LABEL[u.phase] : "—" },
          { label: "Slab", value: u.slabName ?? "Whole site" },
          { label: "Recorded by", value: u.createdByName ?? "—" },
        ]}
      />
      {u.status === "VOID" ? <Notice tone="error" title="This entry is void" className="mb-5">Reason: {u.voidReason}</Notice> : null}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_22rem]">
        <Panel title="Details">
          <DescriptionList rows={[{ label: "Material", value: u.materialName }, { label: "Quantity", value: `${formatQty(u.qty)} ${u.unit}`, numeric: true }, { label: "Activity", value: u.activityName ?? "—" }, { label: "Notes", value: u.notes ?? "—" }]} />
        </Panel>
        <History rows={u.history} />
      </div>
    </>
  );
}
