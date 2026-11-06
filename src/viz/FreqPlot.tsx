import { useMemo, useRef, useState, type ReactNode } from 'react';
import { logFreqs } from '../audio/dsp';
import { useElementSize, useTweened } from '../lib/hooks';
import { fmtHz } from '../components/ui/controls';

export interface PlotCurve {
  id: string;
  label?: string;
  /** dB em função da frequência */
  fn: (f: number) => number;
  color: string;
  width?: number;
  dash?: string;
  opacity?: number;
  /** preenche a área entre a curva e 0 dB */
  fill?: boolean;
  /** não interpolar ao mudar */
  instant?: boolean;
}

export interface PlotScales {
  x: (f: number) => number;
  y: (db: number) => number;
  fAt: (px: number) => number;
  dbAt: (py: number) => number;
  width: number;
  height: number;
  left: number;
  top: number;
  innerW: number;
  innerH: number;
}

interface FreqPlotProps {
  curves: PlotCurve[];
  dbMin?: number;
  dbMax?: number;
  dbStep?: number;
  fMin?: number;
  fMax?: number;
  height?: number;
  yLabel?: string;
  regions?: { from: number; to: number; label: string; color?: string }[];
  /** sobreposições (alças arrastáveis etc.) desenhadas dentro do SVG */
  overlay?: (s: PlotScales) => ReactNode;
  readout?: boolean;
  ariaLabel?: string;
  className?: string;
  /** formatação dos rótulos do eixo vertical e da leitura (padrão: dB com sinal) */
  yFormat?: (v: number) => string;
}

const MAJOR = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
const MINOR = [30, 40, 60, 70, 80, 90, 300, 400, 600, 700, 800, 900, 3000, 4000, 6000, 7000, 8000, 9000];

