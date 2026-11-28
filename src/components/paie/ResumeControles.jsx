// ═══════════════════════════════════════════════════════════════════════════
//  LA MODALE « PROFILS MANQUANTS » — dire la vérité, et offrir la porte
// ═══════════════════════════════════════════════════════════════════════════
//
//  Ce qu'elle disait avant (capture du 28/11) : « Les employés suivants auront
//  une fiche à 0 », quatre lignes rouges identiques, et deux boutons dont le
//  principal — « Générer quand même » — était écrit brun sur brun, mesuré à
//  1,7:1 de contraste. Message faux, hiérarchie absente, seule issue : forcer.
//
//  Ce que la paie fait VRAIMENT quand un salarié n'a pas de profil :
//  `PayrollService.buildPayrollSlip` lève une exception (le profil est null)
//  et retombe sur un bulletin sans impôt ni cotisations, marqué
//  `impot_a_verifier: true`, avec un avertissement qui interdit la remise au
//  salarié. Ce ne sont donc pas des zéros : ce sont des bulletins INCOMPLETS.
//  La modale le dit maintenant avec ces mots-là.
//
//  Et elle ne laisse plus le choix entre « forcer » et « renoncer » : elle
//  ouvre la porte vers l'onglet « Profils salariés », où le manque se répare.
//  « Générer » reste accessible — c'est sa décision, pas la mienne — mais il
//  n'est plus la piste principale, et son libellé dit ce qu'il produit.
//
//  ⚠️ Aucune couleur en dur : tout vient de `palettePaie`, qui porte les deux
//  thèmes. Aucun #hex, donc le contrôle C1 de la charte ne bouge pas.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, ArrowRight, Eye, UserPlus, X } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { palettePaie } from '../../styles/paieTheme'

/*  Une raison lisible : « Aucun profil salarial » est le cas courant, mais le
    service en produit d'autres (« Taux horaire non défini »…). On ne suppose
    donc rien, on affiche ce qu'il dit. */
const raisonLisible = (raison) => String(raison || '').trim() || 'Profil à compléter'

