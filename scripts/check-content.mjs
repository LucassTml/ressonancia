// Verifica a integridade do conteúdo: artigos do manifesto com fonte, laboratórios referenciados e links internos.
import fs from 'node:fs';
import path from 'node:path';
const root = new URL('../src/', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const manifest = fs.readFileSync(path.join(root, 'content/manifest.ts'), 'utf8');
const labsSrc = fs.readFileSync(path.join(root, 'labs/index.ts'), 'utf8');
const labIds = new Set([...labsSrc.matchAll(/\{ id: '([^']+)'/g)].map((m) => m[1]));
const modules = [...manifest.matchAll(/id: '([a-z]+)',\s*\n\s*number:/g)].map((m) => m[1]);
const articles = [];
let cur = null;
for (const line of manifest.split('\n')) {
  const mm = line.match(/^\s{4}id: '([a-z]+)',$/);
  if (mm) cur = mm[1];
  const sm = line.match(/slug: '([^']+)'/);
  if (sm && cur) articles.push(`${cur}/${sm[1]}`);
}
const ids = new Set(articles);
let problems = 0;
for (const a of articles) {
  const f = path.join(root, 'content/articles', a + '.mdx');
  if (!fs.existsSync(f)) { console.log('SEM FONTE:', a); problems++; continue; }
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/<Lab id="([^"]+)"/g)) if (!labIds.has(m[1])) { console.log('LAB INEXISTENTE', m[1], 'em', a); problems++; }
  for (const m of src.matchAll(/\]\((\/[a-z-]+\/[a-z0-9-]+)\)/g)) if (!ids.has(m[1].slice(1))) { console.log('LINK QUEBRADO', m[1], 'em', a); problems++; }
  const words = src.replace(/<[^>]+>/g, ' ').split(/\s+/).length;
  console.log(String(words).padStart(5), a);
}
for (const m of manifest.matchAll(/labs: \[([^\]]*)\]/g)) for (const l of m[1].matchAll(/'([^']+)'/g)) if (!labIds.has(l[1])) { console.log('LAB DO MANIFESTO INEXISTENTE:', l[1]); problems++; }
for (const m of manifest.matchAll(/related: \[([^\]]*)\]/g)) for (const l of m[1].matchAll(/'([^']+)'/g)) if (!ids.has(l[1])) { console.log('RELACIONADO INEXISTENTE:', l[1]); problems++; }
const gl = fs.readFileSync(path.join(root, 'content/glossary.ts'), 'utf8');
for (const m of gl.matchAll(/see: '([^']+)'/g)) if (!ids.has(m[1])) { console.log('GLOSSÁRIO → artigo inexistente:', m[1]); problems++; }
for (const m of labsSrc.matchAll(/article: '([^']+)'/g)) if (!ids.has(m[1])) { console.log('LAB → artigo inexistente:', m[1]); problems++; }
console.log(`\n${articles.length} artigos, ${labIds.size} laboratórios, ${problems} problema(s).`);
process.exit(problems ? 1 : 0);
