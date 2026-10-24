/** Graphiques SVG simples, rendus côté serveur (aucune dépendance). */

export function BarChart({
  data,
  height = 160,
  formatValue = (v: number) => String(v),
}: {
  data: Array<{ label: string; value: number }>;
  height?: number;
  formatValue?: (v: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const barW = 100 / Math.max(data.length, 1);
  return (
    <div>
      <svg viewBox={`0 0 100 ${height / 4}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
        {data.map((d, i) => {
          const h = (d.value / max) * (height / 4 - 6);
          return (
            <rect
              key={i}
              x={i * barW + barW * 0.2}
              y={height / 4 - h - 2}
              width={barW * 0.6}
              height={Math.max(h, d.value > 0 ? 1 : 0)}
              rx="0.8"
              fill="#2f5f99"
            />
          );
        })}
      </svg>
      <div className="mt-2 flex text-[10px] text-slate-500">
        {data.map((d, i) => (
          <div key={i} className="flex-1 truncate text-center" title={`${d.label} : ${formatValue(d.value)}`}>
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}

const DONUT_COLORS = ["#2f5f99", "#f97316", "#10b981", "#f59e0b", "#ef4444", "#6366f1", "#14b8a6", "#94a3b8"];

export function DonutChart({
  data,
  size = 140,
}: {
  data: Array<{ label: string; value: number }>;
  size?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = 40;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 100 100" style={{ width: size, height: size }}>
        {data.map((d, i) => {
          const len = (d.value / total) * c;
          const el = (
            <circle
              key={i}
              cx="50" cy="50" r={r}
              fill="none"
              stroke={DONUT_COLORS[i % DONUT_COLORS.length]}
              strokeWidth="16"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 50 50)"
            />
          );
          offset += len;
          return el;
        })}
        <text x="50" y="50" textAnchor="middle" dominantBaseline="central" className="fill-navy-950" style={{ fontSize: 14, fontWeight: 700 }}>
          {total}
        </text>
      </svg>
      <ul className="space-y-1 text-xs">
        {data.map((d, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
            <span className="text-slate-600">{d.label}</span>
            <span className="font-semibold text-navy-900">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
