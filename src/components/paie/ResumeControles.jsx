// ═══════════════════════════════════════════════════════════════════════════
//  LA MODALE « PROFILS MANQUANTS » — la feuille de la maison
// ═══════════════════════════════════════════════════════════════════════════
//
//  Deux demandes se sont empilées, et celle-ci garde les deux :
//
//  28/11 ─ « Retravaille ce modal » : le message était faux (« une fiche à
//  0 »), les quatre lignes indiscernables, et le bouton principal écrit brun
//  sur brun — 1,7:1 de contraste.
//
//  28/11 ─ « il est un peu trop bas ce modal quand il s'affiche, centre le » :
//  exact. Depuis que la barre figée colle PARTOUT, elle recouvrait le haut des
//  fenêtres `fixed` ; je les avais poussées sous elle avec une marge haute, et
//  elles descendaient. La bonne réponse est de CENTRER dans la place libre —
//  la page le mesure et passe `zoneHaute` / `zoneBasse`.
//
//  28/11 ─ « Retravaille le en style brut adouci double feutre. Retravaille
//  aussi les autres modales comme ça. » La peau est celle de la carte-post-it
//  du dossier identité, déjà portée par la fiche employé et les fenêtres des
//  équipes : `.pw-feuille` dans `PaieFeuille.css`. On ne dessine rien de neuf.
//
//  ⚠️ Aucune couleur en dur : le CSS de la feuille lit les jetons de la
//  charte, ce composant ne porte que la structure.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, ArrowRight, Eye, UserPlus, X } from 'lucide-react'
import '../../components/PaieFeuille.css'

const raisonLisible = (raison) => String(raison || '').trim() || 'Profil à compléter'

export function ResumeControles({ blockers = [], ready = 0, zoneHaute = 0, zoneBasse = 0, onFermer, onGenerer, onProfils }) {
  const boite = useRef(null)
  const premier = useRef(null)
  const nombre = blockers.length
  const pluriel = nombre > 1

  /*  Escape ferme, le focus entre dans la feuille et y reste, la page derrière
      ne défile pas. Même contrat que `PaieDrawer`. */
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
    /*  LE CENTRAGE. La zone libre va du bas de la barre figée (`zoneHaute`) au
        bas de l'écran (`zoneBasse`) : la feuille se centre là-dedans, donc ni
        recouverte par la barre, ni exilée vers le bas. En cas de manque de
        place, `justify-content: flex-start` la colle au haut de la zone au lieu
        de la couper par le haut — c'est le `safe center` de la maison. */
    <div
      className="pw-feuille-voile pw-resume-controles-fond"
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'safe center', gap: 0,
        paddingTop: zoneHaute + 16, paddingBottom: zoneBasse + 16,
        paddingLeft: 16, paddingRight: 28,
        background: 'var(--charte-modale-voile)',
        overflowY: 'auto',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onFermer?.() }}
    >
      <section
        ref={boite}
        className="pw-feuille pw-resume-controles"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="pw-resume-titre"
        aria-describedby="pw-resume-texte"
        tabIndex={-1}
        style={{ maxHeight: `calc(100dvh - ${zoneHaute + zoneBasse + 32}px)` }}
      >
        {/* ── la tête : une vignette d'encre, un titre vrai, un sous-titre ── */}
        <header className="pw-feuille-tete">
          <div className="pw-feuille-tete-bloc">
            <span className="pw-feuille-vignette" aria-hidden="true">
              <AlertTriangle size={20} />
            </span>
            <div style={{ minWidth: 0 }}>
              <h2 id="pw-resume-titre" className="pw-feuille-titre">
                {pluriel ? `${nombre} profils salariaux manquent` : 'Un profil salarial manque'}
              </h2>
              <p id="pw-resume-texte" className="pw-feuille-sous-titre">
                {pluriel ? 'Ces bulletins naîtront incomplets' : 'Ce bulletin naîtra incomplet'}
                {ready > 0 ? ` · ${ready} prêt${ready > 1 ? 's' : ''}` : ''}
              </p>
            </div>
          </div>
          <button type="button" className="pw-feuille-fermer" onClick={onFermer} aria-label="Fermer">
            <X size={16} />
          </button>
        </header>

        {/* ── le corps : la conséquence, puis QUI est concerné ──────────── */}
        <div className="pw-feuille-corps">
          {/*  La phrase qui remplace « une fiche à 0 » : la garantie du
              service, mot pour mot. Ni impôt, ni cotisations, donc pas
              remisable — c'est la conséquence, pas la technique. */}
          <div className="pw-feuille-note" style={{ display: 'flex', gap: 10, borderLeftColor: 'var(--charte-erreur)' }}>
            <AlertTriangle size={16} aria-hidden="true" style={{ flex: '0 0 auto', marginTop: 2, color: 'var(--charte-erreur)' }} />
            <p style={{ margin: 0, color: 'var(--charte-erreur)', fontSize: 13, lineHeight: 1.6 }}>
              Sans profil, le calcul ne peut appliquer ni l’impôt ni les cotisations sociales.
              {' '}<strong>Ces bulletins ne pourront pas être remis aux salariés</strong> tant qu’ils ne sont pas complétés.
            </p>
          </div>

          <div>
            <p style={{ margin: '0 0 8px', color: 'var(--charte-douce)', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
              {pluriel ? 'Les salariés concernés' : 'Le salarié concerné'}
            </p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {blockers.map((b, i) => (
                <li
                  key={b.employeeId || `${b.employee}-${i}`}
                  style={{
                    display: 'flex', alignItems: 'baseline', gap: 10,
                    padding: '9px 12px', borderRadius: 0,
                    border: '1px solid var(--charte-bordure)',
                    background: 'color-mix(in srgb, var(--charte-blanc) 10%, var(--charte-surface))',
                  }}
                >
                  {/*  Le nom porte le poids, le motif porte la couleur : deux
                      traitements, là où la capture n'en montrait qu'un. */}
                  <strong style={{ flex: '0 1 auto', minWidth: 0, color: 'var(--charte-encre)', fontSize: 13, fontWeight: 700, overflowWrap: 'anywhere' }}>
                    {b.employee || 'Salarié sans nom'}
                  </strong>
                  <span aria-hidden="true" style={{ flex: '0 0 auto', color: 'var(--charte-douce)' }}>—</span>
                  <span style={{ flex: '1 1 auto', minWidth: 0, color: 'var(--charte-erreur)', fontSize: 12, lineHeight: 1.45 }}>
                    {raisonLisible(b.reason)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── le pied : réparer d'abord, forcer ensuite, renoncer toujours ──
            Le pied se retire du rabat (14 px + 6 px à droite, 14 px en bas) :
            sans ça, le bouton d'action vivrait sous le dos de la feuille. */}
        <footer className="pw-feuille-pied">
          <button type="button" className="pw-feuille-btn" onClick={onFermer} style={{ marginRight: 'auto' }}>
            Annuler
          </button>
          <button type="button" className="pw-feuille-btn" onClick={onGenerer}>
            <Eye size={15} aria-hidden="true" />
            <span>Générer des bulletins incomplets</span>
          </button>
          <button type="button" ref={premier} className="pw-feuille-btn pw-feuille-btn--plein" onClick={onProfils}>
            <UserPlus size={15} aria-hidden="true" />
            <span>{pluriel ? `Compléter les ${nombre} profils` : 'Compléter le profil'}</span>
            <ArrowRight size={14} aria-hidden="true" />
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  )
}

export default ResumeControles
