import { useId } from 'react'

export default function EnCheckBrandMark({ size = 42, className = '' }) {
  const gradientId = useId()

  return (
    <svg
      className={className}
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
          cy="50"
          r="50"
          fx="50"
          fy="50"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#C4A574" />
          <stop offset="100%" stopColor="#E5D4C0" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill={`url(#${gradientId})`} />
      <g fill="#3D2B1F" fillOpacity="0.8">
        <path d="M 30 45 Q 28 55 32 62 Q 42 68 40 80 Q 38 88 42 92 Q 50 96 58 92 Q 62 88 64 80 Q 68 70 72 60 Q 74 52 70 45 Q 60 48 50 52 Q 40 52 30 45 Z" />
        <ellipse cx="35" cy="32" rx="8" ry="11" />
        <ellipse cx="48" cy="28" rx="6" ry="9" />
        <ellipse cx="60" cy="30" rx="5.5" ry="8" />
        <ellipse cx="70" cy="34" rx="5" ry="7" />
        <ellipse cx="78" cy="40" rx="4.5" ry="6" />
      </g>
    </svg>
  )
}
