// ═══════════════════════════════════════════════════════════
// Console kente — modale de partage du rapport de synthèse
// ═══════════════════════════════════════════════════════════
import { Check, Copy, X } from 'lucide-react'

export default function KenteModalRapport({ ouvert, onFermer, rapport, copie, onCopier }) {
  if (!ouvert) return null
  return (
        <div
          className="dk-voile"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onFermer()
          }}
        >
          <div
            className="dk-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dk-rapport-titre"
          >
            <div className="dk-modal-entete">
              <h3 id="dk-rapport-titre">Rapport de synthèse</h3>
              <button
                type="button"
                className="dk-modal-fermer"
                aria-label="Fermer"
                onClick={() => onFermer()}
              >
                <X size={16} />
              </button>
            </div>
            <pre className="dk-rapport">{rapport}</pre>
            <div className="dk-modal-pied">
              <button type="button" className="dk-bouton-secondaire" onClick={() => onFermer()}>
                Fermer
              </button>
              <button type="button" className="dk-bouton-partage" onClick={onCopier}>
                {copie ? (
                  <>
                    <Check size={14} />
                    Copié
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    Copier le rapport
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
  )
}
