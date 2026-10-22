// ═══════════════════════════════════════════════════════════
// 📅 CHOIX DE LA PÉRIODE — PANNEAU PARTAGÉ ABSENCES / PLANNING
//
// Le même panneau derrière le titre de période des deux pages :
// un champ date pour viser n'importe quel jour, un pas-à-pas
// d'année, et un retour à aujourd'hui.
//
// Il ne sait pas comment la page bouge : il remonte la date ISO
// choisie via `onAllerA` et c'est l'appelant qui se positionne.
// ═══════════════════════════════════════════════════════════

import { useEffect, useId } from 'react'
import { ChevronLeft, ChevronRight, CalendarSearch } from 'lucide-react'
import { memeJourAutreAnnee } from '../services/absencesCalendrier'

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
  darkMode = true,
}) {
  const idDate = useId()

  // Échap referme, comme n'importe quelle fenêtre
  useEffect(() => {
    if (!ouvert) return
    const surTouche = (e) => { if (e.key === 'Escape') onFermer?.() }
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [ouvert, onFermer])

  if (!ouvert) return null

  const fond = darkMode ? '#1D1713' : '#FFFFFF'
  const bordure = darkMode ? 'rgba(245,158,11,0.16)' : 'rgba(29,23,19,0.12)'
  const texte = darkMode ? '#F5F2EB' : '#1D1713'
  const texteDoux = darkMode ? 'rgba(245,242,235,0.60)' : 'rgba(29,23,19,0.60)'
  const champ = darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(29,23,19,0.04)'

  const fleche = {
    width: 30, height: 30, borderRadius: 9, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: champ, border: `1px solid ${bordure}`, color: texte,
  }

  return (
    <>
      {/* clic ailleurs = on referme */}
      <div onClick={onFermer} style={{ position: 'fixed', inset: 0, zIndex: 40 }} aria-hidden="true" />

      <div
        role="dialog"
        aria-label="Aller à une date"
        data-testid="choix-periode"
        style={{
          position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 41,
          minWidth: 232, padding: 14, borderRadius: 14,
          background: fond, border: `1px solid ${bordure}`,
          boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}
      >
        <div>
          <label
            htmlFor={idDate}
            style={{
              display: 'block', marginBottom: 6, fontSize: 10.5,
              textTransform: 'uppercase', letterSpacing: '0.4px', color: texteDoux,
            }}
          >
            Aller au
          </label>
          <input
            id={idDate}
            type="date"
            value={jourSel}
            onChange={(e) => e.target.value && onAllerA?.(e.target.value)}
            data-testid="choix-periode-date"
            style={{
              width: '100%', padding: '9px 10px', borderRadius: 10, fontSize: 13,
              background: champ, border: `1px solid ${bordure}`,
              color: texte, fontFamily: 'inherit',
              colorScheme: darkMode ? 'dark' : 'light',
            }}
          />
        </div>

        <div>
          <span style={{
            display: 'block', marginBottom: 6, fontSize: 10.5,
            textTransform: 'uppercase', letterSpacing: '0.4px', color: texteDoux,
          }}
          >
            Année
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={() => onAllerA?.(memeJourAutreAnnee(jourSel, -1) || aujourdhuiIso())}
              aria-label="Année précédente"
              data-testid="choix-periode-annee-moins"
              style={fleche}
            >
              <ChevronLeft size={16} />
            </button>
            <span data-testid="choix-periode-annee" style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 800, color: texte }}>
              {annee}
            </span>
            <button
              type="button"
              onClick={() => onAllerA?.(memeJourAutreAnnee(jourSel, 1) || aujourdhuiIso())}
              aria-label="Année suivante"
              data-testid="choix-periode-annee-plus"
              style={fleche}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onAllerA?.(aujourdhuiIso())}
          data-testid="choix-periode-aujourdhui"
          style={{
            padding: '9px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 12,
            fontWeight: 700, fontFamily: 'inherit',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            background: 'rgba(245,158,11,0.12)',
            border: '1px solid rgba(245,158,11,0.35)',
            color: darkMode ? '#F59E0B' : '#9C5321',
          }}
        >
          <CalendarSearch size={14} /> Revenir à aujourd’hui
        </button>
      </div>
    </>
  )
}
