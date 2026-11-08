import { useMemo, useRef, useState } from 'react';
import { LabFrame, Controls, Readout, Note } from '../../components/ui/LabFrame';
import { Segmented, Slider, fmtHz, fmtNum } from '../../components/ui/controls';
import { FreqPlot, Legend } from '../../viz/FreqPlot';
import { useAnimationFrame, useInView } from '../../lib/hooks';
import { setupCanvas, useThemeColors, withAlpha } from '../../lib/themeColors';
import { tr } from '../../i18n';

/**
 * Oscilador harmônico forçado: m·x'' + R·x' + k·x = F·sin(ωt).
 * X(ω) = F / (k − mω² + jωR). Em campo livre, a pressão irradiada por um
 * pistão pequeno é proporcional à aceleração; numa câmara pequena e vedada,
 * é proporcional ao deslocamento (variação de volume).
 */
const D = { f0: 1500, q: 1.2, drive: 300, view: 'both' as 'both' | 'free' | 'sealed' };

export default function ResonatorLab() {
  const [s, setS] = useState(D);
  const set = <K extends keyof typeof D>(k: K, v: (typeof D)[K]) => setS((p) => ({ ...p, [k]: v }));
  const colors = useThemeColors();
  const ref = useRef<HTMLCanvasElement>(null);
  const [wrap, inView] = useInView<HTMLDivElement>();
  const t = useRef(0);

  // parâmetros normalizados: m = 1, k = ω0², R = ω0/Q
  const w0 = 2 * Math.PI * s.f0;
  const resp = useMemo(() => {
    const H = (f: number) => {
      const w = 2 * Math.PI * f;
      const re = w0 * w0 - w * w;
      const im = (w * w0) / s.q;
      const mag = 1 / Math.hypot(re, im);
      const ph = -Math.atan2(im, re);
      return { mag, ph, w };
    };
    const ref1 = H(20).mag * w0 * w0; // normaliza deslocamento em baixa frequência = 1
    return {
      disp: (f: number) => 20 * Math.log10(H(f).mag * w0 * w0 / ref1),
      acc: (f: number) => {
        const h = H(f);
        return 20 * Math.log10((h.mag * h.w * h.w) / (H(20000).mag * (2 * Math.PI * 20000) ** 2));
      },
      phase: (f: number) => H(f).ph,
      ampAt: (f: number) => H(f).mag * w0 * w0 / ref1,
    };
  }, [w0, s.q]);

  useAnimationFrame((_, dt) => {
    const c = ref.current;
    if (!c) return;
    t.current += dt;
    const { g, w, h } = setupCanvas(c);
    g.clearRect(0, 0, w, h);
    const ph = resp.phase(s.drive);
    const amp = Math.min(3, resp.ampAt(s.drive));
    const vis = 0.9; // ciclos por segundo na animação
    const force = Math.sin(2 * Math.PI * vis * t.current);
    const x = Math.sin(2 * Math.PI * vis * t.current + ph) * amp;
    const cy = h / 2;
    const wallX = 30;
    const restX = w * 0.45;
    const mx = restX + x * 40;
    // parede
    g.fillStyle = colors.lineStrong;
    g.fillRect(wallX - 6, cy - 50, 6, 100);
    // mola
    g.strokeStyle = colors.muted;
    g.lineWidth = 1.6;
    g.beginPath();
    const coils = 12;
    for (let i = 0; i <= coils * 2; i++) {
      const px = wallX + ((mx - 30 - wallX) * i) / (coils * 2);
      const py = cy - 14 + (i % 2 ? -10 : 10) * (i === 0 || i === coils * 2 ? 0 : 1);
      if (i === 0) g.moveTo(px, cy - 14);
      else g.lineTo(px, py);
    }
    g.stroke();
    // amortecedor
    g.strokeStyle = colors.faint;
    g.beginPath();
    g.moveTo(wallX, cy + 18);
    g.lineTo(wallX + 60, cy + 18);
    g.moveTo(mx - 30, cy + 18);
    g.lineTo(wallX + 90, cy + 18);
    g.stroke();
    g.strokeRect(wallX + 60, cy + 10, 40, 16);
    // massa (diafragma)
    g.fillStyle = withAlpha(colors.accent, 0.25);
    g.strokeStyle = colors.accent;
    g.lineWidth = 1.5;
    g.beginPath();
    g.roundRect(mx - 30, cy - 34, 60, 68, 8);
    g.fill();
    g.stroke();
    g.fillStyle = colors.fg;
    g.font = '11px Inter Variable, sans-serif';
    g.textAlign = 'center';
    g.fillText('massa', mx, cy + 4);
    // força
    const fx = mx + 34;
    g.strokeStyle = colors.b;
    g.fillStyle = colors.b;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(fx, cy);
    g.lineTo(fx + force * 50, cy);
    g.stroke();
    g.beginPath();
    g.arc(fx + force * 50, cy, 3, 0, Math.PI * 2);
    g.fill();
    g.fillText('força', fx + 30, cy - 12);
    // traços no tempo
    const ox = w * 0.66, ow = w - ox - 10;
    g.strokeStyle = colors.grid;
    g.beginPath();
    g.moveTo(ox, cy);
    g.lineTo(ox + ow, cy);
    g.stroke();
    const tr = (fn: (u: number) => number, col: string) => {
      g.strokeStyle = col;
      g.lineWidth = 1.6;
      g.beginPath();
      for (let i = 0; i <= 100; i++) {
        const u = i / 100;
        const y = cy - fn(u) * 22;
        if (!i) g.moveTo(ox + u * ow, y);
        else g.lineTo(ox + u * ow, y);
      }
      g.stroke();
    };
    tr((u) => Math.sin(2 * Math.PI * (vis * t.current - u * 1.5)), colors.b);
    tr((u) => Math.sin(2 * Math.PI * (vis * t.current - u * 1.5) + ph) * Math.min(2.2, amp), colors.accent);
    g.fillStyle = colors.muted;
    g.textAlign = 'left';
    g.fillText(`defasagem: ${fmtNum((-ph * 180) / Math.PI, 0)}°`, ox, cy + 46);
  }, inView);

  const qLabel = s.q < 0.6 ? 'superamortecido' : s.q < 0.8 ? 'crítico' : s.q < 2 ? 'moderado' : 'pouco amortecido';

  return (
    <LabFrame
      title={tr("Ressonância de um diafragma")}
      description={tr("Todo driver é, em essência, uma massa presa a uma mola, com algum atrito. A mesma física produz respostas opostas conforme o ambiente: no ar livre, a pressão acompanha a aceleração; numa câmara vedada pequena — como um canal com IEM —, acompanha o deslocamento.")}
      onReset={() => setS(D)}
      toolbar={
        <Segmented
          size="sm"
          value={s.view}
          onChange={(v) => set('view', v)}
          options={[
            { value: 'both', label: tr("Comparar") },
            { value: 'free', label: tr("Campo livre") },
            { value: 'sealed', label: tr("Câmara vedada") },
          ]}
        />
      }
    >
      <div ref={wrap}>
        <canvas ref={ref} className="w-full h-[150px] block rounded-xl bg-sunken" aria-label={tr("Animação do sistema massa-mola")} />
      </div>
      <div className="mt-4">
        <FreqPlot
          height={240}
          dbMin={-40}
          dbMax={20}
          dbStep={10}
          yLabel="dB (relativo)"
          curves={[
            ...(s.view !== 'sealed' ? [{ id: 'free', label: tr("Pressão em campo livre (∝ aceleração)"), fn: resp.acc, color: 'var(--c-b)', width: 2.2 }] : []),
            ...(s.view !== 'free' ? [{ id: 'sealed', label: tr("Pressão em câmara vedada (∝ deslocamento)"), fn: resp.disp, color: 'var(--c-a)', width: 2.4 }] : []),
          ]}
          overlay={(sc) => <line x1={sc.x(s.drive)} x2={sc.x(s.drive)} y1={sc.top} y2={sc.top + sc.innerH} stroke="var(--fg-faint)" strokeDasharray="3 3" />}
          ariaLabel={tr("Resposta do oscilador")}
        />
        <div className="mt-2">
          <Legend
            items={[
              ...(s.view !== 'sealed' ? [{ label: tr("Campo livre (alto-falante)"), color: 'var(--c-b)' }] : []),
              ...(s.view !== 'free' ? [{ label: tr("Câmara vedada (IEM)"), color: 'var(--c-a)' }] : []),
            ]}
          />
        </div>
      </div>
      <div className="mt-4">
        <Controls cols={3}>
          <Slider label={tr("Frequência de ressonância")} value={s.f0} min={30} max={8000} log onChange={(v) => set('f0', Math.round(v))} format={fmtHz} />
          <Slider label={tr("Fator Q (amortecimento)")} value={s.q} min={0.3} max={8} log onChange={(v) => set('q', Number(v.toFixed(2)))} format={(v) => `${fmtNum(v, 2)} · ${qLabel}`} />
          <Slider label={tr("Frequência da força (animação)")} value={s.drive} min={20} max={20000} log onChange={(v) => set('drive', Math.round(v))} format={fmtHz} />
        </Controls>
      </div>
      <div className="mt-4">
        <Readout
          items={[
            { label: 'f₀ = (1/2π)·√(k/m)', value: fmtHz(s.f0), accent: true },
            { label: tr("Ganho na ressonância"), value: `${fmtNum(20 * Math.log10(s.q), 1)} dB` },
            { label: tr("Região de controle em ") + fmtHz(s.drive), value: s.drive < s.f0 / 2 ? tr("rigidez (mola)") : s.drive > s.f0 * 2 ? 'massa' : tr("ressonância") },
          ]}
        />
      </div>
      <div className="mt-3">
        <Note>{tr("Abaixo de f₀, a mola domina: o deslocamento é constante e a massa segue a força em fase. Acima, a massa domina: o deslocamento cai 12 dB por oitava, mas a aceleração fica constante. Por isso alto-falantes ficam com a ressonância no limite inferior da faixa útil, e drivers de IEM podem ter a ressonância lá em cima: na câmara vedada, tudo abaixo dela é plano até frequências muito baixas.")}</Note>
      </div>
    </LabFrame>
  );
}
