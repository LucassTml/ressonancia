/**
 * Curvas de igual sonoridade segundo a ISO 226:2003 (tabela e equações da
 * norma). Válida de 20 Hz a 12,5 kHz e de 20 a 90 fons (a norma informa
 * menor confiabilidade entre 90 e 100 fons; abaixo de 20, apenas indicativa).
 * A revisão ISO 226:2023 altera ligeiramente alguns valores.
 */
export const ISO_F = [20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500];
const AF = [0.532, 0.506, 0.48, 0.455, 0.432, 0.409, 0.387, 0.367, 0.349, 0.33, 0.315, 0.301, 0.288, 0.276, 0.267, 0.259, 0.253, 0.25, 0.246, 0.244, 0.243, 0.243, 0.243, 0.242, 0.242, 0.245, 0.254, 0.271, 0.301];
const LU = [-31.6, -27.2, -23.0, -19.1, -15.9, -13.0, -10.3, -8.1, -6.2, -4.5, -3.1, -2.0, -1.1, -0.4, 0.0, 0.3, 0.5, 0.0, -2.7, -4.1, -1.0, 1.7, 2.5, 1.2, -2.1, -7.1, -11.2, -10.7, -3.1];
const TF = [78.5, 68.7, 59.5, 51.1, 44.0, 37.5, 31.5, 26.5, 22.1, 17.9, 14.4, 11.4, 8.6, 6.2, 4.4, 3.0, 2.2, 2.4, 3.5, 1.7, -1.3, -4.2, -6.0, -5.4, -1.5, 6.0, 12.6, 13.9, 12.3];

/** Nível de pressão sonora (dB SPL) necessário em cada frequência tabelada para `phon` fons. */
export function iso226Table(phon: number) {
  return ISO_F.map((_, i) => {
    const Af = 4.47e-3 * (Math.pow(10, 0.025 * phon) - 1.15) + Math.pow(0.4 * Math.pow(10, (TF[i] + LU[i]) / 10 - 9), AF[i]);
    return (10 / AF[i]) * Math.log10(Af) - LU[i] + 94;
  });
}

/** Limiar de audição (campo livre) tabelado. */
export const ISO_THRESHOLD = TF;

/** Interpola em log-frequência. */
export function iso226At(phon: number, f: number, table = iso226Table(phon)) {
  if (f <= ISO_F[0]) return table[0];
  if (f >= ISO_F[ISO_F.length - 1]) return table[table.length - 1];
  let i = 1;
  while (ISO_F[i] < f) i++;
  const t = Math.log(f / ISO_F[i - 1]) / Math.log(ISO_F[i] / ISO_F[i - 1]);
  return table[i - 1] + (table[i] - table[i - 1]) * t;
}

export const phonToSone = (p: number) => (p >= 40 ? Math.pow(2, (p - 40) / 10) : Math.pow(p / 40, 2.642));
