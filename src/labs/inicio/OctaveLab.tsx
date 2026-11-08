import { useState } from 'react';
import { LabFrame, Note, Readout } from '../../components/ui/LabFrame';
import { Button, Segmented, fmtHz } from '../../components/ui/controls';
import { usePlayback } from '../../components/ui/audio';
import { dbToGain } from '../../audio/engine';
import { tr } from '../../i18n';

const RUNGS = [27.5, 55, 110, 220, 440, 880, 1760, 3520, 7040];
const HARM = [1, 0.45, 0.25, 0.14, 0.08];

function tone(ctx: AudioContext, out: AudioNode, f: number, t: number, dur: number, level: number) {
  const real = new Float32Array(HARM.length + 1);
  const imag = new Float32Array(HARM.length + 1);
  HARM.forEach((a, i) => (imag[i + 1] = a));
  const o = ctx.createOscillator();
  o.setPeriodicWave(ctx.createPeriodicWave(real, imag));
  o.frequency.value = f;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(dbToGain(level), t + 0.02);
  g.gain.setValueAtTime(dbToGain(level), t + dur - 0.2);
  g.gain.linearRampToValueAtTime(0, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.02);
  return o;
}

/** Duas ondas sobrepostas: a mais aguda cabe um número inteiro de vezes na de baixo quando é oitava. */
function WavePair({ ratio }: { ratio: number }) {
  const W = 640, H = 110, N = 320, cycles = 2;
  const path = (r: number, y0: number, amp: number) => {
    let d = '';
    for (let i = 0; i <= N; i++) {
      const p = i / N;
      d += `${i ? 'L' : 'M'}${(p * W).toFixed(1)} ${(y0 - amp * Math.sin(2 * Math.PI * cycles * r * p)).toFixed(1)}`;
    }
    return d;
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={tr('Comparação das duas ondas')}>
      {[0, 1, 2].map((c) => (
        <line key={c} x1={(c / cycles) * W} x2={(c / cycles) * W} y1={0} y2={H} stroke="var(--c-grid)" strokeDasharray="3 4" />
      ))}
      <path d={path(1, 30, 22)} fill="none" stroke="var(--c-a)" strokeWidth={2} />
      <path d={path(ratio, 80, 22)} fill="none" stroke="var(--c-b)" strokeWidth={2} />
    </svg>
  );
}

