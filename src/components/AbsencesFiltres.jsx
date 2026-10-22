// ═══════════════════════════════════════════════════════════
// 🎨 MOTIFS VIVANTS — FILTRES ET LÉGENDES
//
// La page Absences rend son propre fournisseur de motifs : elle
// ne peut donc pas le lire elle-même. Ces petits composants sont
// rendus À L'INTÉRIEUR du fournisseur et affichent toujours la
// liste à jour — couleurs, emojis et libellés personnalisés.
// ═══════════════════════════════════════════════════════════

import { useMotifsAbsence } from '../hooks/useMotifsAbsence'

/** Liste déroulante de motifs (filtre « Motif » de la barre de filtres) */
export function AbsencesSelectMotifs({ value = 'all', onChange, style, id }) {
  const { motifs } = useMotifsAbsence()
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      data-testid="abs-select-motifs"
      style={style}
    >
      <option value="all">Tous</option>
      {motifs.map((m) => (
        <option key={m.id} value={m.id}>
          {m.emoji} {m.label}
        </option>
      ))}
    </select>
  )
}

/**
 * Légende du calendrier : suit exactement les motifs de l'entreprise
 * (couleur, emoji, libellé) + les codes de lecture communs.
 */
export function AbsencesLegendeMotifs({ styleItem, styleDot, styleLabel, extra = [] }) {
  const { motifs } = useMotifsAbsence()
  const rendre = (cle, couleur, texte, emoji) => (
    <div key={cle} data-testid="abs-legende-motif" data-motif={cle} style={styleItem}>
      {emoji
        ? <span style={{ fontSize: 12 }}>{emoji}</span>
        : <div style={{ ...styleDot, background: couleur }} />}
      <span style={styleLabel}>{texte}</span>
    </div>
  )

  return (
    <>
      {motifs.map((m) => rendre(m.id, m.color, `${m.emoji} ${m.label}`))}
      {extra.map((e) => rendre(e.id, e.couleur, e.texte, e.emoji))}
    </>
  )
}

/**
 * Décompte « jours par motif » de la modale historique : on part des
 * absences réellement enregistrées, donc un motif créé sur mesure
 * apparaît lui aussi, avec sa couleur et son emoji.
 */
export function AbsencesStatsMotifs({ stats = {}, styleRow }) {
  const { motifs } = useMotifsAbsence()
  const totals = Object.entries(stats).filter(([, j]) => Number(j) > 0)
  if (totals.length === 0) return null
  return (
    <>
      {totals.map(([code, j]) => {
        const m = motifs.find((x) => x.id === code)
        return (
          <div key={code} data-testid="abs-stats-motif" data-motif={code} style={styleRow}>
            <span>{m ? m.emoji : '📋'}</span>
            <span style={{ color: '#ccc', flex: 1, fontSize: 13 }}>{m ? m.label : code}</span>
            <span style={{ color: m ? m.color : '#F5F2EB', fontWeight: 700 }}>{j}j</span>
          </div>
        )
      })}
    </>
  )
}

export default AbsencesSelectMotifs
