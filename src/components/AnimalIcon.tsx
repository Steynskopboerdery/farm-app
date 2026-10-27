// Small drawings for sheep and cattle, on a soft circle.
export function AnimalIcon({ species, size = 40 }: { species: string | null | undefined; size?: number }) {
  const cattle = species === 'cattle'
  return (
    <span className="crop-icon" style={{ width: size, height: size, background: cattle ? '#3b2a2033' : '#e9e4d833' }} aria-hidden="true">
      <svg viewBox="0 0 40 40" width={size * 0.9} height={size * 0.9}>
        {cattle ? (
          <g>
            <path d="M9 13 4 9M31 13l5-4" stroke="#d9c9a6" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M8 16c0-4 5-6 12-6s12 2 12 6v6c0 7-5 12-12 12S8 29 8 22z" fill="#2b211b" />
            <ellipse cx="20" cy="27" rx="7" ry="5.5" fill="#6e5a4e" />
            <circle cx="17.4" cy="27" r="1.3" fill="#1a120e" /><circle cx="22.6" cy="27" r="1.3" fill="#1a120e" />
            <circle cx="14" cy="19" r="1.7" fill="#fff" /><circle cx="26" cy="19" r="1.7" fill="#fff" />
            <circle cx="14" cy="19" r=".9" fill="#111" /><circle cx="26" cy="19" r=".9" fill="#111" />
            <ellipse cx="6.5" cy="17" rx="3.5" ry="2" fill="#2b211b" /><ellipse cx="33.5" cy="17" rx="3.5" ry="2" fill="#2b211b" />
          </g>
        ) : (
          <g>
            {[[12, 12], [20, 9], [28, 12], [9, 19], [31, 19], [12, 26], [28, 26]].map(([x, y]) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r="6" fill="#f4f0e6" stroke="#d8cfbb" strokeWidth="1" />
            ))}
            <ellipse cx="20" cy="22" rx="7" ry="9" fill="#3a3330" />
            <ellipse cx="11.5" cy="19" rx="3.5" ry="1.8" fill="#3a3330" transform="rotate(-20 11.5 19)" />
            <ellipse cx="28.5" cy="19" rx="3.5" ry="1.8" fill="#3a3330" transform="rotate(20 28.5 19)" />
            <circle cx="17.3" cy="19.5" r="1.6" fill="#fff" /><circle cx="22.7" cy="19.5" r="1.6" fill="#fff" />
            <circle cx="17.3" cy="19.5" r=".8" fill="#111" /><circle cx="22.7" cy="19.5" r=".8" fill="#111" />
            <ellipse cx="20" cy="27.5" rx="2.6" ry="1.6" fill="#5a4f4a" />
            <circle cx="20" cy="12" r="5" fill="#f4f0e6" stroke="#d8cfbb" strokeWidth="1" />
          </g>
        )}
      </svg>
    </span>
  )
}
