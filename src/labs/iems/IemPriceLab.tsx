import { useMemo, useState } from 'react';
import { LabFrame, Note } from '../../components/ui/LabFrame';
import { useElementSize } from '../../lib/hooks';
import { fmtNum } from '../../components/ui/controls';
import { iems, targetError } from '../../data/iems';
import { tr } from '../../i18n';

/** Preço contra proximidade do alvo, calculado a partir das medições. */
export default function IemPriceLab() {
  const [wrap, { width }] = useElementSize<HTMLDivElement>();
  const [hover, setHover] = useState<string | null>(null);
  const points = useMemo(() => iems.map((m) => ({ m, err: targetError(m) })), []);
  const H = 340, L = 44, R = 12, T = 14, B = 40;
  const W = width || 600;
  const x = (p: number) => L + (Math.log(p / 15) / Math.log(3000 / 15)) * (W - L - R);
  const y = (e: number) => T + (e / 5) * (H - T - B);
  const h = points.find((p) => p.m.id === hover);

  return (
    <LabFrame
      title={tr('Preço contra proximidade do alvo')}
      description={tr('Cada ponto é um IEM. Quanto mais alto no gráfico, menor o desvio em relação ao Harman IE 2019 entre 100 Hz e 5 kHz. Passe o ponteiro para ver o nome.')}
      footer={tr('Desvio RMS após remover o nível médio. Mede proximidade de um alvo, não qualidade: um IEM pode se afastar do alvo de propósito e ser excelente.')}
    >
      <div ref={wrap} className="relative">
        {width > 0 && (
          <svg width={W} height={H} role="img" aria-label={tr('Dispersão de preço e desvio do alvo')}>
            {[0, 1, 2, 3, 4, 5].map((e) => (
              <g key={e}>
                <line x1={L} x2={W - R} y1={y(e)} y2={y(e)} stroke="var(--c-grid)" />
                <text x={L - 7} y={y(e) + 3.5} textAnchor="end" className="fill-[var(--fg-muted)] text-[10.5px]">{e} dB</text>
              </g>
            ))}
            {[20, 50, 100, 200, 500, 1000, 2000].map((p) => (
              <g key={p}>
                <line x1={x(p)} x2={x(p)} y1={T} y2={H - B} stroke="var(--c-grid)" />
                <text x={x(p)} y={H - B + 16} textAnchor="middle" className="fill-[var(--fg-muted)] text-[10.5px]">${p}</text>
              </g>
            ))}
            <text x={(L + W - R) / 2} y={H - 6} textAnchor="middle" className="fill-[var(--fg-muted)] text-[11px]">{tr('preço aproximado (US$, escala logarítmica)')}</text>
            {points.map(({ m, err }) => (
              <circle
                key={m.id}
                cx={x(m.price)}
                cy={y(err)}
                r={hover === m.id ? 7.5 : 5.5}
                fill="var(--c-a)"
                opacity={hover && hover !== m.id ? 0.35 : 0.85}
                onPointerEnter={() => setHover(m.id)}
                onPointerLeave={() => setHover(null)}
                style={{ transition: 'r .15s, opacity .15s' }}
              />
            ))}
          </svg>
        )}
        {h && (
          <div className="pointer-events-none absolute z-10 rounded-lg border border-line bg-elev px-2.5 py-1.5 text-[12px] shadow-[var(--shadow-pop)]" style={{ left: Math.min(W - 190, x(h.m.price) + 10), top: Math.max(0, y(h.err) - 18) }}>
            <div className="text-fg font-medium">{h.m.name}</div>
            <div className="text-muted">{h.m.priceLabel} · {tr('desvio')} {fmtNum(h.err, 1)} dB</div>
          </div>
        )}
      </div>
      <div className="mt-3">
        <Note>{tr('Repare que não há uma subida da esquerda para a direita: alguns dos IEMs mais próximos do alvo custam menos de US$ 100, e vários dos mais caros estão bem longe dele. Passada a faixa de entrada, preço compra construção, marca e caráter, e não proximidade do alvo.')}</Note>
      </div>
    </LabFrame>
  );
}
