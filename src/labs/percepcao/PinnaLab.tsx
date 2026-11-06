import { useEffect, useMemo, useRef, useState } from 'react';
import { LabFrame, Controls, Readout, Note } from '../../components/ui/LabFrame';
import { Segmented, Slider, Toggle, fmtHz, fmtNum } from '../../components/ui/controls';
import { SourceBar, useSourcePlayer } from '../../components/ui/audio';
import { FreqPlot, Legend } from '../../viz/FreqPlot';
import { biquadCoefs, biquadDb, firBuffer, interpCurve } from '../../audio/dsp';
import { targetById } from '../../data/targets';
import { useAnimationFrame, useInView } from '../../lib/hooks';
import { setupCanvas, useThemeColors, withAlpha } from '../../lib/themeColors';

const C = 343;
const FS = 96000;
const peak = (f: number, fc: number, gain: number, q: number) => biquadDb(biquadCoefs({ id: '', type: 'peaking', freq: fc, gain, q }, FS), f, FS);

const D = { canal: 25, concha: 12, elev: 0, insertion: 8, mode: 'open' as 'open' | 'iem', showParts: true, amount: -1 };

/** Modelo didático da transformação campo → tímpano (somas de ressonâncias em dB). */
export function pinnaModel(p: { canal: number; concha: number; elev: number }) {
  const fCanal = C / (4 * ((p.canal + 4) / 1000)); // quarto de onda + correção de extremidade
  const fConcha = C / (4 * ((p.concha + 5) / 1000));
  const dd = (2.86 - ((p.elev + 40) / 100) * 1.3) / 100; // diferença de percurso da reflexão na concha (m)
  const fNotch = C / (2 * dd);
  return {
    fCanal,
    fConcha,
    fNotch,
    head: (f: number) => peak(f, 1200, 4, 0.6),
    canalFn: (f: number) => peak(f, fCanal, 12, 1.2),
    conchaFn: (f: number) => peak(f, fConcha, 9, 1.8),
    notchFn: (f: number) => peak(f, fNotch, -12, 5),
  };
}

