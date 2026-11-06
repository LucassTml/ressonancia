import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LabFrame, Note } from '../../components/ui/LabFrame';
import { Segmented, fmtHz } from '../../components/ui/controls';
import { PlayButton, usePlayback, fadeGain } from '../../components/ui/audio';
import { pinkNoiseBuffer } from '../../audio/engine';
import { useElementSize } from '../../lib/hooks';

interface Region {
  id: string;
  name: string;
  en: string;
  from: number;
  to: number;
  text: string;
  excess: string;
  lack: string;
}

const REGIONS: Region[] = [
  { id: 'sub', name: 'Subgraves', en: 'Sub-bass', from: 20, to: 60, text: 'Mais sentidos que ouvidos: pressão, “ronco”, a sensação física de um bumbo eletrônico ou de um órgão. Pouca música tem conteúdo abaixo de 30 Hz.', excess: 'Ronco constante, sensação de pressão no ouvido, cansaço.', lack: 'Música eletrônica e trilhas perdem peso e impacto profundo.' },
  { id: 'midbass', name: 'Graves médios', en: 'Mid-bass', from: 60, to: 250, text: 'O corpo do bumbo, do baixo elétrico e o calor das vozes masculinas. Região que define “punch” e “calor”.', excess: 'Retumbante (boomy), graves “gordos” que vazam para os médios.', lack: 'Som magro, sem corpo nem impacto.' },
  { id: 'lowmid', name: 'Médios-graves', en: 'Low-mids', from: 250, to: 800, text: 'Fundamentais da maioria dos instrumentos e vozes. Responsável pela espessura e pelo “peso” das notas.', excess: 'Embolado (muddy), abafado, “caixa de papelão”.', lack: 'Som oco, distante, sem densidade.' },
  { id: 'mid', name: 'Médios', en: 'Midrange', from: 800, to: 2000, text: 'Inteligibilidade e caráter: onde vivem os primeiros formantes, o “nasal” e a definição de guitarras e pianos.', excess: 'Anasalado, “buzina”, cansativo em volume alto.', lack: 'Vozes recuadas, instrumentos sem definição.' },
  { id: 'uppermid', name: 'Médios-agudos / presença', en: 'Upper-mids / presence', from: 2000, to: 5000, text: 'A região mais sensível da audição e onde a orelha gera o maior ganho natural. Define presença, articulação e o “ataque” das notas.', excess: 'Gritado (shouty), estridente (harsh), fadiga rápida.', lack: 'Som escuro, sem presença, vozes “atrás de uma cortina”.' },
  { id: 'treble', name: 'Agudos', en: 'Treble', from: 5000, to: 10000, text: 'Sibilantes (s, ch), pratos, cordas friccionadas, brilho e detalhe de textura.', excess: 'Sibilante, metálico, “chiado” nos pratos.', lack: 'Abafado, sem detalhe, pratos sem brilho.' },
  { id: 'air', name: 'Ar / extensão', en: 'Air / upper treble', from: 10000, to: 20000, text: 'Harmônicos superiores, “ar” e sensação de espaço. A audição perde sensibilidade aqui com a idade.', excess: 'Aspereza fina, sensação “digital” (frequentemente em picos estreitos).', lack: 'Menos “ar” e abertura; difícil de perceber para muitos adultos.' },
];

interface Source {
  name: string;
  group: 'voz' | 'instrumento';
  /** faixa das fundamentais */
  f: [number, number];
  /** extensão aproximada de harmônicos e ruídos relevantes */
  h: [number, number];
}

const SOURCES: Source[] = [
  { name: 'Voz masculina (fala/canto)', group: 'voz', f: [85, 400], h: [400, 8000] },
  { name: 'Voz feminina (fala/canto)', group: 'voz', f: [165, 1050], h: [1050, 10000] },
  { name: 'Sibilantes (s, ch)', group: 'voz', f: [4000, 10000], h: [10000, 12000] },
  { name: 'Bumbo', group: 'instrumento', f: [40, 100], h: [100, 5000] },
  { name: 'Caixa', group: 'instrumento', f: [150, 250], h: [250, 12000] },
  { name: 'Pratos', group: 'instrumento', f: [300, 600], h: [600, 18000] },
  { name: 'Baixo elétrico', group: 'instrumento', f: [41, 400], h: [400, 4000] },
  { name: 'Violão / guitarra', group: 'instrumento', f: [82, 1300], h: [1300, 8000] },
  { name: 'Piano', group: 'instrumento', f: [27.5, 4186], h: [4186, 12000] },
  { name: 'Violino', group: 'instrumento', f: [196, 3500], h: [3500, 14000] },
  { name: 'Violoncelo', group: 'instrumento', f: [65, 1000], h: [1000, 8000] },
  { name: 'Flauta', group: 'instrumento', f: [262, 2100], h: [2100, 8000] },
  { name: 'Trompete', group: 'instrumento', f: [165, 1000], h: [1000, 12000] },
  { name: 'Tuba', group: 'instrumento', f: [44, 350], h: [350, 3000] },
  { name: 'Órgão de tubos', group: 'instrumento', f: [16, 8000], h: [8000, 16000] },
];

