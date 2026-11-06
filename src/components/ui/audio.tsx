import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  claimPlayback,
  decodeFile,
  demoMusicBuffer,
  getAudio,
  masterVolumeStore,
  pinkNoiseBuffer,
  releasePlayback,
} from '../../audio/engine';
import { audioNoticeStore } from '../../lib/prefs';
import { useStore } from '../../lib/storage';
import { Button, IconAlert, IconPlay, IconStop, IconUpload, IconVolume, Segmented } from './controls';

/* ------------------------------------------------------------------ */
/* Volume mestre + aviso                                               */
/* ------------------------------------------------------------------ */

export function MasterVolume({ compact }: { compact?: boolean }) {
  const v = useStore(masterVolumeStore);
  const db = 20 * Math.log10(Math.max(v, 0.0001));
  return (
    <div className={`flex items-center gap-2 ${compact ? '' : 'min-w-[180px]'}`}>
      <IconVolume size={15} className="text-muted shrink-0" />
      <input
        aria-label="Volume mestre"
        type="range"
        className="range w-24"
        min={0}
        max={1000}
        value={Math.round((v / 0.7) * 1000)}
        style={{ ['--pct' as string]: `${(v / 0.7) * 100}%` }}
        onChange={(e) => masterVolumeStore.set((Number(e.target.value) / 1000) * 0.7)}
      />
      <span className="text-[11.5px] font-mono tabular text-muted w-14">{v < 0.001 ? 'mudo' : `${db.toFixed(0)} dB`}</span>
    </div>
  );
}

export function AudioNotice() {
  const ack = useStore(audioNoticeStore);
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[12px] text-muted">
      <AnimatePresence initial={false}>
        {!ack ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-start gap-2 basis-full rounded-lg px-3 py-2 bg-[var(--warn-soft)] text-[var(--warn)] overflow-hidden"
          >
            <IconAlert size={15} className="shrink-0 mt-[1px]" />
            <p className="leading-snug">
              <strong className="font-semibold">Proteja sua audição.</strong> Antes de tocar, abaixe o volume do sistema e
              aumente aos poucos. Tons puros e ruído soam mais altos do que parecem. O som deste site é limitado a −3 dBFS,
              mas o nível final depende do seu aparelho e fone.{' '}
              <button className="underline underline-offset-2 font-medium" onClick={() => audioNoticeStore.set(true)}>
                Entendi
              </button>
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <MasterVolume />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Reprodução genérica                                                 */
/* ------------------------------------------------------------------ */

let ownerSeq = 0;

/**
 * Controle de reprodução para sons gerados pelo próprio laboratório.
 * `start` recebe (ctx, out) e deve retornar a função de parada.
 */
export function usePlayback(name = 'lab') {
  const owner = useRef(`${name}-${++ownerSeq}`).current;
  const [playing, setPlaying] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);

  const stop = useCallback(() => {
    const s = stopRef.current;
    stopRef.current = null;
    if (s) s();
    releasePlayback(owner);
    setPlaying(false);
  }, [owner]);

  const start = useCallback(
    (fn: (ctx: AudioContext, out: AudioNode) => () => void) => {
      const { ctx, out } = getAudio();
      if (stopRef.current) {
        stopRef.current();
        stopRef.current = null;
      }
      const s = fn(ctx, out);
      stopRef.current = s;
      claimPlayback(owner, () => {
        s();
        stopRef.current = null;
        setPlaying(false);
      });
      setPlaying(true);
    },
    [owner],
  );

  useEffect(() => () => stop(), [stop]);
  return { playing, start, stop, owner };
}

export function PlayButton({
  playing,
  onToggle,
  label = 'Tocar',
  disabled,
}: {
  playing: boolean;
  onToggle: () => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <Button
      variant={playing ? 'outline' : 'primary'}
      onClick={onToggle}
      disabled={disabled}
      icon={playing ? <IconStop size={13} /> : <IconPlay size={13} />}
      aria-pressed={playing}
      className="min-w-[96px]"
    >
      {playing ? 'Parar' : label}
    </Button>
  );
}

/** Fade de entrada/saída para evitar estalos. */
export function fadeGain(ctx: AudioContext, out: AudioNode, level = 1) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, ctx.currentTime);
  g.gain.linearRampToValueAtTime(level, ctx.currentTime + 0.04);
  g.connect(out);
  const release = (after: () => void) => {
    const t = ctx.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0, t + 0.05);
    setTimeout(() => {
      after();
      g.disconnect();
    }, 80);
  };
  return { node: g, release };
}

/* ------------------------------------------------------------------ */
/* Player com fontes de programa                                        */
/* ------------------------------------------------------------------ */

