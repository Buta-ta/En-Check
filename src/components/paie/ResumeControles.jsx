// ═══════════════════════════════════════════════════════════════════════════
//  LA MODALE « PROFILS MANQUANTS » — la seule fenêtre en carte-post-it
// ═══════════════════════════════════════════════════════════════════════════
//
//  Trois demandes se sont empilées ici, et cette version garde les trois :
//
//  · « retravaille ce modal » — le message disait « une fiche à 0 », ce qui
//    est faux : sans profil, le calcul rend un bulletin SANS impôt ni
//    cotisations, marqué non remisable. La modale le dit avec ces mots.
//
//  · « centre le » — puis « tu m'as fait quoi là ? » sur ma première tentative.
//    Deux fautes expliquaient la capture du 28/11 :
//
//      1. `justify-content: safe center` n'est PAS reconnu par le moteur
//         (seule `align-*` l'accepte) ; la déclaration tombait, la fenêtre
//         partait en haut à gauche ;
//      2. `paddingTop` ET `overflowY: auto` sur le conteneur : le rembourrage
//         haut, qui ne se replie jamais, décalait le contenu dès que la boîte
//         défilait — la fenêtre glissait encore plus bas.
//
//    Le centrage tient maintenant à trois choses simples et sûres :
//      3. le voile n'a AUCUN rembourrage ni défilement propre : il centre,
//         point. Seul le `padding` latéral empêche la feuille de toucher les
//         bords ;
//      4. la hauteur est une `max-height` en `dvh` moins ce qui est vraiment
//         pris en haut (la barre figée) et en bas (le bord de l'écran) ;
//      5. si la feuille est plus haute que la place, c'est ELLE qui défile
//         (`overflow: auto`) — jamais le voile. Rien ne peut donc la pousser.
//
//  · « style brut adouci double feutre » — la peau de la carte-post-it du
//    dossier identité, et seulement pour cette modale. Les autres fenêtres de
//    la paie sont revenues exactement à leur état d'avant : je les avais
//    touchées sans qu'il l'ait demandé.
//
//  ⚠️ La peau vit ICI, en styles en ligne sur des jetons de charte. Pas de
//  feuille séparée : le fichier CSS que j'avais ajouté est supprimé.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, ArrowRight, Eye, UserPlus, X } from 'lucide-react'

const ENCRE = 'var(--charte-encre)'
const BLANC = 'var(--charte-blanc)'
const SURFACE = 'var(--charte-surface)'
const SURFACE2 = 'var(--charte-surface2)'
const BORDURE = 'var(--charte-bordure)'
const TRAIT = 'var(--charte-trait)'
const ERREUR = 'var(--charte-erreur)'

/*  La feuille : coin carré, contour d'encre, bande de colle de 14 px, double
    feutre en deux ombres dures (aucun flou — la peau D de la maison). */
const FEUILLE = {
  position: 'relative',
  width: '100%',
  maxWidth: 'var(--charte-modale-moyenne)',
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  border: `${TRAIT} solid ${ENCRE}`,
  borderRadius: 0,
  backgroundColor: SURFACE,
  backgroundImage:
    `linear-gradient(to bottom, color-mix(in srgb, ${BLANC} 45%, transparent) 0 14px,`
    + ` color-mix(in srgb, ${ENCRE} 16%, transparent) 14px 15px, transparent 15px)`,
  boxShadow:
    `6px 6px 0 6px color-mix(in srgb, ${ENCRE} 7%, ${SURFACE}),`
    + ` 6px 6px 0 8px ${ENCRE}`,
  overflow: 'auto',
  color: ENCRE,
}

const BOUTON = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
  minHeight: 40, padding: '0 16px',
  border: `1px solid ${ENCRE}`, borderRadius: 6,
  backgroundColor: SURFACE, color: ENCRE,
  fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
  boxShadow: '3px 3px 0 0 var(--charte-encre)',
  cursor: 'pointer', whiteSpace: 'nowrap',
}

