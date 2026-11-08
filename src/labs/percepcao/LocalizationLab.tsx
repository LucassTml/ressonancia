import { useEffect, useMemo, useRef, useState } from 'react';
import { LabFrame, Readout, Note } from '../../components/ui/LabFrame';
import { Segmented, fmtNum } from '../../components/ui/controls';
import { PlayButton, usePlayback, fadeGain } from '../../components/ui/audio';
import { FreqPlot } from '../../viz/FreqPlot';
import { dbToGain, demoMusicBuffer, pinkNoiseBuffer } from '../../audio/engine';
import { tr } from '../../i18n';

const A = 0.0875; // raio da cabeça (m)
const C = 343;
const W0 = C / A;

/** Woodworth: ITD para fonte distante no plano horizontal. az em graus (0 = frente, +90 = direita). */
function itd(azDeg: number) {
  let az = ((azDeg + 180) % 360 + 360) % 360 - 180; // −180..180
  // fontes atrás espelham as da frente (cone de confusão)
  if (az > 90) az = 180 - az;
  if (az < -90) az = -180 - az;
  const th = (Math.abs(az) * Math.PI) / 180;
  return Math.sign(az) * (A / C) * (th + Math.sin(th));
}

/** Brown & Duda (1998): fator α da sombra da cabeça para o ângulo de incidência θ (graus) em relação ao ouvido. */
const alphaBD = (thetaDeg: number) => 1.05 + 0.95 * Math.cos(((Math.min(180, thetaDeg) / 150) * Math.PI));
/** Magnitude (dB) do filtro de sombra da cabeça de Brown & Duda. */
function shadowDb(thetaDeg: number, f: number) {
  const a = alphaBD(thetaDeg);
  const w = 2 * Math.PI * f;
  const num = Math.hypot(1, (a * w) / (2 * W0));
  const den = Math.hypot(1, w / (2 * W0));
  return 20 * Math.log10(num / den);
}
/** Ângulo de incidência de cada ouvido. */
function earAngles(azDeg: number) {
  const az = ((azDeg % 360) + 360) % 360; // 0..360, 90 = direita
  const toEar = (earAz: number) => {
    let d = Math.abs(az - earAz) % 360;
    if (d > 180) d = 360 - d;
    return d;
  };
  return { L: toEar(270), R: toEar(90) };
}

