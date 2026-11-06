import { useEffect, useMemo, useRef, useState } from 'react';
import { LabFrame, Controls, Readout, Note } from '../../components/ui/LabFrame';
import { Segmented, Slider, fmtHz, fmtNum } from '../../components/ui/controls';
import { PlayButton, usePlayback, fadeGain } from '../../components/ui/audio';
import { FreqPlot } from '../../viz/FreqPlot';
import { dbToGain, pinkNoiseBuffer } from '../../audio/engine';
import { useAnimationFrame, useInView } from '../../lib/hooks';
import { setupCanvas, useThemeColors } from '../../lib/themeColors';

const D = { f1: 440, f2: 440, a2: 1, ph2: 0, span: 20, routing: 'mix' as 'mix' | 'split', delay: 1, refl: 0.8 };

export default function InterferenceLab() {
  const [tab, setTab] = useState<'waves' | 'comb'>('waves');
  const [s, setS] = useState(D);
  const set = <K extends keyof typeof D>(k: K, v: (typeof D)[K]) => setS((p) => ({ ...p, [k]: v }));
  const pb = usePlayback('interference');
  const nodes = useRef<{ o1?: OscillatorNode; o2?: OscillatorNode; g2?: GainNode; dl?: DelayNode; rg?: GainNode; dry?: GainNode } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [wrap, inView] = useInView<HTMLDivElement>();
  const colors = useThemeColors();
  const tRef = useRef(0);

  const ph2 = (s.ph2 * Math.PI) / 180;
  const sameF = Math.abs(s.f1 - s.f2) < 0.01;
  const resultAmp = Math.sqrt(1 + s.a2 * s.a2 + 2 * s.a2 * Math.cos(ph2));

  useAnimationFrame((_, dt) => {
    if (tab !== 'waves') return;
    const c = canvasRef.current;
    if (!c) return;
    tRef.current += dt;
    const { g, w, h } = setupCanvas(c);
    g.clearRect(0, 0, w, h);
    const span = s.span / 1000;
    // Rola lentamente quando há batimento, para que o envelope se mova
    const t0 = sameF ? 0 : tRef.current * 0.02;
    const rows = [
      { fn: (t: number) => Math.sin(2 * Math.PI * s.f1 * t), color: colors.a, label: 'Onda 1', scale: 1 },
      { fn: (t: number) => s.a2 * Math.sin(2 * Math.PI * s.f2 * t + ph2), color: colors.b, label: 'Onda 2', scale: 1 },
      { fn: (t: number) => Math.sin(2 * Math.PI * s.f1 * t) + s.a2 * Math.sin(2 * Math.PI * s.f2 * t + ph2), color: colors.fg, label: 'Soma', scale: 0.5 },
    ];
    const rh = h / 3;
    rows.forEach((r, i) => {
      const mid = rh * i + rh / 2;
      g.strokeStyle = colors.grid;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(0, mid);
      g.lineTo(w, mid);
      g.stroke();
      g.strokeStyle = r.color;
      g.lineWidth = i === 2 ? 2 : 1.5;
      g.beginPath();
      const N = Math.min(2400, w * 2);
      for (let k = 0; k <= N; k++) {
        const t = t0 + (k / N) * span;
        const y = mid - r.fn(t) * r.scale * (rh / 2 - 8) * 0.9;
        const x = (k / N) * w;
        if (k === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
      g.fillStyle = colors.muted;
      g.font = '11px Inter Variable, sans-serif';
      g.fillText(r.label, 6, rh * i + 14);
    });
    g.fillStyle = colors.faint;
    g.textAlign = 'right';
    g.fillText(`${s.span} ms`, w - 6, h - 4);
    g.textAlign = 'left';
  }, inView && tab === 'waves');

  // atualizações ao vivo
  useEffect(() => {
    const n = nodes.current;
    if (!n) return;
    const ctxT = (n.o1 ?? n.dl)?.context.currentTime ?? 0;
    n.o1?.frequency.setTargetAtTime(s.f1, ctxT, 0.01);
    n.o2?.frequency.setTargetAtTime(s.f2, ctxT, 0.01);
    n.g2?.gain.setTargetAtTime(s.a2, ctxT, 0.01);
    n.dl?.delayTime.setTargetAtTime(s.delay / 1000, ctxT, 0.01);
    n.rg?.gain.setTargetAtTime(s.refl, ctxT, 0.01);
  }, [s]);

  // A fase relativa só pode ser definida no início dos osciladores: reinicia.
  useEffect(() => {
    if (pb.playing && tab === 'waves' && sameF) startWaves();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.ph2]);

  const startWaves = () =>
    pb.start((ctx, out) => {
      const f = fadeGain(ctx, out, dbToGain(-24));
      const o1 = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      o1.frequency.value = s.f1;
      o2.frequency.value = s.f2;
      const g2 = ctx.createGain();
      g2.gain.value = s.a2;
      // Fase: inicia o2 com o atraso correspondente quando as frequências são iguais
      const t = ctx.currentTime + 0.05;
      const delay = sameF ? ((((-s.ph2 / 360) % 1) + 1) % 1) / s.f2 : 0;
      if (s.routing === 'mix') {
        o1.connect(f.node);
        o2.connect(g2).connect(f.node);
      } else {
        const m = ctx.createChannelMerger(2);
        o1.connect(m, 0, 0);
        o2.connect(g2).connect(m, 0, 1);
        m.connect(f.node);
      }
      o1.start(t);
      o2.start(t + delay);
      nodes.current = { o1, o2, g2 };
      return () =>
        f.release(() => {
          o1.stop();
          o2.stop();
          nodes.current = null;
        });
    });

  const startComb = () =>
    pb.start((ctx, out) => {
      const f = fadeGain(ctx, out, 0.5);
      const src = ctx.createBufferSource();
      src.buffer = pinkNoiseBuffer(ctx);
      src.loop = true;
      const dry = ctx.createGain();
      const dl = ctx.createDelay(0.05);
      dl.delayTime.value = s.delay / 1000;
      const rg = ctx.createGain();
      rg.gain.value = s.refl;
      src.connect(dry).connect(f.node);
      src.connect(dl).connect(rg).connect(f.node);
      src.start();
      nodes.current = { dl, rg, dry };
      return () =>
        f.release(() => {
          src.stop();
          nodes.current = null;
        });
    });

  const combFn = useMemo(() => {
    const tau = s.delay / 1000;
    return (fr: number) => {
      const re = 1 + s.refl * Math.cos(2 * Math.PI * fr * tau);
      const im = -s.refl * Math.sin(2 * Math.PI * fr * tau);
      return 20 * Math.log10(Math.max(1e-6, Math.hypot(re, im)));
    };
  }, [s.delay, s.refl]);

  const firstNotch = 1 / (2 * (s.delay / 1000));

  return (
    <LabFrame
      title="Interferência, batimentos e filtros de pente"
      description="Ondas se somam ponto a ponto. Ajuste a fase para ver o reforço e o cancelamento; desafine levemente para ouvir batimentos; atrase uma cópia do sinal para criar um filtro de pente."
      audio
      onReset={() => setS(D)}
      toolbar={
        <Segmented
          size="sm"
          value={tab}
          onChange={(v) => {
            pb.stop();
            setTab(v);
          }}
          options={[
            { value: 'waves', label: 'Duas ondas' },
            { value: 'comb', label: 'Reflexão e pente' },
          ]}
        />
      }
    >
      {tab === 'waves' ? (
        <>
          <div ref={wrap}>
            <canvas ref={canvasRef} className="w-full h-[270px] block rounded-lg bg-sunken" />
          </div>
          <div className="flex flex-wrap items-center gap-3 my-4">
            <PlayButton playing={pb.playing} onToggle={() => (pb.playing ? pb.stop() : startWaves())} />
            <Segmented
              size="sm"
              value={s.routing}
              onChange={(v) => {
                set('routing', v);
                pb.stop();
              }}
              options={[
                { value: 'mix', label: 'Somadas no ar (ambos os ouvidos)' },
                { value: 'split', label: 'Uma em cada ouvido' },
              ]}
            />
          </div>
          <Controls cols={4}>
            <Slider label="Frequência 1" value={s.f1} min={100} max={2000} log onChange={(v) => set('f1', Math.round(v * 10) / 10)} format={fmtHz} />
            <Slider label="Frequência 2" value={s.f2} min={100} max={2000} log onChange={(v) => set('f2', Math.round(v * 10) / 10)} format={fmtHz} />
            <Slider label="Amplitude da onda 2" value={s.a2} min={0} max={1} step={0.01} onChange={(v) => set('a2', v)} format={(v) => fmtNum(v, 2)} />
            <Slider label="Fase da onda 2" value={s.ph2} min={0} max={360} step={1} onChange={(v) => set('ph2', v)} unit="°" disabled={!sameF} />
            <Slider label="Janela de tempo" value={s.span} min={2} max={500} log onChange={(v) => set('span', Math.round(v))} unit="ms" />
          </Controls>
          <div className="mt-4">
            <Readout
              items={
                sameF
                  ? [
                      { label: 'Amplitude resultante', value: `${fmtNum(resultAmp, 2)}×`, accent: true },
                      { label: 'Nível relativo à onda 1', value: `${resultAmp < 0.001 ? '−∞' : fmtNum(20 * Math.log10(resultAmp), 1)} dB` },
                      { label: 'Situação', value: s.ph2 < 30 || s.ph2 > 330 ? 'Construtiva' : Math.abs(s.ph2 - 180) < 30 ? 'Destrutiva' : 'Parcial' },
                    ]
                  : [
                      { label: 'Frequência de batimento', value: `${fmtNum(Math.abs(s.f1 - s.f2), 2)} Hz`, accent: true },
                      { label: 'Período do batimento', value: `${fmtNum(1000 / Math.abs(s.f1 - s.f2), 0)} ms` },
                      { label: 'Altura percebida (média)', value: fmtHz((s.f1 + s.f2) / 2) },
                    ]
              }
            />
          </div>
          <Note>
            {s.routing === 'split'
              ? 'Com uma onda em cada ouvido não há soma acústica: nenhum cancelamento acontece no ar. Mesmo assim, com frequências próximas, você pode ouvir “batimentos binaurais” — uma flutuação criada pelo cérebro ao comparar as fases dos dois ouvidos, bem mais fraca que o batimento real.'
              : 'Batimento real: quando as frequências diferem um pouco, as ondas alternam entre fase e contrafase. A amplitude da soma sobe e desce |f₁ − f₂| vezes por segundo. Com a fase em 180° e amplitudes iguais, o cancelamento é total.'}
          </Note>
        </>
      ) : (
        <>
          <FreqPlot
            height={250}
            dbMin={-24}
            dbMax={9}
            dbStep={6}
            curves={[{ id: 'comb', label: 'Som direto + reflexão', fn: combFn, color: 'var(--c-a)', width: 1.8 }]}
            ariaLabel="Resposta de um filtro de pente"
          />
          <div className="flex flex-wrap items-center gap-3 my-4">
            <PlayButton playing={pb.playing} onToggle={() => (pb.playing ? pb.stop() : startComb())} label="Ouvir em ruído rosa" />
          </div>
          <Controls cols={2}>
            <Slider label="Atraso da reflexão" value={s.delay} min={0.05} max={20} log onChange={(v) => set('delay', Number(v.toFixed(3)))} unit="ms" hint={`Diferença de percurso: ${fmtNum(s.delay * 34.3, 1)} cm`} />
            <Slider label="Ganho da reflexão" value={s.refl} min={0} max={1} step={0.01} onChange={(v) => set('refl', v)} format={(v) => `${fmtNum(v, 2)} (${v > 0 ? fmtNum(20 * Math.log10(v), 1) : '−∞'} dB)`} />
          </Controls>
          <div className="mt-4">
            <Readout
              items={[
                { label: 'Primeiro cancelamento', value: fmtHz(firstNotch), accent: true },
                { label: 'Espaçamento entre vales', value: fmtHz(2 * firstNotch) },
                { label: 'Profundidade máxima', value: s.refl >= 0.999 ? '−∞ dB' : `${fmtNum(20 * Math.log10(1 - s.refl), 1)} dB` },
              ]}
            />
          </div>
          <Note>
            Uma cópia atrasada de τ segundos cancela as frequências em que o atraso vale meio ciclo: f = 1/(2τ), 3/(2τ), 5/(2τ)… Atrasos
            curtos (abaixo de ~1 ms) criam poucos vales largos — é o que acontece com reflexões dentro de tubos e cavidades de fones.
            Atrasos de alguns ms criam um pente denso, ouvido como coloração “metálica” ou “oca”.
          </Note>
        </>
      )}
    </LabFrame>
  );
}