export default function OctaveLab() {
  const [idx, setIdx] = useState(3);
  const [axis, setAxis] = useState<'log' | 'lin'>('log');
  const [pair, setPair] = useState<'octave' | 'fifth' | 'tritone'>('octave');
  const pb = usePlayback('octave');

  const f = RUNGS[idx];
  const ratio = pair === 'octave' ? 2 : pair === 'fifth' ? 1.5 : Math.SQRT2;

  const play = (fs: number[], together = false) =>
    pb.start((ctx, out) => {
      const dur = together ? 2 : 0.8;
      const t0 = ctx.currentTime + 0.02;
      const os = fs.map((x, i) => tone(ctx, out, x, together ? t0 : t0 + i * 0.85, dur, together ? -28 : -24));
      const ms = (together ? dur : fs.length * 0.85) * 1000 + 150;
      const id = window.setTimeout(() => pb.stop(), ms);
      return () => {
        window.clearTimeout(id);
        os.forEach((o) => {
          try {
            o.stop();
          } catch {
            /* já parado */
          }
        });
      };
    });

  const pos = (x: number) => (axis === 'log' ? Math.log2(x / 20) / Math.log2(1000) : x / 8000) * 100;

  return (
    <LabFrame
      title={tr('Oitavas: ouvindo o dobro')}
      description={tr('Cada degrau tem o dobro da frequência do anterior. Toque os degraus, compare os intervalos e alterne entre as duas réguas.')}
      audio
    >
      <div className="grid grid-cols-9 gap-1">
        {RUNGS.map((x, i) => (
          <button
            key={x}
            onClick={() => {
              setIdx(i);
              play([x]);
            }}
            aria-pressed={idx === i}
            aria-label={tr('Tocar Lá de {0}', fmtHz(x))}
            className={`rounded-lg border py-2 transition-colors ${idx === i ? 'border-accent bg-accent-soft text-fg' : 'border-line text-muted hover:text-fg hover:bg-sunken'}`}
          >
            <span className="block text-[13px] font-semibold">{tr('Lá')}</span>
            <span className="block text-[10.5px] tabular font-mono">{x >= 1000 ? `${+(x / 1000).toFixed(2)}k` : x}</span>
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={() => play(RUNGS)}>{tr('Subir a escada inteira')}</Button>
        <Button disabled={idx >= RUNGS.length - 1} onClick={() => play([f, f * 2])}>{tr('Esta nota e a oitava acima')}</Button>
        <Button disabled={idx >= RUNGS.length - 1} onClick={() => play([f, f * 2], true)}>{tr('As duas juntas')}</Button>
      </div>

      <div className="mt-4">
        <Readout
          items={[
            { label: tr('Nota'), value: `${tr('Lá')}${idx}`, accent: true },
            { label: tr('Frequência'), value: fmtHz(f) },
            { label: tr('Uma oitava abaixo'), value: idx > 0 ? fmtHz(f / 2) : '—' },
            { label: tr('Uma oitava acima'), value: idx < RUNGS.length - 1 ? fmtHz(f * 2) : '—' },
          ]}
        />
      </div>

      <div className="mt-6 pt-5 border-t border-line">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h4 className="text-[14px] font-semibold text-fg">{tr('Por que os gráficos usam uma régua “esticada”')}</h4>
          <Segmented size="sm" value={axis} onChange={setAxis} options={[{ value: 'log', label: tr('Em oitavas') }, { value: 'lin', label: tr('Em Hz, régua comum') }]} />
        </div>
        <div className="relative h-14" role="img" aria-label={tr('Posição das nove notas na régua escolhida')}>
          <div className="absolute left-0 right-0 top-6 h-px bg-[var(--line-strong)]" />
          {RUNGS.map((x, i) => (
            <div key={x} className="absolute top-[18px] -translate-x-1/2 transition-[left] duration-500" style={{ left: `${pos(x)}%`, transitionTimingFunction: 'cubic-bezier(.22,1,.36,1)' }}>
              <div className={`w-3.5 h-3.5 rounded-full ${idx === i ? 'bg-accent' : 'bg-[var(--c-a)] opacity-70'}`} />
            </div>
          ))}
          <span className="absolute left-0 bottom-0 text-[11px] text-muted">{axis === 'log' ? '20 Hz' : '0 Hz'}</span>
          <span className="absolute right-0 bottom-0 text-[11px] text-muted">{axis === 'log' ? '20 kHz' : '8 kHz'}</span>
        </div>
        <Note>
          {axis === 'log'
            ? tr('Em oitavas, cada dobro ocupa o mesmo espaço. É assim que o ouvido percebe, e é por isso que quase todo gráfico de áudio usa essa régua.')
            : tr('Na régua comum, as cinco notas mais graves se amontoam na ponta esquerda, embora para o ouvido estejam tão distantes entre si quanto as agudas.')}
        </Note>
      </div>

      <div className="mt-6 pt-5 border-t border-line">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h4 className="text-[14px] font-semibold text-fg">{tr('Por que a oitava soa como “a mesma nota”')}</h4>
          <Segmented size="sm" value={pair} onChange={setPair} options={[{ value: 'octave', label: tr('Oitava (×2)') }, { value: 'fifth', label: tr('Quinta (×1,5)') }, { value: 'tritone', label: tr('Trítono (×1,41)') }]} />
        </div>
        <WavePair ratio={ratio} />
        <div className="mt-2 mb-3 flex gap-2">
          <Button onClick={() => play([220, 220 * ratio])}>{tr('Ouvir em sequência')}</Button>
          <Button onClick={() => play([220, 220 * ratio], true)}>{tr('Ouvir juntas')}</Button>
        </div>
        <Note>
          {pair === 'octave'
            ? tr('A onda de baixo faz exatamente dois ciclos enquanto a de cima faz um. Elas voltam a se alinhar a cada ciclo, e por isso se fundem numa coisa só.')
            : pair === 'fifth'
              ? tr('Três ciclos da onda de baixo para dois da de cima: ainda se alinham com frequência, e o intervalo soa estável, mas claramente são duas notas.')
              : tr('A razão não é simples, e as ondas quase nunca se alinham. O resultado soa tenso e instável.')}
        </Note>
      </div>
    </LabFrame>
  );
}
