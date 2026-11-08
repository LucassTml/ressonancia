import { useMemo, useState } from 'react';
import { LabFrame, Note } from '../../components/ui/LabFrame';
import { Segmented, Toggle } from '../../components/ui/controls';
import { SourceBar } from '../../components/ui/audio';
import { FreqPlot, Legend, type PlotCurve } from '../../viz/FreqPlot';
import { interpCurve } from '../../audio/dsp';
import { useCurvePlayer } from '../../audio/useCurvePlayer';
import { TIERS, harmanAt, iemById, iems } from '../../data/iems';
import { tr } from '../../i18n';

const COLORS = ['var(--c-a)', 'var(--c-b)', 'var(--c-diff)', 'var(--c-target)'];

/** Compara IEMs reais (medições de oratory1990, mesmo equipamento) com o alvo. */
export default function IemExplorerLab({ initial = 'chu,ie900' }: { initial?: string }) {
  const [sel, setSel] = useState<string[]>(initial.split(','));
  const [view, setView] = useState<'abs' | 'diff'>('abs');
  const [listenId, setListenId] = useState<string>(initial.split(',')[0]);
  const [on, setOn] = useState(true);

  const toggle = (id: string) =>
    setSel((s) => {
      if (s.includes(id)) return s.filter((x) => x !== id);
      return s.length >= 4 ? [...s.slice(1), id] : [...s, id];
    });

  const chosen = sel.map((id) => iemById.get(id)!).filter(Boolean);
  const listen = iemById.get(listenId) ?? chosen[0];
  const diffFn = useMemo(() => (listen ? (f: number) => interpCurve(listen.curve, f) - harmanAt(f) : () => 0), [listen]);
  const { player } = useCurvePlayer('iem-explorer', diffFn, on);

  const curves: PlotCurve[] = [
    ...(view === 'abs' ? [{ id: 'h', label: 'Harman IE 2019', fn: harmanAt, color: 'var(--fg-faint)', width: 1.6, dash: '6 4' }] : []),
    ...chosen.map((m, i) => ({
      id: m.id,
      label: m.name,
      fn: view === 'abs' ? (f: number) => interpCurve(m.curve, f) : (f: number) => interpCurve(m.curve, f) - harmanAt(f),
      color: COLORS[i],
      width: 2.2,
    })),
  ];

  return (
    <LabFrame
      title={tr('Explorador de IEMs famosos')}
      description={tr('Medições reais, todas feitas no mesmo equipamento. Escolha até quatro modelos, compare com o alvo Harman e ouça a diferença aplicada à música.')}
      audio
      toolbar={<Segmented size="sm" value={view} onChange={setView} options={[{ value: 'abs', label: tr('Curvas') }, { value: 'diff', label: tr('Diferença do alvo') }]} />}
      onReset={() => setSel(initial.split(','))}
      footer={tr('Medições de oratory1990 (GRAS RA0045, acoplador IEC 60318-4) obtidas pelo projeto AutoEq e reduzidas a pontos de 1/12 de oitava. Cada curva é de uma unidade: a sua pode diferir alguns dB, sobretudo acima de 6 kHz. Preços e anos aproximados de lançamento.')}
    >
      <div className="space-y-2.5 mb-4">
        {TIERS.map((t) => (
          <div key={t.id} className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11.5px] text-muted w-[92px] shrink-0">{t.name}</span>
            {iems
              .filter((m) => m.tier === t.id)
              .map((m) => {
                const i = sel.indexOf(m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => toggle(m.id)}
                    aria-pressed={i >= 0}
                    className={`text-[12px] px-2 py-0.5 rounded-md border inline-flex items-center gap-1.5 transition-colors ${i >= 0 ? 'border-line-strong text-fg bg-sunken' : 'border-line text-muted hover:text-fg'}`}
                  >
                    {i >= 0 && <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i] }} />}
                    {m.name.replace('Truthear x Crinacle', 'Truthear')}
                  </button>
                );
              })}
          </div>
        ))}
      </div>
      <FreqPlot curves={curves} height={320} dbMin={view === 'abs' ? -15 : -15} dbMax={view === 'abs' ? 18 : 15} dbStep={3} ariaLabel={tr('Respostas em frequência de IEMs')} />
      <div className="mt-2 mb-4">
        <Legend items={curves.filter((c) => c.label).map((c) => ({ label: c.label!, color: c.color, dash: !!c.dash }))} />
      </div>
      <ul className="grid md:grid-cols-2 gap-x-6 gap-y-3">
        {chosen.map((m, i) => (
          <li key={m.id} className="text-[13px] leading-relaxed">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="w-2 h-2 rounded-full inline-block self-center" style={{ background: COLORS[i] }} />
              <strong className="text-fg font-semibold">{m.name}</strong>
              <span className="text-[12px] text-muted">{m.priceLabel} · {m.year} · {m.drivers}</span>
            </div>
            <p className="text-soft mt-0.5">{m.reading}</p>
          </li>
        ))}
      </ul>
      {chosen.length > 0 && (
        <div className="mt-5 pt-4 border-t border-line">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-[12.5px] text-muted">{tr('Ouvir o equilíbrio de:')}</span>
            <Segmented size="sm" value={listen?.id ?? ''} onChange={setListenId} options={chosen.map((m) => ({ value: m.id, label: m.name.split(' ').slice(-2).join(' ') }))} />
          </div>
          <SourceBar player={player} extra={<Toggle checked={on} onChange={setOn} label={on ? tr('Com a diferença') : tr('Sem a diferença')} />} />
          <div className="mt-2">
            <Note>{tr('O som passa pelo seu próprio fone. O que você ouve é a diferença entre este IEM e o alvo, aplicada ao seu fone: uma boa ideia do caráter, não uma cópia exata.')}</Note>
          </div>
        </div>
      )}
    </LabFrame>
  );
}
