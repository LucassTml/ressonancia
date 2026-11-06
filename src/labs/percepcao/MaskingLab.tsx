import { useEffect, useMemo, useRef, useState } from 'react';
import { LabFrame, Controls, Readout, Note } from '../../components/ui/LabFrame';
import { Button, Slider, Toggle, fmtHz, fmtNum } from '../../components/ui/controls';
import { PlayButton, usePlayback, fadeGain } from '../../components/ui/audio';
import { FreqPlot, Legend } from '../../viz/FreqPlot';
import { dbToGain, whiteNoiseBuffer } from '../../audio/engine';

/** Escala Bark (Zwicker & Terhardt, 1980). */
export const bark = (f: number) => 13 * Math.atan(0.00076 * f) + 3.5 * Math.atan(Math.pow(f / 7500, 2));
const erb = (f: number) => 24.7 * ((4.37 * f) / 1000 + 1);

const D = { fm: 1000, lm: 60, fp: 1300, lp: 40, maskerOn: true, toneOn: true };

export default function MaskingLab() {
  const [s, setS] = useState(D);
  const set = <K extends keyof typeof D>(k: K, v: (typeof D)[K]) => setS((p) => ({ ...p, [k]: v }));
  const pb = usePlayback('masking');
  const n = useRef<{ bp: BiquadFilterNode; bp2: BiquadFilterNode; mg: GainNode; osc: OscillatorNode; tg: GainNode } | null>(null);
  const [pulse, setPulse] = useState(true);

  // Limiar mascarado: modelo de espalhamento de Terhardt (1979), simplificado
  const threshold = useMemo(() => {
    const zm = bark(s.fm);
    const upper = 24 + 230 / s.fm - 0.2 * s.lm;
    return (f: number) => {
      const dz = bark(f) - zm;
      const spread = dz < 0 ? 27 * dz : -Math.max(5, upper) * dz;
      return s.lm - 5 + spread;
    };
  }, [s.fm, s.lm]);

  const bwHz = erb(s.fm) * 1.5;
  const maskerShape = useMemo(() => {
    const q = s.fm / bwHz;
    return (f: number) => s.lm - 12 * Math.pow(Math.log2(f / s.fm) * q * 0.7, 2);
  }, [s.fm, s.lm, bwHz]);

  /**
   * Calibra o ganho do ruído para que, no mesmo "nível" em dB, o ruído na banda
   * tenha o mesmo valor RMS que o tom. Largura de banda equivalente de ruído de
   * dois passa-faixa em cascata ≈ (π/4)·BW.
   */
  const maskerGain = (sr: number) => {
    const neb = (Math.PI / 4) * bwHz;
    const bandRms = 0.43 * Math.sqrt(neb / (sr / 2));
    return ((0.5 / Math.SQRT2) * dbToGain(s.lm - 60)) / bandRms;
  };

  const thrAtProbe = threshold(s.fp);
  const masked = s.lp < thrAtProbe;

  useEffect(() => {
    const x = n.current;
    if (!x) return;
    const x0 = x.osc.context;
    const t = x0.currentTime;
    x.bp.frequency.setTargetAtTime(s.fm, t, 0.02);
    x.bp2.frequency.setTargetAtTime(s.fm, t, 0.02);
    x.bp.Q.setTargetAtTime(s.fm / bwHz, t, 0.02);
    x.bp2.Q.setTargetAtTime(s.fm / bwHz, t, 0.02);
    x.mg.gain.setTargetAtTime(s.maskerOn ? maskerGain(x0.sampleRate) : 0, t, 0.02);
    x.osc.frequency.setTargetAtTime(s.fp, t, 0.02);
  }, [s, bwHz]);

  const start = () =>
    pb.start((ctx, out) => {
      const f = fadeGain(ctx, out, dbToGain(-18));
      const src = ctx.createBufferSource();
      src.buffer = whiteNoiseBuffer(ctx);
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      const bp2 = ctx.createBiquadFilter();
      bp.type = bp2.type = 'bandpass';
      bp.frequency.value = bp2.frequency.value = s.fm;
      bp.Q.value = bp2.Q.value = s.fm / bwHz;
      const mg = ctx.createGain();
      mg.gain.value = s.maskerOn ? maskerGain(ctx.sampleRate) : 0;
      src.connect(bp).connect(bp2).connect(mg).connect(f.node);
      const osc = ctx.createOscillator();
      osc.frequency.value = s.fp;
      const tg = ctx.createGain();
      tg.gain.value = 0;
      osc.connect(tg).connect(f.node);
      src.start();
      osc.start();
      n.current = { bp, bp2, mg, osc, tg };
      return () =>
        f.release(() => {
          src.stop();
          osc.stop();
          n.current = null;
        });
    });

  // Tom pulsante (0,4 s ligado / 0,4 s desligado) para facilitar a detecção
  useEffect(() => {
    if (!pb.playing) return;
    let on = false;
    const level = () => (s.toneOn ? dbToGain(s.lp - 60) * 0.5 : 0);
    const tick = () => {
      const x = n.current;
      if (!x) return;
      on = pulse ? !on : true;
      const t = x.osc.context.currentTime;
      x.tg.gain.setTargetAtTime(on ? level() : 0, t, 0.012);
    };
    tick();
    const id = window.setInterval(tick, 400);
    return () => window.clearInterval(id);
  }, [pb.playing, s.lp, s.toneOn, pulse]);

  return (
    <LabFrame
      title="Mascaramento"
      description="Uma banda estreita de ruído (o mascarador) e um tom pulsante (o sinal). Abaixe o tom até ele desaparecer e compare com o limiar previsto pelo modelo. Mova o tom para baixo e para cima do ruído para ouvir a assimetria."
      audio
      onReset={() => setS(D)}
      footer="Modelo de espalhamento simplificado baseado em Terhardt (1979) e na escala Bark de Zwicker & Terhardt (1980). Os níveis são relativos: o valor absoluto depende do seu volume. O resultado do seu ouvido é o que vale."
    >
      <FreqPlot
        height={260}
        dbMin={0}
        dbMax={80}
        dbStep={10}
        fMin={100}
        fMax={16000}
        yLabel="dB (relativo)"
        curves={[
          { id: 'masker', label: 'Mascarador', fn: (f) => Math.max(-20, maskerShape(f)), color: 'var(--c-b)', width: 1.5, fill: true },
          { id: 'thr', label: 'Limiar mascarado (modelo)', fn: threshold, color: 'var(--c-target)', width: 1.8, dash: '5 4' },
        ]}
        overlay={(sc) => (
          <g>
            <line x1={sc.x(s.fp)} x2={sc.x(s.fp)} y1={sc.y(0)} y2={sc.y(s.lp)} stroke={masked ? 'var(--fg-faint)' : 'var(--c-a)'} strokeWidth={3} strokeLinecap="round" />
            <circle cx={sc.x(s.fp)} cy={sc.y(s.lp)} r={5} fill={masked ? 'var(--bg-elev)' : 'var(--c-a)'} stroke={masked ? 'var(--fg-faint)' : 'var(--c-a)'} strokeWidth={2} />
          </g>
        )}
        ariaLabel="Mascarador, limiar mascarado e tom de teste"
      />
      <div className="mt-2 mb-4">
        <Legend items={[{ label: 'Mascarador', color: 'var(--c-b)' }, { label: 'Limiar mascarado (modelo)', color: 'var(--c-target)', dash: true }, { label: 'Tom de teste', color: 'var(--c-a)' }]} />
      </div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <PlayButton playing={pb.playing} onToggle={() => (pb.playing ? pb.stop() : start())} />
        <Toggle checked={s.maskerOn} onChange={(v) => set('maskerOn', v)} label="Ruído" />
        <Toggle checked={s.toneOn} onChange={(v) => set('toneOn', v)} label="Tom" />
        <Toggle checked={pulse} onChange={setPulse} label="Tom pulsante" />
        <Button size="sm" variant="ghost" onClick={() => setS((p) => ({ ...p, fp: p.fm * 0.7 }))}>Tom abaixo do ruído</Button>
        <Button size="sm" variant="ghost" onClick={() => setS((p) => ({ ...p, fp: p.fm * 1.4 }))}>Tom acima do ruído</Button>
      </div>
      <Controls cols={4}>
        <Slider label="Centro do ruído" value={s.fm} min={200} max={6000} log onChange={(v) => set('fm', Math.round(v))} format={fmtHz} />
        <Slider label="Nível do ruído" value={s.lm} min={30} max={75} step={1} onChange={(v) => set('lm', v)} unit="dB" />
        <Slider label="Frequência do tom" value={s.fp} min={100} max={16000} log onChange={(v) => set('fp', Math.round(v))} format={fmtHz} />
        <Slider label="Nível do tom" value={s.lp} min={0} max={75} step={1} onChange={(v) => set('lp', v)} unit="dB" />
      </Controls>
      <div className="mt-4">
        <Readout
          items={[
            { label: 'Limiar previsto no tom', value: `${fmtNum(thrAtProbe, 0)} dB` },
            { label: 'Previsão do modelo', value: masked ? 'Mascarado' : 'Audível', accent: !masked },
            { label: 'Distância em bandas críticas', value: `${fmtNum(bark(s.fp) - bark(s.fm), 1)} Bark` },
            { label: 'ERB no centro do ruído', value: fmtHz(erb(s.fm)) },
          ]}
        />
      </div>
      <div className="mt-3">
        <Note>
          O limiar cai devagar para cima do mascarador e rápido para baixo dele: sons graves e fortes escondem sons agudos mais
          fracos, mas o contrário quase não acontece. Aumente o nível do ruído e veja o lado superior se alargar.
        </Note>
      </div>
    </LabFrame>
  );
}