export default function PinnaLab() {
  const [s, setS] = useState(D);
  const set = <K extends keyof typeof D>(k: K, v: (typeof D)[K]) => setS((p) => ({ ...p, [k]: v }));
  const colors = useThemeColors();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [wrap, inView] = useInView<HTMLDivElement>();
  const tt = useRef(0);

  const m = useMemo(() => pinnaModel(s), [s.canal, s.concha, s.elev]);
  const lres = Math.max(4, s.canal - s.insertion);
  const fOcc = C / (2 * ((lres + 4) / 1000));
  const occFn = (f: number) => peak(f, fOcc, 10, 3);
  const openTotal = (f: number) => m.head(f) + m.canalFn(f) + m.conchaFn(f) + m.notchFn(f);
  const total = s.mode === 'open' ? openTotal : occFn;

  const iso = targetById['df-iso11904'].curve;
  const isoOffset = -interpCurve(iso, 100);
  const measured = (f: number) => interpCurve(iso, f) + isoOffset;

  // ---------- áudio: remove/reforça o ganho da orelha ----------
  const convRef = useRef<ConvolverNode | null>(null);
  const gainFn = useMemo(() => (f: number) => s.amount * openTotal(f), [s.amount, m]); // eslint-disable-line react-hooks/exhaustive-deps
  const player = useSourcePlayer('pinna', (ctx, input, output) => {
    const conv = ctx.createConvolver();
    conv.normalize = false;
    conv.buffer = firBuffer(ctx, gainFn);
    const g = ctx.createGain();
    g.gain.value = s.amount > 0 ? 0.35 : 1;
    input.connect(conv).connect(g).connect(output);
    convRef.current = conv;
    return () => (convRef.current = null);
  });
  useEffect(() => {
    const c = convRef.current;
    if (c) c.buffer = firBuffer(c.context, gainFn);
  }, [gainFn]);

  // ---------- animação em corte ----------
  useAnimationFrame((_, dt) => {
    const cv = canvasRef.current;
    if (!cv) return;
    tt.current += dt;
    const { g, w, h } = setupCanvas(cv);
    g.clearRect(0, 0, w, h);
    const sc = Math.min(w / 360, h / 220);
    g.save();
    g.translate((w - 360 * sc) / 2, (h - 220 * sc) / 2);
    g.scale(sc, sc);

    const skin = withAlpha(colors.fg, 0.07);
    const edge = colors.lineStrong;
    const canalY = 120, canalX0 = 165, canalX1 = 165 + s.canal * 6.4; // 1 mm ≈ 6,4 px
    const iem = s.mode === 'iem';

    // cabeça (tecido) acima e abaixo do canal
    g.fillStyle = skin;
    g.fillRect(canalX0, 20, 360 - canalX0, canalY - 14 - 20);
    g.fillRect(canalX0, canalY + 14, 360 - canalX0, 200 - canalY - 14);
    // canal
    g.strokeStyle = edge;
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(canalX0, canalY - 14);
    g.lineTo(canalX1, canalY - 14);
    g.moveTo(canalX0, canalY + 14);
    g.lineTo(canalX1, canalY + 14);
    g.stroke();
    // tímpano
    g.strokeStyle = colors.diff;
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(canalX1 - 6, canalY - 14);
    g.lineTo(canalX1 + 6, canalY + 14);
    g.stroke();

    // concha e pina (vista esquemática)
    if (!iem) {
      g.fillStyle = skin;
      g.strokeStyle = edge;
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(canalX0, canalY - 14);
      g.quadraticCurveTo(canalX0 - 10, canalY - 14 - s.concha * 3.2, canalX0 - 40, canalY - 60);
      g.quadraticCurveTo(canalX0 - 62, canalY - 110, canalX0 - 20, canalY - 100);
      g.lineTo(canalX0, 20);
      g.lineTo(canalX0, canalY - 14);
      g.fill();
      g.stroke();
      g.beginPath();
      g.moveTo(canalX0, canalY + 14);
      g.quadraticCurveTo(canalX0 - 18, canalY + 50, canalX0 - 30, canalY + 70);
      g.quadraticCurveTo(canalX0 - 20, canalY + 88, canalX0, 200);
      g.stroke();
    } else {
      // corpo do IEM e bocal inserido
      const nz = canalX0 + s.insertion * 6.4;
      g.fillStyle = withAlpha(colors.accent, 0.25);
      g.strokeStyle = colors.accent;
      g.lineWidth = 1.4;
      g.beginPath();
      g.roundRect(canalX0 - 70, canalY - 45, 72, 90, 18);
      g.fill();
      g.stroke();
      g.fillStyle = withAlpha(colors.accent, 0.4);
      g.fillRect(canalX0, canalY - 11, nz - canalX0, 22);
      g.fillStyle = colors.muted;
      g.font = '10px Inter Variable, sans-serif';
      g.fillText('IEM', canalX0 - 48, canalY + 4);
    }

    // padrão de pressão estacionária no canal
    const x0 = iem ? canalX0 + s.insertion * 6.4 : canalX0;
    const len = canalX1 - x0;
    const osc = Math.sin(tt.current * 3.2);
    for (let i = 0; i <= 40; i++) {
      const u = i / 40;
      // aberto: quarto de onda (nó na entrada, ventre no tímpano); IEM: meia onda (ventres nas pontas)
      const amp = iem ? Math.cos(Math.PI * u) : Math.sin((Math.PI / 2) * u);
      const a = Math.abs(amp * osc);
      g.fillStyle = withAlpha(amp * osc > 0 ? colors.accent : colors.b, 0.08 + 0.45 * a);
      g.fillRect(x0 + u * len - len / 80, canalY - 12, len / 40 + 1, 24);
    }

    // frentes de onda chegando (somente orelha aberta)
    if (!iem) {
      const ang = (s.elev * Math.PI) / 180; // elevação positiva: som vindo de cima
      const ux = Math.cos(ang), uy = Math.sin(ang); // direção de propagação (y para baixo)
      const vx = -uy, vy = ux;
      const entryPt = { x: canalX0, y: canalY };
      const O = { x: entryPt.x - 200 * ux, y: entryPt.y - 200 * uy };
      const phase = (tt.current * 40) % 26;
      g.save();
      g.beginPath();
      g.rect(0, 0, canalX0 - 2, 220);
      g.clip();
      g.strokeStyle = withAlpha(colors.fg, 0.28);
      g.lineWidth = 1;
      for (let k = 0; k < 9; k++) {
        const d = k * 26 + phase;
        const px = O.x + d * ux, py = O.y + d * uy;
        g.beginPath();
        g.moveTo(px - 140 * vx, py - 140 * vy);
        g.lineTo(px + 140 * vx, py + 140 * vy);
        g.stroke();
      }
      g.restore();
      // raios: direto e refletido na parede da concha
      const entry = { x: canalX0 - 2, y: canalY };
      const wall = { x: canalX0 - 34, y: canalY - 58 };
      const from = { x: entryPt.x - 140 * ux, y: entryPt.y - 140 * uy };
      const dash = -(tt.current * 30) % 12;
      g.setLineDash([5, 7]);
      g.lineDashOffset = dash;
      g.lineWidth = 1.8;
      g.strokeStyle = colors.a;
      g.beginPath();
      g.moveTo(from.x, from.y);
      g.lineTo(entry.x, entry.y);
      g.stroke();
      g.strokeStyle = colors.b;
      g.beginPath();
      g.moveTo(from.x, from.y - 30);
      g.lineTo(wall.x, wall.y);
      g.lineTo(entry.x, entry.y);
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = colors.muted;
      g.font = '10px Inter Variable, sans-serif';
      g.fillText('direto', 40, from.y + 14);
      g.fillStyle = colors.b;
      g.fillText('refletido na concha', wall.x - 90, wall.y - 8);
    }
    g.fillStyle = colors.muted;
    g.font = '10px Inter Variable, sans-serif';
    g.fillText(iem ? `canal residual: ${fmtNum(lres, 0)} mm` : `canal: ${s.canal} mm`, canalX0 + 6, canalY + 32);
    g.fillStyle = colors.diff;
    g.fillText('tímpano', canalX1 - 20, canalY - 20);
    g.restore();
  }, inView);

  const parts = s.mode === 'open' && s.showParts;

  return (
    <LabFrame
      title="Pinna gain: do campo sonoro ao tímpano"
      description="À esquerda, um corte esquemático: frentes de onda, o caminho direto e a reflexão na concha, e a onda estacionária no canal. À direita (ou abaixo), a resposta resultante no tímpano segundo um modelo de ressonâncias, comparada à média medida em pessoas (ISO 11904)."
      audio
      onReset={() => setS(D)}
      toolbar={
        <Segmented
          size="sm"
          value={s.mode}
          onChange={(v) => set('mode', v)}
          options={[
            { value: 'open', label: 'Orelha livre' },
            { value: 'iem', label: 'Com IEM inserido' },
          ]}
        />
      }
      footer="Modelo didático: cada mecanismo é representado por uma ressonância (ou cancelamento) independente, somadas em dB. A física real envolve modos acoplados e difração tridimensional, e varia muito entre pessoas. A curva tracejada é a transformação média de campo difuso até o ponto de referência do tímpano (ISO 11904), deslocada para 0 dB em 100 Hz."
    >
      <div className="grid lg:grid-cols-[1fr_1.15fr] gap-4 items-center">
        <div ref={wrap} className="rounded-xl bg-sunken">
          <canvas ref={canvasRef} className="w-full h-[240px] block" aria-label="Corte esquemático do ouvido externo" />
        </div>
        <div>
          <FreqPlot
            height={250}
            dbMin={-12}
            dbMax={24}
            dbStep={6}
            fMin={100}
            curves={[
              ...(s.mode === 'open'
                ? [{ id: 'iso', label: 'Medido (ISO 11904, campo difuso)', fn: measured, color: 'var(--c-target)', width: 1.6, dash: '5 4' }]
                : []),
              ...(parts
                ? [
                    { id: 'canal', label: 'Canal (¼ de onda)', fn: m.canalFn, color: 'var(--c-a)', width: 1, opacity: 0.55 },
                    { id: 'concha', label: 'Concha', fn: m.conchaFn, color: 'var(--c-b)', width: 1, opacity: 0.55 },
                    { id: 'notch', label: 'Reflexão da pina', fn: m.notchFn, color: 'var(--c-diff)', width: 1, opacity: 0.55 },
                  ]
                : []),
              { id: 'total', label: s.mode === 'open' ? 'Modelo: total' : 'Canal ocluído (½ onda)', fn: total, color: 'var(--fg)', width: 2.4 },
            ]}
            ariaLabel="Ganho do campo ao tímpano"
          />
          <div className="mt-2">
            <Legend
              items={
                s.mode === 'open'
                  ? [
                      { label: 'Total (modelo)', color: 'var(--fg)' },
                      { label: 'Média medida', color: 'var(--c-target)', dash: true },
                      ...(parts ? [{ label: 'Canal', color: 'var(--c-a)' }, { label: 'Concha', color: 'var(--c-b)' }, { label: 'Reflexão', color: 'var(--c-diff)' }] : []),
                    ]
                  : [{ label: 'Ressonância do canal fechado pelo IEM', color: 'var(--fg)' }]
              }
            />
          </div>
        </div>
      </div>

      <div className="mt-5">
        {s.mode === 'open' ? (
          <Controls cols={3}>
            <Slider label="Comprimento do canal" value={s.canal} min={18} max={32} step={0.5} onChange={(v) => set('canal', v)} unit="mm" hint={`Ressonância: ${fmtHz(m.fCanal)}`} />
            <Slider label="Profundidade da concha" value={s.concha} min={8} max={18} step={0.5} onChange={(v) => set('concha', v)} unit="mm" hint={`Ressonância: ${fmtHz(m.fConcha)}`} />
            <Slider label="Elevação da fonte" value={s.elev} min={-40} max={60} step={1} onChange={(v) => set('elev', v)} unit="°" hint={`Vale da reflexão: ${fmtHz(m.fNotch)}`} />
          </Controls>
        ) : (
          <Controls cols={3}>
            <Slider label="Comprimento do canal" value={s.canal} min={18} max={32} step={0.5} onChange={(v) => set('canal', v)} unit="mm" />
            <Slider label="Profundidade de inserção" value={s.insertion} min={2} max={14} step={0.5} onChange={(v) => set('insertion', v)} unit="mm" hint={`Ressonância do canal fechado: ${fmtHz(fOcc)}`} />
          </Controls>
        )}
        <div className="mt-3 flex flex-wrap gap-4">
          {s.mode === 'open' && <Toggle checked={s.showParts} onChange={(v) => set('showParts', v)} label="Mostrar componentes" />}
        </div>
      </div>

      <div className="mt-4">
        <Readout
          items={
            s.mode === 'open'
              ? [
                  { label: 'Ganho máximo (modelo)', value: `${fmtNum(Math.max(...[2000, 2500, 3000, 3500, 4000, 5000].map(openTotal)), 1)} dB`, accent: true },
                  { label: 'Ressonância do canal', value: fmtHz(m.fCanal) },
                  { label: 'Ressonância da concha', value: fmtHz(m.fConcha) },
                  { label: 'Vale direcional', value: fmtHz(m.fNotch) },
                ]
              : [
                  { label: 'Canal residual', value: `${fmtNum(lres, 1)} mm`, accent: true },
                  { label: 'Ressonância de ½ onda', value: fmtHz(fOcc) },
                  { label: 'Ganho de ~3 kHz da orelha', value: 'perdido' },
                ]
          }
        />
      </div>

      <div className="mt-6 pt-5 border-t border-line">
        <div className="text-[13px] font-medium text-fg mb-1">Ouça a importância do ganho da orelha</div>
        <p className="text-[12.5px] text-muted mb-3 leading-relaxed">
          Seu fone já entrega o som com algum ganho na região de presença. Este controle aplica o modelo acima ao áudio — negativo
          remove o ganho (como se a orelha não existisse), positivo o aplica de novo (como se ele fosse contado duas vezes).
        </p>
        <Controls cols={2}>
          <Slider label="Ganho da orelha aplicado" value={s.amount} min={-1} max={1} step={0.05} onChange={(v) => set('amount', v)} format={(v) => `${v > 0 ? '+' : ''}${fmtNum(v * 100, 0)}%`} />
        </Controls>
        <div className="mt-3">
          <SourceBar player={player} />
        </div>
        <div className="mt-3">
          <Note>
            Em −100%, o som fica escuro, distante, “atrás de uma cortina”. Em +100%, gritado e áspero. Fones precisam acertar esse ganho
            — e é exatamente isso que as curvas-alvo tentam definir.
          </Note>
        </div>
      </div>
    </LabFrame>
  );
}
