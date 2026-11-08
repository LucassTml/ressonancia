import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { interpCurve, logFreqs } from '../../audio/dsp';
import { harmanIE } from '../../data/targets';
import { tr } from '../../i18n';

/** Ilustrações estáticas usadas nos artigos. Cores vêm do tema. */

const INK = 'var(--fg)';
const SOFT = 'var(--fg-soft)';
const MUTED = 'var(--fg-muted)';
const FAINT = 'var(--fg-faint)';
const LINE = 'var(--line-strong)';
const A = 'var(--c-a)';
const B = 'var(--c-b)';
const C = 'var(--c-target)';
const D = 'var(--c-diff)';

function T({ x, y, children, a = 'middle', c = MUTED, s = 11, w = 400 }: { x: number; y: number; children: ReactNode; a?: 'start' | 'middle' | 'end'; c?: string; s?: number; w?: number }) {
  return (
    <text x={x} y={y} textAnchor={a} fill={c} fontSize={s} fontWeight={w} fontFamily="var(--font-ui)">
      {children}
    </text>
  );
}

const sine = (x0: number, x1: number, mid: number, amp: number, cycles: number, ph = 0) => {
  let d = '';
  for (let i = 0; i <= 200; i++) {
    const u = i / 200;
    d += `${i ? 'L' : 'M'}${(x0 + u * (x1 - x0)).toFixed(1)},${(mid - amp * Math.sin(2 * Math.PI * cycles * u + ph)).toFixed(1)}`;
  }
  return d;
};

const Arrow = ({ x1, y1, x2, y2, c = MUTED }: { x1: number; y1: number; x2: number; y2: number; c?: string }) => {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const h = 6;
  return (
    <g stroke={c} fill="none" strokeWidth={1.4} strokeLinecap="round">
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      <path d={`M${x2 - h * Math.cos(ang - 0.45)},${y2 - h * Math.sin(ang - 0.45)} L${x2},${y2} L${x2 - h * Math.cos(ang + 0.45)},${y2 - h * Math.sin(ang + 0.45)}`} />
    </g>
  );
};

function WaveAnatomy() {
  const x0 = 40, x1 = 580, mid = 100, amp = 62;
  const per = (x1 - x0) / 2.5;
  return (
    <svg viewBox="0 0 620 200" className="w-full">
      <line x1={x0} x2={x1} y1={mid} y2={mid} stroke={LINE} />
      <path d={sine(x0, x1, mid, amp, 2.5)} fill="none" stroke={A} strokeWidth={2.6} />
      <line x1={x0 + per * 0.25} x2={x0 + per * 0.25} y1={mid} y2={mid - amp} stroke={B} strokeWidth={2} />
      <T x={x0 + per * 0.25 + 8} y={mid - amp / 2 + 4} a="start" c={B} w={600}>{tr('amplitude: o “tamanho” da onda (volume)')}</T>
      <g stroke={C} strokeWidth={1.4} fill="none">
        <path d={`M${x0 + per * 1.25},${mid - amp - 10} v-8 H${x0 + per * 2.25} v8`} />
      </g>
      <T x={x0 + per * 1.75} y={mid - amp - 24} c={C} w={600}>{tr('um ciclo completo')}</T>
      <T x={x0 + per * 1.75} y={190} c={MUTED}>{tr('muitos ciclos por segundo = agudo · poucos = grave')}</T>
      <T x={x1} y={mid + 16} a="end">{tr('tempo →')}</T>
      <T x={30} y={24} a="start">{tr('pressão do ar')}</T>
    </svg>
  );
}

function AirMolecules() {
  const dots: ReactNode[] = [];
  let seed = 11;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let row = 0; row < 8; row++)
    for (let i = 0; i < 90; i++) {
      const x0 = (i + r()) / 90;
      const x = x0 + 0.018 * Math.sin(x0 * Math.PI * 6);
      dots.push(<circle key={`${row}-${i}`} cx={20 + x * 580} cy={22 + row * 11 + r() * 6} r={1.7} fill={SOFT} opacity={0.75} />);
    }
  return (
    <svg viewBox="0 0 620 170" className="w-full">
      {dots}
      {[0.083, 0.417, 0.75].map((u) => (
        <T key={u} x={20 + (u + 0.083) * 580} y={130} c={A} w={600}>{tr('compressão')}</T>
      ))}
      {[0.25, 0.583].map((u) => (
        <T key={u} x={20 + (u + 0.083) * 580} y={130}>{tr('rarefação')}</T>
      ))}
      <Arrow x1={210} y1={154} x2={410} y2={154} c={A} />
      <T x={310} y={148} c={A}>{tr('a onda viaja')}</T>
      <T x={120} y={160} c={MUTED}>{tr('cada molécula só vai e volta')}</T>
    </svg>
  );
}

