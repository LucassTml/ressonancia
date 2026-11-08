/**
 * Plugin rehype: envolve a primeira ocorrência de cada termo do glossário,
 * em cada artigo, no componente <Term id="…">, que mostra a definição
 * contextual ao passar o mouse ou tocar. Ignora títulos, links, código,
 * fórmulas e o interior de outros componentes de figura/laboratório.
 */

/** [padrão, id do glossário] — padrões mais longos primeiro. */
const TERMS = [
  ['impedância de saída', 'impedancia-saida'],
  ['frequência de Nyquist', 'nyquist'],
  ['profundidade de inserção', 'insercao'],
  ['ressonador(?:es)? de Helmholtz', 'helmholtz'],
  ['resposta em frequência', 'resposta-em-frequencia'],
  ['curvas? de igual sonoridade', 'iso226'],
  ['comprimentos? de onda', 'comprimento-de-onda'],
  ['ondas? longitudinal(?:is)?', 'onda-longitudinal'],
  ['membrana basilar', 'membrana-basilar'],
  ['células ciliadas', 'celulas-ciliadas'],
  ['bandas? críticas?', 'banda-critica'],
  ['campo difuso', 'campo-difuso'],
  ['campo livre', 'campo-livre'],
  ['curva Harman', 'harman'],
  ['bass shelf|shelf de graves?', 'bass-shelf'],
  ['acoplador 711|IEC 60318-4', 'acoplador-711'],
  ['B&K 5128', 'bk5128'],
  ['balanced armatures?', 'ba'],
  ['drivers? dinâmicos?', 'dd'],
  ['planar(?:es)? magnéticos?', 'planar'],
  ['pré-amplificador(?:es)?', 'pre-amplificador'],
  ['faixa dinâmica', 'faixa-dinamica'],
  ['fase mínima', 'fase-minima'],
  ['ruído rosa', 'ruido-rosa'],
  ['palco sonoro|soundstage', 'soundstage'],
  ['imagem estéreo', 'imagem'],
  ['teste ABX|ABX', 'abx'],
  ['viés de expectativa', 'vies-expectativa'],
  ['guerra do volume', 'loudness-war'],
  ['true peak', 'true-peak'],
  ['fator Q', 'q'],
  ['pinna gain', 'pinna-gain'],
  ['cóclea', 'coclea'],
  ['mascaramento', 'mascaramento'],
  ['HRTFs?', 'hrtf'],
  ['ITD', 'itd'],
  ['ILD', 'ild'],
  ['sibilância', 'sibilancia'],
  ['suavização', 'suavizacao'],
  ['crossovers?', 'crossover'],
  ['dampers?', 'damper'],
  ['reatância', 'reatancia'],
  ['impedância', 'impedancia'],
  ['sensibilidade', 'sensibilidade'],
  ['headroom', 'headroom'],
  ['clipping', 'clipping'],
  ['THD', 'thd'],
  ['intermodulação|IMD', 'imd'],
  ['jitter', 'jitter'],
  ['aliasing', 'aliasing'],
  ['dither', 'dither'],
  ['quantização', 'quantizacao'],
  ['LUFS', 'lufs'],
  ['preamp', 'preamp'],
  ['crossfeed', 'crossfeed'],
  ['vedação', 'vedacao'],
  ['ponteiras?', 'ponteira'],
  ['dB SPL', 'spl'],
  ['dBFS', 'dbfs'],
  ['dBV', 'dbv'],
  ['dBu', 'dbu'],
  ['harmônicos', 'harmonico'],
  ['timbre', 'timbre'],
  ['formantes?', 'formante'],
  ['sones?', 'sone'],
  ['RMS', 'rms'],
  ['excursão', 'excursao'],
  ['tuning', 'tuning'],
  ['DSD', 'dsd'],
  ['PCM', 'pcm'],
  ['lossless', 'lossless'],
  ['bitrate', 'bitrate'],
  ['eletrostáticos?', 'est'],
  ['compressor', 'compressor'],
  ['oitavas?', 'oitava'],
  ['espectro', 'espectro'],
  ['FFT', 'fft'],
  ['pina', 'pinna'],
  ['concha', 'concha'],
  ['semitons?', 'semitom'],
  ['escalas? logarítmicas?', 'escala-log'],
];

