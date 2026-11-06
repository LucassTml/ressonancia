import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { LabFrame, Note } from '../../components/ui/LabFrame';
import { Segmented, fmtNum } from '../../components/ui/controls';
import { SourceBar } from '../../components/ui/audio';
import { FreqPlot, Legend } from '../../viz/FreqPlot';
import { interpCurve } from '../../audio/dsp';
import { useCurvePlayer } from '../../audio/useCurvePlayer';
import { harmanIE, signatureDb, signatures } from '../../data/targets';
import { describeDelta } from '../../content/perception';

export default function SignatureLab() {
  const [sel, setSel] = useState('v-shape');
  const [listen, setListen] = useState<'sig' | 'ref'>('sig');
  const [view, setView] = useState<'abs' | 'diff'>('abs');
  const sig = signatures.find((s) => s.id === sel)!;
  const harman = (f: number) => interpCurve(harmanIE.curve, f);
  const sigFn = useMemo(() => (f: number) => signatureDb(sig, f), [sig]);
  const diff = useMemo(() => (f: number) => sigFn(f) - harman(f), [sigFn]); // eslint-disable-line react-hooks/exhaustive-deps
  const { player } = useCurvePlayer('signatures', diff, listen === 'sig');
  const insights = useMemo(() => describeDelta(diff, 1.5), [diff]);

  return (
    <LabFrame
      title="Galeria de assinaturas sonoras"
      description="Curvas sintéticas que representam cada assinatura, desenhadas sobre o alvo Harman IE 2019. Ao ouvir, o áudio recebe a diferença entre a assinatura e o alvo; alterne para comparar."
      audio
      onReset={() => {
        setSel('v-shape');
        setListen('sig');
      }}
      toolbar={<Segmented size="sm" value={view} onChange={setView} options={[{ value: 'abs', label: 'Curvas' }, { value: 'diff', label: 'Desvio do alvo' }]} />}
      footer="Para ouvir a assinatura “de verdade”, seu fone precisaria estar perto do alvo Harman. Como ninguém sabe exatamente o que o seu fone faz, o que você ouve é a mudança relativa — que é justamente o que diferencia uma assinatura da outra."
    >
      <div className="flex flex-wrap gap-1.5 mb-4">
        {signatures.map((s) => (
          <button
            key={s.id}
            onClick={() => setSel(s.id)}
            className={`text-[12.5px] px-2.5 py-1 rounded-lg border transition-colors ${sel === s.id ? 'border-accent text-fg bg-accent-soft' : 'border-line text-muted hover:text-fg'}`}
          >
            {s.name}
          </button>
        ))}
      </div>
      <FreqPlot
        height={300}
        dbMin={view === 'abs' ? -12 : -12}
        dbMax={view === 'abs' ? 21 : 15}
        dbStep={3}
        curves={
          view === 'abs'
            ? [
                { id: 'h', label: 'Harman IE 2019', fn: harman, color: 'var(--c-target)', width: 1.5, dash: '5 4' },
                { id: 's', label: sig.name, fn: sigFn, color: 'var(--c-a)', width: 2.6 },
              ]
            : [{ id: 'd', label: `${sig.name} − alvo`, fn: diff, color: 'var(--c-a)', width: 2.4, fill: true }]
        }
        ariaLabel="Assinatura sonora sobre o alvo"
      />
      <div className="mt-2 mb-4">
        <Legend items={view === 'abs' ? [{ label: 'Harman IE 2019', color: 'var(--c-target)', dash: true }, { label: sig.name, color: 'var(--c-a)' }] : [{ label: 'Desvio do alvo', color: 'var(--c-a)' }]} />
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={sig.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          <p className="text-[14px] text-soft leading-relaxed">
            <strong className="text-fg">{sig.name}.</strong> {sig.description}
          </p>
          {insights.length > 0 && (
            <ul className="mt-2 space-y-1">
              {insights.map((it) => (
                <li key={it.band} className="text-[12.5px] text-muted leading-relaxed">
                  <span className="font-mono tabular mr-1.5">{it.delta > 0 ? '+' : '−'}{fmtNum(Math.abs(it.delta), 1)} dB</span>
                  {it.band}: {it.text}.
                </li>
              ))}
            </ul>
          )}
        </motion.div>
      </AnimatePresence>
      <div className="mt-5 flex flex-col gap-2">
        <Segmented
          size="sm"
          value={listen}
          onChange={setListen}
          options={[
            { value: 'sig', label: `Ouvir: ${sig.name}` },
            { value: 'ref', label: 'Ouvir: alvo (referência)' },
          ]}
        />
        <SourceBar player={player} />
      </div>
      <div className="mt-3">
        <Note>Troque de assinatura durante a reprodução: a mudança é instantânea. Ruído rosa revela o equilíbrio; música revela o caráter.</Note>
      </div>
    </LabFrame>
  );
}