function OctaveKeyboard() {
  const W = 620;
  const whites = 22;
  const kw = (W - 20) / whites;
  const start = 10;
  // de Lá1 (A1) em diante: teclas brancas A B C D E F G
  const letters = [9, 11, 0, 2, 4, 5, 7];
  const keys: ReactNode[] = [];
  const labels = [
    { i: 0, f: '55', c: FAINT },
    { i: 7, f: '110', c: B },
    { i: 14, f: '220', c: A },
    { i: 21, f: '440', c: C },
  ];
  for (let i = 0; i < whites; i++) {
    const hl = labels.find((l) => l.i === i);
    keys.push(<rect key={i} x={start + i * kw} y={70} width={kw - 1} height={82} rx={2} fill={hl ? hl.c : 'var(--bg-elev)'} opacity={hl ? 0.85 : 1} stroke={LINE} />);
    const pc = letters[i % 7];
    if (i < whites - 1 && pc !== 4 && pc !== 11) keys.push(<rect key={`b${i}`} x={start + (i + 0.68) * kw} y={70} width={kw * 0.62} height={50} rx={1.5} fill={INK} />);
  }
  const X = (i: number) => start + (i + 0.5) * kw;
  return (
    <svg viewBox="0 0 620 200" className="w-full">
      {keys}
      {labels.map((l) => (
        <g key={l.i}>
          <T x={X(l.i)} y={172} c={INK} w={600}>{tr('Lá')}</T>
          <T x={X(l.i)} y={188} c={MUTED}>{l.f} Hz</T>
        </g>
      ))}
      {[0, 7, 14].map((i, k) => (
        <g key={i}>
          <path d={`M${X(i)},64 Q${(X(i) + X(i + 7)) / 2},${18} ${X(i + 7)},64`} fill="none" stroke={[B, A, C][k]} strokeWidth={1.8} />
          <T x={(X(i) + X(i + 7)) / 2} y={32} c={INK} w={600}>{tr('uma oitava: ×2')}</T>
        </g>
      ))}
    </svg>
  );
}

function LogRuler() {
  const W = 620, x0 = 30, x1 = 590;
  const lin = (f: number) => x0 + (f / 20000) * (x1 - x0);
  const log = (f: number) => x0 + (Math.log(f / 20) / Math.log(1000)) * (x1 - x0);
  const fs = [20, 40, 80, 160, 320, 640, 1280, 2560, 5120, 10240, 20000];
  return (
    <svg viewBox={`0 0 ${W} 170`} className="w-full">
      <T x={x0} y={18} a="start" c={INK} w={600}>{tr('Régua normal (linear): cada oitava ocupa o dobro da anterior')}</T>
      <line x1={x0} x2={x1} y1={48} y2={48} stroke={LINE} strokeWidth={2} />
      {fs.map((f, i) => (
        <g key={f}>
          <circle cx={lin(f)} cy={48} r={4} fill={i % 2 ? A : B} />
          {f >= 2560 && <T x={lin(f)} y={68}>{f >= 1000 ? `${Math.round(f / 100) / 10}k` : f}</T>}
        </g>
      ))}
      <T x={lin(160)+30} y={36} a="start" c={D}>{tr('metade da música fica espremida aqui')}</T>
      <T x={x0} y={100} a="start" c={INK} w={600}>{tr('Régua de áudio (logarítmica): cada oitava ocupa o mesmo espaço')}</T>
      <line x1={x0} x2={x1} y1={130} y2={130} stroke={LINE} strokeWidth={2} />
      {fs.map((f, i) => (
        <g key={f}>
          <circle cx={log(f)} cy={130} r={4} fill={i % 2 ? A : B} />
          <T x={log(f)} y={150}>{f >= 1000 ? `${Math.round(f / 100) / 10}k` : f}</T>
        </g>
      ))}
    </svg>
  );
}

