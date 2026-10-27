import { cropColour } from '../lib/crops'

// Small drawings of each crop, on a soft circle in the crop's map colour.
const DRAWINGS: Record<string, React.ReactNode> = {
  wheat: (
    <g stroke="#7a5a0c" strokeWidth="1.4" fill="#e2a72e" strokeLinecap="round">
      <path d="M20 34V12" fill="none" />
      {[14, 18.5, 23].map((y) => (
        <g key={y}>
          <ellipse cx="16.6" cy={y} rx="2.6" ry="4" transform={`rotate(-28 16.6 ${y})`} />
          <ellipse cx="23.4" cy={y} rx="2.6" ry="4" transform={`rotate(28 23.4 ${y})`} />
        </g>
      ))}
      <ellipse cx="20" cy="9.5" rx="2.4" ry="3.8" />
    </g>
  ),
  barley: (
    <g stroke="#6b5413" strokeWidth="1.2" strokeLinecap="round">
      <path d="M21 34c0-8-1-14-1-22" fill="none" strokeWidth="1.4" />
      {[13, 17, 21, 25].map((y, i) => (
        <g key={y}>
          <ellipse cx={i % 2 ? 22.5 : 17.5} cy={y} rx="2.3" ry="3.3" fill="#d9b44a" transform={`rotate(${i % 2 ? 25 : -25} ${i % 2 ? 22.5 : 17.5} ${y})`} />
          <path d={i % 2 ? `M24 ${y - 3}l5-7` : `M16 ${y - 3}l-5-7`} fill="none" />
        </g>
      ))}
    </g>
  ),
  canola: (
    <g>
      <path d="M20 34V18M20 26l-5-4M20 23l5-3" stroke="#3f7d2c" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      {[[20, 13], [13.5, 18], [26.5, 16]].map(([x, y]) => (
        <g key={`${x}-${y}`} fill="#ffd400" stroke="#c9a400" strokeWidth=".8">
          {[0, 90, 180, 270].map((a) => <ellipse key={a} cx={x} cy={y - 2.6} rx="1.9" ry="2.6" transform={`rotate(${a} ${x} ${y})`} />)}
          <circle cx={x} cy={y} r="1.4" fill="#e08a00" stroke="none" />
        </g>
      ))}
    </g>
  ),
  oats: (
    <g stroke="#6c7f2a" strokeWidth="1.3" fill="#c8d977" strokeLinecap="round">
      <path d="M20 34V10M20 14q-5 2-7 7M20 18q5 2 7 7M20 22q-5 2-6 7" fill="none" />
      <ellipse cx="12.5" cy="23" rx="1.8" ry="3" />
      <ellipse cx="27.5" cy="27" rx="1.8" ry="3" />
      <ellipse cx="13.8" cy="31" rx="1.8" ry="3" />
      <ellipse cx="20" cy="8.5" rx="1.8" ry="3" />
    </g>
  ),
  lupins: (
    <g>
      <path d="M20 34V10" stroke="#3f7d2c" strokeWidth="1.6" strokeLinecap="round" />
      {[11, 14.5, 18, 21.5, 25].map((y, i) => (
        <g key={y} fill={i < 2 ? '#c4b5fd' : '#8b5cf6'}>
          <ellipse cx="17" cy={y} rx="2.6" ry="1.9" />
          <ellipse cx="23" cy={y} rx="2.6" ry="1.9" />
        </g>
      ))}
    </g>
  ),
  other: (
    <g stroke="#2f7a32" strokeWidth="1.6" strokeLinecap="round" fill="#6cc04a">
      <path d="M20 34V20" fill="none" />
      <path d="M20 22c-7 0-9-5-9-9 6 0 9 3 9 9z" />
      <path d="M20 20c0-6 3-9 9-9 0 4-2 9-9 9z" />
    </g>
  ),
}

export function CropIcon({ crop, size = 40 }: { crop: string | null | undefined; size?: number }) {
  const key = crop && DRAWINGS[crop.toLowerCase()] ? crop.toLowerCase() : 'other'
  return (
    <span className="crop-icon" style={{ width: size, height: size, background: `${cropColour(crop)}38` }} aria-hidden="true">
      <svg viewBox="0 0 40 40" width={size * 0.9} height={size * 0.9}>{DRAWINGS[key]}</svg>
    </span>
  )
}