/** Mesmos termos para os artigos em inglês. */
const TERMS_EN = [
  ['output impedance', 'impedancia-saida'],
  ['Nyquist frequency', 'nyquist'],
  ['insertion depth', 'insercao'],
  ['Helmholtz resonators?', 'helmholtz'],
  ['frequency response', 'resposta-em-frequencia'],
  ['equal[- ]loudness (?:contours?|curves?)', 'iso226'],
  ['wavelengths?', 'comprimento-de-onda'],
  ['longitudinal waves?', 'onda-longitudinal'],
  ['basilar membrane', 'membrana-basilar'],
  ['hair cells', 'celulas-ciliadas'],
  ['critical bands?', 'banda-critica'],
  ['diffuse[- ]field', 'campo-difuso'],
  ['free[- ]field', 'campo-livre'],
  ['Harman curve', 'harman'],
  ['bass shelf', 'bass-shelf'],
  ['711 coupler|IEC 60318-4', 'acoplador-711'],
  ['B&K 5128', 'bk5128'],
  ['balanced armatures?', 'ba'],
  ['dynamic drivers?', 'dd'],
  ['planar magnetics?', 'planar'],
  ['preamplifiers?', 'pre-amplificador'],
  ['dynamic range', 'faixa-dinamica'],
  ['minimum[- ]phase', 'fase-minima'],
  ['pink noise', 'ruido-rosa'],
  ['soundstage', 'soundstage'],
  ['stereo imag(?:e|ing)', 'imagem'],
  ['ABX test|ABX', 'abx'],
  ['expectation bias', 'vies-expectativa'],
  ['loudness war', 'loudness-war'],
  ['true peak', 'true-peak'],
  ['Q factor', 'q'],
  ['pinna gain', 'pinna-gain'],
  ['cochlea', 'coclea'],
  ['masking', 'mascaramento'],
  ['HRTFs?', 'hrtf'],
  ['ITD', 'itd'],
  ['ILD', 'ild'],
  ['sibilance', 'sibilancia'],
  ['smoothing', 'suavizacao'],
  ['crossovers?', 'crossover'],
  ['dampers?', 'damper'],
  ['reactance', 'reatancia'],
  ['impedance', 'impedancia'],
  ['sensitivity', 'sensibilidade'],
  ['headroom', 'headroom'],
  ['clipping', 'clipping'],
  ['THD', 'thd'],
  ['intermodulation|IMD', 'imd'],
  ['jitter', 'jitter'],
  ['aliasing', 'aliasing'],
  ['dither', 'dither'],
  ['quantization', 'quantizacao'],
  ['LUFS', 'lufs'],
  ['preamp', 'preamp'],
  ['crossfeed', 'crossfeed'],
  ['seal', 'vedacao'],
  ['eartips?', 'ponteira'],
  ['dB SPL', 'spl'],
  ['dBFS', 'dbfs'],
  ['dBV', 'dbv'],
  ['dBu', 'dbu'],
  ['harmonics', 'harmonico'],
  ['timbre', 'timbre'],
  ['formants?', 'formante'],
  ['sones?', 'sone'],
  ['RMS', 'rms'],
  ['excursion', 'excursao'],
  ['tuning', 'tuning'],
  ['DSD', 'dsd'],
  ['PCM', 'pcm'],
  ['lossless', 'lossless'],
  ['bitrate', 'bitrate'],
  ['electrostatics?', 'est'],
  ['compressor', 'compressor'],
  ['octaves?', 'oitava'],
  ['spectrum', 'espectro'],
  ['FFT', 'fft'],
  ['pinna', 'pinna'],
  ['concha', 'concha'],
  ['semitones?', 'semitom'],
  ['logarithmic scales?', 'escala-log'],
];

const SKIP_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'code', 'pre', 'button', 'th', 'thead']);
const SKIP_COMPONENTS = new Set(['Term', 'Lab', 'References', 'Ref', 'Vars', 'KeyNumbers', 'Figure', 'Formula', 'Diagram', 'Listen', 'IemGallery']);

const compile = (list) => list.map(([pat, id]) => ({ id, re: new RegExp(`(?<![\\p{L}\\d-])(?:${pat})(?![\\p{L}\\d-])`, 'iu') }));
const compiledPt = compile(TERMS);
const compiledEn = compile(TERMS_EN);

export default function rehypeGlossary() {
  return (tree, file) => {
    const compiled = String(file?.path ?? '').replace(/\\/g, '/').includes('/articles-en/') ? compiledEn : compiledPt;
    const used = new Set();

    const walk = (node) => {
      if (!node.children) return;
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        if (child.type === 'element') {
          if (SKIP_TAGS.has(child.tagName)) continue;
          const cls = child.properties?.className;
          if (Array.isArray(cls) && cls.some((c) => String(c).includes('math'))) continue;
          walk(child);
        } else if (child.type === 'mdxJsxFlowElement' || child.type === 'mdxJsxTextElement') {
          if (SKIP_COMPONENTS.has(child.name)) continue;
          walk(child);
        } else if (child.type === 'text') {
          const replaced = linkText(child.value);
          if (replaced) {
            node.children.splice(i, 1, ...replaced);
            i += replaced.length - 1;
          }
        }
      }
    };

    /** Divide um texto na primeira ocorrência ainda não usada de algum termo. */
    const linkText = (text) => {
      let best = null;
      for (const t of compiled) {
        if (used.has(t.id)) continue;
        const m = t.re.exec(text);
        if (m && (!best || m.index < best.index)) best = { index: m.index, len: m[0].length, id: t.id, str: m[0] };
      }
      if (!best) return null;
      used.add(best.id);
      const before = text.slice(0, best.index);
      const after = text.slice(best.index + best.len);
      const out = [];
      if (before) out.push({ type: 'text', value: before });
      out.push({
        type: 'mdxJsxTextElement',
        name: 'Term',
        attributes: [{ type: 'mdxJsxAttribute', name: 'id', value: best.id }],
        children: [{ type: 'text', value: best.str }],
      });
      if (after) {
        const rest = linkText(after);
        if (rest) out.push(...rest);
        else out.push({ type: 'text', value: after });
      }
      return out;
    };

    walk(tree);
  };
}
