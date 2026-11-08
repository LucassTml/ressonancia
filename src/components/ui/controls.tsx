import { useId, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { locale } from '../../i18n';
import { tr } from '../../i18n';

/* ------------------------------------------------------------------ */
/* Slider                                                              */
/* ------------------------------------------------------------------ */

interface SliderProps {
  label: ReactNode;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  /** Escala logarítmica (útil para frequência) */
  log?: boolean;
  unit?: string;
  format?: (v: number) => string;
  hint?: ReactNode;
  disabled?: boolean;
}

export function Slider({ label, value, onChange, min, max, step, log, unit, format, hint, disabled }: SliderProps) {
  const id = useId();
  const toPos = (v: number) => (log ? Math.log(v / min) / Math.log(max / min) : (v - min) / (max - min));
  const fromPos = (p: number) => (log ? min * Math.pow(max / min, p) : min + p * (max - min));
  const pos = Math.min(1, Math.max(0, toPos(value)));
  const RES = 1000;
  const shown = format ? format(value) : fmtNum(value);

  return (
    <div className={`min-w-0 ${disabled ? 'opacity-45 pointer-events-none' : ''}`}>
      <div className="flex items-baseline justify-between gap-3 mb-0.5">
        <label htmlFor={id} className="text-[12.5px] text-muted font-medium tracking-[-0.005em] truncate">
          {label}
        </label>
        <span className="text-[12.5px] text-fg font-mono tabular whitespace-nowrap">
          {shown}
          {unit ? <span className="text-muted ml-0.5">{unit}</span> : null}
        </span>
      </div>
      <input
        id={id}
        type="range"
        className="range"
        min={0}
        max={RES}
        step={1}
        value={Math.round(pos * RES)}
        style={{ ['--pct' as string]: `${pos * 100}%` }}
        aria-valuetext={`${shown}${unit ? ' ' + unit : ''}`}
        onChange={(e) => {
          let v = fromPos(Number(e.target.value) / RES);
          if (step) v = Math.round(v / step) * step;
          v = Math.min(max, Math.max(min, v));
          onChange(Number(v.toFixed(6)));
        }}
      />
      {hint ? <p className="text-[11.5px] text-faint mt-0.5 leading-snug">{hint}</p> : null}
    </div>
  );
}

export function fmtNum(v: number, digits?: number) {
  const a = Math.abs(v);
  const d = digits ?? (a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : 3);
  return v.toLocaleString(locale, { maximumFractionDigits: d, minimumFractionDigits: 0 });
}

export function fmtHz(f: number) {
  if (f >= 1000) return `${(f / 1000).toLocaleString(locale, { maximumFractionDigits: f >= 10000 ? 1 : 2 })} kHz`;
  return `${f.toLocaleString(locale, { maximumFractionDigits: f < 100 ? 1 : 0 })} Hz`;
}

export function fmtDb(v: number, digits = 1) {
  const s = v.toLocaleString(locale, { maximumFractionDigits: digits, minimumFractionDigits: digits });
  return `${v > 0 ? '+' : ''}${s} dB`;
}

/* ------------------------------------------------------------------ */
/* Segmented control                                                   */
/* ------------------------------------------------------------------ */

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; title?: string }[];
  size?: 'sm' | 'md';
  label?: string;
}

export function Segmented<T extends string>({ value, onChange, options, size = 'md', label }: SegmentedProps<T>) {
  const group = useId();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex p-0.5 rounded-[10px] bg-sunken border border-line max-w-full overflow-x-auto"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={`relative whitespace-nowrap rounded-[8px] font-medium transition-colors duration-200 ${
              size === 'sm' ? 'text-[12px] px-2.5 py-1' : 'text-[13px] px-3 py-1.5'
            } ${active ? 'text-fg' : 'text-muted hover:text-fg'}`}
          >
            {active && (
              <motion.span
                layoutId={tr("seg-{0}", group)}
                className="absolute inset-0 rounded-[8px] bg-elev border border-line shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Botões                                                              */
/* ------------------------------------------------------------------ */

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'outline';
  size?: 'sm' | 'md';
  icon?: ReactNode;
}

export function Button({ variant = 'outline', size = 'md', icon, className = '', children, ...rest }: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-1.5 font-medium rounded-[9px] transition-all duration-200 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none select-none';
  const sizes = size === 'sm' ? 'text-[12.5px] h-7 px-2.5' : 'text-[13.5px] h-9 px-3.5';
  const variants = {
    primary: 'bg-accent text-accent-fg hover:brightness-110',
    outline: 'border border-line-strong text-fg hover:bg-sunken hover:border-faint',
    ghost: 'text-muted hover:text-fg hover:bg-sunken',
  }[variant];
  return (
    <button className={`${base} ${sizes} ${variants} ${className}`} {...rest}>
      {icon}
      {children}
    </button>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
}) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none text-[13px] text-soft">
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-8 h-[18px] rounded-full transition-colors duration-200 ${
          checked ? 'bg-accent' : 'bg-line-strong'
        }`}
      >
        <motion.span
          className="absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-white shadow"
          animate={{ x: checked ? 14 : 0 }}
          transition={{ type: 'spring', stiffness: 600, damping: 35 }}
        />
      </button>
      {label}
    </label>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  unit,
  step = 1,
  min,
  max,
}: {
  label: ReactNode;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  step?: number;
  min?: number;
  max?: number;
}) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-[12.5px] text-muted font-medium mb-1">
        {label}
      </label>
      <div className="flex items-center h-9 rounded-[9px] border border-line-strong bg-elev focus-within:border-accent transition-colors">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          value={Number.isFinite(value) ? value : ''}
          step={step}
          min={min}
          max={max}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (Number.isFinite(v)) onChange(v);
          }}
          className="w-full min-w-0 bg-transparent px-3 text-[14px] font-mono tabular text-fg outline-none"
        />
        {unit && <span className="pr-3 text-[12.5px] text-muted whitespace-nowrap">{unit}</span>}
      </div>
    </div>
  );
}