export function ResumeControles({ blockers = [], ready = 0, hauteurBarre = 0, onFermer, onGenerer, onProfils }) {
  const { darkMode } = useTheme()
  const P = palettePaie(darkMode)
  const boite = useRef(null)
  const premier = useRef(null)
  const nombre = blockers.length
  const pluriel = nombre > 1

  /*  Escape ferme, le focus entre dans la boîte et y reste, la page derrière
      ne défile pas. Même contrat que `PaieDrawer`, sans le tiroir : ceci est
      une confirmation, pas un formulaire. */
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
    <div
      className="pw-resume-controles-fond"
      /*  `paddingTop` = la hauteur RÉELLE de la barre figée, mesurée par la
          page et passée ici. Sans elle, une fenêtre centrée naît derrière la
          barre : c'est exactement ce que montrait sa capture — le bouton
          « Générer quand même » coupé par le bord du bloc collant. */
      style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, paddingTop: hauteurBarre + 16, background: P.ombreForte, backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onFermer?.() }}
    >
      <div
        ref={boite}
        className="pw-resume-controles"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="pw-resume-titre"
        aria-describedby="pw-resume-texte"
        tabIndex={-1}
        style={{ width: '100%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: P.fond, border: `1px solid ${P.contour}`, borderRadius: 12, overflow: 'hidden' }}
      >
        {/* ── la tête : un symbole, un titre vrai, un sous-titre chiffré ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '18px 18px 14px', borderBottom: `1px solid ${P.voile5}` }}>
          <span aria-hidden="true" style={{ width: 42, height: 42, flex: '0 0 auto', display: 'grid', placeItems: 'center', borderRadius: 12, background: P.rouge7, border: `1px solid ${P.rouge9}`, color: P.rouge }}>
            <AlertTriangle size={21} />
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 id="pw-resume-titre" style={{ margin: 0, color: P.texte, fontSize: 17, fontWeight: 800, lineHeight: 1.25 }}>
              {pluriel ? `${nombre} profils salariaux manquent` : 'Un profil salarial manque'}
            </h2>
            <p id="pw-resume-texte" style={{ margin: '4px 0 0', color: P.texteDoux2, fontSize: 12, lineHeight: 1.5 }}>
              {pluriel ? 'Ces bulletins naîtront incomplets.' : 'Ce bulletin naîtra incomplet.'}
              {ready > 0 ? ` Les ${ready} autre${ready > 1 ? 's' : ''} sont prêts.` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onFermer}
            aria-label="Fermer"
            style={{ width: 34, height: 34, flex: '0 0 auto', display: 'grid', placeItems: 'center', borderRadius: 10, border: `1px solid ${P.voile6}`, background: P.voile4, color: P.texteFaint, cursor: 'pointer' }}
          >
            <X size={17} />
          </button>
        </div>

        {/* ── le corps : ce que ça produit, puis QUI est concerné ────────── */}
        <div style={{ padding: 18, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/*  La phrase qui remplace « une fiche à 0 ». Elle dit la
              conséquence, pas la technique : ni impôt, ni cotisations, donc
              pas remisable. C'est la garantie du service, mot pour mot. */}
          <div style={{ display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 8, background: P.rouge6, border: `1px solid ${P.rouge7}` }}>
            <AlertTriangle size={16} aria-hidden="true" style={{ flex: '0 0 auto', marginTop: 1, color: P.rouge }} />
            <p style={{ margin: 0, color: P.rouge, fontSize: 12.5, lineHeight: 1.6 }}>
              Sans profil, le calcul ne peut appliquer ni l’impôt ni les cotisations sociales.
              {' '}<strong>Ces bulletins ne pourront pas être remis aux salariés</strong> tant qu’ils ne sont pas complétés.
            </p>
          </div>

          <div>
            <p style={{ margin: '0 0 8px', color: P.texteDoux, fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
              {pluriel ? 'Les salariés concernés' : 'Le salarié concerné'}
            </p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {blockers.map((b, i) => (
                <li
                  key={b.employeeId || `${b.employee}-${i}`}
                  style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '9px 12px', borderRadius: 6, background: P.voile3, border: `1px solid ${P.voile5}` }}
                >
                  {/*  Le nom porte le poids, le motif porte la couleur. Avant,
                      les deux avaient la même pastille rouge : l'œil ne
                      savait pas par où commencer. */}
                  <strong style={{ flex: '0 1 auto', minWidth: 0, color: P.texte, fontSize: 13, fontWeight: 700, overflowWrap: 'anywhere' }}>
                    {b.employee || 'Salarié sans nom'}
                  </strong>
                  <span aria-hidden="true" style={{ flex: '0 0 auto', color: P.texteFaint }}>—</span>
                  <span style={{ flex: '1 1 auto', minWidth: 0, color: P.rouge, fontSize: 12, lineHeight: 1.45 }}>
                    {raisonLisible(b.reason)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── le pied : réparer d'abord, forcer ensuite, renoncer toujours ──
            L'ordre n'est pas décoratif : l'œil lit de gauche à droite, et le
            bouton plein est celui qui répare. Le forçage est un contour
            discret, délibérément plus faible — pas une piste qu'on suit sans
            y penser. */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, padding: '14px 18px', borderTop: `1px solid ${P.voile5}`, background: P.voile2 }}>
          <button
            type="button"
            onClick={onFermer}
            style={{ padding: '11px 16px', borderRadius: 8, border: `1px solid ${P.voile7}`, background: P.fond, color: P.texteDoux, fontWeight: 650, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onGenerer}
            style={{ marginLeft: 'auto', padding: '11px 14px', borderRadius: 8, border: `1px solid ${P.rouge9}`, background: 'transparent', color: P.rouge, fontWeight: 650, fontSize: 12.5, fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7 }}
          >
            <Eye size={15} aria-hidden="true" />
            <span>Générer des bulletins incomplets</span>
          </button>
          <button
            type="button"
            ref={premier}
            onClick={onProfils}
            style={{ padding: '11px 16px', borderRadius: 8, border: 'none', background: P.ambre, color: P.encreSurAccent, fontWeight: 750, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            <UserPlus size={16} aria-hidden="true" />
            <span>{pluriel ? `Compléter les ${nombre} profils` : 'Compléter le profil'}</span>
            <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default ResumeControles
