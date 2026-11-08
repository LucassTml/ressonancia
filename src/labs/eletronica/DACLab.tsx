import { useMemo, useState } from 'react';
import { LabFrame, Controls, Note } from '../../components/ui/LabFrame';
import { Segmented, Slider, Toggle, fmtHz, fmtNum } from '../../components/ui/controls';
import { useElementSize } from '../../lib/hooks';
import { biquadCoefs } from '../../audio/dsp';
import { tr } from '../../i18n';

const FS = 44100;
const sinc = (x: number) => (Math.abs(x) < 1e-9 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x));

type Filter = 'none' | 'gentle' | 'ideal';

export default function DACLab() {
  const [f, setF] = useState(5000);
  const [os, setOs] = useState(1);
  const [filter, setFilter] = useState<Filter>('ideal');
  const [showSamples, setShowSamples] = useState(true);
  const [wrap, { width }] = useElementSize<HTMLDivElement>();

  const data = useMemo(() => {
    const T = Math.max(14 / FS, Math.min(3 / f, 40 / FS));
    const n0 = -8, n1 = Math.ceil(T * FS) + 8;
    const x = (t: number) => Math.sin(2 * Math.PI * f * t + 0.3);
    // amostras na taxa base
    const base: [number, number][] = [];
    for (let n = n0; n <= n1; n++) base.push([n / FS, x(n / FS)]);
    // sobreamostragem digital (interpolação sinc ideal entre amostras base)
    const fs2 = FS * os;
    const up: [number, number][] = [];
    for (let m = n0 * os; m <= n1 * os; m++) {
      const t = m / fs2;
      if (os === 1) up.push([t, x(t)]);
      else {
        let s = 0;
        for (const [tn, v] of base) s += v * sinc((t - tn) * FS);
        up.push([t, s]);
      }
    }
    // saída analógica em alta resolução interna
    const R = 48 * Math.max(1, 8 / os); // pontos por período de amostra (após sobreamostragem)
    const fsi = fs2 * R;
    const pts: [number, number][] = [];
    const stairs: [number, number][] = [];
    for (const [t, v] of up) {
      for (let k = 0; k < R; k++) stairs.push([t + k / fsi, v]);
    }
    if (filter === 'ideal') {
      for (const [t] of stairs.filter((_, i) => i % 4 === 0)) {
        let s = 0;
        for (const [tn, v] of base) s += v * sinc((t - tn) * FS);
        pts.push([t, s]);
      }
    } else if (filter === 'gentle') {
      // passa-baixas analógico simples (2 polos em cascata) logo acima de 20 kHz
      const c = biquadCoefs({ id: 'g', type: 'lowpass', freq: Math.min(fsi * 0.45, os === 1 ? 24000 : 30000), gain: 0, q: 0.6 }, fsi);
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0, z1 = 0, z2 = 0, w1 = 0, w2 = 0;
      for (const [t, v] of stairs) {
        const y = (c.b0 * v + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2) / c.a0;
        x2 = x1; x1 = v; y2 = y1; y1 = y;
        const zz = (c.b0 * y + c.b1 * z1 + c.b2 * z2 - c.a1 * w1 - c.a2 * w2) / c.a0;
        z2 = z1; z1 = y; w2 = w1; w1 = zz;
        pts.push([t, zz]);
      }
    }
    return { T, base, up, stairs, pts, x, fs2 };
  }, [f, os, filter]);

  // espectro analítico: imagens da retenção de ordem zero
  const spectrum = useMemo(() => {
    const fs2 = FS * os;
    const comps: { fr: number; db: number; kind: 'sinal' | 'imagem' }[] = [];
    const fMaxPlot = 4 * FS;
    for (let k = 0; k * fs2 - f <= fMaxPlot; k++) {
      for (const fr of k === 0 ? [f] : [k * fs2 - f, k * fs2 + f]) {
        if (fr <= 0 || fr > fMaxPlot) continue;
        let a = Math.abs(sinc(fr / fs2)); // envelope da retenção
        if (filter === 'ideal') a *= fr < FS / 2 ? 1 : 0;
        if (filter === 'gentle') {
          const fc = os === 1 ? 24000 : 30000;
          a *= 1 / (1 + Math.pow(fr / fc, 4));
        }
        comps.push({ fr, db: 20 * Math.log10(Math.max(1e-6, a)), kind: k === 0 ? 'sinal' : 'imagem' });
      }
    }
    return comps;
  }, [f, os, filter]);

  const H = 220, pad = 10;
  const tx = (t: number) => pad + (t / data.T) * (width - 2 * pad);
  const ty = (v: number) => H / 2 - v * (H / 2 - 16);
  const inWin = (t: number) => t >= 0 && t <= data.T;
  const line = (pts: [number, number][]) => pts.filter(([t]) => inWin(t)).map(([t, v], i) => `${i ? 'L' : 'M'}${tx(t).toFixed(1)},${ty(v).toFixed(1)}`).join('');
  const contPts: [number, number][] = Array.from({ length: 400 }, (_, i) => [(i / 399) * data.T, data.x((i / 399) * data.T)]);

  const SH = 150;
  const sx = (fr: number) => pad + (fr / (4 * FS)) * (width - 2 * pad);
  const sy = (db: number) => 10 + ((0 - Math.max(-60, db)) / 60) * (SH - 30);
  const imageLevel = spectrum.filter((c) => c.kind === 'imagem').reduce((m, c) => Math.max(m, c.db), -120);

  return (
    <LabFrame
      title={tr("Por dentro de um DAC")}
      description={tr("As amostras digitais são números em instantes discretos (pontos). Um DAC simples segura cada valor até o próximo (degraus); um filtro de reconstrução remove as imagens espectrais criadas por esses degraus e devolve o sinal contínuo original.")}
      onReset={() => {
        setF(5000);
        setOs(1);
        setFilter('ideal');
      }}
      footer={tr("A curva cinza é o sinal analógico original. Com o filtro ideal, a reconstrução coincide com ela — exatamente, não aproximadamente — sempre que a frequência estiver abaixo de metade da taxa de amostragem.")}
    >
      <div ref={wrap}>
        {width > 0 && (
          <svg width={width} height={H} className="block rounded-xl bg-sunken" role="img" aria-label={tr("Amostras, degraus e sinal reconstruído")}>
            <line x1={pad} x2={width - pad} y1={H / 2} y2={H / 2} stroke="var(--c-grid-strong)" />
            <path d={line(contPts)} fill="none" stroke="var(--fg-faint)" strokeWidth={4} opacity={0.5} />
            <path d={line(data.stairs.filter((_, i) => i % 2 === 0))} fill="none" stroke="var(--c-b)" strokeWidth={1.4} opacity={filter === 'none' ? 1 : 0.45} />
            {filter !== 'none' && <path d={line(data.pts)} fill="none" stroke="var(--c-a)" strokeWidth={2.2} />}
            {showSamples &&
              data.base.filter(([t]) => inWin(t)).map(([t, v]) => (
                <g key={t}>
                  <line x1={tx(t)} x2={tx(t)} y1={H / 2} y2={ty(v)} stroke="var(--fg)" strokeWidth={1} opacity={0.5} />
                  <circle cx={tx(t)} cy={ty(v)} r={3.2} fill="var(--fg)" />
                </g>
              ))}
          </svg>
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-muted mt-2">
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[var(--fg)]" />{' '}{tr("amostras (44,1 kHz)")}</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-4 h-[2px] bg-[var(--c-b)]" />{' '}{tr("saída com retenção (degraus)")}{os > 1 ? tr(" após sobreamostragem ×{0}", os) : ''}</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-4 h-[2px] bg-[var(--c-a)]" />{' '}{tr("após o filtro de reconstrução")}</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-4 h-[3px] bg-[var(--fg-faint)]" />{' '}{tr("sinal original")}</span>
      </div>

      <div className="mt-5">
        <div className="text-[11px] uppercase tracking-[0.1em] text-faint font-medium mb-1">{tr("Espectro da saída (0 a 4 × 44,1 kHz)")}</div>
        {width > 0 && (
          <svg width={width} height={SH} className="block" role="img" aria-label={tr("Espectro com imagens")}>
            {[0, -20, -40, -60].map((d) => (
              <g key={d}>
                <line x1={pad} x2={width - pad} y1={sy(d)} y2={sy(d)} stroke="var(--c-grid)" />
                <text x={width - pad} y={sy(d) - 2} textAnchor="end" className="fill-[var(--fg-faint)] text-[9.5px]">{d} dB</text>
              </g>
            ))}
            <rect x={sx(0)} y={8} width={sx(20000) - sx(0)} height={SH - 30} fill="var(--accent-soft)" />
            {[1, 2, 3, 4].map((k) => (
              <g key={k}>
                <line x1={sx(k * FS)} x2={sx(k * FS)} y1={8} y2={SH - 22} stroke="var(--c-grid-strong)" strokeDasharray="2 3" />
                <text x={sx(k * FS)} y={SH - 8} textAnchor="middle" className="fill-[var(--fg-muted)] text-[10px]">{k}{tr("·fs")}</text>
              </g>
            ))}
            <text x={sx(10000)} y={SH - 8} textAnchor="middle" className="fill-[var(--accent)] text-[10px]">{tr("audível")}</text>
            {spectrum.map((c, i) => (
              <line key={i} x1={sx(c.fr)} x2={sx(c.fr)} y1={SH - 22} y2={sy(c.db)} stroke={c.kind === 'sinal' ? 'var(--c-a)' : 'var(--c-b)'} strokeWidth={2.5} strokeLinecap="round" opacity={c.db < -59 ? 0.25 : 1} />
            ))}
          </svg>
        )}
      </div>

      <div className="flex flex-wrap gap-3 mt-4 mb-4">
        <Segmented size="sm" value={filter} onChange={setFilter} options={[{ value: 'none', label: tr("Sem filtro") }, { value: 'gentle', label: tr("Filtro analógico suave") }, { value: 'ideal', label: tr("Reconstrução ideal") }]} />
        <Segmented size="sm" value={String(os)} onChange={(v) => setOs(Number(v))} options={[{ value: '1', label: tr("Sem sobreamostragem") }, { value: '4', label: '×4' }, { value: '8', label: '×8' }]} />
        <Toggle checked={showSamples} onChange={setShowSamples} label={tr("Mostrar amostras")} />
      </div>
      <Controls cols={2}>
        <Slider label={tr("Frequência do sinal")} value={f} min={200} max={21000} log onChange={(v) => setF(Math.round(v))} format={fmtHz} hint={tr("{0} amostras por ciclo", fmtNum(FS / f, 1))} />
      </Controls>
      <div className="mt-3">
        <Note>{tr("Os degraus não são “o som digital”: são o efeito de um DAC que retém cada valor. Eles equivalem ao sinal original mais imagens acima de 22 kHz (barras laranjas). Imagem mais forte agora:")}{' '}{imageLevel < -100 ? 'nenhuma' : `${fmtNum(imageLevel, 0)} dB`}{tr(". Com sobreamostragem, as imagens se afastam para múltiplos de")}{' '}{os}{tr("·fs e um filtro analógico simples basta para removê-las — é o que DACs modernos fazem.")}</Note>
      </div>
    </LabFrame>
  );
}
