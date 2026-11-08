import { interpCurve, normalizeAt, type Curve } from '../audio/dsp';
import { harmanIE } from './targets';
import { tr } from '../i18n';
import { IEM_FREQS, IEM_RAW } from './iems.raw';

export type Tier = 'budget' | 'mid' | 'high' | 'top';

export interface Iem {
  id: string;
  name: string;
  tier: Tier;
  /** preço aproximado de lançamento em US$, usado no gráfico */
  price: number;
  priceLabel: string;
  year: string;
  drivers: string;
  why: string;
  reading: string;
  curve: Curve;
}

type Meta = Omit<Iem, 'curve'> & { raw: string };

const META: Meta[] = [
  // Até US$ 60
  { id: 'kz-zst', raw: 'KZ ZST', name: 'KZ ZST', tier: 'budget', price: 20, priceLabel: '≈ US$ 20', year: '2016', drivers: '1 DD + 1 BA', why: tr('Popularizou a ideia de um híbrido quase de graça e ajudou a abrir o mercado de IEMs chineses baratos.'), reading: tr('Graves cerca de 3 dB acima do alvo e bastante energia acima de 10 kHz: um V suave, feito para impressionar. A escolha de tuning prioriza impacto em vez de equilíbrio.') },
  { id: 'salnotes-zero', raw: '7Hz Salnotes Zero', name: '7Hz Salnotes Zero', tier: 'budget', price: 20, priceLabel: '≈ US$ 20', year: '2022', drivers: '1 DD', why: tr('Um dos IEMs que mostraram que afinação próxima do alvo não precisa custar caro.'), reading: tr('Muito perto do Harman até 5 kHz, com agudos cerca de 2 dB abaixo. Um único driver dinâmico bem afinado.') },
  { id: 'chu', raw: 'Moondrop Chu', name: 'Moondrop Chu', tier: 'budget', price: 20, priceLabel: '≈ US$ 20', year: '2022', drivers: '1 DD', why: tr('Levou a afinação característica da Moondrop à faixa de entrada.'), reading: tr('Praticamente sobre o alvo em quase todas as regiões, com subgrave um pouco menor. Tem um dos melhores ajustes ao alvo de toda esta galeria, a uma fração do preço dos outros.') },
  { id: 'zsn-pro-x', raw: 'KZ ZSN Pro X', name: 'KZ ZSN Pro X', tier: 'budget', price: 25, priceLabel: '≈ US$ 25', year: '2021', drivers: '1 DD + 1 BA', why: tr('Muito vendido pelo preço e pela construção; bom exemplo de assinatura agressiva.'), reading: tr('Em V acentuado: +5 dB nos graves, +7 dB acima de 10 kHz e o pico de presença deslocado para perto de 4,8 kHz. Empolgante de início, mas essa posição do pico tende a soar áspera.') },
  { id: 'zs10', raw: 'KZ ZS10', name: 'KZ ZS10', tier: 'budget', price: 45, priceLabel: '≈ US$ 45', year: '2018', drivers: '1 DD + 4 BA', why: tr('Símbolo da corrida por mais drivers: cinco por lado num IEM de poucas dezenas de dólares.'), reading: tr('Apesar dos cinco drivers, o pico de presença cai perto de 4,3 kHz com mais de 11 dB, e o extremo agudo despenca. É a demonstração prática de que número de drivers não garante afinação.') },
  { id: 't2', raw: 'Tin HiFi T2', name: 'Tin HiFi T2', tier: 'budget', price: 50, priceLabel: '≈ US$ 50', year: '2018', drivers: '2 DD', why: tr('Um clássico entre quem procurava um som leve e neutro por pouco dinheiro.'), reading: tr('Subgrave quase 8 dB abaixo do alvo e presença recuada: um som magro e contido. Hoje parece fraco em graves, mas ilustra bem a antiga preferência pelo “neutro sem grave”.') },
  { id: 'zero', raw: 'Truthear x Crinacle Zero', name: 'Truthear x Crinacle Zero', tier: 'budget', price: 50, priceLabel: '≈ US$ 50', year: '2022', drivers: '2 DD', why: tr('Colaboração com um avaliador conhecido, com alvo declarado: marcou a fase em que afinar perto de um alvo virou argumento de venda.'), reading: tr('Muito próximo do Harman dos médios aos agudos, com menos subgrave do que o alvo sugere.') },
  { id: 'zero-red', raw: 'Truthear x Crinacle Zero RED', name: 'Truthear x Crinacle Zero RED', tier: 'budget', price: 55, priceLabel: '≈ US$ 55', year: '2023', drivers: '2 DD', why: tr('Revisão do Zero com presença mais suave, para quem o achava intenso.'), reading: tr('Região de presença e agudos cerca de 2 dB abaixo do alvo. Comparar com o Zero mostra como 2 dB numa região larga já mudam o caráter.') },
  // US$ 60–300
  { id: 'aria', raw: 'Moondrop Aria', name: 'Moondrop Aria', tier: 'mid', price: 80, priceLabel: '≈ US$ 80', year: '2021', drivers: '1 DD', why: tr('Referência de “primeiro IEM sério” durante anos.'), reading: tr('Graves 2 dB acima do alvo e presença e agudos um pouco abaixo: levemente quente e confortável, sem excessos.') },
  { id: 'hexa', raw: 'Truthear Hexa', name: 'Truthear Hexa', tier: 'mid', price: 80, priceLabel: '≈ US$ 80', year: '2023', drivers: '1 DD + 3 BA', why: tr('Híbrido barato com afinação disciplinada, contraponto direto aos híbridos em V.'), reading: tr('Colado ao alvo até 10 kHz. Mesma ideia de vários drivers do ZS10, resultado oposto: o que muda é a afinação.') },
  { id: 'se215', raw: 'Shure SE215', name: 'Shure SE215', tier: 'mid', price: 99, priceLabel: '≈ US$ 99', year: '2011', drivers: '1 DD', why: tr('Presente em palcos e bolsos há mais de uma década, pela durabilidade e pelo isolamento.'), reading: tr('Graves +5 dB que entram nos médios-graves (+3 dB): som encorpado e quente. A curva combina com monitoração de palco, onde o grave ajuda a se ouvir.') },
  { id: 'ie40', raw: 'Sennheiser IE 40 Pro', name: 'Sennheiser IE 40 Pro', tier: 'mid', price: 99, priceLabel: '≈ US$ 99', year: '2019', drivers: '1 DD', why: tr('Monitor de palco acessível de uma marca tradicional.'), reading: tr('Presença quase 6 dB abaixo do alvo: as vozes ficam mais suaves e distantes, o que permite volumes altos em palco sem agressividade.') },
  { id: 'starfield', raw: 'Moondrop Starfield', name: 'Moondrop Starfield', tier: 'mid', price: 110, priceLabel: '≈ US$ 110', year: '2020', drivers: '1 DD', why: tr('Popularizou a afinação próxima do Harman na faixa de US$ 100.'), reading: tr('Muito equilibrado até 5 kHz, com agudos quase 4 dB abaixo do alvo. Uma escolha suave, voltada a escutas longas.') },
  { id: 'er2xr', raw: 'Etymotic ER2XR', name: 'Etymotic ER2XR', tier: 'mid', price: 150, priceLabel: '≈ US$ 150', year: '2019', drivers: '1 DD', why: tr('Versão com driver dinâmico da escola Etymotic: inserção profunda e foco em precisão.'), reading: tr('Médios quase exatos, agudos cerca de 5 dB abaixo do alvo nesta medição. A inserção muito profunda torna os agudos especialmente dependentes do seu ouvido.') },
  { id: 'nova', raw: 'Truthear Nova', name: 'Truthear Nova', tier: 'mid', price: 150, priceLabel: '≈ US$ 150', year: '2023', drivers: '1 DD + 4 BA', why: tr('Híbrido que busca ficar o mais perto possível do alvo.'), reading: tr('Possivelmente a curva mais próxima do Harman de toda a galeria: quase todas as regiões estão a menos de 1,5 dB do alvo.') },
  { id: 'ie200', raw: 'Sennheiser IE 200', name: 'Sennheiser IE 200', tier: 'mid', price: 150, priceLabel: '≈ US$ 150', year: '2023', drivers: '1 DD', why: tr('A porta de entrada da linha IE da Sennheiser, com driver dinâmico próprio.'), reading: tr('Presença cerca de 4 dB abaixo do alvo e bastante energia acima de 10 kHz: soa relaxado nas vozes e aberto em cima.') },
  { id: 'timeless', raw: '7Hz Timeless', name: '7Hz Timeless', tier: 'mid', price: 220, priceLabel: '≈ US$ 220', year: '2021', drivers: tr('1 planar (14,2 mm)'), why: tr('O IEM que popularizou os drivers planares em fones intra-auriculares acessíveis.'), reading: tr('Graves um pouco acima do alvo e cerca de 8 dB a mais acima de 10 kHz: um extremo agudo muito energético, ligado ao comportamento desse driver nesta carcaça.') },
  // US$ 300–999
  { id: 'blessing2', raw: 'Moondrop Blessing 2', name: 'Moondrop Blessing 2', tier: 'high', price: 320, priceLabel: '≈ US$ 320', year: '2020', drivers: '1 DD + 4 BA', why: tr('Por anos, a referência de afinação equilibrada abaixo de mil dólares.'), reading: tr('De 60 Hz a 18 kHz está praticamente sobre o alvo; a diferença principal é o subgrave quase 4 dB menor.') },
  { id: 'er4xr', raw: 'Etymotic ER4XR', name: 'Etymotic ER4XR', tier: 'high', price: 350, priceLabel: '≈ US$ 350', year: '2016', drivers: '1 BA', why: tr('Herdeiro do pioneiro ER-4: um único BA, inserção profunda, isolamento altíssimo.'), reading: tr('Versão “XR” (resposta estendida) com subgrave cerca de 4 dB maior que o ER4SR, ainda bem abaixo do Harman.') },
  { id: 'er4sr', raw: 'Etymotic ER4SR', name: 'Etymotic ER4SR', tier: 'high', price: 350, priceLabel: '≈ US$ 350', year: '2016', drivers: '1 BA', why: tr('A referência histórica da afinação de campo difuso em IEMs.'), reading: tr('Subgrave 10 dB abaixo do Harman: é o que acontece quando o objetivo é o campo difuso, sem shelf de graves. Mostra na prática a diferença entre os dois alvos.') },
  { id: 'se535', raw: 'Shure SE535', name: 'Shure SE535', tier: 'high', price: 480, priceLabel: '≈ US$ 450–500', year: '2010', drivers: '3 BA', why: tr('Monitor de palco muito usado por músicos profissionais por muitos anos.'), reading: tr('Presença e agudos mais de 6 dB abaixo do alvo, e queda forte acima de 10 kHz: um som escuro, centrado nos médios. Foi uma escolha de outra época e de outro uso, não um defeito.') },
  { id: 'variations', raw: 'Moondrop Variations', name: 'Moondrop Variations', tier: 'high', price: 520, priceLabel: '≈ US$ 520', year: '2021', drivers: '1 DD + 2 BA + 2 EST', why: tr('Híbrido de três tecnologias com afinação contida.'), reading: tr('Próximo do alvo com subgrave ligeiramente reforçado e agudos 2 dB abaixo.') },
  { id: 'ie600', raw: 'Sennheiser IE 600', name: 'Sennheiser IE 600', tier: 'high', price: 700, priceLabel: '≈ US$ 700', year: '2022', drivers: '1 DD', why: tr('Mostrou que um único driver de 7 mm ainda disputa o topo.'), reading: tr('Graves um pouco acima do alvo, presença cerca de 3 dB abaixo e muita energia acima de 10 kHz. Afinação clara e arejada sem pico agressivo nas vozes.') },
  { id: 'monarch', raw: 'ThieAudio Monarch', name: 'ThieAudio Monarch', tier: 'high', price: 730, priceLabel: '≈ US$ 730', year: '2020', drivers: '1 DD + 6 BA + 2 EST', why: tr('Tribrid que ajudou a popularizar a combinação de grave dinâmico com tweeters eletrostáticos.'), reading: tr('Subgrave +2,4 dB, mas sem excesso de graves médios: um reforço concentrado embaixo, que preserva a clareza dos médios. O pico de presença fica perto de 5,7 kHz.') },
  // Acima de US$ 1000
  { id: 'se846', raw: 'Shure SE846', name: 'Shure SE846', tier: 'top', price: 999, priceLabel: '≈ US$ 999', year: '2013', drivers: '4 BA', why: tr('Conhecido pelo filtro passa-baixas acústico de graves e pelos bocais intercambiáveis.'), reading: tr('Equilibrado até os médios, com presença suave e queda de 8 dB acima de 10 kHz: som quente e relaxado no topo.') },
  { id: 'ierm9', raw: 'Sony IER-M9', name: 'Sony IER-M9', tier: 'top', price: 1300, priceLabel: '≈ US$ 1.100–1.500', year: '2018', drivers: '5 BA', why: tr('Monitor de palco de referência da Sony, com balanced armatures próprios.'), reading: tr('Graves e médios-graves 2 a 3 dB acima do alvo e bastante “ar”: corpo generoso com abertura em cima.') },
  { id: 'ie900', raw: 'Sennheiser IE 900', name: 'Sennheiser IE 900', tier: 'top', price: 1300, priceLabel: '≈ US$ 1.300', year: '2021', drivers: '1 DD', why: tr('Topo de linha com um único driver dinâmico de 7 mm e câmaras usinadas em alumínio.'), reading: tr('A presença fica mais de 6 dB abaixo do Harman e o ponto mais alto da região sobe para perto de 5,4 kHz. Uma escolha deliberadamente relaxada nas vozes, longe do que o alvo preveria como preferido.') },
  { id: 'z1r', raw: 'Sony IER-Z1R', name: 'Sony IER-Z1R', tier: 'top', price: 1999, priceLabel: '≈ US$ 2.000', year: '2019', drivers: '2 DD + 1 BA', why: tr('Híbrido incomum com um grande driver dinâmico de graves e um pequeno dinâmico como super-tweeter.'), reading: tr('Graves acima do alvo e presença mais de 3 dB abaixo: som amplo e encorpado, distante da neutralidade estrita.') },
  { id: 'a12t', raw: '64 Audio A12t (m15 Apex module)', name: '64 Audio A12t', tier: 'top', price: 2100, priceLabel: '≈ US$ 2.000–2.300', year: '2018', drivers: '12 BA', why: tr('Doze BAs por lado e um sistema de alívio de pressão (Apex), com moldes personalizados.'), reading: tr('Médios exatos, presença 4 dB abaixo do alvo. Doze drivers e preço alto não o aproximam do Harman, porque esse não era o objetivo.') },
];

