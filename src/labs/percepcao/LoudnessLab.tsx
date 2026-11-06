import { useEffect, useMemo, useRef, useState } from 'react';
import { LabFrame, Controls, Readout, Note } from '../../components/ui/LabFrame';
import { Segmented, Slider, Toggle, fmtNum } from '../../components/ui/controls';
import { SourceBar, useSourcePlayer } from '../../components/ui/audio';
import { FreqPlot, Legend, type PlotCurve } from '../../viz/FreqPlot';
import { ISO_F, ISO_THRESHOLD, iso226At, iso226Table, phonToSone } from '../../audio/iso226';
import { firBuffer } from '../../audio/dsp';
import { dbToGain } from '../../audio/engine';

const LEVELS = [20, 30, 40, 50, 60, 70, 80, 90];

export default function LoudnessLab() {
  const [tab, setTab] = useState<'curves' | 'comp'>('curves');
  const [phon, setPhon] = useState(60);
  const [ref, setRef] = useState(83);
  const [listen, setListen] = useState(55);
  const [comp, setComp] = useState(false);

  const tables = useMemo(() => Object.fromEntries(LEVELS.map((l) => [l, iso226Table(l)])), []);
  const selTable = useMemo(() => iso226Table(phon), [phon]);
  const refT = useMemo(() => iso226Table(ref), [ref]);
  const lisT = useMemo(() => iso226Table(listen), [listen]);

  /** Quanto é preciso reforçar cada frequência, ao ouvir em `listen` fons, para preservar o equilíbrio percebido em `ref`. */
  const compDb = useMemo(
    () => (f: number) => {
      const ff = Math.min(12500, Math.max(20, f));
      const d = iso226At(listen, ff, lisT) - listen - (iso226At(ref, ff, refT) - ref);
      const d1k = iso226At(listen, 1000, lisT) - listen - (iso226At(ref, 1000, refT) - ref);
      return d - d1k;
    },
    [listen, ref, lisT, refT],
  );

  const curves: PlotCurve[] =
    tab === 'curves'
      ? [
          ...LEVELS.map((l) => ({
            id: `p${l}`,
            fn: (f: number) => iso226At(l, f, tables[l]),
            color: 'var(--fg-faint)',
            width: 1,
            opacity: 0.7,
          })),
          { id: 'thr', label: 'Limiar de audição', fn: (f: number) => iso226At(0, f, ISO_THRESHOLD), color: 'var(--c-diff)', width: 1.4, dash: '4 3' },
          { id: 'sel', label: `${phon} fons`, fn: (f: number) => iso226At(phon, f, selTable), color: 'var(--c-a)', width: 2.4 },
        ]
      : [
          { id: 'comp', label: 'Reforço necessário', fn: compDb, color: 'var(--c-a)', width: 2.2, fill: true },
        ];

  // Processamento: atenuação de volume + (opcional) compensação por FIR
  const nodes = useRef<{ conv: ConvolverNode; dry: GainNode; wet: GainNode; vol: GainNode } | null>(null);
  const player = useSourcePlayer('loudness', (ctx, input, output) => {
    const vol = ctx.createGain();
    const conv = ctx.createConvolver();
    conv.normalize = false;
    conv.buffer = firBuffer(ctx, compDb);
    const dry = ctx.createGain();
    const wet = ctx.createGain();
    dry.gain.value = comp ? 0 : 1;
    wet.gain.value = comp ? 1 : 0;
    vol.gain.value = dbToGain(listen - ref);
    input.connect(dry).connect(vol);
    input.connect(conv).connect(wet).connect(vol);
    // o reforço de graves pode passar de 0 dBFS: reduzimos 12 dB para manter margem
    const safety = ctx.createGain();
    safety.gain.value = dbToGain(-6);
    vol.connect(safety).connect(output);
    nodes.current = { conv, dry, wet, vol };
    return () => {
      nodes.current = null;
    };
  });

  useEffect(() => {
    const n = nodes.current;
    if (!n) return;
    const t = n.vol.context.currentTime;
    n.conv.buffer = firBuffer(n.conv.context, compDb);
    n.dry.gain.setTargetAtTime(comp ? 0 : 1, t, 0.03);
    n.wet.gain.setTargetAtTime(comp ? 1 : 0, t, 0.03);
    n.vol.gain.setTargetAtTime(dbToGain(listen - ref), t, 0.03);
  }, [compDb, comp, listen, ref]);

  const bass50 = compDb(50);
  const bass100 = compDb(100);

  return (
    <LabFrame
      title="Curvas de igual sonoridade (ISO 226)"
      description="Cada curva liga os níveis de pressão que soam igualmente altos em todas as frequências. Calculadas pelas equações da ISO 226:2003, de 20 Hz a 12,5 kHz."
      audio={tab === 'comp'}
      onReset={() => {
        setPhon(60);
        setRef(83);
        setListen(55);
        setComp(false);
      }}
      toolbar={
        <Segmented
          size="sm"
          value={tab}
          onChange={(v) => {
            player.stop();
            setTab(v);
          }}
          options={[
            { value: 'curves', label: 'Curvas' },
            { value: 'comp', label: 'Volume e equilíbrio' },
          ]}
        />
      }
    >
      <FreqPlot
        curves={curves}
        fMax={12500}
        dbMin={tab === 'curves' ? -10 : -6}
        dbMax={tab === 'curves' ? 130 : 30}
        dbStep={tab === 'curves' ? 10 : 6}
        height={300}
        yLabel={tab === 'curves' ? 'dB SPL' : 'dB'}
        ariaLabel="Curvas de igual sonoridade"
      />
      <div className="mt-2 mb-4">
        {tab === 'curves' ? (
          <Legend items={[{ label: `Curva de ${phon} fons`, color: 'var(--c-a)' }, { label: 'Outras curvas (20 a 90 fons)', color: 'var(--fg-faint)' }, { label: 'Limiar de audição', color: 'var(--c-diff)', dash: true }]} />
        ) : (
          <Legend items={[{ label: `Reforço para manter o equilíbrio de ${ref} fons ouvindo a ${listen} fons`, color: 'var(--c-a)' }]} />
        )}
      </div>
      {tab === 'curves' ? (
        <>
          <Controls cols={2}>
            <Slider label="Nível de sonoridade" value={phon} min={20} max={90} step={1} onChange={setPhon} unit="fons" />
          </Controls>
          <div className="mt-4">
            <Readout
              items={[
                { label: '1 kHz', value: `${fmtNum(iso226At(phon, 1000, selTable), 1)} dB SPL` },
                { label: '50 Hz', value: `${fmtNum(iso226At(phon, 50, selTable), 1)} dB SPL`, accent: true },
                { label: '3,15 kHz', value: `${fmtNum(iso226At(phon, 3150, selTable), 1)} dB SPL` },
                { label: 'Sonoridade', value: `${fmtNum(phonToSone(phon), 2)} sones` },
              ]}
            />
          </div>
          <Note>
            Em 50 Hz, a curva de 20 fons exige {fmtNum(iso226At(20, 50, tables[20]) - 20, 0)} dB a mais que em 1 kHz, mas a de 90 fons
            exige só {fmtNum(iso226At(90, 50, tables[90]) - 90, 0)} dB: as curvas se aproximam nos graves. Por isso, poucos decibéis a mais
            ou a menos de volume mudam muito a percepção dos graves. Frequências tabeladas: {ISO_F.length}, de 20 Hz a 12,5 kHz.
          </Note>
        </>
      ) : (
        <>
          <Controls cols={2}>
            <Slider label="Nível de referência (mixagem)" value={ref} min={60} max={90} step={1} onChange={setRef} unit="fons" hint="Estúdios costumam mixar entre ~79 e 85 dB SPL." />
            <Slider label="Nível em que você ouve" value={listen} min={30} max={90} step={1} onChange={setListen} unit="fons" />
          </Controls>
          <div className="mt-4 mb-4">
            <Readout
              items={[
                { label: 'Reforço necessário em 50 Hz', value: `${fmtNum(bass50, 1)} dB`, accent: true },
                { label: 'Reforço necessário em 100 Hz', value: `${fmtNum(bass100, 1)} dB` },
                { label: 'Diferença de volume', value: `${fmtNum(listen - ref, 0)} dB` },
              ]}
            />
          </div>
          <SourceBar player={player} extra={<Toggle checked={comp} onChange={setComp} label="Aplicar compensação" />} />
          <div className="mt-3">
            <Note>
              O áudio é atenuado pela diferença entre os níveis escolhidos (o nível absoluto depende do seu equipamento). Com a
              compensação ligada, um filtro FIR aplica a curva acima. Compare: em volume baixo, sem compensação, os graves parecem
              sumir — não porque o fone mudou, mas porque a sua audição mudou.
            </Note>
          </div>
        </>
      )}
    </LabFrame>
  );
}
