import { motion } from 'motion/react';
import { FreqPlot } from '../../viz/FreqPlot';
import { interpCurve } from '../../audio/dsp';
import { harmanAt, iems, type Tier } from '../../data/iems';
import { tr } from '../../i18n';

/** Lista os IEMs de uma faixa de preço, cada um com sua curva sobre o alvo. */
export default function IemGallery({ tier }: { tier: Tier }) {
  return (
    <div className="not-prose my-8 font-sans space-y-10">
      {iems
        .filter((m) => m.tier === tier)
        .map((m) => (
          <motion.section
            key={m.id}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
              <h3 className="text-[18px] font-semibold tracking-[-0.015em] text-fg">{m.name}</h3>
              <span className="text-[12.5px] text-muted font-mono tabular">{m.priceLabel} · {m.year} · {m.drivers}</span>
            </div>
            <div className="mt-2 rounded-xl border border-line bg-elev p-3">
              <FreqPlot
                height={190}
                dbMin={-12}
                dbMax={18}
                dbStep={6}
                curves={[
                  { id: 'h', label: 'Harman IE 2019', fn: harmanAt, color: 'var(--fg-faint)', width: 1.4, dash: '6 4' },
                  { id: m.id, label: m.name, fn: (f) => interpCurve(m.curve, f), color: 'var(--c-a)', width: 2.2 },
                ]}
                ariaLabel={tr('Resposta em frequência de {0}', m.name)}
              />
            </div>
            <p className="mt-2 text-[14.5px] leading-relaxed text-soft"><strong className="text-fg font-semibold">{tr('Por que ficou famoso:')}</strong> {m.why}</p>
            <p className="mt-1 text-[14.5px] leading-relaxed text-soft"><strong className="text-fg font-semibold">{tr('O que a curva mostra:')}</strong> {m.reading}</p>
          </motion.section>
        ))}
    </div>
  );
}