export function FreqPlot({
  curves,
  dbMin = -15,
  dbMax = 15,
  dbStep = 5,
  fMin = 20,
  fMax = 20000,
  height = 300,
  yLabel = 'dB',
  regions,
  overlay,
  readout = true,
  ariaLabel = 'Gráfico de resposta em frequência',
  className = '',
  yFormat,
}: FreqPlotProps) {
  const [wrapRef, { width }] = useElementSize<HTMLDivElement>();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverF, setHoverF] = useState<number | null>(null);
  const compact = width < 520;
  const margin = { left: compact ? 34 : 42, right: 12, top: 12, bottom: 26 };
  const innerW = Math.max(10, width - margin.left - margin.right);
  const innerH = height - margin.top - margin.bottom;

  const freqs = useMemo(() => logFreqs(compact ? 160 : 260, fMin, fMax), [compact, fMin, fMax]);

  const s: PlotScales = useMemo(() => {
    const lr = Math.log(fMax / fMin);
    return {
      x: (f: number) => margin.left + (Math.log(f / fMin) / lr) * innerW,
      y: (db: number) => margin.top + ((dbMax - db) / (dbMax - dbMin)) * innerH,
      fAt: (px: number) => fMin * Math.exp(((px - margin.left) / innerW) * lr),
      dbAt: (py: number) => dbMax - ((py - margin.top) / innerH) * (dbMax - dbMin),
      width,
      height,
      left: margin.left,
      top: margin.top,
      innerW,
      innerH,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, innerW, innerH, dbMin, dbMax, fMin, fMax, margin.left]);

  // Amostra todas as curvas em um vetor único para interpolar suavemente.
  const flat = useMemo(() => {
    const out: number[] = [];
    for (const c of curves) for (const f of freqs) out.push(c.fn(f));
    return out;
  }, [curves, freqs]);
  const anyInstant = curves.some((c) => c.instant);
  const tween = useTweened(flat, anyInstant ? 0 : 280);

  const ticksY: number[] = [];
  for (let d = Math.ceil(dbMin / dbStep) * dbStep; d <= dbMax; d += dbStep) ticksY.push(d);

  const clampY = (db: number) => Math.max(dbMin - 6, Math.min(dbMax + 6, db));

  const paths = curves.map((_c, ci) => {
    let d = '';
    for (let i = 0; i < freqs.length; i++) {
      const v = tween[ci * freqs.length + i] ?? 0;
      d += `${i ? 'L' : 'M'}${s.x(freqs[i]).toFixed(1)},${s.y(clampY(v)).toFixed(1)}`;
    }
    return d;
  });

  const onMove = (e: React.PointerEvent) => {
    if (!readout || !svgRef.current) return;
    const r = svgRef.current.getBoundingClientRect();
    const px = e.clientX - r.left;
    if (px < margin.left || px > margin.left + innerW) return setHoverF(null);
    setHoverF(s.fAt(px));
  };

  const clipId = useMemo(() => `clip-${Math.random().toString(36).slice(2)}`, []);

  return (
    <div ref={wrapRef} className={`relative w-full select-none ${className}`}>
      {width > 0 && (
        <svg
          ref={svgRef}
          width={width}
          height={height}
          role="img"
          aria-label={ariaLabel}
          onPointerMove={onMove}
          onPointerLeave={() => setHoverF(null)}
          className="block overflow-visible touch-pan-y"
        >
          <defs>
            <clipPath id={clipId}>
              <rect x={margin.left} y={margin.top} width={innerW} height={innerH} />
            </clipPath>
          </defs>
          {regions?.map((r, i) => (
            <g key={i}>
              <rect
                x={s.x(r.from)}
                y={margin.top}
                width={Math.max(0, s.x(r.to) - s.x(r.from))}
                height={innerH}
                fill={r.color ?? (i % 2 ? 'var(--c-grid)' : 'transparent')}
              />
              {!compact && (
                <text
                  x={(s.x(r.from) + s.x(r.to)) / 2}
                  y={margin.top + 12}
                  textAnchor="middle"
                  className="fill-[var(--fg-faint)] text-[10px] font-medium"
                >
                  {r.label}
                </text>
              )}
            </g>
          ))}
          {MINOR.filter((f) => f > fMin && f < fMax).map((f) => (
            <line key={f} x1={s.x(f)} x2={s.x(f)} y1={margin.top} y2={margin.top + innerH} stroke="var(--c-grid)" />
          ))}
          {MAJOR.filter((f) => f >= fMin && f <= fMax).map((f) => (
            <g key={f}>
              <line x1={s.x(f)} x2={s.x(f)} y1={margin.top} y2={margin.top + innerH} stroke="var(--c-grid-strong)" />
              <text
                x={s.x(f)}
                y={height - 8}
                textAnchor="middle"
                className="fill-[var(--fg-muted)] text-[10.5px] tabular"
              >
                {f >= 1000 ? `${f / 1000}k` : f}
              </text>
            </g>
          ))}
          {ticksY.map((d) => (
            <g key={d}>
              <line
                x1={margin.left}
                x2={margin.left + innerW}
                y1={s.y(d)}
                y2={s.y(d)}
                stroke={d === 0 ? 'var(--c-grid-strong)' : 'var(--c-grid)'}
              />
              <text x={margin.left - 7} y={s.y(d) + 3.5} textAnchor="end" className="fill-[var(--fg-muted)] text-[10.5px] tabular">
                {yFormat ? yFormat(d) : d > 0 ? `+${d}` : d}
              </text>
            </g>
          ))}
          <text
            x={8}
            y={margin.top + 4}
            className="fill-[var(--fg-faint)] text-[10px]"
            transform={`rotate(-90 8 ${margin.top + 4})`}
            textAnchor="end"
          >
            {yLabel}
          </text>
          <g clipPath={`url(#${clipId})`}>
            {curves.map((c, i) =>
              c.fill ? (
                <path
                  key={c.id + '-fill'}
                  d={`${paths[i]}L${s.x(fMax)},${s.y(0)}L${s.x(fMin)},${s.y(0)}Z`}
                  fill={c.color}
                  opacity={0.1}
                />
              ) : null,
            )}
            {curves.map((c, i) => (
              <path
                key={c.id}
                d={paths[i]}
                fill="none"
                stroke={c.color}
                strokeWidth={c.width ?? 2}
                strokeDasharray={c.dash}
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity={c.opacity ?? 1}
              />
            ))}
          </g>
          {overlay?.(s)}
          {hoverF != null && (
            <g pointerEvents="none">
              <line x1={s.x(hoverF)} x2={s.x(hoverF)} y1={margin.top} y2={margin.top + innerH} stroke="var(--fg-faint)" strokeDasharray="2 3" />
              {curves.map((c) => {
                const v = c.fn(hoverF);
                if (v < dbMin - 1 || v > dbMax + 1) return null;
                return <circle key={c.id} cx={s.x(hoverF)} cy={s.y(v)} r={3} fill={c.color} stroke="var(--bg-elev)" strokeWidth={1.5} />;
              })}
            </g>
          )}
        </svg>
      )}
      {readout && hoverF != null && width > 0 && (
        <div
          className="pointer-events-none absolute top-2 z-10 rounded-lg border border-line bg-elev/95 backdrop-blur px-2.5 py-1.5 text-[11.5px] shadow-[var(--shadow-pop)]"
          style={{
            left: Math.min(width - 170, Math.max(margin.left + 4, s.x(hoverF) + 10)),
          }}
        >
          <div className="font-mono tabular text-fg mb-0.5">{fmtHz(hoverF)}</div>
          {curves
            .filter((c) => c.label)
            .map((c) => {
              const v = c.fn(hoverF);
              return (
                <div key={c.id} className="flex items-center gap-1.5 whitespace-nowrap">
                  <span className="w-2 h-[2px] rounded" style={{ background: c.color }} />
                  <span className="text-muted">{c.label}</span>
                  <span className="ml-auto pl-2 font-mono tabular text-fg">
                    {yFormat ? yFormat(v) : `${v > 0 ? '+' : ''}${v.toFixed(1)}`}
                  </span>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; dash?: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          <svg width="16" height="6" aria-hidden>
            <line x1="0" x2="16" y1="3" y2="3" stroke={it.color} strokeWidth="2" strokeDasharray={it.dash ? '4 3' : undefined} />
          </svg>
          {it.label}
        </span>
      ))}
    </div>
  );
}
