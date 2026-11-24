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
  UserRoundX, CalendarRange, Hourglass, AlertTriangle, Activity, Palmtree, ArrowRight,
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
// Liseré d'ambre de la page, mêlé au fond : un seul jeton, pas un `rgba()` recopié.
export function Avatar({ prenom, nom, photo, taille = 26, bordure = 'color-mix(in srgb, var(--abs-amber) 35%, transparent)' }) {
  if (photo) {
    return (
      <img
        src={photo}
        alt=""
        data-testid="abs-kpi-avatar"
        style={{
          width: taille, height: taille, borderRadius: '50%', objectFit: 'cover',
          flexShrink: 0, border: `1.5px solid ${bordure}`, background: 'color-mix(in srgb, var(--abs-bg) 80%, transparent)',
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
        border: `1.5px solid ${bordure}`, background: 'color-mix(in srgb, var(--abs-amber) 14%, transparent)',
        color: 'var(--abs-amber)', fontSize: Math.max(9, Math.round(taille * 0.36)), fontWeight: 800,
      }}
    >
      {initialesDe(prenom, nom)}
    </span>
  )
}

// ── Une lanière de compteur ───────────────────────────────────────────
// Absences, 24/11/2026 (maquette `absences-section-bogolan-cadre.png`) : plus
// six cartes égales posées en rang, mais six lanières séparées d'un filet,
// inégales en poids — quatre renseignent, deux tirent (elles mènent à l'action).
// Le détail (« sur 3 employés · 67 % ») reste en infobulle.
//
// Les teintes viennent toutes des jetons `--abs-*` de la page : ils portent déjà
// le thème clair/sombre, le composant n'a donc plus besoin de `darkMode` — et un
// `couleur}1F`concaténé sur un `var(--…)` ne peignait rien du tout (CSS invalide),
// c'est `color-mix` qui fait le travail maintenant.
function Carte({ testId, icone: Icone, couleur, valeur, suffixe, label, precision, jauge, action, onClick, couture, children }) {
  // Composant icône reçu en prop : on le garde dans une variable locale
  // (convention du projet : une capitale = jamais signalée comme inutilisée)
  const IconeKpi = Icone
  const texte = 'var(--abs-text)'
  const doux = 'var(--abs-text-soft)'

  const contenu = (
    <>
      <p style={{
        margin: 0, fontSize: 9.5, fontWeight: 700, letterSpacing: '.08em',
        textTransform: 'uppercase', color: doux, fontFamily: 'IBM Plex Mono, monospace',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {label}
      </p>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4, minWidth: 0 }}>
        <span style={{ fontSize: 20, fontWeight: 800, color: texte, lineHeight: 1, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
          {valeur}
          {suffixe && <span style={{ fontSize: 12, fontWeight: 700, color: doux, marginLeft: 1 }}>{suffixe}</span>}
        </span>

        <span style={{
          width: 20, height: 20, borderRadius: 4, flexShrink: 0, marginLeft: 'auto',
          background: `color-mix(in srgb, ${couleur} 14%, transparent)`,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <IconeKpi size={12} color={couleur} />
        </span>

        {/* Les avatars (absents du jour) seglissent à droite de la ligne */}
        {children && <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center' }}>{children}</span>}

        {/* La poche des deux lanières qui tirent : un onglet d'argile cousu au
            bout de la lanière, avec la flèche du voyage (voir / traiter). */}
        {action && (
          <span style={{
            marginLeft: 'auto', flexShrink: 0, alignSelf: 'center',
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 9.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase',
            color: 'var(--abs-bg-elevated)', background: couleur,
            padding: '3px 7px 3px 9px', borderRadius: 2, whiteSpace: 'nowrap',
            clipPath: 'polygon(5px 0, 100% 0, 100% 100%, 0 100%, 0 5px)',
          }}>
            {action}
            <ArrowRight size={11} />
          </span>
        )}
      </div>

      {/* La couture en zigzag de la lanière en conflit : l'alerte ne se dit plus
          par un bandeau plein (c'était la bannière ambre), mais par un fil. */}
      {couture === 'zigzag' && (
        <div
          aria-hidden="true"
          data-testid="abs-kpi-couture"
          style={{
            marginTop: 6, height: 5,
            backgroundImage: 'repeating-linear-gradient(135deg, var(--abs-coral) 0 2px, transparent 2px 5px)',
          }}
        />
      )}

      {jauge !== undefined && jauge !== null && (
        <div
          data-testid="abs-kpi-jauge"
          role="progressbar"
          aria-valuenow={Math.round(jauge)}
          aria-valuemin={0}
          aria-valuemax={100}
          style={{
            marginTop: 7, height: 3, overflow: 'hidden',
            background: 'color-mix(in srgb, var(--abs-text) 8%, transparent)',
          }}
        >
          <div style={{
            width: `${Math.max(0, Math.min(100, jauge))}%`, height: '100%',
            background: couleur,
          }} />
        </div>
      )}
    </>
  )

  // Une lanière, pas une carte : pas de fond, pas de bordure autour, mais un
  // filet entre les voisines — posé par la grille, jamais sur la première.
  const commun = {
    'data-testid': testId,
    title: precision || undefined,
    style: {
      padding: '2px 12px', display: 'flex', flexDirection: 'column', minWidth: 0,
      background: 'transparent',
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
        // Six lanières sur UNE ligne, inégales en poids : les deux de droite
        // portent une poche et demandent plus de place que les quatre autres.
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr)) minmax(0, 1.15fr) minmax(0, 1.35fr)',
        gap: 0,
        marginBottom: 14,
      }}
    >
      <style>{`
        /* Le filet entre les lanières, pas une bordure autour de chacune :
           c'est la cloison d'un même tissu, pas six papiers collés. */
        .abs-kpi + .abs-kpi { border-left: 1px solid var(--abs-border); }
        .abs-kpi { transition: background-color .2s ease; }
        .abs-kpi-cliquable:hover { background-color: color-mix(in srgb, var(--abs-amber) 8%, transparent) !important; }
        .abs-kpi-cliquable:focus-visible { outline: 2px solid var(--abs-amber); outline-offset: -2px; }
        /* Écran étroit : trois lanières par ligne, puis deux — les cloisons
           suivent la grille, jamais un rang de filets orphelins. */
        @media (max-width: 1100px) {
          .abs-kpi-grille { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
          .abs-kpi:nth-child(4) { border-left: 0; }
        }
        @media (max-width: 900px) {
          .abs-kpi-grille { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
          .abs-kpi:nth-child(4) { border-left: 0; }
        }
        @media (max-width: 560px) {
          .abs-kpi-grille { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .abs-kpi:nth-child(3), .abs-kpi:nth-child(5) { border-left: 0; }
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
                background: 'color-mix(in srgb, var(--abs-amber) 18%, transparent)',
                border: '1.5px solid color-mix(in srgb, var(--abs-amber) 35%, transparent)',
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
        couleur="var(--abs-indigo)"
        valeur={mesures.duMois}
        label="Absences ce mois-ci"
        precision={`${mesures.joursDecomptes} jour${mesures.joursDecomptes > 1 ? 's' : ''} décompté${mesures.joursDecomptes > 1 ? 's' : ''}`}
      />

      {/* 3. Taux d'absence */}
      <Carte
        testId="abs-kpi-taux"
        icone={Activity}
        couleur="var(--abs-violet)"
        valeur={mesures.tauxAbsence}
        suffixe="%"
        label="Taux d'absence du mois"
        precision="jours d'absence / jours ouvrés de l'effectif"
        jauge={mesures.tauxAbsence}
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
        couture={conflitsEnAttente ? 'zigzag' : undefined}
        onClick={onVoirConflits}
      />

    </div>
  )
}
