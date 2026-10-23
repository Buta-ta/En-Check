import AbsencesCulturalBand from './AbsencesCulturalBand'
// ═══════════════════════════════════════════════════════════
// 📝 FORMULAIRE D'ABSENCE — TIROIR DE SAISIE
//
// Une seule colonne, cinq étapes qui se lisent dans l'ordre où
// on y pense : QUI · QUEL MOTIF · QUELLE PÉRIODE · JUSTIFICATIF ·
// RÉCAPITULATIF. Chaque étape montre ce qu'elle déclenche
// (jours décomptés, fériés touchés, solde après l'opération).
//
// Les motifs viennent du fournisseur : un motif créé sur mesure
// apparaît ici sans toucher au code. Aucune suppression ici non
// plus — le formulaire ne sait qu'ajouter ou corriger.
//
// Composant piloté : la page garde la vérité (formData, sauvegarde).
// ═══════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react'
import {
  X, Save, RefreshCw, CalendarDays, Clock, AlertCircle, CheckCircle2, Search,
} from 'lucide-react'
import { useMotifsAbsence } from '../hooks/useMotifsAbsence'
import AbsenceUploadZone from './AbsenceUploadZone'
import { isoLocal, formaterDateCourt } from '../services/absencesCalendrier'

const STATUTS = [
  { id: 'approuve', label: 'Approuvé', emoji: '✅', couleur: '#10B981' },
  { id: 'en_attente', label: 'En attente', emoji: '⏳', couleur: '#F59E0B' },
  { id: 'refuse', label: 'Refusé', emoji: '❌', couleur: '#EF4444' },
]

const ajouterJours = (iso, n) => {
  const [a, m, j] = iso.split('-').map(Number)
  const d = new Date(a, m - 1, j + n)
  return isoLocal(d)
}

const lundiDe = (iso) => {
  const [a, m, j] = iso.split('-').map(Number)
  const jourJs = new Date(a, m - 1, j).getDay()
  return ajouterJours(iso, jourJs === 0 ? -6 : 1 - jourJs)
}

const initialesDe = (prenom, nom) =>
  `${prenom || ''} ${nom || ''}`.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?'

