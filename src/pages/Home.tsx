import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { allArticles, modules } from '../content/manifest';
import { labs } from '../labs';
import { IconArrowRight, IconFlask } from '../components/ui/controls';
import { useInView, usePrefersReducedMotion } from '../lib/hooks';

/** Linhas de onda que se somam suavemente — o motivo visual do site. */
function HeroWaves() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [wrapRef, inView] = useInView<HTMLDivElement>('0px');
  const reduced = usePrefersReducedMotion();
  const mouse = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const g = c.getContext('2d')!;
    let raf = 0;
    let t0 = performance.now();
    const draw = (now: number) => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = c.clientWidth, h = c.clientHeight;
      if (c.width !== w * dpr || c.height !== h * dpr) {
        c.width = w * dpr;
        c.height = h * dpr;
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      const styles = getComputedStyle(document.documentElement);
      const accent = styles.getPropertyValue('--accent').trim() || '#5fd4c0';
      const fg = styles.getPropertyValue('--fg-faint').trim() || '#666';
      const t = reduced ? 0 : (now - t0) / 1000;
      const lines = 14;
      for (let k = 0; k < lines; k++) {
        const p = k / (lines - 1);
        g.beginPath();
        for (let x = 0; x <= w; x += 3) {
          const u = x / w;
          const env = Math.sin(Math.PI * u) ** 1.5;
          const m = mouse.current;
          const near = Math.exp(-((u - m.x) ** 2) / 0.02);
          const y =
            h * (0.5 + (p - 0.5) * 0.5) +
            env *
              (h * 0.08 * Math.sin(u * 9 + t * 0.6 + p * 2.2) +
                h * 0.045 * Math.sin(u * 17 - t * 0.9 + p * 4) +
                h * 0.03 * near * Math.sin(u * 40 + t * 2.4));
          if (x === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        const center = 1 - Math.abs(p - 0.5) * 2;
        g.strokeStyle = k === Math.floor(lines / 2) ? accent : fg;
        g.globalAlpha = k === Math.floor(lines / 2) ? 0.9 : 0.12 + center * 0.22;
        g.lineWidth = k === Math.floor(lines / 2) ? 1.6 : 1;
        g.stroke();
      }
      g.globalAlpha = 1;
      if (!reduced && inView) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduced]);

  return (
    <div
      ref={wrapRef}
      className="absolute inset-0"
      onPointerMove={(e) => {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        mouse.current = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
      }}
    >
      <canvas ref={canvasRef} className="w-full h-full" aria-hidden />
    </div>
  );
}

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] as const },
});