const raisonLisible = (raison) => String(raison || '').trim() || 'Profil à compléter'

export function ResumeControles({ blockers = [], ready = 0, zoneHaute = 0, zoneBasse = 0, onFermer, onGenerer, onProfils }) {
  const boite = useRef(null)
  const premier = useRef(null)
  const nombre = blockers.length
  const pluriel = nombre > 1

  useEffect(() => {
    const page = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    premier.current?.focus({ preventScroll: true })
    const surTouche = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onFermer?.(); return }
      if (e.key !== 'Tab' || !boite.current) return
      const focusables = [...boite.current.querySelectorAll('button:not(:disabled), [href], [tabindex="0"]')]
        .filter((el) => el.getClientRects().length)
      if (!focusables.length) { e.preventDefault(); boite.current.focus(); return }
      const debut = focusables[0]
      const fin = focusables[focusables.length - 1]
      if (e.shiftKey && (document.activeElement === debut || document.activeElement === boite.current)) {
        e.preventDefault(); fin.focus()
      } else if (!e.shiftKey && document.activeElement === fin) {
        e.preventDefault(); debut.focus()
      }
    }
    document.addEventListener('keydown', surTouche, true)
    return () => {
      document.removeEventListener('keydown', surTouche, true)
      document.body.style.overflow = page
    }
  }, [onFermer])

  if (typeof document === 'undefined') return null

  /*  La hauteur disponible : l'écran moins la barre figée en haut, moins ce
      qui est déjà pris en bas, moins 32 px de respiration. `dvh` tient compte
      de la barre d'URL du navigateur mobile, `vh` ne le fait pas. */
  const disponible = `calc(100dvh - ${zoneHaute + zoneBasse + 32}px)`

  return createPortal(
    <div
      className="pw-resume-controles-fond"
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        /*  Le voile CENTRE et ne fait rien d'autre. Aucun rembourrage haut ou
            bas, aucun défilement : c'est ce qui avait poussé la fenêtre en
            haut à gauche puis vers le bas sur la capture du 28/11. */
        paddingLeft: 16, paddingRight: 28,
        background: 'var(--charte-modale-voile)',
        boxSizing: 'border-box',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onFermer?.() }}
    >
      <section
        ref={boite}
        className="pw-resume-controles"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="pw-resume-titre"
        aria-describedby="pw-resume-texte"
        tabIndex={-1}
        style={{ ...FEUILLE, maxHeight: disponible }}
      >
        {/* ── la tête ──────────────────────────────────────────────────── */}
        <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '16px 16px 12px', borderBottom: `1px solid ${BORDURE}` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minWidth: 0 }}>
            {/* la vignette carrée, ombre dure de 3 px — comme la fiche */}
            <span aria-hidden="true" style={{ display: 'grid', placeItems: 'center', width: 40, height: 40, flex: '0 0 auto', border: `${TRAIT} solid ${ENCRE}`, borderRadius: 0, backgroundColor: SURFACE2, color: ERREUR, boxShadow: '3px 3px 0 0 var(--charte-encre)' }}>
              <AlertTriangle size={19} />
            </span>
            <div style={{ minWidth: 0 }}>
              <h2 id="pw-resume-titre" style={{ margin: 0, color: ENCRE, fontSize: 18, fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.01em' }}>
                {pluriel ? `${nombre} profils salariaux manquent` : 'Un profil salarial manque'}
              </h2>
              <p id="pw-resume-texte" style={{ margin: '4px 0 0', color: 'var(--charte-texte)', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {pluriel ? 'Ces bulletins naîtront incomplets' : 'Ce bulletin naîtra incomplet'}
                {ready > 0 ? ` · ${ready} prêt${ready > 1 ? 's' : ''}` : ''}
              </p>
            </div>
          </div>
          <button type="button" onClick={onFermer} aria-label="Fermer" style={{ display: 'grid', placeItems: 'center', width: 28, height: 28, flex: '0 0 auto', border: `1px solid ${ENCRE}`, borderRadius: 6, background: 'transparent', color: 'var(--charte-texte)', cursor: 'pointer' }}>
            <X size={15} />
          </button>
        </header>

        {/* ── le corps ─────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, overflowY: 'auto', minHeight: 0 }}>
          {/*  La phrase qui remplace « une fiche à 0 » : la garantie du
              service, mot pour mot. */}
          <div style={{ display: 'flex', gap: 10, padding: '12px 14px', border: `1px solid ${BORDURE}`, borderLeft: `${TRAIT} solid ${ERREUR}`, borderRadius: 0, background: `color-mix(in srgb, ${BLANC} 12%, ${SURFACE})` }}>
            <AlertTriangle size={15} aria-hidden="true" style={{ flex: '0 0 auto', marginTop: 2, color: ERREUR }} />
            <p style={{ margin: 0, color: 'var(--charte-encre)', fontSize: 12.5, lineHeight: 1.6 }}>
              Sans profil, le calcul ne peut appliquer ni l’impôt ni les cotisations sociales.
              {' '}<strong style={{ color: ERREUR }}>Ces bulletins ne pourront pas être remis aux salariés</strong> tant qu’ils ne sont pas complétés.
            </p>
          </div>

          <div>
            <p style={{ margin: '0 0 8px', color: 'var(--charte-douce)', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {pluriel ? 'Les salariés concernés' : 'Le salarié concerné'}
            </p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {blockers.map((b, i) => (
                <li
                  key={b.employeeId || `${b.employee}-${i}`}
                  style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '9px 12px', border: `1px solid ${BORDURE}`, borderRadius: 0, background: `color-mix(in srgb, ${BLANC} 10%, ${SURFACE})` }}
                >
                  <strong style={{ flex: '0 1 auto', minWidth: 0, color: ENCRE, fontSize: 13, fontWeight: 700, overflowWrap: 'anywhere' }}>
                    {b.employee || 'Salarié sans nom'}
                  </strong>
                  <span aria-hidden="true" style={{ color: 'var(--charte-douce)' }}>—</span>
                  <span style={{ flex: '1 1 auto', minWidth: 0, color: ERREUR, fontSize: 12, lineHeight: 1.45 }}>
                    {raisonLisible(b.reason)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── le pied ──────────────────────────────────────────────────────
            Il se retire du rabat : 14 px de dos de feuille en bas, 14 + 6 px
            à droite. Sans ça, le dernier bouton vivrait sous le pli. */}
        <footer style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: 8, padding: '12px 20px 14px 16px', borderTop: `1px solid ${BORDURE}` }}>
          <button type="button" onClick={onFermer} style={{ ...BOUTON, marginRight: 'auto' }}>
            Annuler
          </button>
          <button type="button" onClick={onGenerer} style={BOUTON}>
            <Eye size={15} aria-hidden="true" />
            <span>Générer des bulletins incomplets</span>
          </button>
          <button type="button" ref={premier} onClick={onProfils} style={{ ...BOUTON, backgroundColor: ENCRE, color: BLANC }}>
            <UserPlus size={15} aria-hidden="true" />
            <span>{pluriel ? `Compléter les ${nombre} profils` : 'Compléter le profil'}</span>
            <ArrowRight size={14} aria-hidden="true" />
          </button>
        </footer>

        {/* le rabat, peint au coin bas-droit — jamais en clip-path */}
        <span aria-hidden="true" style={{ position: 'absolute', right: 0, bottom: 0, width: 14, height: 14, pointerEvents: 'none', background: `linear-gradient(to top left, transparent 0 44%, ${ENCRE} 44% 50%, color-mix(in srgb, ${BLANC} 60%, ${SURFACE}) 50%)` }} />
      </section>
    </div>,
    document.body,
  )
}

export default ResumeControles
