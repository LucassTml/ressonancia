import { useState } from 'react';
import { LabFrame, Controls, Readout, Note } from '../../components/ui/LabFrame';
import { Slider, fmtDb, fmtNum } from '../../components/ui/controls';
import { useElementSize } from '../../lib/hooks';
import { tr } from '../../i18n';

const D = { input: -10, volume: -20, gain: 12, rail: 4, sens: 110, noise: 3 };

export default function GainLab() {
  const [s, setS] = useState(D);
  const set = <K extends keyof typeof D>(k: K, v: (typeof D)[K]) => setS((p) => ({ ...p, [k]: v }));
  const [wrap, { width }] = useElementSize<HTMLDivElement>();

  // nível do pico do programa na entrada (dBV), atenuado pelo volume e amplificado pelo ganho
  const vin = Math.pow(10, s.input / 20); // V RMS do pico do sinal
  const vout = vin * Math.pow(10, (s.volume + s.gain) / 20) * Math.SQRT2; // pico em volts
  const clip = vout > s.rail;
  const headroom = 20 * Math.log10(s.rail / Math.max(vout, 1e-9));
  const voutRms = Math.min(vout, s.rail) / Math.SQRT2;
  const spl = s.sens + 20 * Math.log10(Math.max(voutRms, 1e-9));
  const noiseSpl = s.sens + 20 * Math.log10(s.noise * 1e-6);
  const maxSpl = s.sens + 20 * Math.log10(s.rail / Math.SQRT2);

  const W = width || 400, H = 160;
  const path = (clipIt: boolean) => {
    let d = '';
    for (let i = 0; i <= 300; i++) {
      const t = i / 300;
      let v = vout * Math.sin(2 * Math.PI * 2 * t);
      if (clipIt) v = Math.max(-s.rail, Math.min(s.rail, v));
      const scale = Math.max(s.rail * 1.4, vout * 1.05);
      d += `${i ? 'L' : 'M'}${(t * W).toFixed(1)},${(H / 2 - (v / scale) * (H / 2 - 8)).toFixed(1)}`;
    }
    return d;
  };
  const railY = H / 2 - (s.rail / Math.max(s.rail * 1.4, vout * 1.05)) * (H / 2 - 8);

  return (
    <LabFrame
      title={tr("Ganho, volume e headroom")}
      description={tr("Um amplificador multiplica a tensão do sinal pelo seu ganho, mas não pode ultrapassar a tensão da sua alimentação. Ajuste o nível de entrada, o volume e o ganho e veja onde o sinal corta — e o que acontece com o ruído de fundo num IEM sensível.")}
      onReset={() => setS(D)}
      footer={tr("A tensão de alimentação (rail) limita o pico de saída. O ruído é modelado como uma tensão fixa na saída do amplificador, independente do volume — o caso típico de estágios de ganho depois do controle de volume.")}
    >
      <div ref={wrap}>
        {width > 0 && (
          <svg width={W} height={H} className="block rounded-xl bg-sunken" aria-label={tr("Forma de onda na saída do amplificador")}>
            <line x1={0} x2={W} y1={H / 2} y2={H / 2} stroke="var(--c-grid-strong)" />
            <line x1={0} x2={W} y1={railY} y2={railY} stroke="var(--c-diff)" strokeDasharray="4 4" />
            <line x1={0} x2={W} y1={H - railY} y2={H - railY} stroke="var(--c-diff)" strokeDasharray="4 4" />
            <text x={6} y={railY - 4} className="fill-[var(--c-diff)] text-[10px]">{tr("limite da alimentação (+")}{s.rail} V)</text>
            {clip && <path d={path(false)} fill="none" stroke="var(--fg-faint)" strokeWidth={1.2} strokeDasharray="3 3" />}
            <path d={path(true)} fill="none" stroke={clip ? 'var(--c-diff)' : 'var(--c-a)'} strokeWidth={2.2} />
          </svg>
        )}
      </div>
      <div className="mt-4">
        <Controls cols={3}>
          <Slider label={tr("Pico do sinal na entrada")} value={s.input} min={-30} max={6} step={0.5} onChange={(v) => set('input', v)} unit={tr("dBV")} hint={tr("Saída de linha de consumo: ~−10 dBV; DACs: até +6 dBV (2 V).")} />
          <Slider label={tr("Controle de volume")} value={s.volume} min={-60} max={0} step={0.5} onChange={(v) => set('volume', v)} format={fmtDb} />
          <Slider label={tr("Ganho do amplificador")} value={s.gain} min={0} max={30} step={0.5} onChange={(v) => set('gain', v)} format={fmtDb} />
          <Slider label={tr("Tensão de alimentação (pico máx.)")} value={s.rail} min={0.5} max={15} step={0.1} onChange={(v) => set('rail', v)} unit="V" />
          <Slider label={tr("Sensibilidade do fone")} value={s.sens} min={90} max={125} step={0.5} onChange={(v) => set('sens', v)} unit={tr("dB/V")} />
          <Slider label={tr("Ruído de saída do amplificador")} value={s.noise} min={0.5} max={50} log onChange={(v) => set('noise', Number(v.toFixed(1)))} unit="µV" />
        </Controls>
      </div>
      <div className="mt-4">
        <Readout
          items={[
            { label: tr("Pico na saída"), value: `${fmtNum(Math.min(vout, s.rail), 2)} V`, hint: clip ? tr("cortando (clipping)") : undefined },
            { label: tr("Headroom restante"), value: `${fmtNum(headroom, 1)} dB`, accent: !clip },
            { label: tr("SPL nos picos"), value: `${fmtNum(spl, 1)} dB SPL` },
            { label: tr("SPL máximo possível"), value: `${fmtNum(maxSpl, 1)} dB SPL` },
            { label: tr("Ruído no ouvido"), value: `${fmtNum(noiseSpl, 1)} dB SPL`, hint: noiseSpl < 0 ? tr("inaudível") : noiseSpl < 10 ? tr("audível só em silêncio") : tr("chiado audível") },
          ]}
        />
      </div>
      <div className="mt-3">
        <Note>{tr("Com um IEM sensível, um amplificador de ganho alto obriga a usar o volume quase no mínimo e expõe o ruído de saída. Para o mesmo volume no ouvido, um ganho menor deixa o ruído igualmente menor, sem perder nada — por isso fontes para IEMs costumam ter modos de ganho baixo.")}</Note>
      </div>
    </LabFrame>
  );
}
