import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate } from "@/lib/dates";

export interface PhotoRow {
  id: string;
  title: string;
  caption: string | null;
  createdAt: Date;
  uploadedByName: string | null;
}

/** Site photos are documents of kind PHOTO. */
export function PhotoGrid({ photos }: { photos: PhotoRow[] }) {
  if (!photos.length) return <EmptyState title="No site photos yet" body="Take photos on site and upload them here." />;
  return (
    <ul className="grid grid-cols-2 gap-px border border-hairline bg-hairline md:grid-cols-3 lg:grid-cols-4">
      {photos.map((p) => (
        <li key={p.id} className="bg-paper">
          <Link href={`/documents/${p.id}`} className="group block">
            {/* eslint-disable-next-line @next/next/no-img-element -- served by our own permission-checked route */}
            <img src={`/api/documents/${p.id}/file`} alt={p.caption ?? p.title} loading="lazy" className="aspect-[4/3] w-full bg-canvas object-cover" />
            <span className="block p-2">
              <span className="body-sm block truncate font-medium group-hover:text-hazard">{p.caption ?? p.title}</span>
              <span className="label-code block text-steel">
                {formatDate(p.createdAt)} · {p.uploadedByName}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
