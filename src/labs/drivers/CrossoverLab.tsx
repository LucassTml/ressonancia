import { useMemo, useState } from 'react';
import { LabFrame, Controls, Readout, Note } from '../../components/ui/LabFrame';
import { Segmented, Slider, Toggle, fmtDb, fmtHz, fmtNum } from '../../components/ui/controls';
import { SourceBar } from '../../components/ui/audio';
import { FreqPlot, Legend } from '../../viz/FreqPlot';
import { useCurvePlayer } from '../../audio/useCurvePlayer';

type C = [number, number];
const mul = (a: C, b: C): C => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const div = (a: C, b: C): C => {
  const d = b[0] * b[0] + b[1] * b[1];
  return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
};
const add = (a: C, b: C): C => [a[0] + b[0], a[1] + b[1]];
const db = (a: C) => 20 * Math.log10(Math.max(1e-9, Math.hypot(a[0], a[1])));

type Kind = 'bw1' | 'bw2' | 'lr2' | 'lr4';
const KINDS: Record<Kind, { name: string; invertDefault: boolean; text: string }> = {
  bw1: { name: '1ª ordem (6 dB/oit.)', invertDefault: false, text: 'Soma plana em magnitude, mas as saídas ficam 90° defasadas e a sobreposição entre drivers é enorme: cada driver precisa tocar bem muito além do ponto de corte.' },
  bw2: { name: 'Butterworth 2ª ordem', invertDefault: true, text: 'Com polaridade normal, as saídas estão 180° defasadas no corte e se cancelam (vale profundo). Invertendo o tweeter, somam com um pico de +3 dB.' },
  lr2: { name: 'Linkwitz-Riley 2ª ordem', invertDefault: true, text: 'Cada saída está −6 dB no corte. Com o tweeter invertido, a soma é plana: a solução clássica de 12 dB/oitava.' },
  lr4: { name: 'Linkwitz-Riley 4ª ordem', invertDefault: false, text: 'Saídas em fase no corte, −6 dB cada, soma plana e transição rápida (24 dB/oit.). Muito usada em caixas acústicas; em IEMs passivos, ordens altas são raras pelo espaço que os componentes exigem.' },
};

function responses(kind: Kind, fc: number, f: number) {
  const s: C = [0, f / fc];
  const one: C = [1, 0];
  const s2 = mul(s, s);
  const bwq: C = add(add(s2, [Math.SQRT2 * s[0], Math.SQRT2 * s[1]]), one);
  if (kind === 'bw1') {
    const den = add(s, one);
    return { lp: div(one, den), hp: div(s, den) };
  }
  if (kind === 'bw2') return { lp: div(one, bwq), hp: div(s2, bwq) };
  if (kind === 'lr2') {
    const den = mul(add(s, one), add(s, one));
    return { lp: div(one, den), hp: div(s2, den) };
  }
  const den = mul(bwq, bwq);
  return { lp: div(one, den), hp: div(mul(s2, s2), den) };
}

const D = { kind: 'lr2' as Kind, fc: 3000, invert: true, level: 0, delay: 0, processed: true };

