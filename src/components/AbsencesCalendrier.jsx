// ═══════════════════════════════════════════════════════════
// 🗓️ CALENDRIER MENSUEL DES ABSENCES — VUE « PLANNING »
//
// Les employés sont en lignes, les jours du mois en colonnes, et
// chaque absence devient une barre positionnée sur sa période.
// Un clic ouvre le tiroir de détail (AbsenceTiroir).
//
// Ce composant ne lit rien de Supabase et ne supprime rien : il
// reçoit des données et appelle des callbacks fournis par la page.
// ═══════════════════════════════════════════════════════════

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, CalendarOff, Users } from 'lucide-react'
import { styleBarreAbsence, DATA_TRANSFER_MOTIF } from '../constants/motifsAbsence'
import {
  JOURS_SEMAINE,
  joursDuMois,
  nomMois,
  segmentDuMois,
  empilerSegments,
  compterJoursOuvres,
  isoLocal,
  formaterDateCourt,
} from '../services/absencesCalendrier'
import AbsenceTiroir from './AbsenceTiroir'
import { useMotifsAbsence } from '../hooks/useMotifsAbsence'

const LARGEUR_EMPLOYE = 236
const LARGEUR_JOUR = 36
const HAUTEUR_BARRE = 24
const ESPACEMENT_BARRE = 30

const pad2 = (n) => String(n).padStart(2, '0')

const initialesDe = (prenom, nom) =>
  `${prenom || ''} ${nom || ''}`.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?'

