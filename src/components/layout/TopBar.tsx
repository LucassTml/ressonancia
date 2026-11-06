import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { motion } from 'motion/react';
import { applyTheme, themeStore, useTheme, type Theme } from '../../lib/prefs';
import { IconMenu, IconMoon, IconSearch, IconSun } from '../ui/controls';

export function Logo() {
  return (
    <Link to="/" className="group flex items-center gap-2.5 shrink-0" aria-label="Ressonância — início">
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden className="shrink-0">
        <rect width="32" height="32" rx="8" fill="var(--fg)" />
        <path
          d="M4 16c2.5 0 2.5-8 5-8s2.5 16 5 16 2.5-12 5-12 2.5 8 5 8 2.5-4 4-4"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.4"
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-700 [stroke-dasharray:60] [stroke-dashoffset:0] group-hover:[stroke-dashoffset:120]"
        />
      </svg>
      <span className="text-[15px] font-semibold tracking-[-0.02em] text-fg">Ressonância</span>
    </Link>
  );
}

function ThemeToggle() {
  const theme = useTheme();
  const next: Record<Theme, Theme> = { dark: 'light', light: 'dark' };
  const label: Record<Theme, string> = { dark: 'Tema escuro', light: 'Tema claro' };
  // mostra o ícone do tema para o qual o botão vai mudar
  const Icon = theme === 'dark' ? IconSun : IconMoon;
  return (
    <button
      onClick={() => {
        const n = next[theme];
        themeStore.set(n);
        applyTheme(n);
      }}
      className="h-8 w-8 grid place-items-center rounded-lg text-muted hover:text-fg hover:bg-sunken transition-colors"
      title={theme === 'dark' ? 'Mudar para o tema claro' : 'Mudar para o tema escuro'}
      aria-label={`${label[theme]} ativo. Alternar tema`}
    >
      <motion.span key={theme} initial={{ rotate: -40, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} transition={{ duration: 0.3 }}>
        <Icon size={16} />
      </motion.span>
    </button>
  );
}

export function TopBar({ onSearch, onMenu }: { onSearch: () => void; onMenu: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  const nav = [
    { to: '/artigos', label: 'Artigos' },
    { to: '/laboratorio', label: 'Laboratório' },
    { to: '/glossario', label: 'Glossário' },
    { to: '/favoritos', label: 'Favoritos' },
  ];

  return (
    <header
      className={`sticky top-0 z-40 transition-[background-color,border-color,backdrop-filter] duration-300 border-b ${
        scrolled ? 'bg-[color-mix(in_oklab,var(--bg)_82%,transparent)] backdrop-blur-xl border-line' : 'bg-bg border-transparent'
      }`}
    >
      <div className="mx-auto max-w-[1480px] h-14 px-4 sm:px-6 flex items-center gap-4">
        <button
          onClick={onMenu}
          className="lg:hidden -ml-1 h-8 w-8 grid place-items-center rounded-lg text-muted hover:text-fg hover:bg-sunken"
          aria-label="Abrir navegação"
        >
          <IconMenu size={18} />
        </button>
        <Logo />
        <nav className="hidden md:flex items-center gap-1 ml-6" aria-label="Principal">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `relative px-3 py-1.5 text-[13.5px] rounded-lg transition-colors ${
                  isActive ? 'text-fg' : 'text-muted hover:text-fg'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-lg bg-sunken"
                      transition={{ type: 'spring', stiffness: 450, damping: 36 }}
                    />
                  )}
                  <span className="relative">{n.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={onSearch}
            className="flex items-center gap-2 h-8 pl-2.5 pr-2 rounded-lg border border-line text-muted hover:text-fg hover:border-line-strong transition-colors text-[13px]"
            aria-label="Buscar"
          >
            <IconSearch size={15} />
            <span className="hidden sm:inline">Buscar</span>
            <kbd className="hidden sm:inline text-[10.5px] font-mono px-1.5 py-[1px] rounded border border-line text-faint">
              {isMac ? '⌘' : 'Ctrl'} K
            </kbd>
          </button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