export function Select<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label?: ReactNode;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  const id = useId();
  return (
    <div className="min-w-0">
      {label && (
        <label htmlFor={id} className="block text-[12.5px] text-muted font-medium mb-1">
          {label}
        </label>
      )}
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-full h-9 rounded-[9px] border border-line-strong bg-elev px-2.5 text-[13.5px] text-fg outline-none focus:border-accent transition-colors"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ícones (traço fino, consistentes)                                   */
/* ------------------------------------------------------------------ */

type IconProps = { size?: number; className?: string };
const ic = (d: ReactNode) =>
  function Icon({ size = 16, className }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden
      >
        {d}
      </svg>
    );
  };

export const IconPlay = ic(<path d="M7 5.5v13l11-6.5z" fill="currentColor" stroke="none" />);
export const IconStop = ic(<rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="currentColor" stroke="none" />);
export const IconReset = ic(
  <>
    <path d="M4 12a8 8 0 1 0 2.4-5.7" />
    <path d="M4 4v4.5h4.5" />
  </>,
);
export const IconSearch = ic(
  <>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </>,
);
export const IconSun = ic(
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
  </>,
);
export const IconMoon = ic(<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />);
export const IconMonitor = ic(
  <>
    <rect x="3" y="4.5" width="18" height="12" rx="2" />
    <path d="M9 20h6M12 16.5V20" />
  </>,
);
export const IconBookmark = ic(<path d="M6.5 4h11v16l-5.5-4-5.5 4z" />);
export const IconBookmarkFilled = ic(<path d="M6.5 4h11v16l-5.5-4-5.5 4z" fill="currentColor" />);
export const IconMenu = ic(<path d="M4 7h16M4 12h16M4 17h10" />);
export const IconClose = ic(<path d="M6 6l12 12M18 6 6 18" />);
export const IconArrowRight = ic(<path d="M5 12h14M13 6l6 6-6 6" />);
export const IconArrowLeft = ic(<path d="M19 12H5M11 6l-6 6 6 6" />);
export const IconFlask = ic(
  <>
    <path d="M9.5 3.5h5M10.5 3.5v5.2L5 18.2A1.6 1.6 0 0 0 6.4 20.5h11.2a1.6 1.6 0 0 0 1.4-2.3L13.5 8.7V3.5" />
    <path d="M7.5 14.5h9" />
  </>,
);
export const IconBook = ic(
  <>
    <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15.5H5.5A1.5 1.5 0 0 0 4 21z" />
    <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v15.5h5.5A1.5 1.5 0 0 1 20 21z" />
  </>,
);
export const IconUpload = ic(
  <>
    <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" />
    <path d="M4.5 15v3.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V15" />
  </>,
);
export const IconVolume = ic(
  <>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
    <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
  </>,
);
export const IconAlert = ic(
  <>
    <path d="M12 4 2.8 19.5h18.4z" />
    <path d="M12 10v4.2M12 17h.01" />
  </>,
);
export const IconCopy = ic(
  <>
    <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
    <path d="M15.5 8.5V6A1.5 1.5 0 0 0 14 4.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" />
  </>,
);
export const IconPlus = ic(<path d="M12 5v14M5 12h14" />);
export const IconTrash = ic(<path d="M5 7h14M10 7V5h4v2M7 7l1 12.5h8L17 7" />);
export const IconChevron = ic(<path d="m9 6 6 6-6 6" />);
export const IconGlossary = ic(
  <>
    <path d="M5 4.5h10.5L19 8v11.5H5z" />
    <path d="M8.5 10h7M8.5 13.5h7M8.5 17h4" />
  </>,
);