export default function CrossoverLab() {
  const [s, setS] = useState(D);
  const set = <K extends keyof typeof D>(k: K, v: (typeof D)[K]) => setS((p) => ({ ...p, [k]: v }));

  const fns = useMemo(() => {
    const g = Math.pow(10, s.level / 20) * (s.invert ? -1 : 1);
    const tau = s.delay * 1e-6;
    const hpT = (f: number) => {
      const { hp } = responses(s.kind, s.fc, f);
      const w = 2 * Math.PI * f * tau;
      return mul([hp[0] * g, hp[1] * g], [Math.cos(w), -Math.sin(w)]);
    };
    return {
      lp: (f: number) => db(responses(s.kind, s.fc, f).lp),
      hp: (f: number) => db(hpT(f)),
      sum: (f: number) => db(add(responses(s.kind, s.fc, f).lp, hpT(f))),
    };
  }, [s.kind, s.fc, s.invert, s.level, s.delay]);

  const { player } = useCurvePlayer('crossover', fns.sum, s.processed, 'pink');
  const atFc = fns.sum(s.fc);

  return (
    <LabFrame
      title="Crossover: dividir e somar"
      description="Um woofer recebe as frequências abaixo do corte (passa-baixas), um tweeter as de cima (passa-altas). O que chega ao ouvido é a soma complexa dos dois — com magnitudes e fases. Mude a ordem do filtro, a polaridade, o nível e o atraso do tweeter."
      audio
      onReset={() => setS(D)}
      footer="Funções de transferência analógicas ideais, calculadas com aritmética complexa. Em fones reais, as respostas dos drivers, tubos e cavidades fazem parte do “filtro”, e o crossover é frequentemente parte elétrica, parte acústica."
    >
      <div className="flex flex-wrap gap-2 mb-4">
        <Segmented
          size="sm"
          value={s.kind}
          onChange={(v) => setS((p) => ({ ...p, kind: v, invert: KINDS[v].invertDefault }))}
          options={(Object.keys(KINDS) as Kind[]).map((k) => ({ value: k, label: KINDS[k].name }))}
        />
      </div>
      <FreqPlot
        height={280}
        dbMin={-30}
        dbMax={9}
        dbStep={3}
        curves={[
          { id: 'lp', label: 'Woofer (passa-baixas)', fn: fns.lp, color: 'var(--c-b)', width: 1.5 },
          { id: 'hp', label: 'Tweeter (passa-altas)', fn: fns.hp, color: 'var(--c-target)', width: 1.5 },
          { id: 'sum', label: 'Soma acústica', fn: fns.sum, color: 'var(--c-a)', width: 2.6 },
        ]}
        ariaLabel="Resposta do crossover"
      />
      <div className="mt-2 mb-4">
        <Legend items={[{ label: 'Woofer', color: 'var(--c-b)' }, { label: 'Tweeter', color: 'var(--c-target)' }, { label: 'Soma', color: 'var(--c-a)' }]} />
      </div>
      <Controls cols={3}>
        <Slider label="Frequência de corte" value={s.fc} min={500} max={10000} log onChange={(v) => set('fc', Math.round(v))} format={fmtHz} />
        <Slider label="Nível do tweeter" value={s.level} min={-6} max={6} step={0.25} onChange={(v) => set('level', v)} format={fmtDb} />
        <Slider label="Atraso do tweeter" value={s.delay} min={-150} max={150} step={1} onChange={(v) => set('delay', v)} unit="µs" hint={`Diferença de percurso: ${fmtNum((s.delay * 1e-6 * 343) * 1000, 1)} mm`} />
      </Controls>
      <div className="flex flex-wrap gap-4 mt-4">
        <Toggle checked={s.invert} onChange={(v) => set('invert', v)} label="Inverter polaridade do tweeter" />
      </div>
      <div className="mt-4">
        <Readout
          items={[
            { label: 'Soma no ponto de corte', value: fmtDb(atFc), accent: true },
            { label: 'Cada filtro no corte', value: fmtDb(fns.lp(s.fc)) },
            { label: 'Inclinação', value: s.kind === 'bw1' ? '6 dB/oit.' : s.kind === 'lr4' ? '24 dB/oit.' : '12 dB/oit.' },
          ]}
        />
      </div>
      <p className="mt-3 text-[13px] text-soft leading-relaxed">{KINDS[s.kind].text}</p>
      <div className="mt-4">
        <SourceBar player={player} extra={<Toggle checked={s.processed} onChange={(v) => set('processed', v)} label={s.processed ? 'Ouvindo a soma' : 'Original'} />} />
      </div>
      <div className="mt-3">
        <Note>
          Experimente um atraso de 50–100 µs (2–3 cm de diferença de caminho, típico entre drivers posicionados em lugares diferentes de um
          fone): a soma se deforma perto do corte. Isso mostra por que crossover não é só “dividir frequências” — fase e geometria importam.
        </Note>
      </div>
    </LabFrame>
  );
}
