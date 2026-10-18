export default function EnCheckBrandMark({ size = 42, className = '' }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 40 50"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <g fill="#D58D4B">
        <circle cx="13" cy="37" r="10.5" />
        <ellipse cx="7.5" cy="19" rx="3.2" ry="4.1" transform="rotate(-18 7.5 19)" />
        <ellipse cx="17" cy="13" rx="4.6" ry="5.6" transform="rotate(-18 17 13)" />
        <ellipse cx="31" cy="8" rx="6.5" ry="7.5" transform="rotate(-18 31 8)" />
      </g>
    </svg>
  )
}
