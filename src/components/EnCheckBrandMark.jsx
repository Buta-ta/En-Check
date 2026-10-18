export default function EnCheckBrandMark({ size = 42, className = '' }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 40 56"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <g fill="#D58D4B">
        <ellipse cx="11.5" cy="40" rx="9.4" ry="11.4" transform="rotate(-32 11.5 40)" />
        <ellipse cx="18" cy="25" rx="3.1" ry="4" transform="rotate(-18 18 25)" />
        <ellipse cx="26.3" cy="17.1" rx="3.9" ry="4.8" transform="rotate(-18 26.3 17.1)" />
        <ellipse cx="35" cy="8.3" rx="4.6" ry="5.8" transform="rotate(-18 35 8.3)" />
      </g>
    </svg>
  )
}
