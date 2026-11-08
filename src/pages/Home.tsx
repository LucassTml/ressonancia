import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { allArticles, modules } from '../content/manifest';
import { labs } from '../labs';
import { IconArrowRight, IconFlask, IconPlay, IconStop } from '../components/ui/controls';
import { HeroWave, useWaveSynth } from '../components/HeroWave';
import { tr } from '../i18n';

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] as const },
});

export function Home() {
  const synth = useWaveSynth();
  useEffect(() => {
    document.title = tr("Ressonância — enciclopédia interativa de áudio");
  }, []);
  const featured = allArticles.filter((a) => a.featured).slice(0, 8);
  const featuredLabs = labs.filter((l) => l.featured && !l.hidden).slice(0, 6);
  const total = allArticles.length;

  return (
    <div>
      <section className="relative overflow-hidden border-b border-line">
        <div className="absolute inset-0 opacity-90">
          <HeroWave synth={synth} />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[var(--bg)] pointer-events-none" />
        <div className="absolute inset-y-0 left-0 w-full md:w-[62%] bg-gradient-to-r from-[var(--bg)] via-[color-mix(in_oklab,var(--bg)_70%,transparent)] to-transparent pointer-events-none" />
        <div className="relative mx-auto max-w-[1180px] px-4 sm:px-6 pt-24 sm:pt-32 pb-20 sm:pb-28 pointer-events-none">
          <motion.div {...fade(0.05)} className="text-[12px] uppercase tracking-[0.14em] font-semibold text-accent">{tr("Enciclopédia interativa de áudio")}</motion.div>
          <motion.h1
            {...fade(0.12)}
            className="mt-4 max-w-[17ch] text-[clamp(2.6rem,7vw,5rem)] leading-[1.02] font-semibold tracking-[-0.045em] text-balance"
          >{tr("Entenda o som antes de julgá-lo.")}</motion.h1>
          <motion.p {...fade(0.22)} className="mt-6 max-w-[58ch] text-[1.2rem] leading-relaxed text-soft font-serif text-pretty">{tr("Da física de uma onda de pressão à curva Harman, do tímpano ao DAC, da cóclea à ponteira do seu IEM. Artigos aprofundados, escritos como um livro, com laboratórios de áudio reais para ver e ouvir cada fenômeno.")}</motion.p>
          <motion.div {...fade(0.32)} className="mt-9 flex flex-wrap gap-3 pointer-events-auto">
            <Link
              to="/inicio"
              className="group inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-fg text-bg text-[14.5px] font-medium hover:opacity-90 transition-opacity"
            >{tr("Comece aqui")}<IconArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              to="/laboratorio"
              className="inline-flex items-center gap-2 h-11 px-5 rounded-xl border border-line-strong text-[14.5px] font-medium hover:bg-sunken transition-colors bg-bg/60 backdrop-blur"
            >
              <IconFlask size={16} />{' '}{tr("Abrir o laboratório")}</Link>
            <button
              onClick={() => (synth.on ? synth.stop() : synth.start())}
              aria-pressed={synth.on}
              className={`inline-flex items-center gap-2 h-11 px-5 rounded-xl border text-[14.5px] font-medium transition-colors backdrop-blur ${synth.on ? 'border-accent text-accent bg-accent-soft' : 'border-line-strong bg-bg/60 hover:bg-sunken'}`}
            >
              {synth.on ? <IconStop size={13} /> : <IconPlay size={13} />} {synth.on ? tr('Desligar o som da onda') : tr('Tocar a onda')}
            </button>
          </motion.div>
          <motion.p {...fade(0.38)} className="mt-4 text-[13px] text-muted max-w-[52ch]">
            {synth.on ? tr('Mova o ponteiro sobre as ondas: para os lados muda a nota, para cima e para baixo muda o brilho. Clique para dedilhar.') : tr('A onda atrás deste texto é um instrumento: clique nela para ligar o som.')}
          </motion.p>
          <motion.dl {...fade(0.42)} className="mt-10 flex flex-wrap gap-x-10 gap-y-3 text-[13px] text-muted">
            <div>
              <dt className="inline text-fg font-semibold tabular">{modules.length}</dt> <dd className="inline">{tr("módulos")}</dd>
            </div>
            <div>
              <dt className="inline text-fg font-semibold tabular">{total}</dt> <dd className="inline">{tr("artigos")}</dd>
            </div>
            <div>
              <dt className="inline text-fg font-semibold tabular">{labs.filter((l) => !l.hidden).length}</dt>{' '}
              <dd className="inline">{tr("laboratórios interativos")}</dd>
            </div>
            <div>
              <dd className="inline">{tr("Sem cadastro, sem quizzes — só exploração")}</dd>
            </div>
          </motion.dl>
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-4 sm:px-6 py-20 sm:py-24">
        <div className="grid lg:grid-cols-[1fr_1.35fr] gap-12 lg:gap-20">
          <div>
            <h2 className="text-[clamp(1.7rem,3.2vw,2.3rem)] leading-[1.12] font-semibold tracking-[-0.03em] text-balance">{tr("Onze módulos, uma só ideia: explicar o porquê.")}</h2>
            <p className="mt-5 text-[1.05rem] leading-relaxed text-muted font-serif">{tr("Cada conceito é desenvolvido do intuitivo ao técnico — o que é, por que existe, como funciona, qual física está por trás, como visualizá-lo e ouvi-lo, por que importa e quais são os equívocos mais comuns. Os módulos se cruzam o tempo todo, porque o som também não respeita fronteiras entre disciplinas.")}</p>
          </div>
          <ol className="border-t border-line">
            {modules.map((m, i) => (
              <motion.li
                key={m.id}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.5, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                className="border-b border-line"
              >
                <Link to={`/${m.id}`} className="group grid grid-cols-[2.6rem_1fr_auto] gap-x-3 py-5 items-start">
                  <span className="font-mono text-[13px] text-faint tabular pt-0.5 group-hover:text-accent transition-colors">
                    {m.number}
                  </span>
                  <span>
                    <span className="block text-[17.5px] font-medium tracking-[-0.018em] text-fg">{m.title}</span>
                    <span className="block mt-1 text-[13.5px] leading-relaxed text-muted">{m.description}</span>
                  </span>
                  <span className="text-[12px] text-faint pt-1 whitespace-nowrap">{m.articles.length}{' '}{tr("artigos")}</span>
                </Link>
              </motion.li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-y border-line bg-sunken/50">
        <div className="mx-auto max-w-[1180px] px-4 sm:px-6 py-20">
          <div className="flex items-end justify-between gap-6 mb-8">
            <h2 className="text-[clamp(1.5rem,2.8vw,2rem)] font-semibold tracking-[-0.03em]">{tr("Temas centrais")}</h2>
            <Link to="/artigos" className="text-[13.5px] text-muted hover:text-fg inline-flex items-center gap-1">{tr("Todos os artigos")}{' '}<IconArrowRight size={14} />
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-10">
            {featured.map((a, i) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: (i % 4) * 0.06 }}
              >
                <Link to={`/${a.id}`} className="group block">
                  <div className="text-[11.5px] text-accent font-medium">{a.module.short}</div>
                  <div className="mt-1.5 text-[16.5px] leading-snug font-medium tracking-[-0.015em] text-fg group-hover:text-accent transition-colors text-balance">
                    {a.title}
                  </div>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-muted line-clamp-3">{a.summary}</p>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-4 sm:px-6 py-20">
        <div className="grid lg:grid-cols-[1fr_1.6fr] gap-12">
          <div>
            <h2 className="text-[clamp(1.5rem,2.8vw,2rem)] font-semibold tracking-[-0.03em] text-balance">{tr("Laboratórios que fazem as contas de verdade")}</h2>
            <p className="mt-4 text-[1.02rem] leading-relaxed text-muted font-serif">{tr("Filtros biquad idênticos aos aplicados ao áudio, FIR de fase mínima, FFT em tempo real, ISO 226 calculada pela norma, reconstrução sinc de amostras. Abra um arquivo seu e equalize — tudo acontece no navegador.")}</p>
            <Link to="/laboratorio" className="mt-6 inline-flex items-center gap-1.5 text-[14px] text-accent hover:underline">{tr("Ver todos os laboratórios")}{' '}<IconArrowRight size={14} />
            </Link>
          </div>
          <ul className="grid sm:grid-cols-2 gap-px rounded-2xl overflow-hidden border border-line bg-line">
            {featuredLabs.map((l) => (
              <li key={l.id} className="bg-bg">
                <Link to={`/laboratorio/${l.id}`} className="group block p-5 h-full hover:bg-elev transition-colors">
                  <div className="text-[15px] font-medium text-fg group-hover:text-accent transition-colors">{l.title}</div>
                  <p className="mt-1 text-[13px] text-muted leading-relaxed">{l.summary}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
