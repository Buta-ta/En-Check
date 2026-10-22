// ═══════════════════════════════════════════════════════════
// 🗓️ CALENDRIER DES ABSENCES — VUE « PLANNING »
//
// Trois modes : JOUR · SEMAINE · MOIS.
// Les employés sont en lignes, les jours en colonnes, et chaque
// absence devient une barre positionnée sur sa période.
// Un clic ouvre le tiroir de détail (AbsenceTiroir).
//
// Ce composant ne lit rien de Supabase et ne supprime rien : il
// reçoit des données et appelle des callbacks fournis par la page.
// ═══════════════════════════════════════════════════════════

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, CalendarOff, Users, CalendarDays } from 'lucide-react'
import { styleBarreAbsence, DATA_TRANSFER_MOTIF } from '../constants/motifsAbsence'
import {
  JOURS_SEMAINE,
  joursDeLaPeriode,
  deplacerPeriode,
  parseIso,
  isoLocal,
  nomMois,
  titrePeriode,
  nomJourLong,
  segmentSurJours,
  empilerSegments,
  compterJoursOuvres,
  formaterDateCourt,
} from '../services/absencesCalendrier'
import AbsenceTiroir from './AbsenceTiroir'
import { useMotifsAbsence } from '../hooks/useMotifsAbsence'

const LARGEUR_EMPLOYE = 236
const LARGEUR_JOUR_MOIS = 36
const LARGEUR_JOUR_SEMAINE = 108
const LARGEUR_JOUR_UNIQUE = 460
const HAUTEUR_BARRE = 24
const ESPACEMENT_BARRE = 30

const MODES = [
  { id: 'jour', label: 'Jour' },
  { id: 'semaine', label: 'Semaine' },
  { id: 'mois', label: 'Mois' },
]

const pad2 = (n) => String(n).padStart(2, '0')

const initialesDe = (prenom, nom) =>
  `${prenom || ''} ${nom || ''}`.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?'

const largeurJourDe = (mode) =>
  (mode === 'jour' ? LARGEUR_JOUR_UNIQUE : mode === 'semaine' ? LARGEUR_JOUR_SEMAINE : LARGEUR_JOUR_MOIS)

