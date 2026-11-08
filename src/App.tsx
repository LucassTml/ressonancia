import { useCallback, useEffect, useState } from 'react';
import { Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { TopBar } from './components/layout/TopBar';
import { MobileNav, Sidebar } from './components/layout/Sidebar';
import { SearchDialog } from './components/layout/SearchDialog';
import { Home } from './pages/Home';
import { ArticlePage } from './pages/ArticlePage';
import { ArticlesIndex, ModulePage } from './pages/ModulePage';
import { LabPage, LabsPage } from './pages/LabsPage';
import { GlossaryPage } from './pages/GlossaryPage';
import { FavoritesPage } from './pages/FavoritesPage';
import { NotFound } from './pages/NotFound';
import { stopAll } from './audio/engine';
import { Logo } from './components/layout/TopBar';
import { Link } from 'react-router-dom';
import { tr } from './i18n';

/** Layout de leitura: a barra lateral persiste; só o conteúdo transiciona. */
function DocLayout() {
  const location = useLocation();
  return (
    <div className="mx-auto max-w-[1480px] px-4 sm:px-6 flex gap-8 xl:gap-12">
      <Sidebar />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={location.pathname}
          className="min-w-0 flex-1 flex gap-8 xl:gap-12"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        >
          <Outlet />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

const DOC_EXCLUDE = new Set(['', 'laboratorio', 'glossario', 'favoritos']);

function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto max-w-[1180px] px-4 sm:px-6 py-10 flex flex-col sm:flex-row gap-6 sm:items-center justify-between text-[13px] text-muted">
        <div className="flex items-center gap-4">
          <Logo />
          <span className="hidden sm:inline text-faint">{tr("Física, percepção e engenharia do som.")}</span>
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2">
          <Link to="/artigos" className="hover:text-fg">{tr("Artigos")}</Link>
          <Link to="/laboratorio" className="hover:text-fg">{tr("Laboratório")}</Link>
          <Link to="/glossario" className="hover:text-fg">{tr("Glossário")}</Link>
          <Link to="/ciencia/avaliando-alegacoes" className="hover:text-fg">{tr("Fontes confiáveis")}</Link>
        </nav>
      </div>
      <p className="mx-auto max-w-[1180px] px-4 sm:px-6 pb-10 text-[11.5px] text-faint leading-relaxed">{tr("Curvas-alvo e medições de IEMs obtidas do projeto AutoEq (licença MIT); as medições de IEMs são de oratory1990. Curvas de “assinatura” são sintéticas e representativas. Nenhuma informação deste site substitui avaliação audiológica profissional.")}</p>
    </footer>
  );
}

export default function App() {
  const location = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((o) => !o);
      } else if (e.key === '/' && !(e.target as HTMLElement).closest('input,textarea,select,[contenteditable]')) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Para qualquer som ao trocar de página e volta ao topo
  useEffect(() => {
    stopAll();
    if (!location.hash) window.scrollTo({ top: 0 });
  }, [location.pathname, location.hash]);

  return (
    <MotionConfig reducedMotion="user">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[70] focus:px-3 focus:py-2 focus:rounded-lg focus:bg-elev"
      >{tr("Pular para o conteúdo")}</a>
      <TopBar onSearch={() => setSearchOpen(true)} onMenu={() => setMenuOpen(true)} />
      <MobileNav open={menuOpen} onClose={closeMenu} />
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
      <main id="conteudo" className="min-h-[calc(100vh-56px)]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={DOC_EXCLUDE.has(location.pathname.split('/')[1]) ? location.pathname : 'doc'}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <Routes location={location}>
              <Route path="/" element={<Home />} />

              <Route path="/laboratorio" element={<LabsPage />} />
              <Route path="/laboratorio/:lab" element={<LabPage />} />
              <Route path="/glossario" element={<GlossaryPage />} />
              <Route path="/favoritos" element={<FavoritesPage />} />
              <Route element={<DocLayout />}>
                <Route path="/artigos" element={<ArticlesIndex />} />
                <Route path="/:module" element={<ModulePage />} />
                <Route path="/:module/:slug" element={<ArticlePage />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer />
    </MotionConfig>
  );
}
