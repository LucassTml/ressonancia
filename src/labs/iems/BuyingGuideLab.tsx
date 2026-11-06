import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { LabFrame, Note } from '../../components/ui/LabFrame';
import { Segmented, Slider, Toggle } from '../../components/ui/controls';

type Use = 'commute' | 'home' | 'sport' | 'stage' | 'work';
type Source = 'phone-jack' | 'phone-usbc' | 'dongle' | 'desk' | 'wireless';
type Taste = 'neutral' | 'harman' | 'warm' | 'bright' | 'bass' | 'unknown';

interface Prefs {
  use: Use;
  source: Source;
  taste: Taste;
  eq: boolean;
  comfort: number;
  isolation: number;
  durability: number;
  budget: number; // 1 a 4
  earSmall: boolean;
  wireless: boolean;
}

const D: Prefs = { use: 'commute', source: 'phone-usbc', taste: 'harman', eq: true, comfort: 3, isolation: 2, durability: 2, budget: 2, earSmall: false, wireless: false };

interface Item {
  title: string;
  text: string;
  kind: 'priorizar' | 'verificar' | 'ignorar' | 'evitar';
}

function advise(p: Prefs): Item[] {
  const out: Item[] = [];
  // formato e encaixe
  if (p.comfort >= 2 || p.earSmall)
    out.push({ kind: 'priorizar', title: 'Encaixe antes de tudo', text: `Procure carcaças ${p.earSmall ? 'pequenas e leves, com bocal curto e fino' : 'de tamanho moderado, com bocal de diâmetro médio'}. Um IEM que não veda bem perde vários dB de grave e não há EQ que compense. Prefira lojas com política de troca ou modelos com medidas de carcaça publicadas.` });
  out.push({ kind: 'verificar', title: 'Ponteiras incluídas', text: 'Vários tamanhos e pelo menos dois tipos (silicone de furo largo e estreito, ou espuma). Ponteiras de reposição são baratas e mudam muito o resultado.' });
  // isolamento e uso
  if (p.use === 'commute' || p.isolation >= 2)
    out.push({ kind: 'priorizar', title: 'Isolamento', text: 'Carcaça bem vedada, de preferência com pouca ventilação; espumas aumentam o isolamento. Mais isolamento permite ouvir mais baixo — o melhor que você pode fazer pela sua audição em transporte.' });
  if (p.use === 'sport') out.push({ kind: 'priorizar', title: 'Fixação e resistência a suor', text: 'Cabo por trás da orelha com guia, carcaça leve, conectores protegidos. Sem fio com boa resistência à água pode ser mais prático.' });
  if (p.use === 'stage') out.push({ kind: 'priorizar', title: 'Isolamento e consistência', text: 'Para monitoração de palco, isolamento alto e conforto por horas são prioridade; moldes personalizados podem valer a pena.' });
  if (p.use === 'work') out.push({ kind: 'verificar', title: 'Microfone e conforto prolongado', text: 'Cabo com microfone (TRRS) ou modelos sem fio com bons microfones; carcaça que não pressione após horas de uso.' });
  // fonte
  if (p.source === 'phone-usbc' || p.source === 'phone-jack') out.push({ kind: 'verificar', title: 'Sensibilidade compatível com a fonte', text: 'Com saída de celular ou dongle simples, prefira IEMs com sensibilidade acima de ~100 dB/V. Use a calculadora de potência: a maioria dos IEMs não precisa de amplificador.' });
  if (p.source === 'phone-usbc') out.push({ kind: 'verificar', title: 'Um dongle USB-C de qualidade', text: 'Se o celular não tem saída P2, um dongle bem medido (baixa impedância de saída, ruído baixo) resolve. Gastar mais que isso em fonte raramente muda algo com IEMs.' });
  if (p.source === 'desk') out.push({ kind: 'verificar', title: 'Ganho baixo e ruído', text: 'Amplificadores de mesa com ganho alto podem gerar chiado em IEMs sensíveis. Prefira modos de ganho baixo e verifique a impedância de saída.' });
  if (p.source !== 'wireless') out.push({ kind: 'evitar', title: 'Fontes com impedância de saída alta + IEM multi-BA', text: 'Saídas acima de ~2 Ω (alguns notebooks, amplificadores antigos ou valvulados) mudam a resposta de IEMs com vários BAs. Com dinâmicos ou planares, o efeito é pequeno.' });
  if (p.wireless || p.source === 'wireless') out.push({ kind: 'priorizar', title: 'Sem fio: tuning, vedação e ANC', text: 'Em fones sem fio, o codec importa menos que o tuning do fabricante, a vedação e o cancelamento de ruído. Verifique se o aplicativo tem EQ paramétrico ou ao menos de várias bandas.' });
  // tonalidade
  const tasteText: Record<Taste, string> = {
    neutral: 'Procure medições próximas do campo difuso ou do Harman sem shelf, com médios lisos entre 1 e 5 kHz.',
    harman: 'Procure medições dentro de ~2 dB do Harman IE entre 100 Hz e 5 kHz, sem picos estreitos acima de 5 kHz.',
    warm: 'Procure um shelf de grave acima do Harman e presença (2–5 kHz) alguns dB abaixo; atenção para graves que invadem os médios-graves.',
    bright: 'Procure presença e agudos acima do alvo, mas com picos suaves: brilho largo cansa menos do que picos estreitos.',
    bass: 'Procure um shelf de grave alto que termine abaixo de ~200 Hz, para não embolar os médios; driver dinâmico costuma facilitar com baixa distorção.',
    unknown: 'Comece por algo próximo do Harman IE — é o ponto de partida preferido pela maioria — e descubra seu gosto com o laboratório de preferência e EQ.',
  };
  out.push({ kind: 'priorizar', title: 'Tonalidade', text: tasteText[p.taste] + (p.eq ? ' Como você aceita usar EQ, desvios largos de 2–4 dB são facilmente corrigíveis; priorize baixa distorção e encaixe.' : ' Sem EQ, a tonalidade de fábrica é o que você vai ouvir: dê mais peso a ela.') });
  // durabilidade
  if (p.durability >= 2) out.push({ kind: 'priorizar', title: 'Cabo removível e conector', text: 'Cabo destacável (2 pinos de 0,78 mm tende a ser mais durável que MMCX em trocas frequentes), carcaça resistente, filtro de bocal que proteja contra cera, garantia e disponibilidade de peças.' });
  // orçamento
  const budgetText = ['Neste orçamento, a diferença entre bons e maus modelos está quase toda no tuning e no encaixe — há IEMs baratos muito bem medidos.', 'Faixa em que se encontram IEMs muito bem afinados e construídos. Gaste o que sobrar em ponteiras e, se necessário, num dongle — não em cabos.', 'Acima desta faixa, o ganho de desempenho medido diminui muito; você paga por acabamento, materiais, marca e variações de tuning.', 'Em faixas muito altas, priorize conforto, consistência e suporte. Desconfie de justificativas baseadas em número de drivers ou materiais exóticos.'];
  out.push({ kind: 'verificar', title: 'Orçamento', text: budgetText[p.budget - 1] });
  // ignorar
  out.push({ kind: 'ignorar', title: 'Número de drivers', text: 'Não indica qualidade. Um único driver bem afinado pode superar configurações com oito ou dez.' });
  out.push({ kind: 'ignorar', title: 'Cabos “de upgrade”, materiais exóticos e “amaciamento”', text: 'Escolha cabos por conforto e durabilidade. Não há evidência de que materiais de cabo ou amaciamento mudem o som de forma audível.' });
  out.push({ kind: 'ignorar', title: 'Resposta “5 Hz – 40 kHz” na caixa', text: 'Faixas de frequência sem tolerância em dB não dizem nada. Prefira um gráfico de medição de uma fonte independente.' });
  return out;
}

