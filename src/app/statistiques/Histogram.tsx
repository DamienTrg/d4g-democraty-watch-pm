import type { Bucket } from "@/lib/stats";

const fmt = new Intl.NumberFormat("fr-FR");
const plural = (n: number, word: string) => (n > 1 ? word : word.replace(/s$/, ""));

/**
 * Histogramme en barres verticales, en HTML/CSS pur (pas de librairie).
 * Une seule série, donc pas de légende : le titre nomme ce qui est mesuré.
 * Survol d'une barre → infobulle avec la valeur exacte et la part du total.
 */
export function Histogram({
  title,
  buckets,
  unitLabel,
  itemLabel,
}: {
  title: string;
  buckets: Bucket[];
  /** ex. « articles » — ce que compte l'axe horizontal */
  unitLabel: string;
  /** ex. « lois » — ce que compte la hauteur des barres */
  itemLabel: string;
}) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const total = buckets.reduce((s, b) => s + b.count, 0);

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="mb-8 text-sm font-medium">{title}</figcaption>
      <div
        className="grid h-48 gap-[2px] border-b border-line"
        style={{ gridTemplateColumns: `repeat(${buckets.length}, minmax(0, 1fr))`, gridTemplateRows: "100%" }}
        role="img"
        aria-label={`${title} : ${buckets.map((b) => `${b.label} ${unitLabel}, ${b.count} ${itemLabel}`).join(" ; ")}`}
      >
        {buckets.map((b) => {
          const pct = total ? Math.round((b.count / total) * 100) : 0;
          return (
            <div key={b.label} className="group relative flex h-full items-end">
              <div
                className="w-full rounded-t-[4px] bg-series-1 transition-opacity group-hover:opacity-80"
                style={{ height: `${(b.count / max) * 100}%`, minHeight: b.count ? 2 : 0 }}
              />
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-background px-2 py-1 text-xs shadow-sm group-hover:block">
                <span className="font-medium">{b.label} {unitLabel}</span>
                <br />
                {fmt.format(b.count)} {plural(b.count, itemLabel)} · {pct} %
              </div>
            </div>
          );
        })}
      </div>
      <div
        className="grid gap-[2px] text-center text-xs text-muted tabular-nums"
        style={{ gridTemplateColumns: `repeat(${buckets.length}, minmax(0, 1fr))` }}
      >
        {buckets.map((b) => (
          <span key={b.label}>{b.label}</span>
        ))}
      </div>
      <p className="text-center text-xs text-muted">Nombre d&apos;{unitLabel}</p>

      <details className="text-sm">
        <summary className="cursor-pointer text-muted">Voir les données</summary>
        <table className="mt-2 w-full text-left tabular-nums">
          <thead className="text-muted">
            <tr>
              <th className="py-1 font-normal">{unitLabel[0].toUpperCase() + unitLabel.slice(1)}</th>
              <th className="py-1 text-right font-normal">{itemLabel[0].toUpperCase() + itemLabel.slice(1)}</th>
              <th className="py-1 text-right font-normal">Part</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((b) => (
              <tr key={b.label} className="border-t border-line">
                <td className="py-1">{b.label}</td>
                <td className="py-1 text-right">{fmt.format(b.count)}</td>
                <td className="py-1 text-right">
                  {total ? Math.round((b.count / total) * 100) : 0} %
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