function DbLadder() {
  const items: [number, string][] = [
    [0, tr('limiar da audição')],
    [30, tr('quarto à noite')],
    [60, tr('conversa')],
    [75, tr('escuta confortável')],
    [85, tr('cuidado após horas')],
    [100, tr('show alto')],
    [120, tr('dor')],
  ];
  const y = (d: number) => 186 - (d / 120) * 168;
  return (
    <svg viewBox="0 0 620 200" className="w-full">
      <defs>
        <linearGradient id="dbg" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="var(--c-a)" />
          <stop offset="65%" stopColor="var(--c-b)" />
          <stop offset="100%" stopColor="var(--c-diff)" />
        </linearGradient>
      </defs>
      <rect x={60} y={18} width={14} height={168} rx={7} fill="url(#dbg)" />
      {items.map(([d, l]) => (
        <g key={d}>
          <line x1={78} x2={92} y1={y(d)} y2={y(d)} stroke={LINE} />
          <T x={54} y={y(d) + 4} a="end" c={INK}>{d}</T>
          <T x={98} y={y(d) + 4} a="start">{l}</T>
        </g>
      ))}
      <g transform="translate(330 30)">
        <T x={0} y={0} a="start" c={INK} w={600}>{tr('Regras de bolso')}</T>
        <T x={0} y={28} a="start" c={SOFT}>{tr('+1 dB: quase imperceptível')}</T>
        <T x={0} y={52} a="start" c={SOFT}>{tr('+3 dB: dá para notar')}</T>
        <T x={0} y={76} a="start" c={SOFT}>{tr('+6 dB: o dobro da pressão')}</T>
        <T x={0} y={100} a="start" c={SOFT}>{tr('+10 dB: soa “duas vezes mais alto”')}</T>
        <T x={0} y={124} a="start" c={SOFT}>{tr('+20 dB: dez vezes a pressão')}</T>
      </g>
    </svg>
  );
}

function StringHarmonics() {
  const x0 = 110, x1 = 590;
  const mode = (n: number, y: number) => {
    let d1 = '', d2 = '';
    for (let i = 0; i <= 120; i++) {
      const u = i / 120;
      const v = 15 * Math.sin(Math.PI * n * u);
      d1 += `${i ? 'L' : 'M'}${(x0 + u * (x1 - x0)).toFixed(1)},${(y - v).toFixed(1)}`;
      d2 += `${i ? 'L' : 'M'}${(x0 + u * (x1 - x0)).toFixed(1)},${(y + v).toFixed(1)}`;
    }
    return { d1, d2 };
  };
  return (
    <svg viewBox="0 0 620 200" className="w-full">
      {[1, 2, 3, 4].map((n, i) => {
        const y = 28 + i * 47;
        const { d1, d2 } = mode(n, y);
        return (
          <g key={n}>
            <T x={8} y={y - 2} a="start" c={INK} w={600}>{n === 1 ? tr('Fundamental') : tr('{0}º harmônico', n)}</T>
            <T x={8} y={y + 13} a="start">{110 * n} Hz (×{n})</T>
            <path d={d1} fill="none" stroke={A} strokeWidth={1.8} />
            <path d={d2} fill="none" stroke={A} strokeWidth={1.8} opacity={0.4} />
            <circle cx={x0} cy={y} r={3} fill={INK} />
            <circle cx={x1} cy={y} r={3} fill={INK} />
          </g>
        );
      })}
    </svg>
  );
}

function TimbreBars() {
  const sets: [string, number[], string][] = [
    [tr('Flauta'), [1, 0.35, 0.12, 0.05, 0.03, 0.02, 0.01, 0.01], A],
    [tr('Clarinete'), [1, 0.05, 0.7, 0.05, 0.45, 0.05, 0.25, 0.04], B],
    [tr('Violino'), [1, 0.8, 0.75, 0.55, 0.5, 0.4, 0.35, 0.3], C],
  ];
  return (
    <svg viewBox="0 0 620 170" className="w-full">
      {sets.map(([name, v, c], s) => {
        const x0 = 20 + s * 202;
        return (
          <g key={name}>
            <T x={x0} y={20} a="start" c={INK} w={600}>{name}</T>
            <line x1={x0} x2={x0 + 180} y1={140} y2={140} stroke={LINE} />
            {v.map((a, i) => (
              <rect key={i} x={x0 + i * 22 + 2} y={140 - a * 105} width={16} height={a * 105} rx={2} fill={c} opacity={0.85} />
            ))}
            <T x={x0 + 90} y={160}>{tr('mesma nota, harmônicos diferentes')}</T>
          </g>
        );
      })}
    </svg>
  );
}