const KIND: Record<Item['kind'], { label: string; color: string }> = {
  priorizar: { label: 'Priorizar', color: 'var(--accent)' },
  verificar: { label: 'Verificar', color: 'var(--c-target)' },
  evitar: { label: 'Evitar', color: 'var(--myth)' },
  ignorar: { label: 'Pode ignorar', color: 'var(--fg-muted)' },
};

export default function BuyingGuideLab() {
  const [p, setP] = useState<Prefs>(D);
  const set = <K extends keyof Prefs>(k: K, v: Prefs[K]) => setP((x) => ({ ...x, [k]: v }));
  const items = useMemo(() => advise(p), [p]);
  const order: Item['kind'][] = ['priorizar', 'verificar', 'evitar', 'ignorar'];

  return (
    <LabFrame
      title="Roteiro de compra por prioridades"
      description="Responda o que importa para você e receba uma lista do que priorizar, verificar e ignorar ao escolher um IEM. Não há ranking de produtos: a ideia é saber o que procurar nas medições e nas especificações."
      onReset={() => setP(D)}
      footer="O roteiro aplica os critérios discutidos neste módulo. Ele não substitui ouvir (e, principalmente, experimentar o encaixe) — mas ajuda a separar o que é decisivo do que é marketing."
    >
      <div className="grid lg:grid-cols-[1fr_1.25fr] gap-6">
        <div className="space-y-4">
          <div>
            <div className="text-[12.5px] text-muted font-medium mb-1.5">Uso principal</div>
            <Segmented size="sm" value={p.use} onChange={(v) => set('use', v)} options={[{ value: 'commute', label: 'Transporte' }, { value: 'home', label: 'Casa' }, { value: 'work', label: 'Trabalho' }, { value: 'sport', label: 'Esporte' }, { value: 'stage', label: 'Palco' }]} />
          </div>
          <div>
            <div className="text-[12.5px] text-muted font-medium mb-1.5">Fonte</div>
            <Segmented size="sm" value={p.source} onChange={(v) => set('source', v)} options={[{ value: 'phone-jack', label: 'Celular com P2' }, { value: 'phone-usbc', label: 'Celular USB-C' }, { value: 'dongle', label: 'Dongle' }, { value: 'desk', label: 'Amp de mesa' }, { value: 'wireless', label: 'Sem fio' }]} />
          </div>
          <div>
            <div className="text-[12.5px] text-muted font-medium mb-1.5">Gosto tonal</div>
            <Segmented size="sm" value={p.taste} onChange={(v) => set('taste', v)} options={[{ value: 'harman', label: 'Harman' }, { value: 'neutral', label: 'Neutro' }, { value: 'warm', label: 'Quente' }, { value: 'bright', label: 'Brilhante' }, { value: 'bass', label: 'Muito grave' }, { value: 'unknown', label: 'Não sei' }]} />
          </div>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
            <Slider label="Importância do conforto" value={p.comfort} min={0} max={3} step={1} onChange={(v) => set('comfort', v)} format={(v) => ['baixa', 'média', 'alta', 'máxima'][v]} />
            <Slider label="Importância do isolamento" value={p.isolation} min={0} max={3} step={1} onChange={(v) => set('isolation', v)} format={(v) => ['baixa', 'média', 'alta', 'máxima'][v]} />
            <Slider label="Importância da durabilidade" value={p.durability} min={0} max={3} step={1} onChange={(v) => set('durability', v)} format={(v) => ['baixa', 'média', 'alta', 'máxima'][v]} />
            <Slider label="Orçamento" value={p.budget} min={1} max={4} step={1} onChange={(v) => set('budget', v)} format={(v) => ['econômico', 'intermediário', 'alto', 'muito alto'][v - 1]} />
          </div>
          <div className="flex flex-wrap gap-4">
            <Toggle checked={p.eq} onChange={(v) => set('eq', v)} label="Aceito usar EQ" />
            <Toggle checked={p.earSmall} onChange={(v) => set('earSmall', v)} label="Orelhas/canais pequenos" />
            <Toggle checked={p.wireless} onChange={(v) => set('wireless', v)} label="Quero sem fio" />
          </div>
        </div>
        <div className="space-y-5">
          {order.map((k) => {
            const list = items.filter((i) => i.kind === k);
            if (!list.length) return null;
            return (
              <div key={k}>
                <div className="text-[11px] uppercase tracking-[0.12em] font-semibold mb-2" style={{ color: KIND[k].color }}>
                  {KIND[k].label}
                </div>
                <ul className="space-y-2.5">
                  <AnimatePresence initial={false}>
                    {list.map((it) => (
                      <motion.li key={it.title} layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-[13px] leading-relaxed">
                        <strong className="text-fg font-medium">{it.title}.</strong> <span className="text-soft">{it.text}</span>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-4">
        <Note>Leve esta lista ao ler reviews e medições: ela transforma “qual é o melhor IEM?” em “qual IEM atende a estes critérios para mim?”.</Note>
      </div>
    </LabFrame>
  );
}