export default function SpectrumMap() {
  const [sel, setSel] = useState<string>('uppermid');
  const [mode, setMode] = useState<'band' | 'cut'>('band');
  const [wrap, { width }] = useElementSize<HTMLDivElement>();
  const pb = usePlayback('spectrum');
  const filt = useRef<BiquadFilterNode[] | null>(null);

  const r = REGIONS.find((x) => x.id === sel)!;
  const fMin = 16, fMax = 20000;
  const x = (f: number) => (Math.log(f / fMin) / Math.log(fMax / fMin)) * width;

  const centerQ = useMemo(() => {
    const fc = Math.sqrt(r.from * r.to);
    const bwOct = Math.log2(r.to / r.from);
    const q = Math.sqrt(Math.pow(2, bwOct)) / (Math.pow(2, bwOct) - 1);
    return { fc, q };
  }, [r]);

  // atualiza filtros ao trocar de região
  useEffect(() => {
    const f = filt.current;
    if (!f) return;
    const ctx = f[0].context;
    if (mode === 'band') {
      f[0].type = 'highpass';
      f[1].type = 'lowpass';
      f[0].frequency.setTargetAtTime(r.from, ctx.currentTime, 0.02);
      f[1].frequency.setTargetAtTime(r.to, ctx.currentTime, 0.02);
      f[2].type = 'highpass';
      f[3].type = 'lowpass';
      f[2].frequency.setTargetAtTime(r.from, ctx.currentTime, 0.02);
      f[3].frequency.setTargetAtTime(r.to, ctx.currentTime, 0.02);
    } else {
      f.forEach((n, i) => {
        n.type = i === 0 ? 'notch' : 'allpass';
        n.frequency.setTargetAtTime(centerQ.fc, ctx.currentTime, 0.02);
        n.Q.setTargetAtTime(i === 0 ? centerQ.q : 0.7, ctx.currentTime, 0.02);
      });
    }
  }, [r, mode, centerQ]);

  const start = () =>
    pb.start((ctx, out) => {
      const fg = fadeGain(ctx, out, mode === 'band' ? 1.4 : 0.6);
      const src = ctx.createBufferSource();
      src.buffer = pinkNoiseBuffer(ctx);
      src.loop = true;
      const f = [0, 1, 2, 3].map(() => ctx.createBiquadFilter());
      if (mode === 'band') {
        f[0].type = 'highpass';
        f[1].type = 'lowpass';
        f[2].type = 'highpass';
        f[3].type = 'lowpass';
        f[0].frequency.value = f[2].frequency.value = r.from;
        f[1].frequency.value = f[3].frequency.value = r.to;
      } else {
        f.forEach((n, i) => {
          n.type = i === 0 ? 'notch' : 'allpass';
          n.frequency.value = centerQ.fc;
          n.Q.value = i === 0 ? centerQ.q : 0.7;
        });
      }
      src.connect(f[0]).connect(f[1]).connect(f[2]).connect(f[3]).connect(fg.node);
      src.start();
      filt.current = f;
      return () => fg.release(() => {
        src.stop();
        filt.current = null;
      });
    });

  return (
    <LabFrame
      title="Mapa do espectro audível"
      description="Escala logarítmica de 16 Hz a 20 kHz: cada oitava ocupa o mesmo espaço, como na audição. Clique numa região para ler sobre ela e ouvir só aquela faixa em ruído rosa."
      audio
      onReset={() => setSel('uppermid')}
    >
      <div ref={wrap} className="relative">
        {width > 0 && (
          <svg width={width} height={392} className="block overflow-visible" role="group" aria-label="Regiões do espectro">
            {REGIONS.map((rg) => {
              const active = rg.id === sel;
              return (
                <g key={rg.id} onClick={() => setSel(rg.id)} className="cursor-pointer" role="button" aria-label={rg.name} tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setSel(rg.id)}>
                  <rect x={x(rg.from)} y={0} width={x(rg.to) - x(rg.from)} height={34} fill={active ? 'var(--accent-soft)' : 'transparent'} stroke="var(--line)" />
                  <motion.rect x={x(rg.from)} y={32} height={2} fill="var(--accent)" initial={false} animate={{ width: active ? x(rg.to) - x(rg.from) : 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }} />
                  {x(rg.to) - x(rg.from) > 46 && (
                    <text x={(x(rg.from) + x(rg.to)) / 2} y={21} textAnchor="middle" className={`text-[11px] font-medium ${active ? 'fill-[var(--fg)]' : 'fill-[var(--fg-muted)]'}`}>
                      {width > 700 ? rg.en : rg.en.split(' ')[0].replace('/', '')}
                    </text>
                  )}
                </g>
              );
            })}
            {/* instrumentos */}
            {SOURCES.map((s, i) => {
              const y = 46 + i * 22;
              const c = s.group === 'voz' ? 'var(--c-b)' : 'var(--c-a)';
              const lx = Math.min(x(s.f[0]), width - 120);
              return (
                <g key={s.name}>
                  <text x={Math.max(2, lx)} y={y + 9} className="fill-[var(--fg-muted)] text-[10.5px]">
                    {s.name}
                  </text>
                  <rect x={x(s.h[0])} y={y + 14} width={Math.max(0, x(s.h[1]) - x(s.h[0]))} height={3} rx={1.5} fill={c} opacity={0.3} />
                  <rect x={x(s.f[0])} y={y + 12} width={Math.max(2, x(s.f[1]) - x(s.f[0]))} height={7} rx={3} fill={c} opacity={0.85} />
                </g>
              );
            })}
            {[20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000].map((f) => (
              <g key={f}>
                <line x1={x(f)} x2={x(f)} y1={36} y2={376} stroke="var(--c-grid)" />
                <text x={x(f)} y={389} textAnchor="middle" className="fill-[var(--fg-muted)] text-[10.5px] tabular">
                  {f >= 1000 ? `${f / 1000}k` : f}
                </text>
              </g>
            ))}
          </svg>
        )}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11.5px] text-muted mt-2">
        <span className="inline-flex items-center gap-1.5"><span className="w-4 h-2 rounded bg-[var(--c-a)]" /> fundamentais de instrumentos</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-4 h-2 rounded bg-[var(--c-b)]" /> vozes</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-4 h-1 rounded bg-[var(--c-a)] opacity-40" /> harmônicos e ruídos (aproximado)</span>
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={r.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.22 }}
          className="mt-5 grid md:grid-cols-[1.2fr_1fr] gap-5"
        >
          <div>
            <div className="flex items-baseline gap-2">
              <h4 className="text-[16px] font-semibold text-fg">{r.name}</h4>
              <span className="text-[12.5px] text-muted font-mono tabular">
                {fmtHz(r.from)} – {fmtHz(r.to)}
              </span>
            </div>
            <p className="mt-1.5 text-[14px] leading-relaxed text-soft">{r.text}</p>
          </div>
          <dl className="text-[13px] leading-relaxed space-y-2">
            <div>
              <dt className="text-[11.5px] uppercase tracking-[0.08em] text-[var(--myth)] font-semibold">Em excesso</dt>
              <dd className="text-soft">{r.excess}</dd>
            </div>
            <div>
              <dt className="text-[11.5px] uppercase tracking-[0.08em] text-muted font-semibold">Em falta</dt>
              <dd className="text-soft">{r.lack}</dd>
            </div>
          </dl>
        </motion.div>
      </AnimatePresence>
      <div className="flex flex-wrap items-center gap-3 mt-5">
        <PlayButton playing={pb.playing} onToggle={() => (pb.playing ? pb.stop() : start())} label="Ouvir" />
        <Segmented
          size="sm"
          value={mode}
          onChange={(v) => {
            setMode(v);
            pb.stop();
          }}
          options={[
            { value: 'band', label: 'Somente esta região' },
            { value: 'cut', label: 'Tudo, menos esta região' },
          ]}
        />
      </div>
      <div className="mt-3">
        <Note>
          As fronteiras entre regiões são convenções, não limites físicos — fontes diferentes usam números diferentes. E nenhum
          instrumento ocupa uma única região: as barras mostram onde estão as fundamentais, mas os harmônicos e ruídos de ataque se
          estendem por várias oitavas acima.
        </Note>
      </div>
    </LabFrame>
  );
}