function FrAnatomy() {
  const fs = logFreqs(160);
  const X = (f: number) => 40 + (Math.log(f / 20) / Math.log(1000)) * 560;
  const Y = (d: number) => 140 - d * 6.4;
  let path = '';
  fs.forEach((f, i) => {
    path += `${i ? 'L' : 'M'}${X(f).toFixed(1)},${Y(interpCurve(harmanIE.curve, f)).toFixed(1)}`;
  });
  const regions: [number, number, string, string][] = [
    [20, 200, tr('Graves'), B],
    [200, 2000, tr('Médios'), MUTED],
    [2000, 6000, tr('Presença'), A],
    [6000, 20000, tr('Agudos'), C],
  ];
  return (
    <svg viewBox="0 0 620 250" className="w-full">
      {regions.map(([a, b, l, c], i) => (
        <g key={l}>
          <rect x={X(a)} y={22} width={X(b) - X(a)} height={178} fill={i % 2 ? 'var(--c-grid)' : 'transparent'} />
          <T x={(X(a) + X(b)) / 2} y={16} c={c} w={600}>{l}</T>
        </g>
      ))}
      <line x1={40} x2={600} y1={Y(0)} y2={Y(0)} stroke={LINE} />
      <path d={path} fill="none" stroke={A} strokeWidth={2.6} />
      {[20, 100, 1000, 10000].map((f) => (
        <T key={f} x={X(f)} y={216}>{f >= 1000 ? `${f / 1000}k` : f} Hz</T>
      ))}
      <T x={10} y={Y(0) + 4} a="start">0 dB</T>
      <T x={X(50)} y={Y(13)} c={B}>{tr('① mais alto aqui = mais grave')}</T>
      <T x={X(620)} y={Y(-4.5)} c={MUTED}>{tr('② vale largo aqui = vozes recuadas')}</T>
      <T x={X(2900)} y={Y(13.5)} c={A}>{tr('③ este “morro” é esperado')}</T>
      <T x={X(11500)} y={Y(-6.5)} c={C}>{tr('④ zona pouco confiável')}</T>
      <T x={320} y={242} c={MUTED}>{tr('Exemplo: alvo Harman IE 2019. Esquerda = grave, direita = agudo, altura = volume daquela frequência.')}</T>
    </svg>
  );
}

function SignalChain() {
  const steps: [string, string][] = [
    [tr('Arquivo'), tr('números')],
    [tr('DAC'), tr('números → tensão')],
    [tr('Amplificador'), tr('dá força ao sinal')],
    [tr('Fone'), tr('tensão → movimento')],
    [tr('Ar'), tr('pressão')],
    [tr('Ouvido'), tr('pressão → nervos')],
    [tr('Cérebro'), tr('“música”')],
  ];
  const w = 80, gap = 5;
  return (
    <svg viewBox="0 0 620 110" className="w-full">
      {steps.map(([a, b], i) => {
        const x = 8 + i * (w + gap + 2);
        return (
          <g key={a}>
            <rect x={x} y={22} width={w} height={62} rx={10} fill={i === 0 || i === 6 ? 'var(--accent-soft)' : 'var(--bg-sunken)'} stroke={LINE} />
            <T x={x + w / 2} y={48} c={INK} w={600} s={11.5}>{a}</T>
            <T x={x + w / 2} y={66} s={8.8}>{b}</T>
            {i < steps.length - 1 && <Arrow x1={x + w + 0.5} y1={53} x2={x + w + gap + 1.5} y2={53} />}
          </g>
        );
      })}
    </svg>
  );
}

function EarPath() {
  return (
    <svg viewBox="0 0 620 230" className="w-full">
      <path d="M70,30 C20,50 25,110 62,120 C50,150 58,195 92,205 C118,205 112,168 122,138 L150,132 L150,98 L125,92 C125,50 110,22 70,30 Z" fill="var(--bg-sunken)" stroke={LINE} strokeWidth={1.6} />
      <path d="M150,98 L300,98 M150,132 L300,132" stroke={LINE} strokeWidth={1.6} />
      <path d="M298,92 L312,138" stroke={D} strokeWidth={3} strokeLinecap="round" />
      <path d="M312,115 l26,-16 l18,18 l22,-2" fill="none" stroke={B} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M392,116 c10,-38 74,-44 84,-6 c8,32 -44,48 -56,20 c-7,-18 18,-30 28,-16" fill="none" stroke={A} strokeWidth={5} strokeLinecap="round" />
      <path d="M476,118 C510,118 540,110 590,100" fill="none" stroke={C} strokeWidth={2.4} />
      <T x={75} y={20} c={INK} w={600}>{tr('Orelha')}</T>
      <T x={75} y={224}>{tr('direciona e colore')}</T>
      <T x={225} y={90} c={INK} w={600}>{tr('Canal')}</T>
      <T x={225} y={150}>{tr('reforça ~3 kHz')}</T>
      <T x={305} y={170} c={D} w={600}>{tr('Tímpano')}</T>
      <T x={305} y={186}>{tr('vibra com a pressão')}</T>
      <T x={350} y={80} c={B} w={600}>{tr('Ossículos')}</T>
      <T x={350} y={64}>{tr('alavanca')}</T>
      <T x={438} y={170} c={A} w={600}>{tr('Cóclea')}</T>
      <T x={438} y={186}>{tr('separa as frequências')}</T>
      <T x={560} y={88} c={C} w={600}>{tr('Nervo')}</T>
    </svg>
  );
}