function Etape({ numero, titre, aide, children, theme }) {
  return (
    <section style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{
          width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
          background: 'rgba(245,158,11,0.14)', border: '1px solid rgba(245,158,11,0.35)',
          color: 'var(--abs-amber)', fontSize: 12, fontWeight: 800,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {numero}
        </span>
        <div style={{ minWidth: 0 }}>
          <h4 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: theme.texte }}>{titre}</h4>
          {aide && <p style={{ margin: 0, fontSize: 11.5, color: theme.texteDoux }}>{aide}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

export default function AbsenceFormulaire({
  ouvert = false,
  valeurs = {},
  onChanger,
  onFermer,
  onEnregistrer,
  employes = [],
  edition = false,
  uploading = false,
  joursDecomptes = 0,
  joursCalendaires = 0,
  feries = [],
  chevauchement = null,
  solde = null,
  onVoirHistorique,
  darkMode = true,
}) {
  const { motifs } = useMotifsAbsence()
  const [recherche, setRecherche] = useState('')

  useEffect(() => {
    if (!ouvert) return undefined
    const surTouche = (e) => { if (e.key === 'Escape' && !uploading) onFermer?.() }
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [ouvert, uploading, onFermer])

  const theme = {
    fond: 'var(--abs-bg-elevated)',
    texte: 'var(--abs-text)',
    texteDoux: 'var(--abs-text-soft)',
    bordure: 'var(--abs-border-strong)',
    bloc: 'var(--abs-bg-soft)',
  }

  const champ = {
    width: '100%', padding: '11px 13px', borderRadius: 11, fontFamily: 'inherit', fontSize: 13.5,
    background: darkMode ? 'rgba(0,0,0,0.25)' : 'rgba(29,23,19,0.03)',
    border: `1px solid ${theme.bordure}`, color: theme.texte, outline: 'none', boxSizing: 'border-box',
  }

  const employe = employes.find((e) => e.id === valeurs.employee_id) || null
  const motif = motifs.find((m) => m.id === (valeurs.reason || 'autre')) || motifs[0]

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase()
    if (!q) return employes
    return employes.filter((e) =>
      `${e.first_name || ''} ${e.last_name || ''} ${e.matricule || ''}`.toLowerCase().includes(q)
    )
  }, [employes, recherche])

  const aujourdhui = isoLocal(new Date())
  const raccourcis = [
    { label: "Aujourd'hui", debut: aujourdhui, fin: aujourdhui },
    { label: 'Demain', debut: ajouterJours(aujourdhui, 1), fin: ajouterJours(aujourdhui, 1) },
    { label: 'Cette semaine', debut: lundiDe(aujourdhui), fin: ajouterJours(lundiDe(aujourdhui), 4) },
    { label: '1 semaine', debut: aujourdhui, fin: ajouterJours(aujourdhui, 6) },
    { label: '2 semaines', debut: aujourdhui, fin: ajouterJours(aujourdhui, 13) },
    { label: '1 mois', debut: aujourdhui, fin: ajouterJours(aujourdhui, 29) },
  ]

  const periodeValide = !!valeurs.start_date && !!valeurs.end_date && valeurs.end_date >= valeurs.start_date
  const soldeApres = solde ? Math.round((solde.restant - joursDecomptes) * 10) / 10 : null
  const depassement = soldeApres !== null && soldeApres < 0

  if (!ouvert) return null

  return (
    <>
      <div
        onClick={() => !uploading && onFermer?.()}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.58)', zIndex: 1200 }}
        aria-hidden="true"
      />

      <aside className="abs-drawer-theme" data-theme={darkMode ? 'dark' : 'light'}
        role="dialog"
        aria-modal="true"
        aria-label={edition ? "Modifier l'absence" : 'Déclarer une absence'}
        data-testid="abs-formulaire"
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 'min(500px, 100%)',
          background: theme.fond,
          borderLeft: `1px solid ${theme.bordure}`,
          boxShadow: '0 24px 70px rgba(0,0,0,0.5)',
          zIndex: 1201,
          display: 'flex', flexDirection: 'column',
          fontFamily: 'inherit',
        }}
      >
        <AbsencesCulturalBand drawer/>
        {/* ══ En-tête ══ */}
        <header style={{
          padding: '18px 22px 16px', borderBottom: `1px solid ${theme.bordure}`,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{
            width: 46, height: 46, borderRadius: 14, flexShrink: 0,
            background: `${motif?.color || '#F59E0B'}22`,
            border: `1px solid ${motif?.color || '#F59E0B'}55`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
          }}>
            {motif?.emoji || '📋'}
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: theme.texte }}>
              {edition ? "Modifier l'absence" : 'Déclarer une absence'}
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: theme.texteDoux }}>
              {employe ? `${employe.first_name} ${employe.last_name}` : 'Choisissez un employé'}
              {periodeValide ? ` · ${joursDecomptes} jour${joursDecomptes > 1 ? 's' : ''} décompté${joursDecomptes > 1 ? 's' : ''}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => !uploading && onFermer?.()}
            aria-label="Fermer"
            disabled={uploading}
            style={{
              background: 'transparent', border: `1px solid ${theme.bordure}`, borderRadius: 10,
              width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: theme.texteDoux, cursor: 'pointer',
            }}
          >
            <X size={17} />
          </button>
        </header>

        {/* ══ Corps ══ */}
        <form
          id="abs-formulaire-form"
          onSubmit={onEnregistrer}
          data-testid="abs-formulaire-corps"
          style={{ flex: 1, overflowY: 'auto', padding: '20px 22px 8px' }}
        >
          {/* ── 1. Qui ── */}
          <Etape numero={1} titre="Qui ?" aide="L'employé concerné" theme={theme}>
            {employes.length > 6 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px',
                borderRadius: 11, border: `1px solid ${theme.bordure}`, background: theme.bloc, marginBottom: 10,
              }}>
                <Search size={14} color={theme.texteDoux} />
                <input
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  placeholder="Rechercher un employé…"
                  data-testid="abs-form-recherche"
                  style={{ ...champ, background: 'transparent', border: 'none', padding: 0 }}
                />
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
              {visibles.map((e) => {
                const actif = e.id === valeurs.employee_id
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => onChanger?.({ employee_id: e.id })}
                    data-testid="abs-form-employe"
                    data-actif={actif ? 'oui' : 'non'}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px',
                      borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                      background: actif ? 'rgba(245,158,11,0.10)' : theme.bloc,
                      border: `1px solid ${actif ? 'rgba(245,158,11,0.45)' : theme.bordure}`,
                      minWidth: 0,
                    }}
                  >
                    {e.photo_url ? (
                      <img src={e.photo_url} alt="" style={{
                        width: 30, height: 30, borderRadius: 9, objectFit: 'cover', flexShrink: 0,
                      }} />
                    ) : (
                      <span style={{
                        width: 30, height: 30, borderRadius: 9, flexShrink: 0, fontSize: 11, fontWeight: 800,
                        background: actif ? 'rgba(245,158,11,0.18)' : 'rgba(245,158,11,0.10)', color: 'var(--abs-amber)',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {initialesDe(e.first_name, e.last_name)}
                      </span>
                    )}
                    <span style={{ minWidth: 0 }}>
                      <span style={{
                        display: 'block', fontSize: 12.5, fontWeight: 700, color: theme.texte,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {e.first_name} {e.last_name}
                      </span>
                      <span style={{ display: 'block', fontSize: 10.5, color: theme.texteDoux }}>
                        {e.matricule || '—'}
                      </span>
                    </span>
                  </button>
                )
              })}
              {visibles.length === 0 && (
                <p style={{ margin: 0, fontSize: 12, color: theme.texteDoux }}>Aucun employé ne correspond.</p>
              )}
            </div>

            {employe && onVoirHistorique && (
              <button
                type="button"
                onClick={() => onVoirHistorique(employe)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, padding: '6px 0',
                  background: 'none', border: 'none', color: 'var(--abs-amber)',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <Clock size={12} /> Voir l'historique de {employe.first_name}
              </button>
            )}
          </Etape>

          {/* ── 2. Quel motif ── */}
          <Etape numero={2} titre="Quel motif ?" aide="Les motifs se créent depuis l'onglet Configuration" theme={theme}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))', gap: 8 }}>
              {motifs.map((m) => {
                const actif = m.id === valeurs.reason
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onChanger?.({ reason: m.id })}
                    data-testid="abs-form-motif"
                    data-motif={m.id}
                    data-actif={actif ? 'oui' : 'non'}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                      padding: '12px 8px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
                      background: actif ? m.bg : theme.bloc,
                      border: `1px solid ${actif ? m.color : theme.bordure}`,
                      color: actif ? theme.texte : theme.texteDoux,
                    }}
                  >
                    <span style={{ fontSize: 19 }}>{m.emoji}</span>
                    <span style={{ fontSize: 11, fontWeight: actif ? 700 : 500, textAlign: 'center' }}>{m.label}</span>
                  </button>
                )
              })}
            </div>
          </Etape>

          {/* ── 3. Quelle période ── */}
          <Etape numero={3} titre="Quelle période ?" aide="Le décompte se met à jour aussitôt" theme={theme}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
              <label style={{ flex: '1 1 140px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 11.5, color: theme.texteDoux, fontWeight: 600 }}>Début *</span>
                <input
                  type="date"
                  required
                  value={valeurs.start_date || ''}
                  onChange={(e) => onChanger?.({ start_date: e.target.value })}
                  data-testid="abs-form-debut"
                  style={champ}
                />
              </label>
              <label style={{ flex: '1 1 140px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 11.5, color: theme.texteDoux, fontWeight: 600 }}>Fin *</span>
                <input
                  type="date"
                  required
                  min={valeurs.start_date || undefined}
                  value={valeurs.end_date || ''}
                  onChange={(e) => onChanger?.({ end_date: e.target.value })}
                  data-testid="abs-form-fin"
                  style={champ}
                />
              </label>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {raccourcis.map((r) => {
                const actif = valeurs.start_date === r.debut && valeurs.end_date === r.fin
                return (
                  <button
                    key={r.label}
                    type="button"
                    onClick={() => onChanger?.({ start_date: r.debut, end_date: r.fin })}
                    data-testid="abs-form-raccourci"
                    style={{
                      padding: '6px 11px', borderRadius: 999, cursor: 'pointer', fontSize: 11.5, fontWeight: 600,
                      fontFamily: 'inherit',
                      background: actif ? 'rgba(245,158,11,0.14)' : 'transparent',
                      border: `1px solid ${actif ? 'rgba(245,158,11,0.45)' : theme.bordure}`,
                      color: actif ? 'var(--abs-amber)' : theme.texteDoux,
                    }}
                  >
                    {r.label}
                  </button>
                )
              })}
            </div>

            {periodeValide && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                padding: '12px 14px', borderRadius: 13,
                background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.22)',
              }}>
                <CalendarDays size={17} color="var(--abs-amber)" />
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--abs-amber)' }} data-testid="abs-form-jours">
                  {joursDecomptes}
                </span>
                <span style={{ fontSize: 13, color: theme.texte, fontWeight: 600 }}>
                  {`jour${joursDecomptes > 1 ? 's' : ''} décompté${joursDecomptes > 1 ? 's' : ''}`}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 11.5, color: theme.texteDoux }}>
                  {`${joursCalendaires} jour${joursCalendaires > 1 ? 's' : ''} calendaire${joursCalendaires > 1 ? 's' : ''}`}
                </span>
              </div>
            )}

            {periodeValide && feries.length > 0 && (
              <div style={{
                marginTop: 10, padding: '12px 14px', borderRadius: 13,
                background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.24)',
              }}>
                <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: 'var(--abs-violet)' }}>
                  🎌 {feries.length} jour{feries.length > 1 ? 's' : ''} férié{feries.length > 1 ? 's' : ''} dans cette période
                </p>
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {feries.map((f) => (
                    <span key={f.date} style={{ fontSize: 11.5, color: 'var(--abs-violet)' }}>
                      • {f.nom || 'Férié'} ({formaterDateCourt(f.date)})
                    </span>
                  ))}
                </div>
                <label style={{
                  display: 'flex', alignItems: 'flex-start', gap: 9, marginTop: 10,
                  padding: '10px 11px', borderRadius: 10, cursor: 'pointer',
                  background: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(29,23,19,0.03)',
                  border: `1px solid ${theme.bordure}`,
                }}>
                  <input
                    type="checkbox"
                    checked={!!valeurs.count_holidays_as_leave}
                    onChange={(e) => onChanger?.({ count_holidays_as_leave: e.target.checked })}
                    data-testid="abs-form-feries-decomptes"
                    style={{ accentColor: '#8B5CF6', marginTop: 2 }}
                  />
                  <span>
                    <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: theme.texte }}>
                      Décompter quand même les jours fériés
                    </span>
                    <span style={{ display: 'block', fontSize: 11, color: theme.texteDoux, marginTop: 3, lineHeight: 1.45 }}>
                      Si l'entreprise considère qu'un congé posé sur un férié est tout de même consommé.
                    </span>
                  </span>
                </label>
              </div>
            )}

            {chevauchement && (
              <div style={{
                marginTop: 10, display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '12px 14px', borderRadius: 13,
                background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.28)',
              }}
                data-testid="abs-form-chevauchement"
              >
                <AlertCircle size={17} color="var(--abs-orange)" style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: 'var(--abs-orange)' }}>
                    ⚠️ Chevauchement détecté
                  </p>
                  <p style={{ margin: '3px 0 0', fontSize: 11.5, color: theme.texteDoux }}>
                    Absence existante du {formaterDateCourt(chevauchement.start_date)} au {formaterDateCourt(chevauchement.end_date)}
                  </p>
                </div>
              </div>
            )}
          </Etape>

          {/* ── 4. Justificatif ── */}
          <Etape numero={4} titre="Justificatif et notes" aide="Certificat médical, convocation…" theme={theme}>
            <AbsenceUploadZone
              file={valeurs.document_file}
              existingUrl={valeurs.remove_document ? null : valeurs.existing_document_url}
              onFileSelect={(f) => onChanger?.({ document_file: f, remove_document: false })}
              onRemove={() => onChanger?.({ document_file: null, remove_document: true })}
              uploading={uploading}
              darkMode={darkMode}
            />
            <textarea
              value={valeurs.notes || ''}
              onChange={(e) => onChanger?.({ notes: e.target.value })}
              placeholder="Certificat médical, précision pour le RH…"
              data-testid="abs-form-notes"
              style={{ ...champ, minHeight: 84, resize: 'vertical', marginTop: 10 }}
            />
          </Etape>

          {/* ── 5. Récapitulatif ── */}
          <Etape numero={5} titre="Récapitulatif" aide="Relisez avant d'enregistrer" theme={theme}>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6,
              padding: 4, borderRadius: 12, background: theme.bloc, border: `1px solid ${theme.bordure}`,
              marginBottom: 12,
            }}>
              {STATUTS.map((s) => {
                const actif = (valeurs.status || 'approuve') === s.id
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onChanger?.({ status: s.id })}
                    data-testid="abs-form-statut"
                    data-statut={s.id}
                    data-actif={actif ? 'oui' : 'non'}
                    style={{
                      padding: '9px 6px', borderRadius: 9, cursor: 'pointer', fontSize: 11.5, fontWeight: 700,
                      fontFamily: 'inherit', border: 'none',
                      background: actif ? `${s.couleur}22` : 'transparent',
                      color: actif ? ({ approuve: 'var(--abs-emerald)', en_attente: 'var(--abs-amber)', refuse: 'var(--abs-coral)' }[s.id]) : theme.texteDoux,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                    }}
                  >
                    <span style={{ fontSize: 14 }}>{s.emoji}</span>
                    {s.label}
                  </button>
                )
              })}
            </div>

            <div style={{ borderRadius: 13, border: `1px solid ${theme.bordure}`, overflow: 'hidden' }}>
              {[
                {
                  label: 'Employé',
                  valeur: employe ? `${employe.first_name} ${employe.last_name}` : '—',
                  emoji: employe?.photo_url ? null : '👤',
                },
                { label: 'Motif', valeur: motif ? `${motif.emoji} ${motif.label}` : '—' },
                {
                  label: 'Période',
                  valeur: periodeValide
                    ? `${formaterDateCourt(valeurs.start_date)} → ${formaterDateCourt(valeurs.end_date)}`
                    : '—',
                },
                { label: 'Durée', valeur: periodeValide ? `${joursDecomptes} jour${joursDecomptes > 1 ? 's' : ''} décompté${joursDecomptes > 1 ? 's' : ''}` : '—' },
              ].map((r, i, arr) => (
                <div key={r.label} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
                  padding: '11px 14px',
                  borderBottom: i < arr.length - 1 ? `1px solid ${theme.bordure}` : 'none',
                  background: i % 2 ? theme.bloc : 'transparent',
                }}>
                  <span style={{ fontSize: 12, color: theme.texteDoux }}>{r.label}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: theme.texte, textAlign: 'right' }}>{r.valeur}</span>
                </div>
              ))}

              {solde && (
                <div style={{ padding: '12px 14px', borderTop: `1px solid ${theme.bordure}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ fontSize: 12, color: theme.texteDoux }}>Solde de congés</span>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: depassement ? 'var(--abs-coral)' : 'var(--abs-emerald)' }}>
                      {`${solde.restant} j → ${soldeApres} j`}
                    </span>
                  </div>
                  <div style={{
                    marginTop: 8, height: 6, borderRadius: 999, overflow: 'hidden',
                    background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(29,23,19,0.07)',
                  }}>
                    <div style={{
                      width: `${Math.max(0, Math.min(100, solde.plafond ? (soldeApres / solde.plafond) * 100 : 0))}%`,
                      height: '100%', borderRadius: 999,
                      background: depassement ? '#EF4444' : 'linear-gradient(90deg, #10B981, #059669)',
                    }} />
                  </div>
                  <p style={{ margin: '7px 0 0', fontSize: 11, color: theme.texteDoux }}>
                    {depassement
                      ? `⚠️ Plafond dépassé de ${Math.abs(soldeApres)} jour${Math.abs(soldeApres) > 1 ? 's' : ''} (${solde.plafond} j accordés)`
                      : `Reste ${soldeApres} jour${soldeApres > 1 ? 's' : ''} sur ${solde.plafond}`}
                  </p>
                </div>
              )}
            </div>

            {!chevauchement && periodeValide && !depassement && (
              <div style={{
                marginTop: 12, display: 'flex', alignItems: 'center', gap: 9,
                padding: '11px 13px', borderRadius: 12,
                background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.24)',
              }}>
                <CheckCircle2 size={16} color="var(--abs-emerald)" />
                <span style={{ fontSize: 11.5, color: 'var(--abs-emerald)', fontWeight: 600 }}>
                  Rien à signaler : pas de chevauchement, solde suffisant.
                </span>
              </div>
            )}
          </Etape>

          <div style={{ height: 8 }} />
        </form>

        {/* ══ Pied ══ */}
        <footer style={{
          padding: '14px 22px', borderTop: `1px solid ${theme.bordure}`,
          display: 'flex', gap: 10, background: theme.fond,
        }}>
          <button
            type="button"
            onClick={() => !uploading && onFermer?.()}
            disabled={uploading}
            style={{
              flex: 1, padding: '13px 14px', borderRadius: 12, cursor: 'pointer',
              background: 'transparent', border: `1px solid ${theme.bordure}`,
              color: theme.texte, fontWeight: 600, fontSize: 13.5, fontFamily: 'inherit',
            }}
          >
            Annuler
          </button>
          <button
            type="submit"
            form="abs-formulaire-form"
            disabled={uploading}
            data-testid="abs-form-enregistrer"
            style={{
              flex: 2, padding: '13px 14px', borderRadius: 12, cursor: uploading ? 'not-allowed' : 'pointer',
              border: 'none', background: 'linear-gradient(135deg, #C25E28, #8C3418)',
              color: '#FFF5E6', fontWeight: 700, fontSize: 13.5, fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: uploading ? 0.7 : 1,
            }}
          >
            {uploading
              ? <><RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Enregistrement…</>
              : <><Save size={17} /> {edition ? 'Enregistrer les modifications' : 'Déclarer l’absence'}</>}
          </button>
        </footer>
        <AbsencesCulturalBand position="bottom" drawer/>
      </aside>
    </>
  )
}
