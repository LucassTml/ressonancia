import { Component, Suspense, type ReactNode } from 'react';
import { labById } from '../../labs';

class LabBoundary extends Component<{ children: ReactNode; title: string }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error)
      return (
        <div className="not-prose my-8 rounded-xl border border-line px-5 py-4 font-sans text-[13.5px] text-muted">
          Não foi possível carregar “{this.props.title}”. Seu navegador pode não suportar a Web Audio API ou o recurso necessário.
        </div>
      );
    return this.props.children;
  }
}

export function LabSkeleton() {
  return (
    <div className="not-prose bleed my-10 h-[380px] rounded-[18px] border border-line bg-elev overflow-hidden">
      <div className="h-full w-full animate-pulse bg-gradient-to-b from-transparent to-[var(--bg-sunken)]" />
    </div>
  );
}

/** Insere um laboratório pelo id dentro de um artigo MDX: <Lab id="wave" /> */
export function Lab({ id, ...props }: { id: string; [k: string]: unknown }) {
  const lab = labById.get(id);
  if (!lab) return null;
  const C = lab.component;
  return (
    <LabBoundary title={lab.title}>
      <Suspense fallback={<LabSkeleton />}>
        <C {...props} />
      </Suspense>
    </LabBoundary>
  );
}
