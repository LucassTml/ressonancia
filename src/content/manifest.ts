/**
 * Sumário da enciclopédia. Cada artigo vive em
 * `src/content/articles/<módulo>/<slug>.mdx` e é carregado sob demanda.
 * Para adicionar um artigo: crie o .mdx e registre-o aqui.
 */

export interface ArticleEntry {
  slug: string;
  title: string;
  summary: string;
  /** Artigos relacionados no formato "modulo/slug" */
  related?: string[];
  /** Laboratórios usados no artigo */
  labs?: string[];
  /** Destaque editorial (tópicos centrais da obra) */
  featured?: boolean;
}

export interface ModuleEntry {
  id: string;
  number: string;
  title: string;
  short: string;
  description: string;
  articles: ArticleEntry[];
}

export const modules: ModuleEntry[] = [
  {
    id: 'fundamentos',
    number: '01',
    title: 'Fundamentos do som',
    short: 'Fundamentos',
    description:
      'O que é uma onda sonora, como ela se propaga e como a descrevemos: frequência, amplitude, fase, decibéis, harmônicos e o espectro audível.',
    articles: [
      {
        slug: 'o-que-e-som',
        title: 'O que é som: vibração, pressão e propagação',
        summary:
          'Por que o som é uma onda de pressão, como as moléculas do ar se movem (e não se movem), e de onde vem a velocidade do som.',
        labs: ['wave'],
        related: ['fundamentos/frequencia-e-amplitude', 'fundamentos/decibeis'],
        featured: true,
      },
      {
        slug: 'frequencia-e-amplitude',
        title: 'Frequência, período, amplitude e comprimento de onda',
        summary:
          'As quatro grandezas que descrevem uma onda simples, como se relacionam e por que um grave de 20 Hz mede 17 metros.',
        labs: ['wave', 'tone'],
        related: ['fundamentos/o-que-e-som', 'fundamentos/espectro-audivel'],
      },
      {
        slug: 'decibeis',
        title: 'Decibéis e escalas logarítmicas',
        summary:
          'Por que medimos som em decibéis, o que significam dB SPL, dBFS, dBV e dBu, e como somar, subtrair e comparar níveis sem cair em armadilhas.',
        labs: ['db'],
        related: ['percepcao/sonoridade-e-volume', 'eletronica/potencia-e-sensibilidade'],
      },
      {
        slug: 'fase-e-interferencia',
        title: 'Fase, interferência e filtros de pente',
        summary:
          'Como ondas se somam e se cancelam, o que são batimentos e por que reflexões e tubos acústicos criam picos e vales na resposta.',
        labs: ['interference'],
        related: ['fundamentos/harmonicos-e-timbre', 'drivers/construcao-acustica'],
      },
      {
        slug: 'harmonicos-e-timbre',
        title: 'Harmônicos, espectro e timbre',
        summary:
          'Fourier, séries harmônicas, formas de onda e envelopes: por que um violino e uma flauta tocando a mesma nota soam diferentes.',
        labs: ['harmonics'],
        related: ['fundamentos/espectro-audivel', 'fundamentos/melodia-e-harmonia'],
      },
      {
        slug: 'espectro-audivel',
        title: 'O espectro audível: dos subgraves ao “ar”',
        summary:
          'Um mapa de 20 Hz a 20 kHz: o que vive em cada região, como instrumentos e vozes se distribuem e por que cada faixa é percebida de um jeito.',
        labs: ['spectrum-map'],
        related: ['resposta/regioes-e-defeitos', 'percepcao/sonoridade-e-volume'],
        featured: true,
      },
      {
        slug: 'melodia-e-harmonia',
        title: 'Altura, melodia e harmonia: a física da música',
        summary:
          'O que compõe uma melodia, como o cérebro extrai a altura de um som, por que certos intervalos soam consonantes e como a afinação foi construída.',
        labs: ['pitch'],
        related: ['fundamentos/harmonicos-e-timbre', 'iems/separacao-e-resolucao'],
      },
    ],
  },
  {
    id: 'percepcao',
    number: '02',
    title: 'Percepção humana e psicoacústica',
    short: 'Percepção',
    description:
      'Como o ouvido transforma pressão em impulsos nervosos e como o cérebro interpreta o resultado. A ponte entre física e experiência.',
    articles: [
      {
        slug: 'anatomia-do-ouvido',
        title: 'Anatomia funcional do ouvido',
        summary:
          'Ouvido externo, médio e interno como um sistema de engenharia: casamento de impedância, a cóclea como analisador de frequências e as células ciliadas.',
        labs: ['cochlea'],
        related: ['percepcao/pinna-gain', 'percepcao/mascaramento'],
      },
      {
        slug: 'sonoridade-e-volume',
        title: 'Sonoridade, igual sonoridade e o papel do volume',
        summary:
          'ISO 226, fones e sones, por que os graves “somem” em volume baixo e até que ponto o volume muda o que você ouve — e o que julga.',
        labs: ['loudness'],
        related: ['percepcao/saude-auditiva', 'iems/comparando-iems'],
        featured: true,
      },
      {
        slug: 'mascaramento',
        title: 'Mascaramento e bandas críticas',
        summary:
          'Por que um som pode esconder outro, como a cóclea agrupa frequências em bandas e o que isso tem a ver com codecs, EQ e “separação”.',
        labs: ['masking'],
        related: ['digital/formatos-e-compressao', 'iems/separacao-e-resolucao'],
      },
      {
        slug: 'localizacao-espacial',
        title: 'Localização espacial: ITD, ILD e HRTF',
        summary:
          'Como dois ouvidos bastam para localizar um som em três dimensões e por que, nos fones, a música parece tocar dentro da cabeça.',
        labs: ['localization'],
        related: ['percepcao/pinna-gain', 'processamento/dinamica-e-espacializacao'],
      },
      {
        slug: 'pinna-gain',
        title: 'Pinna gain: como a orelha esculpe o som',
        summary:
          'A geometria da orelha e do canal auditivo cria ressonâncias de até ~20 dB. Entenda a física, por que isso define as curvas-alvo e o que muda num IEM.',
        labs: ['pinna'],
        related: ['resposta/targets-e-harman', 'percepcao/percepcao-individual'],
        featured: true,
      },
      {
        slug: 'percepcao-individual',
        title: 'Por que cada pessoa ouve um fone de um jeito',
        summary:
          'Canais auditivos, inserção, vedação, HRTFs, idade, treino e preferência: as fontes reais das divergências entre opiniões.',
        labs: ['fit'],
        related: ['iems/vedacao-e-ponteiras', 'resposta/sua-curva'],
      },
      {
        slug: 'saude-auditiva',
        title: 'Saúde auditiva, fadiga e exposição',
        summary:
          'Dose de ruído, regra dos 3 dB, perda temporária e permanente, zumbido e como ouvir muito por muitos anos.',
        labs: ['exposure'],
        related: ['percepcao/sonoridade-e-volume', 'iems/cuidados-e-manutencao'],
      },
    ],
  },
  {
    id: 'resposta',
    number: '03',
    title: 'Resposta em frequência e tonalidade',
    short: 'Resposta em frequência',
    description:
      'O gráfico mais importante da audiofilia: como lê-lo, de onde vêm as curvas-alvo como a Harman, como fones são medidos e como encontrar a sua própria preferência.',
    articles: [
      {
        slug: 'lendo-graficos',
        title: 'O que é resposta em frequência e como ler um gráfico',
        summary:
          'Eixos, escala logarítmica, normalização, suavização e o laboratório de resposta em frequência para manipular e ouvir curvas.',
        labs: ['fr'],
        related: ['resposta/regioes-e-defeitos', 'resposta/targets-e-harman'],
        featured: true,
      },
      {
        slug: 'regioes-e-defeitos',
        title: 'Regiões do espectro e o vocabulário dos defeitos',
        summary:
          'Sub-bass, mid-bass, low-mids, upper-mids e agudos; picos, vales e ressonâncias; e o que realmente significam sibilante, embolado, gritado e retumbante.',
        labs: ['region-boost'],
        related: ['resposta/lendo-graficos', 'resposta/assinaturas-sonoras'],
      },
      {
        slug: 'targets-e-harman',
        title: 'Curvas-alvo: do plano ao Harman',
        summary:
          'Por que um fone “plano” soa errado, o campo difuso, a pesquisa de Sean Olive na Harman, as versões da curva, suas limitações e os alvos mais recentes.',
        labs: ['targets'],
        related: ['percepcao/pinna-gain', 'resposta/sua-curva', 'resposta/como-se-mede'],
        featured: true,
      },
      {
        slug: 'assinaturas-sonoras',
        title: 'Assinaturas sonoras: neutral, warm, bright, V, U e outras',
        summary:
          'As curvas típicas de cada assinatura, sobrepostas ao alvo, com áudio processado de verdade para ouvir a diferença.',
        labs: ['signatures'],
        related: ['resposta/regioes-e-defeitos', 'resposta/sua-curva'],
        featured: true,
      },
      {
        slug: 'como-se-mede',
        title: 'Como se mede um fone: acopladores, simuladores e sistemas',
        summary:
          'IEC 60318-4 (711), B&K 5128, KEMAR, varreduras senoidais, calibração, e por que não se deve comparar gráficos de fontes diferentes.',
        labs: ['rig-compare'],
        related: ['iems/tuning', 'ciencia/o-que-medicoes-mostram'],
        featured: true,
      },
      {
        slug: 'sua-curva',
        title: 'Como descobrir a sua curva de preferência',
        summary:
          'Um método para chegar à sua curva: alvo de partida, ajustes de grave e agudo, sinais de teste, cuidados com volume e um laboratório guiado.',
        labs: ['preference'],
        related: ['resposta/targets-e-harman', 'processamento/limites-da-eq'],
        featured: true,
      },
    ],
  },
  {
    id: 'drivers',
    number: '04',
    title: 'Drivers e construção dos fones',
    short: 'Drivers',
    description:
      'Como sinais elétricos viram movimento e o movimento vira som: dinâmicos, balanced armatures, planares, eletrostáticos, piezoelétricos e a acústica em volta deles.',
    articles: [
      {
        slug: 'transdutores',
        title: 'Do sinal elétrico ao som: princípios dos transdutores',
        summary:
          'Força de Lorentz, sistemas massa-mola, ressonância e amortecimento — e por que um IEM vedado reproduz graves de um jeito que um alto-falante não consegue.',
        labs: ['resonator'],
        related: ['drivers/driver-dinamico', 'drivers/construcao-acustica'],
      },
      {
        slug: 'driver-dinamico',
        title: 'Driver dinâmico',
        summary:
          'Bobina, ímã, diafragma e suspensão: o mecanismo mais antigo e mais comum, seus modos de ruptura e o que materiais realmente mudam.',
        labs: ['drivers'],
        related: ['drivers/transdutores', 'drivers/planar-magnetico'],
      },
      {
        slug: 'balanced-armature',
        title: 'Balanced armature (BA)',
        summary:
          'A armadura equilibrada vinda dos aparelhos auditivos: como funciona, por que é pequena e eficiente e por que precisa de tubos e filtros.',
        labs: ['drivers'],
        related: ['drivers/multi-driver-e-crossovers', 'eletronica/potencia-e-sensibilidade'],
      },
      {
        slug: 'planar-magnetico',
        title: 'Planar magnético',
        summary:
          'Um condutor desenhado sobre uma membrana fina entre ímãs: força distribuída, baixa massa e os desafios de levar a tecnologia para dentro do ouvido.',
        labs: ['drivers'],
        related: ['drivers/driver-dinamico', 'drivers/eletrostatico-e-piezo'],
        featured: true,
      },
      {
        slug: 'eletrostatico-e-piezo',
        title: 'Eletrostáticos e piezoelétricos',
        summary:
          'Membranas carregadas em campos elétricos e cerâmicas que se deformam com a tensão: princípios, vantagens e limitações.',
        labs: ['drivers'],
        related: ['drivers/planar-magnetico', 'drivers/multi-driver-e-crossovers'],
      },
      {
        slug: 'multi-driver-e-crossovers',
        title: 'Multi-driver, híbridos e crossovers',
        summary:
          'Dividir o espectro entre drivers: filtros elétricos e acústicos, soma de fases e por que mais drivers não significam mais qualidade.',
        labs: ['crossover'],
        related: ['drivers/balanced-armature', 'iems/tuning'],
      },
      {
        slug: 'construcao-acustica',
        title: 'Câmaras, tubos, ventilação e formatos',
        summary:
          'Ressonadores de Helmholtz, tubos de quarto de onda, amortecedores, ventilação, open-back vs closed-back e as diferenças entre headphones, earbuds e IEMs.',
        labs: ['tube'],
        related: ['iems/tuning', 'drivers/transdutores'],
      },
    ],
  },
  {
    id: 'eletronica',
    number: '05',
    title: 'Eletrônica e equipamentos',
    short: 'Eletrônica',
    description:
      'Construindo do zero: tensão, corrente, impedância, DACs, amplificadores, potência, distorção, ruído, válvulas e conexões.',
    articles: [
      {
        slug: 'eletricidade-basica',
        title: 'Eletricidade do zero: tensão, corrente, resistência e potência',
        summary:
          'Lei de Ohm, potência e energia, explicadas com a física do que realmente acontece num fio — e um circuito interativo para experimentar.',
        labs: ['ohm'],
        related: ['eletronica/corrente-alternada-e-impedancia', 'eletronica/potencia-e-sensibilidade'],
      },
      {
        slug: 'corrente-alternada-e-impedancia',
        title: 'Corrente alternada, capacitância, indutância e impedância',
        summary:
          'Por que a “resistência” de um fone muda com a frequência e por que isso importa tanto em IEMs com vários drivers.',
        labs: ['impedance'],
        related: ['eletronica/potencia-e-sensibilidade', 'drivers/multi-driver-e-crossovers'],
      },
      {
        slug: 'dac-e-adc',
        title: 'DACs e ADCs: como números viram tensão',
        summary:
          'Conversão digital-analógica sem metáforas erradas: amostras, retenção, filtros de reconstrução, sobreamostragem, sigma-delta e jitter.',
        labs: ['dac'],
        related: ['digital/amostragem', 'eletronica/amplificadores'],
        featured: true,
      },
      {
        slug: 'amplificadores',
        title: 'Amplificadores e pré-amplificadores',
        summary:
          'O que é amplificar, ganho de tensão e de corrente, classes A/AB/D, realimentação, e o papel exato de um pré-amplificador.',
        labs: ['gain'],
        related: ['eletronica/potencia-e-sensibilidade', 'eletronica/valvulas-vs-transistores'],
      },
      {
        slug: 'potencia-e-sensibilidade',
        title: 'Sensibilidade, potência e impedância de saída',
        summary:
          'Quanto de tensão, corrente e potência um fone precisa, dB/mW vs dB/V, headroom, e por que baixa impedância não é sinônimo de fácil de tocar.',
        labs: ['power', 'output-impedance'],
        related: ['eletronica/corrente-alternada-e-impedancia', 'iems/fonte-dac-amp-ou-eq'],
        featured: true,
      },
      {
        slug: 'medidas-de-desempenho',
        title: 'THD, ruído, SNR e faixa dinâmica',
        summary:
          'O que cada especificação de um DAC/amp realmente mede, como ler os números e quando o chiado de fundo vira problema real em IEMs sensíveis.',
        labs: ['distortion', 'hiss'],
        related: ['ciencia/mensuravel-vs-audivel', 'eletronica/valvulas-vs-transistores'],
      },
      {
        slug: 'valvulas-vs-transistores',
        title: 'Amplificadores valvulados vs transistorizados',
        summary:
          'Física das válvulas e dos transistores, perfis de distorção, impedância de saída, transformadores e por que muitos gostam do som “valvulado”.',
        labs: ['distortion'],
        related: ['eletronica/amplificadores', 'eletronica/medidas-de-desempenho'],
      },
      {
        slug: 'conexoes-e-cadeia',
        title: 'Conexões, cabos e o resto da cadeia de áudio',
        summary:
          'P2, 4,4 mm e 2,5 mm, saídas balanceadas, propriedades elétricas dos cabos, interfaces de áudio, monitores e subwoofers.',
        labs: ['cable'],
        related: ['eletronica/amplificadores', 'ciencia/avaliando-alegacoes'],
      },
    ],
  },
  {
    id: 'digital',
    number: '06',
    title: 'Áudio digital',
    short: 'Digital',
    description:
      'Amostragem, quantização, formatos, compressão, Bluetooth e normalização — com a matemática certa e sem mitos sobre degraus.',
    articles: [
      {
        slug: 'amostragem',
        title: 'Amostragem e o teorema de Nyquist-Shannon',
        summary:
          'Por que amostras discretas podem representar perfeitamente um sinal contínuo limitado em banda, o que é aliasing e como a reconstrução funciona.',
        labs: ['sampling'],
        related: ['eletronica/dac-e-adc', 'digital/quantizacao-e-dither'],
        featured: true,
      },
      {
        slug: 'quantizacao-e-dither',
        title: 'Quantização, bit depth e dither',
        summary:
          'O que os bits realmente determinam (ruído, não “resolução” de degraus), faixa dinâmica, e por que adicionar ruído pode melhorar um sinal.',
        labs: ['quantization'],
        related: ['digital/amostragem', 'ciencia/mensuravel-vs-audivel'],
      },
      {
        slug: 'formatos-e-compressao',
        title: 'PCM, DSD e formatos: lossless vs lossy',
        summary:
          'WAV, FLAC, MP3, AAC, Opus e DSD: como funcionam, o que é bitrate e como a codificação perceptiva usa o mascaramento auditivo.',
        related: ['percepcao/mascaramento', 'digital/bluetooth'],
      },
      {
        slug: 'bluetooth',
        title: 'Bluetooth: codecs, latência e limites reais',
        summary:
          'SBC, AAC, aptX, LDAC, LC3: o que muda entre eles, de onde vem a latência e onde estão os verdadeiros gargalos dos fones sem fio.',
        related: ['digital/formatos-e-compressao', 'iems/fonte-dac-amp-ou-eq'],
      },
      {
        slug: 'loudness-e-resampling',
        title: 'Resampling, normalização de loudness e ReplayGain',
        summary:
          'LUFS, true peak, a guerra do volume, como os serviços de streaming normalizam faixas e o que acontece quando o sample rate é convertido.',
        related: ['fundamentos/decibeis', 'processamento/equalizador-parametrico'],
      },
    ],
  },
  {
    id: 'processamento',
    number: '07',
    title: 'Equalização e processamento',
    short: 'EQ e processamento',
    description:
      'Filtros, equalizadores paramétricos funcionais, preamp, clipping, compressão, crossfeed — e uma análise honesta do que EQ consegue corrigir.',
    articles: [
      {
        slug: 'filtros-e-eq',
        title: 'Filtros e EQ: frequência, ganho e Q',
        summary:
          'Peak, shelf, passa-baixas e passa-altas; o que o fator Q significa matematicamente e como cada filtro altera a curva.',
        labs: ['filter'],
        related: ['processamento/equalizador-parametrico', 'resposta/lendo-graficos'],
      },
      {
        slug: 'equalizador-parametrico',
        title: 'Equalizador paramétrico, preamp e clipping',
        summary:
          'Um EQ paramétrico completo, funcionando com seus próprios arquivos, e tudo sobre headroom, preamp e clipping digital.',
        labs: ['peq'],
        related: ['processamento/filtros-e-eq', 'processamento/limites-da-eq'],
        featured: true,
      },
      {
        slug: 'limites-da-eq',
        title: 'O que a EQ consegue (e não consegue) corrigir',
        summary:
          'Quanto dá para transformar um fone com equalização: fase mínima, vedação, distorção, excursão, variação de posicionamento e um laboratório de autoEQ.',
        labs: ['autoeq'],
        related: ['resposta/sua-curva', 'iems/fonte-dac-amp-ou-eq'],
        featured: true,
      },
      {
        slug: 'dinamica-e-espacializacao',
        title: 'Compressão, limiter, distorção e crossfeed',
        summary:
          'Processadores de dinâmica e de espaço: o que fazem, como funcionam e por que não são “EQ”.',
        labs: ['dynamics', 'crossfeed'],
        related: ['percepcao/localizacao-espacial', 'digital/loudness-e-resampling'],
      },
    ],
  },
  {
    id: 'iems',
    number: '08',
    title: 'Guia aprofundado de IEMs',
    short: 'IEMs',
    description:
      'Tudo o que importa num in-ear monitor: vedação, ponteiras, tuning, separação, especificações, fontes, comparação justa e compra consciente.',
    articles: [
      {
        slug: 'o-que-sao-iems',
        title: 'O que são IEMs e por que são diferentes',
        summary:
          'Da música ao vivo ao uso diário: isolamento, acoplamento com o canal auditivo e como um IEM difere de headphones e earbuds.',
        related: ['iems/vedacao-e-ponteiras', 'drivers/transdutores'],
        featured: true,
      },
      {
        slug: 'vedacao-e-ponteiras',
        title: 'Vedação, ponteiras e profundidade de inserção',
        summary:
          'Por que o encaixe muda o grave em vários dB, silicone vs espuma, diâmetro do furo, profundidade e um simulador de encaixe.',
        labs: ['fit'],
        related: ['percepcao/percepcao-individual', 'iems/tuning'],
        featured: true,
      },
      {
        slug: 'tuning',
        title: 'Tuning: como um IEM é afinado, da bancada à fábrica',
        summary:
          'Do alvo ao produto: escolha de drivers, filtros acústicos, tubos, ventilação, crossover, protótipos, medições e controle de qualidade em produção.',
        labs: ['tuning'],
        related: ['resposta/como-se-mede', 'drivers/multi-driver-e-crossovers'],
        featured: true,
      },
      {
        slug: 'separacao-e-resolucao',
        title: 'Separação, resolução, imagem e palco sonoro',
        summary:
          'O que um fone precisa ter para você distinguir instrumentos — inclusive dentro dos médios — e quais desses atributos são mensuráveis.',
        labs: ['mistuned', 'masking'],
        related: ['percepcao/mascaramento', 'fundamentos/melodia-e-harmonia'],
        featured: true,
      },
      {
        slug: 'especificacoes-e-reviews',
        title: 'Especificações, medições e reviews',
        summary:
          'Como ler uma ficha técnica, o que cada número informa (e omite), como interpretar reviews e o vocabulário subjetivo.',
        related: ['resposta/como-se-mede', 'ciencia/o-que-medicoes-mostram'],
      },
      {
        slug: 'fonte-dac-amp-ou-eq',
        title: 'DAC/amp, dongle ou equalização por software?',
        summary:
          'O que cada solução muda de verdade, quando um dongle simples basta e por que EQ e amplificação resolvem problemas diferentes.',
        labs: ['output-impedance', 'power'],
        related: ['eletronica/potencia-e-sensibilidade', 'processamento/limites-da-eq'],
        featured: true,
      },
      {
        slug: 'comparando-iems',
        title: 'Comparar IEMs com honestidade: A/B, volume e marketing',
        summary:
          'Como fazer comparações controladas, compatibilizar volume, reconhecer marketing exagerado e pseudociência.',
        labs: ['levelmatch'],
        related: ['ciencia/testes-cegos-e-abx', 'percepcao/sonoridade-e-volume'],
      },
      {
        slug: 'guia-de-compra',
        title: 'Guia de compra por prioridades',
        summary:
          'Um roteiro baseado no que realmente importa — conforto, tonalidade, isolamento, sensibilidade, durabilidade e EQ — sem rankings de opinião.',
        labs: ['buying'],
        related: ['iems/comparando-iems', 'resposta/sua-curva'],
      },
      {
        slug: 'cuidados-e-manutencao',
        title: 'Cuidados, limpeza e durabilidade',
        summary:
          'Cera, umidade, filtros de bocal, cabos e conectores: como manter um IEM funcionando bem por anos.',
        related: ['percepcao/saude-auditiva', 'iems/vedacao-e-ponteiras'],
      },
    ],
  },
  {
    id: 'ciencia',
    number: '09',
    title: 'Medições, ciência e pensamento crítico',
    short: 'Ciência',
    description:
      'Como avaliar evidências em áudio: o alcance e os limites das medições, testes cegos, estatística, viés e alegações extraordinárias.',
    articles: [
      {
        slug: 'o-que-medicoes-mostram',
        title: 'O que medições mostram — e o que não mostram',
        summary:
          'Medições isoladas, variação entre unidades, tolerâncias de fabricação e acoplamento: como tirar conclusões corretas de um gráfico.',
        labs: ['variation'],
        related: ['resposta/como-se-mede', 'ciencia/mensuravel-vs-audivel'],
      },
      {
        slug: 'testes-cegos-e-abx',
        title: 'Testes cegos, ABX e estatística',
        summary:
          'Como funciona um ABX, por que controlar volume é obrigatório e como interpretar resultados com estatística — com um ABX funcional.',
        labs: ['abx'],
        related: ['ciencia/vies-e-placebo', 'iems/comparando-iems'],
        featured: true,
      },
      {
        slug: 'vies-e-placebo',
        title: 'Viés, expectativa e os limites da palavra “placebo”',
        summary:
          'Como expectativa, preço, aparência e memória moldam o que ouvimos — e por que “é placebo” também pode ser uma conclusão apressada.',
        related: ['ciencia/testes-cegos-e-abx', 'ciencia/avaliando-alegacoes'],
      },
      {
        slug: 'mensuravel-vs-audivel',
        title: 'Mensurável não é o mesmo que audível',
        summary:
          'Limiares de audibilidade para distorção, ruído, jitter, resposta em frequência e alta resolução, segundo a literatura.',
        related: ['eletronica/medidas-de-desempenho', 'digital/quantizacao-e-dither'],
      },
      {
        slug: 'avaliando-alegacoes',
        title: 'Como avaliar uma alegação em áudio',
        summary:
          'Um roteiro prático para separar engenharia, preferência e pseudociência — e uma lista comentada de fontes confiáveis.',
        related: ['ciencia/vies-e-placebo', 'iems/comparando-iems'],
      },
    ],
  },
];

export interface FlatArticle extends ArticleEntry {
  id: string; // modulo/slug
  module: ModuleEntry;
  index: number;
}

export const allArticles: FlatArticle[] = modules.flatMap((m) =>
  m.articles.map((a, index) => ({ ...a, id: `${m.id}/${a.slug}`, module: m, index })),
);

export const articleById = new Map(allArticles.map((a) => [a.id, a]));

export function articlePath(id: string) {
  return `/${id}`;
}
