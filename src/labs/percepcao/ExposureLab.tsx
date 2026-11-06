import { useState } from 'react';
import { LabFrame, Controls, Readout, Note } from '../../components/ui/LabFrame';
import { Segmented, Slider, fmtNum } from '../../components/ui/controls';
import { useElementSize } from '../../lib/hooks';

/** NIOSH (1998): 85 dB(A) por 8 h, taxa de troca de 3 dB. Retorna horas permitidas. */
const niosh = (L: number) => 8 / Math.pow(2, (L - 85) / 3);
/** OMS/ITU H.870 (2019): 80 dB(A) por 40 h semanais (adultos), 75 dB(A) para crianças, troca de 3 dB. */
const who = (L: number, kids: boolean) => 40 / Math.pow(2, (L - (kids ? 75 : 80)) / 3);

function fmtTime(h: number) {
  if (h >= 1) return `${fmtNum(h, h >= 10 ? 0 : 1)} h`;
  const m = h * 60;
  if (m >= 1) return `${fmtNum(m, 0)} min`;
  return `${fmtNum(m * 60, 0)} s`;
}

export default function ExposureLab() {
  const [level, setLevel] = useState(85);
  const [hours, setHours] = useState(2);
  const [std, setStd] = useState<'niosh' | 'who' | 'who-kids'>('who');
  const [wrap, { width }] = useElementSize<HTMLDivElement>();

  const allowedDay = niosh(level);
  const allowedWeek = std === 'niosh' ? allowedDay * 5 : who(level, std === 'who-kids');
  const weekly = hours * 7;
  const dose = std === 'niosh' ? (hours / allowedDay) * 100 : (weekly / allowedWeek) * 100;

  const H = 180, pad = 34;
  const x = (L: number) => pad + ((L - 70) / 50) * (width - pad - 8);
  const curve = (fn: (L: number) => number) => {
    let d = '';
    for (let L = 70; L <= 120; L += 0.5) {
      const hh = Math.max(1 / 3600, fn(L));
      const yy = 8 + ((Math.log10(200) - Math.log10(hh)) / (Math.log10(200) - Math.log10(1 / 3600))) * (H - 30);
      d += `${L === 70 ? 'M' : 'L'}${x(L).toFixed(1)},${yy.toFixed(1)}`;
    }
    return d;
  };

  return (
    <LabFrame
      title="Calculadora de exposição sonora"
      description="Quanto tempo de escuta cada nível permite, segundo os critérios de saúde ocupacional (NIOSH) e de escuta segura da OMS/ITU."
      onReset={() => {
        setLevel(85);
        setHours(2);
        setStd('who');
      }}
      toolbar={
        <Segmented
          size="sm"
          value={std}
          onChange={setStd}
          options={[
            { value: 'who', label: 'OMS adultos' },
            { value: 'who-kids', label: 'OMS crianças' },
            { value: 'niosh', label: 'NIOSH (diário)' },
          ]}
        />
      }
      footer="Critérios de exposição são estatísticos: definem um risco aceitável para a população, não um limite seguro garantido para cada pessoa. Os níveis se referem ao som no ouvido, ponderado em A — o que um fone produz depende do volume, da fonte e da sensibilidade (veja o laboratório de potência)."
    >
      <Controls cols={2}>
        <Slider label="Nível médio no ouvido" value={level} min={70} max={115} step={1} onChange={setLevel} unit="dB(A)" />
        <Slider label="Horas de escuta por dia" value={hours} min={0.25} max={12} step={0.25} onChange={setHours} unit="h" />
      </Controls>
      <div className="mt-4">
        <Readout
          items={[
            { label: 'Tempo diário permitido (NIOSH)', value: fmtTime(allowedDay), accent: std === 'niosh' },
            { label: 'Tempo semanal permitido (OMS)', value: fmtTime(std === 'niosh' ? who(level, false) : allowedWeek), accent: std !== 'niosh' },
            { label: std === 'niosh' ? 'Dose diária' : 'Dose semanal', value: `${fmtNum(dose, 0)}%`, hint: dose > 100 ? 'acima do critério' : 'dentro do critério' },
          ]}
        />
      </div>
      <div ref={wrap} className="mt-5">
        {width > 0 && (
          <svg width={width} height={H} role="img" aria-label="Tempo permitido por nível">
            {[1 / 60, 0.25, 1, 8, 40, 168].map((h) => {
              const yy = 8 + ((Math.log10(200) - Math.log10(h)) / (Math.log10(200) - Math.log10(1 / 3600))) * (H - 30);
              return (
                <g key={h}>
                  <line x1={pad} x2={width - 8} y1={yy} y2={yy} stroke="var(--c-grid)" />
                  <text x={pad - 4} y={yy + 3} textAnchor="end" className="fill-[var(--fg-muted)] text-[9.5px]">
                    {fmtTime(h)}
                  </text>
                </g>
              );
            })}
            {[70, 80, 90, 100, 110, 120].map((L) => (
              <text key={L} x={x(L)} y={H - 6} textAnchor="middle" className="fill-[var(--fg-muted)] text-[10px]">
                {L}
              </text>
            ))}
            <path d={curve(niosh)} fill="none" stroke="var(--c-b)" strokeWidth={1.6} />
            <path d={curve((L) => who(L, std === 'who-kids'))} fill="none" stroke="var(--c-a)" strokeWidth={2} />
            <line x1={x(level)} x2={x(level)} y1={8} y2={H - 22} stroke="var(--fg-faint)" strokeDasharray="3 3" />
          </svg>
        )}
        <div className="flex gap-4 text-[11.5px] text-muted mt-1">
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-[2px] bg-[var(--c-b)]" /> NIOSH, por dia</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-[2px] bg-[var(--c-a)]" /> OMS/ITU, por semana</span>
        </div>
      </div>
      <div className="mt-3">
        <Note>
          A cada +3 dB, o tempo permitido cai pela metade, porque a energia sonora dobra. Ouvir a 94 dB(A) por uma hora entrega a mesma
          dose que ouvir a 85 dB(A) por oito horas.
        </Note>
      </div>
    </LabFrame>
  );
}
