import { tr } from '../i18n';
/**
 * Modelos elétricos simplificados de fones, para os laboratórios de
 * impedância. Valores representativos — não correspondem a produtos reais.
 */
export type Cx = [number, number];
export const cadd = (a: Cx, b: Cx): Cx => [a[0] + b[0], a[1] + b[1]];
export const cmul = (a: Cx, b: Cx): Cx => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
export const cdiv = (a: Cx, b: Cx): Cx => {
  const d = b[0] * b[0] + b[1] * b[1];
  return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
};
export const cabs = (a: Cx) => Math.hypot(a[0], a[1]);
export const cpar = (a: Cx, b: Cx): Cx => cdiv(cmul(a, b), cadd(a, b));

const w = (f: number) => 2 * Math.PI * f;
export const R = (r: number): Cx => [r, 0];
export const L = (l: number, f: number): Cx => [0, w(f) * l];
export const Cap = (c: number, f: number): Cx => [0, -1 / (w(f) * c)];

/** Impedância “motional” de um driver dinâmico (RLC paralelo equivalente). */
const motional = (f: number, fs: number, res: number, qms: number): Cx => cdiv([res, 0], [1, qms * (f / fs - fs / f)]);

/** Indutância “semi-indutiva” típica de BA (cresce mais devagar que ω). */
const baInductive = (f: number, k: number): Cx => {
  const m = k * Math.pow(f / 1000, 0.85);
  return [m * 0.35, m];
};

export interface PhoneModel {
  id: string;
  name: string;
  nominal: number;
  z: (f: number) => Cx;
  note: string;
}

export const PHONES: PhoneModel[] = [
  {
    id: 'dd',
    name: tr("IEM com 1 driver dinâmico"),
    nominal: 32,
    z: (f) => cadd(cadd(R(30), L(25e-6, f)), motional(f, 2800, 8, 1.4)),
    note: tr("Impedância quase constante, com um pequeno pico na ressonância mecânica."),
  },
  {
    id: 'ba',
    name: tr("IEM com 1 balanced armature"),
    nominal: 22,
    z: (f) => cadd(R(14), baInductive(f, 9)),
    note: tr("A indutância da bobina faz a impedância subir bastante nos agudos."),
  },
  {
    id: 'multi',
    name: tr("IEM multi-BA (3 vias, crossover passivo)"),
    nominal: 16,
    z: (f) => {
      const low = cadd(cadd(R(9), baInductive(f, 8)), L(0.4e-3, f));
      const mid = cadd(cadd(R(18), baInductive(f, 6)), Cap(22e-6, f));
      const high = cadd(cadd(R(12), baInductive(f, 2.5)), cadd(Cap(2.2e-6, f), R(2)));
      return cpar(cpar(low, mid), high);
    },
    note: tr("Os filtros do crossover criam vales e picos fortes: a impedância pode variar várias vezes ao longo do espectro."),
  },
  {
    id: 'planar',
    name: tr("IEM planar magnético"),
    nominal: 16,
    z: (f) => cadd(R(16), L(5e-6, f)),
    note: tr("Trilha plana com indutância desprezível: impedância praticamente resistiva e constante."),
  },
  {
    id: 'hp300',
    name: tr("Headphone dinâmico de 300 Ω"),
    nominal: 300,
    z: (f) => cadd(cadd(R(280), L(0.3e-3, f)), motional(f, 95, 220, 1.6)),
    note: tr("Alta impedância com o pico de ressonância nos graves típico de headphones dinâmicos."),
  },
];

export const phoneById = Object.fromEntries(PHONES.map((p) => [p.id, p]));

/** Desvio de resposta (dB) causado por uma impedância de saída, normalizado em 1 kHz. */
export function outputImpedanceDeviation(model: PhoneModel, zout: number) {
  const g = (f: number) => {
    const z = model.z(f);
    return 20 * Math.log10(cabs(z) / cabs(cadd(z, [zout, 0])));
  };
  const ref = g(1000);
  return (f: number) => g(f) - ref;
}
