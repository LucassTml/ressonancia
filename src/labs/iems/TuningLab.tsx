import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { LabFrame, Controls, Readout, Note } from '../../components/ui/LabFrame';
import { Button, Segmented, Slider, fmtHz, fmtNum } from '../../components/ui/controls';
import { FreqPlot, Legend } from '../../viz/FreqPlot';
import { biquadCoefs, biquadDb, interpCurve, logFreqs } from '../../audio/dsp';
import { harmanIE, harmanIENoBass } from '../../data/targets';
import { rmsError } from '../../audio/autoeq';

const FS = 96000;
const pk = (f: number, fc: number, g: number, q: number) => biquadDb(biquadCoefs({ id: '', type: 'peaking', freq: fc, gain: g, q }, FS), f, FS);
const ls = (f: number, fc: number, g: number) => biquadDb(biquadCoefs({ id: '', type: 'lowshelf', freq: fc, gain: g, q: 0.707 }, FS), f, FS);
const hs = (f: number, fc: number, g: number) => biquadDb(biquadCoefs({ id: '', type: 'highshelf', freq: fc, gain: g, q: 0.707 }, FS), f, FS);

/** Ferramentas de tuning de um IEM híbrido (1 DD + 1 BA), modelo didático. */
interface Tune {
  vent: number; // 0 = sem ventilação, 1 = ventilação grande (menos grave)
  ddDamper: number; // amortecimento traseiro do DD (controla o “volume” de médios-graves)
  cap: number; // capacitor do BA (µF): maior → BA entra mais cedo
  baDamper: number; // resistência acústica no tubo do BA (Ω acústicos, normalizado 0–1)
  tube: number; // comprimento do tubo do BA (mm)
  nozzle: number; // filtro de bocal (0 = aberto, 1 = mais denso)
}
const PROTO: Tune = { vent: 0.2, ddDamper: 0.1, cap: 1.5, baDamper: 0.1, tube: 14, nozzle: 0 };

function response(t: Tune) {
  const bassGain = 11 - t.vent * 16; // a ventilação reduz o shelf de grave
  const midBass = 3.5 - t.ddDamper * 5;
  const baEntry = 1 / (2 * Math.PI * 20 * t.cap * 1e-6); // corte RC do BA (≈20 Ω)
  const presence = 7 * (1 - Math.exp(-3000 / baEntry)) - 3; // quanto o BA contribui na presença
  const baPeak = 9 * (1 - t.baDamper);
  const tubeRes = 343 / (2 * (t.tube + 6) / 1000);
  return (f: number) =>
    interpCurve(harmanIENoBass.curve, f) +
    ls(f, 105, bassGain) +
    pk(f, 220, midBass, 0.9) +
    pk(f, 3000, presence, 1.1) +
    pk(f, 3600, baPeak - 3, 3.2) +
    pk(f, tubeRes, 5, 4) +
    hs(f, 7000, -t.nozzle * 6) +
    pk(f, 8000, -2, 2.5);
}

/** Variação de produção: tolerâncias de drivers, tubos e montagem. */
function unitVariation(seed: number) {
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647 - 0.5) * 2;
  const baSens = r() * 2;
  const ddSens = r() * 1;
  const tubeShift = 1 + r() * 0.05;
  const damp = r() * 1.5;
  return (f: number) => ls(f, 200, ddSens) + pk(f, 3500, baSens, 1) + pk(f, 8000 * tubeShift, damp, 3) - pk(f, 8000, damp * 0.6, 3);
}

