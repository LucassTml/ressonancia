import { useMemo, useState } from 'react';
import { LabFrame, Controls, Readout, Note } from '../../components/ui/LabFrame';
import { Segmented, Slider, Toggle, fmtNum } from '../../components/ui/controls';
import { PlayButton, usePlayback, fadeGain } from '../../components/ui/audio';
import { demoMusicBuffer } from '../../audio/engine';
import { magnitudeSpectrum } from '../../audio/dsp';
import { useElementSize } from '../../lib/hooks';
import { tr } from '../../i18n';

/** Quantiza para `bits` com ou sem dither TPDF (±1 LSB). */
function quantize(x: number, bits: number, dither: boolean, rnd: () => number) {
  const levels = Math.pow(2, bits - 1);
  const d = dither ? (rnd() - rnd()) : 0; // TPDF em LSB
  const q = Math.round(x * levels + d) / levels;
  return Math.max(-1, Math.min(1 - 1 / levels, q));
}

const rng = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

export default function QuantizationLab() {
  const [bits, setBits] = useState(6);
  const [amp, setAmp] = useState(-20);
  const [dither, setDither] = useState(false);
  const [src, setSrc] = useState<'tone' | 'music'>('tone');
  const [wrap, { width }] = useElementSize<HTMLDivElement>();
  const pb = usePlayback('quantization');

  const a = Math.pow(10, amp / 20);
  const analysis = useMemo(() => {
    const fs = 48000, f = 1000, n = 8192;
    const r = rng(9);
    const x = new Float32Array(n);
    const q = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      x[i] = a * Math.sin((2 * Math.PI * f * i) / fs);
      q[i] = quantize(x[i], bits, dither, r);
    }
    const spec = magnitudeSpectrum(q, n);
    // erro
    let e2 = 0;
    for (let i = 0; i < n; i++) e2 += (q[i] - x[i]) ** 2;
    const errRms = Math.sqrt(e2 / n);
    return { x: Array.from(x.slice(0, 192)), q: Array.from(q.slice(0, 192)), spec, errRms, fs, n };
  }, [bits, a, dither]);

  const start = async () => {
    const music = src === 'music' ? await demoMusicBuffer(48000) : null;
    pb.start((ctx, out) => {
      const len = music ? music.length : ctx.sampleRate * 3;
      const buf = ctx.createBuffer(music ? music.numberOfChannels : 1, len, music ? music.sampleRate : ctx.sampleRate);
      const r = rng(5);
      for (let ch = 0; ch < buf.numberOfChannels; ch++) {
        const d = buf.getChannelData(ch);
        const m = music?.getChannelData(ch);
        for (let i = 0; i < len; i++) {
          const v = m ? m[i] * a * 1.4 : a * Math.sin((2 * Math.PI * 440 * i) / buf.sampleRate);
          d[i] = quantize(v, bits, dither, r);
        }
      }
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.loop = true;
      // ganho de reprodução: compensa o nível baixo para que o efeito seja audível sem exagero
      // limita também pelo tamanho do degrau, para que o ruído de quantização com poucos bits não fique alto
      const fg = fadeGain(ctx, out, Math.min(4, 0.25 / a, 0.15 * Math.pow(2, bits - 1)));
      s.connect(fg.node);
      s.start();
      return () => fg.release(() => s.stop());
    });
  };

  const W = width || 400;
  const H = 150;
  const wp = (arr: number[]) => arr.map((v, i) => `${i ? 'L' : 'M'}${((i / (arr.length - 1)) * W).toFixed(1)},${(H / 2 - (v / (a * 1.15)) * (H / 2 - 6)).toFixed(1)}`).join('');
  const SH = 150;
  const specPath = (() => {
    let d = '';
    const { spec, fs, n } = analysis;
    for (let k = 1; k < n / 2; k += 2) {
      const fr = (k * fs) / n;
      if (fr < 100 || fr > 20000) continue;
      const x = (Math.log(fr / 100) / Math.log(200)) * W;
      const y = 6 + ((0 - Math.max(-150, spec[k])) / 150) * (SH - 20);
      d += `${d ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
    }
    return d;
  })();

  const theoSnr = 6.02 * bits + 1.76;
  const snrHere = 20 * Math.log10(a / Math.SQRT2 / Math.max(1e-12, analysis.errRms));

  return (
    <LabFrame
      title={tr("Quantização e dither")}
      description={tr("Reduza os bits e veja o erro de arredondamento: sem dither, ele acompanha o sinal e vira distorção (harmônicos); com dither, vira um ruído constante e sem relação com a música.")}
      audio
      onReset={() => {
        setBits(6);
        setAmp(-20);
        setDither(false);
      }}
      footer={tr("Dither TPDF de ±1 LSB, a forma padrão recomendada pela literatura (Lipshitz, Wannamaker e Vanderkooy, 1992). Espectro por FFT de 8192 pontos com janela de Hann; o áudio é quantizado de verdade antes de tocar.")}
    >
      <div ref={wrap} className="grid gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.1em] text-faint font-medium mb-1">{tr("Forma de onda (1 kHz)")}</div>
          <svg width={W} height={H} className="block rounded-xl bg-sunken" aria-label={tr("Sinal original e quantizado")}>
            <line x1={0} x2={W} y1={H / 2} y2={H / 2} stroke="var(--c-grid)" />
            <path d={wp(analysis.x)} fill="none" stroke="var(--fg-faint)" strokeWidth={3} opacity={0.5} />
            <path d={wp(analysis.q)} fill="none" stroke="var(--c-a)" strokeWidth={1.6} />
          </svg>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.1em] text-faint font-medium mb-1">{tr("Espectro do sinal quantizado (100 Hz – 20 kHz)")}</div>
          <svg width={W} height={SH} className="block rounded-xl bg-sunken" aria-label={tr("Espectro do sinal quantizado")}>
            {[0, -50, -100, -150].map((d) => (
              <g key={d}>
                <line x1={0} x2={W} y1={6 + (-d / 150) * (SH - 20)} y2={6 + (-d / 150) * (SH - 20)} stroke="var(--c-grid)" />
                <text x={W - 4} y={4 + (-d / 150) * (SH - 20)} textAnchor="end" className="fill-[var(--fg-faint)] text-[9.5px]">{d}{' '}{tr("dBFS")}</text>
              </g>
            ))}
            <path d={specPath} fill="none" stroke={dither ? 'var(--c-a)' : 'var(--c-b)'} strokeWidth={1.2} />
          </svg>
        </div>
      </div>
      <div className="mt-4">
        <Controls cols={2}>
          <Slider label={tr("Bits por amostra")} value={bits} min={2} max={16} step={1} onChange={setBits} unit="bits" />
          <Slider label={tr("Nível do sinal")} value={amp} min={-80} max={-1} step={1} onChange={setAmp} unit={tr("dBFS")} hint={tr("Sinais baixos sofrem mais: usam poucos níveis da escala.")} />
        </Controls>
      </div>
      <div className="flex flex-wrap items-center gap-3 mt-4">
        <Toggle checked={dither} onChange={setDither} label={tr("Dither TPDF")} />
        <PlayButton playing={pb.playing} onToggle={() => (pb.playing ? pb.stop() : void start())} />
        <Segmented size="sm" value={src} onChange={(v) => { setSrc(v); pb.stop(); }} options={[{ value: 'tone', label: tr("Tom 440 Hz") }, { value: 'music', label: tr("Música demo") }]} />
      </div>
      <div className="mt-4">
        <Readout
          items={[
            { label: tr("SNR teórica (sinal máximo): 6,02·N + 1,76"), value: `${fmtNum(theoSnr, 1)} dB` },
            { label: tr("Níveis disponíveis"), value: fmtNum(Math.pow(2, bits), 0) },
            { label: tr("Relação sinal/erro neste nível"), value: `${fmtNum(snrHere, 1)} dB`, accent: true },
          ]}
        />
      </div>
      <div className="mt-3">
        <Note>{tr("Com 4–6 bits e sem dither, o sinal baixo soa áspero e “granulado”, e o espectro mostra harmônicos. Ligue o dither: os harmônicos desaparecem e sobra um chiado uniforme — que soa muito mais natural, e sob o qual sinais mais baixos que 1 bit continuam audíveis. Ao tocar, o ganho é aumentado para compensar o nível baixo do sinal.")}</Note>
      </div>
    </LabFrame>
  );
}
