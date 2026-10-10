import { FileText, ImageIcon } from "lucide-react";
import { Chip } from "@/components/ui/Chip";
import { type Column, DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate } from "@/lib/dates";
import { DOC_KIND_LABEL, type DocKind } from "@/lib/domain";

export interface DocRow {
  id: string;
  title: string;
  kind: DocKind;
  mimeType: string;
  sizeBytes: number;
  entityType: string | null;
  status: "ACTIVE" | "ARCHIVED";
  createdAt: Date;
  projectName: string | null;
  uploadedByName: string | null;
}

const size = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export function DocumentsTable({ rows, showProject }: { rows: DocRow[]; showProject?: boolean }) {
  const cols: Column<DocRow>[] = [
    {
      key: "title",
      header: "Document",
      cell: (r) => (
        <span className="flex min-w-44 items-center gap-2">
          {r.mimeType.startsWith("image/") ? <ImageIcon className="size-4 shrink-0 text-steel" aria-hidden /> : <FileText className="size-4 shrink-0 text-steel" aria-hidden />}
          <span className={r.status === "ARCHIVED" ? "text-steel line-through" : ""}>{r.title}</span>
        </span>
      ),
    },
    { key: "kind", header: "Kind", cell: (r) => <span className="flex gap-1"><Chip tone={r.kind === "PHOTO" ? "indigo" : r.kind === "BILL" ? "hazard" : "muted"}>{DOC_KIND_LABEL[r.kind]}</Chip>{r.status === "ARCHIVED" ? <Chip tone="error">Archived</Chip> : null}</span> },
    ...(showProject ? [{ key: "project", header: "Project", cell: (r: DocRow) => r.projectName ?? "—" }] : []),
    { key: "attached", header: "Attached to", cell: (r) => (r.entityType ? r.entityType.replace("_", " ") : "—") },
    { key: "by", header: "Uploaded", cell: (r) => <span className="whitespace-nowrap">{formatDate(r.createdAt)} · {r.uploadedByName}</span> },
    { key: "size", header: "Size", align: "right", cell: (r) => size(r.sizeBytes) },
  ];
  return <DataTable columns={cols} rows={rows} rowKey={(r) => r.id} rowHref={(r) => `/documents/${r.id}`} empty={<EmptyState title="No documents" body="Upload drawings, agreements, bills and photos." />} />;
}
