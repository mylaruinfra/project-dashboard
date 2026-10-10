import type { ReactNode } from "react";

export function EmptyState({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 border border-dashed border-hairline bg-paper p-6">
      <p className="headline-sm">{title}</p>
      {body ? <p className="body-md text-steel">{body}</p> : null}
      {action}
    </div>
  );
}
