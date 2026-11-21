// ═══════════════════════════════════════════════════════════
// 👤 FICHE EMPLOYÉE — /employes/:id — REFONTE BENTO (17/11)
//
// Une page = une personne. Maquette validée le 17/11 :
// bento sombre kente, portrait héro + contact en vue
// (WhatsApp / Appeler), activité, salaire, rythme, présence,
// fil d'activité et tâches.
//
// Règles de la maison :
//  · aucune donnée inventée : ce qui manque s'affiche « — »,
//    jamais un 0 qui ferait foi ;
//  · les dates et heures se jugent au fuseau de l'entreprise ;
//  · le mot « absent » n'existe qu'après la fin du poste (P0) ;
//  · la modale de l'annuaire reste le GESTE MODIFIER ; cette
//    page est le GESTE CONSULTER ;
//  · les graphiques sont des barres CSS à la main (recharts
//    reste réservé à la console analytique du dashboard).
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import EmployesLoadingScreen, { EMPLOYES_INTRO_MS } from '../components/EmployesLoadingScreen'
import { useTheme } from '../contexts/ThemeContext'
import FicheEmployeModal from '../components/FicheEmployeModal'
import BadgeEmploye from '../components/BadgeEmploye'
import { KenteWovenTapestrySvg } from '../components/AfroCulturalSvg'
import {
  AlertTriangle, ArrowLeft, CalendarRange, ChevronLeft, ChevronRight,
  Clock, Coffee, Globe, IdCard, LogIn, LogOut, Mail, Phone, QrCode,
  Timer, UserCog, UserRound,
} from 'lucide-react'
import {
  formaterHeureLocaleShort, heureLocaleVersUTC, jourLocal,
} from '../utils/timezoneUtils'
import { initialesDe } from '../utils/initiales'
import { construirePauses, estPauseReelleEffectuee } from '../services/pausesService'
import { __internal, calculateEmployeeHours } from '../services/hoursCalculator'
import { chargerBulletinsPeriode } from '../services/paiementBulletins'
import { chargerSeuilsPointage } from '../services/seuilsPointage'
import HolidayService from '../services/holidayService'
import { finPosteDepassee } from '../lib/etatPresence'
import {
  abreviationDevise,
  chipsJoursTravailles,
  construireFilActivite,
  echelleNice,
  etatPresenceDuJour,
  grillePresenceMois,
  joursAbsencesPeriode,
  joursAnciennete,
  joursPointesDuMois,
  joursPrevusDepuisPlans,
  libelleAnciennete,
  libelleMontant,
  libelleMontantCourt,
  lienAppel,
  lienWhatsApp,
  listeJoursInclusifs,
  pourcentageSiEchantillon,
  retardDuJour,
  resumerTaches,
  rythmePlanning,
  secondesVersHeures,
  serieBarresAnnee,
  serieBarresMois,
  serieSalaireAnnee,
  tendanceSalaire,
  totalSecondesSerie,
  totalSalaireAnnee,
} from '../lib/employee360'
import '../components/zoulou/zoulou.css'
import './Employee360.css'

const MOIS_AXE = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
const MOIS_COMPLETS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

// Le tracé des barres : hauteur du plot et du rang des étiquettes,
// en accord exact avec les variables de Employee360.css.
const H_PLOT = 140
const H_LIB = 18

const TYPE_FIL = {
  entree: { icone: LogIn, libelleCourt: 'Entrée' },
  sortie: { icone: LogOut, libelleCourt: 'Sortie' },
  pause_debut: { icone: Coffee, libelleCourt: 'Pause' },
  pause_fin: { icone: Coffee, libelleCourt: 'Reprise' },
  absence: { icone: CalendarRange, libelleCourt: 'Congé' },
}

function courtJour(jourISO) {
  const [a, m, j] = String(jourISO || '').split('-').map(Number)
  if (!a || !m || !j) return jourISO || ''
  return `${j} ${MOIS_COMPLETS[m - 1].slice(0, 3)}`
}

function libelleDureePauses(minutes) {
  if (!minutes || minutes <= 0) return null
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h && m) return `${h} h ${String(m).padStart(2, '0')}`
  if (h) return `${h} h`
  return `${m} min`
}

/** La pastille WhatsApp — lucide n'en a pas. */
function WhatsAppGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  )
}

/**
 * Un graphe en barres dessiné à la main : axe gradué, trame, pic
 * étiqueté. `colonnes` = [{ cle, col, valeur|null, estPic, tag,
 * estAujourdhui }] ; `echelle` = echelleNice(valeurMax).
 */
