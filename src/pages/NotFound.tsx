import { Link } from 'react-router-dom';
import { tr } from '../i18n';

export function NotFound() {
  return (
    <div className="mx-auto max-w-[640px] px-6 py-32 text-center">
      <div className="font-mono text-[13px] text-faint">404</div>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">{tr("Silêncio por aqui")}</h1>
      <p className="mt-3 text-muted">{tr("Esta página não existe — ou foi cancelada por interferência destrutiva.")}</p>
      <Link to="/" className="mt-8 inline-block text-accent hover:underline">{tr("Voltar ao início")}</Link>
    </div>
  );
}
