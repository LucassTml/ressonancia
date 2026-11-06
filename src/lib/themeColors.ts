import { useEffect, useState } from 'react';

export interface ThemeColors {
  fg: string;
  soft: string;
  muted: string;
  faint: string;
  line: string;
  lineStrong: string;
  bg: string;
  elev: string;
  sunken: string;
  accent: string;
  a: string;
  b: string;
  target: string;
  diff: string;
  grid: string;
  gridStrong: string;
  warn: string;
}

function read(): ThemeColors {
  const s = getComputedStyle(document.documentElement);
  const v = (n: string) => s.getPropertyValue(n).trim();
  return {
    fg: v('--fg'),
    soft: v('--fg-soft'),
    muted: v('--fg-muted'),
    faint: v('--fg-faint'),
    line: v('--line'),
    lineStrong: v('--line-strong'),
    bg: v('--bg'),
    elev: v('--bg-elev'),
    sunken: v('--bg-sunken'),
    accent: v('--accent'),
    a: v('--c-a'),
    b: v('--c-b'),
    target: v('--c-target'),
    diff: v('--c-diff'),
    grid: v('--c-grid'),
    gridStrong: v('--c-grid-strong'),
    warn: v('--warn'),
  };
}

/** Cores do tema atual para desenho em canvas; atualiza ao trocar de tema. */
export function useThemeColors() {
  const [colors, setColors] = useState<ThemeColors>(() => read());
  useEffect(() => {
    const update = () => setColors(read());
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, []);
  return colors;
}

/** Prepara um canvas para alta densidade de pixels e devolve o contexto 2D. */
export function setupCanvas(c: HTMLCanvasElement) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = c.clientWidth, h = c.clientHeight;
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
  }
  const g = c.getContext('2d')!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { g, w, h };
}

export function withAlpha(color: string, alpha: number) {
  // aceita #rrggbb
  if (color.startsWith('#') && color.length === 7) {
    const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
    return color + a;
  }
  return color;
}
