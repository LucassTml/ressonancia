/**
 * Tradução aproximada de desvios de resposta em frequência para descrições
 * perceptivas, baseada no vocabulário usado em engenharia de áudio. São
 * tendências, não regras: a percepção depende do programa musical, do volume
 * e do ouvinte.
 */
interface Band {
  id: string;
  name: string;
  from: number;
  to: number;
  up: string;
  down: string;
}

export const BANDS: Band[] = [
  { id: 'sub', name: 'subgraves (20–60 Hz)', from: 20, to: 60, up: 'mais peso e “ronco”, sensação de pressão; em excesso, cansa e pode exigir muita excursão do driver', down: 'menos profundidade e impacto em músicas eletrônicas e trilhas' },
  { id: 'midbass', name: 'graves médios (60–250 Hz)', from: 60, to: 250, up: 'mais corpo e “punch”; em excesso, retumbante (boomy) e com graves que parecem lentos', down: 'som magro, com menos impacto e calor' },
  { id: 'lowmid', name: 'médios-graves (250–800 Hz)', from: 250, to: 800, up: 'mais densidade e calor; em excesso, embolado (muddy), com sensação de caixa fechada', down: 'som oco e distante, vozes sem corpo' },
  { id: 'mid', name: 'médios (800 Hz–2 kHz)', from: 800, to: 2000, up: 'vozes e instrumentos mais à frente; em excesso, anasalado ou “de buzina”', down: 'vozes recuadas, instrumentos menos definidos (comum em assinaturas em V)' },
  { id: 'presence', name: 'presença (2–5 kHz)', from: 2000, to: 5000, up: 'mais articulação e ataque; em excesso, gritado (shouty) e áspero, com fadiga rápida', down: 'som escuro e distante, “atrás de uma cortina”' },
  { id: 'treble', name: 'agudos (5–10 kHz)', from: 5000, to: 10000, up: 'mais brilho e detalhe aparente; em excesso, sibilância e pratos metálicos', down: 'som abafado, menos textura e brilho' },
  { id: 'air', name: '“ar” (10–20 kHz)', from: 10000, to: 20000, up: 'mais abertura e “ar”; picos estreitos aqui soam como aspereza fina', down: 'menos sensação de espaço (difícil de perceber para muitos adultos)' },
];

export function bandAverage(fn: (f: number) => number, from: number, to: number) {
  let s = 0;
  const n = 24;
  for (let i = 0; i < n; i++) s += fn(from * Math.pow(to / from, (i + 0.5) / n));
  return s / n;
}

export interface Insight {
  band: string;
  delta: number;
  text: string;
}

/** Lista as regiões em que `fn` (um desvio em dB) se afasta mais que `threshold`. */
export function describeDelta(fn: (f: number) => number, threshold = 1.5): Insight[] {
  const out: Insight[] = [];
  for (const b of BANDS) {
    const d = bandAverage(fn, b.from, b.to);
    if (Math.abs(d) >= threshold) out.push({ band: b.name, delta: d, text: d > 0 ? b.up : b.down });
  }
  // remove o nível médio: se tudo sobe junto, é só volume
  return out;
}

/** Acha o pico e o vale mais estreitos e significativos (para avisos sobre ressonâncias). */
export function findNarrowFeatures(fn: (f: number) => number) {
  const fs: number[] = [];
  for (let i = 0; i < 240; i++) fs.push(20 * Math.pow(1000, i / 239));
  const v = fs.map(fn);
  const res: { f: number; db: number; kind: 'pico' | 'vale' }[] = [];
  for (let i = 6; i < fs.length - 6; i++) {
    const local = (v[i - 6] + v[i + 6]) / 2;
    const d = v[i] - local;
    if (d > 3 && v[i] >= v[i - 1] && v[i] >= v[i + 1]) res.push({ f: fs[i], db: d, kind: 'pico' });
    if (d < -3 && v[i] <= v[i - 1] && v[i] <= v[i + 1]) res.push({ f: fs[i], db: d, kind: 'vale' });
  }
  return res.sort((a, b) => Math.abs(b.db) - Math.abs(a.db)).slice(0, 3);
}
