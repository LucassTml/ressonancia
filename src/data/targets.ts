import type { Curve } from '../audio/dsp';
import { interpCurve, normalizeAt } from '../audio/dsp';
import * as raw from './targets.raw';
import { tr } from '../i18n';

export type Rig = '711' | '5128' | 'hats-oe';

export interface Target {
  id: string;
  name: string;
  short: string;
  rig: Rig;
  description: string;
  curve: Curve;
}

const zip = (vals: number[]): Curve => normalizeAt(raw.TARGET_FREQS.map((f, i) => [f, vals[i]]), 1000);

export const targets: Target[] = [
  {
    id: 'harman-ie-2019',
    name: tr("Harman In-Ear 2019 (v2)"),
    short: tr("Harman IE 2019"),
    rig: '711',
    description:
      tr("Alvo para IEMs derivado dos testes de preferência de Olive, Welti e Khonsaripour, com o grave refinado no estudo de 2019. Referenciado ao acoplador IEC 60318-4 (711)."),
    curve: zip(raw.harmanIE2019),
  },
  {
    id: 'harman-ie-2019-nobass',
    name: tr("Harman In-Ear 2019 sem shelf de grave"),
    short: tr("Harman IE sem grave"),
    rig: '711',
    description:
      tr("A mesma curva sem a elevação de graves. Aproxima o “equilíbrio de campo” sobre o qual a preferência por graves é adicionada."),
    curve: zip(raw.harmanIE2019NoBass),
  },
  {
    id: 'harman-ie-2017',
    name: tr("Harman In-Ear 2017"),
    short: tr("Harman IE 2017"),
    rig: '711',
    description: tr("Versão anterior do alvo intra-auricular, com mais energia em torno de 8–10 kHz e queda acentuada no extremo agudo."),
    curve: zip(raw.harmanIE2017),
  },
  {
    id: 'harman-ie-2016',
    name: tr("Harman In-Ear 2016"),
    short: tr("Harman IE 2016"),
    rig: '711',
    description: tr("Primeira versão pública do alvo intra-auricular da Harman."),
    curve: zip(raw.harmanIE2016),
  },
  {
    id: 'harman-oe-2018',
    name: tr("Harman Over-Ear 2018"),
    short: tr("Harman OE 2018"),
    rig: 'hats-oe',
    description:
      tr("Alvo para headphones circum-auriculares, medido em simulador de cabeça com orelha (GRAS 45CA/KEMAR). Não deve ser comparado diretamente a curvas de IEM em 711."),
    curve: zip(raw.harmanOE2018),
  },
  {
    id: 'df-5128',
    name: tr("Campo difuso (B&K 5128)"),
    short: tr("Campo difuso 5128"),
    rig: '5128',
    description:
      tr("Resposta de campo difuso medida no simulador de cabeça e tronco B&K 5128. É a referência de “som vindo de todas as direções igualmente”."),
    curve: zip(raw.df5128),
  },
  {
    id: 'df-iso11904',
    name: tr("Campo difuso ISO 11904"),
    short: tr("Campo difuso ISO 11904"),
    rig: '5128',
    description:
      tr("Média da transformação de campo difuso até o tímpano (ponto de referência do tímpano, DRP) em sujeitos humanos, conforme ISO 11904."),
    curve: zip(raw.dfISO11904),
  },
];

export const targetById = Object.fromEntries(targets.map((t) => [t.id, t]));

export const harmanIE = targetById['harman-ie-2019'];
export const harmanIENoBass = targetById['harman-ie-2019-nobass'];

export function targetDb(id: string, f: number) {
  return interpCurve(targetById[id].curve, f);
}

/**
 * Curvas sintéticas e representativas de assinaturas sonoras, construídas como
 * desvios do alvo Harman IE 2019 sem grave. NÃO são medições de produtos reais;
 * servem para visualizar e ouvir categorias.
 */
export type Signature = {
  id: string;
  name: string;
  description: string;
  /** desvio (dB) relativo ao Harman IE sem grave */
  delta: (f: number) => number;
};

