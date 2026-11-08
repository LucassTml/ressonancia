import { useMemo, useRef, useState } from 'react';
import { LabFrame, Controls, Readout } from '../../components/ui/LabFrame';
import { Segmented, Slider, Toggle, fmtHz, fmtNum } from '../../components/ui/controls';
import { useAnimationFrame, useInView } from '../../lib/hooks';
import { setupCanvas, useThemeColors, withAlpha } from '../../lib/themeColors';
import { locale, tr } from '../../i18n';

const RHO = 1.204; // kg/m³ a 20 °C
const P_REF = 20e-6;
const WINDOW_M = 2; // largura da janela mostrada: 2 metros de ar

const DEFAULTS = { freq: 440, spl: 94, phase: 0, temp: 20, mode: 'long' as 'long' | 'trans', showP: true, showD: false, speed: 1 };

/** Formata uma grandeza física com prefixo SI. */
function si(v: number, unit: string) {
  const a = Math.abs(v);
  const [k, p] = a >= 1 ? [1, ''] : a >= 1e-3 ? [1e3, 'm'] : a >= 1e-6 ? [1e6, 'µ'] : [1e9, 'n'];
  return `${fmtNum(v * k, 2)} ${p}${unit}`;
}

export default function WaveLab() {
  const [s, setS] = useState(DEFAULTS);
  const set = <K extends keyof typeof DEFAULTS>(k: K, v: (typeof DEFAULTS)[K]) => setS((p) => ({ ...p, [k]: v }));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [wrapRef, inView] = useInView<HTMLDivElement>();
  const colors = useThemeColors();
  const tRef = useRef(0);

  const phys = useMemo(() => {
    const c = 331.3 * Math.sqrt(1 + s.temp / 273.15);
    const lambda = c / s.freq;
    const p = P_REF * Math.pow(10, s.spl / 20); // amplitude RMS
    const pPeak = p * Math.SQRT2;
    const u = pPeak / (RHO * c); // velocidade de partícula (pico)
    const xi = u / (2 * Math.PI * s.freq); // deslocamento (pico)
    const I = (p * p) / (RHO * c);
    return { c, lambda, p, pPeak, u, xi, I, T: 1 / s.freq };
  }, [s.freq, s.spl, s.temp]);

  // Partículas fixas (posições de equilíbrio) com leve aleatoriedade, como gás
  const particles = useMemo(() => {
    const out: { x: number; y: number; tracer: boolean }[] = [];
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const cols = 110, rows = 13;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        out.push({ x: (c + 0.5 + (rnd() - 0.5) * 0.7) / cols, y: (r + 0.5 + (rnd() - 0.5) * 0.6) / rows, tracer: r === 6 && c % 22 === 11 });
    return out;
  }, []);

  useAnimationFrame((_, dt) => {
    const c = canvasRef.current;
    if (!c) return;
    // Câmera lenta: a onda avança ~0,5 ciclo por segundo de tela por padrão.
    tRef.current += dt * 0.5 * s.speed;
    const { g, w, h } = setupCanvas(c);
    g.clearRect(0, 0, w, h);
    const k = (2 * Math.PI * WINDOW_M) / phys.lambda; // número de onda na janela [0..1]
    const ph = (s.phase * Math.PI) / 180;
    const wt = 2 * Math.PI * tRef.current;
    const visAmp = 0.012 + 0.03 * Math.max(0, (s.spl - 30) / 100); // exagero visual
    const topH = s.mode === 'long' ? h * 0.52 : h * 0.52;
    const pad = 14;

    if (s.mode === 'long') {
      // densidade de fundo (pressão)
      const bands = 160;
      for (let i = 0; i < bands; i++) {
        const x0 = i / bands;
        const pr = Math.cos(k * x0 - wt + ph); // pressão normalizada
        g.fillStyle = withAlpha(colors.accent, 0.04 + 0.1 * Math.max(0, pr));
        g.fillRect(x0 * w, pad, w / bands + 1, topH - pad);
      }
      for (const pt of particles) {
        const disp = visAmp * Math.sin(k * pt.x - wt + ph);
        const x = (pt.x + disp) * w;
        const y = pad + pt.y * (topH - pad);
        g.beginPath();
        g.arc(x, y, pt.tracer ? 3.2 : 1.6, 0, Math.PI * 2);
        g.fillStyle = pt.tracer ? colors.diff : colors.soft;
        g.globalAlpha = pt.tracer ? 1 : 0.75;
        g.fill();
        if (pt.tracer) {
          g.globalAlpha = 0.35;
          g.strokeStyle = colors.diff;
          g.beginPath();
          g.moveTo((pt.x - visAmp) * w, y);
          g.lineTo((pt.x + visAmp) * w, y);
          g.stroke();
        }
      }
      g.globalAlpha = 1;
    } else {
      // corda: deslocamento perpendicular
      const mid = pad + (topH - pad) / 2;
      g.strokeStyle = colors.soft;
      g.lineWidth = 1.5;
      g.beginPath();
      for (let x = 0; x <= w; x += 2) {
        const y = mid - (topH - pad) * 0.35 * Math.sin(k * (x / w) - wt + ph);
        if (x === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
      for (let i = 0; i < 44; i++) {
        const x0 = (i + 0.5) / 44;
        const y = mid - (topH - pad) * 0.35 * Math.sin(k * x0 - wt + ph);
        g.beginPath();
        g.arc(x0 * w, y, i % 11 === 5 ? 3.2 : 1.8, 0, Math.PI * 2);
        g.fillStyle = i % 11 === 5 ? colors.diff : colors.soft;
        g.fill();
      }
    }

    // Gráfico inferior: pressão e/ou deslocamento ao longo de x
    const gy0 = topH + 22, gh = h - gy0 - 18, gmid = gy0 + gh / 2;
    g.strokeStyle = colors.gridStrong;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, gmid);
    g.lineTo(w, gmid);
    g.stroke();
    const plot = (fn: (x: number) => number, color: string, dash: number[] = []) => {
      g.strokeStyle = color;
      g.lineWidth = 2;
      g.setLineDash(dash);
      g.beginPath();
      for (let x = 0; x <= w; x += 2) {
        const y = gmid - (gh / 2 - 4) * fn(x / w);
        if (x === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
      g.setLineDash([]);
    };
    if (s.showP) plot((x) => Math.cos(k * x - wt + ph), colors.accent);
    if (s.showD) plot((x) => Math.sin(k * x - wt + ph), colors.b, [5, 4]);

    // marcador de comprimento de onda
    const lamPx = (phys.lambda / WINDOW_M) * w;
    if (lamPx < w * 0.95 && lamPx > 24) {
      // posiciona o colchete a partir de um pico de pressão
      let x0 = (((wt - ph) / k) % (phys.lambda / WINDOW_M)) * w;
      while (x0 < 8) x0 += lamPx;
      if (x0 + lamPx > w - 8) x0 -= lamPx;
      if (x0 >= 4) {
        const yb = gy0 - 6;
        g.strokeStyle = colors.muted;
        g.fillStyle = colors.muted;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x0, yb + 4);
        g.lineTo(x0, yb);
        g.lineTo(x0 + lamPx, yb);
        g.lineTo(x0 + lamPx, yb + 4);
        g.stroke();
        g.font = '11px Inter Variable, sans-serif';
        g.textAlign = 'center';
        g.fillText(`λ = ${phys.lambda >= 1 ? fmtNum(phys.lambda, 2) + ' m' : fmtNum(phys.lambda * 100, 1) + ' cm'}`, x0 + lamPx / 2, yb - 4);
      }
    }
    // escala
    g.fillStyle = colors.faint;
    g.font = '10.5px Inter Variable, sans-serif';
    g.textAlign = 'left';
    g.fillText('0 m', 4, h - 4);
    g.textAlign = 'right';
    g.fillText(`${WINDOW_M} m de ar`, w - 4, h - 4);
  }, inView);

  const slowFactor = s.freq / (0.5 * s.speed);

  return (
    <LabFrame
      title={tr("Simulador de ondas sonoras")}
      description={tr("Uma janela de 2 metros de ar vista em câmera lenta. Os pontos são moléculas (amostradas); os vermelhos permitem acompanhar uma molécula individual. O fundo mais escuro marca compressões.")}
      onReset={() => setS(DEFAULTS)}
      toolbar={
        <Segmented
          size="sm"
          value={s.mode}
          onChange={(v) => set('mode', v)}
          options={[
            { value: 'long', label: tr("Longitudinal (ar)") },
            { value: 'trans', label: tr("Transversal (corda)") },
          ]}
        />
      }
      footer={
        <>{tr("Deslocamento visual ampliado cerca de")}{' '}{fmtNum(0.03 * WINDOW_M / Math.max(phys.xi, 1e-12), 0)}{' '}{tr("vezes. Câmera lenta: 1 segundo na tela equivale a")}{' '}{si(1 / slowFactor, 's')}{' '}{tr("reais. A pressão (verde) é máxima onde as moléculas se aglomeram; o deslocamento (laranja) está 90° defasado dela.")}</>
      }
    >
      <div ref={wrapRef}>
        <canvas ref={canvasRef} className="w-full h-[300px] sm:h-[340px] block" aria-label={tr("Animação de onda sonora")} />
      </div>
      <div className="flex flex-wrap gap-4 mt-1 mb-4 text-[12px]">
        <Toggle checked={s.showP} onChange={(v) => set('showP', v)} label={<span className="text-accent">{tr("Pressão")}</span>} />
        <Toggle checked={s.showD} onChange={(v) => set('showD', v)} label={<span style={{ color: 'var(--c-b)' }}>{tr("Deslocamento")}</span>} />
      </div>
      <Controls cols={4}>
        <Slider label={tr("Frequência")} value={s.freq} min={100} max={4000} log onChange={(v) => set('freq', Math.round(v))} format={fmtHz} />
        <Slider label={tr("Nível (amplitude)")} value={s.spl} min={20} max={120} step={1} onChange={(v) => set('spl', v)} unit={tr("dB SPL")} />
        <Slider label={tr("Fase inicial")} value={s.phase} min={0} max={360} step={1} onChange={(v) => set('phase', v)} unit="°" />
        <Slider label={tr("Temperatura do ar")} value={s.temp} min={-20} max={40} step={1} onChange={(v) => set('temp', v)} unit="°C" />
        <Slider label={tr("Velocidade da animação")} value={s.speed} min={0} max={3} step={0.05} onChange={(v) => set('speed', v)} unit="×" />
      </Controls>
      <div className="mt-5">
        <Readout
          items={[
            { label: tr("Velocidade do som"), value: `${fmtNum(phys.c, 1)} m/s` },
            { label: tr("Comprimento de onda"), value: phys.lambda >= 1 ? `${fmtNum(phys.lambda, 2)} m` : `${fmtNum(phys.lambda * 100, 1)} cm`, accent: true },
            { label: tr("Período"), value: si(phys.T, 's') },
            { label: tr("Pressão (RMS)"), value: si(phys.p, tr("Pa")) },
            { label: tr("Deslocamento das moléculas (pico)"), value: si(phys.xi, 'm') },
            { label: tr("Velocidade das moléculas (pico)"), value: si(phys.u, 'm/s') },
            { label: tr("Intensidade"), value: `${phys.I.toLocaleString(locale, { notation: 'scientific', maximumFractionDigits: 1 })} W/m²` },
          ]}
        />
      </div>
    </LabFrame>
  );
}
