// ═══════════════════════════════════════════════════════════
// 🎨 GESTIONNAIRE DE MOTIFS
//
// Créer, modifier, archiver et restaurer les motifs d'absence :
// libellé, emoji et couleur sont libres.
//
// Règles maison :
//   • on ARCHIVE, on n'efface jamais → tout est restaurable
//   • archiver prévient du nombre d'absences concernées
//   • le dernier motif actif ne peut pas être archivé
//   • une absence qui référence un motif archivé continue de
//     s'afficher avec ses couleurs d'origine (repli automatique)
// ═══════════════════════════════════════════════════════════

import { useMemo, useState } from 'react'
import { Plus, Pencil, Archive, ArchiveRestore, Check, X, Palette, Trash2 } from 'lucide-react'
import { useMotifsAbsence } from '../hooks/useMotifsAbsence'
import { EMOJIS_MOTIFS, PALETTE_MOTIFS, fondDepuisCouleur } from '../constants/motifsAbsence'
import { formaterDateCourt } from '../services/absencesCalendrier'

const champsVides = { label: '', emoji: '📋', color: '#10B981' }

export default function AbsencesMotifsManager({ absences = [] }) {
  const { motifs, corbeille, creer, modifier, archiver, restaurer } = useMotifsAbsence()
  const [brouillon, setBrouillon] = useState(null) // null | { id?, label, emoji, color }
  const [confirmation, setConfirmation] = useState(null) // motif à archiver
  const [enCours, setEnCours] = useState(false)

  const usages = useMemo(() => {
    const map = {}
    absences.forEach((a) => {
      const cle = a.reason || 'autre'
      map[cle] = (map[cle] || 0) + 1
    })
    return map
  }, [absences])

  const ouvrirCreation = () => setBrouillon({ ...champsVides })
  const ouvrirEdition = (m) => setBrouillon({ id: m.id, label: m.label, emoji: m.emoji, color: m.color })

  const enregistrer = async () => {
    const label = (brouillon.label || '').trim()
    if (!label) return
    setEnCours(true)
    try {
      if (brouillon.id) await modifier(brouillon.id, brouillon)
      else await creer(brouillon)
      setBrouillon(null)
    } catch (err) {
      console.error(err)
    } finally {
      setEnCours(false)
    }
  }

  const confirmerArchivage = async () => {
    if (!confirmation) return
    setEnCours(true)
    try {
      await archiver(confirmation.id)
      setConfirmation(null)
    } finally {
      setEnCours(false)
    }
  }

  return (
    <div className="abs-panel" style={{ padding: 18, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 15, color: 'var(--abs-text)' }}>Motifs d’absence</h3>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--abs-text-soft)' }}>
            {motifs.length} motif{motifs.length > 1 ? 's' : ''} actif{motifs.length > 1 ? 's' : ''} · glissez-les dans le calendrier depuis le dock
          </p>
        </div>
        <button className="abs-btn abs-btn-primary" onClick={ouvrirCreation} disabled={enCours}>
          <Plus size={15} /> Nouveau motif
        </button>
      </div>

      {/* ─── Formulaire création / édition ─── */}
      {brouillon && (
        <div style={{
          border: '1px solid var(--abs-border-strong)', borderRadius: 12, padding: 14,
          background: 'var(--abs-bg-soft)', marginBottom: 14,
        }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <input
              value={brouillon.label}
              onChange={(e) => setBrouillon({ ...brouillon, label: e.target.value })}
              placeholder="Libellé du motif"
              aria-label="Libellé du motif"
              style={{
                flex: '1 1 220px', padding: '10px 12px', borderRadius: 10, fontSize: 13,
                background: 'var(--abs-bg-panel)', border: '1px solid var(--abs-border)',
                color: 'var(--abs-text)', fontFamily: 'inherit',
              }}
            />
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', borderRadius: 10,
              background: fondDepuisCouleur(brouillon.color),
              border: `1px solid ${brouillon.color}`, color: brouillon.color, fontSize: 13, fontWeight: 700,
            }}>
              <span style={{ fontSize: 17 }}>{brouillon.emoji}</span>
              {brouillon.label || 'Aperçu'}
            </div>
          </div>

          <p style={{ margin: '0 0 6px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--abs-text-faint)' }}>
            Emoji
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {EMOJIS_MOTIFS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setBrouillon({ ...brouillon, emoji: e })}
                aria-label={`Emoji ${e}`}
                style={{
                  width: 34, height: 34, borderRadius: 9, fontSize: 17, cursor: 'pointer',
                  background: brouillon.emoji === e ? 'rgba(245,158,11,0.16)' : 'var(--abs-bg-panel)',
                  border: `1px solid ${brouillon.emoji === e ? 'var(--abs-border-strong)' : 'var(--abs-border)'}`,
                }}
              >
                {e}
              </button>
            ))}
          </div>

          <p style={{ margin: '0 0 6px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--abs-text-faint)' }}>
            <Palette size={11} style={{ marginRight: 5, verticalAlign: -1 }} /> Couleur
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 14 }}>
            {PALETTE_MOTIFS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setBrouillon({ ...brouillon, color: c })}
                aria-label={`Couleur ${c}`}
                style={{
                  width: 28, height: 28, borderRadius: 8, background: c, cursor: 'pointer',
                  border: brouillon.color === c ? '2px solid var(--abs-text)' : '1px solid var(--abs-border)',
                }}
              />
            ))}
            <input
              type="color"
              value={brouillon.color}
              onChange={(e) => setBrouillon({ ...brouillon, color: e.target.value })}
              aria-label="Couleur personnalisée"
              style={{ width: 40, height: 30, border: '1px solid var(--abs-border)', borderRadius: 8, background: 'transparent', cursor: 'pointer' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="abs-btn abs-btn-primary" onClick={enregistrer} disabled={enCours || !brouillon.label.trim()}>
              <Check size={15} /> {brouillon.id ? 'Enregistrer' : 'Créer le motif'}
            </button>
            <button className="abs-btn" onClick={() => setBrouillon(null)}>
              <X size={15} /> Annuler
            </button>
          </div>
        </div>
      )}

      {/* ─── Liste des motifs actifs ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 10 }}>
        {motifs.map((m) => {
          const nb = usages[m.id] || 0
          return (
            <div
              key={m.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                borderRadius: 12, border: '1px solid var(--abs-border)',
                borderLeft: `3px solid ${m.color}`, background: 'var(--abs-bg-panel)',
              }}
            >
              <span style={{ fontSize: 18 }}>{m.emoji}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--abs-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.label}
                </p>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--abs-text-faint)' }}>
                  {nb} absence{nb > 1 ? 's' : ''}{m.is_system ? ' · motif d’origine' : ''}
                </p>
              </div>
              <button
                className="abs-back-btn"
                style={{ width: 30, height: 30 }}
                onClick={() => ouvrirEdition(m)}
                aria-label={`Modifier ${m.label}`}
                title="Modifier"
              >
                <Pencil size={13} />
              </button>
              <button
                className="abs-back-btn"
                style={{ width: 30, height: 30 }}
                onClick={() => setConfirmation(m)}
                disabled={motifs.length <= 1}
                aria-label={`Archiver ${m.label}`}
                title={motifs.length <= 1 ? 'Impossible : il faut au moins un motif' : 'Archiver'}
              >
                <Archive size={13} />
              </button>
            </div>
          )
        })}
      </div>

      {/* ─── Corbeille ─── */}
      {corbeille.length > 0 && (
        <details style={{ marginTop: 16, borderTop: '1px solid var(--abs-border)', paddingTop: 12 }}>
          <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--abs-text-soft)' }}>
            <Trash2 size={12} style={{ marginRight: 6, verticalAlign: -1 }} />
            Corbeille — {corbeille.length} motif{corbeille.length > 1 ? 's' : ''} archivé{corbeille.length > 1 ? 's' : ''}
          </summary>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 10, marginTop: 10 }}>
            {corbeille.map((m) => (
              <div key={m.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12,
                border: '1px dashed var(--abs-border)', background: 'var(--abs-bg-soft)', opacity: 0.85,
              }}>
                <span style={{ fontSize: 18, filter: 'grayscale(0.4)' }}>{m.emoji}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--abs-text)', textDecoration: 'line-through' }}>{m.label}</p>
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--abs-text-faint)' }}>
                    Archivé le {formaterDateCourt(m.archive_le)}
                  </p>
                </div>
                <button
                  className="abs-back-btn"
                  style={{ width: 30, height: 30 }}
                  onClick={() => restaurer(m.id)}
                  aria-label={`Restaurer ${m.label}`}
                  title="Restaurer"
                >
                  <ArchiveRestore size={13} />
                </button>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* ─── Confirmation d'archivage ─── */}
      {confirmation && (
        <>
          <div onClick={() => setConfirmation(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000 }} aria-hidden="true" />
          <div role="dialog" aria-modal="true" className="abs-panel" style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: 1001, width: 'min(420px, 92vw)', padding: 22,
          }}>
            <p style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700, color: 'var(--abs-text)' }}>
              Archiver « {confirmation.label} » ?
            </p>
            <p style={{ margin: '0 0 16px', fontSize: 13, lineHeight: 1.6, color: 'var(--abs-text-soft)' }}>
              Le motif ne sera plus proposé dans le dock ni dans le formulaire.
              {(usages[confirmation.id] || 0) > 0 && (
                <>
                  {' '}
                  <b style={{ color: '#F59E0B' }}>
                    {usages[confirmation.id]} absence{usages[confirmation.id] > 1 ? 's' : ''} l’utilisent
                  </b>{' '}
                  : elles resteront affichées avec leurs couleurs d’origine.
                </>
              )}{' '}
              Rien n’est supprimé : vous pourrez le restaurer depuis la corbeille.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="abs-btn" style={{ flex: 1, justifyContent: 'center' }} onClick={confirmerArchivage} disabled={enCours}>
                <Archive size={15} /> Archiver
              </button>
              <button className="abs-btn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setConfirmation(null)}>
                Annuler
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
