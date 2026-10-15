/**
 * Camembert (anneau) en SVG pur, rendu côté serveur : fonctionne aussi dans
 * la page statique. Limité à 6 parts (au-delà, regrouper dans « Autres ») :
 * la couleur seule ne suffit pas, chaque part est reprise dans la légende
 * avec son libellé, son nombre et son pourcentage.
 */
export type Tone = 1 | 2 | 3 | 4 | 5 | "other";
export type Slice = { label: string; value: number; tone: Tone };

// Noms de classes écrits en entier pour que Tailwind les détecte.
const FILL: Record<Tone, string> = {
  1: "fill-series-1",
  2: "fill-series-2",
  3: "fill-series-3",
  4: "fill-series-4",
  5: "fill-series-5",
  other: "fill-series-other",
};
const STROKE: Record<Tone, string> = {
  1: "stroke-series-1",
  2: "stroke-series-2",
  3: "stroke-series-3",
  4: "stroke-series-4",
  5: "stroke-series-5",
  other: "stroke-series-other",
};
const BG: Record<Tone, string> = {
  1: "bg-series-1",
  2: "bg-series-2",
  3: "bg-series-3",
  4: "bg-series-4",
  5: "bg-series-5",
  other: "bg-series-other",
};

const fmt = new Intl.NumberFormat("fr-FR");
const pctFmt = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

const SIZE = 220;
const R = SIZE / 2;
const INNER = R * 0.6;

function point(radius: number, angle: number) {
  // angle 0 = midi, sens horaire
  return [R + radius * Math.sin(angle), R - radius * Math.cos(angle)] as const;
}

function arcPath(start: number, end: number) {
  const large = end - start > Math.PI ? 1 : 0;
  const [x1, y1] = point(R, start);
  const [x2, y2] = point(R, end);
  const [x3, y3] = point(INNER, end);
  const [x4, y4] = point(INNER, start);
  return [
    `M ${x1} ${y1}`,
    `A ${R} ${R} 0 ${large} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${INNER} ${INNER} 0 ${large} 0 ${x4} ${y4}`,
    "Z",
  ].join(" ");
}

export function Donut({
  slices,
  centerValue,
  centerLabel,
  ariaLabel,
}: {
  slices: Slice[];
  centerValue: string;
  centerLabel: string;
  ariaLabel: string;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  let angle = 0;

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-10">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="h-56 w-56 shrink-0"
        role="img"
        aria-label={ariaLabel}
      >
        {total > 0 &&
          slices.map((s) => {
            const share = s.value / total;
            const start = angle;
            angle += share * 2 * Math.PI;
            const title = `${s.label} : ${fmt.format(s.value)} (${pctFmt.format(share * 100)} %)`;
            // Part unique = anneau complet (un arc de 360° ne se dessine pas).
            if (share >= 0.9999) {
              return (
                <g key={s.label}>
                  <title>{title}</title>
                  <circle
                    cx={R}
                    cy={R}
                    r={(R + INNER) / 2}
                    fill="none"
                    className={STROKE[s.tone]}
                    strokeWidth={R - INNER}
                  />
                </g>
              );
            }
            return (
              <path
                key={s.label}
                d={arcPath(start, angle)}
                // 2 px de séparation couleur du fond entre les parts
                stroke="var(--background)"
                strokeWidth={2}
                strokeLinejoin="round"
                className={`${FILL[s.tone]} transition-opacity hover:opacity-80`}
              >
                <title>{title}</title>
              </path>
            );
          })}
        <text
          x={R}
          y={R - 4}
          textAnchor="middle"
          className="fill-foreground text-[28px] font-semibold"
        >
          {centerValue}
        </text>
        <text
          x={R}
          y={R + 18}
          textAnchor="middle"
          className="fill-muted text-[12px]"
        >
          {centerLabel}
        </text>
      </svg>

      <ul className="flex w-full flex-col gap-2 text-sm">
        {slices.map((s) => (
          <li key={s.label} className="flex items-baseline gap-2">
            <span
              aria-hidden
              className={`inline-block h-3 w-3 shrink-0 translate-y-0.5 rounded-sm ${BG[s.tone]}`}
            />
            <span className="flex-1">{s.label}</span>
            <span className="tabular-nums">{fmt.format(s.value)}</span>
            <span className="w-14 text-right tabular-nums text-muted">
              {total ? pctFmt.format((s.value / total) * 100) : 0} %
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
