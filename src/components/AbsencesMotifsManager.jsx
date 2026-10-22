// ═══════════════════════════════════════════════════════════
// 🎨 GESTIONNAIRE DE MOTIFS
//
// Créer, modifier et SUPPRIMER les motifs d'absence : libellé,
// emoji (le sien, celui du téléphone ou du clavier) et couleur.
//
// Règles validées :
//   • suppression RÉELLE, pas d'archivage
//   • si le motif est utilisé, on transfère d'abord ses absences
//     vers un autre motif — aucune absence ne perd ses couleurs
//   • le dernier motif ne peut pas être supprimé
//   • en vue « toutes entreprises », on consulte : la
//     personnalisation se fait entreprise par entreprise
// ═══════════════════════════════════════════════════════════

import { useMemo, useState } from 'react'
import { Plus, Pencil, Check, X, Trash2, Building2, Smile } from 'lucide-react'
import { useMotifsAbsence } from '../hooks/useMotifsAbsence'
import { EMOJIS_MOTIFS, PALETTE_MOTIFS, fondDepuisCouleur } from '../constants/motifsAbsence'

const champsVides = { label: '', emoji: '📋', color: '#10B981' }

/** Les motifs d'origine portent `id`, ceux de la base portent `code` */
const codeDe = (m) => m.code || m.id

/** Un emoji, pas un roman : on garde au plus 2 caractères utiles */
const nettoyerEmoji = (valeur) => {
  const net = (valeur || '').trim()
  if (!net) return '📋'
  return [...net].slice(0, 2).join('')
}

