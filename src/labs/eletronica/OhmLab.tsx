import { useRef, useState } from 'react';
import { LabFrame, Controls, Readout, Note } from '../../components/ui/LabFrame';
import { Segmented, Slider, fmtNum } from '../../components/ui/controls';
import { useAnimationFrame, useInView } from '../../lib/hooks';
import { tr } from '../../i18n';

function si(v: number, unit: string) {
  const a = Math.abs(v);
  if (a >= 1) return `${fmtNum(v, 3)} ${unit}`;
  if (a >= 1e-3) return `${fmtNum(v * 1e3, 2)} m${unit}`;
  return `${fmtNum(v * 1e6, 1)} µ${unit}`;
}

export default function OhmLab() {
  const [v, setV] = useState(1);
  const [r1, setR1] = useState(32);
  const [r2, setR2] = useState(32);
  const [topo, setTopo] = useState<'single' | 'series' | 'parallel'>('single');
  const [offset, setOffset] = useState(0);
  const o = useRef(0);
  const [wrap, inView] = useInView<HTMLDivElement>();

  const req = topo === 'single' ? r1 : topo === 'series' ? r1 + r2 : (r1 * r2) / (r1 + r2);
  const i = v / req;
  const p = v * i;
  const i1 = topo === 'parallel' ? v / r1 : i;
  const i2 = topo === 'parallel' ? v / r2 : i;
  const v1 = topo === 'series' ? i * r1 : v;

  useAnimationFrame((_, dt) => {
    o.current = (o.current + dt * Math.min(60, i * 600)) % 24;
    setOffset(o.current);
  }, inView);

  // percurso do circuito (retângulo)
  const path = topo === 'parallel' ? 'M60,40 H340 V180 H60 Z' : 'M60,40 H340 V180 H60 Z';
  return (
    <LabFrame
      title={tr("Lei de Ohm em um circuito")}
      description={tr("Uma fonte de tensão alimenta um ou dois resistores (pense neles como fones). Os pontos representam o fluxo de carga: a velocidade é proporcional à corrente.")}
      onReset={() => {
        setV(1);
        setR1(32);
        setR2(32);
        setTopo('single');
      }}
      toolbar={
        <Segmented
          size="sm"
          value={topo}
          onChange={setTopo}
          options={[
            { value: 'single', label: tr("Um resistor") },
            { value: 'series', label: tr("Série") },
            { value: 'parallel', label: tr("Paralelo") },
          ]}
        />
      }
      footer={tr("Na realidade, os elétrons individuais andam muito devagar (frações de milímetro por segundo); o que viaja quase à velocidade da luz é o sinal — o campo elétrico ao longo do fio. A animação representa a intensidade da corrente, não a velocidade real dos elétrons.")}
    >
      <div ref={wrap} className="rounded-xl bg-sunken">
        <svg viewBox="0 0 400 220" className="w-full max-h-[260px]" role="img" aria-label={tr("Circuito elétrico")}>
          <path d={path} fill="none" stroke="var(--line-strong)" strokeWidth={3} />
          <path d={path} fill="none" stroke="var(--accent)" strokeWidth={3} strokeDasharray="2 22" strokeDashoffset={-offset} strokeLinecap="round" opacity={0.9} />
          {/* fonte */}
          <rect x={44} y={90} width={32} height={40} rx={6} fill="var(--bg-elev)" stroke="var(--fg-muted)" />
          <text x={60} y={108} textAnchor="middle" className="fill-[var(--fg)] text-[11px] font-semibold">+</text>
          <text x={60} y={124} textAnchor="middle" className="fill-[var(--fg)] text-[11px] font-semibold">−</text>
          <text x={24} y={114} textAnchor="middle" className="fill-[var(--fg-muted)] text-[10px]">{fmtNum(v, 2)} V</text>
          {/* resistores */}
          {topo === 'parallel' ? (
            <>
              <line x1={200} y1={40} x2={200} y2={180} stroke="var(--line-strong)" strokeWidth={3} />
              <line x1={200} y1={40} x2={200} y2={180} stroke="var(--accent)" strokeWidth={3} strokeDasharray="2 22" strokeDashoffset={-(offset * (i2 / i))} />
              <rect x={186} y={92} width={28} height={36} rx={4} fill="var(--c-b)" />
              <text x={226} y={114} className="fill-[var(--fg-muted)] text-[10px]">R₂ = {r2} Ω</text>
              <rect x={326} y={92} width={28} height={36} rx={4} fill="var(--c-b)" />
              <text x={300} y={84} className="fill-[var(--fg-muted)] text-[10px]">R₁ = {r1} Ω</text>
            </>
          ) : (
            <>
              <rect x={326} y={92} width={28} height={36} rx={4} fill="var(--c-b)" />
              <text x={300} y={84} className="fill-[var(--fg-muted)] text-[10px]">R₁ = {r1} Ω</text>
              {topo === 'series' && (
                <>
                  <rect x={186} y={166} width={36} height={28} rx={4} fill="var(--c-b)" />
                  <text x={204} y={212} textAnchor="middle" className="fill-[var(--fg-muted)] text-[10px]">R₂ = {r2} Ω</text>
                </>
              )}
            </>
          )}
          <text x={200} y={30} textAnchor="middle" className="fill-[var(--accent)] text-[11px] font-mono">I = {si(i, 'A')}</text>
        </svg>
      </div>
      <div className="mt-4">
        <Controls cols={3}>
          <Slider label={tr("Tensão da fonte")} value={v} min={0.01} max={10} log onChange={(x) => setV(Number(x.toFixed(3)))} unit="V" />
          <Slider label="R₁" value={r1} min={1} max={600} log onChange={(x) => setR1(Math.round(x))} unit="Ω" />
          <Slider label="R₂" value={r2} min={1} max={600} log onChange={(x) => setR2(Math.round(x))} unit="Ω" disabled={topo === 'single'} />
        </Controls>
      </div>
      <div className="mt-4">
        <Readout
          items={[
            { label: tr("Resistência equivalente"), value: `${fmtNum(req, 2)} Ω` },
            { label: tr("Corrente total  I = V/R"), value: si(i, 'A'), accent: true },
            { label: tr("Potência total  P = V·I"), value: si(p, 'W') },
            ...(topo === 'series' ? [{ label: tr("Tensão sobre R₁"), value: si(v1, 'V') }] : []),
            ...(topo === 'parallel' ? [{ label: tr("Corrente em R₁ / R₂"), value: `${si(i1, 'A')} / ${si(i2, 'A')}` }] : []),
          ]}
        />
      </div>
      <div className="mt-3">
        <Note>{tr("Com a mesma tensão, uma resistência menor puxa mais corrente e consome mais potência: P = V²/R. É por isso que, para uma mesma tensão, um fone de 16 Ω exige 2× mais corrente e potência que um de 32 Ω — o que não significa que ele precise de mais tensão para tocar alto (isso depende da sensibilidade).")}</Note>
      </div>
    </LabFrame>
  );
}
