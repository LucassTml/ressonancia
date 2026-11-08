import type { AnchorHTMLAttributes } from 'react';
import { Link } from 'react-router-dom';
import { Callout, Figure, KeyNumbers, Lead, Ref, References, Term, Vars } from './Editorial';
import { Lab } from './LabEmbed';
import { Diagram, Formula, IemGallery, Listen } from './Learn';

function A({ href = '', children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  if (href.startsWith('/')) return <Link to={href}>{children}</Link>;
  if (href.startsWith('#')) return <a href={href} {...rest}>{children}</a>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
      {children}
    </a>
  );
}

/** Componentes disponíveis em todos os artigos MDX, sem necessidade de import. */
export const mdxComponents = {
  a: A,
  Callout,
  Figure,
  KeyNumbers,
  Lead,
  Ref,
  References,
  Term,
  Vars,
  Lab,
  Diagram,
  Formula,
  Listen,
  IemGallery,
};
