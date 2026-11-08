import { useEffect, useRef, useState } from 'react';
import { LabFrame, Controls, Readout, Note } from '../../components/ui/LabFrame';
import { Slider, Toggle, fmtHz, fmtNum } from '../../components/ui/controls';
import { PlayButton, usePlayback } from '../../components/ui/audio';
import { dbToGain } from '../../audio/engine';
import { useAnimationFrame, useInView } from '../../lib/hooks';
import { setupCanvas, useThemeColors, withAlpha } from '../../lib/themeColors';
import { tr } from '../../i18n';

/** Função de Greenwood (1990) para humanos: x = 0 no ápice, 1 na base. */
const greenwood = (x: number) => 165.4 * (Math.pow(10, 2.1 * x) - 0.88);
const invGreenwood = (f: number) => Math.log10(f / 165.4 + 0.88) / 2.1;
const erb = (f: number) => 24.7 * ((4.37 * f) / 1000 + 1);
const LEN_MM = 35;

export default function CochleaLab() {
  const [f1, setF1] = useState(1000);
  const [f2, setF2] = useState(1200);
  const [two, setTwo] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [wrap, inView] = useInView<HTMLDivElement>();
  const colors = useThemeColors();
  const t = useRef(0);
  const pb = usePlayback('cochlea');
  const oscs = useRef<OscillatorNode[]>([]);

  useEffect(() => {
    const [a, b] = oscs.current;
    if (a) a.frequency.setTargetAtTime(f1, a.context.currentTime, 0.01);
    if (b) b.frequency.setTargetAtTime(f2, b.context.currentTime, 0.01);
  }, [f1, f2]);

  useAnimationFrame((_, dt) => {
    const c = canvasRef.current;
    if (!c) return;
    t.current += dt;
    const { g, w, h } = setupCanvas(c);
    g.clearRect(0, 0, w, h);
    const left = 40, right = w - 16;
    const L = right - left;
    // a base (agudos) fica à esquerda, perto da janela oval; o ápice à direita
    const X = (xApexToBase: number) => left + (1 - xApexToBase) * L;
    const mid = h * 0.46;

    // membrana: estreita na base, larga no ápice
    g.beginPath();
    for (let i = 0; i <= 100; i++) {
      const u = i / 100;
      const half = 6 + 22 * u;
      const x = left + u * L;
      if (i === 0) g.moveTo(x, mid - half);
      else g.lineTo(x, mid - half);
    }
    for (let i = 100; i >= 0; i--) {
      const u = i / 100;
      const half = 6 + 22 * u;
      g.lineTo(left + u * L, mid + half);
    }
    g.closePath();
    g.fillStyle = withAlpha(colors.accent, 0.06);
    g.fill();
    g.strokeStyle = colors.line;
    g.stroke();

    const drawWave = (f: number, color: string) => {
      const xc = invGreenwood(f); // posição do pico (0 ápice..1 base)
      const env = (x: number) => {
        // envelope assimétrico: subida lenta a partir da base, queda abrupta além do pico
        const d = x - xc; // positivo = do lado da base
        return d >= 0 ? Math.exp(-Math.pow(d / 0.16, 2)) : Math.exp(-Math.pow(d / 0.035, 2));
      };
      g.strokeStyle = color;
      g.lineWidth = 2;
      g.beginPath();
      for (let i = 0; i <= 600; i++) {
        const x = 1 - i / 600; // da base para o ápice
        // fase acumulada: a onda desacelera perto do pico
        const k = 40 / (Math.abs(x - xc) + 0.04);
        const phase = (1 - x) * k - t.current * 6;
        const amp = env(x);
        const half = 6 + 22 * (1 - x);
        const y = mid - amp * half * 0.9 * Math.sin(phase);
        const px = X(x);
        if (i === 0) g.moveTo(px, y);
        else g.lineTo(px, y);
      }
      g.stroke();
      // envelope tracejado
      g.setLineDash([3, 4]);
      g.lineWidth = 1;
      g.beginPath();
      for (let i = 0; i <= 300; i++) {
        const x = 1 - i / 300;
        const half = 6 + 22 * (1 - x);
        const y = mid - env(x) * half * 0.9;
        if (i === 0) g.moveTo(X(x), y);
        else g.lineTo(X(x), y);
      }
      g.stroke();
      g.setLineDash([]);
      // marcador do pico
      g.fillStyle = color;
      g.beginPath();
      g.arc(X(xc), mid + 40, 3.5, 0, Math.PI * 2);
      g.fill();
      g.font = '11px Inter Variable, sans-serif';
      g.textAlign = 'center';
      g.fillText(fmtHz(f), X(xc), mid + 56);
    };
    drawWave(f1, colors.a);
    if (two) drawWave(f2, colors.b);

    // escala de frequências características
    g.fillStyle = colors.faint;
    g.font = '10px Inter Variable, sans-serif';
    g.textAlign = 'center';
    for (const f of [20000, 8000, 4000, 2000, 1000, 500, 200, 50]) {
      const x = X(invGreenwood(f));
      g.fillRect(x - 0.5, h - 22, 1, 5);
      g.fillText(f >= 1000 ? `${f / 1000}k` : String(f), x, h - 8);
    }
    g.textAlign = 'left';
    g.fillStyle = colors.muted;
    g.fillText('base (janela oval)', left, 14);
    g.textAlign = 'right';
    g.fillText('ápice', right, 14);
  }, inView);

  const toggle = () => {
    if (pb.playing) return pb.stop();
    pb.start((ctx, out) => {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, ctx.currentTime);
      g.gain.linearRampToValueAtTime(dbToGain(two ? -30 : -27), ctx.currentTime + 0.05);
      g.connect(out);
      const freqs = two ? [f1, f2] : [f1];
      oscs.current = freqs.map((f) => {
        const o = ctx.createOscillator();
        o.frequency.value = f;
        o.connect(g);
        o.start();
        return o;
      });
      return () => {
        g.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
        const os = oscs.current;
        setTimeout(() => os.forEach((o) => o.stop()), 80);
        oscs.current = [];
      };
    });
  };

  const sepMm = Math.abs(invGreenwood(f1) - invGreenwood(f2)) * LEN_MM;
  const inBand = Math.abs(f1 - f2) < erb((f1 + f2) / 2);

  return (
    <LabFrame
      title={tr("A cóclea desenrolada")}
      description={tr("A membrana basilar vista como uma faixa reta. Cada frequência gera uma onda viajante que cresce, atinge o máximo num ponto específico e morre logo depois. Posição segundo a função de Greenwood (1990).")}
      audio
      onReset={() => {
        setF1(1000);
        setF2(1200);
        setTwo(false);
      }}
      footer={tr("A forma da onda é um modelo qualitativo; a posição do pico em função da frequência segue a função de Greenwood para humanos. A onda está muito desacelerada: na cóclea real ela leva poucos milissegundos para chegar ao ápice.")}
    >
      <div ref={wrap}>
        <canvas ref={canvasRef} className="w-full h-[230px] block" aria-label={tr("Animação da membrana basilar")} />
      </div>
      <div className="flex flex-wrap items-center gap-4 my-4">
        <PlayButton playing={pb.playing} onToggle={toggle} />
        <Toggle checked={two} onChange={(v) => { setTwo(v); pb.stop(); }} label={tr("Dois tons simultâneos")} />
      </div>
      <Controls cols={2}>
        <Slider label={tr("Tom 1")} value={f1} min={30} max={16000} log onChange={(v) => setF1(Math.round(v))} format={fmtHz} />
        <Slider label={tr("Tom 2")} value={f2} min={30} max={16000} log onChange={(v) => setF2(Math.round(v))} format={fmtHz} disabled={!two} />
      </Controls>
      <div className="mt-4">
        <Readout
          items={[
            { label: tr("Posição do pico (a partir da base)"), value: `${fmtNum((1 - invGreenwood(f1)) * LEN_MM, 1)} mm`, accent: true },
            { label: tr("Largura do filtro auditivo (ERB)"), value: fmtHz(erb(f1)) },
            ...(two
              ? [
                  { label: tr("Distância entre picos"), value: `${fmtNum(sepMm, 1)} mm` },
                  { label: tr("Mesma banda crítica?"), value: inBand ? tr("Sim — interagem") : tr("Não — resolvidos") },
                ]
              : [{ label: tr("Frequência no ponto médio da membrana"), value: fmtHz(greenwood(0.5)) }]),
          ]}
        />
      </div>
      <div className="mt-3">
        <Note>{tr("Repare que de 20 Hz a ~500 Hz ocupam pouco espaço, enquanto cada oitava acima de 1 kHz ganha uns 4–5 mm: a cóclea é aproximadamente logarítmica acima de algumas centenas de hertz. Com dois tons próximos, as ondas se sobrepõem — base do mascaramento e da rugosidade.")}</Note>
      </div>
    </LabFrame>
  );
}