export default function AbsencesMotifsManager({ absences = [] }) {
  const { motifs, toutesEntreprises, creer, modifier, supprimer } = useMotifsAbsence()
  const [brouillon, setBrouillon] = useState(null) // null | { rowId?, label, emoji, color }
  const [aSupprimer, setASupprimer] = useState(null) // motif dont on prépare la suppression
  const [codeCible, setCodeCible] = useState('') // motif qui récupère les absences
  const [enCours, setEnCours] = useState(false)

  const usages = useMemo(() => {
    const map = {}
    absences.forEach((a) => {
      const cle = a.reason || 'autre'
      map[cle] = (map[cle] || 0) + 1
    })
    return map
  }, [absences])

  const ouvrirCreation = () => {
    setBrouillon({ ...champsVides })
    setASupprimer(null)
  }
  const ouvrirEdition = (m) => {
    setBrouillon({ rowId: m.rowId, code: m.code, label: m.label, emoji: m.emoji, color: m.color })
    setASupprimer(null)
  }

  const enregistrer = async () => {
    if (!brouillon || !brouillon.label.trim()) return
    setEnCours(true)
    try {
      if (brouillon.rowId) await modifier(brouillon.rowId, {
        label: brouillon.label,
        emoji: brouillon.emoji,
        color: brouillon.color,
      })
      else await creer({ label: brouillon.label, emoji: brouillon.emoji, color: brouillon.color })
      setBrouillon(null)
    } finally {
      setEnCours(false)
    }
  }

  const demanderSuppression = (m) => {
    setBrouillon(null)
    setASupprimer(m)
    // par défaut on propose le premier autre motif
    const autre = motifs.find((x) => codeDe(x) !== codeDe(m))
    setCodeCible(autre ? autre.code : '')
  }

  const confirmerSuppression = async () => {
    if (!aSupprimer) return
    const nbUsages = usages[aSupprimer.code] || 0
    setEnCours(true)
    try {
      await supprimer({
        rowId: aSupprimer.rowId,
        codeSource: codeDe(aSupprimer),
        codeCible: nbUsages > 0 ? codeCible : null,
      })
      setASupprimer(null)
      setCodeCible('')
    } finally {
      setEnCours(false)
    }
  }

  const dernierMotif = motifs.length <= 1
  const nbUsagesCible = aSupprimer ? (usages[aSupprimer.code] || 0) : 0

  return (
    <div
      data-testid="abs-motifs-manager"
      style={{
        border: '1px solid var(--abs-border, rgba(245,158,11,0.16))',
        background: 'var(--abs-bg-panel, rgba(29,23,19,0.82))',
        borderRadius: 16,
        padding: 18,
      }}
    >
      {/* ══ En-tête ══ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--abs-text, #F5F2EB)' }}>
            Motifs d’absence
          </h3>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--abs-text-muted, rgba(245,242,235,0.55))' }}>
            {motifs.length} motif{motifs.length > 1 ? 's' : ''} · ces motifs alimentent le calendrier, le dock et les filtres
          </p>
        </div>
        <button
          type="button"
          onClick={ouvrirCreation}
          disabled={toutesEntreprises || enCours}
          data-testid="abs-motifs-nouveau"
          title={toutesEntreprises ? 'Sélectionnez une entreprise pour personnaliser' : 'Créer un motif'}
          style={{
            marginLeft: 'auto', padding: '9px 14px', borderRadius: 11, cursor: toutesEntreprises ? 'not-allowed' : 'pointer',
            border: 'none', background: 'linear-gradient(135deg, #C25E28, #8C3418)', color: '#FFF5E6',
            fontWeight: 700, fontSize: 13, fontFamily: 'inherit',
            display: 'inline-flex', alignItems: 'center', gap: 7, opacity: toutesEntreprises ? 0.5 : 1,
          }}
        >
          <Plus size={16} /> Nouveau motif
        </button>
      </div>

      {toutesEntreprises && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14, padding: '11px 13px',
          borderRadius: 12, background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.24)',
          fontSize: 12, color: '#93C5FD',
        }}>
          <Building2 size={15} />
          <span>Vue « toutes entreprises » : les motifs affichés sont les motifs communs. Sélectionnez une entreprise pour les personnaliser et les supprimer.</span>
        </div>
      )}

      {/* ══ Liste ══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
        {motifs.map((m) => {
          const nb = usages[codeDe(m)] || 0
          return (
            <div
              key={m.code}
              data-testid="abs-motifs-carte"
              data-motif={codeDe(m)}
              style={{
                border: `1px solid ${m.color}55`,
                background: fondDepuisCouleur(m.color),
                borderRadius: 13, padding: '12px 13px',
                display: 'flex', alignItems: 'center', gap: 11,
              }}
            >
              <span style={{
                width: 38, height: 38, borderRadius: 11, flexShrink: 0, fontSize: 19,
                background: `${m.color}22`, border: `1px solid ${m.color}55`,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {m.emoji}
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{
                  margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--abs-text, #F5F2EB)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {m.label}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--abs-text-muted, rgba(245,242,235,0.55))' }}>
                  {m.color} · {nb} absence{nb > 1 ? 's' : ''}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => ouvrirEdition(m)}
                  disabled={toutesEntreprises}
                  aria-label={`Modifier ${m.label}`}
                  data-testid="abs-motifs-modifier"
                  style={boutonIcone(m.color)}
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => demanderSuppression(m)}
                  disabled={toutesEntreprises || dernierMotif || enCours}
                  aria-label={`Supprimer ${m.label}`}
                  data-testid="abs-motifs-supprimer"
                  title={dernierMotif ? 'Gardez au moins un motif' : 'Supprimer définitivement'}
                  style={{ ...boutonIcone('#EF4444'), opacity: dernierMotif || toutesEntreprises ? 0.4 : 1, cursor: dernierMotif || toutesEntreprises ? 'not-allowed' : 'pointer' }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* ══ Formulaire création / édition ══ */}
      {brouillon && (
        <div
          data-testid="abs-motifs-formulaire"
          style={{
            marginTop: 16, padding: 16, borderRadius: 14,
            border: '1px solid var(--abs-border-strong, rgba(245,158,11,0.35))',
            background: 'var(--abs-bg-subtle, rgba(255,255,255,0.02))',
          }}
        >
          <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: 'var(--abs-text, #F5F2EB)' }}>
            {brouillon.rowId ? 'Modifier le motif' : 'Nouveau motif'}
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <label style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 11.5, color: 'var(--abs-text-muted, rgba(245,242,235,0.55))', fontWeight: 600 }}>
                Libellé
              </span>
              <input
                value={brouillon.label}
                onChange={(e) => setBrouillon({ ...brouillon, label: e.target.value })}
                placeholder="Congé payé, Télétravail…"
                data-testid="abs-motifs-libelle"
                style={champ}
              />
            </label>

            <label style={{ flex: '0 0 96px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 11.5, color: 'var(--abs-text-muted, rgba(245,242,235,0.55))', fontWeight: 600 }}>
                Emoji
              </span>
              <input
                value={brouillon.emoji}
                onChange={(e) => setBrouillon({ ...brouillon, emoji: nettoyerEmoji(e.target.value) })}
                placeholder="🎙️"
                title="Collez l'emoji de votre choix (clavier emoji du téléphone ou de l'ordinateur)"
                data-testid="abs-motifs-emoji-libre"
                style={{ ...champ, fontSize: 20, textAlign: 'center', padding: '8px 6px' }}
              />
            </label>
          </div>

          {/* Palette d'emojis : un raccourci, la saisie libre reste au-dessus */}
          <div style={{ marginTop: 12 }}>
            <p style={{ margin: '0 0 7px', fontSize: 11.5, color: 'var(--abs-text-muted, rgba(245,242,235,0.55))', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Smile size={13} /> Suggestions (vous pouvez coller n'importe quel emoji)
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {EMOJIS_MOTIFS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setBrouillon({ ...brouillon, emoji: e })}
                  style={{
                    width: 32, height: 32, borderRadius: 9, cursor: 'pointer', fontSize: 16,
                    background: brouillon.emoji === e ? 'rgba(245,158,11,0.16)' : 'var(--abs-bg-panel, rgba(29,23,19,0.82))',
                    border: `1px solid ${brouillon.emoji === e ? 'rgba(245,158,11,0.45)' : 'var(--abs-border, rgba(245,158,11,0.16))'}`,
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <p style={{ margin: '0 0 7px', fontSize: 11.5, color: 'var(--abs-text-muted, rgba(245,242,235,0.55))', fontWeight: 600 }}>
              Couleur
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              {PALETTE_MOTIFS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setBrouillon({ ...brouillon, color: c })}
                  aria-label={`Couleur ${c}`}
                  style={{
                    width: 26, height: 26, borderRadius: 8, cursor: 'pointer', background: c,
                    border: brouillon.color === c ? '2px solid #FFF5E6' : '1px solid rgba(255,255,255,0.15)',
                  }}
                />
              ))}
              <input
                type="color"
                value={brouillon.color}
                onChange={(e) => setBrouillon({ ...brouillon, color: e.target.value.toUpperCase() })}
                aria-label="Couleur personnalisée"
                style={{ width: 34, height: 28, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', cursor: 'pointer' }}
              />
            </div>
          </div>

          {/* Aperçu en direct */}
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11.5, color: 'var(--abs-text-muted, rgba(245,242,235,0.55))' }}>Aperçu</span>
            <span style={{
              padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700,
              background: fondDepuisCouleur(brouillon.color),
              border: `1px solid ${brouillon.color}`, color: brouillon.color,
            }}>
              {brouillon.emoji} {brouillon.label || 'Mon motif'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button type="button" onClick={() => setBrouillon(null)} style={boutonSecondaire}>
              Annuler
            </button>
            <button
              type="button"
              onClick={enregistrer}
              disabled={!brouillon.label.trim() || enCours}
              data-testid="abs-motifs-enregistrer"
              style={{
                ...boutonPrimaire,
                opacity: !brouillon.label.trim() || enCours ? 0.5 : 1,
                cursor: !brouillon.label.trim() || enCours ? 'not-allowed' : 'pointer',
              }}
            >
              <Check size={15} /> {brouillon.rowId ? 'Enregistrer' : 'Créer le motif'}
            </button>
          </div>
        </div>
      )}

      {/* ══ Suppression : transfert des absences si besoin ══ */}
      {aSupprimer && (
        <div
          data-testid="abs-motifs-suppression"
          style={{
            marginTop: 16, padding: 16, borderRadius: 14,
            border: '1px solid rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.06)',
          }}
        >
          <p style={{ margin: '0 0 4px', fontSize: 13.5, fontWeight: 700, color: '#FCA5A5' }}>
            Supprimer « {aSupprimer.emoji} {aSupprimer.label} » ?
          </p>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--abs-text-muted, rgba(245,242,235,0.65))' }}>
            {nbUsagesCible === 0
              ? 'Ce motif n’est utilisé par aucune absence. La suppression est définitive.'
              : `${nbUsagesCible} absence${nbUsagesCible > 1 ? 's' : ''} utilisent ce motif. Choisissez où les transférer : elles garderont leurs dates, seul le motif change.`}
          </p>

          {nbUsagesCible > 0 && (
            <label style={{ display: 'block', marginTop: 12 }}>
              <span style={{ fontSize: 11.5, color: 'var(--abs-text-muted, rgba(245,242,235,0.55))', fontWeight: 600 }}>
                Transférer vers
              </span>
              <select
                value={codeCible}
                onChange={(e) => setCodeCible(e.target.value)}
                data-testid="abs-motifs-transfert"
                style={{ ...champ, marginTop: 6 }}
              >
                {motifs.filter((m) => codeDe(m) !== codeDe(aSupprimer)).map((m) => (
                  <option key={codeDe(m)} value={codeDe(m)}>{m.emoji} {m.label}</option>
                ))}
              </select>
            </label>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 15 }}>
            <button type="button" onClick={() => { setASupprimer(null); setCodeCible('') }} style={boutonSecondaire}>
              Annuler
            </button>
            <button
              type="button"
              onClick={confirmerSuppression}
              disabled={enCours || (nbUsagesCible > 0 && !codeCible)}
              data-testid="abs-motifs-confirmer-suppression"
              style={{
                padding: '9px 14px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                fontFamily: 'inherit', border: 'none', background: 'linear-gradient(135deg, #EF4444, #B91C1C)',
                color: '#FFF', display: 'inline-flex', alignItems: 'center', gap: 7,
                opacity: enCours || (nbUsagesCible > 0 && !codeCible) ? 0.5 : 1,
              }}
            >
              <Trash2 size={15} /> Supprimer définitivement
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const champ = {
  width: '100%', padding: '10px 12px', borderRadius: 10, fontFamily: 'inherit', fontSize: 13.5,
  background: 'rgba(0,0,0,0.25)', border: '1px solid var(--abs-border, rgba(245,158,11,0.16))',
  color: 'var(--abs-text, #F5F2EB)', outline: 'none', boxSizing: 'border-box',
}

const boutonIcone = (couleur) => ({
  width: 30, height: 30, borderRadius: 9, cursor: 'pointer',
  background: `${couleur}1A`, border: `1px solid ${couleur}44`, color: couleur,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
})

const boutonSecondaire = {
  padding: '9px 14px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600,
  fontFamily: 'inherit', background: 'transparent',
  border: '1px solid var(--abs-border, rgba(245,158,11,0.16))',
  color: 'var(--abs-text-muted, rgba(245,242,235,0.65))',
}

const boutonPrimaire = {
  padding: '9px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
  border: 'none', background: 'linear-gradient(135deg, #C25E28, #8C3418)', color: '#FFF5E6',
  display: 'inline-flex', alignItems: 'center', gap: 7,
}
