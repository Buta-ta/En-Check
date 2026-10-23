// Original ornamental clock, deliberately without a progress arc or percentage.
export default function RetardsEngraving({ className = '' }) {
  return (
    <svg
      className={`rt-engraving ${className}`}
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="60" cy="60" r="57" stroke="currentColor" strokeWidth="1" />
      <circle cx="60" cy="60" r="52" stroke="currentColor" strokeWidth=".7" />
      <circle cx="60" cy="60" r="42" stroke="currentColor" strokeWidth=".7" />
      {Array.from({ length: 24 }, (_, i) => (
        <path
          key={i}
          d={i % 2 ? 'M60 12v3' : 'M60 10v6'}
          stroke="currentColor"
          strokeWidth={i % 2 ? '.7' : '1.5'}
          transform={`rotate(${i * 15} 60 60)`}
        />
      ))}
      <path
        d="M60 30v30l20 12"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="60" cy="60" r="4" fill="currentColor" />
      <path
        d="m60 2 3 4-3 4-3-4Zm58 58-4 3-4-3 4-3ZM60 118l-3-4 3-4 3 4ZM2 60l4-3 4 3-4 3Z"
        fill="currentColor"
      />
    </svg>
  )
}
