import { useEffect, useMemo, useRef, useState } from 'react';
import { LabFrame, Controls, Readout, Note } from '../../components/ui/LabFrame';
import { Button, Segmented, Slider, Toggle, fmtHz, fmtNum } from '../../components/ui/controls';
import { PlayButton, usePlayback } from '../../components/ui/audio';
import { dbToGain } from '../../audio/engine';
import { useElementSize } from '../../lib/hooks';
import { tr } from '../../i18n';

const sinc = (x: number) => (Math.abs(x) < 1e-9 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x));

/** Frequência aparente de um tom f amostrado a fs (dobramento em torno de fs/2). */
export function aliasOf(f: number, fs: number) {
  const r = f % fs;
  return r > fs / 2 ? fs - r : r;
}

export default function SamplingLab() {
  const [fs, setFs] = useState(8000);
  const [f, setF] = useState(1000);
  const [showKernels, setShowKernels] = useState(false);
  const [listen, setListen] = useState<'orig' | 'rec'>('rec');
  const [wrap, { width }] = useElementSize<HTMLDivElement>();
  const pb = usePlayback('sampling');
  const osc = useRef<OscillatorNode | null>(null);
  const [sweeping, setSweeping] = useState(false);

  const alias = aliasOf(f, fs);
  const ok = f < fs / 2;

  const view = useMemo(() => {
    const periods = 4;
    const T = Math.min(periods / Math.min(f, alias || f), 30 / fs);
    const n0 = -12, n1 = Math.ceil(T * fs) + 12;
    const samples: [number, number][] = [];
    for (let n = n0; n <= n1; n++) samples.push([n / fs, Math.sin(2 * Math.PI * f * (n / fs) + 0.4)]);
    const N = 500;
    const orig: [number, number][] = [];
    const rec: [number, number][] = [];
    for (let i = 0; i <= N; i++) {
      const t = (i / N) * T;
      orig.push([t, Math.sin(2 * Math.PI * f * t + 0.4)]);
      let s = 0;
      for (const [tn, v] of samples) s += v * sinc((t - tn) * fs);
      rec.push([t, s]);
    }
    return { T, samples, orig, rec };
  }, [f, fs, alias]);

  useEffect(() => {
    const o = osc.current;
    if (!o) return;
    o.frequency.setTargetAtTime(listen === 'orig' ? f : alias, o.context.currentTime, 0.01);
  }, [f, alias, listen]);

  const start = (sweep: boolean) =>
    pb.start((ctx, out) => {
      const o = ctx.createOscillator();
      o.frequency.value = listen === 'orig' ? f : alias;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, ctx.currentTime);
      g.gain.linearRampToValueAtTime(dbToGain(-28), ctx.currentTime + 0.05);
      o.connect(g).connect(out);
      o.start();
      osc.current = o;
      let raf = 0;
      if (sweep) {
        setSweeping(true);
        const t0 = performance.now();
        const tick = () => {
          const u = (performance.now() - t0) / 8000;
          if (u >= 1) {
            pb.stop();
            return;
          }
          setF(Math.round(200 + u * (fs * 1.5 - 200)));
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      }
      return () => {
        cancelAnimationFrame(raf);
        setSweeping(false);
        g.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
        setTimeout(() => o.stop(), 80);
        osc.current = null;
      };
    });

  const H = 240, pad = 10;
  const tx = (t: number) => pad + (t / view.T) * (width - 2 * pad);
  const ty = (v: number) => H / 2 - v * (H / 2 - 20);
  const pth = (pts: [number, number][]) => pts.map(([t, v], i) => `${i ? 'L' : 'M'}${tx(t).toFixed(1)},${ty(Math.max(-1.6, Math.min(1.6, v))).toFixed(1)}`).join('');
  const visibleSamples = view.samples.filter(([t]) => t >= 0 && t <= view.T);

  return (
    <LabFrame
      title={tr("Amostragem e reconstrução")}
      description={tr("Uma onda contínua (cinza), suas amostras (pontos) e a reconstrução calculada pela fórmula de Whittaker-Shannon: uma soma de funções sinc, uma por amostra. Abaixo de fs/2, a reconstrução é exata; acima, surge um alias.")}
      audio
      onReset={() => {
        setFs(8000);
        setF(1000);
      }}
      footer={tr("A reconstrução usa as amostras da janela e algumas de cada lado; perto das bordas, a ausência das amostras de fora causa pequenos desvios que não existem num sinal contínuo infinito. O som tocado é a senoide que um sistema ideal produziria — a original ou a reconstruída.")}
    >
      <div ref={wrap}>
        {width > 0 && (
          <svg width={width} height={H} className="block rounded-xl bg-sunken" role="img" aria-label={tr("Sinal, amostras e reconstrução")}>
            <line x1={pad} x2={width - pad} y1={H / 2} y2={H / 2} stroke="var(--c-grid-strong)" />
            {showKernels &&
              visibleSamples.slice(0, 40).map(([tn, v]) => {
                const pts: [number, number][] = [];
                for (let i = 0; i <= 200; i++) {
                  const t = (i / 200) * view.T;
                  pts.push([t, v * sinc((t - tn) * fs)]);
                }
                return <path key={tn} d={pth(pts)} fill="none" stroke="var(--c-target)" strokeWidth={0.8} opacity={0.35} />;
              })}
            <path d={pth(view.orig)} fill="none" stroke="var(--fg-faint)" strokeWidth={4} opacity={0.55} />
            <path d={pth(view.rec)} fill="none" stroke={ok ? 'var(--c-a)' : 'var(--c-diff)'} strokeWidth={2.2} />
            {visibleSamples.map(([t, v]) => (
              <g key={t}>
                <line x1={tx(t)} x2={tx(t)} y1={H / 2} y2={ty(v)} stroke="var(--fg)" opacity={0.45} />
                <circle cx={tx(t)} cy={ty(v)} r={3.4} fill="var(--fg)" />
              </g>
            ))}
          </svg>
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-muted mt-2">
        <span className="inline-flex items-center gap-1.5"><span className="w-4 h-[3px] bg-[var(--fg-faint)]" />{' '}{tr("sinal original")}</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[var(--fg)]" />{' '}{tr("amostras")}</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-4 h-[2px]" style={{ background: ok ? 'var(--c-a)' : 'var(--c-diff)' }} />{' '}{tr("reconstrução sinc")}</span>
      </div>
      <div className="mt-4">
        <Controls cols={2}>
          <Slider label={tr("Taxa de amostragem (fs)")} value={fs} min={2000} max={48000} log onChange={(v) => setFs(Math.round(v))} format={fmtHz} />
          <Slider label={tr("Frequência do sinal")} value={f} min={50} max={Math.min(40000, fs * 1.6)} log onChange={(v) => setF(Math.round(v))} format={fmtHz} disabled={sweeping} />
        </Controls>
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-4">
        <PlayButton playing={pb.playing && !sweeping} onToggle={() => (pb.playing ? pb.stop() : start(false))} />
        <Button onClick={() => (sweeping ? pb.stop() : start(true))}>{sweeping ? tr("Parar") : tr("Varredura até 1,5 × fs")}</Button>
        <Segmented size="sm" value={listen} onChange={setListen} options={[{ value: 'rec', label: tr("Ouvir reconstruído") }, { value: 'orig', label: tr("Ouvir original") }]} />
        <Toggle checked={showKernels} onChange={setShowKernels} label={tr("Mostrar funções sinc")} />
      </div>
      <div className="mt-4">
        <Readout
          items={[
            { label: tr("Frequência de Nyquist (fs/2)"), value: fmtHz(fs / 2) },
            { label: tr("Amostras por ciclo"), value: fmtNum(fs / f, 2) },
            { label: tr("Frequência reconstruída"), value: fmtHz(alias), accent: true, hint: ok ? tr("igual à original") : 'alias!' },
          ]}
        />
      </div>
      <div className="mt-3">
        <Note>{tr("Na varredura, ouça a frequência reconstruída subir até fs/2 e então")}{' '}<em>{tr("descer")}</em>{tr(": é o dobramento (aliasing). Por isso um ADC precisa de um filtro que remova tudo acima de fs/2 antes de amostrar. Note também que, abaixo de fs/2, a reconstrução coincide com o original mesmo com pouco mais de 2 amostras por ciclo.")}</Note>
      </div>
    </LabFrame>
  );
}
