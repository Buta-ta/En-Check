// ═══════════════════════════════════════════════════════════
// 📊 ABSENCES — CARTES DE SYNTHÈSE (KPI)
//
// Une carte = une question que se pose un RH en ouvrant la page :
// qui manque aujourd'hui, combien ce mois, quoi traiter maintenant.
//
// Deux cartes portent une jauge (taux d'absence, congés restants),
// une carte montre les photos des absents du jour, et les cartes
// « à traiter » sont cliquables : elles mènent droit au bon filtre.
//
// Composant pur : pas de Supabase, pas d'effet, pas de suppression.
// ═══════════════════════════════════════════════════════════

import { useMemo } from 'react'
import {
  UserRoundX, CalendarRange, Hourglass, AlertTriangle, Activity, Palmtree,
} from 'lucide-react'
import { isoLocal, estJourOuvre } from '../services/absencesCalendrier'

const pad2 = (n) => String(n).padStart(2, '0')

const jourDe = (iso) => (typeof iso === 'string' ? iso.slice(0, 10) : null)

const initialesDe = (prenom, nom) =>
  `${prenom || ''} ${nom || ''}`.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?'

/** Une absence couvre-t-elle la journée `iso` ? (les refusées ne comptent pas) */
function couvreJour(absence, iso) {
  const debut = jourDe(absence.start_date)
  const fin = jourDe(absence.end_date) || debut
  if (!debut) return false
  return debut <= iso && iso <= fin
}

// ── Une photo ronde, avec repli sur les initiales ─────────────────────
export function Avatar({ prenom, nom, photo, taille = 26, bordure = 'rgba(245,158,11,0.35)' }) {
  if (photo) {
    return (
      <img
        src={photo}
        alt=""
        data-testid="abs-kpi-avatar"
        style={{
          width: taille, height: taille, borderRadius: '50%', objectFit: 'cover',
          flexShrink: 0, border: `1.5px solid ${bordure}`, background: 'rgba(0,0,0,0.2)',
        }}
      />
    )
  }
  return (
    <span
      data-testid="abs-kpi-avatar"
      style={{
        width: taille, height: taille, borderRadius: '50%', flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        border: `1.5px solid ${bordure}`, background: 'rgba(245,158,11,0.14)',
        color: 'var(--abs-amber)', fontSize: Math.max(9, Math.round(taille * 0.36)), fontWeight: 800,
      }}
    >
      {initialesDe(prenom, nom)}
    </span>
  )
}

