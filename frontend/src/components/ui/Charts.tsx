import { cn } from '@/utils/cn';

interface BarChartProps {
  data: number[];
  labels: string[];
  height?: number;
  color?: string;
  highlightLast?: boolean;
  className?: string;
}

export function BarChart({ data, labels, height = 160, color = '#2563eb', highlightLast = true, className }: BarChartProps) {
  const max = Math.max(...data) * 1.1 || 1;
  return (
    <div className={cn('flex items-end gap-2', className)} style={{ height }}>
      {data.map((v, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
          <div className="w-full flex items-end justify-center flex-1">
            <div
              className="w-full max-w-[32px] rounded-t-lg transition-all duration-300 group-hover:opacity-80 relative"
              style={{
                height: `${(v / max) * 100}%`,
                background: highlightLast && i === data.length - 1 ? color : `${color}66`,
                minHeight: 4,
              }}
            >
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-semibold text-navy-700 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                {v}
              </span>
            </div>
          </div>
          <span className="text-[10px] font-medium text-navy-400">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

interface LineChartProps {
  data: number[];
  labels: string[];
  height?: number;
  color?: string;
  className?: string;
  area?: boolean;
}

export function LineChart({ data, labels, height = 180, color = '#2563eb', className, area = true }: LineChartProps) {
  const max = Math.max(...data) * 1.1 || 1;
  const min = Math.min(...data) * 0.9;
  const range = max - min || 1;
  const w = 100;
  const h = height;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 20) - 10;
    return `${x},${y}`;
  });
  const pathD = `M ${points.join(' L ')}`;
  const areaD = `${pathD} L ${w},${h} L 0,${h} Z`;
  const gid = `line-${color.replace('#', '')}`;

  return (
    <div className={cn('w-full', className)}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ height }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.15" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {area && <path d={areaD} fill={`url(#${gid})`} />}
        <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {data.map((v, i) => {
          const x = (i / (data.length - 1)) * w;
          const y = h - ((v - min) / range) * (h - 20) - 10;
          return <circle key={i} cx={x} cy={y} r="1.5" fill={color} vectorEffect="non-scaling-stroke" />;
        })}
      </svg>
      <div className="flex justify-between mt-2">
        {labels.map((l, i) => (
          <span key={i} className="text-[10px] font-medium text-navy-400">{l}</span>
        ))}
      </div>
    </div>
  );
}

interface DonutChartProps {
  segments: { label: string; value: number; color: string }[];
  size?: number;
  className?: string;
  centerLabel?: string;
  centerSublabel?: string;
}

export function DonutChart({ segments, size = 160, className, centerLabel, centerSublabel }: DonutChartProps) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f1f5f9" strokeWidth="12" />
        {segments.map((seg, i) => {
          const len = (seg.value / total) * circumference;
          const el = (
            <circle
              key={i}
              cx={size / 2} cy={size / 2} r={radius} fill="none"
              stroke={seg.color} strokeWidth="12" strokeLinecap="round"
              strokeDasharray={`${len} ${circumference - len}`}
              strokeDashoffset={-offset}
              style={{ transition: 'stroke-dasharray 0.6s ease-out' }}
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {centerLabel && <span className="text-xl font-bold text-navy-900">{centerLabel}</span>}
        {centerSublabel && <span className="text-xs text-navy-400 font-medium">{centerSublabel}</span>}
      </div>
    </div>
  );
}
