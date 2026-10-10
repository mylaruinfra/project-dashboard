import type { Metadata } from "next";
import Link from "next/link";
import { VoidButton } from "@/components/common/VoidButton";
import { MaterialButton } from "@/components/materials/MaterialButton";
import { Chip } from "@/components/ui/Chip";
import { DescriptionList } from "@/components/ui/DescriptionList";
import { Panel } from "@/components/ui/Panel";
import { TitleBlock } from "@/components/ui/TitleBlock";
import { can } from "@/lib/access";
import { requirePageActor } from "@/server/auth/session";
import { pageData } from "@/server/http/page";
import { getMaterial } from "@/server/services/materials.service";

export const metadata: Metadata = { title: "Material" };

export default async function MaterialPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, actor] = await Promise.all([params, requirePageActor()]);
  const m = await pageData(getMaterial(actor, id));
  const active = m.status === "ACTIVE";
  return (
    <>
      <TitleBlock
        eyebrow={<Link href="/materials?tab=catalogue" className="hover:text-ink">Catalogue</Link>}
        title={m.name}
        actions={
          <>
            {active ? <Chip tone="indigo">Active</Chip> : <Chip>Inactive</Chip>}
            {can(actor, "master.write") ? <MaterialButton material={m} /> : null}
            {can(actor, "record.void") ? <VoidButton endpoint={`/api/materials/${m.id}/status`} extra={{ status: active ? "INACTIVE" : "ACTIVE" }} label={active ? "Deactivate" : "Activate"} title={active ? "Deactivate material" : "Activate material"} message={active ? "It stops appearing in pickers. Past records keep it." : "It appears in pickers again."} success="Saved" variant={active ? "destructive" : "secondary"} confirmTone={active ? "destructive" : "primary"} /> : null}
          </>
        }
      />
      <Panel title="Details">
        <DescriptionList rows={[{ label: "Unit", value: m.unit }, { label: "Category", value: m.category ?? "—" }]} />
      </Panel>
    </>
  );
}