// ── Une tuile compacte ───────────────────────────────────────────────
// Format bandeau : icône + chiffre sur une ligne, libellé dessous,
// jauge en bas. Le détail (« sur 3 employés · 67 % ») part dans une
// infobulle : l'information reste disponible sans manger de hauteur.
function Carte({ testId, icone: Icone, couleur, valeur, suffixe, label, precision, jauge, action, onClick, children, darkMode = true }) {
  // Composant icône reçu en prop : on le garde dans une variable locale
  // (convention du projet : une capitale = jamais signalée comme inutilisée)
  const IconeKpi = Icone
  const carte = darkMode ? 'rgba(29,23,19,0.82)' : '#FFFFFF'
  const bord = darkMode ? 'rgba(245,158,11,0.16)' : 'rgba(29,23,19,0.10)'
  const texte = darkMode ? '#F5F2EB' : '#1D1713'
  const doux = darkMode ? 'rgba(245,242,235,0.55)' : 'rgba(29,23,19,0.55)'

  const contenu = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span style={{
          width: 26, height: 26, borderRadius: 9, flexShrink: 0,
          background: `${couleur}1F`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <IconeKpi size={14} color={couleur} />
        </span>

        <span style={{ fontSize: 20, fontWeight: 800, color: texte, lineHeight: 1, flexShrink: 0 }}>
          {valeur}
          {suffixe && <span style={{ fontSize: 12, fontWeight: 700, color: doux, marginLeft: 1 }}>{suffixe}</span>}
        </span>

        {/* Les avatars (absents du jour) seglissent à droite de la ligne */}
        {children && <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center' }}>{children}</span>}

        {action && (
          <span style={{
            marginLeft: children ? 6 : 'auto', flexShrink: 0,
            fontSize: 9.5, fontWeight: 700, color: couleur,
            background: `${couleur}18`, border: `1px solid ${couleur}33`,
            padding: '2px 7px', borderRadius: 999, whiteSpace: 'nowrap',
          }}>
            {action}
          </span>
        )}
      </div>

      <p style={{
        margin: '5px 0 0', fontSize: 10.5, fontWeight: 600, color: doux,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {label}
      </p>

      {jauge !== undefined && jauge !== null && (
        <div
          data-testid="abs-kpi-jauge"
          role="progressbar"
          aria-valuenow={Math.round(jauge)}
          aria-valuemin={0}
          aria-valuemax={100}
          style={{
            marginTop: 7, height: 3, borderRadius: 999, overflow: 'hidden',
            background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(29,23,19,0.07)',
          }}
        >
          <div style={{
            width: `${Math.max(0, Math.min(100, jauge))}%`, height: '100%', borderRadius: 999,
            background: `linear-gradient(90deg, ${couleur}, ${couleur}AA)`,
          }} />
        </div>
      )}
    </>
  )

  const commun = {
    'data-testid': testId,
    title: precision || undefined,
    style: {
      background: carte, border: `1px solid ${bord}`, borderRadius: 12, padding: '10px 12px',
      display: 'flex', flexDirection: 'column', minWidth: 0,
    },
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="abs-kpi abs-kpi-cliquable"
        style={{ ...commun.style, textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer' }}
        data-testid={testId}
        title={precision || undefined}
      >
        {contenu}
      </button>
    )
  }

  return (
    <div className="abs-kpi" data-testid={testId} title={precision || undefined} style={commun.style}>
      {contenu}
    </div>
  )
}

export default function AbsencesKpiCards({
  absences = [],
  employes = [],
  conflitsEnAttente = 0,
  joursPrisParEmploye = {},
  plafondConges = 30,
  darkMode = true,
  onVoirConflits,
  onVoirDemandes,
}) {
  const mesures = useMemo(() => {
    const aujourdhui = isoLocal(new Date())
    const actifs = employes.length
    const maintenant = new Date()
    const annee = maintenant.getFullYear()
    const mois = maintenant.getMonth()

    // ── Qui manque aujourd'hui ───────────────────────────────────────
    const absents = []
    const ids = new Set()
    absences.forEach((a) => {
      if ((a.status || 'approuve') === 'refuse') return
      if (!couvreJour(a, aujourdhui)) return
      const e = employes.find((x) => x.id === a.employee_id) || a.employes
      if (!e || ids.has(e.id)) return
      ids.add(e.id)
      absents.push(e)
    })

    // ── Ce mois : combien d'absences, combien de jours ───────────────
    const duMois = absences.filter((a) => {
      const debut = jourDe(a.start_date)
      return debut && `${debut.slice(0, 7)}` === `${annee}-${pad2(mois + 1)}`
    })

    const joursDecomptes = duMois.reduce((total, a) => {
      const debut = jourDe(a.start_date)
      const fin = jourDe(a.end_date) || debut
      let compte = 0
      let curseur = debut
      let garde = 0
      while (curseur <= fin && garde < 400) {
        if (a.count_holidays_as_leave || estJourOuvre(curseur)) compte += 1
        const d = new Date(`${curseur}T12:00:00Z`)
        d.setUTCDate(d.getUTCDate() + 1)
        curseur = d.toISOString().slice(0, 10)
        garde += 1
      }
      return total + compte
    }, 0)

    // ── Taux d'absence du mois : jours perdus / jours ouvrés possibles
    const total = new Date(annee, mois + 1, 0).getDate()
    let jourOuvresDuMois = 0
    for (let d = 1; d <= total; d += 1) {
      if (estJourOuvre(`${annee}-${pad2(mois + 1)}-${pad2(d)}`)) jourOuvresDuMois += 1
    }
    const capacite = Math.max(1, actifs * jourOuvresDuMois)
    const tauxAbsence = Math.round((joursDecomptes / capacite) * 1000) / 10

    // ── Congés : ce qu'il reste en moyenne par employé ───────────────
    const plafond = plafondConges || 30
    const restants = employes.map((e) => Math.max(0, plafond - (joursPrisParEmploye[e.id] ?? 0)))
    const soldeMoyen = restants.length
      ? Math.round((restants.reduce((s, n) => s + n, 0) / restants.length) * 10) / 10
      : plafond
    const tauxConges = Math.round((soldeMoyen / plafond) * 1000) / 10

    const enAttente = absences.filter((a) => (a.status || 'approuve') === 'en_attente').length

    return {
      aujourdhui,
      effectif: actifs,
      absents,
      taux: actifs ? Math.round((absents.length / actifs) * 100) : 0,
      duMois: duMois.length,
      joursDecomptes,
      tauxAbsence,
      soldeMoyen,
      tauxConges,
      plafond,
      enAttente,
      enCours: absences.filter((a) => {
        const debut = jourDe(a.start_date)
        const fin = jourDe(a.end_date) || debut
        return debut <= aujourdhui && aujourdhui <= fin && (a.status || 'approuve') !== 'refuse'
      }).length,
    }
  }, [absences, employes, joursPrisParEmploye, plafondConges])

  const apercu = mesures.absents.slice(0, 4)
  const enPlus = mesures.absents.length - apercu.length

  return (
    <div
      data-testid="abs-kpi-grille"
      className="abs-kpi-grille"
      title={`Chiffres calculés sur les absences chargées · aujourd'hui = ${mesures.aujourdhui}`}
      style={{
        display: 'grid',
        // assez étroite pour tenir sur UNE seule ligne : le calendrier
        // reste visible sans descendre la page
        gridTemplateColumns: 'repeat(auto-fit, minmax(148px, 1fr))',
        gap: 10,
        marginBottom: 14,
      }}
    >
      <style>{`
        .abs-kpi { transition: transform .25s ease, border-color .25s ease; }
        .abs-kpi-cliquable:hover { transform: translateY(-2px); border-color: rgba(245,158,11,0.42) !important; }
        .abs-kpi-cliquable:focus-visible { outline: 2px solid #F59E0B; outline-offset: 2px; }
        /* Écran étroit : trois tuiles par ligne, jamais plus de deux rangs */
        @media (max-width: 900px) {
          .abs-kpi-grille { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
        }
        @media (max-width: 560px) {
          .abs-kpi-grille { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
      `}</style>

      {/* 1. Qui manque aujourd'hui — avec les photos */}
      <Carte
        testId="abs-kpi-absents"
        icone={UserRoundX}
        couleur="var(--abs-amber)"
        valeur={mesures.absents.length}
        label="Absents aujourd'hui"
        precision={`sur ${mesures.effectif} employé${mesures.effectif > 1 ? 's' : ''} · ${mesures.taux} % de l'effectif`}
        darkMode={darkMode}
      >
        {apercu.length > 0 && (
          <>
            {apercu.map((e, i) => (
              <span key={e.id} style={{ marginLeft: i === 0 ? 0 : -7, display: 'inline-flex' }}>
                <Avatar prenom={e.first_name} nom={e.last_name} photo={e.photo_url} taille={22} />
              </span>
            ))}
            {enPlus > 0 && (
              <span style={{
                marginLeft: -7, width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(245,158,11,0.18)', border: '1.5px solid rgba(245,158,11,0.35)',
                color: 'var(--abs-amber)', fontSize: 9, fontWeight: 800,
              }}>
                +{enPlus}
              </span>
            )}
          </>
        )}
      </Carte>

      {/* 2. Le mois en cours */}
      <Carte
        testId="abs-kpi-mois"
        icone={CalendarRange}
        couleur="#3B82F6"
        valeur={mesures.duMois}
        label="Absences ce mois-ci"
        precision={`${mesures.joursDecomptes} jour${mesures.joursDecomptes > 1 ? 's' : ''} décompté${mesures.joursDecomptes > 1 ? 's' : ''}`}
        darkMode={darkMode}
      />

      {/* 3. Taux d'absence */}
      <Carte
        testId="abs-kpi-taux"
        icone={Activity}
        couleur="#8B5CF6"
        valeur={mesures.tauxAbsence}
        suffixe="%"
        label="Taux d'absence du mois"
        precision="jours d'absence / jours ouvrés de l'effectif"
        jauge={mesures.tauxAbsence}
        darkMode={darkMode}
      />

      {/* 4. Congés restants */}
      <Carte
        testId="abs-kpi-conges"
        icone={Palmtree}
        couleur="var(--abs-emerald)"
        valeur={mesures.soldeMoyen}
        suffixe="j"
        label="Congés restants (moyenne)"
        precision={`plafond ${mesures.plafond} jours · ${mesures.tauxConges} % encore disponible`}
        jauge={mesures.tauxConges}
        darkMode={darkMode}
      />

      {/* 5. À traiter : demandes en attente */}
      <Carte
        testId="abs-kpi-attente"
        icone={Hourglass}
        couleur="var(--abs-amber)"
        valeur={mesures.enAttente}
        label="Demandes en attente"
        precision={mesures.enAttente ? 'à valider ou à refuser' : 'aucune demande en souffrance'}
        action={mesures.enAttente ? 'Traiter' : undefined}
        onClick={onVoirDemandes}
        darkMode={darkMode}
      />

      {/* 6. À traiter : conflits */}
      <Carte
        testId="abs-kpi-conflits"
        icone={AlertTriangle}
        couleur={conflitsEnAttente ? 'var(--abs-coral)' : 'var(--abs-text-faint)'}
        valeur={conflitsEnAttente}
        label="Conflits absence / pointage"
        precision={conflitsEnAttente ? 'un pointage sur une absence déclarée' : 'aucun conflit à arbitrer'}
        action={conflitsEnAttente ? 'Arbitrer' : undefined}
        onClick={onVoirConflits}
        darkMode={darkMode}
      />

    </div>
  )
}