export type SourceKind = 'music' | 'pink' | 'file';

export interface SourcePlayer {
  playing: boolean;
  toggle: () => void;
  stop: () => void;
  source: SourceKind;
  setSource: (s: SourceKind) => void;
  fileName: string | null;
  loadFile: (f: File) => Promise<void>;
  loading: boolean;
  error: string | null;
}

/**
 * `connect(ctx, input, output)` monta a cadeia de processamento do laboratório
 * entre a fonte e a saída; deve devolver uma função de limpeza.
 */
export function useSourcePlayer(
  name: string,
  connect: (ctx: AudioContext, input: AudioNode, output: AudioNode) => (() => void) | void,
  defaultSource: SourceKind = 'music',
): SourcePlayer {
  const pb = usePlayback(name);
  const [source, setSourceState] = useState<SourceKind>(defaultSource);
  const [fileBuf, setFileBuf] = useState<AudioBuffer | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connectRef = useRef(connect);
  connectRef.current = connect;

  const getBuffer = useCallback(
    async (ctx: AudioContext, kind: SourceKind) => {
      if (kind === 'pink') return pinkNoiseBuffer(ctx);
      if (kind === 'file' && fileBuf) return fileBuf;
      return demoMusicBuffer(ctx.sampleRate);
    },
    [fileBuf],
  );

  const startWith = useCallback(
    async (kind: SourceKind) => {
      const { ctx } = getAudio();
      setLoading(true);
      const buf = await getBuffer(ctx, kind);
      setLoading(false);
      pb.start((c, out) => {
        const src = c.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        const f = fadeGain(c, out);
        const cleanup = connectRef.current(c, src, f.node);
        src.start();
        return () =>
          f.release(() => {
            try {
              src.stop();
            } catch {
              /* já parado */
            }
            src.disconnect();
            if (cleanup) cleanup();
          });
      });
    },
    [getBuffer, pb],
  );

  const toggle = useCallback(() => {
    if (pb.playing) pb.stop();
    else void startWith(source);
  }, [pb, source, startWith]);

  const setSource = useCallback(
    (s: SourceKind) => {
      setSourceState(s);
      if (pb.playing && (s !== 'file' || fileBuf)) void startWith(s);
    },
    [pb.playing, startWith, fileBuf],
  );

  const loadFile = useCallback(
    async (f: File) => {
      setError(null);
      setLoading(true);
      try {
        const buf = await decodeFile(f);
        setFileBuf(buf);
        setFileName(f.name);
        setSourceState('file');
        setLoading(false);
        if (pb.playing) {
          // reinicia já com o novo buffer
          pb.start((c, out) => {
            const src = c.createBufferSource();
            src.buffer = buf;
            src.loop = true;
            const fg = fadeGain(c, out);
            const cleanup = connectRef.current(c, src, fg.node);
            src.start();
            return () =>
              fg.release(() => {
                try {
                  src.stop();
                } catch {
                  /* já parado */
                }
                src.disconnect();
                if (cleanup) cleanup();
              });
          });
        }
      } catch {
        setLoading(false);
        setError('Não foi possível decodificar este arquivo. Tente WAV, FLAC, MP3, AAC ou OGG.');
      }
    },
    [pb],
  );

  return { playing: pb.playing, toggle, stop: pb.stop, source, setSource, fileName, loadFile, loading, error };
}

export function SourceBar({ player, extra }: { player: SourcePlayer; extra?: ReactNode }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <PlayButton playing={player.playing} onToggle={player.toggle} disabled={player.loading} />
        <Segmented
          size="sm"
          label="Fonte de áudio"
          value={player.source}
          onChange={(v) => {
            if (v === 'file' && !player.fileName) inputRef.current?.click();
            else player.setSource(v);
          }}
          options={[
            { value: 'music', label: 'Música demo' },
            { value: 'pink', label: 'Ruído rosa' },
            { value: 'file', label: player.fileName ? truncate(player.fileName, 18) : 'Seu arquivo' },
          ]}
        />
        <Button size="sm" variant="ghost" icon={<IconUpload size={14} />} onClick={() => inputRef.current?.click()}>
          Abrir áudio
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="audio/*,.flac,.wav,.mp3,.m4a,.ogg,.opus"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void player.loadFile(f);
            e.target.value = '';
          }}
        />
        {extra}
      </div>
      {player.loading && <p className="text-[12px] text-muted">Preparando áudio…</p>}
      {player.error && <p className="text-[12px] text-[var(--myth)]">{player.error}</p>}
      {player.source === 'file' && player.fileName && (
        <p className="text-[11.5px] text-faint">O arquivo é decodificado e processado só no seu navegador; nada é enviado.</p>
      )}
    </div>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
