import { Chip } from "@/components/ui/Chip";
import { PROJECT_STATUS_LABEL, type ProjectStatus } from "@/lib/domain";

const TONE = { PLANNING: "muted", ONGOING: "hazard", ON_HOLD: "error", COMPLETED: "indigo", ARCHIVED: "muted" } as const;

export function ProjectStatusChip({ status }: { status: ProjectStatus }) {
  return <Chip tone={TONE[status]}>{PROJECT_STATUS_LABEL[status]}</Chip>;
}
