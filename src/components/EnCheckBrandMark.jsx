import { useId } from 'react'

export default function EnCheckBrandMark({ size = 42, className = '', loading = false }) {
  const gradientId = useId()
  const rimGradientId = `${gradientId}-rim`

  return (
    <svg
      className={`${className}${loading ? ' is-loading' : ''}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient
          id={gradientId}
          cx="50"
          cy="48"
          r="50"
          fx="50"
          fy="44"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#C4A574">
            {loading && (
              <animate
                attributeName="stop-color"
                values="#C4A574;#F59E0B;#D97706;#4A7C59;#C4A574"
                dur="3.2s"
                repeatCount="indefinite"
              />
            )}
          </stop>
          <stop offset="100%" stopColor="#E5D4C0">
            {loading && (
              <animate
                attributeName="stop-color"
                values="#E5D4C0;#FDE68A;#F3C892;#A7F3D0;#E5D4C0"
                dur="3.2s"
                repeatCount="indefinite"
              />
            )}
          </stop>
        </radialGradient>
        <linearGradient id={rimGradientId} x1="14" y1="10" x2="86" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F3D9B1" />
          <stop offset="55%" stopColor="#C4A574" />
          <stop offset="100%" stopColor="#8B6914" />
        </linearGradient>
      </defs>
      <circle
        className="en-check-brand-circle"
        cx="50"
        cy="50"
        r="48.5"
        fill={`url(#${gradientId})`}
        stroke={`url(#${rimGradientId})`}
        strokeWidth="2"
      />
      <g className="en-check-brand-foot" fill="#3D2B1F" fillOpacity="0.86">
        <path d="M 30.5 44.5 C 27 51.5 28 58.5 32.5 62.5 C 39.5 67.5 40.5 73.5 39.5 81 C 38.5 87.5 41.5 92.5 49.5 93 C 56.5 93.5 60.5 88.5 63 80.5 C 66 71 69.5 63.5 72 56.5 C 74 50.5 72.5 45.5 68.5 44 C 62.5 46.5 56 49.5 49.5 50.5 C 42.5 50.5 35.5 48 30.5 44.5 Z" />
        <ellipse cx="35" cy="31.5" rx="7.8" ry="10.8" transform="rotate(-6 35 31.5)" />
        <ellipse cx="48" cy="27.5" rx="5.8" ry="8.8" transform="rotate(-2 48 27.5)" />
        <ellipse cx="59.8" cy="29.8" rx="5.2" ry="7.8" transform="rotate(5 59.8 29.8)" />
        <ellipse cx="69.8" cy="34.2" rx="4.7" ry="6.8" transform="rotate(11 69.8 34.2)" />
        <ellipse cx="77.8" cy="40.5" rx="4.2" ry="5.8" transform="rotate(17 77.8 40.5)" />
      </g>
    </svg>
  )
}
