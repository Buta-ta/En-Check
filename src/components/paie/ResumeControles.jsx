// ═══════════════════════════════════════════════════════════════════════════
//  LA MODALE « PROFILS MANQUANTS » — maquette B, « cartouche »
// ═══════════════════════════════════════════════════════════════════════════
//
//  Hors périmètre : les autres fenêtres de la paie. Elles sont restées
//  exactement à leur état d'avant la 417, et elles n'ont pas été touchées.
//
//  ── Ce que cette fenêtre dit ───────────────────────────────────────────────
//
//  « retravaille ce modal » — le message parlait d'« une fiche à 0 », ce qui
//  est faux : sans profil, le calcul rend un bulletin SANS impôt ni
//  cotisations, marqué non remisable. La fenêtre le dit avec ces mots.
//
//  ── Pourquoi elle était illisible (captures des 28/11 et 02/12) ───────────
//
//  1. `justify-content: safe center` n'est pas reconnu par le moteur : la
//     déclaration tombait, la fenêtre partait dans le coin.
//  2. `paddingTop` + `overflowY: auto` sur le même conteneur : un rembourrage
//     haut ne se replie jamais, il chassait le contenu dès que la boîte
//     défilait.
//  3. SURTOUT, la faute qui a produit « une bande » : la page mesurait
//     `zoneBasse = hauteurEcran − bas de la barre`, c'est-à-dire TOUT l'écran
//     sous une barre qui ne colle qu'en haut. La `max-height` devenait
//     NÉGATIVE et la fenêtre s'écrasait à la hauteur de sa bordure.
//
//     Ici je ne dépend PLUS d'une mesure : la fenêtre prend sa hauteur pleine
//     (`maxHeight: none`) et c'est le voile qui la fait tenir dans l'écran.
//     Une fenêtre ne peut donc plus s'effondrer, quelle que soit la mesure
//     qu'on lui passe.
//
//  ── La maquette B, et ce qu'elle change en vrai ────────────────────────────
//
//  Feuille à coin carré, contour d'encre 2 px, ombre dure de 8 px, bande de
//  colle de 14 px, filets du corps, trait de perforation au-dessus du pied.
//  Deux écarts assumés par rapport à l'image :
//
//    · la colle est peinte DANS la feuille (une bande d'encre qui tourne au
//      sable), pas en rectangle posé par-dessus : un élément débordant aurait
//      ajouté du défilement et ramené le centrage bancal ;
//    · les libellés du pied tiennent sur UNE ligne (`white-space: nowrap`,
//      défilement latéral en dernier recours) — sur la maquette, « Générer
//      des bulletins incomplets » se coupait sur deux lignes.
//
// ⚠️ Aucune couleur en dur : tout passe par les jetons de la charte (C1).
//    Aucun flou (C9/D-016). Le rabat est peint au dégradé, jamais en clip-path.
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
const TEXTE = 'var(--charte-texte)'

/*  ── la feuille : le cartouche ───────────────────────────────────────────────
    Rayon 0, contour d'encre, double ombre DURE, et la bande de colle peinte
    en haut. L'ordre du `background` est celui de CSS : la colle est déclarée
    en premier, donc elle passe AU-DESSUS du papier — un dégradé transparent
    ensuite ne la recouvre pas. */
const FEUILLE = {
  position: 'relative',
  width: '100%',
  maxWidth: 'var(--charte-modale-large)',
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  border: `${TRAIT} solid ${ENCRE}`,
  borderRadius: 0,
  backgroundColor: SURFACE,
  backgroundImage:
    // la colle : un filet d'encre, puis le sable qui la déborde vers le bas
    `linear-gradient(to bottom, ${ENCRE} 0 3px, color-mix(in srgb, ${SURFACE2} 55%, ${SURFACE}) 3px 16px, transparent 16px)`,
  boxShadow: `8px 8px 0 0 ${ENCRE}`,
  color: ENCRE,
}