export const iems: Iem[] = META.map(({ raw, ...m }) => {
  const vals = IEM_RAW[raw];
  return { ...m, curve: normalizeAt(IEM_FREQS.map((f, i) => [f, vals[i]] as [number, number]), 1000) };
});

export const iemById = new Map(iems.map((i) => [i.id, i]));

export const TIERS: { id: Tier; name: string; range: string }[] = [
  { id: 'budget', name: tr('Até US$ 60'), range: tr('Entrada') },
  { id: 'mid', name: tr('US$ 60 a 300'), range: tr('Intermediários') },
  { id: 'high', name: tr('US$ 300 a 999'), range: tr('Alto padrão') },
  { id: 'top', name: tr('US$ 1.000 ou mais'), range: tr('Topo de linha') },
];

export const harmanAt = (f: number) => interpCurve(harmanIE.curve, f);

/** Desvio RMS (dB) em relação ao alvo entre 100 Hz e 5 kHz, onde a medição é confiável. */
export function targetError(i: Iem) {
  const fs = IEM_FREQS.filter((f) => f >= 100 && f <= 5000);
  const d = fs.map((f) => interpCurve(i.curve, f) - harmanAt(f));
  const m = d.reduce((a, b) => a + b, 0) / d.length;
  return Math.sqrt(d.reduce((a, b) => a + (b - m) ** 2, 0) / d.length);
}
