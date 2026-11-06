import { useEffect, useRef, useState } from 'react';
import { LabFrame, Controls, Readout } from '../../components/ui/LabFrame';
import { Button, Segmented, Slider, fmtHz, fmtNum } from '../../components/ui/controls';
import { usePlayback } from '../../components/ui/audio';
import { PlayButton } from '../../components/ui/audio';
import { Scope } from '../../viz/Scope';
import { dbToGain } from '../../audio/engine';

type Wave = 'sine' | 'square' | 'sawtooth' | 'triangle';
const DEFAULTS = { freq: 440, level: -30, wave: 'sine' as Wave };

export default function ToneLab() {
  const [s, setS] = useState(DEFAULTS);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [sweepF, setSweepF] = useState<number | null>(null);
  const pb = usePlayback('tone');
  const nodes = useRef<{ osc: OscillatorNode; gain: GainNode } | null>(null);
  const sweepRaf = useRef(0);

  const start = (sweep = false) => {
    pb.start((ctx, out) => {
      const osc = ctx.createOscillator();
      osc.type = s.wave;
      osc.frequency.value = sweep ? 20 : s.freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(dbToGain(s.level), ctx.currentTime + 0.05);
      const an = ctx.createAnalyser();
      an.fftSize = 8192;
      an.smoothingTimeConstant = 0.5;
      osc.connect(gain).connect(an).connect(out);
      osc.start();
      nodes.current = { osc, gain };
      setAnalyser(an);
      if (sweep) {
        const t0 = ctx.currentTime;
        const dur = 14;
        osc.frequency.setValueAtTime(20, t0);
        osc.frequency.exponentialRampToValueAtTime(20000, t0 + dur);
        const tick = () => {
          const t = ctx.currentTime - t0;
          if (t >= dur) {
            setSweepF(null);
            pb.stop();
            return;
          }
          setSweepF(20 * Math.pow(1000, t / dur));
          sweepRaf.current = requestAnimationFrame(tick);
        };
        tick();
      }
      return () => {
        cancelAnimationFrame(sweepRaf.current);
        setSweepF(null);
        const t = ctx.currentTime;
        gain.gain.cancelScheduledValues(t);
        gain.gain.setValueAtTime(gain.gain.value, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.04);
        setTimeout(() => {
          osc.stop();
          osc.disconnect();
          an.disconnect();
        }, 60);
        nodes.current = null;
        setAnalyser(null);
      };
    });
  };

  // atualiza parâmetros ao vivo
  useEffect(() => {
    const n = nodes.current;
    if (!n || sweepF != null) return;
    const ctx = n.osc.context;
    n.osc.frequency.setTargetAtTime(s.freq, ctx.currentTime, 0.01);
    n.osc.type = s.wave;
    n.gain.gain.setTargetAtTime(dbToGain(s.level), ctx.currentTime, 0.02);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s]);

  const f = sweepF ?? s.freq;
  const lambda = 343 / f;
  return (
    <LabFrame
      title="Laboratório de frequências"
      description="Um oscilador real da Web Audio API. O osciloscópio mostra a forma de onda (sincronizada para ficar parada); o analisador mostra seu espectro calculado por FFT."
      audio
      onReset={() => setS(DEFAULTS)}
      footer={
        <>
          A varredura vai de 20 Hz a 20 kHz em 14 s, em escala logarítmica (mesmo tempo por oitava). Observe a partir de onde você
          deixa de ouvir — o limite superior cai com a idade. Graves muito baixos podem ser inaudíveis por limitação do seu fone ou
          alto-falante, e não da sua audição.
        </>
      }
    >
      <div className="grid md:grid-cols-2 gap-3">
        <Scope analyser={analyser} mode="time" label="Osciloscópio" timeSpan={Math.min(0.05, 3 / f)} />
        <Scope analyser={analyser} mode="spectrum" label="Espectro (FFT)" />
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-4 mb-4">
        <PlayButton playing={pb.playing && sweepF == null} onToggle={() => (pb.playing ? pb.stop() : start(false))} label="Tocar tom" />
        <Button onClick={() => (sweepF != null ? pb.stop() : start(true))}>{sweepF != null ? 'Parar varredura' : 'Varredura 20 Hz → 20 kHz'}</Button>
        <Segmented
          size="sm"
          value={s.wave}
          onChange={(v) => setS((p) => ({ ...p, wave: v }))}
          options={[
            { value: 'sine', label: 'Senoide' },
            { value: 'square', label: 'Quadrada' },
            { value: 'sawtooth', label: 'Dente de serra' },
            { value: 'triangle', label: 'Triangular' },
          ]}
        />
      </div>
      <Controls cols={2}>
        <Slider label="Frequência" value={f} min={20} max={20000} log onChange={(v) => setS((p) => ({ ...p, freq: Math.round(v) }))} format={fmtHz} disabled={sweepF != null} />
        <Slider label="Nível digital" value={s.level} min={-60} max={-12} step={1} onChange={(v) => setS((p) => ({ ...p, level: v }))} unit="dBFS" hint="Limitado a −12 dBFS. Ondas quadradas soam bem mais altas que senoides de mesmo pico." />
      </Controls>
      <div className="mt-4">
        <Readout
          items={[
            { label: 'Frequência', value: fmtHz(f), accent: true },
            { label: 'Período', value: f >= 1000 ? `${fmtNum(1000000 / f, 1)} µs` : `${fmtNum(1000 / f, 2)} ms` },
            { label: 'Comprimento de onda no ar', value: lambda >= 1 ? `${fmtNum(lambda, 2)} m` : `${fmtNum(lambda * 100, 1)} cm` },
            { label: 'Nota mais próxima', value: noteName(f) },
          ]}
        />
      </div>
    </LabFrame>
  );
}

const NOTES = ['Dó', 'Dó♯', 'Ré', 'Ré♯', 'Mi', 'Fá', 'Fá♯', 'Sol', 'Sol♯', 'Lá', 'Lá♯', 'Si'];
export function noteName(f: number) {
  const n = Math.round(12 * Math.log2(f / 440)) + 69;
  const cents = Math.round(100 * (12 * Math.log2(f / 440) + 69 - n));
  const name = NOTES[((n % 12) + 12) % 12];
  const oct = Math.floor(n / 12) - 1;
  return `${name}${oct}${cents ? ` ${cents > 0 ? '+' : ''}${cents}¢` : ''}`;
}
