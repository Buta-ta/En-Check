import PageCulturalBand from './PageCulturalBand'
import './RetardsLoadingScreen.css'

export default function RetardsLoadingScreen() {
  return (
    <section className="rt-run-loader" role="status" aria-live="polite">
      <PageCulturalBand pathname="/retards" placement="loading" />
      <svg viewBox="0 0 480 220" className="rt-run-scene" aria-hidden="true">
        <path d="M35 185H447" className="rt-run-ground" />
        <ellipse
          cx="376"
          cy="188"
          rx="44"
          ry="6"
          fill="currentColor"
          opacity=".07"
        />
        <g className="rt-run-terminal">
          <rect x="367" y="116" width="13" height="66" rx="4" />
          <rect x="344" y="45" width="63" height="91" rx="14" />
          <rect
            x="353"
            y="56"
            width="45"
            height="44"
            rx="7"
            className="rt-run-screen"
          />
          <path
            d="M365 70h6v6h-6zm15 0h6v6h-6zm-15 15h6v6h-6zm15 0h6v6h-6z"
            className="rt-run-qr"
          />
          <path
            d="M362 111h27"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <rect x="352" y="179" width="44" height="6" rx="3" />
        </g>
        <g className="rt-run-person">
          <ellipse cx="101" cy="185" rx="32" ry="4" className="rt-run-shadow" />
          <g className="rt-run-body">
            <g className="rt-run-leg rt-run-leg-back">
              <path d="m103 124-15 30-18 23" />
              <path d="m70 177-9 4h19" className="rt-run-shoe" />
            </g>
            <g className="rt-run-leg rt-run-leg-front">
              <path d="m103 124 15 31 13 21" />
              <path d="m131 176 14 5h-20" className="rt-run-shoe" />
            </g>
            <g className="rt-run-arm-back">
              <path d="m100 85-24 14-12-15" />
            </g>
            <path d="m99 73 18 6 6 44-28 6-8-37z" className="rt-run-shirt" />
            <path d="m98 78 4 47" className="rt-run-shirt-trim" />
            <path d="m108 62-3 14" stroke="#805035" strokeWidth="12" />
            <circle cx="110" cy="50" r="16" fill="#805035" />
            <path
              d="M94 49q-3-22 17-20 19 0 17 18l-12-7-11 8z"
              fill="#29201c"
            />
            <circle cx="120" cy="50" r="1.6" fill="#211813" />
            <path
              d="m119 59 5-2"
              stroke="#e8b28d"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <g className="rt-run-arm-front">
              <path d="m111 85 19 15 24-13" />
              <g className="rt-run-badge">
                <rect x="146" y="70" width="20" height="28" rx="4" />
                <circle cx="156" cy="80" r="3" />
                <path d="M151 90h10" stroke="currentColor" strokeWidth="2" />
              </g>
            </g>
          </g>
        </g>
        <g
          className="rt-run-motion"
          stroke="currentColor"
          strokeWidth="2"
          opacity=".3"
          strokeLinecap="round"
        >
          <path d="M34 104h17M23 118h24M39 132h12" />
        </g>
      </svg>
      <h2>Chargement des arrivées…</h2>
      <p>Lecture des pointages et du planning applicable.</p>
      <PageCulturalBand pathname="/retards" placement="bottom" />
    </section>
  )
}