const shelfLow = (f: number, fc: number, g: number) => g / (1 + Math.pow(f / fc, 2));
const shelfHigh = (f: number, fc: number, g: number) => g / (1 + Math.pow(fc / f, 2));
const bell = (f: number, fc: number, g: number, oct: number) =>
  g * Math.exp(-0.5 * Math.pow(Math.log2(f / fc) / (oct / 2.355), 2));

export const signatures: Signature[] = [
  {
    id: 'neutral',
    name: tr("Neutro (campo difuso)"),
    description: tr("Sem elevação de graves além do equilíbrio de campo difuso. Tende a soar magro para muitos ouvintes."),
    delta: () => 0,
  },
  {
    id: 'harman',
    name: tr("Harman (neutro com grave)"),
    description: tr("O equilíbrio preferido em média nos estudos da Harman: campo difuso modificado mais shelf de grave."),
    delta: (f) => interpCurve(harmanIE.curve, f) - interpCurve(harmanIENoBass.curve, f),
  },
  {
    id: 'warm',
    name: tr("Quente (warm)"),
    description: tr("Graves e médios-graves elevados, agudos levemente atenuados. Encorpado e macio."),
    delta: (f) => shelfLow(f, 220, 8) + bell(f, 250, 1.5, 2) - shelfHigh(f, 4500, 3),
  },
  {
    id: 'bright',
    name: tr("Brilhante (bright)"),
    description: tr("Médios-agudos e agudos acima do alvo. Destaca detalhes e ataques, mas pode cansar ou soar sibilante."),
    delta: (f) => shelfLow(f, 120, 3) + bell(f, 3500, 2.5, 1.6) + shelfHigh(f, 5000, 4),
  },
  {
    id: 'dark',
    name: tr("Escuro (dark)"),
    description: tr("Região de presença e agudos recuados. Relaxante, porém pode soar abafado e sem ar."),
    delta: (f) => shelfLow(f, 150, 8) - bell(f, 3000, 4, 1.8) - shelfHigh(f, 6000, 5),
  },
  {
    id: 'v-shape',
    name: tr("Em V (V-shaped)"),
    description: tr("Graves e agudos elevados, médios recuados. Empolgante; vozes e guitarras ficam mais atrás."),
    delta: (f) => shelfLow(f, 200, 10) - bell(f, 1500, 4, 2.4) + bell(f, 8000, 5, 1.6),
  },
  {
    id: 'u-shape',
    name: tr("Em U (U-shaped)"),
    description: tr("Como o V, mas com recuo mais suave e amplo nos médios."),
    delta: (f) => shelfLow(f, 160, 7) - bell(f, 1000, 2, 3.5) + shelfHigh(f, 7000, 3),
  },
  {
    id: 'mid-forward',
    name: tr("Médios à frente (mid-forward)"),
    description: tr("Médios-altos elevados em torno de 1–3 kHz. Vozes muito presentes; pode soar gritado (shouty)."),
    delta: (f) => shelfLow(f, 150, 3) + bell(f, 1800, 4, 1.8) - shelfHigh(f, 8000, 2),
  },
  {
    id: 'bass-head',
    name: tr("Grave pesado (bass-head)"),
    description: tr("Shelf de grave muito alto e largo, que invade os médios-graves. Impacto máximo, com risco de mascarar detalhes."),
    delta: (f) => shelfLow(f, 300, 15) + bell(f, 120, 2, 1.5),
  },
];

export const signatureById = Object.fromEntries(signatures.map((s) => [s.id, s]));

/** Curva absoluta (em domínio 711) de uma assinatura. */
export function signatureDb(sig: Signature, f: number) {
  return interpCurve(harmanIENoBass.curve, f) + sig.delta(f);
}

export const rigLabel: Record<Rig, string> = {
  '711': 'Acoplador IEC 60318-4 (711)',
  '5128': 'B&K 5128 / referência no tímpano',
  'hats-oe': 'Simulador de cabeça (over-ear)',
};