export function Home() {
  useEffect(() => {
    document.title = 'Ressonância — enciclopédia interativa de áudio';
  }, []);
  const featured = allArticles.filter((a) => a.featured).slice(0, 8);
  const featuredLabs = labs.filter((l) => l.featured && !l.hidden).slice(0, 6);
  const total = allArticles.length;

  return (
    <div>
      <section className="relative overflow-hidden border-b border-line">
        <div className="absolute inset-0 opacity-90">
          <HeroWaves />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[var(--bg)] pointer-events-none" />
        <div className="absolute inset-y-0 left-0 w-full md:w-[62%] bg-gradient-to-r from-[var(--bg)] via-[color-mix(in_oklab,var(--bg)_70%,transparent)] to-transparent pointer-events-none" />
        <div className="relative mx-auto max-w-[1180px] px-4 sm:px-6 pt-24 sm:pt-32 pb-20 sm:pb-28 pointer-events-none">
          <motion.div {...fade(0.05)} className="text-[12px] uppercase tracking-[0.14em] font-semibold text-accent">
            Enciclopédia interativa de áudio
          </motion.div>
          <motion.h1
            {...fade(0.12)}
            className="mt-4 max-w-[17ch] text-[clamp(2.6rem,7vw,5rem)] leading-[1.02] font-semibold tracking-[-0.045em] text-balance"
          >
            Entenda o som antes de julgá-lo.
          </motion.h1>
          <motion.p {...fade(0.22)} className="mt-6 max-w-[58ch] text-[1.2rem] leading-relaxed text-soft font-serif text-pretty">
            Da física de uma onda de pressão à curva Harman, do tímpano ao DAC, da cóclea à ponteira do seu IEM. Artigos
            aprofundados, escritos como um livro, com laboratórios de áudio reais para ver e ouvir cada fenômeno.
          </motion.p>
          <motion.div {...fade(0.32)} className="mt-9 flex flex-wrap gap-3 pointer-events-auto">
            <Link
              to="/fundamentos/o-que-e-som"
              className="group inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-fg text-bg text-[14.5px] font-medium hover:opacity-90 transition-opacity"
            >
              Começar pelos fundamentos
              <IconArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              to="/laboratorio"
              className="inline-flex items-center gap-2 h-11 px-5 rounded-xl border border-line-strong text-[14.5px] font-medium hover:bg-sunken transition-colors bg-bg/60 backdrop-blur"
            >
              <IconFlask size={16} /> Abrir o laboratório
            </Link>
          </motion.div>
          <motion.dl {...fade(0.42)} className="mt-14 flex flex-wrap gap-x-10 gap-y-3 text-[13px] text-muted">
            <div>
              <dt className="inline text-fg font-semibold tabular">{modules.length}</dt> <dd className="inline">módulos</dd>
            </div>
            <div>
              <dt className="inline text-fg font-semibold tabular">{total}</dt> <dd className="inline">artigos</dd>
            </div>
            <div>
              <dt className="inline text-fg font-semibold tabular">{labs.filter((l) => !l.hidden).length}</dt>{' '}
              <dd className="inline">laboratórios interativos</dd>
            </div>
            <div>
              <dd className="inline">Sem cadastro, sem quizzes — só exploração</dd>
            </div>
          </motion.dl>
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-4 sm:px-6 py-20 sm:py-24">
        <div className="grid lg:grid-cols-[1fr_1.35fr] gap-12 lg:gap-20">
          <div>
            <h2 className="text-[clamp(1.7rem,3.2vw,2.3rem)] leading-[1.12] font-semibold tracking-[-0.03em] text-balance">
              Nove módulos, uma só ideia: explicar o porquê.
            </h2>
            <p className="mt-5 text-[1.05rem] leading-relaxed text-muted font-serif">
              Cada conceito é desenvolvido do intuitivo ao técnico — o que é, por que existe, como funciona, qual física está por trás,
              como visualizá-lo e ouvi-lo, por que importa e quais são os equívocos mais comuns. Os módulos se cruzam o tempo todo,
              porque o som também não respeita fronteiras entre disciplinas.
            </p>
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
                  <span className="text-[12px] text-faint pt-1 whitespace-nowrap">{m.articles.length} artigos</span>
                </Link>
              </motion.li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-y border-line bg-sunken/50">
        <div className="mx-auto max-w-[1180px] px-4 sm:px-6 py-20">
          <div className="flex items-end justify-between gap-6 mb-8">
            <h2 className="text-[clamp(1.5rem,2.8vw,2rem)] font-semibold tracking-[-0.03em]">Temas centrais</h2>
            <Link to="/artigos" className="text-[13.5px] text-muted hover:text-fg inline-flex items-center gap-1">
              Todos os artigos <IconArrowRight size={14} />
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
            <h2 className="text-[clamp(1.5rem,2.8vw,2rem)] font-semibold tracking-[-0.03em] text-balance">
              Laboratórios que fazem as contas de verdade
            </h2>
            <p className="mt-4 text-[1.02rem] leading-relaxed text-muted font-serif">
              Filtros biquad idênticos aos aplicados ao áudio, FIR de fase mínima, FFT em tempo real, ISO 226 calculada pela norma,
              reconstrução sinc de amostras. Abra um arquivo seu e equalize — tudo acontece no navegador.
            </p>
            <Link to="/laboratorio" className="mt-6 inline-flex items-center gap-1.5 text-[14px] text-accent hover:underline">
              Ver todos os laboratórios <IconArrowRight size={14} />
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
