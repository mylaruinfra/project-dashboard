import { formatArea } from "@/lib/area";

export interface LayoutSlab {
  key: string;
  name: string;
  /** centi-ft */
  length: number;
  width: number;
}

const FILLS = ["fill-indigo-tint", "fill-hazard-tint", "fill-surface-low", "fill-canvas"];

/** Simple plan drawing: slabs side by side, to scale, with dimension labels. */
export function SlabLayout({ slabs, title }: { slabs: LayoutSlab[]; title?: string }) {
  const valid = slabs.filter((s) => s.length > 0 && s.width > 0);
  if (!valid.length) {
    return <div className="flex h-40 items-center justify-center border border-dashed border-hairline bg-paper body-sm text-steel">Enter slab sizes to see the layout</div>;
  }
  const W = 360;
  const H = 200;
  const pad = 28;
  const totalLen = valid.reduce((a, s) => a + s.length, 0);
  const maxWid = Math.max(...valid.map((s) => s.width));
  const scale = Math.min((W - pad * 2) / totalLen, (H - pad * 2) / maxWid);
  // left edge of each slab, laid side by side
  const lefts = valid.reduce<number[]>((acc, s, i) => [...acc, i === 0 ? pad : acc[i - 1]! + valid[i - 1]!.length * scale], []);
  return (
    <figure className="border border-hairline bg-paper">
      {title ? <figcaption className="label-technical border-b border-hairline px-3 py-2 text-steel">{title}</figcaption> : null}
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Slab layout drawing">
        <defs>
          <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M10 0H0V10" className="fill-none stroke-hairline" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#grid)" />
        {valid.map((s, i) => {
          const w = s.length * scale;
          const h = s.width * scale;
          const x0 = lefts[i]!;
          const small = w < 70 || h < 46;
          return (
            <g key={s.key}>
              <rect x={x0} y={pad} width={w} height={h} className={`${FILLS[i % FILLS.length]} stroke-ink`} strokeWidth="1.2" />
              {/* top dimension */}
              <line x1={x0} x2={x0 + w} y1={pad - 10} y2={pad - 10} className="stroke-steel" strokeWidth="0.75" />
              <line x1={x0} x2={x0} y1={pad - 14} y2={pad - 6} className="stroke-steel" strokeWidth="0.75" />
              <line x1={x0 + w} x2={x0 + w} y1={pad - 14} y2={pad - 6} className="stroke-steel" strokeWidth="0.75" />
              <text x={x0 + w / 2} y={pad - 14} textAnchor="middle" className="fill-steel font-display text-[8px]">
                {s.length / 100} ft
              </text>
              {/* side dimension on the last slab */}
              {i === valid.length - 1 ? (
                <text x={x0 + w + 4} y={pad + h / 2} className="fill-steel font-display text-[8px]" dominantBaseline="middle">
                  {s.width / 100} ft
                </text>
              ) : null}
              <text x={x0 + w / 2} y={pad + h / 2 - (small ? 0 : 10)} textAnchor="middle" dominantBaseline="middle" className="fill-ink font-display text-[9px] font-bold">
                {s.name}
              </text>
              {!small ? (
                <>
                  <text x={x0 + w / 2} y={pad + h / 2 + 2} textAnchor="middle" dominantBaseline="middle" className="fill-ink font-display text-[8px]">
                    {s.length / 100}′ × {s.width / 100}′
                  </text>
                  <text x={x0 + w / 2} y={pad + h / 2 + 13} textAnchor="middle" dominantBaseline="middle" className="fill-ink font-display text-[8px] font-bold">
                    {formatArea(Math.round((s.length * s.width) / 100))}
                  </text>
                </>
              ) : null}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
