import type { ReactNode } from "react";

export interface TitleCell {
  label: string;
  value: ReactNode;
}

interface Props {
  title: ReactNode;
  eyebrow?: ReactNode;
  cells?: TitleCell[];
  actions?: ReactNode;
}

/** Engineering-drawing title block that opens every major view. */
export function TitleBlock({ title, eyebrow, cells = [], actions }: Props) {
  return (
    <header className="mb-6 border border-ink bg-paper">
      <div className="flex flex-col gap-3 p-4 md:flex-row md:items-end md:justify-between lg:p-5">
        <div className="min-w-0">
          {eyebrow ? <div className="label-code mb-1 text-steel [&_a]:-my-3.5 [&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center">{eyebrow}</div> : null}
          <h1 className="headline-lg break-words">{title}</h1>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {cells.length ? (
        <dl className="grid grid-cols-2 border-t border-ink md:grid-cols-4">
          {cells.map((c, i) => (
            <div key={c.label} className={`min-w-0 border-hairline px-4 py-2 ${i % 2 ? "border-l" : ""} ${i >= 2 ? "border-t md:border-t-0" : ""} ${i > 0 ? "md:border-l" : ""}`}>
              <dt className="label-code text-steel">{c.label}</dt>
              <dd className="body-sm mt-0.5 truncate font-medium text-ink [&_a]:inline-flex [&_a]:min-h-8 [&_a]:items-center">{c.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </header>
  );
}
