import type { PlotShape } from "@/lib/area";

/** Rough plan of the plot shape with side labels and the road edge. Not to exact scale. */
export function PlotSketch({ shape, sides, road }: { shape: PlotShape; sides: Record<string, string>; road?: string }) {
  const n = (k: string) => Math.max(1, Number.parseFloat(sides[k] ?? "") || 0);
  const W = 300;
  const H = 190;
  const box = { x: 40, y: 18, w: 200, h: 120 };
  let path = "";
  const labels: { x: number; y: number; t: string; anchor?: "start" | "middle" | "end" }[] = [];
  const s = (k: string) => (sides[k] ? `${sides[k]} ft` : "?");

  switch (shape) {
    case "RECTANGLE": {
      const r = Math.min(box.w / n("length"), box.h / n("width"));
      const w = n("length") * r;
      const h = n("width") * r;
      path = `M${box.x},${box.y} h${w} v${h} h${-w} Z`;
      labels.push({ x: box.x + w / 2, y: box.y + h + 12, t: s("length") }, { x: box.x + w + 6, y: box.y + h / 2, t: s("width"), anchor: "start" });
      break;
    }
    case "TRAPEZOID": {
      const maxW = Math.max(n("front"), n("back"));
      const r = Math.min(box.w / maxW, box.h / n("depth"));
      const f = n("front") * r;
      const b = n("back") * r;
      const h = n("depth") * r;
      const cx = box.x + (maxW * r) / 2;
      path = `M${cx - b / 2},${box.y} h${b} L${cx + f / 2},${box.y + h} h${-f} Z`;
      labels.push({ x: cx, y: box.y - 4, t: s("back") }, { x: cx, y: box.y + h + 12, t: s("front") }, { x: cx + Math.max(f, b) / 2 + 6, y: box.y + h / 2, t: s("depth"), anchor: "start" });
      break;
    }
    case "L_SHAPE": {
      const r = Math.min(box.w / n("length"), box.h / n("width"));
      const w = n("length") * r;
      const h = n("width") * r;
      const cw = Math.min(n("cutLength") * r, w - 4);
      const ch = Math.min(n("cutWidth") * r, h - 4);
      path = `M${box.x},${box.y} h${w - cw} v${ch} h${cw} v${h - ch} h${-w} Z`;
      labels.push({ x: box.x + w / 2, y: box.y + h + 12, t: s("length") }, { x: box.x - 6, y: box.y + h / 2, t: s("width"), anchor: "end" }, { x: box.x + w - cw / 2, y: box.y + ch / 2, t: `cut ${s("cutLength")} × ${s("cutWidth")}` });
      break;
    }
    case "T_SHAPE": {
      const totalH = n("topWidth") + n("stemLength");
      const maxW = Math.max(n("topLength"), n("stemWidth"));
      const r = Math.min(box.w / maxW, box.h / totalH);
      const tw = n("topLength") * r;
      const th = n("topWidth") * r;
      const sw = n("stemWidth") * r;
      const sh = n("stemLength") * r;
      const cx = box.x + tw / 2;
      path = `M${box.x},${box.y} h${tw} v${th} h${-(tw - sw) / 2} v${sh} h${-sw} v${-sh} h${-(tw - sw) / 2} Z`;
      labels.push({ x: cx, y: box.y - 4, t: s("topLength") }, { x: cx, y: box.y + th + sh + 12, t: s("stemWidth") }, { x: cx + sw / 2 + 6, y: box.y + th + sh / 2, t: s("stemLength"), anchor: "start" });
      break;
    }
    case "IRREGULAR":
      path = `M${box.x + 10},${box.y + 10} L${box.x + 170},${box.y} L${box.x + 200},${box.y + 80} L${box.x + 120},${box.y + 120} L${box.x},${box.y + 95} Z`;
      labels.push({ x: box.x + 100, y: box.y + 60, t: "Area entered by hand" });
      break;
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full border border-hairline bg-paper" role="img" aria-label="Plot sketch">
      <path d={path} className="fill-hazard-tint stroke-ink" strokeWidth="1.5" />
      {labels.map((l, i) => (
        <text key={i} x={l.x} y={l.y} textAnchor={l.anchor ?? "middle"} dominantBaseline="middle" className="fill-ink font-display text-[9px]">
          {l.t}
        </text>
      ))}
      <rect x="0" y={H - 26} width={W} height="18" className="fill-surface-low stroke-hairline" />
      <text x={W / 2} y={H - 17} textAnchor="middle" dominantBaseline="middle" className="fill-steel font-display text-[9px]">
        {road || "Road"}
      </text>
      <g transform={`translate(${W - 24},26)`} className="stroke-ink">
        <line x1="0" y1="-12" x2="0" y2="12" strokeWidth="1" />
        <line x1="-12" y1="0" x2="12" y2="0" strokeWidth="1" />
        <text x="0" y="-16" textAnchor="middle" className="fill-ink stroke-none font-display text-[8px] font-bold">
          N
        </text>
      </g>
    </svg>
  );
}
