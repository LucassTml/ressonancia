import { useEffect, useState } from 'react';
import { LabFrame, Readout, Note } from '../../components/ui/LabFrame';
import { Button, Segmented, Toggle, fmtHz, fmtNum } from '../../components/ui/controls';
import { PlayButton, usePlayback } from '../../components/ui/audio';
import { dbToGain } from '../../audio/engine';
import { NOTE_NAMES, tr } from '../../i18n';

const NAMES = NOTE_NAMES;
const midiF = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

const INTERVALS = [
  { st: 0, name: tr("Uníssono"), just: [1, 1] },
  { st: 3, name: tr("Terça menor"), just: [6, 5] },
  { st: 4, name: tr("Terça maior"), just: [5, 4] },
  { st: 5, name: tr("Quarta justa"), just: [4, 3] },
  { st: 6, name: tr("Trítono"), just: [45, 32] },
  { st: 7, name: tr("Quinta justa"), just: [3, 2] },
  { st: 9, name: tr("Sexta maior"), just: [5, 3] },
  { st: 11, name: tr("Sétima maior"), just: [15, 8] },
  { st: 12, name: tr("Oitava"), just: [2, 1] },
  { st: 1, name: tr("Segunda menor"), just: [16, 15] },
];

/** Nota com timbre de cordas dedilhadas (harmônicos decrescentes). */
function pluck(ctx: AudioContext, out: AudioNode, f: number, t: number, dur = 1.2, level = -22, harmonics = [1, 0.5, 0.33, 0.25, 0.2, 0.12, 0.08, 0.05], soft = false) {
  const real = new Float32Array(harmonics.length + 1);
  const imag = new Float32Array(harmonics.length + 1);
  harmonics.forEach((a, i) => (imag[i + 1] = a));
  const osc = ctx.createOscillator();
  osc.setPeriodicWave(ctx.createPeriodicWave(real, imag));
  osc.frequency.value = f;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(dbToGain(level), t + (soft ? 0.06 : 0.005));
  g.gain.setTargetAtTime(0, t + (soft ? dur * 0.7 : 0.02), soft ? 0.08 : dur / 3);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.5);
  return osc;
}

// Ode à Alegria (Beethoven, domínio público): [semitom relativo a Mi4, duração em tempos]
const ODE: [number, number][] = [
  [0, 1], [0, 1], [1, 1], [3, 1], [3, 1], [1, 1], [0, 1], [-2, 1], [-4, 1], [-4, 1], [-2, 1], [0, 1], [0, 1.5], [-2, 0.5], [-2, 2],
];

