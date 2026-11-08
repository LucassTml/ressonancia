import { useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { LabFrame, Controls, Note } from '../../components/ui/LabFrame';
import { Segmented, Slider, Toggle } from '../../components/ui/controls';
import { useAnimationFrame, useInView } from '../../lib/hooks';
import { tr } from '../../i18n';

type Kind = 'dd' | 'ba' | 'planar' | 'est' | 'piezo';

const INFO: Record<Kind, { name: string; how: string; pros: string; cons: string }> = {
  dd: {
    name: tr("Driver dinâmico"),
    how: tr("Uma bobina presa ao diafragma fica num entreferro com campo magnético radial. A corrente do sinal na bobina sofre a força de Lorentz F = B·l·i e empurra bobina e diafragma juntos."),
    pros: tr("Desloca bastante ar com facilidade (graves potentes), construção simples e robusta, impedância quase constante."),
    cons: tr("Massa da bobina e do diafragma; acima de certas frequências o diafragma deixa de se mover como um pistão (modos de ruptura) e precisa de bom controle de materiais e amortecimento."),
  },
  ba: {
    name: tr("Balanced armature"),
    how: tr("Uma palheta de metal magnético (a armadura) atravessa uma bobina e fica equilibrada entre dois ímãs. A corrente magnetiza a armadura, cuja ponta é atraída para um ímã ou outro; uma haste transmite o movimento a um diafragma minúsculo dentro de uma caixa selada com bocal."),
    pros: tr("Muito pequeno e eficiente, alta sensibilidade, permite combinar vários drivers especializados num IEM."),
    cons: tr("Excursão pequena e resposta naturalmente irregular, com ressonâncias que exigem tubos, filtros e crossovers; impedância que varia muito com a frequência."),
  },
  planar: {
    name: tr("Planar magnético"),
    how: tr("Um condutor plano (uma trilha em zigue-zague) é depositado sobre uma membrana muito fina, colocada entre fileiras de ímãs. O campo é paralelo à membrana na posição das trilhas; a força age sobre toda a superfície ao mesmo tempo."),
    pros: tr("Força distribuída: a membrana se move quase inteira em fase, com baixa massa por área. Tende a ter boa linearidade e baixa distorção."),
    cons: tr("Ímãs e grades na frente da membrana; menos sensível que BAs; em IEMs, a área pequena limita o deslocamento de ar e a implementação acústica é desafiadora."),
  },
  est: {
    name: tr("Eletrostático"),
    how: tr("Uma membrana ultrafina recebe uma carga elétrica fixa (tensão de polarização alta) e fica entre duas placas perfuradas (estatores). O sinal é aplicado em contrafase aos estatores: o campo elétrico atrai a membrana para um lado e a repele do outro."),
    pros: tr("Massa extremamente baixa e força distribuída; excelente para agudos."),
    cons: tr("Precisa de tensões altas (energizador ou transformador elevador embutido); em IEMs aparece como tweeter (EST) com faixa limitada, quase sempre em configurações híbridas."),
  },
  piezo: {
    name: tr("Piezoelétrico"),
    how: tr("Cristais ou cerâmicas piezoelétricas se deformam quando submetidos a tensão. Em um bimorfo, duas camadas coladas se expandem e contraem em sentidos opostos, fazendo o conjunto flexionar e mover o ar."),
    pros: tr("Fino, sem ímã, eficiente em altas frequências; útil como super-tweeter."),
    cons: tr("Comportamento capacitivo, resposta com ressonâncias pronunciadas e pouca excursão; a implementação define se soa suave ou áspero."),
  },
};

function Waves({ x, y, amp, phase, dir = 1, n = 4 }: { x: number; y: number; amp: number; phase: number; dir?: 1 | -1; n?: number }) {
  return (
    <g stroke="var(--accent)" fill="none" strokeLinecap="round">
      {Array.from({ length: n }, (_, k) => {
        const p = (phase / (2 * Math.PI) + k / n) % 1;
        const r = 10 + p * 60;
        return <path key={k} d={`M${x + dir * r},${y - 34 - p * 20} Q${x + dir * (r + 8)},${y} ${x + dir * r},${y + 34 + p * 20}`} strokeWidth={1.4} opacity={(1 - p) * Math.min(1, 0.25 + amp)} />;
      })}
    </g>
  );
}

function Dynamic({ d, i, field }: { d: number; i: number; field: boolean }) {
  const x = d * 9;
  return (
    <g>
      {/* placa traseira, polo, ímã, placa superior */}
      <rect x={40} y={50} width={16} height={140} fill="var(--fg-faint)" opacity={0.6} rx={2} />
      <rect x={56} y={108} width={84} height={24} fill="var(--fg-faint)" opacity={0.6} />
      <rect x={56} y={52} width={50} height={40} fill="#d9534f" opacity={0.7} />
      <rect x={56} y={148} width={50} height={40} fill="#d9534f" opacity={0.7} />
      <text x={81} y={76} textAnchor="middle" className="fill-white text-[10px] font-semibold">{tr("ímã")}</text>
      <rect x={106} y={52} width={26} height={42} fill="var(--fg-faint)" opacity={0.6} />
      <rect x={106} y={146} width={26} height={42} fill="var(--fg-faint)" opacity={0.6} />
      {field && (
        <g stroke="#5fb3e8" strokeWidth={1.2} markerEnd="url(#arr)">
          {[114, 120, 126].map((xx) => (
            <g key={xx}>
              <line x1={xx} y1={95} x2={xx} y2={106} />
              <line x1={xx} y1={145} x2={xx} y2={134} />
            </g>
          ))}
        </g>
      )}
      {/* bobina no entreferro */}
      <g transform={`translate(${x} 0)`}>
        <rect x={110} y={96} width={22} height={9} rx={2} fill="var(--c-b)" />
        <rect x={110} y={135} width={22} height={9} rx={2} fill="var(--c-b)" />
        <text x={121} y={103} textAnchor="middle" className="fill-[var(--bg)] text-[8px] font-bold">{i >= 0 ? '⊙' : '⊗'}</text>
        <text x={121} y={142} textAnchor="middle" className="fill-[var(--bg)] text-[8px] font-bold">{i >= 0 ? '⊗' : '⊙'}</text>
        <line x1={132} y1={100} x2={150} y2={86} stroke="var(--c-b)" strokeWidth={1.5} />
        <line x1={132} y1={140} x2={150} y2={154} stroke="var(--c-b)" strokeWidth={1.5} />
        {/* diafragma em domo */}
        <path d="M150,58 Q182,120 150,182" fill="none" stroke="var(--fg)" strokeWidth={2.4} />
      </g>
      {/* suspensão e chassi */}
      <path d={`M150,50 q${4 + x / 2},4 ${x},8`} stroke="var(--fg-muted)" fill="none" strokeWidth={1.5} />
      <path d={`M150,190 q${4 + x / 2},-4 ${x},-8`} stroke="var(--fg-muted)" fill="none" strokeWidth={1.5} />
      <line x1={56} y1={48} x2={150} y2={48} stroke="var(--line-strong)" />
      <line x1={56} y1={192} x2={150} y2={192} stroke="var(--line-strong)" />
      {field && (
        <g>
          <line x1={170 + x} y1={120} x2={170 + x + i * 26} y2={120} stroke="var(--c-b)" strokeWidth={2} markerEnd="url(#arrB)" />
          <text x={176} y={110} className="fill-[var(--c-b)] text-[10px]">F = B·l·i</text>
        </g>
      )}
    </g>
  );
}

function BA({ d, i, field }: { d: number; i: number; field: boolean }) {
  const tip = d * 7;
  const angle = (Math.atan2(tip, 170) * 180) / Math.PI;
  return (
    <g>
      <rect x={40} y={60} width={250} height={130} rx={8} fill="var(--bg-sunken)" stroke="var(--line-strong)" />
      {/* bocal */}
      <rect x={290} y={70} width={46} height={18} fill="var(--bg-sunken)" stroke="var(--line-strong)" />
      <text x={313} y={104} textAnchor="middle" className="fill-[var(--fg-muted)] text-[9px]">{tr("bocal")}</text>
      {/* bobina */}
      <rect x={80} y={135} width={70} height={36} rx={4} fill="var(--c-b)" opacity={0.8} />
      <text x={115} y={157} textAnchor="middle" className="fill-[var(--bg)] text-[10px] font-semibold">{tr("bobina")}</text>
      {/* ímãs */}
      <rect x={180} y={128} width={56} height={14} fill="#d9534f" opacity={0.75} />
      <rect x={180} y={168} width={56} height={14} fill="#5f8fd9" opacity={0.75} />
      <text x={208} y={139} textAnchor="middle" className="fill-white text-[9px] font-bold">N</text>
      <text x={208} y={179} textAnchor="middle" className="fill-white text-[9px] font-bold">S</text>
      {/* armadura (pivô à esquerda) */}
      <g transform={`rotate(${angle} 60 155)`}>
        <line x1={60} y1={155} x2={230} y2={155} stroke="var(--fg)" strokeWidth={3} strokeLinecap="round" />
        {field && <text x={222} y={150} className={`text-[9px] font-bold ${i >= 0 ? 'fill-[#5f8fd9]' : 'fill-[#d9534f]'}`}>{i >= 0 ? 'N' : 'S'}</text>}
      </g>
      <line x1={60} y1={155} x2={60} y2={182} stroke="var(--fg)" strokeWidth={3} />
      {/* haste e diafragma */}
      <line x1={226} y1={155 + tip * 0.95} x2={226} y2={95 + tip} stroke="var(--fg-muted)" strokeWidth={1.6} />
      <path d={`M150,95 Q${226},${95 + tip * 1.4} 288,95`} fill="none" stroke="var(--accent)" strokeWidth={2.2} />
      <text x={170} y={88} className="fill-[var(--fg-muted)] text-[9px]">{tr("diafragma")}</text>
      <text x={70} y={128} className="fill-[var(--fg-muted)] text-[9px]">{tr("armadura")}</text>
    </g>
  );
}

function Planar({ d, i, field }: { d: number; i: number; field: boolean }) {
  const x = d * 6;
  const ys = [56, 96, 136, 176];
  return (
    <g>
      {ys.map((y, k) => (
        <g key={y}>
          <rect x={140} y={y - 12} width={30} height={24} rx={3} fill={k % 2 ? '#5f8fd9' : '#d9534f'} opacity={0.75} />
          <rect x={250} y={y - 12} width={30} height={24} rx={3} fill={k % 2 ? '#d9534f' : '#5f8fd9'} opacity={0.75} />
        </g>
      ))}
      {field &&
        [76, 116, 156].map((y) => (
          <g key={y} stroke="#5fb3e8" strokeWidth={1} fill="none" opacity={0.7}>
            <path d={`M170,${y - 14} Q200,${y} 170,${y + 14}`} />
            <path d={`M250,${y - 14} Q220,${y} 250,${y + 14}`} />
          </g>
        ))}
      <g transform={`translate(${x} 0)`}>
        <line x1={210} y1={40} x2={210} y2={196} stroke="var(--fg)" strokeWidth={1.6} />
        {[76, 116, 156].map((y, k) => (
          <g key={y}>
            <circle cx={210} cy={y} r={5} fill="var(--c-b)" />
            <text x={210} y={y + 3} textAnchor="middle" className="fill-[var(--bg)] text-[7px] font-bold">{(k % 2 === 0) === i >= 0 ? '⊙' : '⊗'}</text>
          </g>
        ))}
      </g>
      <text x={210} y={212} textAnchor="middle" className="fill-[var(--fg-muted)] text-[9px]">{tr("membrana com trilha condutora")}</text>
      {field && <line x1={222 + x} y1={30} x2={222 + x + i * 22} y2={30} stroke="var(--c-b)" strokeWidth={2} markerEnd="url(#arrB)" />}
    </g>
  );
}

function EST({ d, i, field }: { d: number; i: number; field: boolean }) {
  const b = d * 16;
  return (
    <g>
      {[170, 250].map((x, k) => (
        <g key={x}>
          {Array.from({ length: 9 }, (_, j) => (
            <rect key={j} x={x - 3} y={44 + j * 17} width={6} height={11} rx={1.5} fill="var(--fg-faint)" />
          ))}
          <text x={x} y={34} textAnchor="middle" className={`text-[10px] font-semibold ${(k === 0) === i >= 0 ? 'fill-[#d9534f]' : 'fill-[#5f8fd9]'}`}>
            {(k === 0) === i >= 0 ? tr("+ sinal") : tr("− sinal")}
          </text>
        </g>
      ))}
      <path d={`M210,44 Q${210 + b},120 210,196`} fill="none" stroke="var(--accent)" strokeWidth={2} />
      {[70, 100, 130, 160].map((y) => (
        <text key={y} x={210 + b * (1 - Math.pow((y - 120) / 76, 2)) + 5} y={y} className="fill-[var(--accent)] text-[10px] font-bold">+</text>
      ))}
      <text x={210} y={212} textAnchor="middle" className="fill-[var(--fg-muted)] text-[9px]">{tr("membrana polarizada (alta tensão)")}</text>
      {field &&
        [80, 120, 160].map((y) => (
          <line key={y} x1={i >= 0 ? 178 : 242} y1={y} x2={i >= 0 ? 196 : 224} y2={y} stroke="#5fb3e8" strokeWidth={1.2} markerEnd="url(#arr)" />
        ))}
    </g>
  );
}

function Piezo({ d }: { d: number }) {
  const y = d * 22;
  return (
    <g>
      <rect x={50} y={95} width={30} height={50} fill="var(--fg-faint)" opacity={0.6} rx={3} />
      <path d={`M80,114 Q190,114 300,${114 + y}`} fill="none" stroke="#d9534f" strokeWidth={8} opacity={0.75} />
      <path d={`M80,124 Q190,124 300,${124 + y}`} fill="none" stroke="#5f8fd9" strokeWidth={8} opacity={0.75} />
      <text x={190} y={98 + y * 0.3} textAnchor="middle" className="fill-[var(--fg-muted)] text-[9px]">{d >= 0 ? tr("camada que contrai") : tr("camada que expande")}</text>
      <text x={190} y={150 + y * 0.3} textAnchor="middle" className="fill-[var(--fg-muted)] text-[9px]">{d >= 0 ? tr("camada que expande") : tr("camada que contrai")}</text>
      <text x={65} y={160} textAnchor="middle" className="fill-[var(--fg-muted)] text-[9px]">{tr("fixação")}</text>
    </g>
  );
}

export default function DriversLab({ initial = 'dd' }: { initial?: Kind }) {
  const [kind, setKind] = useState<Kind>(initial);
  const [freq, setFreq] = useState(0.8);
  const [amp, setAmp] = useState(0.8);
  const [field, setField] = useState(true);
  const [phase, setPhase] = useState(0);
  const p = useRef(0);
  const [wrap, inView] = useInView<HTMLDivElement>();

  useAnimationFrame((_, dt) => {
    p.current += dt * freq * 2 * Math.PI;
    setPhase(p.current % (Math.PI * 2 * 1000));
  }, inView);

  const sig = Math.sin(phase);
  const d = sig * amp;
  const i = Math.sign(sig) || 1;
  const vel = Math.abs(Math.cos(phase)) * amp;
  const info = INFO[kind];

  let body: ReactNode = null;
  if (kind === 'dd') body = <Dynamic d={d} i={sig} field={field} />;
  if (kind === 'ba') body = <BA d={d} i={sig} field={field} />;
  if (kind === 'planar') body = <Planar d={d} i={sig} field={field} />;
  if (kind === 'est') body = <EST d={d} i={sig} field={field} />;
  if (kind === 'piezo') body = <Piezo d={d} />;

  const waveX = kind === 'dd' ? 190 : kind === 'ba' ? 336 : kind === 'piezo' ? 300 : 280;
  const waveY = kind === 'ba' ? 79 : 120;

  return (
    <LabFrame
      title={tr("Drivers em corte")}
      description={tr("Esquemas animados dos principais tipos de transdutor. O sinal elétrico (em câmera muito lenta) gera uma força, a força move a parte móvel, e o movimento cria ondas de pressão.")}
      onReset={() => {
        setFreq(0.8);
        setAmp(0.8);
        setField(true);
      }}
      toolbar={
        <Segmented
          size="sm"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'dd', label: tr("Dinâmico") },
            { value: 'ba', label: tr("BA") },
            { value: 'planar', label: tr("Planar") },
            { value: 'est', label: tr("Eletrostático") },
            { value: 'piezo', label: tr("Piezo") },
          ]}
        />
      }
      footer={tr("Esquemas fora de escala e simplificados: o movimento está muito ampliado (deslocamentos reais são de micrômetros a fração de milímetro) e a frequência, muito reduzida.")}
    >
      <div ref={wrap} className="rounded-xl bg-sunken">
        <svg viewBox="0 0 420 230" className="w-full max-h-[300px]" role="img" aria-label={tr("Corte esquemático: {0}", info.name)}>
          <defs>
            <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="#5fb3e8" />
            </marker>
            <marker id="arrB" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="var(--c-b)" />
            </marker>
          </defs>
          {body}
          <Waves x={waveX} y={waveY} amp={vel} phase={phase} n={kind === 'ba' ? 3 : 4} />
          {(kind === 'planar' || kind === 'est') && <Waves x={140} y={120} amp={vel} phase={phase + Math.PI} dir={-1} n={4} />}
          {/* indicador do sinal */}
          <g transform="translate(14 208)">
            <text x={0} y={0} className="fill-[var(--fg-muted)] text-[9px]">{tr("sinal")}</text>
            <rect x={30} y={-7} width={60} height={8} rx={4} fill="var(--bg-elev)" />
            <rect x={60} y={-7} width={Math.abs(sig) * 30} height={8} rx={4} fill="var(--c-b)" transform={sig < 0 ? `translate(${-Math.abs(sig) * 30} 0)` : undefined} />
            <text x={98} y={0} className="fill-[var(--fg-faint)] text-[9px]">{i > 0 ? 'positivo' : 'negativo'}</text>
          </g>
        </svg>
      </div>
      <div className="flex flex-wrap items-center gap-4 mt-4 mb-4">
        <Toggle checked={field} onChange={setField} label={tr("Mostrar campos e forças")} />
      </div>
      <Controls cols={2}>
        <Slider label={tr("Velocidade da animação")} value={freq} min={0.1} max={3} step={0.05} onChange={setFreq} unit={tr("ciclos/s")} />
        <Slider label={tr("Amplitude do sinal")} value={amp} min={0} max={1} step={0.01} onChange={setAmp} format={(v) => `${Math.round(v * 100)}%`} />
      </Controls>
      <AnimatePresence mode="wait">
        <motion.div key={kind} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }} className="mt-5 grid md:grid-cols-3 gap-4">
          <div className="md:col-span-3">
            <h4 className="text-[15px] font-semibold text-fg">{info.name}</h4>
            <p className="text-[13.5px] text-soft leading-relaxed mt-1">{info.how}</p>
          </div>
          <div className="md:col-span-3 grid sm:grid-cols-2 gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.1em] font-semibold text-accent">{tr("Pontos fortes")}</div>
              <p className="text-[13px] text-soft leading-relaxed mt-1">{info.pros}</p>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.1em] font-semibold text-[var(--c-b)]">{tr("Desafios")}</div>
              <p className="text-[13px] text-soft leading-relaxed mt-1">{info.cons}</p>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
      <div className="mt-4">
        <Note>{tr("Nenhum princípio é superior por si só: cada um tem limitações físicas, e a qualidade final depende da implementação acústica em volta do driver.")}</Note>
      </div>
    </LabFrame>
  );
}