function IemAnatomy() {
  return (
    <svg viewBox="0 0 620 220" className="w-full">
      <path d="M30,60 h170 a30,30 0 0 1 30,30 v40 a30,30 0 0 1 -30,30 h-170 a14,14 0 0 1 -14,-14 v-72 a14,14 0 0 1 14,-14 z" fill="var(--bg-sunken)" stroke={LINE} strokeWidth={1.8} />
      <rect x={230} y={92} width={96} height={36} fill="var(--accent-soft)" stroke={A} />
      <path d="M326,88 c18,-16 42,-16 52,-10 v64 c-10,6 -34,6 -52,-10 z" fill="var(--c-grid-strong)" stroke={LINE} />
      <rect x={318} y={95} width={6} height={30} fill={B} />
      <ellipse cx={120} cy={110} rx={12} ry={36} fill={A} opacity={0.7} />
      <rect x={70} y={92} width={42} height={36} rx={4} fill={INK} opacity={0.75} />
      <path d="M378,80 H560 M378,140 H560" stroke={LINE} strokeWidth={1.8} />
      <path d="M558,74 L572,146" stroke={D} strokeWidth={3} strokeLinecap="round" />
      <circle cx={60} cy={148} r={4} fill="none" stroke={B} strokeWidth={1.5} />
      <T x={120} y={46} c={A} w={600}>{tr('Diafragma')}</T>
      <T x={90} y={180} c={INK}>{tr('Ímã e bobina')}</T>
      <T x={60} y={172} a="middle" c={B}>{tr('Ventilação')}</T>
      <T x={278} y={80} c={A} w={600}>{tr('Bocal')}</T>
      <T x={321} y={172} c={B} w={600}>{tr('Filtro')}</T>
      <T x={352} y={58} c={INK} w={600}>{tr('Ponteira (vedação)')}</T>
      <T x={470} y={72} c={INK}>{tr('Canal residual')}</T>
      <T x={470} y={160}>{tr('câmara de ar fechada')}</T>
      <T x={565} y={166} c={D} w={600}>{tr('Tímpano')}</T>
      <T x={310} y={210} c={MUTED}>{tr('Esquema fora de escala de um IEM com um driver dinâmico.')}</T>
    </svg>
  );
}

function SealDiagram() {
  const x = (f: number) => 310 + (Math.log(f / 20) / Math.log(1000)) * 290;
  const y = (d: number) => 74 - d * 2.1;
  const curve = (fc: number) => {
    let s = '';
    logFreqs(80).forEach((f, i) => {
      s += `${i ? 'L' : 'M'}${x(f).toFixed(1)},${y(fc ? 10 * Math.log10((f * f) / (f * f + fc * fc)) : 0).toFixed(1)}`;
    });
    return s;
  };
  return (
    <svg viewBox="0 0 620 190" className="w-full">
      <path d="M20,60 H240 M20,120 H240" stroke={LINE} strokeWidth={2} />
      <rect x={20} y={72} width={70} height={36} fill="var(--accent-soft)" stroke={A} />
      <path d="M90,62 c12,0 22,0 28,2 v52 c-6,2 -16,2 -28,2 z" fill="var(--c-grid-strong)" stroke={LINE} />
      <T x={130} y={46} c={A} w={600}>{tr('Vedado: o ar não escapa')}</T>
      <path d="M20,150 H240" stroke={LINE} strokeWidth={2} />
      <rect x={20} y={162} width={70} height={20} fill="var(--accent-soft)" stroke={A} />
      <Arrow x1={118} y1={158} x2={70} y2={154} c={D} />
      <T x={130} y={146} c={D} w={600}>{tr('Com fresta: o grave vaza')}</T>
      <line x1={310} x2={600} y1={y(0)} y2={y(0)} stroke={LINE} />
      <path d={curve(0)} fill="none" stroke={A} strokeWidth={2.4} />
      <path d={curve(120)} fill="none" stroke={D} strokeWidth={2.4} />
      <T x={455} y={30} c={INK} w={600}>{tr('Efeito na resposta')}</T>
      <T x={x(32)} y={174} c={D}>{tr('graves caem')}</T>
      <T x={x(20)} y={186} a="start">20 Hz</T>
      <T x={x(20000)} y={186} a="end">20 kHz</T>
    </svg>
  );
}