export default function PitchLab() {
  const [tab, setTab] = useState<'keys' | 'missing' | 'melody'>('keys');
  const [last, setLast] = useState<number | null>(null);
  const [root, setRoot] = useState(60);
  const [interval, setIv] = useState(7);
  const [just, setJust] = useState(false);
  const [lowCut, setLowCut] = useState(0); // quantos harmônicos graves removidos
  const [mf0, setMf0] = useState(200);
  const pb = usePlayback('pitch');

  const playNote = (n: number) => {
    setLast(n);
    pb.start((ctx, out) => {
      const o = pluck(ctx, out, midiF(n), ctx.currentTime + 0.01);
      const id = window.setTimeout(() => pb.stop(), 1700);
      return () => {
        window.clearTimeout(id);
        try {
          o.stop();
        } catch {
          /* ok */
        }
      };
    });
  };

  const iv = INTERVALS.find((x) => x.st === interval)!;
  const etRatio = Math.pow(2, interval / 12);
  const jRatio = iv.just[0] / iv.just[1];
  const cents = 1200 * Math.log2(etRatio / jRatio);

  const playInterval = (mode: 'seq' | 'chord') =>
    pb.start((ctx, out) => {
      const f1 = midiF(root);
      const f2 = f1 * (just ? jRatio : etRatio);
      const t = ctx.currentTime + 0.02;
      const os = mode === 'seq' ? [pluck(ctx, out, f1, t, 1), pluck(ctx, out, f2, t + 0.7, 1.2)] : [pluck(ctx, out, f1, t, 3, -24, undefined, true), pluck(ctx, out, f2, t, 3, -24, undefined, true)];
      const id = window.setTimeout(() => pb.stop(), mode === 'seq' ? 2400 : 3400);
      return () => {
        window.clearTimeout(id);
        os.forEach((o) => { try { o.stop(); } catch { /* ok */ } });
      };
    });

  // Fundamental ausente: harmônicos 1..10, removendo os graves
  const playMissing = () =>
    pb.start((ctx, out) => {
      const h = Array.from({ length: 10 }, (_, i) => (i < lowCut ? 0 : 1 / Math.sqrt(i + 1)));
      const real = new Float32Array(11);
      const imag = new Float32Array(11);
      h.forEach((a, i) => (imag[i + 1] = a));
      const osc = ctx.createOscillator();
      osc.setPeriodicWave(ctx.createPeriodicWave(real, imag));
      osc.frequency.value = mf0;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, ctx.currentTime);
      g.gain.linearRampToValueAtTime(dbToGain(-24), ctx.currentTime + 0.05);
      osc.connect(g).connect(out);
      osc.start();
      return () => {
        g.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
        setTimeout(() => osc.stop(), 80);
      };
    });

  // reinicia o tom ao mudar os harmônicos durante a reprodução
  useEffect(() => {
    if (pb.playing && tab === 'missing') playMissing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lowCut, mf0]);

  const playMelody = (variant: 'orig' | 'transp' | 'timbre' | 'octaves' | 'rhythm' | 'contour') =>
    pb.start((ctx, out) => {
      const beat = 0.42;
      let t = ctx.currentTime + 0.05;
      const base = 64; // Mi4
      const os: OscillatorNode[] = [];
      let seed = 3;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      ODE.forEach(([st, d], i) => {
        let n = base + st;
        if (variant === 'transp') n += 5;
        if (variant === 'octaves') n += 12 * (Math.floor(rnd() * 3) - 1);
        if (variant === 'contour') n = base + Math.round(st * 1.7) + (i % 3 === 0 ? 1 : 0);
        const dur = variant === 'rhythm' ? beat : d * beat;
        const harm = variant === 'timbre' ? [1, 0, 0.6, 0, 0.4, 0, 0.25, 0, 0.15] : undefined;
        os.push(pluck(ctx, out, midiF(n), t, Math.max(0.4, dur * 1.4), -22, harm, variant === 'timbre'));
        t += dur;
      });
      const timer = window.setTimeout(() => pb.stop(), (t - ctx.currentTime) * 1000 + 600);
      return () => {
        window.clearTimeout(timer);
        os.forEach((o) => { try { o.stop(); } catch { /* ok */ } });
      };
    });

  const white = [0, 2, 4, 5, 7, 9, 11];
  const keys = Array.from({ length: 25 }, (_, i) => 48 + i);

  return (
    <LabFrame
      title={tr("Altura, intervalos e melodia")}
      description={tr("Frequência é física; altura é percepção. Explore como o cérebro organiza frequências em notas, intervalos e melodias.")}
      audio
      toolbar={
        <Segmented
          size="sm"
          value={tab}
          onChange={(v) => {
            pb.stop();
            setTab(v);
          }}
          options={[
            { value: 'keys', label: tr("Notas e intervalos") },
            { value: 'missing', label: tr("Fundamental ausente") },
            { value: 'melody', label: tr("O que é melodia") },
          ]}
        />
      }
    >
      {tab === 'keys' && (
        <>
          <div className="relative h-[130px] select-none overflow-x-auto">
            <div className="relative h-full" style={{ minWidth: 560 }}>
              {keys.filter((n) => white.includes(n % 12)).map((n, i) => (
                <button
                  key={n}
                  onClick={() => playNote(n)}
                  className={`absolute top-0 bottom-0 border border-line-strong rounded-b-lg transition-colors ${last === n ? 'bg-accent-soft' : 'bg-elev hover:bg-sunken'}`}
                  style={{ left: `${(i / 15) * 100}%`, width: `${100 / 15}%` }}
                  aria-label={`${NAMES[n % 12]}${Math.floor(n / 12) - 1}, ${fmtHz(midiF(n))}`}
                >
                  <span className="absolute bottom-1.5 left-0 right-0 text-center text-[10px] text-muted">
                    {NAMES[n % 12]}
                    {Math.floor(n / 12) - 1}
                  </span>
                </button>
              ))}
              {keys.filter((n) => !white.includes(n % 12)).map((n) => {
                const whiteIdx = keys.filter((k) => white.includes(k % 12) && k < n).length;
                return (
                  <button
                    key={n}
                    onClick={() => playNote(n)}
                    className={`absolute top-0 h-[62%] rounded-b-md z-10 transition-colors ${last === n ? 'bg-accent' : 'bg-fg hover:opacity-85'}`}
                    style={{ left: `calc(${(whiteIdx / 15) * 100}% - ${100 / 15 / 3}%)`, width: `${(100 / 15) * 0.66}%` }}
                    aria-label={`${NAMES[n % 12]}${Math.floor(n / 12) - 1}, ${fmtHz(midiF(n))}`}
                  />
                );
              })}
            </div>
          </div>
          <div className="mt-4">
            <Readout
              items={
                last != null
                  ? [
                      { label: tr("Nota"), value: `${NAMES[last % 12]}${Math.floor(last / 12) - 1}`, accent: true },
                      { label: tr("Frequência fundamental"), value: fmtHz(midiF(last)) },
                      { label: tr("Razão para a nota de baixo"), value: `× ${fmtNum(Math.pow(2, 1 / 12), 5)}` },
                      { label: tr("Uma oitava acima"), value: fmtHz(midiF(last + 12)) },
                    ]
                  : [{ label: tr("Toque uma tecla"), value: '—' }]
              }
            />
          </div>
          <div className="mt-6 pt-5 border-t border-line">
            <div className="flex flex-wrap gap-1.5 mb-3">
              {INTERVALS.map((x) => (
                <button
                  key={x.st}
                  onClick={() => setIv(x.st)}
                  className={`text-[12.5px] px-2.5 py-1 rounded-lg border transition-colors ${interval === x.st ? 'border-accent text-fg bg-accent-soft' : 'border-line text-muted hover:text-fg'}`}
                >
                  {x.name}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <Button onClick={() => playInterval('seq')}>{tr("Ouvir em sequência")}</Button>
              <Button onClick={() => playInterval('chord')}>{tr("Ouvir juntas")}</Button>
              <Toggle checked={just} onChange={setJust} label={tr("Afinação justa (razões inteiras)")} />
              <select
                value={root}
                onChange={(e) => setRoot(Number(e.target.value))}
                className="h-8 rounded-lg border border-line-strong bg-elev px-2 text-[13px]"
                aria-label={tr("Nota de base")}
              >
                {[48, 55, 60, 64, 69].map((n) => (
                  <option key={n} value={n}>{tr("Base:")}{' '}{NAMES[n % 12]}
                    {Math.floor(n / 12) - 1}
                  </option>
                ))}
              </select>
            </div>
            <Readout
              items={[
                { label: tr("Temperamento igual"), value: `× ${fmtNum(etRatio, 4)}` },
                { label: tr("Razão justa"), value: `${iv.just[0]}:${iv.just[1]} = ${fmtNum(jRatio, 4)}`, accent: true },
                { label: tr("Diferença"), value: `${cents > 0 ? '+' : ''}${fmtNum(cents, 1)} cents` },
              ]}
            />
            <div className="mt-3">
              <Note>{tr("Intervalos com razões simples (2:1, 3:2, 4:3) têm muitos harmônicos coincidentes e soam consonantes. No temperamento igual, todos os semitons são iguais (2^(1/12)), o que permite tocar em qualquer tonalidade, ao custo de terças ~14 cents mais largas que a razão 5:4 — ouça juntas, com e sem afinação justa, e repare nos batimentos lentos da terça temperada.")}</Note>
            </div>
          </div>
        </>
      )}

      {tab === 'missing' && (
        <>
          <svg viewBox="0 0 400 110" className="w-full h-[150px]" aria-label={tr("Harmônicos presentes")}>
            {Array.from({ length: 10 }, (_, i) => {
              const on = i >= lowCut;
              const h = (on ? 1 / Math.sqrt(i + 1) : 0) * 80;
              return (
                <g key={i}>
                  <rect x={10 + i * 38} y={90 - h} width={24} height={h} rx={3} fill="var(--c-a)" style={{ transition: 'all .3s cubic-bezier(.22,1,.36,1)' }} />
                  {!on && <rect x={10 + i * 38} y={30} width={24} height={60} rx={3} fill="none" stroke="var(--line-strong)" strokeDasharray="3 3" />}
                  <text x={22 + i * 38} y={104} textAnchor="middle" className="fill-[var(--fg-muted)] text-[9px] tabular">
                    {Math.round(mf0 * (i + 1))}
                  </text>
                </g>
              );
            })}
          </svg>
          <div className="flex flex-wrap items-center gap-2 my-4">
            <PlayButton playing={pb.playing} onToggle={() => (pb.playing ? pb.stop() : playMissing())} />
            <Button onClick={() => setLowCut((c) => Math.min(6, c + 1))} disabled={lowCut >= 6}>{tr("Remover harmônico mais grave")}</Button>
            <Button variant="ghost" onClick={() => setLowCut(0)}>{tr("Restaurar todos")}</Button>
            <select value={mf0} onChange={(e) => setMf0(Number(e.target.value))} className="h-8 rounded-lg border border-line-strong bg-elev px-2 text-[13px]" aria-label={tr("Fundamental")}>
              {[100, 150, 200, 300].map((f) => (
                <option key={f} value={f}>
                  f₀ = {f} Hz
                </option>
              ))}
            </select>
          </div>
          <Readout
            items={[
              { label: tr("Componente mais grave presente"), value: fmtHz(mf0 * (lowCut + 1)), accent: true },
              { label: tr("Altura que a maioria ouve"), value: fmtHz(mf0) },
              { label: tr("Espaçamento entre harmônicos"), value: fmtHz(mf0) },
            ]}
          />
          <div className="mt-3">
            <Note>
              {pb.playing ? tr("Toque e vá removendo os harmônicos graves. ") : ''}{tr("O timbre fica mais fino, mas a altura continua sendo a de f₀, mesmo sem nenhuma energia em f₀. O sistema auditivo infere a periodicidade comum aos harmônicos. É por isso que você “ouve” a nota de um baixo num celular que não reproduz aquela frequência. (Se você ouvir a nota subir, tudo bem: a percepção dessa ilusão varia entre pessoas.)")}</Note>
          </div>
        </>
      )}

      {tab === 'melody' && (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {([
              ['orig', tr("Original"), tr("Ode à Alegria (Beethoven), em Mi.")],
              ['transp', tr("Transposta"), tr("Todas as frequências multiplicadas por 1,335 (+5 semitons). Continua a mesma melodia.")],
              ['timbre', tr("Outro timbre"), tr("Mesmas notas e ritmo, espectro diferente. Continua reconhecível.")],
              ['rhythm', tr("Sem ritmo"), tr("Mesmas notas, todas com a mesma duração. Fica bem mais difícil reconhecer.")],
              ['octaves', tr("Oitavas embaralhadas"), tr("Mesmas notas (classes de altura), mas cada uma numa oitava aleatória. O contorno se perde.")],
              ['contour', tr("Mesmo contorno, outros intervalos"), tr("Sobe e desce nos mesmos lugares, mas com intervalos distorcidos.")],
            ] as const).map(([id, name, desc]) => (
              <button key={id} onClick={() => playMelody(id)} className="text-left rounded-xl border border-line px-3.5 py-3 hover:bg-sunken hover:border-line-strong transition-colors">
                <span className="block text-[13.5px] font-medium text-fg">▸ {name}</span>
                <span className="block text-[12px] text-muted leading-snug mt-0.5">{desc}</span>
              </button>
            ))}
          </div>
          <div className="mt-4">
            <Note>{tr("Uma melodia não é uma lista de frequências, é um padrão de")}{' '}<em>{tr("relações")}</em>{tr(": intervalos (razões entre frequências), contorno (sobe/desce) e ritmo. Por isso sobrevive à transposição e à troca de timbre, mas sofre muito quando ritmo ou oitavas são alterados — um efeito estudado por Diana Deutsch desde os anos 1970.")}</Note>
          </div>
        </>
      )}
    </LabFrame>
  );
}
