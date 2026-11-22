// ═══════════════════════════════════════════════════════════
// 📅 CHOIX DE LA PÉRIODE — PANNEAU PARTAGÉ ABSENCES / PLANNING
//
// Le même panneau derrière le titre de période des deux pages :
// un champ date pour viser n'importe quel jour, un pas-à-pas
// d'année, et un retour à aujourd'hui.
//
// Il ne sait pas comment la page bouge : il remonte la date ISO
// choisie via `onAllerA` et c'est l'appelant qui se positionne.
//
// ─── LA FENÊTRE PORTE LA PEAU DE LA MAISON, 22/11/2026 ────────
// « Retravaille le modal qui s'ouvre dans ce sélecteur de date ».
// Elle se peignait elle-même : huit styles en ligne, six couleurs
// en dur, deux palettes cousues selon l'humeur du jour de la page.
// Tout est parti dans `ChoixPeriode.css`, en jetons. Ce que la
// charte gagne, mesuré dans l'ancien fichier :
//   · une assise de 40 px de flou et des coins à 14 px → bord
//     d'encre de 2 px, coin carré sur la feuille, double feutre à
//     zéro de flou (D-016) ;
//   · quatre tailles inventées (10,5 · 12 · 13 · 15 px) → les
//     trois de la maison, plus une de rab : micro pour les mots
//     d'étiquette, corps pour le champ et l'année, capitales 9,5
//     pour les gestes (D-013) ;
//   · la palette dépendait de la page → elle dépend du thème de
//     l'application. Le prop `darkMode` est RETIRÉ : une fenêtre
//     ne demande pas à son hôte de lui dire s'il fait nuit, elle
//     lit `[data-theme]` posé sur la racine du document.
// ═══════════════════════════════════════════════════════════

import { useEffect, useId, useRef } from 'react'
import { ChevronLeft, ChevronRight, CalendarSearch } from 'lucide-react'
import { memeJourAutreAnnee } from '../services/absencesCalendrier'
import './ChoixPeriode.css'

const aujourdhuiIso = () => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export default function ChoixPeriode({
  ouvert,
  onFermer,
  jourSel,
  annee,
  onAllerA,
}) {
  const idDate = useId()
  const champ = useRef(null)

  // Échap referme, comme n'importe quelle fenêtre. Et le focus ENTRE avec
  // elle : sinon le clavier reste derrière le panneau qu'il vient d'ouvrir,
  // obligé de retaper Tab pour atteindre le champ.
  useEffect(() => {
    if (!ouvert) return
    champ.current?.focus()
    const surTouche = (e) => { if (e.key === 'Escape') onFermer?.() }
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [ouvert, onFermer])

  if (!ouvert) return null

  return (
    <>
      {/* clic ailleurs = on referme. Le voile est transparent : il ne voile
          rien, il attrape seulement le geste du dehors — une fenêtre de poche
          posée sur la page, pas un écran qui éteint la page */}
      <div className="cap-voile" onClick={onFermer} aria-hidden="true" />

      <div
        className="cap-feuille"
        role="dialog"
        aria-label="Aller à une date"
        data-testid="choix-periode"
      >
        <p className="cap-titre">Choisir la période</p>

        <div className="cap-bloc">
          <label htmlFor={idDate} className="cap-etiquette">
            Aller au
          </label>
          <input
            ref={champ}
            id={idDate}
            type="date"
            className="cap-champ"
            value={jourSel}
            onChange={(e) => e.target.value && onAllerA?.(e.target.value)}
            data-testid="choix-periode-date"
          />
        </div>

        <div className="cap-bloc">
          <span className="cap-etiquette" id={`${idDate}-annee`}>
            Année
          </span>
          <div className="cap-rangee" role="group" aria-labelledby={`${idDate}-annee`}>
            <button
              type="button"
              className="cap-fleche"
              onClick={() => onAllerA?.(memeJourAutreAnnee(jourSel, -1) || aujourdhuiIso())}
              aria-label="Année précédente"
              data-testid="choix-periode-annee-moins"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="cap-annee" data-testid="choix-periode-annee">
              {annee}
            </span>
            <button
              type="button"
              className="cap-fleche"
              onClick={() => onAllerA?.(memeJourAutreAnnee(jourSel, 1) || aujourdhuiIso())}
              aria-label="Année suivante"
              data-testid="choix-periode-annee-plus"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <button
          type="button"
          className="cap-geste"
          onClick={() => onAllerA?.(aujourdhuiIso())}
          data-testid="choix-periode-aujourdhui"
        >
          <CalendarSearch size={14} /> Revenir à aujourd’hui
        </button>
      </div>
    </>
  )
}