function SignatureShapes() {
  const shapes: [string, (u: number) => number][] = [
    [tr('Neutro'), () => 0],
    [tr('Quente'), (u) => 1.0 - u * 1.5],
    [tr('Brilhante'), (u) => -0.6 + u * 1.5],
    [tr('Em V'), (u) => 3.4 * (u - 0.5) ** 2 - 0.3],
    [tr('Escuro'), (u) => 0.8 - 1.9 * u * u],
    [tr('Médios à frente'), (u) => 0.9 - 7 * (u - 0.55) ** 2],
  ];
  return (
    <svg viewBox="0 0 620 130" className="w-full">
      {shapes.map(([n, fn], i) => {
        const x0 = 8 + i * 102;
        const y = 58;
        let d = '';
        for (let k = 0; k <= 50; k++) {
          const u = k / 50;
          d += `${k ? 'L' : 'M'}${(x0 + u * 90).toFixed(1)},${(y - fn(u) * 26).toFixed(1)}`;
        }
        return (
          <g key={n}>
            <rect x={x0} y={14} width={90} height={88} rx={8} fill="var(--bg-sunken)" />
            <line x1={x0} x2={x0 + 90} y1={y} y2={y} stroke={LINE} strokeDasharray="3 3" />
            <path d={d} fill="none" stroke={A} strokeWidth={2.6} strokeLinecap="round" />
            <T x={x0 + 45} y={120} c={INK} w={600}>{n}</T>
            <T x={x0 + 8} y={98} a="start" s={8}>{tr('grave')}</T>
            <T x={x0 + 82} y={98} a="end" s={8}>{tr('agudo')}</T>
          </g>
        );
      })}
    </svg>
  );
}

function FilterShapes() {
  const shapes: [string, (u: number) => number, string][] = [
    [tr('Peak (sino)'), (u) => Math.exp(-(((u - 0.5) / 0.13) ** 2)), tr('mexe numa faixa')],
    [tr('Low shelf'), (u) => 1 / (1 + Math.exp((u - 0.35) * 22)), tr('sobe tudo abaixo')],
    [tr('High shelf'), (u) => 1 / (1 + Math.exp((0.65 - u) * 22)), tr('sobe tudo acima')],
    [tr('Passa-baixas'), (u) => (u < 0.62 ? 0 : -Math.min(1.5, (u - 0.62) * 6)), tr('corta agudos')],
    [tr('Passa-altas'), (u) => (u > 0.38 ? 0 : -Math.min(1.5, (0.38 - u) * 6)), tr('corta graves')],
  ];
  return (
    <svg viewBox="0 0 620 130" className="w-full">
      {shapes.map(([n, fn, h], i) => {
        const x0 = 8 + i * 122;
        const y = 66;
        let d = '';
        for (let k = 0; k <= 60; k++) {
          const u = k / 60;
          d += `${k ? 'L' : 'M'}${(x0 + u * 108).toFixed(1)},${(y - fn(u) * 34).toFixed(1)}`;
        }
        return (
          <g key={n}>
            <rect x={x0} y={8} width={108} height={84} rx={8} fill="var(--bg-sunken)" />
            <line x1={x0} x2={x0 + 108} y1={y} y2={y} stroke={LINE} strokeDasharray="3 3" />
            <path d={d} fill="none" stroke={A} strokeWidth={2.6} />
            <T x={x0 + 54} y={110} c={INK} w={600}>{n}</T>
            <T x={x0 + 54} y={124}>{h}</T>
          </g>
        );
      })}
    </svg>
  );
}

function MaskingPicture() {
  const x = (u: number) => 40 + u * 540;
  const y = (v: number) => 150 - v * 1.3;
  const shape = (u: number) => (u < 0.3 ? Math.max(0, 90 - (0.3 - u) * 900) : Math.max(0, 90 - (u - 0.3) * 190));
  let d = `M${x(0)},${y(0)}`;
  for (let k = 0; k <= 200; k++) d += `L${x(k / 200).toFixed(1)},${y(shape(k / 200)).toFixed(1)}`;
  d += `L${x(1)},${y(0)}Z`;
  return (
    <svg viewBox="0 0 620 190" className="w-full">
      <path d={d} fill="var(--c-b)" opacity={0.2} stroke={B} strokeWidth={1.6} />
      <line x1={x(0.3)} x2={x(0.3)} y1={y(0)} y2={y(95)} stroke={B} strokeWidth={5} strokeLinecap="round" />
      <T x={x(0.3)} y={y(100)} c={B} w={600}>{tr('som forte')}</T>
      <line x1={x(0.52)} x2={x(0.52)} y1={y(0)} y2={y(30)} stroke={FAINT} strokeWidth={4} strokeLinecap="round" />
      <T x={x(0.52)} y={y(36)} c={MUTED}>{tr('escondido')}</T>
      <line x1={x(0.17)} x2={x(0.17)} y1={y(0)} y2={y(30)} stroke={A} strokeWidth={4} strokeLinecap="round" />
      <T x={x(0.17)} y={y(36)} c={A}>{tr('audível')}</T>
      <line x1={x(0.86)} x2={x(0.86)} y1={y(0)} y2={y(30)} stroke={A} strokeWidth={4} strokeLinecap="round" />
      <T x={x(0.86)} y={y(36)} c={A}>{tr('audível')}</T>
      <line x1={x(0)} x2={x(1)} y1={y(0)} y2={y(0)} stroke={LINE} />
      <T x={x(0.5)} y={178}>{tr('grave → agudo · a “sombra” de um som forte se estende mais para cima')}</T>
    </svg>
  );
}

