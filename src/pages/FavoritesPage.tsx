import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { articleById } from '../content/manifest';
import { useFavorites } from '../lib/prefs';
import { IconBookmarkFilled, IconClose } from '../components/ui/controls';

export function FavoritesPage() {
  const { favorites, toggle } = useFavorites();
  useEffect(() => {
    document.title = 'Favoritos — Ressonância';
  }, []);
  const items = favorites.map((id) => articleById.get(id)).filter(Boolean);
  return (
    <div className="mx-auto max-w-[760px] px-4 sm:px-6 pt-12 sm:pt-16 pb-24">
      <h1 className="text-[clamp(2.1rem,4.6vw,3.1rem)] leading-[1.06] font-semibold tracking-[-0.034em]">Favoritos</h1>
      <p className="mt-4 text-[1.08rem] text-muted font-serif">
        Artigos que você salvou. Ficam guardados apenas neste navegador.
      </p>
      {items.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-line-strong px-6 py-12 text-center">
          <IconBookmarkFilled size={22} className="mx-auto text-faint" />
          <p className="mt-3 text-muted text-[14.5px]">
            Nenhum artigo salvo ainda. Use “Salvar nos favoritos” no topo de qualquer artigo.
          </p>
          <Link to="/artigos" className="mt-4 inline-block text-accent text-[14px] hover:underline">
            Ver todos os artigos
          </Link>
        </div>
      ) : (
        <ul className="mt-10 border-t border-line">
          <AnimatePresence initial={false}>
            {items.map((a) => (
              <motion.li
                key={a!.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, height: 0 }}
                className="border-b border-line flex items-start gap-3"
              >
                <Link to={`/${a!.id}`} className="group flex-1 py-4 min-w-0">
                  <span className="block text-[12px] text-muted">{a!.module.title}</span>
                  <span className="block text-[16px] font-medium text-fg group-hover:text-accent transition-colors">{a!.title}</span>
                  <span className="block text-[13.5px] text-muted mt-0.5 leading-relaxed">{a!.summary}</span>
                </Link>
                <button
                  onClick={() => toggle(a!.id)}
                  className="mt-4 h-8 w-8 grid place-items-center rounded-lg text-faint hover:text-fg hover:bg-sunken"
                  aria-label={`Remover ${a!.title} dos favoritos`}
                >
                  <IconClose size={15} />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
