import { useId } from 'react'

// Médaillons originaux inspirés des monnaies : tranche striée, pièce polygonale,
// couronne bimétallique. Aucun emblème ni fac-similé d'une monnaie officielle.
export default function PaieCoin({ variant = 0, children }) {
  const id = useId().replace(/:/g, '')
  const polygon = Array.from({ length: 8 }, (_, i) => {
    const angle = (i * 45 - 22.5) * Math.PI / 180
    return `${32 + 29 * Math.cos(angle)},${32 + 29 * Math.sin(angle)}`
  }).join(' ')
  const shape = variant % 3 === 1
    ? <polygon points={polygon}/>
    : <circle cx="32" cy="32" r="29"/>
  return <span className={`pw-coin pw-coin-${variant % 3}`} aria-hidden="true">
    <svg viewBox="0 0 64 64" focusable="false">
      <defs><linearGradient id={`metal-${id}`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="var(--coin-highlight)"/><stop offset=".48" stopColor="var(--coin-face)"/><stop offset="1" stopColor="var(--coin-shadow)"/></linearGradient></defs>
      <g fill={`url(#metal-${id})`} stroke="var(--coin-rim)" strokeWidth="1.4">{shape}</g>
      <circle cx="32" cy="32" r="23" fill="none" stroke="var(--coin-rim)" strokeWidth=".7"/>
      {Array.from({ length: 32 }, (_, i) => <path key={i} d="M32 5.7v2.5" transform={`rotate(${i * 11.25} 32 32)`} stroke="var(--coin-rim)" strokeWidth=".9"/>)}
      <circle cx="32" cy="32" r="20" fill={variant % 3 === 2 ? 'var(--coin-center)' : 'none'} stroke="var(--coin-rim)" strokeWidth=".5"/>
      <path d="m26 49 3-2 3 2 3-2 3 2" fill="none" stroke="var(--coin-rim)" strokeWidth="1"/>
    </svg><span className="pw-coin-icon">{children}</span>
  </span>
}