function SamplingSteps() {
  const panel = (x0: number, title: string, body: ReactNode) => (
    <g>
      <rect x={x0} y={8} width={194} height={120} rx={10} fill="var(--bg-sunken)" />
      <T x={x0 + 97} y={148} c={INK} w={600}>{title}</T>
      {body}
    </g>
  );
  const f = (x0: number, u: number) => ({ x: x0 + 8 + u * 178, y: 68 - 40 * Math.sin(2 * Math.PI * 1.5 * u) });
  const curve = (x0: number) => {
    let d = '';
    for (let i = 0; i <= 100; i++) {
      const p = f(x0, i / 100);
      d += `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    }
    return d;
  };
  const pts = (x0: number) => Array.from({ length: 13 }, (_, i) => f(x0, i / 12));
  return (
    <svg viewBox="0 0 620 160" className="w-full">
      {panel(8, tr('1. O som original'), <path d={curve(8)} fill="none" stroke={A} strokeWidth={2.4} />)}
      {panel(213, tr('2. Medido em instantes'), pts(213).map((p, i) => (
        <g key={i}>
          <line x1={p.x} x2={p.x} y1={68} y2={p.y} stroke={FAINT} />
          <circle cx={p.x} cy={p.y} r={3.2} fill={INK} />
        </g>
      )))}
      {panel(418, tr('3. Reconstruído, igual'), (
        <g>
          <path d={curve(418)} fill="none" stroke={A} strokeWidth={2.4} />
          {pts(418).map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={2.4} fill={INK} />)}
        </g>
      ))}
    </svg>
  );
}

function StereoHead() {
  return (
    <svg viewBox="0 0 620 190" className="w-full">
      <circle cx={190} cy={110} r={46} fill="var(--bg-sunken)" stroke={LINE} strokeWidth={1.6} />
      <path d="M180,66 l10,-12 l10,12" fill="none" stroke={MUTED} strokeWidth={1.6} />
      <ellipse cx={143} cy={110} rx={5} ry={12} fill={B} />
      <ellipse cx={237} cy={110} rx={5} ry={12} fill={A} />
      <circle cx={380} cy={30} r={9} fill={INK} />
      <line x1={373} y1={36} x2={240} y2={104} stroke={A} strokeWidth={1.8} />
      <path d="M373,36 Q190,10 146,100" fill="none" stroke={B} strokeWidth={1.8} strokeDasharray="5 4" />
      <T x={400} y={34} a="start" c={INK} w={600}>{tr('Fonte de som')}</T>
      <T x={330} y={100} a="start" c={A}>{tr('chega antes e mais forte')}</T>
      <T x={84} y={40} a="middle" c={B}>{tr('chega depois e mais fraco')}</T>
      <T x={190} y={180}>{tr('O cérebro compara os dois ouvidos')}</T>
      <T x={430} y={150} a="start" c={SOFT}>{tr('Diferença máxima: ~0,7 ms')}</T>
    </svg>
  );
}

function OutputDivider() {
  return (
    <svg viewBox="0 0 620 150" className="w-full">
      <rect x={20} y={46} width={120} height={60} rx={10} fill="var(--bg-sunken)" stroke={LINE} />
      <T x={80} y={72} c={INK} w={600}>{tr('Fonte')}</T>
      <T x={80} y={90}>{tr('tensão ideal')}</T>
      <path d="M140,76 H200 l6,-10 l12,20 l12,-20 l12,20 l12,-20 l6,10 H340" fill="none" stroke={B} strokeWidth={2} />
      <T x={236} y={46} c={B} w={600}>{tr('Impedância de saída')}</T>
      <rect x={340} y={46} width={140} height={60} rx={10} fill="var(--accent-soft)" stroke={A} />
      <T x={410} y={72} c={INK} w={600}>{tr('Fone')}</T>
      <T x={410} y={90}>{tr('impedância varia')}</T>
      <T x={310} y={136} c={MUTED}>{tr('As duas “dividem” a tensão. Se a do fone muda com a frequência, o som muda.')}</T>
    </svg>
  );
}

function CanalModes() {
  const tube = (x0: number, title: string, sub: string, closed: boolean, half: boolean) => {
    const L = 230;
    let d = '';
    for (let i = 0; i <= 80; i++) {
      const u = i / 80;
      const a = half ? Math.cos(Math.PI * u) : Math.sin((Math.PI / 2) * u);
      d += `${i ? 'L' : 'M'}${(x0 + u * L).toFixed(1)},${(70 - a * 22).toFixed(1)}`;
    }
    return (
      <g>
        <T x={x0 + L / 2} y={16} c={INK} w={600}>{title}</T>
        <path d={`M${x0},38 H${x0 + L} M${x0},102 H${x0 + L}`} stroke={LINE} strokeWidth={2} />
        <line x1={x0 + L} x2={x0 + L} y1={38} y2={102} stroke={D} strokeWidth={3.4} />
        {closed && <rect x={x0 - 22} y={40} width={24} height={60} rx={4} fill="var(--accent-soft)" stroke={A} />}
        <line x1={x0} x2={x0 + L} y1={70} y2={70} stroke={FAINT} strokeDasharray="3 3" />
        <path d={d} fill="none" stroke={A} strokeWidth={2.4} />
        <T x={x0 + L / 2} y={126}>{sub}</T>
      </g>
    );
  };
  return (
    <svg viewBox="0 0 620 140" className="w-full">
      {tube(30, tr('Canal aberto'), tr('quarto de onda: ressoa perto de 3 kHz'), false, false)}
      {tube(350, tr('Canal com IEM'), tr('meia onda: ressoa bem mais alto'), true, true)}
    </svg>
  );
}

const DIAGRAMS: Record<string, { el: () => ReactNode; caption: string }> = {
  'wave-anatomy': { el: WaveAnatomy, caption: tr('As partes de uma onda. Quase tudo em áudio é uma variação destas duas ideias: tamanho e rapidez.') },
  'air-molecules': { el: AirMolecules, caption: tr('Som é uma fila de empurrões no ar: regiões mais apertadas (compressões) e mais folgadas (rarefações) viajam, mas o ar em si só oscila no lugar.') },
  'octave-keyboard': { el: OctaveKeyboard, caption: tr('Oitava: subir uma oitava é dobrar a frequência. No teclado, é a mesma nota, doze teclas (contando as pretas) adiante.') },
  'log-ruler': { el: LogRuler, caption: tr('Por que os gráficos de áudio usam escala logarítmica: nossa audição percebe razões, então cada oitava merece o mesmo espaço.') },
  'db-ladder': { el: DbLadder, caption: tr('Escala de decibéis com referências do dia a dia.') },
  'string-harmonics': { el: StringHarmonics, caption: tr('Uma corda vibra em vários padrões ao mesmo tempo. Cada padrão é um harmônico, com frequência múltipla da mais grave.') },
  'timbre-bars': { el: TimbreBars, caption: tr('Por que instrumentos soam diferentes: a mesma nota tem receitas diferentes de harmônicos (valores ilustrativos).') },
  'fr-anatomy': { el: FrAnatomy, caption: tr('Como ler um gráfico de resposta em frequência, em quatro observações.') },
  'signal-chain': { el: SignalChain, caption: tr('O caminho do som, do arquivo até a sua percepção.') },
  'ear-path': { el: EarPath, caption: tr('Esquema do ouvido: cada parte resolve um problema físico diferente.') },
  'iem-anatomy': { el: IemAnatomy, caption: tr('As partes de um IEM e do espaço que ele forma com o seu ouvido.') },
  seal: { el: SealDiagram, caption: tr('A vedação em imagem: uma fresta deixa o ar escapar nas frequências baixas, e o grave despenca.') },
  'signature-shapes': { el: SignatureShapes, caption: tr('Formas típicas das assinaturas sonoras, em relação a uma referência neutra (linha tracejada).') },
  'filter-shapes': { el: FilterShapes, caption: tr('Os cinco formatos básicos de filtro de um equalizador.') },
  masking: { el: MaskingPicture, caption: tr('Mascaramento: um som forte projeta uma “sombra” que esconde sons fracos próximos, principalmente acima dele.') },
  'sampling-steps': { el: SamplingSteps, caption: tr('Áudio digital em três passos. Com taxa suficiente, a curva reconstruída é a mesma da original.') },
  'stereo-head': { el: StereoHead, caption: tr('Com dois ouvidos, o cérebro descobre a direção de um som comparando tempo e intensidade.') },
  'output-divider': { el: OutputDivider, caption: tr('A impedância de saída forma um divisor de tensão com o fone.') },
  'canal-modes': { el: CanalModes, caption: tr('O canal auditivo aberto e fechado por um IEM ressoam de formas diferentes (curva: variação de pressão ao longo do canal).') },
};

export default function Diagram({ id }: { id: string }) {
  const d = DIAGRAMS[id];
  if (!d) return null;
  const El = d.el;
  return (
    <motion.figure
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="not-prose my-9 font-sans"
    >
      <div className="rounded-[18px] border border-line bg-elev p-4 sm:p-5">
        <El />
      </div>
      <figcaption className="mt-2.5 px-1 text-[13px] leading-relaxed text-muted">{d.caption}</figcaption>
    </motion.figure>
  );
}
