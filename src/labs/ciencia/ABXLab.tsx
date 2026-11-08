import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { LabFrame, Readout, Note } from '../../components/ui/LabFrame';
import { Button, IconUpload, Segmented, Slider, fmtNum } from '../../components/ui/controls';
import { usePlayback, fadeGain } from '../../components/ui/audio';
import { dbToGain, decodeFile, demoMusicBuffer, pinkNoiseBuffer } from '../../audio/engine';
import { tr } from '../../i18n';

type Diff = 'level' | 'eq' | 'bits' | 'lowpass' | 'polarity' | 'none';

const DIFFS: Record<Diff, { name: string; param?: { label: string; min: number; max: number; step: number; def: number; unit: string } }> = {
  level: { name: tr("Volume"), param: { label: tr("Diferença de nível"), min: 0.1, max: 3, step: 0.1, def: 1, unit: 'dB' } },
  eq: { name: tr("EQ em 3 kHz"), param: { label: tr("Pico de EQ"), min: 0.5, max: 6, step: 0.5, def: 2, unit: 'dB' } },
  bits: { name: tr("Bits (com dither)"), param: { label: tr("Bits de B"), min: 6, max: 16, step: 1, def: 10, unit: 'bits' } },
  lowpass: { name: tr("Corte de agudos"), param: { label: tr("Passa-baixas em B"), min: 8000, max: 20000, step: 500, def: 16000, unit: 'Hz' } },
  polarity: { name: tr("Polaridade invertida") },
  none: { name: tr("Nada (controle)") },
};

/** P(X ≥ k) para X ~ Binomial(n, 1/2): probabilidade de acertar k ou mais chutando. */
export function binomialP(k: number, n: number) {
  let p = 0;
  let c = 1; // C(n, 0)
  for (let i = 0; i <= n; i++) {
    if (i >= k) p += c;
    c = (c * (n - i)) / (i + 1);
  }
  return p / Math.pow(2, n);
}

function quantizeBuffer(ctx: BaseAudioContext, src: AudioBuffer, bits: number) {
  const out = ctx.createBuffer(src.numberOfChannels, src.length, src.sampleRate);
  const levels = Math.pow(2, bits - 1);
  for (let ch = 0; ch < src.numberOfChannels; ch++) {
    const a = src.getChannelData(ch), b = out.getChannelData(ch);
    for (let i = 0; i < a.length; i++) b[i] = Math.round(a[i] * levels + (Math.random() - Math.random())) / levels;
  }
  return out;
}

interface Trial {
  x: 'A' | 'B';
  answer: 'A' | 'B';
}

