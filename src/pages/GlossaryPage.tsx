import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { glossary } from '../content/glossary';
import { locale } from '../i18n';
import { articleById } from '../content/manifest';
import { IconSearch } from '../components/ui/controls';
import { tr } from '../i18n';

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export function GlossaryPage() {
  const [q, setQ] = useState('');
  const { hash } = useLocation();
  useEffect(() => {
    document.title = tr("Glossário — Ressonância");
  }, []);
  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(decodeURIComponent(hash.slice(1)));
    if (el) {
      setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 80);
      el.animate([{ backgroundColor: 'var(--accent-soft)' }, { backgroundColor: 'transparent' }], { duration: 1800, easing: 'ease-out' });
    }
  }, [hash]);

  const sorted = useMemo(() => [...glossary].sort((a, b) => a.term.localeCompare(b.term, locale)), []);
  const filtered = sorted.filter((g) => !q || norm(g.term + ' ' + g.def).includes(norm(q)));
  const groups = new Map<string, typeof filtered>();
  for (const g of filtered) {
    const L = norm(g.term[0]).toUpperCase();
    groups.set(L, [...(groups.get(L) ?? []), g]);
  }

  return (
    <div className="mx-auto max-w-[860px] px-4 sm:px-6 pt-12 sm:pt-16 pb-24">
      <h1 className="text-[clamp(2.1rem,4.6vw,3.1rem)] leading-[1.06] font-semibold tracking-[-0.034em]">{tr("Glossário")}</h1>
      <p className="mt-4 text-[1.1rem] text-muted font-serif max-w-[60ch]">
        {glossary.length}{' '}{tr("termos técnicos com definições curtas. Nos artigos, termos sublinhados com pontilhado mostram a definição ao passar o mouse ou tocar.")}</p>
      <div className="mt-8 sticky top-16 z-10 bg-bg/90 backdrop-blur py-2">
        <div className="flex items-center gap-2 h-11 rounded-xl border border-line-strong px-3.5 bg-elev focus-within:border-accent transition-colors">
          <IconSearch size={16} className="text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tr("Filtrar termos…")}
            className="flex-1 bg-transparent outline-none text-[14.5px]"
            aria-label={tr("Filtrar termos do glossário")}
          />
        </div>
      </div>
      <div className="mt-6 space-y-10">
        {[...groups.entries()].map(([letter, items]) => (
          <section key={letter}>
            <h2 className="font-mono text-[13px] text-accent mb-2">{letter}</h2>
            <dl className="border-t border-line">
              {items.map((g) => (
                <div key={g.id} id={g.id} className="grid sm:grid-cols-[220px_1fr] gap-x-6 gap-y-1 py-4 border-b border-line rounded-sm scroll-mt-32">
                  <dt className="text-[15px] font-medium text-fg">{g.term}</dt>
                  <dd className="text-[14.5px] leading-relaxed text-soft font-serif">
                    {g.def}
                    {g.see && articleById.get(g.see) && (
                      <Link to={`/${g.see}`} className="block mt-1.5 font-sans text-[12.5px] text-accent hover:underline">
                        → {articleById.get(g.see)!.title}
                      </Link>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
        {!filtered.length && <p className="text-muted">{tr("Nenhum termo corresponde a “")}{q}”.</p>}
      </div>
    </div>
  );
}