export default function AbsencesCalendrier({
  absences = [],
  employes = [],
  darkMode = true,
  annee,
  mois,
  onChangerMois,
  getHolidaySet = () => new Set(),
  joursPrisParEmploye = {},
  plafondConges = 30,
  conflitParAbsence = {},
  onModifier,
  onChangerStatut,
  onVoirDocument,
  onDeclarer,
  onDeposerMotif,
}) {
  const { motifs } = useMotifsAbsence()
  // Filtre en creux : rien de masqué par défaut, un motif créé ensuite est visible aussitôt
  const [motifsMasques, setMotifsMasques] = useState(() => new Set())
  const [masquerSansAbsence, setMasquerSansAbsence] = useState(false)
  const [absenceActive, setAbsenceActive] = useState(null)
  // Cellule survolée pendant un glisser-déposer : { employeeId, index }
  const [survol, setSurvol] = useState(null)

  const theme = {
    carte: darkMode ? '#1D1713' : '#FFFFFF',
    fond: darkMode ? '#15110E' : '#FAF6EE',
    texte: darkMode ? '#F5F2EB' : '#1D1713',
    texteDoux: darkMode ? 'rgba(245,242,235,0.60)' : 'rgba(29,23,19,0.60)',
    bordure: darkMode ? 'rgba(245,158,11,0.16)' : 'rgba(29,23,19,0.12)',
    grille: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(29,23,19,0.06)',
    weekend: darkMode ? 'rgba(255,255,255,0.035)' : 'rgba(29,23,19,0.045)',
    ferie: darkMode ? 'rgba(139,92,246,0.13)' : 'rgba(139,92,246,0.10)',
    pastille: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(29,23,19,0.04)',
  }

  const jours = useMemo(() => joursDuMois(annee, mois), [annee, mois])
  const nbJours = jours.length
  const aujourdhuiIso = isoLocal(new Date())
  const indexAujourdhui = jours.findIndex((j) => j.iso === aujourdhuiIso)

  // ── Construction des lignes : un employé = une ligne ────────────────
  const lignes = useMemo(() => {
    const parEmploye = new Map()
    employes.forEach((e) => parEmploye.set(e.id, { employe: e, segments: [] }))

    absences.forEach((a) => {
      const motifId = a.reason || 'autre'
      if (motifsMasques.has(motifId)) return
      const seg = segmentDuMois(a.start_date, a.end_date, annee, mois)
      if (!seg) return
      const ligne = parEmploye.get(a.employee_id)
      if (!ligne) return // employé inactif ou hors périmètre : ignoré
      ligne.segments.push({ ...seg, absence: a })
    })

    return [...parEmploye.values()]
      .map((l) => ({ ...l, segments: empilerSegments(l.segments) }))
      .filter((l) => !masquerSansAbsence || l.segments.length > 0)
      .sort((a, b) =>
        `${a.employe.last_name || ''} ${a.employe.first_name || ''}`.localeCompare(
          `${b.employe.last_name || ''} ${b.employe.first_name || ''}`,
          'fr'
        )
      )
  }, [employes, absences, annee, mois, motifsMasques, masquerSansAbsence])

  // ── Récapitulatif du mois affiché ───────────────────────────────────
  const stats = useMemo(() => {
    const vus = new Map()
    let journees = 0

    lignes.forEach((l) => {
      const feriers = getHolidaySet(l.employe.enterprise_id)
      l.segments.forEach((seg) => {
        const a = seg.absence
        if (!vus.has(a.id)) vus.set(a.id, a)
        const debutIso = `${annee}-${pad2(mois + 1)}-${pad2(seg.debut)}`
        const finIso = `${annee}-${pad2(mois + 1)}-${pad2(seg.fin)}`
        journees += compterJoursOuvres(debutIso, finIso, feriers, a.count_holidays_as_leave)
      })
    })

    const liste = [...vus.values()]
    return {
      total: liste.length,
      enAttente: liste.filter((a) => a.status === 'en_attente').length,
      refusees: liste.filter((a) => a.status === 'refuse').length,
      journees,
    }
  }, [lignes, annee, mois, getHolidaySet])

  const basculerMotif = (id) => {
    setMotifsMasques((prev) => {
      const suivant = new Set(prev)
      if (suivant.has(id)) suivant.delete(id)
      else suivant.add(id)
      return suivant
    })
  }

  const soldeDe = (employeeId) => {
    const pris = joursPrisParEmploye[employeeId] ?? 0
    const plafond = plafondConges || 30
    return { pris, plafond, restant: Math.max(0, plafond - pris) }
  }

  // ── Rendu ───────────────────────────────────────────────────────────
  return (
    <div className="abs-cal" data-theme={darkMode ? 'dark' : 'light'}>
      <style>{`
        .abs-cal-scroll::-webkit-scrollbar { height: 10px; }
        .abs-cal-scroll::-webkit-scrollbar-thumb { background: rgba(245,158,11,.28); border-radius: 8px; }
        .abs-cal-barre:hover { filter: brightness(1.15); }
        .abs-cal-barre:focus-visible { outline: 2px solid #F59E0B; outline-offset: 1px; }
      `}</style>

      {/* ═══ Barre d'outils ═══ */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => onChangerMois?.(-1)} aria-label="Mois précédent" style={boutonNav(theme)}>
            <ChevronLeft size={18} />
          </button>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: theme.texte, minWidth: 168, textAlign: 'center' }}>
            {nomMois(annee, mois)}
          </h3>
          <button onClick={() => onChangerMois?.(1)} aria-label="Mois suivant" style={boutonNav(theme)}>
            <ChevronRight size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => setMotifsMasques(new Set())} style={boutonDoux(theme)}>
            Tous les motifs
          </button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: theme.texteDoux, cursor: 'pointer' }}>
            <input type="checkbox" checked={masquerSansAbsence} onChange={(e) => setMasquerSansAbsence(e.target.checked)} />
            Masquer les employés sans absence
          </label>
          {onDeclarer && (
            <button onClick={onDeclarer} style={boutonPrimaire}>
              <Plus size={16} /> Déclarer une absence
            </button>
          )}
        </div>
      </div>

      {/* ═══ Filtres par motif ═══ */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {motifs.map((m) => {
          const actif = !motifsMasques.has(m.id)
          return (
            <button key={m.id} onClick={() => basculerMotif(m.id)} style={{
              padding: '6px 12px', borderRadius: 999, cursor: 'pointer', fontSize: 12, fontWeight: 600,
              fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6,
              background: actif ? m.bg : 'transparent',
              border: `1px solid ${actif ? m.color : theme.bordure}`,
              color: actif ? m.color : theme.texteDoux,
              opacity: actif ? 1 : 0.55,
            }}>
              <span>{m.emoji}</span> {m.label}
            </button>
          )
        })}
      </div>

      {/* ═══ Grille ═══ */}
      <div className="abs-cal-scroll" style={{
        overflowX: 'auto', border: `1px solid ${theme.bordure}`,
        borderRadius: 16, background: theme.carte,
      }}>
        <div style={{ minWidth: LARGEUR_EMPLOYE + nbJours * LARGEUR_JOUR }}>

          {/* Entête des jours */}
          <div style={{ display: 'flex', borderBottom: `1px solid ${theme.bordure}` }}>
            <div style={{
              width: LARGEUR_EMPLOYE, flexShrink: 0, position: 'sticky', left: 0, zIndex: 3,
              background: theme.carte, padding: '10px 14px',
              fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.texteDoux,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Users size={13} /> Employé · {lignes.length}
            </div>
            <div style={{ flex: 1, display: 'flex' }}>
              {jours.map((j) => {
                const estAujourdhui = j.iso === aujourdhuiIso
                return (
                  <div key={j.iso} style={{
                    flex: 1, minWidth: 0, textAlign: 'center', padding: '7px 0 6px',
                    background: estAujourdhui ? 'rgba(245,158,11,0.10)' : 'transparent',
                    borderLeft: `1px solid ${theme.grille}`,
                  }}>
                    <div style={{ fontSize: 10, color: theme.texteDoux, textTransform: 'uppercase' }}>
                      {JOURS_SEMAINE[j.weekday - 1]}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: estAujourdhui ? 800 : 600, color: estAujourdhui ? '#F59E0B' : theme.texte }}>
                      {j.jour}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Lignes employés */}
          {lignes.map((ligne) => {
            const feriers = getHolidaySet(ligne.employe.enterprise_id)
            const nbRangees = ligne.segments.reduce((max, s) => Math.max(max, s.rangeesTotal || 1), 1)
            const hauteur = 10 + nbRangees * ESPACEMENT_BARRE
            const solde = soldeDe(ligne.employe.id)

            return (
              <div key={ligne.employe.id} style={{ display: 'flex', borderBottom: `1px solid ${theme.grille}` }}>
                {/* Colonne employé (collante) */}
                <div style={{
                  width: LARGEUR_EMPLOYE, flexShrink: 0, position: 'sticky', left: 0, zIndex: 2,
                  background: theme.carte, borderRight: `1px solid ${theme.bordure}`,
                  padding: '8px 14px', minHeight: hauteur,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  {ligne.employe.photo_url ? (
                    <img
                      src={ligne.employe.photo_url}
                      alt=""
                      style={{
                        width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                        objectFit: 'cover', border: `1px solid ${theme.bordure}`,
                      }}
                    />
                  ) : (
                    <div style={{
                      width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                      background: theme.pastille, border: `1px solid ${theme.bordure}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700, color: theme.texte,
                    }}>
                      {initialesDe(ligne.employe.first_name, ligne.employe.last_name)}
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <p style={{
                      margin: 0, fontSize: 13, fontWeight: 600, color: theme.texte,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150,
                    }}>
                      {ligne.employe.first_name} {ligne.employe.last_name}
                    </p>
                    <span style={{
                      display: 'inline-block', marginTop: 3, padding: '2px 8px', borderRadius: 999,
                      background: 'rgba(16,185,129,0.12)', color: '#10B981', fontSize: 10, fontWeight: 700,
                    }}
                      title={`${solde.pris} jour(s) pris · plafond ${solde.plafond} jours`}
                    >
                      🌴 {solde.restant}/{solde.plafond}
                    </span>
                  </div>
                </div>

                {/* Piste du mois — zone de dépôt du glisser-déposer */}
                <div
                  style={{ flex: 1, position: 'relative', display: 'flex', minHeight: hauteur }}
                  data-drop-lane={ligne.employe.id}
                  onDragOver={(e) => {
                    if (!onDeposerMotif) return
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'copy'
                    const rect = e.currentTarget.getBoundingClientRect()
                    const index = jourDepuisX(e.clientX, rect, nbJours)
                    if (!survol || survol.employeeId !== ligne.employe.id || survol.index !== index) {
                      setSurvol({ employeeId: ligne.employe.id, index })
                    }
                  }}
                  onDragLeave={(e) => {
                    if (e.currentTarget.contains(e.relatedTarget)) return
                    if (survol && survol.employeeId === ligne.employe.id) setSurvol(null)
                  }}
                  onDrop={(e) => {
                    if (!onDeposerMotif) return
                    e.preventDefault()
                    const motifId = e.dataTransfer.getData(DATA_TRANSFER_MOTIF) || e.dataTransfer.getData('text/plain')
                    const rect = e.currentTarget.getBoundingClientRect()
                    const index = jourDepuisX(e.clientX, rect, nbJours)
                    setSurvol(null)
                    if (motifId) onDeposerMotif({ employeeId: ligne.employe.id, dateIso: jours[index].iso, motifId })
                  }}
                >
                  {jours.map((j) => (
                    <div key={j.iso} style={{
                      flex: 1, minWidth: 0,
                      background: feriers.has(j.iso) ? theme.ferie : (j.weekend ? theme.weekend : 'transparent'),
                      borderLeft: `1px solid ${theme.grille}`,
                    }} />
                  ))}

                  {/* Repère « aujourd'hui » */}
                  {indexAujourdhui >= 0 && (
                    <div aria-hidden="true" style={{
                      position: 'absolute', top: 0, bottom: 0, width: 2,
                      left: `${((indexAujourdhui + 0.5) / nbJours) * 100}%`,
                      background: 'rgba(245,158,11,0.45)',
                    }} />
                  )}

                  {/* Barres d'absence */}
                  {ligne.segments.map((seg) => {
                    const st = styleBarreAbsence(seg.absence, motifs)
                    const a = seg.absence
                    const titre = [
                      st.motif.label,
                      `${ligne.employe.first_name} ${ligne.employe.last_name}`,
                      `du ${formaterDateCourt(a.start_date)} au ${formaterDateCourt(a.end_date)}`,
                      st.statut.label,
                    ].join(' · ')
                    const coupee = seg.coupeeAvant || seg.coupeeApres

                    return (
                      <button
                        key={a.id}
                        className="abs-cal-barre"
                        onClick={() => setAbsenceActive(a)}
                        title={titre}
                        aria-label={titre}
                        data-testid="abs-cal-barre"
                        data-statut={a.status}
                        style={{
                          position: 'absolute',
                          left: `calc(${((seg.debut - 1) / nbJours) * 100}% + 2px)`,
                          width: `calc(${((seg.fin - seg.debut + 1) / nbJours) * 100}% - 4px)`,
                          top: 5 + seg.rangee * ESPACEMENT_BARRE,
                          height: HAUTEUR_BARRE,
                          background: st.fond,
                          border: st.pointillee ? `1px dashed ${st.bordure}` : `1px solid ${st.bordure}`,
                          borderRadius: 8,
                          color: st.texte,
                          fontSize: 11,
                          fontWeight: 700,
                          fontFamily: 'inherit',
                          display: 'flex', alignItems: 'center', gap: 5,
                          padding: '0 8px',
                          cursor: 'pointer',
                          overflow: 'hidden', whiteSpace: 'nowrap',
                          textDecoration: st.barree ? 'line-through' : 'none',
                          opacity: st.barree ? 0.85 : 1,
                        }}
                      >
                        <span>{st.motif.emoji}</span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{st.motif.label}</span>
                        {a.document_url && <span aria-hidden="true">📎</span>}
                        {coupee && <span aria-hidden="true" style={{ opacity: 0.8 }}>{seg.coupeeAvant ? '‹' : ''}{seg.coupeeApres ? '›' : ''}</span>}
                        {conflitParAbsence[a.id]?.status === 'pending' && <span aria-hidden="true">⚡</span>}
                      </button>
                    )
                  })}

                  {survol && survol.employeeId === ligne.employe.id && (
                    <div
                      className="abs-drop-cell"
                      data-testid="abs-drop-cell"
                      aria-hidden="true"
                      style={{
                        left: `calc(${(survol.index / nbJours) * 100}% + 1px)`,
                        width: `calc(${(1 / nbJours) * 100}% - 2px)`,
                      }}
                    />
                  )}
                </div>
              </div>
            )
          })}

          {lignes.length === 0 && (
            <div style={{ padding: 44, textAlign: 'center', color: theme.texteDoux }}>
              <CalendarOff size={26} style={{ marginBottom: 10, opacity: 0.6 }} />
              <p style={{ margin: 0, fontSize: 14 }}>Aucun employé à afficher sur cette période.</p>
            </div>
          )}
        </div>
      </div>

      {/* ═══ Légende ═══ */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 14, fontSize: 11, color: theme.texteDoux }}>
        {motifs.map((m) => (
          <span key={m.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <i style={{ width: 10, height: 10, borderRadius: 3, background: m.color, display: 'block' }} />
            {m.label}
          </span>
        ))}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <i style={{
            width: 14, height: 10, borderRadius: 3, display: 'block',
            border: '1px dashed #F59E0B', background: 'transparent',
          }} />
          En attente (contour pointillé)
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <i style={{
            width: 14, height: 10, borderRadius: 3, display: 'block',
            background: 'rgba(153,27,27,0.20)', border: '1px solid #B91C1C',
          }} />
          Refusé (barré)
        </span>
        <span>‹ › à cheval sur un autre mois</span>
        <span>📎 justificatif joint</span>
        <span>⚡ conflit de pointage</span>
      </div>

      {/* ═══ Récapitulatif ═══ */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 12, padding: '11px 16px',
        border: `1px solid ${theme.bordure}`, borderRadius: 12, background: theme.carte,
        fontSize: 12, color: theme.texteDoux,
      }}>
        <span><b style={{ color: theme.texte }}>{stats.total}</b> absence{stats.total > 1 ? 's' : ''} ce mois</span>
        <span style={{ color: stats.enAttente ? '#F59E0B' : theme.texteDoux }}>
          ⏳ <b>{stats.enAttente}</b> en attente
        </span>
        <span style={{ color: stats.refusees ? '#EF4444' : theme.texteDoux }}>
          ❌ <b>{stats.refusees}</b> refusée{stats.refusees > 1 ? 's' : ''}
        </span>
        <span>
          📆 <b style={{ color: theme.texte }}>{stats.journees}</b> jour{stats.journees > 1 ? 's' : ''} compté{stats.journees > 1 ? 's' : ''} sur le mois
        </span>
      </div>

      {/* ═══ Tiroir de détail ═══ */}
      {absenceActive && (
        <AbsenceTiroir
          absence={absenceActive}
          darkMode={darkMode}
          joursOuvres={compterJoursOuvres(
            absenceActive.start_date,
            absenceActive.end_date,
            getHolidaySet(absenceActive.enterprise_id),
            absenceActive.count_holidays_as_leave
          )}
          solde={soldeDe(absenceActive.employee_id)}
          conflit={conflitParAbsence[absenceActive.id] || null}
          onClose={() => setAbsenceActive(null)}
          onChangerStatut={(a, statut) => { onChangerStatut?.(a, statut); setAbsenceActive(null) }}
          onModifier={(a) => { onModifier?.(a); setAbsenceActive(null) }}
          onVoirDocument={onVoirDocument}
        />
      )}
    </div>
  )
}

/** Quel jour du mois se trouve sous le pointeur ? (0-based, borné) */
function jourDepuisX(clientX, rect, nbJours) {
  if (!rect || !rect.width) return 0
  const ratio = (clientX - rect.left) / rect.width
  return Math.max(0, Math.min(nbJours - 1, Math.floor(ratio * nbJours)))
}

// ── Petits helpers de style ───────────────────────────────────────────
function boutonNav(theme) {
  return {
    background: theme.pastille, border: `1px solid ${theme.bordure}`, borderRadius: 10,
    width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', color: theme.texte,
  }
}

function boutonDoux(theme) {
  return {
    padding: '8px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 600,
    fontFamily: 'inherit', background: 'transparent', border: `1px solid ${theme.bordure}`, color: theme.texteDoux,
  }
}

const boutonPrimaire = {
  padding: '9px 14px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700,
  fontFamily: 'inherit', border: 'none',
  background: 'linear-gradient(135deg, #C25E28, #8C3418)', color: '#FFF5E6',
  display: 'inline-flex', alignItems: 'center', gap: 7,
}
