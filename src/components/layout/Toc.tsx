import { useEffect, useState, type RefObject } from 'react';
import { motion, useScroll, useSpring } from 'motion/react';

interface Heading {
  id: string;
  text: string;
  level: number;
}

/** Sumário lateral que acompanha a leitura e destaca a seção atual. */
export function Toc({ containerRef, deps }: { containerRef: RefObject<HTMLElement>; deps: unknown }) {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const collect = () => {
      const hs = Array.from(el.querySelectorAll<HTMLElement>('.prose > h2[id], .prose > h3[id]')).map((h) => ({
        id: h.id,
        text: h.textContent ?? '',
        level: h.tagName === 'H2' ? 2 : 3,
      }));
      setHeadings(hs);
    };
    collect();
    const mo = new MutationObserver(collect);
    mo.observe(el, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [containerRef, deps]);

  useEffect(() => {
    if (!headings.length) return;
    const onScroll = () => {
      let current: string | null = null;
      for (const h of headings) {
        const node = document.getElementById(h.id);
        if (node && node.getBoundingClientRect().top < 140) current = h.id;
      }
      setActive(current ?? headings[0].id);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [headings]);

  if (headings.length < 2) return null;
  return (
    <nav aria-label="Nesta página" className="text-[12.5px]">
      <div className="text-[11px] uppercase tracking-[0.12em] font-semibold text-faint mb-3">Nesta página</div>
      <ul className="space-y-0.5 border-l border-line">
        {headings.map((h) => {
          const isActive = h.id === active;
          return (
            <li key={h.id} className="relative">
              {isActive && (
                <motion.span
                  layoutId="toc-active"
                  className="absolute -left-px top-0.5 bottom-0.5 w-[2px] rounded bg-accent"
                  transition={{ type: 'spring', stiffness: 500, damping: 42 }}
                />
              )}
              <a
                href={`#${h.id}`}
                data-active={isActive}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  history.replaceState(null, '', `#${h.id}`);
                }}
                className={`toc-link block py-1 leading-snug transition-colors ${h.level === 3 ? 'pl-6' : 'pl-3'} ${
                  isActive ? 'text-fg' : 'text-muted hover:text-fg'
                }`}
              >
                {h.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function ReadingProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 200, damping: 40, restDelta: 0.001 });
  return <motion.div className="fixed top-14 left-0 right-0 h-[2px] bg-accent origin-left z-40 opacity-70" style={{ scaleX }} />;
}