export default function ABXLab() {
  const [diff, setDiff] = useState<Diff>('level');
  const [param, setParam] = useState<number>(DIFFS.level.param!.def);
  const [src, setSrc] = useState<'music' | 'pink' | 'file'>('music');
  const [file, setFile] = useState<AudioBuffer | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [trials, setTrials] = useState<Trial[]>([]);
  const [selected, setSelected] = useState<'A' | 'B' | 'X' | null>(null);
  const [reveal, setReveal] = useState(false);
  const x = useRef<'A' | 'B'>(Math.random() < 0.5 ? 'A' : 'B');
  const sel = useRef<{ ga: GainNode; gb: GainNode; ctx: AudioContext } | null>(null);
  const pb = usePlayback('abx');
  const inputRef = useRef<HTMLInputElement>(null);

  const select = (which: 'A' | 'B' | 'X') => {
    setSelected(which);
    const target = which === 'X' ? x.current : which;
    const s = sel.current;
    if (s) {
      const t = s.ctx.currentTime;
      s.ga.gain.setTargetAtTime(target === 'A' ? 1 : 0, t, 0.008);
      s.gb.gain.setTargetAtTime(target === 'B' ? 1 : 0, t, 0.008);
    } else void start(target);
  };

  const start = async (target: 'A' | 'B') => {
    const music = src === 'music' ? await demoMusicBuffer(48000) : null;
    pb.start((ctx, out) => {
      const buf = src === 'pink' ? pinkNoiseBuffer(ctx) : src === 'file' && file ? file : music!;
      const bufB = diff === 'bits' ? quantizeBuffer(ctx, buf, param) : buf;
      const f = fadeGain(ctx, out, 1);
      const sa = ctx.createBufferSource();
      const sb = ctx.createBufferSource();
      sa.buffer = buf;
      sb.buffer = bufB;
      sa.loop = sb.loop = true;
      const ga = ctx.createGain(), gb = ctx.createGain();
      ga.gain.value = target === 'A' ? 1 : 0;
      gb.gain.value = target === 'B' ? 1 : 0;
      // cadeia de B
      let bOut: AudioNode = sb;
      if (diff === 'level') {
        const g = ctx.createGain();
        g.gain.value = dbToGain(-param);
        bOut.connect(g);
        bOut = g;
      } else if (diff === 'eq') {
        const pk = ctx.createBiquadFilter();
        pk.type = 'peaking';
        pk.frequency.value = 3000;
        pk.Q.value = 1;
        pk.gain.value = param;
        bOut.connect(pk);
        bOut = pk;
      } else if (diff === 'lowpass') {
        const a = ctx.createBiquadFilter(), b = ctx.createBiquadFilter();
        a.type = b.type = 'lowpass';
        a.frequency.value = b.frequency.value = param;
        a.Q.value = b.Q.value = 20 * Math.log10(0.707);
        bOut.connect(a).connect(b);
        bOut = b;
      } else if (diff === 'polarity') {
        const g = ctx.createGain();
        g.gain.value = -1;
        bOut.connect(g);
        bOut = g;
      }
      const headroom = ctx.createGain();
      headroom.gain.value = diff === 'eq' ? dbToGain(-param) : 1;
      sa.connect(ga).connect(headroom);
      bOut.connect(gb).connect(headroom);
      headroom.connect(f.node);
      const t = ctx.currentTime + 0.05;
      sa.start(t);
      sb.start(t);
      sel.current = { ga, gb, ctx };
      return () =>
        f.release(() => {
          sa.stop();
          sb.stop();
          sel.current = null;
        });
    });
  };

  const answer = (a: 'A' | 'B') => {
    setTrials((t) => [...t, { x: x.current, answer: a }]);
    x.current = Math.random() < 0.5 ? 'A' : 'B';
    // após responder, volta a tocar o X novo, se estiver ouvindo X
    if (selected === 'X') select('X');
  };

  const resetTrials = () => {
    setTrials([]);
    setReveal(false);
    x.current = Math.random() < 0.5 ? 'A' : 'B';
  };

  const n = trials.length;
  const k = trials.filter((t) => t.x === t.answer).length;
  const p = n ? binomialP(k, n) : 1;
  const verdict = n < 10 ? tr("Faça pelo menos 10–16 tentativas antes de tirar conclusões.") : p < 0.05 ? tr("Resultado improvável por acaso (p = {0}): há evidência de que você distingue A de B nestas condições.", fmtNum(p, 3)) : tr("Resultado compatível com acaso (p = {0}): não há evidência de que você distingue A de B nestas condições — o que não prova que a diferença é inaudível para todos.", fmtNum(p, 2));

  return (
    <LabFrame
      title={tr("Teste ABX")}
      description={tr("A é o original; B tem uma diferença escolhida por você. X é sorteado a cada tentativa como A ou B. Ouça quantas vezes quiser, troque à vontade e responda: X é A ou B? A estatística diz se o seu resultado poderia ser sorte.")}
      audio
      onReset={() => {
        resetTrials();
        setDiff('level');
        setParam(1);
      }}
      footer={tr("A e B tocam sincronizados e a troca é instantânea, sem pausa. Estatística: probabilidade de acertar pelo menos k de n tentativas chutando (binomial unilateral, p = 0,5 por tentativa).")}
    >
      <div className="flex flex-wrap gap-2 mb-3">
        <Segmented
          size="sm"
          value={diff}
          onChange={(d) => {
            setDiff(d);
            if (DIFFS[d].param) setParam(DIFFS[d].param!.def);
            pb.stop();
            setSelected(null);
            resetTrials();
          }}
          options={(Object.keys(DIFFS) as Diff[]).map((d) => ({ value: d, label: DIFFS[d].name }))}
        />
      </div>
      {DIFFS[diff].param && (
        <div className="max-w-[420px] mb-4">
          <Slider
            label={DIFFS[diff].param!.label}
            value={param}
            min={DIFFS[diff].param!.min}
            max={DIFFS[diff].param!.max}
            step={DIFFS[diff].param!.step}
            onChange={(v) => {
              setParam(v);
              pb.stop();
              setSelected(null);
              resetTrials();
            }}
            format={(v) => fmtNum(v, v >= 1000 ? 0 : 1)}
            unit={DIFFS[diff].param!.unit}
          />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <Segmented
          size="sm"
          value={src}
          onChange={(v) => {
            if (v === 'file' && !file) return inputRef.current?.click();
            setSrc(v);
            pb.stop();
            setSelected(null);
          }}
          options={[
            { value: 'music', label: tr("Música demo") },
            { value: 'pink', label: tr("Ruído rosa") },
            { value: 'file', label: fileName ? fileName.slice(0, 18) : tr("Seu arquivo") },
          ]}
        />
        <Button size="sm" variant="ghost" icon={<IconUpload size={14} />} onClick={() => inputRef.current?.click()}>{tr("Abrir áudio")}</Button>
        <input
          ref={inputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={async (e) => {
            const fl = e.target.files?.[0];
            if (!fl) return;
            setFile(await decodeFile(fl));
            setFileName(fl.name);
            setSrc('file');
            pb.stop();
            setSelected(null);
          }}
        />
      </div>

      <div className="grid grid-cols-3 gap-2 max-w-[480px]">
        {(['A', 'B', 'X'] as const).map((w) => (
          <button
            key={w}
            onClick={() => select(w)}
            className={`rounded-xl border px-4 py-5 text-center transition-colors ${pb.playing && selected === w ? 'border-accent bg-accent-soft' : 'border-line hover:bg-sunken'}`}
          >
            <span className="block text-[12px] text-muted">{pb.playing && selected === w ? 'tocando' : 'ouvir'}</span>
            <span className="block text-[22px] font-semibold text-fg">{w}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <Button onClick={() => answer('A')}>X é A</Button>
        <Button onClick={() => answer('B')}>X é B</Button>
        <Button variant="ghost" onClick={() => pb.stop()}>{tr("Parar")}</Button>
      </div>

      <div className="mt-5">
        <Readout
          items={[
            { label: tr("Tentativas"), value: fmtNum(n, 0) },
            { label: tr("Acertos"), value: `${k} de ${n}`, accent: true },
            { label: tr("p (chance de ser sorte)"), value: n ? fmtNum(p, 3) : '—' },
          ]}
        />
      </div>
      <p className="mt-3 text-[13.5px] text-soft">{verdict}</p>
      <div className="flex gap-2 mt-3">
        <Button size="sm" variant="ghost" onClick={() => setReveal((r) => !r)} disabled={!n}>
          {reveal ? tr("Ocultar respostas") : tr("Revelar respostas")}
        </Button>
        <Button size="sm" variant="ghost" onClick={resetTrials} disabled={!n}>{tr("Zerar tentativas")}</Button>
      </div>
      <AnimatePresence>
        {reveal && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="flex flex-wrap gap-1 mt-3">
              {trials.map((t, i) => (
                <span key={i} className={`text-[11px] font-mono px-1.5 py-0.5 rounded ${t.x === t.answer ? 'bg-accent-soft text-accent' : 'bg-[var(--myth-soft)] text-[var(--myth)]'}`}>
                  {i + 1}: X={t.x}
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="mt-4">
        <Note>{tr("Comece com diferenças grandes (2 dB de volume, 6 dB de EQ) para sentir o método, depois diminua até não conseguir mais. Experimente o “controle” (nenhuma diferença): você deve ficar perto de 50%. Isso mostra o seu limiar nestas condições — com seu fone, seu ouvido e este trecho.")}</Note>
      </div>
    </LabFrame>
  );
}
