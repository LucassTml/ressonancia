import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

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
  { id: 'wave', title: 'Simulador de ondas sonoras', summary: 'Moléculas de ar, pressão e onda: ajuste frequência, amplitude e fase e veja compressões e rarefações.', module: 'fundamentos', article: 'fundamentos/o-que-e-som', featured: true, component: L(() => import('./fundamentos/WaveLab')) },
  { id: 'tone', title: 'Laboratório de frequências', summary: 'Gerador de tons com forma de onda, osciloscópio e espectro em tempo real.', module: 'fundamentos', article: 'fundamentos/frequencia-e-amplitude', audio: true, component: L(() => import('./fundamentos/ToneLab')) },
  { id: 'db', title: 'Calculadora de decibéis', summary: 'Converta pressão, tensão e potência em dB e veja a escala logarítmica em ação.', module: 'fundamentos', article: 'fundamentos/decibeis', component: L(() => import('./fundamentos/DecibelLab')) },
  { id: 'interference', title: 'Interferência e batimentos', summary: 'Duas ondas, suas fases e frequências, e o resultado da soma — visível e audível.', module: 'fundamentos', article: 'fundamentos/fase-e-interferencia', audio: true, component: L(() => import('./fundamentos/InterferenceLab')) },
  { id: 'harmonics', title: 'Sintetizador de harmônicos', summary: 'Monte timbres somando harmônicos e veja forma de onda e espectro.', module: 'fundamentos', article: 'fundamentos/harmonicos-e-timbre', audio: true, featured: true, component: L(() => import('./fundamentos/HarmonicsLab')) },
  { id: 'spectrum-map', title: 'Mapa do espectro audível', summary: 'Explore 20 Hz–20 kHz por regiões, instrumentos e vozes, e ouça cada faixa isolada.', module: 'fundamentos', article: 'fundamentos/espectro-audivel', audio: true, featured: true, component: L(() => import('./fundamentos/SpectrumMap')) },
  { id: 'pitch', title: 'Altura, intervalos e fundamental ausente', summary: 'Teclado com frequências, razões de intervalos e a ilusão da fundamental ausente.', module: 'fundamentos', article: 'fundamentos/melodia-e-harmonia', audio: true, component: L(() => import('./fundamentos/PitchLab')) },
  // Percepção
  { id: 'cochlea', title: 'A cóclea desenrolada', summary: 'Ondas viajantes na membrana basilar: cada frequência tem seu lugar (função de Greenwood).', module: 'percepcao', article: 'percepcao/anatomia-do-ouvido', audio: true, component: L(() => import('./percepcao/CochleaLab')) },
  { id: 'loudness', title: 'Curvas de igual sonoridade', summary: 'ISO 226 calculada pela norma, e quanto o volume muda o equilíbrio tonal percebido — com compensação real.', module: 'percepcao', article: 'percepcao/sonoridade-e-volume', audio: true, featured: true, component: L(() => import('./percepcao/LoudnessLab')) },
  { id: 'masking', title: 'Mascaramento', summary: 'Ruído de banda estreita contra um tom: encontre o limiar e ouça a assimetria do mascaramento.', module: 'percepcao', article: 'percepcao/mascaramento', audio: true, component: L(() => import('./percepcao/MaskingLab')) },
  { id: 'localization', title: 'Localização: ITD e ILD', summary: 'Mova uma fonte em torno da cabeça e ouça as pistas de tempo e de nível separadamente.', module: 'percepcao', article: 'percepcao/localizacao-espacial', audio: true, component: L(() => import('./percepcao/LocalizationLab')) },
  { id: 'pinna', title: 'Pinna gain', summary: 'Ondas, concha e canal auditivo: o ganho da orelha em animação, modelo e dados medidos — e o que muda com um IEM.', module: 'percepcao', article: 'percepcao/pinna-gain', audio: true, featured: true, component: L(() => import('./percepcao/PinnaLab')) },
  { id: 'fit', title: 'Simulador de encaixe', summary: 'Vedação, profundidade de inserção e ponteiras: veja e ouça como o encaixe muda a resposta.', module: 'percepcao', article: 'iems/vedacao-e-ponteiras', audio: true, component: L(() => import('./percepcao/FitLab')) },
  { id: 'exposure', title: 'Exposição sonora', summary: 'Tempo de escuta permitido por nível segundo NIOSH e OMS/ITU.', module: 'percepcao', article: 'percepcao/saude-auditiva', component: L(() => import('./percepcao/ExposureLab')) },
  // Resposta em frequência
  { id: 'fr', title: 'Laboratório de resposta em frequência', summary: 'Arraste a curva, aplique shelf e filtros, compare com outra curva e com alvos — e ouça a diferença com FIR real.', module: 'resposta', article: 'resposta/lendo-graficos', audio: true, featured: true, component: L(() => import('./resposta/FRLab')) },
  { id: 'region-boost', title: 'Vocabulário dos defeitos', summary: 'Retumbante, embolado, gritado, sibilante: ouça o desvio de resposta que cada palavra descreve.', module: 'resposta', article: 'resposta/regioes-e-defeitos', audio: true, component: L(() => import('./resposta/RegionBoostLab')) },
  { id: 'targets', title: 'Curvas-alvo lado a lado', summary: 'Harman 2016–2019, campo difuso e variações de graves e agudos, com dados publicados.', module: 'resposta', article: 'resposta/targets-e-harman', featured: true, component: L(() => import('./resposta/TargetsLab')) },
  { id: 'signatures', title: 'Galeria de assinaturas sonoras', summary: 'Neutro, quente, brilhante, V, U, escuro: veja sobre o alvo e ouça a diferença.', module: 'resposta', article: 'resposta/assinaturas-sonoras', audio: true, featured: true, component: L(() => import('./resposta/SignatureLab')) },
  { id: 'rig-compare', title: 'O mesmo fone, gráficos diferentes', summary: 'Suavização, normalização, inserção e escala: por que gráficos de fontes diferentes não se comparam.', module: 'resposta', article: 'resposta/como-se-mede', component: L(() => import('./resposta/RigCompareLab')) },
  { id: 'preference', title: 'Sua curva de preferência', summary: 'Ajuste guiado (ou cego, por escada adaptativa) de graves, médios e agudos, com exportação para Equalizer APO.', module: 'resposta', article: 'resposta/sua-curva', audio: true, featured: true, component: L(() => import('./resposta/PreferenceLab')) },
  // Drivers
  { id: 'resonator', title: 'Ressonância de um diafragma', summary: 'Massa, mola e amortecimento: por que alto-falantes e IEMs vedados reproduzem graves por mecanismos opostos.', module: 'drivers', article: 'drivers/transdutores', component: L(() => import('./drivers/ResonatorLab')) },
  { id: 'drivers', title: 'Drivers em corte', summary: 'Dinâmico, balanced armature, planar, eletrostático e piezo animados: do sinal elétrico ao movimento do ar.', module: 'drivers', article: 'drivers/driver-dinamico', featured: true, component: L(() => import('./drivers/DriversLab')) },
  { id: 'crossover', title: 'Crossover: dividir e somar', summary: 'Ordens de filtro, polaridade, nível e atraso entre drivers — e o que chega ao ouvido.', module: 'drivers', article: 'drivers/multi-driver-e-crossovers', audio: true, component: L(() => import('./drivers/CrossoverLab')) },
  { id: 'tube', title: 'Tubos e ressonadores', summary: 'Ressonâncias de tubos de ¼ e ½ onda, ressonadores de Helmholtz e o efeito dos dampers.', module: 'drivers', article: 'drivers/construcao-acustica', component: L(() => import('./drivers/TubeLab')) },
  // Eletrônica
  { id: 'ohm', title: 'Lei de Ohm em um circuito', summary: 'Tensão, corrente, resistência e potência em circuitos simples, em série e em paralelo.', module: 'eletronica', article: 'eletronica/eletricidade-basica', component: L(() => import('./eletronica/OhmLab')) },
  { id: 'impedance', title: 'Impedância em função da frequência', summary: 'Reatâncias de indutores e capacitores e as curvas de impedância de diferentes tipos de fone.', module: 'eletronica', article: 'eletronica/corrente-alternada-e-impedancia', component: L(() => import('./eletronica/ImpedanceLab')) },
  { id: 'dac', title: 'Por dentro de um DAC', summary: 'Amostras, retenção, imagens espectrais, sobreamostragem e reconstrução — sem a falácia dos degraus.', module: 'eletronica', article: 'eletronica/dac-e-adc', featured: true, component: L(() => import('./eletronica/DACLab')) },
  { id: 'gain', title: 'Ganho, volume e headroom', summary: 'Onde o sinal corta, quanto sobra de margem e como o ganho expõe o ruído num IEM sensível.', module: 'eletronica', article: 'eletronica/amplificadores', component: L(() => import('./eletronica/GainLab')) },
  { id: 'power', title: 'Calculadora de potência', summary: 'Tensão, corrente e potência necessárias para um volume, em dB/mW ou dB/V, e se a sua fonte dá conta.', module: 'eletronica', article: 'eletronica/potencia-e-sensibilidade', featured: true, component: L(() => import('./eletronica/PowerLab')) },
  { id: 'output-impedance', title: 'Impedância de saída', summary: 'Como a impedância da fonte muda a resposta de IEMs multi-BA — veja e ouça.', module: 'eletronica', article: 'eletronica/potencia-e-sensibilidade', audio: true, component: L(() => import('./eletronica/OutputImpedanceLab')) },
  { id: 'distortion', title: 'Distorção: válvula, transistor e cruzamento', summary: 'Curvas de transferência, harmônicos por FFT e o som de cada tipo de distorção.', module: 'eletronica', article: 'eletronica/valvulas-vs-transistores', audio: true, featured: true, component: L(() => import('./eletronica/DistortionLab')) },
  { id: 'hiss', title: 'Calculadora de chiado', summary: 'Quanto do ruído da fonte chega ao ouvido com IEMs sensíveis.', module: 'eletronica', article: 'eletronica/medidas-de-desempenho', component: L(() => import('./eletronica/HissLab')) },
  { id: 'cable', title: 'O que um cabo faz', summary: 'Resistência, capacitância e crosstalk de cabos calculados — e comparados com o que se atribui a eles.', module: 'eletronica', article: 'eletronica/conexoes-e-cadeia', component: L(() => import('./eletronica/CableLab')) },
  // Digital
  { id: 'sampling', title: 'Amostragem e reconstrução', summary: 'Amostras, reconstrução sinc exata e aliasing — visível e audível numa varredura.', module: 'digital', article: 'digital/amostragem', audio: true, featured: true, component: L(() => import('./digital/SamplingLab')) },
  { id: 'quantization', title: 'Quantização e dither', summary: 'Reduza os bits e ouça a diferença entre distorção de quantização e ruído com dither.', module: 'digital', article: 'digital/quantizacao-e-dither', audio: true, component: L(() => import('./digital/QuantizationLab')) },
  // Processamento
  { id: 'filter', title: 'Explorador de filtros', summary: 'Peak, shelf, passa-baixas, passa-altas e notch: frequência, ganho, Q, magnitude e fase — com áudio real.', module: 'processamento', article: 'processamento/filtros-e-eq', audio: true, component: L(() => import('./processamento/FilterLab')) },
  { id: 'peq', title: 'Equalizador paramétrico', summary: 'EQ paramétrico completo com seus arquivos, espectro ao vivo, preamp, indicador de clipping e exportação.', module: 'processamento', article: 'processamento/equalizador-parametrico', audio: true, featured: true, component: L(() => import('./processamento/PEQLab')) },
  { id: 'autoeq', title: 'AutoEQ e os limites da EQ', summary: 'Ajuste automático de filtros para aproximar um IEM de um alvo — e o que a EQ não consegue corrigir.', module: 'processamento', article: 'processamento/limites-da-eq', audio: true, featured: true, component: L(() => import('./processamento/AutoEQLab')) },
  { id: 'dynamics', title: 'Compressão e limitação', summary: 'Limiar, razão, joelho, ataque e liberação, com curva estática e medidor de redução de ganho.', module: 'processamento', article: 'processamento/dinamica-e-espacializacao', audio: true, component: L(() => import('./processamento/DynamicsLab')) },
  { id: 'crossfeed', title: 'Crossfeed', summary: 'Misture os canais como numa escuta em caixas e ouça a diferença em gravações com pan extremo.', module: 'processamento', article: 'processamento/dinamica-e-espacializacao', audio: true, component: L(() => import('./processamento/CrossfeedLab')) },
  // IEMs
  { id: 'tuning', title: 'Tuning: do protótipo à fábrica', summary: 'Afine um IEM híbrido com ventilação, dampers, capacitor, tubo e filtro de bocal — depois passe um lote pelo controle de qualidade.', module: 'iems', article: 'iems/tuning', featured: true, component: L(() => import('./iems/TuningLab')) },
  { id: 'mistuned', title: 'Separando sons na mesma região', summary: 'Harmonicidade, início assíncrono e destino comum: as pistas que permitem distinguir instrumentos nos médios.', module: 'iems', article: 'iems/separacao-e-resolucao', audio: true, component: L(() => import('./iems/MistunedLab')) },
  { id: 'levelmatch', title: 'Volume compatibilizado', summary: 'Um experimento sobre o viés do volume e uma calculadora de diferença de nível entre IEMs.', module: 'iems', article: 'iems/comparando-iems', audio: true, component: L(() => import('./iems/LevelMatchLab')) },
  { id: 'buying', title: 'Roteiro de compra por prioridades', summary: 'O que priorizar, verificar e ignorar na escolha de um IEM, a partir do seu uso, fonte e gosto.', module: 'iems', article: 'iems/guia-de-compra', component: L(() => import('./iems/BuyingGuideLab')) },
  // Ciência
  { id: 'variation', title: 'Variação entre unidades', summary: 'Um lote de IEMs do mesmo modelo, com tolerâncias de fabricação: o que uma medição isolada representa.', module: 'ciencia', article: 'ciencia/o-que-medicoes-mostram', component: L(() => import('./ciencia/VariationLab')) },
  { id: 'abx', title: 'Teste ABX', summary: 'Teste cego funcional com volume, EQ, bits, corte de agudos ou polaridade — e estatística binomial do resultado.', module: 'ciencia', article: 'ciencia/testes-cegos-e-abx', audio: true, featured: true, component: L(() => import('./ciencia/ABXLab')) },
];

export const labById = new Map(labs.map((l) => [l.id, l]));
