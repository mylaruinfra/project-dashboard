import { Panel } from "@/components/ui/Panel";
import { formatDateTime } from "@/lib/dates";

const ACTION: Record<string, string> = {
  create: "Created",
  update: "Edited",
  void: "Voided",
  archive: "Archived",
  restore: "Restored",
  activate: "Activated",
  deactivate: "Deactivated",
  confirm: "Confirmed",
  reject: "Rejected",
  status: "Status changed",
  upload: "Uploaded",
  progress: "Progress updated",
  reread: "Read again",
};

export interface HistoryRow {
  id: number;
  action: string;
  reason: string | null;
  at: Date | string;
  byName: string | null;
}

/** Who did what and why — from the audit log. */
export function History({ rows }: { rows: HistoryRow[] }) {
  return (
    <Panel title="History">
      {rows.length ? (
        <ol className="divide-y divide-hairline">
          {rows.map((h) => (
            <li key={h.id} className="px-4 py-3">
              <p className="body-md">
                <span className="font-medium">{ACTION[h.action] ?? h.action.replace(/_/g, " ")}</span> by {h.byName ?? "system"}
              </p>
              <p className="body-sm text-steel">{formatDateTime(h.at)}</p>
              {h.reason ? <p className="body-sm mt-1 border-l-2 border-hazard pl-2">“{h.reason}”</p> : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="body-sm p-4 text-steel">No history yet.</p>
      )}
    </Panel>
  );
}