export default function TuningLab() {
  const [t, setT] = useState<Tune>(PROTO);
  const set = <K extends keyof Tune>(k: K, v: Tune[K]) => setT((p) => ({ ...p, [k]: v }));
  const [stage, setStage] = useState<'tune' | 'qc'>('tune');
  const [batch, setBatch] = useState(1);
  const [tol, setTol] = useState(2);
  const resp = useMemo(() => response(t), [t]);
  const target = (f: number) => interpCurve(harmanIE.curve, f);
  const err = rmsError(resp, target, 20, 10000);

  const units = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const L = unitVariation(batch * 1000 + i * 2 + 1);
        const R = unitVariation(batch * 1000 + i * 2 + 2);
        const fs = logFreqs(80, 100, 8000);
        const devL = Math.max(...fs.map((f) => Math.abs(L(f))));
        const devR = Math.max(...fs.map((f) => Math.abs(R(f))));
        const lr = Math.max(...fs.map((f) => Math.abs(L(f) - R(f))));
        const pass = devL <= tol && devR <= tol && lr <= 1.5;
        return { L, R, pass, devL, devR, lr };
      }),
    [batch, tol],
  );
  const passed = units.filter((u) => u.pass).length;

  return (
    <LabFrame
      title="Tuning: do protótipo à linha de produção"
      description="Um IEM híbrido (1 driver dinâmico para graves, 1 BA para médios-agudos). Use as ferramentas de afinação para aproximar o protótipo do alvo; depois, aprove a curva e veja o controle de qualidade avaliar um lote de unidades."
      onReset={() => {
        setT(PROTO);
        setStage('tune');
      }}
      toolbar={
        <Segmented
          size="sm"
          value={stage}
          onChange={setStage}
          options={[
            { value: 'tune', label: '1. Afinar o protótipo' },
            { value: 'qc', label: '2. Controle de qualidade' },
          ]}
        />
      }
      footer="Modelo didático: cada ferramenta é representada pelo efeito típico que produz na resposta (ordens de grandeza realistas), não por uma simulação física completa. Em engenharia real, cada mudança é feita no protótipo e verificada numa nova medição."
    >
      <AnimatePresence mode="wait">
        {stage === 'tune' ? (
          <motion.div key="tune" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <FreqPlot
              height={290}
              dbMin={-12}
              dbMax={18}
              dbStep={3}
              curves={[
                { id: 't', label: 'Alvo (Harman IE 2019)', fn: target, color: 'var(--c-target)', width: 1.6, dash: '6 4' },
                { id: 'p', label: 'Protótipo', fn: resp, color: 'var(--c-a)', width: 2.6 },
              ]}
              ariaLabel="Resposta do protótipo e alvo"
            />
            <div className="mt-2 mb-4">
              <Legend items={[{ label: 'Alvo', color: 'var(--c-target)', dash: true }, { label: 'Protótipo', color: 'var(--c-a)' }]} />
            </div>
            <Controls cols={3}>
              <Slider label="Ventilação do DD" value={t.vent} min={0} max={1} step={0.01} onChange={(v) => set('vent', v)} format={(v) => `${Math.round(v * 100)}%`} hint="Mais ventilação: menos grave e menos pressão." />
              <Slider label="Damper traseiro do DD" value={t.ddDamper} min={0} max={1} step={0.01} onChange={(v) => set('ddDamper', v)} format={(v) => `${Math.round(v * 100)}%`} hint="Controla o volume de médios-graves." />
              <Slider label="Capacitor do BA (crossover)" value={t.cap} min={0.5} max={10} log onChange={(v) => set('cap', Number(v.toFixed(2)))} unit="µF" hint={`Corte ≈ ${fmtHz(1 / (2 * Math.PI * 20 * t.cap * 1e-6))}`} />
              <Slider label="Damper no tubo do BA" value={t.baDamper} min={0} max={1} step={0.01} onChange={(v) => set('baDamper', v)} format={(v) => `${Math.round(v * 100)}%`} hint="Doma a ressonância do BA." />
              <Slider label="Comprimento do tubo do BA" value={t.tube} min={4} max={20} step={0.5} onChange={(v) => set('tube', v)} unit="mm" hint={`Ressonância ≈ ${fmtHz(343 / (2 * (t.tube + 6) / 1000))}`} />
              <Slider label="Filtro de bocal" value={t.nozzle} min={0} max={1} step={0.01} onChange={(v) => set('nozzle', v)} format={(v) => (v < 0.05 ? 'aberto' : `${Math.round(v * 100)}%`)} hint="Malha mais densa: menos agudos." />
            </Controls>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Readout items={[{ label: 'Desvio do alvo (RMS, 20 Hz–10 kHz)', value: `${fmtNum(err, 2)} dB`, accent: true, hint: err < 1.2 ? 'pronto para aprovar' : err < 2.5 ? 'quase lá' : 'longe do alvo' }]} />
              <Button variant={err < 1.5 ? 'primary' : 'outline'} onClick={() => setStage('qc')}>
                Aprovar como amostra de referência →
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="qc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <FreqPlot
              height={290}
              dbMin={-6}
              dbMax={6}
              dbStep={1}
              fMin={100}
              fMax={10000}
              readout={false}
              regions={[{ from: 100, to: 8000, label: `janela de tolerância ±${tol} dB`, color: 'transparent' }]}
              curves={[
                { id: 'up', fn: () => tol, color: 'var(--c-diff)', width: 1.2, dash: '4 3' },
                { id: 'dn', fn: () => -tol, color: 'var(--c-diff)', width: 1.2, dash: '4 3' },
                ...units.flatMap((u, i) => [
                  { id: `l${i}`, fn: u.L, color: u.pass ? 'var(--c-a)' : 'var(--c-b)', width: 1, opacity: 0.7 },
                  { id: `r${i}`, fn: u.R, color: u.pass ? 'var(--c-a)' : 'var(--c-b)', width: 1, opacity: 0.4, dash: '2 2' },
                ]),
              ]}
              ariaLabel="Desvios de cada unidade em relação à amostra de referência"
            />
            <p className="text-[12px] text-muted mt-2">Desvio de cada fone (esquerdo: linha cheia; direito: tracejada) em relação à amostra de referência aprovada.</p>
            <div className="mt-4">
              <Controls cols={2}>
                <Slider label="Tolerância de resposta" value={tol} min={1} max={4} step={0.25} onChange={setTol} format={(v) => `±${fmtNum(v, 2)} dB`} hint="Casamento entre canais exigido: ≤ 1,5 dB." />
              </Controls>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Readout
                items={[
                  { label: 'Pares aprovados neste lote', value: `${passed} de ${units.length}`, accent: true },
                  { label: 'Pior casamento L/R', value: `${fmtNum(Math.max(...units.map((u) => u.lr)), 1)} dB` },
                ]}
              />
              <Button onClick={() => setBatch((b) => b + 1)}>Produzir outro lote</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="mt-4">
        <Note>
          {stage === 'tune'
            ? 'Cada ferramenta age numa região: ventilação e damper do DD nos graves; o capacitor decide onde o BA entra; o damper e o tubo do BA moldam presença e agudos; o filtro de bocal faz o ajuste final. Engenheiros iteram assim, medição após medição, até a curva convergir.'
            : 'Tolerâncias apertadas aumentam a consistência — e o custo, porque mais unidades (ou drivers) são reprovadas. Fabricantes também separam drivers por lotes de sensibilidade para montar pares bem casados.'}
        </Note>
      </div>
    </LabFrame>
  );
}
