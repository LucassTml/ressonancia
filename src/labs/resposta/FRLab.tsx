import { useCallback, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { LabFrame, Note } from '../../components/ui/LabFrame';
import { Segmented, Select, Slider, Toggle, fmtDb, fmtHz, fmtNum } from '../../components/ui/controls';
import { SourceBar } from '../../components/ui/audio';
import { FILTER_COLORS, FilterEditor } from '../../components/ui/FilterEditor';
import { FreqPlot, Legend, type PlotCurve, type PlotScales } from '../../viz/FreqPlot';
import { biquadCoefs, biquadDb, filtersDbAt, interpCurve, smoothNodes, type FilterSpec } from '../../audio/dsp';
import { useCurvePlayer } from '../../audio/useCurvePlayer';
import { signatureDb, signatures, targetById, targets } from '../../data/targets';
import { describeDelta } from '../../content/perception';
import { tr } from '../../i18n';

const NODE_F = [20, 40, 80, 160, 315, 630, 1250, 2500, 5000, 8000, 12000, 18000];

export const CURVE_OPTIONS = [
  { value: 'flat', label: tr("Plana (0 dB)") },
  ...targets.filter((t) => t.rig !== 'hats-oe').map((t) => ({ value: `t:${t.id}`, label: tr("Alvo: {0}", t.short) })),
  ...signatures.map((s) => ({ value: `s:${s.id}`, label: tr("Assinatura: {0}", s.name) })),
];

export function curveFn(id: string): (f: number) => number {
  if (id.startsWith('t:')) {
    const t = targetById[id.slice(2)];
    return (f) => interpCurve(t.curve, f);
  }
  if (id.startsWith('s:')) {
    const s = signatures.find((x) => x.id === id.slice(2))!;
    return (f) => signatureDb(s, f);
  }
  return () => 0;
}

const D = {
  base: 's:v-shape',
  compare: 'none',
  target: 'harman-ie-2019',
  nodes: NODE_F.map(() => 0),
  shelf: 0,
  filters: [] as FilterSpec[],
  view: 'curves' as 'curves' | 'diff',
  ref: 'target' as 'target' | 'compare',
  processed: true,
};

export default function FRLab() {
  const [s, setS] = useState(D);
  const set = <K extends keyof typeof D>(k: K, v: (typeof D)[K]) => setS((p) => ({ ...p, [k]: v }));
  const [active, setActive] = useState<number | null>(null);
  const dragging = useRef<number | null>(null);

  const base = useMemo(() => curveFn(s.base), [s.base]);
  const cmp = useMemo(() => (s.compare === 'none' ? null : curveFn(s.compare)), [s.compare]);
  const tgt = useMemo(() => (s.target === 'none' ? null : curveFn(`t:${s.target}`)), [s.target]);
  const nodeCurve = useMemo(() => NODE_F.map((f, i) => [f, s.nodes[i]] as [number, number]), [s.nodes]);
  const shelfFn = useMemo(() => {
    const c = biquadCoefs({ id: 'shelf', type: 'lowshelf', freq: 105, gain: s.shelf, q: 0.707 }, 48000);
    return (f: number) => (s.shelf ? biquadDb(c, f, 48000) : 0);
  }, [s.shelf]);

  const A = useCallback((f: number) => base(f) + smoothNodes(nodeCurve, f) + shelfFn(f) + filtersDbAt(s.filters, f), [base, nodeCurve, shelfFn, s.filters]);

  const refFn = s.ref === 'compare' && cmp ? cmp : tgt ?? (() => 0);
  const listenFn = useMemo(() => (f: number) => A(f) - refFn(f), [A, refFn]);
  const { player, preampDb } = useCurvePlayer('fr-lab', listenFn, s.processed);

  const insights = useMemo(() => (tgt ? describeDelta((f) => A(f) - tgt(f)) : []), [A, tgt]);

  const curves: PlotCurve[] =
    s.view === 'curves'
      ? [
          ...(tgt ? [{ id: 'tgt', label: targetById[s.target].short, fn: tgt, color: 'var(--c-target)', width: 1.6, dash: '6 4' }] : []),
          ...(cmp ? [{ id: 'b', label: tr("Curva B"), fn: cmp, color: 'var(--c-b)', width: 1.8 }] : []),
          { id: 'a', label: tr("Curva A"), fn: A, color: 'var(--c-a)', width: 2.6, instant: dragging.current != null },
        ]
      : [
          ...(cmp && tgt ? [{ id: 'bd', label: tr("B − alvo"), fn: (f: number) => cmp(f) - tgt(f), color: 'var(--c-b)', width: 1.6 }] : []),
          ...(cmp && !tgt ? [{ id: 'ab', label: 'A − B', fn: (f: number) => A(f) - cmp(f), color: 'var(--c-diff)', width: 2 }] : []),
          ...(tgt ? [{ id: 'ad', label: tr("A − alvo"), fn: (f: number) => A(f) - tgt(f), color: 'var(--c-a)', width: 2.4, fill: true, instant: dragging.current != null }] : []),
          ...(cmp && tgt ? [{ id: 'ab2', label: 'A − B', fn: (f: number) => A(f) - cmp(f), color: 'var(--c-diff)', width: 1.4, dash: '4 3' }] : []),
        ];

  const handleY = (i: number) => (s.view === 'curves' ? A(NODE_F[i]) : tgt ? A(NODE_F[i]) - tgt(NODE_F[i]) : A(NODE_F[i]));

  const overlay = (sc: PlotScales) => (
    <g>
      {NODE_F.map((f, i) => {
        const y = sc.y(Math.max(-24, Math.min(24, handleY(i))));
        const isActive = active === i;
        return (
          <g key={f}>
            <circle
              cx={sc.x(f)}
              cy={y}
              r={14}
              fill="transparent"
              className="cursor-ns-resize"
              style={{ touchAction: 'none' }}
              tabIndex={0}
              role="slider"
              aria-label={tr("Ajuste em {0}", fmtHz(f))}
              aria-valuenow={Number(s.nodes[i].toFixed(1))}
              aria-valuetext={fmtDb(s.nodes[i])}
              onPointerDown={(e) => {
                (e.target as Element).setPointerCapture(e.pointerId);
                dragging.current = i;
                setActive(i);
              }}
              onPointerMove={(e) => {
                if (dragging.current !== i) return;
                const svg = (e.target as SVGElement).ownerSVGElement!;
                const r = svg.getBoundingClientRect();
                const db = sc.dbAt(e.clientY - r.top);
                const current = handleY(i);
                const next = s.nodes[i] + (db - current);
                setS((p) => ({ ...p, nodes: p.nodes.map((v, k) => (k === i ? Math.max(-15, Math.min(15, Math.round(next * 10) / 10)) : v)) }));
              }}
              onPointerUp={() => {
                dragging.current = null;
              }}
              onFocus={() => setActive(i)}
              onKeyDown={(e) => {
                const step = e.shiftKey ? 2 : 0.5;
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                  e.preventDefault();
                  const d = e.key === 'ArrowUp' ? step : -step;
                  setS((p) => ({ ...p, nodes: p.nodes.map((v, k) => (k === i ? Math.max(-15, Math.min(15, v + d)) : v)) }));
                }
              }}
            />
            <circle
              cx={sc.x(f)}
              cy={y}
              r={isActive ? 6 : 4.5}
              fill={s.nodes[i] !== 0 ? 'var(--c-a)' : 'var(--bg-elev)'}
              stroke="var(--c-a)"
              strokeWidth={2}
              pointerEvents="none"
              style={{ transition: 'r .15s' }}
            />
          </g>
        );
      })}
      {s.filters.map((flt, i) =>
        flt.enabled === false ? null : (
          <circle key={flt.id} cx={sc.x(flt.freq)} cy={sc.top + sc.innerH - 7} r={3.5} fill={FILTER_COLORS[i % FILTER_COLORS.length]} pointerEvents="none" />
        ),
      )}
    </g>
  );

  const activeF = active != null ? NODE_F[active] : null;

  return (
    <LabFrame
      title={tr("Laboratório de resposta em frequência")}
      description={tr("Arraste os pontos da curva A (ou use as setas do teclado), aplique um shelf de graves e filtros paramétricos, compare com uma curva B e com um alvo, e ouça a diferença com processamento real.")}
      audio
      onReset={() => setS(D)}
      toolbar={
        <Segmented
          size="sm"
          value={s.view}
          onChange={(v) => set('view', v)}
          options={[
            { value: 'curves', label: tr("Curvas") },
            { value: 'diff', label: tr("Diferença") },
          ]}
        />
      }
      footer={
        <>{tr("As curvas estão no domínio do acoplador 711 e normalizadas em 1 kHz. Curvas de assinatura são sintéticas e representativas, não medições de produtos. Ao ouvir, o laboratório aplica ao áudio a diferença entre A e a referência escolhida — você ouve o seu próprio fone modificado por essa diferença, não “o som absoluto” da curva A.")}</>
      }
    >
      <div className="grid sm:grid-cols-3 gap-3 mb-4">
        <Select label={<span style={{ color: 'var(--c-a)' }}>{tr("Curva A — ponto de partida")}</span>} value={s.base} onChange={(v) => setS((p) => ({ ...p, base: v, nodes: NODE_F.map(() => 0) }))} options={CURVE_OPTIONS} />
        <Select label={<span style={{ color: 'var(--c-b)' }}>{tr("Curva B — comparação")}</span>} value={s.compare} onChange={(v) => set('compare', v)} options={[{ value: 'none', label: tr("Nenhuma") }, ...CURVE_OPTIONS]} />
        <Select
          label={<span style={{ color: 'var(--c-target)' }}>{tr("Alvo sobreposto")}</span>}
          value={s.target}
          onChange={(v) => set('target', v)}
          options={[{ value: 'none', label: tr("Nenhum") }, ...targets.filter((t) => t.rig !== 'hats-oe').map((t) => ({ value: t.id, label: t.short }))]}
        />
      </div>

      <FreqPlot
        curves={curves}
        height={330}
        dbMin={s.view === 'curves' ? -15 : -15}
        dbMax={s.view === 'curves' ? 20 : 15}
        dbStep={5}
        overlay={overlay}
        regions={[
          { from: 20, to: 60, label: tr("sub") },
          { from: 60, to: 250, label: tr("graves") },
          { from: 250, to: 800, label: tr("méd.-graves") },
          { from: 800, to: 2000, label: tr("médios") },
          { from: 2000, to: 5000, label: tr("presença") },
          { from: 5000, to: 10000, label: tr("agudos") },
          { from: 10000, to: 20000, label: tr("ar") },
        ]}
        ariaLabel={tr("Gráfico de resposta em frequência editável")}
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <Legend
          items={curves.filter((c) => c.label).map((c) => ({ label: c.label!, color: c.color, dash: !!c.dash }))}
        />
        {activeF != null && (
          <span className="text-[12px] text-muted font-mono tabular">{tr("ponto")}{' '}{fmtHz(activeF)}: {fmtDb(s.nodes[active!])}
          </span>
        )}
      </div>

      <div className="mt-5 grid lg:grid-cols-[1fr_1fr] gap-6">
        <div className="space-y-4">
          <Slider label={tr("Shelf de graves (105 Hz)")} value={s.shelf} min={-10} max={12} step={0.5} onChange={(v) => set('shelf', v)} format={(v) => fmtDb(v)} hint={tr("Mesma forma de shelf usada na curva Harman para ajustar graves.")} />
          <div>
            <div className="text-[12.5px] text-muted font-medium mb-2">{tr("Filtros paramétricos")}</div>
            <FilterEditor filters={s.filters} onChange={(f) => set('filters', f)} max={6} />
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.12em] font-semibold text-faint mb-2">{tr("O que esperar ouvir")}{' '}{tgt ? tr("em relação ao alvo") : ''}</div>
          {!tgt ? (
            <Note>{tr("Escolha um alvo para receber uma leitura perceptiva da curva A.")}</Note>
          ) : insights.length === 0 ? (
            <Note>{tr("A curva A está a menos de ~1,5 dB do alvo, em média, em todas as regiões: o equilíbrio tonal deve soar muito parecido.")}</Note>
          ) : (
            <ul className="space-y-2">
              <AnimatePresence initial={false}>
                {insights.map((it) => (
                  <motion.li
                    key={it.band}
                    layout
                    initial={{ opacity: 0, x: 6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-[13px] leading-relaxed text-soft"
                  >
                    <span className={`font-mono tabular text-[12px] mr-1.5 ${it.delta > 0 ? 'text-accent' : 'text-[var(--c-b)]'}`}>
                      {it.delta > 0 ? '▲' : '▼'} {fmtNum(Math.abs(it.delta), 1)} dB
                    </span>
                    <strong className="text-fg font-medium">{it.band}</strong>: {it.text}.
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
          <p className="mt-3 text-[11.5px] text-faint leading-snug">{tr("Leituras baseadas no vocabulário de engenharia de áudio e em médias de cada região. Programa musical, volume e ouvinte mudam a percepção.")}</p>

          <div className="mt-6 pt-4 border-t border-line">
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <Segmented
                size="sm"
                value={s.ref}
                onChange={(v) => set('ref', v)}
                options={[
                  { value: 'target', label: tr("A relativo ao alvo") },
                  { value: 'compare', label: tr("A relativo a B") },
                ]}
              />
              <Toggle checked={s.processed} onChange={(v) => set('processed', v)} label={s.processed ? tr("Ouvindo A") : tr("Ouvindo referência")} />
            </div>
            <SourceBar player={player} />
            <p className="mt-2 text-[11.5px] text-faint">{tr("Preamp automático:")}{' '}{fmtNum(preampDb, 1)}{' '}{tr("dB (aplicado aos dois lados da comparação).")}</p>
          </div>
        </div>
      </div>
    </LabFrame>
  );
}
