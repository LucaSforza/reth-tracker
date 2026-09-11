import { useId, useMemo, useState } from "react";
import type { ChainSnapshot } from "../domain/types";
import type { Locale } from "../domain/types";
import { getCopy } from "../i18n";

interface ObservationChartProps {
  snapshots: ChainSnapshot[];
  locale: Locale;
}

const width = 760;
const height = 236;
const padding = { top: 18, right: 16, bottom: 35, left: 58 };

function eth(wei: string): number {
  try {
    const value = BigInt(wei);
    return Number(value / 10n ** 12n) / 1e6;
  } catch {
    return 0;
  }
}

function dateLabel(timestamp: number, locale: Locale, compact = false) {
  return new Intl.DateTimeFormat(locale === "it" ? "it-IT" : "en-US", compact ? { day: "2-digit", month: "short" } : { day: "2-digit", month: "short", year: "numeric" }).format(new Date(timestamp));
}

export function ObservationChart({ snapshots, locale }: ObservationChartProps) {
  const t = getCopy(locale);
  const [hovered, setHovered] = useState<number | null>(null);
  const gradientId = useId().replaceAll(":", "");
  const data = useMemo(() => [...snapshots].sort((a, b) => a.capturedAt - b.capturedAt), [snapshots]);
  const values = data.map((item) => eth(item.ethValueWei));
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const range = max - min || Math.max(max * 0.01, 0.001);
  const x = (index: number) => data.length < 2 ? width / 2 : padding.left + (index / (data.length - 1)) * (width - padding.left - padding.right);
  const y = (value: number) => padding.top + ((max - value) / range) * (height - padding.top - padding.bottom);
  const line = data.map((item, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(2)} ${y(eth(item.ethValueWei)).toFixed(2)}`).join(" ");
  const area = `${line} L ${x(Math.max(data.length - 1, 0))} ${height - padding.bottom} L ${x(0)} ${height - padding.bottom} Z`;
  const activeIndex = hovered ?? (data.length - 1);
  const active = data[activeIndex];

  if (!data.length) return <div className="chart-empty">{t.chartEmpty}</div>;

  const numberLocale = locale === "it" ? "it-IT" : "en-US";
  return (
    <div className="chart-wrap">
      <div className="chart-value" aria-live="polite">
        <span>{active ? eth(active.ethValueWei).toLocaleString(numberLocale, { minimumFractionDigits: 4, maximumFractionDigits: 4 }) : "—"} ETH</span>
        {active && <small>{dateLabel(active.capturedAt, locale)}</small>}
      </div>
      <svg className="observation-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={t.chartAria} onMouseLeave={() => setHovered(null)}>
        <defs><linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#54e3b0" stopOpacity=".23" /><stop offset="1" stopColor="#54e3b0" stopOpacity="0" /></linearGradient></defs>
        {[0, 1, 2, 3].map((step) => {
          const value = max - range * step / 3;
          const lineY = y(value);
          return <g key={step}><line x1={padding.left} x2={width - padding.right} y1={lineY} y2={lineY} className="chart-grid" /><text x={padding.left - 12} y={lineY + 4} textAnchor="end" className="chart-axis">{value.toLocaleString(numberLocale, { maximumFractionDigits: 3 })}</text></g>;
        })}
        <path d={area} fill={`url(#${gradientId})`} />
        <path d={line} className="chart-line" />
        {data.map((item, index) => <g key={item.id} onMouseEnter={() => setHovered(index)} onFocus={() => setHovered(index)} tabIndex={0} role="button" aria-label={`${dateLabel(item.capturedAt, locale)}: ${eth(item.ethValueWei).toLocaleString(numberLocale)} ETH`}><circle cx={x(index)} cy={y(eth(item.ethValueWei))} r={hovered === index ? 5 : 3.5} className={`chart-point ${hovered === index ? "active" : ""}`} /><rect x={x(index) - 16} y={padding.top} width={32} height={height - padding.top - padding.bottom} fill="transparent" /></g>)}
        {data.map((item, index) => (index === 0 || index === data.length - 1 || data.length < 4) && <text key={`label-${item.id}`} x={x(index)} y={height - 11} textAnchor={index === 0 ? "start" : index === data.length - 1 ? "end" : "middle"} className="chart-axis">{dateLabel(item.capturedAt, locale, true)}</text>)}
      </svg>
    </div>
  );
}
