import { useMemo, useState } from 'react';
import { LabFrame, Controls, Readout, Note } from '../../components/ui/LabFrame';
import { Segmented, Slider, Toggle, fmtDb, fmtNum } from '../../components/ui/controls';
import { SourceBar } from '../../components/ui/audio';
import { FreqPlot, Legend } from '../../viz/FreqPlot';
import { PHONES, cabs, cadd, outputImpedanceDeviation, phoneById } from '../../audio/impedance';
import { useCurvePlayer } from '../../audio/useCurvePlayer';
import { logFreqs } from '../../audio/dsp';
import { tr } from '../../i18n';

export default function OutputImpedanceLab() {
  const [model, setModel] = useState('multi');
  const [zout, setZout] = useState(10);
  const [hear, setHear] = useState(true);
  const m = phoneById[model];
  const dev = useMemo(() => outputImpedanceDeviation(m, zout), [m, zout]);
  const { player } = useCurvePlayer('zout', dev, hear);

  const range = useMemo(() => {
    let lo = Infinity, hi = -Infinity, zmin = Infinity;
    for (const f of logFreqs(200)) {
      const d = dev(f);
      lo = Math.min(lo, d);
      hi = Math.max(hi, d);
      zmin = Math.min(zmin, cabs(m.z(f)));
    }
    return { lo, hi, zmin };
  }, [dev, m]);

  return (
    <LabFrame
      title={tr("Impedância de saída e resposta em frequência")}
      description={tr("A fonte não é uma tensão ideal: tem uma impedância interna em série com o fone. Os dois formam um divisor de tensão. Se a impedância do fone varia com a frequência, a tensão que chega a ele também varia — e a resposta muda.")}
      audio
      onReset={() => {
        setModel('multi');
        setZout(10);
      }}
      toolbar={
        <Segmented
          size="sm"
          value={model}
          onChange={setModel}
          options={PHONES.filter((p) => p.id !== 'hp300').map((p) => ({ value: p.id, label: p.name.replace('IEM ', '').replace(tr(" (3 vias, crossover passivo)"), '') }))}
        />
      }
      footer={tr("Divisor de tensão: V_fone = V_fonte · Z_fone / (Z_fone + Z_saída). O desvio é mostrado relativo a 1 kHz. Modelos elétricos representativos.")}
    >
      <FreqPlot
        height={250}
        dbMin={-8}
        dbMax={4}
        dbStep={2}
        curves={[{ id: 'd', label: tr("Desvio com {0} Ω", zout), fn: dev, color: 'var(--c-a)', width: 2.4, fill: true }]}
        ariaLabel={tr("Desvio de resposta causado pela impedância de saída")}
      />
      <div className="mt-2 mb-4">
        <Legend items={[{ label: tr("{0} com fonte de {1} Ω", m.name, zout), color: 'var(--c-a)' }]} />
      </div>
      <Controls cols={2}>
        <Slider label={tr("Impedância de saída da fonte")} value={zout} min={0} max={75} step={0.5} onChange={setZout} unit="Ω" hint={tr("Bons dongles e amplificadores: menos de 1–2 Ω. Algumas saídas antigas e amplificadores valvulados: 10 a mais de 100 Ω.")} />
      </Controls>
      <div className="mt-4">
        <Readout
          items={[
            { label: tr("Variação total da resposta"), value: `${fmtNum(range.hi - range.lo, 1)} dB`, accent: true },
            { label: tr("Impedância mínima do fone"), value: `${fmtNum(range.zmin, 1)} Ω` },
            { label: tr("Regra de 1/8 (Z_saída máx.)"), value: `${fmtNum(range.zmin / 8, 1)} Ω`, hint: zout <= range.zmin / 8 ? 'atendida' : tr("não atendida") },
            { label: tr("Perda de nível em 1 kHz"), value: fmtDb(20 * Math.log10(cabs(m.z(1000)) / cabs(cadd(m.z(1000), [zout, 0])))) },
          ]}
        />
      </div>
      <div className="mt-4">
        <SourceBar player={player} extra={<Toggle checked={hear} onChange={setHear} label={hear ? tr("Com {0} Ω", zout) : tr("Fonte ideal (0 Ω)")} />} />
      </div>
      <div className="mt-3">
        <Note>
          {m.id === 'multi'
            ? tr("Num IEM multi-BA, a impedância pode cair muito em algumas regiões e subir em outras. Com uma fonte de 10 Ω, a resposta muda vários decibéis — mais que muitas diferenças entre IEMs inteiros. É o caso mais claro em que a fonte muda o som de forma mensurável.")
            : m.id === 'planar'
              ? tr("Com impedância praticamente constante, quase nada muda: só o volume cai um pouco. Planares e muitos dinâmicos são pouco sensíveis à impedância de saída.")
              : tr("O efeito depende de quanto a impedância do fone varia. Use a regra prática: impedância de saída menor que 1/8 da menor impedância do fone mantém o desvio abaixo de ~1 dB.")}
        </Note>
      </div>
    </LabFrame>
  );
}