/*  ── les boutons : carrés, contour d'encre, ombre dure de 3 px ───────────────
    `nowrap` : c'est la correction de la maquette, où le libellé du milieu se
    cassait sur deux lignes. */
const BOUTON = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  minHeight: 40, padding: '0 14px',
  border: `1px solid ${ENCRE}`, borderRadius: 0,
  backgroundColor: SURFACE, color: ENCRE,
  fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700,
  whiteSpace: 'nowrap',
  boxShadow: '3px 3px 0 0 var(--charte-encre)',
  cursor: 'pointer',
}

/*  Le texte lu par un lecteur d'écran mais invisible à l'œil. Il sert au
    chiffre : il est peint dans le carré, mais la PHRASE doit rester entière
    pour qui n'a pas les yeux sur l'écran. */
const LECTEUR_SEUL = {
  position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
  overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0,
}

const raisonLisible = (raison) => String(raison || '').trim() || 'Profil à compléter'

export function ResumeControles({ blockers = [], ready = 0, onFermer, onGenerer, onProfils }) {
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

  return createPortal(
    /*  LE VOILE PORTE LE FILET DE SÉCURITÉ.
        Il centre, et si la fenêtre est plus haute que l'écran, il défile —
        c'est le `margin: auto` qui garde le haut atteignable au lieu de le
        couper. Un rembourrage vertical fixerait le haut : il n'y en a pas. */
    <div
      className="pw-resume-controles-fond"
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '28px 24px',
        background: 'var(--charte-modale-voile)',
        overflowY: 'auto',
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
        /*  `maxHeight: none` : la fenêtre prend sa hauteur pleine. C'est le
            remède au défaut de la « bande » — plus aucune mesure de zone ne
            peut l'écraser. */
        style={{ ...FEUILLE, maxHeight: 'none', margin: 'auto', flex: '0 0 auto' }}
      >
        {/* ── la tête : le « 4 » en carré, puis la phrase ───────────────── */}
        <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 16, padding: '24px 24px 16px' }}>
          {/* le carré chiffré : c'est lui qui commence la phrase */}
          <span aria-hidden="true" style={{ display: 'grid', placeItems: 'center', width: 56, height: 56, flex: '0 0 auto', border: `${TRAIT} solid ${ENCRE}`, borderRadius: 0, backgroundColor: SURFACE, color: ENCRE, fontSize: 30, fontWeight: 700, lineHeight: 1 }}>
            {pluriel ? nombre : 1}
          </span>

          <div style={{ flex: '1 1 260px', minWidth: 0 }}>
            <h2 id="pw-resume-titre" style={{ margin: 0, color: ENCRE, fontSize: 20, fontWeight: 700, lineHeight: 1.25 }}>
              {/*  Le chiffre est peint dans le carré à gauche : ici il est
                  seulement LU, pour que la phrase ne perde pas son sujet. */}
              <span style={LECTEUR_SEUL}>{pluriel ? `${nombre} ` : 'Un '}</span>
              {pluriel ? 'profils salariaux manquent' : 'profil salarial manque'}
            </h2>
            {/*  Le sous-titre a SA ligne : il ne peut plus chevaucher le titre. */}
            <p id="pw-resume-texte" style={{ margin: '8px 0 0', color: TEXTE, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {pluriel ? 'Ces bulletins naîtront incomplets' : 'Ce bulletin naîtra incomplet'}
              {ready > 0 ? ` · ${ready} prêt${ready > 1 ? 's' : ''}` : ''}
            </p>
          </div>

          <button type="button" onClick={onFermer} aria-label="Fermer" style={{ display: 'grid', placeItems: 'center', width: 28, height: 28, flex: '0 0 auto', marginLeft: 'auto', border: `1px solid ${ENCRE}`, borderRadius: 0, background: 'transparent', color: TEXTE, cursor: 'pointer' }}>
            <X size={15} />
          </button>
        </header>

        {/* ── le corps : le bloc des concernés ─────────────────────────────── */}
        <div style={{ padding: '0 24px 16px' }}>
          <div style={{ border: `1px solid ${ENCRE}`, borderRadius: 0, backgroundColor: SURFACE }}>
            <p style={{ margin: 0, padding: '9px 14px 7px', borderBottom: `1px dotted ${ENCRE}`, color: TEXTE, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              {pluriel ? 'Concernés' : 'Concerné'}
            </p>

            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {blockers.map((b, i) => (
                <li
                  key={b.employeeId || `${b.employee}-${i}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px',
                    borderTop: i === 0 ? 'none' : `1px solid ${BORDURE}`,
                  }}
                >
                  <strong style={{ flex: '0 1 auto', minWidth: 0, color: ENCRE, fontSize: 15, fontWeight: 700, overflowWrap: 'anywhere' }}>
                    {b.employee || 'Salarié sans nom'}
                  </strong>
                  {/* le guide pointillé du grand livre */}
                  <span aria-hidden="true" style={{ flex: '1 1 12px', minWidth: 12, alignSelf: 'flex-end', marginBottom: 5, borderBottom: `1px dotted ${BORDURE}` }} />
                  <span title={raisonLisible(b.reason)} style={{ flex: '0 0 auto', padding: '3px 7px', border: `1px solid ${BORDURE}`, borderRadius: 0, backgroundColor: `color-mix(in srgb, ${SURFACE} 62%, ${SURFACE2})`, color: TEXTE, fontFamily: 'var(--charte-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Incomplet
                  </span>
                </li>
              ))}
            </ul>

            {/*  Ce que les lignes ne disent pas : la conséquence, en une ligne.
                Uniquement le fait — ni impôt ni cotisations, bulletin non
                remisable. Pas de phrase que le service ne tiendrait pas. */}
            <p style={{ margin: 0, padding: '10px 14px 12px', borderTop: `1px solid ${BORDURE}`, color: TEXTE, fontSize: 13, fontStyle: 'italic', lineHeight: 1.5 }}>
              Sans profil, ni l’impôt ni les cotisations sociales ne peuvent être calculés. Ces bulletins ne pourront pas être remis aux salariés.
            </p>
          </div>
        </div>

        {/* ── la perforation : le pied se détache comme un talon ───────────── */}
        <div aria-hidden="true" style={{ padding: '0 24px', borderTop: `1px dashed ${ENCRE}`, height: 0 }} />

        {/* ── le pied ──────────────────────────────────────────────────────── */}
        <footer style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: 10, padding: '16px 24px 20px' }}>
          {/*  `marginRight: auto` le pousse à gauche sur sa ligne ; quand le
              pied se replie, il reste seul en haut — les deux actions
              passent dessous, alignées à droite. Aucun libellé n'est coupé. */}
          <button type="button" onClick={onFermer} style={{ ...BOUTON, flex: '0 0 auto', marginRight: 'auto' }}>
            Annuler
          </button>
          <button type="button" onClick={onGenerer} style={{ ...BOUTON, flex: '0 0 auto' }}>
            <Eye size={15} aria-hidden="true" />
            <span>Générer des bulletins incomplets</span>
          </button>
          <button type="button" ref={premier} onClick={onProfils} style={{ ...BOUTON, flex: '0 0 auto', backgroundColor: ENCRE, color: SURFACE }}>
            <UserPlus size={15} aria-hidden="true" />
            <span>{pluriel ? `Compléter les ${nombre} profils` : 'Compléter le profil'}</span>
            <ArrowRight size={14} aria-hidden="true" />
          </button>
        </footer>

        {/* le rabat, peint au coin bas-droit — jamais en clip-path */}
        <span aria-hidden="true" style={{ position: 'absolute', right: 0, bottom: 0, width: 14, height: 14, pointerEvents: 'none', background: `linear-gradient(to top left, transparent 0 44%, ${ENCRE} 44% 50%, color-mix(in srgb, ${SURFACE2} 55%, ${SURFACE}) 50%)` }} />
      </section>
    </div>,
    document.body,
  )
}

export default ResumeControles
