import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { allArticles } from '../../content/manifest';
import { glossary } from '../../content/glossary';
import { loadAllRaw } from '../../content/registry';
import { labs } from '../../labs';
import { IconBook, IconFlask, IconGlossary, IconSearch } from '../ui/controls';
import { tr } from '../../i18n';

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

interface Result {
  kind: 'artigo' | 'termo' | 'lab';
  title: string;
  sub: string;
  to: string;
  score: number;
  snippet?: string;
}

export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [raw, setRaw] = useState<Map<string, string> | null>(null);
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      setSel(0);
      setTimeout(() => inputRef.current?.focus(), 30);
      void loadAllRaw().then(setRaw);
    }
  }, [open]);

  const results = useMemo<Result[]>(() => {
    const terms = norm(q).split(/\s+/).filter((t) => t.length > 1);
    if (!terms.length) return [];
    const out: Result[] = [];
    for (const a of allArticles) {
      const t = norm(a.title), s = norm(a.summary);
      const body = raw?.get(a.id);
      const nb = body ? norm(body) : '';
      let score = 0;
      let all = true;
      for (const term of terms) {
        let ts = 0;
        if (t.includes(term)) ts += 12;
        if (s.includes(term)) ts += 4;
        if (nb) {
          let idx = nb.indexOf(term), c = 0;
          while (idx !== -1 && c < 30) {
            c++;
            idx = nb.indexOf(term, idx + term.length);
          }
          ts += Math.min(6, c * 0.6);
        }
        if (!ts) all = false;
        score += ts;
      }
      if (!all || !score) continue;
      let snippet: string | undefined;
      if (body) {
        const i = nb.indexOf(terms[0]);
        if (i >= 0) {
          const start = Math.max(0, i - 60);
          snippet = (start > 0 ? '…' : '') + body.slice(start, i + 110).trim() + '…';
        }
      }
      out.push({ kind: 'artigo', title: a.title, sub: a.module.title, to: `/${a.id}`, score, snippet });
    }
    for (const g of glossary) {
      const t = norm(g.term), d = norm(g.def);
      let score = 0, all = true;
      for (const term of terms) {
        const ts = (t.includes(term) ? 14 : 0) + (d.includes(term) ? 2 : 0);
        if (!ts) all = false;
        score += ts;
      }
      if (all && score) out.push({ kind: 'termo', title: g.term, sub: g.def, to: `/glossario#${g.id}`, score });
    }
    for (const l of labs) {
      const t = norm(l.title), d = norm(l.summary);
      let score = 0, all = true;
      for (const term of terms) {
        const ts = (t.includes(term) ? 10 : 0) + (d.includes(term) ? 3 : 0);
        if (!ts) all = false;
        score += ts;
      }
      if (all && score) out.push({ kind: 'lab', title: l.title, sub: l.summary, to: `/laboratorio/${l.id}`, score });
    }
    return out.sort((a, b) => b.score - a.score).slice(0, 24);
  }, [q, raw]);

  useEffect(() => setSel(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${sel}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  const go = (r: Result) => {
    onClose();
    setQ('');
    navigate(r.to);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[10vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div className="absolute inset-0 bg-black/45 backdrop-blur-[3px]" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={tr("Buscar")}
            initial={{ y: -10, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: -6, scale: 0.985, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-[640px] rounded-2xl border border-line bg-elev shadow-[var(--shadow-pop)] overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 h-14 border-b border-line">
              <IconSearch size={17} className="text-muted" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') onClose();
                  else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSel((s) => Math.min(results.length - 1, s + 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSel((s) => Math.max(0, s - 1));
                  } else if (e.key === 'Enter' && results[sel]) go(results[sel]);
                }}
                placeholder={tr("Buscar artigos, termos e laboratórios…")}
                className="flex-1 bg-transparent outline-none text-[15px] text-fg placeholder:text-faint"
                aria-label={tr("Termo de busca")}
              />
              <kbd className="text-[10.5px] font-mono px-1.5 py-[1px] rounded border border-line text-faint">{tr("Esc")}</kbd>
            </div>
            <ul ref={listRef} className="max-h-[56vh] overflow-y-auto p-2" role="listbox">
              {q && !results.length && <li className="px-3 py-6 text-center text-[13.5px] text-muted">{tr("Nada encontrado para “")}{q}”.</li>}
              {!q && (
                <li className="px-3 py-5 text-[13px] text-muted leading-relaxed">{tr("Experimente:")}{' '}<em>{tr("pinna gain")}</em>, <em>{tr("Harman")}</em>, <em>{tr("impedância")}</em>, <em>{tr("dither")}</em>, <em>{tr("planar")}</em>,{' '}
                  <em>{tr("ponteiras")}</em>, <em>{tr("válvula")}</em>…
                </li>
              )}
              {results.map((r, i) => {
                const Icon = r.kind === 'artigo' ? IconBook : r.kind === 'lab' ? IconFlask : IconGlossary;
                return (
                  <li key={r.kind + r.to} data-idx={i} role="option" aria-selected={i === sel}>
                    <button
                      onMouseMove={() => setSel(i)}
                      onClick={() => go(r)}
                      className={`w-full text-left flex gap-3 rounded-xl px-3 py-2.5 transition-colors ${i === sel ? 'bg-sunken' : ''}`}
                    >
                      <Icon size={16} className="mt-0.5 shrink-0 text-muted" />
                      <span className="min-w-0">
                        <span className="block text-[14px] text-fg font-medium leading-snug">{r.title}</span>
                        <span className="block text-[12.5px] text-muted leading-snug line-clamp-2 mt-0.5">{r.snippet ?? r.sub}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
