import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { modules } from '../../content/manifest';
import { hasArticleSource } from '../../content/registry';
import { IconChevron, IconClose } from '../ui/controls';
import { Logo } from './TopBar';
import { tr } from '../../i18n';

function SidebarTree({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const currentModule = pathname.split('/')[1];
  const [open, setOpen] = useState<Record<string, boolean>>(() => ({ [currentModule]: true }));

  useEffect(() => {
    setOpen((o) => (o[currentModule] ? o : { ...o, [currentModule]: true }));
  }, [currentModule]);

  return (
    <nav aria-label={tr("Módulos e artigos")} className="text-[13.5px]">
      <ul className="space-y-0.5">
        {modules.map((m) => {
          const isOpen = !!open[m.id];
          return (
            <li key={m.id}>
              <div className="flex items-center">
                <button
                  onClick={() => setOpen((o) => ({ ...o, [m.id]: !o[m.id] }))}
                  className="h-7 w-6 grid place-items-center text-faint hover:text-fg shrink-0"
                  aria-expanded={isOpen}
                  aria-label={`${isOpen ? 'Recolher' : 'Expandir'} ${m.title}`}
                >
                  <motion.span animate={{ rotate: isOpen ? 90 : 0 }} transition={{ duration: 0.2 }}>
                    <IconChevron size={13} />
                  </motion.span>
                </button>
                <NavLink
                  to={`/${m.id}`}
                  end
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `flex-1 min-w-0 flex items-baseline gap-2 py-1 pr-2 rounded-md transition-colors ${
                      isActive || currentModule === m.id ? 'text-fg' : 'text-muted hover:text-fg'
                    }`
                  }
                >
                  <span className="font-mono text-[10.5px] text-faint tabular">{m.number}</span>
                  <span className="truncate font-medium">{m.short}</span>
                </NavLink>
              </div>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.ul
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden ml-[11px] pl-3 border-l border-line"
                  >
                    {m.articles.map((a) => {
                      const id = `${m.id}/${a.slug}`;
                      const available = hasArticleSource(id);
                      return (
                        <li key={a.slug}>
                          <NavLink
                            to={`/${id}`}
                            onClick={onNavigate}
                            className={({ isActive }) =>
                              `relative block py-[5px] pr-2 leading-snug text-[13px] transition-colors ${
                                isActive ? 'text-fg font-medium' : available ? 'text-muted hover:text-fg' : 'text-faint'
                              }`
                            }
                          >
                            {({ isActive }) => (
                              <>
                                {isActive && (
                                  <motion.span
                                    layoutId="sidebar-active"
                                    className="absolute -left-[13px] top-1 bottom-1 w-[2px] rounded bg-accent"
                                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                                  />
                                )}
                                {a.title}
                              </>
                            )}
                          </NavLink>
                        </li>
                      );
                    })}
                  </motion.ul>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ul>
      <div className="mt-6 pt-4 border-t border-line space-y-0.5">
        {[
          ['/laboratorio', tr("Laboratório")],
          ['/glossario', tr("Glossário")],
          ['/favoritos', tr("Favoritos")],
        ].map(([to, label]) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              `block pl-6 py-1 rounded-md ${isActive ? 'text-fg font-medium' : 'text-muted hover:text-fg'}`
            }
          >
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden lg:block w-[268px] shrink-0">
      <div className="sticky top-14 h-[calc(100vh-56px)] overflow-y-auto py-8 pr-4 pl-1">
        <SidebarTree />
      </div>
    </aside>
  );
}

export function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { pathname } = useLocation();
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={tr("Navegação")}
            className="fixed inset-y-0 left-0 z-50 w-[min(320px,86vw)] bg-bg border-r border-line overflow-y-auto px-4 pb-10 lg:hidden"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 40 }}
          >
            <div className="h-14 flex items-center justify-between">
              <Logo />
              <button onClick={onClose} className="h-8 w-8 grid place-items-center rounded-lg text-muted hover:text-fg" aria-label={tr("Fechar")}>
                <IconClose size={18} />
              </button>
            </div>
            <div className="mt-2">
              <Link to="/artigos" className="block pl-6 py-1 text-muted hover:text-fg text-[13.5px] mb-2">{tr("Todos os artigos")}</Link>
              <SidebarTree onNavigate={onClose} />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