function GrapheBarres({ colonnes, echelle, libelleGraduation, ariaLabel, fine = false }) {
  return (
    <div className={`e360-chart${fine ? ' e360-chart--fine' : ''}`}>
      <div className="e360-chart-grads" aria-hidden="true">
        {echelle.graduations.map((g) => (
          <span key={`g-${g}`} style={{ bottom: `calc(${H_LIB}px + ${H_PLOT * (g / echelle.plafond)}px)` }}>
            {libelleGraduation(g)}
          </span>
        ))}
      </div>
      <div className="e360-chart-plot">
        <div className="e360-chart-lignes" aria-hidden="true">
          {echelle.graduations.slice(1).map((g) => (
            <span key={`l-${g}`} style={{ bottom: `${(g / echelle.plafond) * 100}%` }} />
          ))}
        </div>
        <div className="e360-chart-barres" role="img" aria-label={ariaLabel}>
          {colonnes.map((c) => {
            const hauteur = c.valeur == null ? 0 : Math.max(2, (c.valeur / echelle.plafond) * 100)
            return (
              <div key={c.cle} className={`e360-col${c.estAujourdhui ? ' is-aujourdhui' : ''}`}>
                <div className="e360-piste">
                  {c.valeur != null && (
                    <span
                      className={`e360-bar${c.estPic ? ' is-pic' : ''}`}
                      style={{ height: `${hauteur}%` }}
                    />
                  )}
                  {c.estPic && (
                    <span className="e360-tag" style={{ bottom: `calc(${hauteur}% + 5px)` }}>{c.tag}</span>
                  )}
                </div>
                <span className="e360-col-lib">{c.col}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// Les quatre groupes de requêtes de la fiche, dans l'ordre où ils rentrent.
export const ETAPES_CHARGEMENT_FICHE = [
  { id: 1, court: 'Identité', detail: 'Lecture du dossier du collaborateur…', requetes: ['fiche'], pct: 8 },
  { id: 2, court: 'Entreprise', detail: 'Repère de l’entreprise et des collègues…', requetes: ['entreprise', 'carrousel'], pct: 22 },
  {
    id: 3,
    court: 'Présence',
    detail: 'Pointages, absences, pauses, plannings et règles…',
    requetes: ['pointages', 'absences', 'pauses', 'horaires', 'plannings', 'feries', 'seuils'],
    pct: 60,
  },
  {
    id: 4,
    court: 'Paie et tâches',
    detail: 'Heures supplémentaires, bulletins et tâches…',
    requetes: ['heuresSup', 'bulletins', 'taches'],
    pct: 88,
  },
]

const NOMBRE_REQUETES_FICHE = ETAPES_CHARGEMENT_FICHE.reduce((n, g) => n + g.requetes.length, 0)

export default function Employee360() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [admin] = useState(() => {
    try { return JSON.parse(localStorage.getItem('admin') || 'null') } catch { return null }
  })

  const [employee, setEmployee] = useState(null)
  const [entreprise, setEntreprise] = useState(null)
  const [employesEnt, setEmployesEnt] = useState([])
  const [donnees, setDonnees] = useState(null)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [modalFiche, setModalFiche] = useState(false)
  const [badgeOuvert, setBadgeOuvert] = useState(false)
  const [periode, setPeriode] = useState('mois') // « mois » | « annee » — le sélecteur de l'activité
  const rechargementRef = useRef(0)

  // ── ce que l'écran de chargement raconte, en vraies requêtes ──
  // La fiche se paie 13 requêtes : 1 pour le collaborateur, 2 pour
  // l'entreprise et le carrousel, puis 10 en parallèle. Elles sont suivies une
  // par une ; une étape n'est franchie que quand TOUTES les requêtes du groupe
  // sont rentrées — la barre ne peut donc pas mentir.
  const [etapeChargement, setEtapeChargement] = useState(1)
  const [progressionChargement, setProgressionChargement] = useState(8)
  const [plancherFait, setPlancherFait] = useState(
    // Sous jsdom (tests), aucun plancher : la page doit se rendre tout de suite.
    () => typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent || ''),
  )
  const { darkMode } = useTheme()
  const tourRef = useRef(0)
  const dejaVueRef = useRef(false)
  const requetesRef = useRef(new Set())

  // Une requête qui rentre : on la note, on recalcule l'étape et le pourcentage.
  const suivre = useCallback((nom, promesse) => {
    const numeroDuTour = tourRef.current
    return Promise.resolve(promesse).then((resultat) => {
      const finies = requetesRef.current
      finies.add(nom)
      if (numeroDuTour !== tourRef.current) return resultat // un autre appel a démarré entre-temps
      setProgressionChargement(Math.min(95, Math.round(8 + (finies.size / NOMBRE_REQUETES_FICHE) * 87)))
      const groupeEnRetard = ETAPES_CHARGEMENT_FICHE.findIndex(
        (groupe) => !groupe.requetes.every((nomRequete) => finies.has(nomRequete)),
      )
      setEtapeChargement(groupeEnRetard === -1 ? 4 : groupeEnRetard + 1)
      return resultat
    })
  }, [])

  // ── chargement de la fiche ─────────────────────────────────
  const charger = useCallback(async (employeeArg, entrepriseArg) => {
    const numRechargement = ++rechargementRef.current
    const estFrais = () => numRechargement === rechargementRef.current
    const emp = employeeArg
    const ent = entrepriseArg
    const fuseau = ent?.timezone || 'UTC'

    try {
      // Les dates se vivent à l'heure de l'entreprise.
      const maintenant = new Date()
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: fuseau, year: 'numeric', month: '2-digit', day: '2-digit',
      }).formatToParts(maintenant)
      const get = (type) => parts.find((p) => p.type === type)?.value
      const dateDuJour = `${get('year')}-${get('month')}-${get('day')}`
      const debutMois = `${dateDuJour.slice(0, 7)}-01`
      const anneeDebut = `${dateDuJour.slice(0, 4)}-01-01`
      // Fenêtre du fil d'activité : le mois si besoin, sinon 14 jours.
      const moins13 = new Date(Date.now() - 13 * 86400000)
      const parts13 = new Intl.DateTimeFormat('en-CA', {
        timeZone: fuseau, year: 'numeric', month: '2-digit', day: '2-digit',
      }).formatToParts(moins13)
      const get13 = (type) => parts13.find((p) => p.type === type)?.value
      const moins13Jour = `${get13('year')}-${get13('month')}-${get13('day')}`
      const debutFil = debutMois < moins13Jour ? moins13Jour : debutMois

      // Les modules de l'entreprise (le super-admin voit toujours tout,
      // comme partout dans l'app — FeatureService).
      let estSuperAdmin = false
      try { estSuperAdmin = JSON.parse(localStorage.getItem('admin') || '{}')?.role === 'super_admin' } catch { /* rien */ }
      const modules = {
        heuresSup: estSuperAdmin || ent?.module_heures_supplementaires === true,
        fichesPaie: estSuperAdmin || ent?.module_fiches_paie === true,
        taches: estSuperAdmin || ent?.module_taches === true,
      }

      const debutAnneeInstante = heureLocaleVersUTC(anneeDebut, 0, 0, 0, fuseau)
      const finInstante = heureLocaleVersUTC(dateDuJour, 23, 59, 59, fuseau)
      // Garde-fou : un filtre invalide enverrait la chaîne « null » à
      // PostgREST et casserait toute la requête — on échoue proprement.
      if (!debutAnneeInstante || !finInstante) throw new Error('Période de lecture invalide')

      const [attRes, absRes, pausesRes, affectRes, grillesRes, seuilsRes, feriesRes, heuresRes, bulletinsRes, tachesRes] = await Promise.all([
suivre('pointages',

          // L'année entière, colonnes « strictes » : le fil en garde la
          // fenêtre, l'activité détaillée en garde l'historique.
          supabase
            .from('attendances')
            .select('id, check_time, check_type, is_auto_closed, method, anomalie, estimation_validee_le, estimation_remplacee_le, estimation_niveau, estimation_confiance')
            .eq('employee_id', emp.id)
            .gte('check_time', debutAnneeInstante)
            .lte('check_time', finInstante)
            .order('check_time', { ascending: true })
),
suivre('absences',

          supabase
            .from('absences')
            .select('id, start_date, end_date, reason')
            .eq('employee_id', emp.id)
            .gte('start_date', anneeDebut)
            .lte('end_date', dateDuJour)
),
suivre('pauses',

          supabase
            .from('encheck_pauses')
            .select('id, employee_id, jour, debut, fin, duree_minutes, statut, source, motif, anomalie')
            .eq('employee_id', emp.id)
            .gte('jour', debutFil)
            .lte('jour', dateDuJour)
),
suivre('horaires',

          supabase
            .from('employee_schedules')
            .select('*, work_schedules(*)')
            .eq('employee_id', emp.id)
            .eq('is_active', true)
),
suivre('plannings',

          supabase
            .from('work_schedules')
            .select('*')
            .eq('enterprise_id', ent.id)
            .eq('is_active', true)
),
suivre('seuils',

          chargerSeuilsPointage(ent.id)
),
suivre('feries',

          Promise.resolve(HolidayService.getHolidaysForRange(ent.id, anneeDebut, dateDuJour).catch(() => []))
),
suivre('heuresSup',

          // L'histoire de l'argent (heures sup, valorisation) ne se charge
          // QUE si un module le mérite — sinon aucune donnée inventée.
          modules.heuresSup || modules.fichesPaie
            ? Promise.resolve(calculateEmployeeHours(emp.id, ent.id).catch(() => null))
            : Promise.resolve(null)
),
suivre('bulletins',

          // L'histoire du salaire : les bulletins bruts de l'année.
          modules.fichesPaie
            ? Promise.resolve(chargerBulletinsPeriode({
              enterpriseId: ent.id,
              dateDebut: anneeDebut,
              dateFin: dateDuJour,
              employeeIds: [emp.id],
            }).catch(() => null))
            : Promise.resolve(null)
),
suivre('taches',

          modules.taches
            ? supabase
              .from('tasks')
              .select('id, title, status, due_at, completed_at, validated_at')
              .eq('assigned_employee_id', emp.id)
              .is('deleted_at', null)
            : Promise.resolve({ data: null })
),
      ])
      for (const [nom, r] of Object.entries({ attRes, absRes, pausesRes, affectRes, grillesRes, tachesRes })) {
        if (r?.error) throw new Error(`${nom} : ${r.error.message}`)
      }
      if (!estFrais()) return

      const attsAnnee = attRes.data || []
      const absences = absRes.data || []
      const pauses = construirePauses(pausesRes?.data || []).paies
        .filter((p) => estPauseReelleEffectuee(p))

      // Le planning du mois — le même moteur que retards et absences.
      const plansParJour = __internal.construirePlanningsParJour({
        affectations: affectRes?.data || [],
        grilles: grillesRes?.data || [],
        startDate: debutMois,
        endDate: dateDuJour,
      })
      const planDuJour = plansParJour[dateDuJour] || null
      // Tolérance retard : celle de la grille du jour (défaut 15 min).
      let toleranceMinutes = 15
      if (planDuJour?.grilleId) {
        const grilleDuJour = (grillesRes?.data || []).find((g) => g.id === planDuJour.grilleId)
        toleranceMinutes = Number(grilleDuJour?.late_tolerance_minutes) > 0
          ? Number(grilleDuJour.late_tolerance_minutes)
          : 15
      }

      const attsAsc = [...attsAnnee].reverse()
      // Le fil d'activité ne montre que sa fenêtre (14 jours ou le mois).
      const attsFenetre = attsAsc.filter((a) => jourLocal(a.check_time, fuseau) >= debutFil)
      // L'état du JOUR se juge sur les pointages du jour — pas sur
      // toute la fenêtre du fil.
      const attsDuJour = attsAsc.filter((a) => jourLocal(a.check_time, fuseau) === dateDuJour)
      const firstIn = attsDuJour.find((a) => String(a.check_type || '').toLowerCase() === 'in') || null
      const lastPunch = attsDuJour.length > 0 ? attsDuJour[attsDuJour.length - 1] : null
      // Une pause ouverte ne juge la journée que si ELLE est du jour : sans
      // ce filtre, une pause jamais refermée il y a plusieurs jours laisse
      // la fiche en « En pause » indéfiniment (repéré 21/11 sur la capture
      // du fondateur : « EN PAUSE · 16:42 » pour une pause du 17/11).
      const activePause = pauses.find((p) => p.ouverte
        && jourLocal(p.debutISO, fuseau) === dateDuJour) || null
      const absenceDuJour = absences.find((a) => a.start_date <= dateDuJour && (a.end_date || a.start_date) >= dateDuJour) || null

      const etat = etatPresenceDuJour({
        firstIn,
        lastPunch,
        activePause,
        absenceDuJour,
        finPosteDepassee: finPosteDepassee(ent),
      })
      const retard = retardDuJour({ firstIn, planDuJour, fuseau, toleranceMinutes })

      const joursPointes = joursPointesDuMois(attsAnnee, debutMois, dateDuJour, fuseau)
      const joursPrevus = joursPrevusDepuisPlans(plansParJour, debutMois, dateDuJour, dateDuJour)
      const presencePct = pourcentageSiEchantillon(joursPointes.length, joursPrevus)
      const grilleMois = grillePresenceMois({ dateDuJour, joursPointes, plansParJour })
      const fil = construireFilActivite({
        attendances: attsFenetre,
        pauses,
        absences,
        dateDuJour,
        fuseau,
        maxEntrees: 14,
      })

      const pausesDuJour = pauses.filter((p) => jourLocal(p.debutISO, fuseau) === dateDuJour)
      // Une pause encore ouverte n'a pas de durée arrêtée : on la
      // compte en direct, de son début à maintenant.
      const dureePausesDuJour = pausesDuJour.reduce((acc, p) => {
        if (p.ouverte) {
          const min = Math.max(0, Math.round((Date.now() - new Date(p.debutISO).getTime()) / 60000))
          return acc + min
        }
        return acc + (Number(p.dureeMinutes) || 0)
      }, 0)

      // Le rythme de l'année (barres + retards) — chaque journée est
      // résolue avec le même resolveur que la page Pointages : un seul
      // source pour les barres ET les totaux affichés.
      const attsParJour = {}
      for (const a of attsAnnee) {
        const j = jourLocal(a.check_time, fuseau)
        if (!j) continue
        ;(attsParJour[j] = attsParJour[j] || []).push(a)
      }
      const retsParJour = {}
      for (const jour of listeJoursInclusifs(anneeDebut, dateDuJour)) {
        const [aa, mm, jj] = jour.split('-').map(Number)
        const voisin = (delta) => {
          const d = new Date(Date.UTC(aa, mm - 1, jj + delta))
          return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
        }
        // Le resolveur rattache la garde de nuit de la veille et la
        // sortie du matin suivant : jour + les deux jours voisins.
        const fenetreAtts = [
          ...(attsParJour[voisin(-1)] || []),
          ...(attsParJour[jour] || []),
          ...(attsParJour[voisin(1)] || []),
        ]
        const r = __internal.resoudrePointagesJournee(fenetreAtts, jour, { seuils: seuilsRes, referenceNow: maintenant })
        retsParJour[jour] = { secondes: r?.totalSecondes || 0, pointe: (r?.attendances || []).length > 0 }
      }

      // Retards sur la période — le même moteur que l'app
      // (computeRetardsAlignedRetardsJSX), planning résolu + fériés.
      const affectationLigne = (affectRes?.data || [])[0] || null
      const grilleDefaut = (grillesRes?.data || [])[0] || null
      const scheduleResolved = __internal.resolveScheduleLikeRetards(affectationLigne, grilleDefaut)
      const holidaysSet = HolidayService.buildHolidaySet(
        (feriesRes || []).filter((h) => !h.is_worked)
      )
      const retardMois = __internal.computeRetardsAlignedRetardsJSX({
        attendances: attsAnnee, scheduleResolved, holidaysSet, startDate: debutMois, endDate: dateDuJour,
      })
      const retardAnnee = __internal.computeRetardsAlignedRetardsJSX({
        attendances: attsAnnee, scheduleResolved, holidaysSet, startDate: anneeDebut, endDate: dateDuJour,
      })

      // Le rythme affiché : le plan du jour, sinon le premier plan
      // du mois. La tolérance vient de la grille (jamais inventée).
      const planRythme = planDuJour
        || Object.keys(plansParJour).sort().map((j) => plansParJour[j]).find(Boolean)
        || null
      const planPersonnalise = Boolean(affectationLigne?.use_custom_hours)
      const grilleRythme = (grillesRes?.data || []).find((g) => g.id === planRythme?.grilleId) || null
      const rythme = rythmePlanning({
        plan: planRythme,
        tolerance: grilleRythme ? grilleRythme.late_tolerance_minutes : null,
        perso: planPersonnalise,
      })

      const taches = resumerTaches(tachesRes?.data || [], dateDuJour, debutMois)
      const absencesMois = joursAbsencesPeriode(absences, debutMois, dateDuJour)
      const absencesAnnee = joursAbsencesPeriode(absences, anneeDebut, dateDuJour)

      setDonnees({
        fuseau,
        dateDuJour,
        debutMois,
        etat,
        retard,
        aPlanDuJour: Boolean(planDuJour),
        pausesDuJourCount: pausesDuJour.length,
        dureePausesDuJour,
        joursPointes: joursPointes.length,
        joursPrevus,
        presencePct,
        grilleMois,
        fil,
        moisLabel: `${MOIS_COMPLETS[Number(dateDuJour.slice(5, 7)) - 1]} ${dateDuJour.slice(0, 4)}`,
        anneeDebut,
        anneeLabel: dateDuJour.slice(0, 4),
        retsParJour,
        retardMois,
        retardAnnee,
        heuresEmp: heuresRes,
        bulletins: bulletinsRes?.bulletins || [],
        devise: ent?.currency || 'XAF',
        taches,
        rythme,
        modules,
        absencesMois,
        absencesAnnee,
      })
    } catch (err) {
      console.error('Erreur chargement fiche employé:', err)
      if (estFrais()) setErreur(String(err?.message || err))
    } finally {
      if (estFrais()) {
        setChargement(false)
        // La scène ne sera imposée qu'à la première ouverture de la
        // session : feuilleter les collègues doit rester instantané.
        dejaVueRef.current = true
      }
    }
  }, [])

  // ── fiche + entreprise + carrousel ─────────────────────────
  useEffect(() => {
    let actif = true
    const tout = async () => {
      setChargement(true)
      setErreur(null)
      // Nouveau tour de charge : la jauge repart de zéro, et les marques d'un
      // tour précédent ne peuvent plus rien écrire.
      tourRef.current += 1
      requetesRef.current.clear()
      setEtapeChargement(1)
      setProgressionChargement(8)
      try {
        const { data: emp, error } = await suivre(
          'fiche',
          supabase
            .from('employees')
            .select('*')
            .eq('id', id)
            .maybeSingle(),
        )
        if (error) throw error
        if (!actif) return
        if (!emp) {
          setErreur('Cette fiche n’existe plus (supprimée ou déplacée).')
          setChargement(false)
          return
        }
        setEmployee(emp)
        const { data: ent } = await suivre(
          'entreprise',
          supabase
            .from('enterprises')
            .select('*')
            .eq('id', emp.enterprise_id)
            .maybeSingle(),
        )
        if (!actif) return
        setEntreprise(ent || null)
        const { data: liste } = await suivre(
          'carrousel',
          supabase
          .from('employees')
          .select('id, first_name, last_name, photo_url')
          .eq('enterprise_id', emp.enterprise_id)
          .eq('is_active', true)
          .order('last_name'),
        )
        if (!actif) return
        setEmployesEnt(liste || [])
        charger(emp, ent || null)
      } catch (err) {
        console.error('Erreur fiche employé:', err)
        if (actif) {
          setErreur(String(err?.message || err))
          setChargement(false)
          dejaVueRef.current = true
        }
      }
    }
    tout()
    return () => { actif = false }
  }, [id, charger, suivre])

  // ── temps réel : le badge de présence vit comme le dashboard ─
  useEffect(() => {
    if (!employee?.id || !entreprise) return undefined
    let minute = null
    const demander = () => {
      if (minute) return
      minute = setTimeout(() => {
        minute = null
        charger(employee, entreprise)
      }, 1200)
    }
    const toucheLaFiche = (enregistrement) =>
      Boolean(enregistrement) && enregistrement.employee_id === employee.id
    const canal = supabase
      .channel(`employee360_${employee.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendances' }, (ev) => {
        if (toucheLaFiche(ev?.new) || toucheLaFiche(ev?.old)) demander()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'encheck_pauses' }, (ev) => {
        if (toucheLaFiche(ev?.new) || toucheLaFiche(ev?.old)) demander()
      })
      .subscribe()
    return () => {
      if (minute) clearTimeout(minute)
      supabase.removeChannel(canal)
    }
  }, [employee, entreprise, charger])

  // ── carrousel : feuilleter les collègues ───────────────────
  const indexActif = useMemo(
    () => employesEnt.findIndex((e) => e.id === employee?.id),
    [employesEnt, employee]
  )
  const allerA = useCallback((index) => {
    if (!employesEnt.length) return
    const cible = (index + employesEnt.length) % employesEnt.length
    const emp = employesEnt[cible]
    // Le routeur porte l'identité : la dépendance [id] recharge tout.
    navigate(`/employes/${emp.id}`)
  }, [employesEnt, navigate])
  const fenetre = useMemo(() => {
    if (!employesEnt.length) return []
    const n = employesEnt.length
    const largeur = 5
    let debut = indexActif - Math.floor(largeur / 2)
    debut = ((debut % n) + n) % n
    return Array.from({ length: Math.min(largeur, n) }, (_, i) => employesEnt[(debut + i) % n])
  }, [employesEnt, indexActif])

  // ── profil & contact ───────────────────────────────────────
  const nomComplet = [employee?.first_name, employee?.last_name].filter(Boolean).join(' ') || 'Sans nom'
  const anciennete = employee?.hire_date ? libelleAnciennete(employee.hire_date) : null
  const ancienneteJours = employee?.hire_date ? joursAnciennete(employee.hire_date) : null
  const lienWa = employee?.phone ? lienWhatsApp(employee.phone) : null
  const lienTel = employee?.phone ? lienAppel(employee.phone) : null
  const texteEchelon = employee?.echelon
    ? (/echelon/i.test(String(employee.echelon)) ? employee.echelon : `Échelon ${employee.echelon}`)
    : null
  const d = donnees

  // ── Activité : série, échelle, pic ─────────────────────────
  const serieBarres = d
    ? (periode === 'mois'
      ? serieBarresMois(d.retsParJour, d.dateDuJour)
      : serieBarresAnnee(d.retsParJour, d.dateDuJour))
    : []
  const heuresTravaillees = totalSecondesSerie(serieBarres)
  const aAuMoinsUneBarre = serieBarres.some((c) => c.heures != null)
  const picHeures = serieBarres.reduce(
    (acc, c) => (c.heures != null && (!acc || c.heures > acc.heures) ? c : acc), null)
  const maxHeures = picHeures ? picHeures.heures : 0
  const echelleHeures = echelleNice(maxHeures, 4)
  const colonnesHeures = aAuMoinsUneBarre ? serieBarres.map((c, i) => ({
    cle: `b${i}`,
    col: periode === 'mois' ? (c.numero % 3 === 1 ? String(c.numero) : '') : MOIS_AXE[(c.mois || c.numero) - 1] || c.libelle,
    valeur: c.heures,
    estPic: picHeures != null && c.heures != null && picHeures.heures === c.heures
      && (c.mois || c.numero) === (picHeures.mois || picHeures.numero),
    tag: secondesVersHeures(c.heures * 3600),
    estAujourdhui: c.estAujourdhui === true,
  })) : []
  const retardPeriode = d ? (periode === 'mois' ? d.retardMois : d.retardAnnee) : null
  const absencesPeriode = d ? (periode === 'mois' ? d.absencesMois : d.absencesAnnee) : 0
  const heuSup = (() => {
    if (!d?.heuresEmp) return null
    if (periode === 'mois') {
      const m = d.heuresEmp.thisMonth
      return __internal.parseDurationToHours(m?.overtime_normal?.hours || m?.overtime_25 || '0h00')
        + __internal.parseDurationToHours(m?.overtime_major?.hours || m?.overtime_50 || '0h00')
    }
    return __internal.parseDurationToHours(d.heuresEmp.thisYear?.overtime || '0h00')
  })()

  // ── Salaire : bulletins bruts de l'année ───────────────────
  const serieSalaire = d && d.modules.fichesPaie ? serieSalaireAnnee(d.bulletins, d.dateDuJour) : []
  const totalSalaire = d && d.modules.fichesPaie ? totalSalaireAnnee(d.bulletins, d.dateDuJour) : null
  const tendance = d && d.modules.fichesPaie ? tendanceSalaire(d.bulletins, d.dateDuJour) : null
  const aAuMoinsUnBulletin = serieSalaire.some((c) => c.montant != null)
  const picSalaire = serieSalaire.reduce(
    (acc, c) => (c.montant != null && (!acc || c.montant > acc.montant) ? c : acc), null)
  const echelleSalaire = echelleNice(picSalaire ? picSalaire.montant : 0, 4)
  const colonnesSalaire = aAuMoinsUnBulletin ? serieSalaire.map((c) => ({
    cle: `m${c.mois}`,
    col: MOIS_AXE[c.mois - 1],
    valeur: c.montant,
    estPic: picSalaire != null && c.mois === picSalaire.mois,
    tag: `${libelleMontant(picSalaire ? picSalaire.montant : 0, abreviationDevise(d?.devise))}`,
  })) : []

  // ── Rythme : chips des jours travaillés ────────────────────
  const chipsJours = d?.rythme?.defini ? chipsJoursTravailles(d.rythme.joursListe) : []

  // ── Activité récente : liste plate, 8 événements max ───────
  const filPlat = useMemo(() => {
    const tous = []
    for (const g of d?.fil || []) {
      for (const e of g.entrees) tous.push({ ...e, jourGroupe: g.libelle })
    }
    return tous.slice(0, 8)
  }, [d])

  const pastilleTache = (statut) => ['completed', 'validated'].includes(statut)
    ? 'fait'
    : ['in_progress', 'paused'].includes(statut) ? 'encours' : 'attente'

  // ── la fiche se charge : la scène validée pour l'annuaire, branchée sur les
  // vraies requêtes de cette page. La première ouverture laisse jouer la scène
  // quelques secondes ; ensuite (carrousel, enregistrement) on ne l'impose pas.
  if ((chargement || !plancherFait) && !erreur) {
    const qui = nomComplet !== 'Sans nom' ? ` ${nomComplet}` : ''
    return (
      <EmployesLoadingScreen
        darkMode={darkMode}
        dataReady={!chargement}
        etape={etapeChargement}
        progression={progressionChargement}
        etapes={ETAPES_CHARGEMENT_FICHE}
        legende="Chargement de la fiche du collaborateur"
        marque={nomComplet !== 'Sans nom' ? `EN-CHECK · FICHE · ${nomComplet}` : 'EN-CHECK · FICHE COLLABORATEUR'}
        titre={`Chargement de la fiche${qui}…`}
        titrePret="La fiche est prête"
        statutPret="Toutes les données du collaborateur sont à jour."
        dureeMin={dejaVueRef.current ? 0 : EMPLOYES_INTRO_MS}
        onIntroDone={() => setPlancherFait(true)}
        onSkip={() => setPlancherFait(true)}
      />
    )
  }

  if (!admin) {
    return null
  }

  return (
    <div className="emp-vues emp-360" data-e360="bogolan">
      <div className="e360-conteneur">
        {/* ─────────────── TÊTE ─────────────── */}
        <header className="e360-tete">
          <div className="e360-tete-gauche">
            <button type="button" className="e360-retour" onClick={() => navigate('/employes')} aria-label="Retour à l'annuaire">
              <ArrowLeft size={18} />
            </button>
            <h1 className="e360-titre">Fiche employée</h1>
          </div>

          {employesEnt.length > 1 && (
            <div className="e360-carrousel" role="group" aria-label="Feuilleter les employés">
              <button type="button" onClick={() => allerA(indexActif - 1)} aria-label="Employé précédent">
                <ChevronLeft size={16} />
              </button>
              <div className="e360-carrousel-avatars">
                {fenetre.map((e, i) => (
                  <button
                    key={e.id}
                    type="button"
                    className={`e360-carrousel-avatar${e.id === employee?.id ? ' is-actif' : ''}`}
                    onClick={() => allerA(indexActif - Math.floor(fenetre.length / 2) + i)}
                    aria-label={`Ouvrir la fiche de ${[e.first_name, e.last_name].join(' ')}`}
                  >
                    {e.photo_url
                      ? <img src={e.photo_url} alt="" />
                      : initialesDe(e.first_name, e.last_name)}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => allerA(indexActif + 1)} aria-label="Employé suivant">
                <ChevronRight size={16} />
              </button>
            </div>
          )}

          <div className="e360-actions">
            <button type="button" className="e360-bouton" onClick={() => setModalFiche(true)}>
              <UserCog size={14} /> Modifier
            </button>
            {employee?.qr_token && (
              <button type="button" className="e360-bouton is-primaire" onClick={() => setBadgeOuvert(true)}>
                <QrCode size={14} /> Badge QR
              </button>
            )}
          </div>
        </header>

        {/* ─────────────── CORPS ─────────────── */}
        {erreur && (
          <div className="e360-erreur" role="alert">
            <AlertTriangle size={18} />
            <div>
              <strong>Impossible de charger la fiche</strong>
              <span>{erreur}</span>
            </div>
            <button type="button" onClick={() => window.location.reload()}>Réessayer</button>
          </div>
        )}

        {!chargement && !erreur && d && (
          <div className="e360-grille">
            {/* ═══ Colonne 1 — portrait, contact, accès ═══ */}
            <div className="e360-col">
              <section className="e360-carte e360-carte-portrait" aria-label="Profil">
                {/* Badge suspendu : la lanière est un ornement dessiné en CSS,
                    pas une image. Elle est masquée aux lecteurs d'écran. */}
                <span className="e360-laniere" aria-hidden="true" />
                <p className="e360-surtitre">
                  {(entreprise?.name || 'En-Check').toUpperCase()} · Fiche employée
                </p>
                <div className="e360-portrait">
                  {employee?.photo_url
                    ? <img src={employee.photo_url} alt={`Photo de ${nomComplet}`} />
                    : <span className="e360-portrait-initiales" aria-hidden="true">{initialesDe(employee?.first_name, employee?.last_name)}</span>}
                  <span className={`e360-badge-etat e360-badge-etat--${d.etat.state}`}>
                    <i aria-hidden="true" />
                    {d.etat.libelle.toUpperCase()}
                    {d.etat.state === 'en_poste' && d.etat.entreeHHMM && ` · ${d.etat.entreeHHMM}`}
                    {d.etat.state === 'en_pause' && d.etat.activePause?.debutISO
                      && ` · ${formaterHeureLocaleShort(d.etat.activePause.debutISO, d.fuseau) || '—'}`}
                  </span>
                  {anciennete && <span className="e360-chip-haut">{anciennete}</span>}
                </div>
                <div className="e360-portrait-corps">
                  <h2 className="e360-nom">{nomComplet}</h2>
                  <p className="e360-poste">
                    {employee?.position || 'Poste non renseigné'}
                    {employee?.department && ` · ${employee.department}`}
                  </p>
                </div>
                {employee?.matricule && (
                  <p className="e360-matricule">
                    N<span aria-hidden="true">°</span> {employee.matricule}
                  </p>
                )}
              </section>

              {(employee?.phone || employee?.email) && (
                <section className="e360-carte e360-carte-contact" aria-label="Contact">
                  {employee?.phone && (
                    <div className="e360-contact-numero">
                      <Phone size={16} />
                      <strong>{employee.phone}</strong>
                    </div>
                  )}
                  <div className="e360-contact-boutons">
                    {lienWa && (
                      <a className="e360-contact-btn e360-contact-wa" href={lienWa} target="_blank" rel="noreferrer">
                        <WhatsAppGlyph /> WhatsApp
                      </a>
                    )}
                    {lienTel && (
                      <a className="e360-contact-btn e360-contact-tel" href={lienTel}>
                        <Phone size={14} /> Appeler
                      </a>
                    )}
                    {employee?.email && !employee?.phone && (
                      <a className="e360-contact-btn e360-contact-tel" href={`mailto:${employee.email}`}>
                        <Mail size={14} /> Écrire
                      </a>
                    )}
                  </div>
                </section>
              )}

              <div className="e360-paire-stats">
                <section className="e360-carte e360-stat" aria-label="Ancienneté en jours">
                  <strong>{ancienneteJours != null ? new Intl.NumberFormat('fr-FR').format(ancienneteJours) : '—'}</strong>
                  <span>jours dans l'entreprise</span>
                </section>
                <section className="e360-carte e360-stat" aria-label="Jours pointés ce mois">
                  <strong>{d.joursPointes}</strong>
                  <span>jours pointés ce mois</span>
                </section>
              </div>

              <section className="e360-carte" aria-label="Profil et accès">
                <h3 className="e360-carte-titre">Profil &amp; accès</h3>
                <ul className="e360-liste">
                  <li>
                    <span className="e360-liste-icone"><UserCog size={14} /></span>
                    <span className="e360-liste-lib">
                      {employee?.contract_type || '—'}
                      {texteEchelon && ` · ${texteEchelon}`}
                    </span>
                  </li>
                  <li>
                    <span className="e360-liste-icone"><IdCard size={14} /></span>
                    <span className="e360-liste-lib">N° pointeuse</span>
                    <span className="e360-liste-val">{employee?.machine_pin || 'Non attribué'}</span>
                  </li>
                  <li>
                    <span className="e360-liste-icone"><Globe size={14} /></span>
                    <span className="e360-liste-lib">Portail</span>
                    <span className={`e360-liste-val${employee?.user_id && !employee.employee_portal_enabled ? ' is-muet' : ''}`}>
                      {!employee?.user_id ? 'Pas de compte' : employee.employee_portal_enabled ? <em className="is-ok">ouvert</em> : 'fermé'}
                    </span>
                  </li>
                  <li>
                    <span className="e360-liste-icone"><Clock size={14} /></span>
                    <span className="e360-liste-lib">Dernière connexion</span>
                    <span className="e360-liste-val">
                      {employee?.last_login_at
                        ? new Date(employee.last_login_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
                        : 'Jamais'}
                    </span>
                  </li>
                  {employee?.email && (
                    <li>
                      <span className="e360-liste-icone"><Mail size={14} /></span>
                      <span className="e360-liste-val e360-liste-email">{employee.email}</span>
                    </li>
                  )}
                </ul>
              </section>
            </div>

            {/* ═══ Colonne 2 — activité, salaire, rythme ═══ */}
            <div className="e360-col">
              <section className="e360-carte" aria-label="Activité sur la période">
                <h3 className="e360-carte-titre">
                  Activité
                  <span className="e360-seg" role="group" aria-label="Période de l'activité">
                    <button type="button" className={periode === 'mois' ? 'is-active' : ''} onClick={() => setPeriode('mois')}>Mois</button>
                    <button type="button" className={periode === 'annee' ? 'is-active' : ''} onClick={() => setPeriode('annee')}>Année</button>
                  </span>
                </h3>

                <div className={`e360-kpis${d.modules.heuresSup ? '' : ' e360-kpis--3'}`}>
                  <div className="e360-kpi">
                    <strong>{secondesVersHeures(heuresTravaillees)}</strong>
                    <span>heures</span>
                  </div>
                  {d.modules.heuresSup && (
                    <div className="e360-kpi">
                      <strong>{heuSup != null ? secondesVersHeures(heuSup * 3600) : '—'}</strong>
                      <span>sup</span>
                    </div>
                  )}
                  <div className="e360-kpi">
                    <strong>{retardPeriode?.ignored_no_schedule ? '—' : `${retardPeriode?.count ?? 0}`}</strong>
                    <span>{retardPeriode?.ignored_no_schedule ? 'pas de référence' : 'retards'}</span>
                  </div>
                  <div className="e360-kpi">
                    <strong>{`${absencesPeriode} j`}</strong>
                    <span>d'absence</span>
                  </div>
                </div>

                {aAuMoinsUneBarre ? (
                  <GrapheBarres
                    colonnes={colonnesHeures}
                    echelle={echelleHeures}
                    libelleGraduation={(g) => `${g}`}
                    ariaLabel={
                      `Heures travaillées ${periode === 'mois' ? 'par jour' : 'par mois'} — pic : ${picHeures ? secondesVersHeures(picHeures.heures * 3600) : '—'}`
                    }
                  />
                ) : (
                  <p className="e360-vide">
                    {`Aucun pointage ${periode === 'mois' ? 'ce mois-ci' : `en ${d.anneeLabel}`}.`}
                  </p>
                )}
              </section>

              {d.modules.fichesPaie && (
                <section className="e360-carte" aria-label="Salaire de l'année">
                  <h3 className="e360-carte-titre">
                    Salaire
                    {tendance && (
                      <span
                        className={`e360-badge-tendance${tendance.pct >= 0 ? ' is-pos' : ' is-neg'}`}
                        title={tendance.comparaison}
                      >
                        {tendance.pct >= 0 ? '+' : ''}{tendance.pct} %
                      </span>
                    )}
                  </h3>
                  <p className="e360-sous-titre">
                    {`Jan–Déc · ${totalSalaire != null ? libelleMontant(totalSalaire, d.devise) : 'aucun bulletin'}`}
                  </p>
                  {aAuMoinsUnBulletin ? (
                    <GrapheBarres
                      colonnes={colonnesSalaire}
                      echelle={echelleSalaire}
                      libelleGraduation={(g) => libelleMontantCourt(g)}
                      ariaLabel={`Salaire brut mensuel ${d.anneeLabel} — pic : ${picSalaire ? libelleMontant(picSalaire.montant, d.devise) : '—'}`}
                      fine
                    />
                  ) : (
                    <p className="e360-vide">Aucun bulletin cette année.</p>
                  )}
                </section>
              )}

              <section className="e360-carte" aria-label="Rythme et régularité">
                <h3 className="e360-carte-titre">Rythme &amp; régularité</h3>
                {d.rythme.defini ? (
                  <>
                    {chipsJours.length > 0 && (
                      <div className="e360-chips-jours">
                        {chipsJours.map((j) => (
                          <span key={j} className="e360-chip-jour">{j}</span>
                        ))}
                      </div>
                    )}
                    <ul className="e360-infos">
                      <li>
                        <span className="e360-info-icone"><Clock size={14} /></span>
                        <span className="e360-info-texte">
                          <span className="e360-info-principal">{d.rythme.journee}</span>
                          <span className="e360-info-sous">Horaires de travail</span>
                        </span>
                      </li>
                      <li>
                        <span className="e360-info-icone"><Coffee size={14} /></span>
                        <span className="e360-info-texte">
                          <span className="e360-info-principal">
                            {d.rythme.pauseMinutes ? `Pause ${d.rythme.pauseMinutes} min` : 'Aucune pause'}
                          </span>
                          <span className="e360-info-sous">{d.rythme.pause || '—'}</span>
                        </span>
                      </li>
                      <li>
                        <span className="e360-info-icone"><Timer size={14} /></span>
                        <span className="e360-info-texte">
                          <span className="e360-info-principal">
                            {d.rythme.tolerance ? `Tolérance ${d.rythme.tolerance} min` : 'Tolérance non définie'}
                          </span>
                          <span className="e360-info-sous">Avant retard</span>
                        </span>
                      </li>
                    </ul>
                  </>
                ) : (
                  <p className="e360-vide">Aucun horaire de référence n'est déclaré.</p>
                )}
              </section>
            </div>

            {/* ═══ Colonne 3 — aujourd'hui, présence, citation ═══ */}
            <div className="e360-col">
              <section className="e360-carte" aria-label="Aujourd'hui">
                <h3 className="e360-carte-titre">Aujourd'hui</h3>
                <ul className="e360-liste">
                  <li>
                    <span className="e360-liste-icone"><LogIn size={14} /></span>
                    <span className="e360-liste-lib">Entrée</span>
                    <span className="e360-liste-val">{d.etat.entreeHHMM || '—'}</span>
                  </li>
                  <li>
                    <span className="e360-liste-icone"><LogOut size={14} /></span>
                    <span className="e360-liste-lib">Sortie</span>
                    <span className="e360-liste-val">{d.etat.sortieHHMM || '—'}</span>
                  </li>
                  <li>
                    <span className="e360-liste-icone"><Coffee size={14} /></span>
                    <span className="e360-liste-lib">Pauses</span>
                    <span className="e360-liste-val">
                      {d.pausesDuJourCount === 0
                        ? 'Aucune'
                        : `${d.pausesDuJourCount} · ${libelleDureePauses(d.dureePausesDuJour) || 'en cours'}`}
                    </span>
                  </li>
                  <li className={d.retard ? 'is-alerte' : ''}>
                    <span className="e360-liste-icone"><AlertTriangle size={14} /></span>
                    <span className="e360-liste-lib">Retard</span>
                    <span className="e360-liste-val">
                      {!d.aPlanDuJour && 'Pas de référence'}
                      {d.aPlanDuJour && d.retard === null && (d.etat.entreeHHMM ? 'Aucun' : '—')}
                      {d.retard !== null && `${d.retard} min`}
                    </span>
                  </li>
                </ul>
              </section>

              <section className="e360-carte" aria-label="Présence du mois">
                <h3 className="e360-carte-titre">Présence du mois</h3>
                {(d.joursPointes > 0 || d.joursPrevus > 0) ? (
                  <>
                    <div className="e360-tiles3">
                      <div className="e360-tile3">
                        <strong>{d.joursPointes}</strong>
                        <span>pointés</span>
                      </div>
                      <div className="e360-tile3">
                        <strong>{d.joursPrevus > 0 ? d.joursPrevus : '—'}</strong>
                        <span>prévus</span>
                      </div>
                      <div className="e360-tile3">
                        <strong className="is-or">{d.presencePct != null ? `${d.presencePct} %` : '—'}</strong>
                        <span>taux de présence</span>
                      </div>
                    </div>

                    <div className="e360-grille-mois" aria-label="Grille du mois">
                      {d.grilleMois.cases.map((c) => (
                        <span
                          key={c.jour}
                          className={`e360-case e360-case--${c.etat}`}
                          title={`${c.numero} — ${c.etat === 'pointe' ? 'présent' : c.etat === 'prevu' ? 'prévu, non pointé' : c.etat === 'avenir' ? 'à venir' : 'non planifié'}`}
                        >
                          {c.numero}
                        </span>
                      ))}
                    </div>
                    <p className="e360-legende">
                      <span><i className="e360-leg-1" aria-hidden="true" /> Présent</span>
                      <span><i className="e360-leg-2" aria-hidden="true" /> Absent</span>
                      <span><i className="e360-leg-3" aria-hidden="true" /> Non planifié</span>
                    </p>
                    {d.presencePct == null && d.joursPrevus > 0 && (
                      <p className="e360-note">Moins de 15 jours prévus : le taux se lit en jours, pas en pourcentage.</p>
                    )}
                  </>
                ) : (
                  <p className="e360-vide">
                    Aucun pointage ce mois-ci.
                    {d.joursPrevus === 0 && ' Aucun horaire de référence n’est déclaré.'}
                  </p>
                )}
              </section>

              <figure className="e360-carte e360-carte-citation">
                <span className="e360-citation-glyphe" aria-hidden="true">“</span>
                <blockquote>Des équipes engagées bâtissent des entreprises plus fortes.</blockquote>
                <figcaption>En-Check</figcaption>
              </figure>
            </div>

            {/* ═══ Colonne 4 — activité récente, tâches, promo ═══ */}
            <div className="e360-col">
              <section className="e360-carte" aria-label="Activité récente">
                <h3 className="e360-carte-titre">
                  Activité récente
                  <a className="e360-voir-tout" href="#" onClick={(e) => { e.preventDefault(); navigate('/pointages') }}>Voir tout →</a>
                </h3>

                {filPlat.length > 0 ? (
                  <ul className="e360-fil">
                    {filPlat.map((e) => {
                      const spec = TYPE_FIL[e.type] || TYPE_FIL.absence
                      const Icone = spec.icone
                      return (
                        <li key={e.id} className={`e360-fil-item e360-fil-item--${e.type}`}>
                          <span className="e360-fil-bulle" aria-hidden="true"><Icone size={13} /></span>
                          <span className="e360-fil-texte">
                            <span className="e360-fil-titre">{spec.libelleCourt}</span>
                            <span className="e360-fil-sous">
                              {e.type === 'absence'
                                ? `${e.jourGroupe}${e.periode ? ` · ${e.periode}` : ''}`
                                : `${e.jourGroupe} à ${e.heure || '—'}`}
                            </span>
                          </span>
                          <time className="e360-fil-heure">{e.heure || courtJour(e.jour)}</time>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="e360-vide">Aucune activité sur les 14 derniers jours.</p>
                )}
              </section>

              {d.modules.taches && (
                <section className="e360-carte" aria-label="Tâches">
                  <h3 className="e360-carte-titre">
                    Tâches
                    <a className="e360-voir-tout" href="#" onClick={(e) => { e.preventDefault(); navigate('/taches') }}>Voir tout →</a>
                  </h3>
                  {d.taches.aucune ? (
                    <p className="e360-vide">Aucune tâche attribuée.</p>
                  ) : d.taches.prochaines.length === 0 ? (
                    <p className="e360-vide">
                      {`Rien d'échéant — ${d.taches.enCours} en cours, ${d.taches.terminees} terminée${d.taches.terminees > 1 ? 's' : ''} ce mois.`}
                    </p>
                  ) : (
                    <ul className="e360-taches">
                      {d.taches.prochaines.map((t) => (
                        <li key={t.id} className={`e360-tache e360-tache--${pastilleTache(t.statut)}`}>
                          <i aria-hidden="true" />
                          <span className="e360-tache-texte">
                            <span className="e360-tache-titre">{t.titre}</span>
                            <span className="e360-tache-sous">
                              {t.echeance === d.dateDuJour
                                ? 'Aujourd’hui'
                                : new Date(`${t.echeance}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}

              <section className="e360-carte e360-carte-promo" aria-label="En-Check">
                <KenteWovenTapestrySvg className="e360-promo-motif" />
                <p className="e360-promo-texte">Nos talents font avancer l'Afrique</p>
              </section>
            </div>
          </div>
        )}

        {!chargement && !erreur && !d && (
          <div className="e360-vide e360-vide-tete">
            <UserRound size={18} /> Cette fiche est vide : aucun pointage, aucune pause, aucun congé enregistré.
          </div>
        )}
      </div>

      {/* La modale de l'annuaire : le GESTE MODIFIER. */}
      {modalFiche && employee && (
        <FicheEmployeModal
          employee={employee}
          mode="edit"
          scheduleInfo={null}
          entreprises={entreprise ? [entreprise] : []}
          defaultEnterpriseId={entreprise?.id || ''}
          isSuperAdmin={admin?.role === 'super_admin'}
          canEdit
          onClose={() => setModalFiche(false)}
          onSaved={() => {
            setModalFiche(false)
            if (entreprise) charger(employee, entreprise)
          }}
        />
      )}

      {/* Le badge QR : le même composant que l'annuaire. */}
      {badgeOuvert && employee && (
        <BadgeEmploye
          employee={employee}
          entrepriseName={entreprise?.name || ''}
          entrepriseLogo={entreprise?.logo_url}
          primaryColor={entreprise?.primary_color ?? '#c9a961'}
          onClose={() => setBadgeOuvert(false)}
        />
      )}
    </div>
  )
}