export default function AbsencesCalendrier({
  absences = [],
  employes = [],
  darkMode = true,
  annee,
  mois,
  onChangerMois,
  mode: modeControle,
  onChangerMode,
  jourInitial,
  getHolidaySet = () => new Set(),
  joursPrisParEmploye = {},
  plafondConges = 30,
  conflitParAbsence = {},
  onModifier,
  onChangerStatut,
  onVoirDocument,
  onSupprimer,
  onDeclarer,
  onDeposerMotif,
}) {
  const { motifs, motifPour } = useMotifsAbsence()
  // Chaque barre prend le motif de SON absence : en vue « toutes entreprises »
  // deux sociétés peuvent avoir personnalisé le même code différemment
  const listePour = (a) => {
    const m = motifPour(a)
    return m ? [m] : motifs
  }
  // Filtre en creux : rien de masqué par défaut, un motif créé ensuite est visible aussitôt
  const [motifsMasques, setMotifsMasques] = useState(() => new Set())
  const [masquerSansAbsence, setMasquerSansAbsence] = useState(false)
  const [absenceActive, setAbsenceActive] = useState(null)
  // Cellule survolée pendant un glisser-déposer : { employeeId, index }
  const [survol, setSurvol] = useState(null)
  const [modeInterne, setModeInterne] = useState('semaine') // la semaine est la vue par défaut
  const [jourVise, setJourVise] = useState(() => jourInitial || isoLocal(new Date()))

  const mode = modeControle || modeInterne
  const changerMode = (id) => {
    if (!modeControle) setModeInterne(id)
    onChangerMode?.(id)
  }

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

  // ── Le jour visé reste toujours dans le mois affiché ────────────────
  const jourSel = useMemo(() => {
    const p = parseIso(jourVise)
    if (p && p.y === annee && p.m === mois) return jourVise
    const aujourdhui = isoLocal(new Date())
    const pa = parseIso(aujourdhui)
    if (pa && pa.y === annee && pa.m === mois) return aujourdhui
    return `${annee}-${pad2(mois + 1)}-01`
  }, [jourVise, annee, mois])

  const jours = useMemo(
    () => joursDeLaPeriode(mode, { annee, mois, jourIso: jourSel }),
    [mode, annee, mois, jourSel]
  )
  const nbJours = jours.length
  const largeurJour = largeurJourDe(mode)
  const aujourdhuiIso = isoLocal(new Date())
  const indexAujourdhui = jours.findIndex((j) => j.iso === aujourdhuiIso)
  const titre = mode === 'mois' ? nomMois(annee, mois) : titrePeriode(mode, jours, { annee, mois })

  const deplacer = (delta) => {
    const suivant = deplacerPeriode(mode, { annee, mois, jourIso: jourSel }, delta)
    if (mode === 'mois') onChangerMois?.(delta)
    else setJourVise(suivant.jourIso)
  }

  // ── Construction des lignes : un employé = une ligne ────────────────
  const lignes = useMemo(() => {
    const parEmploye = new Map()
    employes.forEach((e) => parEmploye.set(e.id, { employe: e, segments: [] }))

    absences.forEach((a) => {
      const motifId = a.reason || 'autre'
      if (motifsMasques.has(motifId)) return
      const seg = segmentSurJours(a.start_date, a.end_date, jours)
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
  }, [employes, absences, jours, motifsMasques, masquerSansAbsence])

  // ── Récapitulatif de la période affichée ────────────────────────────
  const stats = useMemo(() => {
    const vus = new Map()
    let journees = 0

    lignes.forEach((l) => {
      const feriers = getHolidaySet(l.employe.enterprise_id)
      l.segments.forEach((seg) => {
        const a = seg.absence
        if (!vus.has(a.id)) vus.set(a.id, a)
        journees += compterJoursOuvres(jours[seg.debut].iso, jours[seg.fin].iso, feriers, a.count_holidays_as_leave)
      })
    })

    const liste = [...vus.values()]
    return {
      total: liste.length,
      enAttente: liste.filter((a) => a.status === 'en_attente').length,
      refusees: liste.filter((a) => a.status === 'refuse').length,
      journees,
    }
  }, [lignes, jours, getHolidaySet])

  // ── Mode « jour » : qui est absent, qui est là ──────────────────────
  const absentsDuJour = useMemo(() => {
    if (mode !== 'jour') return []
    return lignes
      .filter((l) => l.segments.length > 0)
      .map((l) => ({
        employe: l.employe,
        absences: l.segments.map((s) => s.absence),
      }))
  }, [mode, lignes])

  const presentsDuJour = useMemo(
    () => (mode === 'jour' ? lignes.filter((l) => l.segments.length === 0).map((l) => l.employe) : []),
    [mode, lignes]
  )

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

  const libellePeriode =
    mode === 'jour' ? "cette journée" : mode === 'semaine' ? 'cette semaine' : 'ce mois'

  // ── Rendu ───────────────────────────────────────────────────────────
  return (
    <div className="abs-cal" data-theme={darkMode ? 'dark' : 'light'} data-mode={mode}>
      <style>{`
        .abs-cal-scroll::-webkit-scrollbar { height: 10px; }
        .abs-cal-scroll::-webkit-scrollbar-thumb { background: rgba(245,158,11,.28); border-radius: 8px; }
        .abs-cal-barre:hover { filter: brightness(1.15); }
        .abs-cal-barre:focus-visible { outline: 2px solid #F59E0B; outline-offset: 1px; }
      `}</style>

      {/* ═══ Barre d'outils ═══ */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => deplacer(-1)} aria-label="Période précédente" style={boutonNav(theme)}>
            <ChevronLeft size={18} />
          </button>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: theme.texte, minWidth: 168, textAlign: 'center' }}>
            {titre}
          </h3>
          <button onClick={() => deplacer(1)} aria-label="Période suivante" style={boutonNav(theme)}>
            <ChevronRight size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Sélecteur de mode : Jour · Semaine · Mois */}
          <div
            role="group"
            aria-label="Mode d'affichage du calendrier"
            data-testid="abs-cal-modes"
            style={{
              display: 'inline-flex', padding: 3, gap: 3, borderRadius: 12,
              border: `1px solid ${theme.bordure}`, background: theme.pastille,
            }}
          >
            {MODES.map((m) => {
              const actif = mode === m.id
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => changerMode(m.id)}
                  aria-pressed={actif}
                  data-testid={`abs-cal-mode-${m.id}`}
                  style={{
                    padding: '7px 13px', borderRadius: 9, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                    fontFamily: 'inherit', border: 'none',
                    background: actif ? 'linear-gradient(135deg, #C25E28, #8C3418)' : 'transparent',
                    color: actif ? '#FFF5E6' : theme.texteDoux,
                  }}
                >
                  {m.label}
                </button>
              )
            })}
          </div>

          <button
            type="button"
            onClick={() => setMotifsMasques(new Set())}
            disabled={motifsMasques.size === 0}
            data-testid="abs-cal-tous-motifs"
            title={motifsMasques.size === 0 ? 'Tous les motifs sont affichés' : `Réafficher les ${motifsMasques.size} motifs masqués`}
            style={{
              ...boutonDoux(theme),
              opacity: motifsMasques.size === 0 ? 0.45 : 1,
              cursor: motifsMasques.size === 0 ? 'default' : 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 7,
            }}
          >
            <span aria-hidden="true" style={{
              width: 8, height: 8, borderRadius: '50%',
              background: motifsMasques.size === 0 ? '#10B981' : '#F59E0B',
              display: 'inline-block',
            }} />
            Tous les motifs
            {motifsMasques.size > 0 && (
              <span style={{
                fontSize: 10, fontWeight: 800, color: '#F59E0B',
                background: 'rgba(245,158,11,0.14)', border: '1px solid rgba(245,158,11,0.35)',
                padding: '1px 6px', borderRadius: 999,
              }}>
                {motifsMasques.size}
              </span>
            )}
          </button>

          <button
            type="button"
            role="switch"
            aria-checked={masquerSansAbsence}
            onClick={() => setMasquerSansAbsence((v) => !v)}
            data-testid="abs-cal-masquer-sans-absence"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 9,
              padding: '7px 12px', borderRadius: 999, cursor: 'pointer',
              fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
              background: masquerSansAbsence ? 'rgba(245,158,11,0.12)' : 'transparent',
              border: `1px solid ${masquerSansAbsence ? 'rgba(245,158,11,0.45)' : theme.bordure}`,
              color: masquerSansAbsence ? '#F59E0B' : theme.texteDoux,
            }}
          >
            <span aria-hidden="true" style={{
              width: 26, height: 15, borderRadius: 999, flexShrink: 0, position: 'relative',
              background: masquerSansAbsence ? '#F59E0B' : (darkMode ? 'rgba(255,255,255,0.14)' : 'rgba(29,23,19,0.18)'),
              transition: 'background .2s ease',
            }}>
              <span style={{
                position: 'absolute', top: 2, left: masquerSansAbsence ? 13 : 2,
                width: 11, height: 11, borderRadius: '50%', background: '#FFF5E6',
                transition: 'left .2s ease',
              }} />
            </span>
            Masquer les employés sans absence
          </button>
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
        <div style={{ minWidth: LARGEUR_EMPLOYE + nbJours * largeurJour }}>

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
                  <div key={j.iso} data-jour={j.iso} style={{
                    flex: 1, minWidth: 0, textAlign: 'center', padding: '7px 0 6px',
                    background: estAujourdhui ? 'rgba(245,158,11,0.10)' : 'transparent',
                    borderLeft: `1px solid ${theme.grille}`,
                  }}>
                    <div style={{ fontSize: 10, color: theme.texteDoux, textTransform: 'uppercase' }}>
                      {mode === 'jour' ? nomJourLong(j.iso).split(' ')[0] : JOURS_SEMAINE[j.weekday - 1]}
                    </div>
                    <div style={{
                      fontSize: mode === 'mois' ? 13 : 15,
                      fontWeight: estAujourdhui ? 800 : 600,
                      color: estAujourdhui ? '#F59E0B' : theme.texte,
                    }}>
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

                {/* Piste de la période — zone de dépôt du glisser-déposer */}
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
                    const st = styleBarreAbsence(seg.absence, listePour(seg.absence))
                    const a = seg.absence
                    const titreBarre = [
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
                        title={titreBarre}
                        aria-label={titreBarre}
                        data-testid="abs-cal-barre"
                        data-statut={a.status}
                        style={{
                          position: 'absolute',
                          left: `calc(${(seg.debut / nbJours) * 100}% + 2px)`,
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

      {/* ═══ Mode « jour » : la feuille du jour ═══ */}
      {mode === 'jour' && (
        <div
          data-testid="abs-cal-feuille-jour"
          style={{
            marginTop: 14, padding: 16, borderRadius: 16,
            border: `1px solid ${theme.bordure}`, background: theme.carte,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <CalendarDays size={16} style={{ color: '#F59E0B' }} />
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: theme.texte, textTransform: 'capitalize' }}>
              {nomJourLong(jours[0]?.iso)}
            </h4>
            <span style={{ fontSize: 12, color: theme.texteDoux }}>
              · {absentsDuJour.length} absent{absentsDuJour.length > 1 ? 's' : ''} sur {lignes.length} employé{lignes.length > 1 ? 's' : ''}
            </span>
          </div>

          {absentsDuJour.length === 0 && (
            <p style={{ margin: 0, fontSize: 13, color: theme.texteDoux }}>
              Personne n'est absent : effectif complet.
            </p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {absentsDuJour.map(({ employe, absences: liste }) => (
              <div key={employe.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                padding: '10px 12px', borderRadius: 12,
                border: `1px solid ${theme.bordure}`, background: theme.pastille,
              }}>
                {employe.photo_url ? (
                  <img src={employe.photo_url} alt="" style={{
                    width: 38, height: 38, borderRadius: 11, objectFit: 'cover', flexShrink: 0,
                    border: `1px solid ${theme.bordure}`,
                  }} />
                ) : (
                  <div style={{
                    width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                    background: theme.pastille, border: `1px solid ${theme.bordure}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700, color: theme.texte,
                  }}>
                    {initialesDe(employe.first_name, employe.last_name)}
                  </div>
                )}
                <div style={{ minWidth: 150 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: theme.texte }}>
                    {employe.first_name} {employe.last_name}
                  </p>
                  <span style={{ fontSize: 11, color: theme.texteDoux }}>{employe.matricule || '—'}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: 1 }}>
                  {liste.map((a) => {
                    const st = styleBarreAbsence(a, listePour(a))
                    return (
                      <button
                        key={a.id}
                        onClick={() => setAbsenceActive(a)}
                        style={{
                          padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
                          fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
                          background: st.fond, color: st.texte,
                          border: st.pointillee ? `1px dashed ${st.bordure}` : `1px solid ${st.bordure}`,
                          textDecoration: st.barree ? 'line-through' : 'none',
                        }}
                      >
                        {st.motif.emoji} {st.motif.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {presentsDuJour.length > 0 && (
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: theme.texteDoux }}>Présents ({presentsDuJour.length}) :</span>
              {presentsDuJour.map((e) => (
                <span key={e.id} title={`${e.first_name} ${e.last_name}`} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '4px 10px 4px 4px', borderRadius: 999,
                  border: `1px solid ${theme.bordure}`, background: theme.pastille,
                  fontSize: 11, color: theme.texte,
                }}>
                  {e.photo_url ? (
                    <img src={e.photo_url} alt="" style={{ width: 22, height: 22, borderRadius: 7, objectFit: 'cover' }} />
                  ) : (
                    <span style={{
                      width: 22, height: 22, borderRadius: 7, background: 'rgba(16,185,129,0.15)',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, fontWeight: 800, color: '#10B981',
                    }}>
                      {initialesDe(e.first_name, e.last_name)}
                    </span>
                  )}
                  {e.first_name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

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
        <span>‹ › à cheval sur la période</span>
        <span>📎 justificatif joint</span>
        <span>⚡ conflit de pointage</span>
      </div>

      {/* ═══ Récapitulatif ═══ */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 12, padding: '11px 16px',
        border: `1px solid ${theme.bordure}`, borderRadius: 12, background: theme.carte,
        fontSize: 12, color: theme.texteDoux,
      }}>
        <span><b style={{ color: theme.texte }}>{stats.total}</b> absence{stats.total > 1 ? 's' : ''} {libellePeriode}</span>
        <span style={{ color: stats.enAttente ? '#F59E0B' : theme.texteDoux }}>
          ⏳ <b>{stats.enAttente}</b> en attente
        </span>
        <span style={{ color: stats.refusees ? '#EF4444' : theme.texteDoux }}>
          ❌ <b>{stats.refusees}</b> refusée{stats.refusees > 1 ? 's' : ''}
        </span>
        <span>
          📆 <b style={{ color: theme.texte }}>{stats.journees}</b> jour{stats.journees > 1 ? 's' : ''} compté{stats.journees > 1 ? 's' : ''} {libellePeriode}
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
          onSupprimer={(a) => { onSupprimer?.(a); setAbsenceActive(null) }}
        />
      )}
    </div>
  )
}

/** Quel jour de la période se trouve sous le pointeur ? (0-based, borné) */
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
