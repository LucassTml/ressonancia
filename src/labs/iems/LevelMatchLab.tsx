import { useRef, useState } from 'react';
import { LabFrame, Readout, Note } from '../../components/ui/LabFrame';
import { Button, NumberField, Segmented, fmtDb, fmtNum } from '../../components/ui/controls';
import { usePlayback, fadeGain } from '../../components/ui/audio';
import { dbToGain, demoMusicBuffer } from '../../audio/engine';

interface Trial {
  louder: 'A' | 'B';
  chosen: 'A' | 'B';
  diff: number;
}

export default function LevelMatchLab() {
  const [tab, setTab] = useState<'calc' | 'bias'>('bias');
  // calculadora
  const [sa, setSa] = useState(110);
  const [ua, setUa] = useState<'V' | 'mW'>('V');
  const [za, setZa] = useState(32);
  const [sb, setSb] = useState(104);
  const [ub, setUb] = useState<'V' | 'mW'>('mW');
  const [zb, setZb] = useState(16);
  const dbv = (s: number, u: 'V' | 'mW', z: number) => (u === 'V' ? s : s + 10 * Math.log10(1000 / z));
  const diff = dbv(sa, ua, za) - dbv(sb, ub, zb);

  // experimento de viés
  const [diffDb, setDiffDb] = useState(0.7);
  const [trials, setTrials] = useState<Trial[]>([]);
  const [listening, setListening] = useState<'A' | 'B' | null>(null);
  const louder = useRef<'A' | 'B'>(Math.random() < 0.5 ? 'A' : 'B');
  const pb = usePlayback('levelmatch');
  const gainRef = useRef<GainNode | null>(null);

  const listen = async (which: 'A' | 'B') => {
    setListening(which);
    const g = which === louder.current ? 0 : -diffDb;
    if (gainRef.current && pb.playing) {
      gainRef.current.gain.setTargetAtTime(dbToGain(g - 6), gainRef.current.context.currentTime, 0.01);
      return;
    }
    const buf = await demoMusicBuffer(48000);
    pb.start((ctx, out) => {
      const f = fadeGain(ctx, out, 1);
      const gn = ctx.createGain();
      gn.gain.value = dbToGain(g - 6);
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.loop = true;
      s.connect(gn).connect(f.node);
      s.start();
      gainRef.current = gn;
      return () => f.release(() => {
        s.stop();
        gainRef.current = null;
      });
    });
  };

  const choose = (c: 'A' | 'B') => {
    setTrials((t) => [...t, { louder: louder.current, chosen: c, diff: diffDb }]);
    louder.current = Math.random() < 0.5 ? 'A' : 'B';
    pb.stop();
    setListening(null);
  };

  const pickedLouder = trials.filter((t) => t.chosen === t.louder).length;

  return (
    <LabFrame
      title="Volume compatibilizado"
      description="Duas ferramentas: um experimento que mostra como pequenas diferenças de volume influenciam o julgamento, e uma calculadora da diferença de volume entre dois IEMs ligados à mesma fonte."
      audio={tab === 'bias'}
      onReset={() => {
        setTrials([]);
        setDiffDb(0.7);
      }}
      toolbar={<Segmented size="sm" value={tab} onChange={(v) => { pb.stop(); setTab(v); }} options={[{ value: 'bias', label: 'Experimento do viés' }, { value: 'calc', label: 'Calculadora' }]} />}
    >
      {tab === 'bias' ? (
        <>
          <p className="text-[13.5px] text-soft leading-relaxed mb-4">
            A e B tocam <strong className="text-fg">exatamente o mesmo áudio</strong>, sem nenhum processamento — exceto que um deles está {fmtNum(diffDb, 1)} dB mais baixo,
            sorteado a cada rodada. Ouça os dois, alternando, e escolha o que soa <em>melhor</em> (mais detalhado, mais encorpado, mais claro). Não tente
            adivinhar o volume.
          </p>
          <div className="grid grid-cols-2 gap-2 max-w-[420px]">
            {(['A', 'B'] as const).map((k) => (
              <button
                key={k}
                onClick={() => void listen(k)}
                className={`rounded-xl border px-4 py-4 text-left transition-colors ${listening === k ? 'border-accent bg-accent-soft' : 'border-line hover:bg-sunken'}`}
              >
                <span className="block text-[12px] text-muted">{listening === k ? 'Ouvindo' : 'Ouvir'}</span>
                <span className="block text-[18px] font-semibold text-fg">{k}</span>
              </button>
            ))}
            <Button onClick={() => choose('A')} disabled={!listening}>A soa melhor</Button>
            <Button onClick={() => choose('B')} disabled={!listening}>B soa melhor</Button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 items-center">
            <span className="text-[12.5px] text-muted">Diferença oculta:</span>
            <Segmented size="sm" value={String(diffDb)} onChange={(v) => setDiffDb(Number(v))} options={[{ value: '0.3', label: '0,3 dB' }, { value: '0.7', label: '0,7 dB' }, { value: '1.5', label: '1,5 dB' }]} />
          </div>
          <div className="mt-4">
            <Readout
              items={[
                { label: 'Rodadas', value: fmtNum(trials.length, 0) },
                { label: 'Vezes em que você preferiu o mais alto', value: trials.length ? `${pickedLouder} (${fmtNum((pickedLouder / trials.length) * 100, 0)}%)` : '—', accent: true },
                { label: 'Esperado se o volume não influenciasse', value: '50%' },
              ]}
            />
          </div>
          <div className="mt-3">
            <Note>
              Com 10 ou mais rodadas, se você preferiu o mais alto bem mais que 50% das vezes, acabou de medir o próprio viés de volume: o som era
              idêntico. É por isso que comparações entre fones, cabos, DACs ou amplificadores precisam de volumes iguais com precisão de ~0,1–0,2 dB.
            </Note>
          </div>
        </>
      ) : (
        <>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { n: 'IEM A', s: sa, setS: setSa, u: ua, setU: setUa, z: za, setZ: setZa },
              { n: 'IEM B', s: sb, setS: setSb, u: ub, setU: setUb, z: zb, setZ: setZb },
            ].map((x) => (
              <div key={x.n} className="rounded-xl border border-line px-4 py-3">
                <div className="text-[13px] font-semibold mb-2">{x.n}</div>
                <div className="grid grid-cols-2 gap-3">
                  <NumberField label="Sensibilidade" value={x.s} onChange={x.setS} unit={x.u === 'V' ? 'dB/V' : 'dB/mW'} step={0.5} />
                  <NumberField label="Impedância" value={x.z} onChange={(v) => x.setZ(Math.max(1, v))} unit="Ω" />
                </div>
                <div className="mt-2">
                  <Segmented size="sm" value={x.u} onChange={x.setU} options={[{ value: 'V', label: 'dB/V' }, { value: 'mW', label: 'dB/mW' }]} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <Readout
              items={[
                { label: 'IEM A em dB/V', value: `${fmtNum(dbv(sa, ua, za), 1)} dB/V` },
                { label: 'IEM B em dB/V', value: `${fmtNum(dbv(sb, ub, zb), 1)} dB/V` },
                { label: 'Na mesma fonte, A toca', value: `${fmtDb(diff)} ${diff >= 0 ? 'mais alto' : 'mais baixo'}`, accent: true },
              ]}
            />
          </div>
          <div className="mt-3">
            <Note>
              A sensibilidade de fábrica é um ponto de partida: é medida em 1 kHz, com tolerância. Para comparações sérias, iguale o volume
              medindo — com um acoplador e um medidor de SPL, ou com um ruído rosa e um microfone colocado igualmente nos dois casos — e ajuste
              com precisão de 0,1–0,2 dB.
            </Note>
          </div>
        </>
      )}
    </LabFrame>
  );
}
