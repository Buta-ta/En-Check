import { useState } from 'react'
import './RetardsLoadingScreen.css'

const artwork = '/images/retards-arrival-'
const movingLayers = ['background', 'back-leg', 'front-leg', 'upper']

export default function RetardsLoadingScreen() {
  const [loaded, setLoaded] = useState([])
  const [layerFailed, setLayerFailed] = useState(false)
  const [stillFailed, setStillFailed] = useState(false)
  const ready =
    !layerFailed && !stillFailed && loaded.length === movingLayers.length + 1
  const markLoaded = (name) =>
    setLoaded((previous) =>
      previous.includes(name) ? previous : [...previous, name],
    )
  const layerProps = (name) => ({
    src: `${artwork}${name}.webp`,
    alt: '',
    width: 1536,
    height: 1536,
    decoding: 'async',
    draggable: false,
    onLoad: () => markLoaded(name),
    onError: () => setLayerFailed(true),
  })

  return (
    <section
      className="rt-run-loader rt-illustrated-loader"
      role="status"
      aria-live="polite"
    >
      {!stillFailed && (
        <div
          className={`rt-arrival-art ${ready ? 'is-ready' : ''}`}
          aria-hidden="true"
          data-artwork="approved-illustration"
        >
          {/* Exact approved illustration is the initial, failure and reduced-motion view.
          The animated textures below are cut from this same image, not redrawn. */}
          <div className="rt-arrival-motion">
            <img
              {...layerProps('background')}
              className="rt-arrival-background"
            />
            <div className="rt-arrival-travel">
              <div className="rt-arrival-bounce">
                <img
                  {...layerProps('back-leg')}
                  className="rt-arrival-leg rt-arrival-leg-back"
                />
                <img
                  {...layerProps('front-leg')}
                  className="rt-arrival-leg rt-arrival-leg-front"
                />
                <img {...layerProps('upper')} className="rt-arrival-upper" />
              </div>
            </div>
          </div>
          <img
            src={`${artwork}approved.webp`}
            fetchPriority="high"
            alt=""
            width="1536"
            height="1536"
            decoding="async"
            draggable={false}
            className="rt-arrival-approved"
            onLoad={() => markLoaded('approved')}
            onError={() => setStillFailed(true)}
          />
        </div>
      )}
      <div className="rt-arrival-caption">
        <h2>Chargement des arrivées…</h2>
        <p>Lecture des pointages et du planning applicable.</p>
      </div>
    </section>
  )
}
