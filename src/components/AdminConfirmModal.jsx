// ═══════════════════════════════════════════════════════════
// 🔐 LA MODALE DE CONFIRMATION
//
// Remplace les window.confirm / alert du navigateur sur les
// écrans d'administration : même langue que le redesign
// (carte ivoire, couture, terracotta), motif d'intervention
// demandé au bon endroit (ici, pas en haut de page), Échap
// et clic hors du panneau pour annuler, focus posé sur le
// champ dès l'ouverture.
// ═══════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react'
import './AdminConfirmModal.css'

export default function AdminConfirmModal({
  ouvert,
  titre,
  texte,
  actionLabel,
  tonne = 'plein',
  busy = false,
  onFermer,
  onConfirmer,
}) {
  const [motif, setMotif] = useState('')
  const champRef = useRef(null)
  useEffect(() => {
    if (!ouvert) return
    setMotif('')
    const timer = setTimeout(() => champRef.current?.focus(), 0)
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) onFermer()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', onKey)
    }
  }, [ouvert, busy, onFermer])
  if (!ouvert) return null
  const invalide = motif.trim().length < 5 || motif.trim().length > 500
  return (
    <div
      className="aa-modal-voile"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onFermer()
      }}
    >
      <div
        className="aa-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="aa-modal-titre"
      >
        <h2 id="aa-modal-titre" className="aa-modal-titre">
          {titre}
        </h2>
        {texte ? <p className="aa-modal-texte">{texte}</p> : null}
        <label className="aa-modal-champ">
          Motif de l’intervention
          <textarea
            ref={champRef}
            required
            minLength={5}
            maxLength={500}
            value={motif}
            disabled={busy}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="Ex. : recette terminée, nettoyage de la borne de test"
          />
          <small>
            5 à 500 caractères. Ce motif est consigné au journal — jamais le
            secret.
          </small>
        </label>
        <div className="aa-modal-pied">
          <button
            type="button"
            className="aa-bouton-creux"
            onClick={onFermer}
            disabled={busy}
          >
            Annuler
          </button>
          <button
            type="button"
            className={`aa-bouton-plein${
              tonne === 'danger' ? ' aa-bouton-danger' : ''
            }`}
            disabled={busy || invalide}
            onClick={() => onConfirmer(motif.trim())}
          >
            {busy ? 'En cours…' : actionLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
