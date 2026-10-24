import { useEffect, useRef, useState } from 'react'
import {
  drawAvatarCrop,
  exportAvatarCrop,
  validateAvatarSource,
} from '../utils/adminAvatarCrop'
import './AdminAvatarCrop.css'

// Local-only editor. No upload occurs here; the parent saves after profile confirmation.
export default function AdminAvatarCrop({
  file,
  darkMode,
  onConfirm,
  onCancel,
}) {
  const dialog = useRef(null),
    canvas = useRef(null),
    source = useRef(null),
    alive = useRef(false),
    lock = useRef(false)
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const [zoom, setZoom] = useState(1),
    [horizontal, setHorizontal] = useState(50),
    [vertical, setVertical] = useState(50)
  useEffect(() => {
    alive.current = true
    const previousFocus = document.activeElement
    dialog.current.showModal()
    let url,
      image,
      cancelled = false
    try {
      validateAvatarSource(file)
      url = URL.createObjectURL(file)
      image = new Image()
      image.onload = () => {
        if (cancelled) return
        try {
          drawAvatarCrop(canvas.current, image, 1, 50, 50)
          source.current = image
          setReady(true)
        } catch (err) {
          setError(err.message)
        }
      }
      image.onerror = () => {
        if (!cancelled)
          setError(
            'Ce fichier ne peut pas être lu comme une image. Choisissez une autre photo.',
          )
      }
      image.src = url
    } catch (err) {
      setError(err.message)
    }
    return () => {
      alive.current = false
      cancelled = true
      source.current = null
      if (image) {
        image.onload = null
        image.onerror = null
      }
      if (url) URL.revokeObjectURL(url)
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [file])
  useEffect(() => {
    if (!ready || !source.current) return
    try {
      drawAvatarCrop(canvas.current, source.current, zoom, horizontal, vertical)
    } catch (err) {
      setError(err.message)
    }
  }, [zoom, horizontal, vertical, ready])
  const cancel = () => {
    if (!lock.current) onCancel()
  }
  async function confirm() {
    if (lock.current || !ready) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      drawAvatarCrop(canvas.current, source.current, zoom, horizontal, vertical)
      const result = await exportAvatarCrop(canvas.current)
      if (alive.current) onConfirm(result)
    } catch (err) {
      if (alive.current) setError(err.message)
    } finally {
      lock.current = false
      if (alive.current) setBusy(false)
    }
  }
  return (
    <dialog
      ref={dialog}
      className={`aa-photo-dialog ${darkMode ? 'aa-dark' : ''}`}
      aria-labelledby="aa-crop-title"
      aria-describedby="aa-crop-description"
      onCancel={(event) => {
        event.preventDefault()
        cancel()
      }}
    >
      <h2 id="aa-crop-title">Recadrer ma photo</h2>
      <p id="aa-crop-description">
        Ajustez le zoom et la position. Le cercle indique la partie visible dans
        votre profil.
      </p>
      <div className="aa-photo-preview">
        <canvas
          ref={canvas}
          width="512"
          height="512"
          role="img"
          aria-label="Aperçu de la photo recadrée"
        />
        <span aria-hidden="true" />
      </div>
      {!ready && !error && <p role="status">Lecture de la photo…</p>}
      {error && <p role="alert">{error}</p>}
      <fieldset disabled={!ready || busy}>
        <legend>Ajuster le cadrage</legend>
        <label>
          Zoom <output>{zoom.toFixed(1)}×</output>
          <input
            aria-label="Zoom"
            type="range"
            min="1"
            max="3"
            step="0.1"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
        </label>
        <label>
          Position horizontale
          <input
            aria-label="Position horizontale"
            type="range"
            min="0"
            max="100"
            value={horizontal}
            onChange={(e) => setHorizontal(Number(e.target.value))}
          />
        </label>
        <label>
          Position verticale
          <input
            aria-label="Position verticale"
            type="range"
            min="0"
            max="100"
            value={vertical}
            onChange={(e) => setVertical(Number(e.target.value))}
          />
        </label>
        <button
          type="button"
          onClick={() => {
            setZoom(1)
            setHorizontal(50)
            setVertical(50)
          }}
        >
          Recentrer
        </button>
      </fieldset>
      <p className="aa-photo-help">
        Aucun envoi pour le moment. Après validation du cadrage, utilisez «
        Enregistrer mon profil » pour publier la photo.
      </p>
      <footer>
        <button type="button" disabled={busy} onClick={cancel}>
          Annuler
        </button>
        <button type="button" disabled={!ready || busy} onClick={confirm}>
          {busy ? 'Préparation…' : 'Utiliser cette photo'}
        </button>
      </footer>
    </dialog>
  )
}
