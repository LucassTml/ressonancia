import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { tr } from '../i18n';

export interface LabEntry {
  id: string;
  title: string;
  summary: string;
  module: string;
  /** artigo onde o laboratório é explicado */
  article: string;
  audio?: boolean;
  /** exibido em destaque no laboratório central */
  featured?: boolean;
  /** figura/diagrama de apoio: não aparece no índice do laboratório */
  hidden?: boolean;
  component: LazyExoticComponent<ComponentType<Record<string, unknown>>>;
}

const L = (f: () => Promise<{ default: ComponentType<any> }>) => lazy(f) as LabEntry['component'];

export const labs: LabEntry[] = [
  // Fundamentos
  { id: 'wave', title: tr("Simulador de ondas sonoras"), summary: tr("Moléculas de ar, pressão e onda: ajuste frequência, amplitude e fase e veja compressões e rarefações."), module: 'fundamentos', article: 'fundamentos/o-que-e-som', featured: true, component: L(() => import('./fundamentos/WaveLab')) },
  { id: 'tone', title: tr("Laboratório de frequências"), summary: tr("Gerador de tons com forma de onda, osciloscópio e espectro em tempo real."), module: 'fundamentos', article: 'fundamentos/frequencia-e-amplitude', audio: true, component: L(() => import('./fundamentos/ToneLab')) },
  { id: 'db', title: tr("Calculadora de decibéis"), summary: tr("Converta pressão, tensão e potência em dB e veja a escala logarítmica em ação."), module: 'fundamentos', article: 'fundamentos/decibeis', component: L(() => import('./fundamentos/DecibelLab')) },
  { id: 'interference', title: tr("Interferência e batimentos"), summary: tr("Duas ondas, suas fases e frequências, e o resultado da soma — visível e audível."), module: 'fundamentos', article: 'fundamentos/fase-e-interferencia', audio: true, component: L(() => import('./fundamentos/InterferenceLab')) },
  { id: 'harmonics', title: tr("Sintetizador de harmônicos"), summary: tr("Monte timbres somando harmônicos e veja forma de onda e espectro."), module: 'fundamentos', article: 'fundamentos/harmonicos-e-timbre', audio: true, featured: true, component: L(() => import('./fundamentos/HarmonicsLab')) },
  { id: 'spectrum-map', title: tr("Mapa do espectro audível"), summary: tr("Explore 20 Hz–20 kHz por regiões, instrumentos e vozes, e ouça cada faixa isolada."), module: 'fundamentos', article: 'fundamentos/espectro-audivel', audio: true, featured: true, component: L(() => import('./fundamentos/SpectrumMap')) },
  { id: 'pitch', title: tr("Altura, intervalos e fundamental ausente"), summary: tr("Teclado com frequências, razões de intervalos e a ilusão da fundamental ausente."), module: 'fundamentos', article: 'fundamentos/melodia-e-harmonia', audio: true, component: L(() => import('./fundamentos/PitchLab')) },
  // Percepção
  { id: 'cochlea', title: tr("A cóclea desenrolada"), summary: tr("Ondas viajantes na membrana basilar: cada frequência tem seu lugar (função de Greenwood)."), module: 'percepcao', article: 'percepcao/anatomia-do-ouvido', audio: true, component: L(() => import('./percepcao/CochleaLab')) },
  { id: 'loudness', title: tr("Curvas de igual sonoridade"), summary: tr("ISO 226 calculada pela norma, e quanto o volume muda o equilíbrio tonal percebido — com compensação real."), module: 'percepcao', article: 'percepcao/sonoridade-e-volume', audio: true, featured: true, component: L(() => import('./percepcao/LoudnessLab')) },
  { id: 'masking', title: tr("Mascaramento"), summary: tr("Ruído de banda estreita contra um tom: encontre o limiar e ouça a assimetria do mascaramento."), module: 'percepcao', article: 'percepcao/mascaramento', audio: true, component: L(() => import('./percepcao/MaskingLab')) },
  { id: 'localization', title: tr("Localização: ITD e ILD"), summary: tr("Mova uma fonte em torno da cabeça e ouça as pistas de tempo e de nível separadamente."), module: 'percepcao', article: 'percepcao/localizacao-espacial', audio: true, component: L(() => import('./percepcao/LocalizationLab')) },
  { id: 'pinna', title: tr("Pinna gain"), summary: tr("Ondas, concha e canal auditivo: o ganho da orelha em animação, modelo e dados medidos — e o que muda com um IEM."), module: 'percepcao', article: 'percepcao/pinna-gain', audio: true, featured: true, component: L(() => import('./percepcao/PinnaLab')) },
  { id: 'fit', title: tr("Simulador de encaixe"), summary: tr("Vedação, profundidade de inserção e ponteiras: veja e ouça como o encaixe muda a resposta."), module: 'percepcao', article: 'iems/vedacao-e-ponteiras', audio: true, component: L(() => import('./percepcao/FitLab')) },
  { id: 'exposure', title: tr("Exposição sonora"), summary: tr("Tempo de escuta permitido por nível segundo NIOSH e OMS/ITU."), module: 'percepcao', article: 'percepcao/saude-auditiva', component: L(() => import('./percepcao/ExposureLab')) },
  // Resposta em frequência
  { id: 'fr', title: tr("Laboratório de resposta em frequência"), summary: tr("Arraste a curva, aplique shelf e filtros, compare com outra curva e com alvos — e ouça a diferença com FIR real."), module: 'resposta', article: 'resposta/lendo-graficos', audio: true, featured: true, component: L(() => import('./resposta/FRLab')) },
  { id: 'region-boost', title: tr("Vocabulário dos defeitos"), summary: tr("Retumbante, embolado, gritado, sibilante: ouça o desvio de resposta que cada palavra descreve."), module: 'resposta', article: 'resposta/regioes-e-defeitos', audio: true, component: L(() => import('./resposta/RegionBoostLab')) },
  { id: 'targets', title: tr("Curvas-alvo lado a lado"), summary: tr("Harman 2016–2019, campo difuso e variações de graves e agudos, com dados publicados."), module: 'resposta', article: 'resposta/targets-e-harman', featured: true, component: L(() => import('./resposta/TargetsLab')) },
  { id: 'signatures', title: tr("Galeria de assinaturas sonoras"), summary: tr("Neutro, quente, brilhante, V, U, escuro: veja sobre o alvo e ouça a diferença."), module: 'resposta', article: 'resposta/assinaturas-sonoras', audio: true, featured: true, component: L(() => import('./resposta/SignatureLab')) },
  { id: 'rig-compare', title: tr("O mesmo fone, gráficos diferentes"), summary: tr("Suavização, normalização, inserção e escala: por que gráficos de fontes diferentes não se comparam."), module: 'resposta', article: 'resposta/como-se-mede', component: L(() => import('./resposta/RigCompareLab')) },
  { id: 'preference', title: tr("Sua curva de preferência"), summary: tr("Ajuste guiado (ou cego, por escada adaptativa) de graves, médios e agudos, com exportação para Equalizer APO."), module: 'resposta', article: 'resposta/sua-curva', audio: true, featured: true, component: L(() => import('./resposta/PreferenceLab')) },
  // Drivers
  { id: 'resonator', title: tr("Ressonância de um diafragma"), summary: tr("Massa, mola e amortecimento: por que alto-falantes e IEMs vedados reproduzem graves por mecanismos opostos."), module: 'drivers', article: 'drivers/transdutores', component: L(() => import('./drivers/ResonatorLab')) },
  { id: 'drivers', title: tr("Drivers em corte"), summary: tr("Dinâmico, balanced armature, planar, eletrostático e piezo animados: do sinal elétrico ao movimento do ar."), module: 'drivers', article: 'drivers/driver-dinamico', featured: true, component: L(() => import('./drivers/DriversLab')) },
  { id: 'crossover', title: tr("Crossover: dividir e somar"), summary: tr("Ordens de filtro, polaridade, nível e atraso entre drivers — e o que chega ao ouvido."), module: 'drivers', article: 'drivers/multi-driver-e-crossovers', audio: true, component: L(() => import('./drivers/CrossoverLab')) },
  { id: 'tube', title: tr("Tubos e ressonadores"), summary: tr("Ressonâncias de tubos de ¼ e ½ onda, ressonadores de Helmholtz e o efeito dos dampers."), module: 'drivers', article: 'drivers/construcao-acustica', component: L(() => import('./drivers/TubeLab')) },
  // Eletrônica
  { id: 'ohm', title: tr("Lei de Ohm em um circuito"), summary: tr("Tensão, corrente, resistência e potência em circuitos simples, em série e em paralelo."), module: 'eletronica', article: 'eletronica/eletricidade-basica', component: L(() => import('./eletronica/OhmLab')) },
  { id: 'impedance', title: tr("Impedância em função da frequência"), summary: tr("Reatâncias de indutores e capacitores e as curvas de impedância de diferentes tipos de fone."), module: 'eletronica', article: 'eletronica/corrente-alternada-e-impedancia', component: L(() => import('./eletronica/ImpedanceLab')) },
  { id: 'dac', title: tr("Por dentro de um DAC"), summary: tr("Amostras, retenção, imagens espectrais, sobreamostragem e reconstrução — sem a falácia dos degraus."), module: 'eletronica', article: 'eletronica/dac-e-adc', featured: true, component: L(() => import('./eletronica/DACLab')) },
  { id: 'gain', title: tr("Ganho, volume e headroom"), summary: tr("Onde o sinal corta, quanto sobra de margem e como o ganho expõe o ruído num IEM sensível."), module: 'eletronica', article: 'eletronica/amplificadores', component: L(() => import('./eletronica/GainLab')) },
  { id: 'power', title: tr("Calculadora de potência"), summary: tr("Tensão, corrente e potência necessárias para um volume, em dB/mW ou dB/V, e se a sua fonte dá conta."), module: 'eletronica', article: 'eletronica/potencia-e-sensibilidade', featured: true, component: L(() => import('./eletronica/PowerLab')) },
  { id: 'output-impedance', title: tr("Impedância de saída"), summary: tr("Como a impedância da fonte muda a resposta de IEMs multi-BA — veja e ouça."), module: 'eletronica', article: 'eletronica/potencia-e-sensibilidade', audio: true, component: L(() => import('./eletronica/OutputImpedanceLab')) },
  { id: 'distortion', title: tr("Distorção: válvula, transistor e cruzamento"), summary: tr("Curvas de transferência, harmônicos por FFT e o som de cada tipo de distorção."), module: 'eletronica', article: 'eletronica/valvulas-vs-transistores', audio: true, featured: true, component: L(() => import('./eletronica/DistortionLab')) },
  { id: 'hiss', title: tr("Calculadora de chiado"), summary: tr("Quanto do ruído da fonte chega ao ouvido com IEMs sensíveis."), module: 'eletronica', article: 'eletronica/medidas-de-desempenho', component: L(() => import('./eletronica/HissLab')) },
  { id: 'cable', title: tr("O que um cabo faz"), summary: tr("Resistência, capacitância e crosstalk de cabos calculados — e comparados com o que se atribui a eles."), module: 'eletronica', article: 'eletronica/conexoes-e-cadeia', component: L(() => import('./eletronica/CableLab')) },
  // Digital
  { id: 'sampling', title: tr("Amostragem e reconstrução"), summary: tr("Amostras, reconstrução sinc exata e aliasing — visível e audível numa varredura."), module: 'digital', article: 'digital/amostragem', audio: true, featured: true, component: L(() => import('./digital/SamplingLab')) },
  { id: 'quantization', title: tr("Quantização e dither"), summary: tr("Reduza os bits e ouça a diferença entre distorção de quantização e ruído com dither."), module: 'digital', article: 'digital/quantizacao-e-dither', audio: true, component: L(() => import('./digital/QuantizationLab')) },
  // Processamento
  { id: 'filter', title: tr("Explorador de filtros"), summary: tr("Peak, shelf, passa-baixas, passa-altas e notch: frequência, ganho, Q, magnitude e fase — com áudio real."), module: 'processamento', article: 'processamento/filtros-e-eq', audio: true, component: L(() => import('./processamento/FilterLab')) },
  { id: 'peq', title: tr("Equalizador paramétrico"), summary: tr("EQ paramétrico completo com seus arquivos, espectro ao vivo, preamp, indicador de clipping e exportação."), module: 'processamento', article: 'processamento/equalizador-parametrico', audio: true, featured: true, component: L(() => import('./processamento/PEQLab')) },
  { id: 'autoeq', title: tr("AutoEQ e os limites da EQ"), summary: tr("Ajuste automático de filtros para aproximar um IEM de um alvo — e o que a EQ não consegue corrigir."), module: 'processamento', article: 'processamento/limites-da-eq', audio: true, featured: true, component: L(() => import('./processamento/AutoEQLab')) },
  { id: 'dynamics', title: tr("Compressão e limitação"), summary: tr("Limiar, razão, joelho, ataque e liberação, com curva estática e medidor de redução de ganho."), module: 'processamento', article: 'processamento/dinamica-e-espacializacao', audio: true, component: L(() => import('./processamento/DynamicsLab')) },
  { id: 'crossfeed', title: tr("Crossfeed"), summary: tr("Misture os canais como numa escuta em caixas e ouça a diferença em gravações com pan extremo."), module: 'processamento', article: 'processamento/dinamica-e-espacializacao', audio: true, component: L(() => import('./processamento/CrossfeedLab')) },
  // IEMs
  { id: 'tuning', title: tr("Tuning: do protótipo à fábrica"), summary: tr("Afine um IEM híbrido com ventilação, dampers, capacitor, tubo e filtro de bocal — depois passe um lote pelo controle de qualidade."), module: 'iems', article: 'iems/tuning', featured: true, component: L(() => import('./iems/TuningLab')) },
  { id: 'mistuned', title: tr("Separando sons na mesma região"), summary: tr("Harmonicidade, início assíncrono e destino comum: as pistas que permitem distinguir instrumentos nos médios."), module: 'iems', article: 'iems/separacao-e-resolucao', audio: true, component: L(() => import('./iems/MistunedLab')) },
  { id: 'levelmatch', title: tr("Volume compatibilizado"), summary: tr("Um experimento sobre o viés do volume e uma calculadora de diferença de nível entre IEMs."), module: 'iems', article: 'iems/comparando-iems', audio: true, component: L(() => import('./iems/LevelMatchLab')) },
  { id: 'buying', title: tr("Roteiro de compra por prioridades"), summary: tr("O que priorizar, verificar e ignorar na escolha de um IEM, a partir do seu uso, fonte e gosto."), module: 'iems', article: 'iems/guia-de-compra', component: L(() => import('./iems/BuyingGuideLab')) },
  // Ciência
  { id: 'variation', title: tr("Variação entre unidades"), summary: tr("Um lote de IEMs do mesmo modelo, com tolerâncias de fabricação: o que uma medição isolada representa."), module: 'ciencia', article: 'ciencia/o-que-medicoes-mostram', component: L(() => import('./ciencia/VariationLab')) },
  { id: 'abx', title: tr("Teste ABX"), summary: tr("Teste cego funcional com volume, EQ, bits, corte de agudos ou polaridade — e estatística binomial do resultado."), module: 'ciencia', article: 'ciencia/testes-cegos-e-abx', audio: true, featured: true, component: L(() => import('./ciencia/ABXLab')) },
  // Conceitos básicos e IEMs famosos
  { id: 'octave', title: tr('Oitavas: ouvindo o dobro'), summary: tr('Dobre e divida frequências, ouça a mesma nota em alturas diferentes e veja por que a escala do áudio é logarítmica.'), module: 'inicio', article: 'inicio/o-que-e-uma-oitava', audio: true, featured: true, component: L(() => import('./inicio/OctaveLab')) },
  { id: 'iems', title: tr('Explorador de IEMs famosos'), summary: tr('29 IEMs reais, de US$ 20 a mais de US$ 2.000: compare curvas medidas, escolhas de afinação e ouça a diferença.'), module: 'famosos', article: 'famosos/como-ler-a-galeria', audio: true, featured: true, component: L(() => import('./iems/IemExplorerLab')) },
  { id: 'iem-price', title: tr('Preço contra proximidade do alvo'), summary: tr('Um gráfico com dados reais que mostra o que o preço compra, e o que não compra.'), module: 'famosos', article: 'famosos/como-ler-a-galeria', component: L(() => import('./iems/IemPriceLab')) },
];

export const labById = new Map(labs.map((l) => [l.id, l]));