export default function LocalizationLab() {
  const [az, setAz] = useState(40);
  const [cues, setCues] = useState<'both' | 'itd' | 'ild'>('both');
  const [sig, setSig] = useState<'clicks' | 'noise' | 'music'>('clicks');
  const pb = usePlayback('localization');
  const nodes = useRef<{ dl: DelayNode; dr: DelayNode; sl: BiquadFilterNode; sr: BiquadFilterNode } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef(false);

  const ang = earAngles(az);
  const t = itd(az);
  const ild4k = shadowDb(ang.R, 4000) - shadowDb(ang.L, 4000);

  const apply = useMemo(
    () => () => {
      const n = nodes.current;
      if (!n) return;
      const ctx = n.dl.context;
      const now = ctx.currentTime;
      const useItd = cues !== 'ild';
      const useIld = cues !== 'itd';
      // atraso no ouvido mais distante
      n.dl.delayTime.setTargetAtTime(useItd && t > 0 ? t : 0, now, 0.01);
      n.dr.delayTime.setTargetAtTime(useItd && t < 0 ? -t : 0, now, 0.01);
      // sombra da cabeça como shelf de agudos (aproximação do filtro de Brown & Duda)
      n.sl.gain.setTargetAtTime(useIld ? 20 * Math.log10(alphaBD(ang.L)) : 0, now, 0.02);
      n.sr.gain.setTargetAtTime(useIld ? 20 * Math.log10(alphaBD(ang.R)) : 0, now, 0.02);
    },
    [t, ang.L, ang.R, cues],
  );
  useEffect(() => apply(), [apply]);

  const start = async () => {
    const buf = sig === 'music' ? await demoMusicBuffer(48000) : null;
    pb.start((ctx, out) => {
      const f = fadeGain(ctx, out, dbToGain(-6));
      let src: AudioNode;
      let stopSrc: () => void;
      if (sig === 'clicks') {
        // trem de cliques curtos: ótimos para ITD
        const len = Math.floor(ctx.sampleRate * 0.25);
        const b = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = b.getChannelData(0);
        for (let i = 0; i < 48; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / 8) * 0.9;
        const s = ctx.createBufferSource();
        s.buffer = b;
        s.loop = true;
        s.start();
        src = s;
        stopSrc = () => s.stop();
      } else {
        const s = ctx.createBufferSource();
        s.buffer = sig === 'noise' ? pinkNoiseBuffer(ctx) : buf!;
        s.loop = true;
        s.start();
        src = s;
        stopSrc = () => s.stop();
      }
      const mono = ctx.createGain();
      mono.channelCount = 1;
      mono.channelCountMode = 'explicit';
      mono.channelInterpretation = 'speakers';
      src.connect(mono);
      const dl = ctx.createDelay(0.01), dr = ctx.createDelay(0.01);
      const sl = ctx.createBiquadFilter(), sr = ctx.createBiquadFilter();
      sl.type = sr.type = 'highshelf';
      sl.frequency.value = sr.frequency.value = 1300;
      const merger = ctx.createChannelMerger(2);
      mono.connect(dl).connect(sl).connect(merger, 0, 0);
      mono.connect(dr).connect(sr).connect(merger, 0, 1);
      merger.connect(f.node);
      nodes.current = { dl, dr, sl, sr };
      apply();
      return () => f.release(() => { stopSrc(); nodes.current = null; });
    });
  };

  useEffect(() => {
    if (pb.playing) void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  const setFromPointer = (e: React.PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    const x = e.clientX - r.left - r.width / 2;
    const y = e.clientY - r.top - r.height / 2;
    const deg = (Math.atan2(x, -y) * 180) / Math.PI;
    setAz(Math.round(deg));
  };

  const R = 110;
  const rad = (az * Math.PI) / 180;
  const sx = 150 + R * Math.sin(rad), sy = 150 - R * Math.cos(rad);
  const behind = Math.abs(((az + 540) % 360) - 180) > 90;

  return (
    <LabFrame
      title={tr("Localização: ITD e ILD")}
      description={tr("Arraste a fonte ao redor da cabeça (vista de cima). O som é processado com o atraso interaural de Woodworth e com um modelo de sombra da cabeça esférica. Use fones.")}
      audio
      onReset={() => {
        setAz(40);
        setCues('both');
      }}
    >
      <div className="grid md:grid-cols-[300px_1fr] gap-6 items-start">
        <svg
          ref={svgRef}
          viewBox="0 0 300 300"
          className="w-full max-w-[300px] mx-auto touch-none cursor-grab active:cursor-grabbing"
          onPointerDown={(e) => {
            drag.current = true;
            (e.target as Element).setPointerCapture?.(e.pointerId);
            setFromPointer(e);
          }}
          onPointerMove={(e) => drag.current && setFromPointer(e)}
          onPointerUp={() => (drag.current = false)}
          role="slider"
          aria-label={tr("Direção da fonte sonora")}
          aria-valuenow={az}
          aria-valuetext={tr("{0} graus", az)}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') setAz((a) => a + 5);
            if (e.key === 'ArrowLeft') setAz((a) => a - 5);
          }}
        >
          <circle cx="150" cy="150" r={R} fill="none" stroke="var(--line)" strokeDasharray="3 5" />
          {[0, 90, 180, 270].map((d) => (
            <text key={d} x={150 + (R + 18) * Math.sin((d * Math.PI) / 180)} y={154 - (R + 18) * Math.cos((d * Math.PI) / 180)} textAnchor="middle" className="fill-[var(--fg-faint)] text-[10px]">
              {d === 0 ? 'frente' : d === 90 ? 'dir.' : d === 180 ? tr("trás") : 'esq.'}
            </text>
          ))}
          {/* caminhos até cada ouvido */}
          <line x1={sx} y1={sy} x2={112} y2={150} stroke="var(--c-b)" strokeOpacity={0.5} strokeDasharray={ang.L > 100 ? '3 4' : undefined} />
          <line x1={sx} y1={sy} x2={188} y2={150} stroke="var(--c-a)" strokeOpacity={0.5} strokeDasharray={ang.R > 100 ? '3 4' : undefined} />
          {/* cabeça */}
          <path d="M150 105 l7 -8 l7 8" fill="none" stroke="var(--fg-muted)" strokeWidth="1.5" />
          <circle cx="150" cy="150" r="38" fill="var(--bg-sunken)" stroke="var(--line-strong)" />
          <ellipse cx="111" cy="150" rx="4" ry="9" fill="var(--c-b)" />
          <ellipse cx="189" cy="150" rx="4" ry="9" fill="var(--c-a)" />
          {/* fonte */}
          <circle cx={sx} cy={sy} r="11" fill="var(--accent)" opacity={0.18} />
          <circle cx={sx} cy={sy} r="6" fill="var(--accent)" />
        </svg>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <PlayButton playing={pb.playing} onToggle={() => (pb.playing ? pb.stop() : void start())} />
            <Segmented size="sm" value={sig} onChange={setSig} options={[{ value: 'clicks', label: tr("Cliques") }, { value: 'noise', label: tr("Ruído rosa") }, { value: 'music', label: tr("Música") }]} />
          </div>
          <div className="mb-4">
            <Segmented
              size="sm"
              value={cues}
              onChange={setCues}
              options={[
                { value: 'both', label: tr("ITD + ILD") },
                { value: 'itd', label: tr("Só tempo (ITD)") },
                { value: 'ild', label: tr("Só nível (ILD)") },
              ]}
            />
          </div>
          <Readout
            items={[
              { label: tr("Azimute"), value: `${((az % 360) + 360) % 360}°` },
              { label: tr("ITD"), value: `${fmtNum(Math.abs(t) * 1e6, 0)} µs`, accent: true, hint: t === 0 ? 'centro' : t > 0 ? tr("chega antes à direita") : tr("chega antes à esquerda") },
              { label: tr("ILD em 4 kHz"), value: `${fmtNum(Math.abs(ild4k), 1)} dB` },
            ]}
          />
          <div className="mt-4">
            <FreqPlot
              height={170}
              dbMin={-20}
              dbMax={8}
              dbStep={4}
              fMin={100}
              curves={[
                { id: 'l', label: tr("Ouvido esquerdo"), fn: (f) => shadowDb(ang.L, f), color: 'var(--c-b)', width: 1.8 },
                { id: 'r', label: tr("Ouvido direito"), fn: (f) => shadowDb(ang.R, f), color: 'var(--c-a)', width: 1.8 },
              ]}
              ariaLabel={tr("Efeito de sombra da cabeça por frequência")}
            />
          </div>
        </div>
      </div>
      <div className="mt-4">
        <Note>
          {behind
            ? tr("A fonte está atrás, mas o ITD e o ILD são quase os mesmos de uma fonte espelhada na frente — é o “cone de confusão”. Sem as pistas espectrais da pina (que este modelo não tem), o cérebro não consegue distinguir frente de trás, e o som tende a parecer dentro da cabeça.")
            : tr("Compare “só tempo” e “só nível”: os dois deslocam a imagem, por mecanismos diferentes. O ITD domina abaixo de ~1,5 kHz; a sombra da cabeça (ILD) só existe onde o comprimento de onda é pequeno perto da cabeça.")}
        </Note>
      </div>
    </LabFrame>
  );
}
