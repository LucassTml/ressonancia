// Converte CSVs do projeto AutoEq (MIT, © Jaakko Pasanen) em pontos 1/12 de oitava.
import fs from 'node:fs';
const src = new URL('./targets-src/', import.meta.url);
const files = {
  harmanIE2019: 'Harman in-ear 2019.csv',
  harmanIE2019NoBass: 'Harman in-ear 2019 without bass.csv',
  harmanIE2017: 'Harman in-ear 2017-1.csv',
  harmanIE2016: 'Harman in-ear 2016.csv',
  harmanOE2018: 'Harman over-ear 2018.csv',
  df5128: 'Diffuse field 5128.csv',
  dfISO11904: 'Diffuse field ISO 11904-1.csv',
  delta711to5128: '711 5128 delta.csv',
};
const freqs = [];
for (let i = 0; ; i++) { const f = 20 * 2 ** (i / 12); if (f > 20001) break; freqs.push(f); }
const interp = (pts, f) => {
  if (f <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (pts[i][0] >= f) {
    const [f0, d0] = pts[i - 1], [f1, d1] = pts[i];
    return d0 + (d1 - d0) * Math.log(f / f0) / Math.log(f1 / f0);
  }
  return pts[pts.length - 1][1];
};
let out = `// Gerado por scripts/build-targets.mjs a partir dos dados do projeto AutoEq\n// (github.com/jaakkopasanen/AutoEq, licença MIT, © 2018-2022 Jaakko Pasanen).\n// Valores em dB, pontos a cada 1/12 de oitava de 20 Hz a 20 kHz.\n\nexport const TARGET_FREQS = [${freqs.map(f => +f.toFixed(2)).join(',')}];\n\n`;
for (const [k, file] of Object.entries(files)) {
  const pts = fs.readFileSync(new URL(file, src), 'utf8').trim().split(/\r?\n/).slice(1).map(l => l.split(',').map(Number));
  out += `export const ${k} = [${freqs.map(f => +interp(pts, f).toFixed(2)).join(',')}];\n`;
}
fs.writeFileSync(new URL('../src/data/targets.raw.ts', import.meta.url), out);
console.log('ok', freqs.length);
