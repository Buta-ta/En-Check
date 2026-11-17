// ═══════════════════════════════════════════════════════════
// 👤 FICHE EMPLOYÉ 360° — /employes/:id
//
// Une page = une personne. La maquette de référence : bento
// sombre centré sur le profil, carrousel pour feuilleter les
// collègues, activité récente en temps réel à droite.
//
// Règles de la maison :
//  · aucune donnée inventée : ce qui manque s'affiche « — » ou
//    « non renseigné », jamais un 0 qui ferait foi ;
//  · les dates et heures se jugent au fuseau de l'entreprise ;
//  · le mot « absent » n'existe qu'après la fin du poste (P0) ;
//  · la modale de l'annuaire reste le GESTE MODIFIER ; cette
//    page est le GESTE CONSULTER.
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import PageCulturalBand from '../components/PageCulturalBand'
import FicheEmployeModal from '../components/FicheEmployeModal'
import BadgeEmploye from '../components/BadgeEmploye'
import {
  ArrowLeft, Briefcase, ChevronLeft, ChevronRight, Coffee, Clock,
  LogIn, LogOut, QrCode, UserCog, UserRound, CalendarRange,
  IdCard, AlertTriangle,
} from 'lucide-react'
import {
  formaterHeureLocaleShort, heureLocaleVersUTC, jourLocal, libelleFuseau,
} from '../utils/timezoneUtils'
import { initialesDe } from '../utils/initiales'
import { construirePauses, estPauseReelleEffectuee } from '../services/pausesService'
import { __internal } from '../services/hoursCalculator'
import { finPosteDepassee } from '../lib/etatPresence'
import {
  construireFilActivite,
  etatPresenceDuJour,
  grillePresenceMois,
  joursPointesDuMois,
  joursPrevusDepuisPlans,
  libelleAnciennete,
  pourcentageSiEchantillon,
  retardDuJour,
} from '../lib/employee360'
import '../components/zoulou/zoulou.css'
import './Employee360.css'

const MOIS_COMPLETS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const JOURS_COURTS = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam']

const TYPE_FIL = {
  entree: { icone: LogIn, libelleCourt: 'Entrée' },
  sortie: { icone: LogOut, libelleCourt: 'Sortie' },
  pause_debut: { icone: Coffee, libelleCourt: 'Pause' },
  pause_fin: { icone: Coffee, libelleCourt: 'Reprise' },
  absence: { icone: CalendarRange, libelleCourt: 'Congé' },
}

function libelleDateLiseuse(dateISO) {
  // « jeu. 15 oct. » — l'étiquette du jour.
  const [a, m, j] = String(dateISO).split('-').map(Number)
  const d = new Date(Date.UTC(a, m - 1, j))
  return `${JOURS_COURTS[d.getUTCDay()]}. ${j} ${MOIS_COMPLETS[m - 1].slice(0, 3)}.`
}

function libelleDureePauses(minutes) {
  if (!minutes || minutes <= 0) return null
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h && m) return `${h} h ${String(m).padStart(2, '0')}`
  if (h) return `${h} h`
  return `${m} min`
}

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
  const rechargementRef = useRef(0)

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
      const debutMois = `${dateDuJour.slice(0, 8)}01`
      // Fenêtre du fil d'activité : le mois si besoin, sinon 14 jours.
      const moins13 = new Date(Date.now() - 13 * 86400000)
      const parts13 = new Intl.DateTimeFormat('en-CA', {
        timeZone: fuseau, year: 'numeric', month: '2-digit', day: '2-digit',
      }).formatToParts(moins13)
      const get13 = (type) => parts13.find((p) => p.type === type)?.value
      const moins13Jour = `${get13('year')}-${get13('month')}-${get13('day')}`
      const debutFil = debutMois < moins13Jour ? moins13Jour : debutMois

      const debutInstante = heureLocaleVersUTC(debutFil, 0, 0, 0, fuseau)
      const finInstante = heureLocaleVersUTC(dateDuJour, 23, 59, 59, fuseau)

      const [attRes, absRes, pausesRes, affectRes, grillesRes] = await Promise.all([
        supabase
          .from('attendances')
          .select('id, check_time, check_type')
          .eq('employee_id', emp.id)
          .gte('check_time', debutInstante)
          .lte('check_time', finInstante)
          .order('check_time', { ascending: false }),
        supabase
          .from('absences')
          .select('id, start_date, end_date, reason')
          .eq('employee_id', emp.id)
          .gte('start_date', debutMois)
          .lte('end_date', dateDuJour),
        supabase
          .from('encheck_pauses')
          .select('id, employee_id, jour, debut, fin, duree_minutes, statut, source, motif, anomalie')
          .eq('employee_id', emp.id)
          .gte('jour', debutFil)
          .lte('jour', dateDuJour),
        supabase
          .from('employee_schedules')
          .select('*, work_schedules(*)')
          .eq('employee_id', emp.id)
          .eq('is_active', true),
        supabase
          .from('work_schedules')
          .select('*')
          .eq('enterprise_id', ent.id)
          .eq('is_active', true),
      ])
      for (const [nom, r] of Object.entries({ attRes, absRes, pausesRes, affectRes, grillesRes })) {
        if (r?.error) throw new Error(`${nom} : ${r.error.message}`)
      }
      if (!estFrais()) return

      const atts = attRes.data || []
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

      const attsAsc = [...atts].reverse()
      // L'état du JOUR se juge sur les pointages du jour — pas sur
      // toute la fenêtre du fil (un pointage d'hier ne dit rien
      // sur aujourd'hui).
      const attsDuJour = attsAsc.filter((a) => jourLocal(a.check_time, fuseau) === dateDuJour)
      const firstIn = attsDuJour.find((a) => String(a.check_type || '').toLowerCase() === 'in') || null
      const lastPunch = attsDuJour.length > 0 ? attsDuJour[attsDuJour.length - 1] : null
      const activePause = pauses.find((p) => p.ouverte) || null
      const absenceDuJour = absences.find((a) => a.start_date <= dateDuJour && (a.end_date || a.start_date) >= dateDuJour) || null

      const etat = etatPresenceDuJour({
        firstIn,
        lastPunch,
        activePause,
        absenceDuJour,
        finPosteDepassee: finPosteDepassee(ent),
      })
      const retard = retardDuJour({ firstIn, planDuJour, fuseau, toleranceMinutes })

      const joursPointes = joursPointesDuMois(atts, debutMois, dateDuJour, fuseau)
      const joursPrevus = joursPrevusDepuisPlans(plansParJour, debutMois, dateDuJour, dateDuJour)
      const presencePct = pourcentageSiEchantillon(joursPointes.length, joursPrevus)
      const grilleMois = grillePresenceMois({ dateDuJour, joursPointes, plansParJour })
      const fil = construireFilActivite({
        attendances: atts,
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
      })
    } catch (err) {
      console.error('Erreur chargement fiche employé:', err)
      if (estFrais()) setErreur(String(err?.message || err))
    } finally {
      if (estFrais()) setChargement(false)
    }
  }, [])

  // ── fiche + entreprise + carrousel ─────────────────────────
  useEffect(() => {
    let actif = true
    const tout = async () => {
      setChargement(true)
      setErreur(null)
      try {
        const { data: emp, error } = await supabase
          .from('employees')
          .select('*')
          .eq('id', id)
          .maybeSingle()
        if (error) throw error
        if (!actif) return
        if (!emp) {
          setErreur('Cette fiche n’existe plus (supprimée ou déplacée).')
          setChargement(false)
          return
        }
        setEmployee(emp)
        const { data: ent } = await supabase
          .from('enterprises')
          .select('*')
          .eq('id', emp.enterprise_id)
          .maybeSingle()
        if (!actif) return
        setEntreprise(ent || null)
        const { data: liste } = await supabase
          .from('employees')
          .select('id, first_name, last_name, photo_url')
          .eq('enterprise_id', emp.enterprise_id)
          .eq('is_active', true)
          .order('last_name')
        if (!actif) return
        setEmployesEnt(liste || [])
        charger(emp, ent || null)
      } catch (err) {
        console.error('Erreur fiche employé:', err)
        if (actif) {
          setErreur(String(err?.message || err))
          setChargement(false)
        }
      }
    }
    tout()
    return () => { actif = false }
  }, [id, charger])

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
      Boolean(enregistrement) && (
        enregistrement.employee_id === employee.id
      )
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

  const nomComplet = [employee?.first_name, employee?.last_name].filter(Boolean).join(' ') || 'Sans nom'
  const anciennete = employee?.hire_date ? libelleAnciennete(employee.hire_date) : null
  const d = donnees

  if (!admin) {
    return null
  }

  return (
    <div className="emp-vues emp-360">
      <div className="e360-conteneur">
        {/* ─────────────── TÊTE ─────────────── */}
        <header className="e360-tete">
          <div className="e360-tete-gauche">
            <button type="button" className="e360-retour" onClick={() => navigate('/employes')}>
              <ArrowLeft size={15} /> Annuaire
            </button>
            <div className="e360-identite">
              <h1 className="e360-nom">{nomComplet}</h1>
              <p className="e360-sous">
                {employee?.matricule && <span className="e360-sous-matricule">N° {employee.matricule}</span>}
                {entreprise?.name || 'Entreprise'}
                {employee?.position && <span> · {employee.position}</span>}
              </p>
            </div>
          </div>

          <div className="e360-tete-droite">
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
              {employee?.qr_token && (
                <button type="button" className="e360-bouton" onClick={() => setBadgeOuvert(true)}>
                  <QrCode size={14} /> Badge QR
                </button>
              )}
              <button type="button" className="e360-bouton is-primaire" onClick={() => setModalFiche(true)}>
                <UserCog size={14} /> Modifier
              </button>
            </div>
          </div>
        </header>

        {/* ─────────────── CORPS ─────────────── */}
        {chargement && !erreur && (
          <div className="e360-charge" aria-busy="true">
            <span className="e360-charge-point" /> Lecture de la fiche…
          </div>
        )}

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
            {/* ── Colonne 1 : profil + accès ── */}
            <div className="e360-colonne">
              <section className="e360-carte e360-carte-profil" aria-label="Profil">
                <div className="e360-profil-photo">
                  {employee?.photo_url
                    ? <img src={employee.photo_url} alt={`Photo de ${nomComplet}`} />
                    : <span className="e360-profil-initiales" aria-hidden="true">{initialesDe(employee?.first_name, employee?.last_name)}</span>}
                  <span className={`e360-perle e360-perle--${d.etat.state}`} aria-hidden="true" />
                </div>

                <p className={`e360-statut e360-statut--${d.etat.state}`}>
                  <strong>{d.etat.libelle}</strong>
                  {d.etat.state === 'en_poste' && d.etat.entreeHHMM && <span> · depuis {d.etat.entreeHHMM}</span>}
                  {d.etat.state === 'en_pause' && d.etat.activePause?.debutISO
                    && <span> · depuis {formaterHeureLocaleShort(d.etat.activePause.debutISO, d.fuseau) || '—'}</span>}
                  {d.etat.state === 'termine' && d.etat.entreeHHMM && d.etat.sortieHHMM
                    && <span> · {d.etat.entreeHHMM} → {d.etat.sortieHHMM}</span>}
                </p>

                <h2 className="e360-profil-nom">{nomComplet}</h2>
                <p className="e360-profil-poste">
                  {employee?.position || 'Poste non renseigné'}
                  {employee?.department && <span> · {employee.department}</span>}
                </p>

                <div className="e360-pills">
                  {employee?.matricule && <span className="e360-pill"><IdCard size={12} /> {employee.matricule}</span>}
                  {anciennete && <span className="e360-pill"><Clock size={12} /> {anciennete}</span>}
                  {employee?.contract_type && <span className="e360-pill"><Briefcase size={12} /> {employee.contract_type}</span>}
                  {employee?.classification && <span className="e360-pill">{employee.classification}</span>}
                </div>
              </section>

              <section className="e360-carte" aria-label="Profil et accès">
                <h3 className="e360-carte-titre">Profil &amp; accès</h3>
                <dl className="e360-fiche-liste">
                  <div>
                    <dt>Contrat</dt>
                    <dd>
                      {employee?.contract_type || '—'}
                      {employee?.contract_end_date && <span> · jusqu’au {String(employee.contract_end_date).slice(0, 10)}</span>}
                    </dd>
                  </div>
                  <div>
                    <dt>Échelon</dt>
                    <dd>{employee?.echelon || '—'}</dd>
                  </div>
                  <div>
                    <dt>N° pointeuse</dt>
                    <dd>{employee?.machine_pin ? <strong>{employee.machine_pin}</strong> : 'Non attribué'}</dd>
                  </div>
                  <div>
                    <dt>Portail employé</dt>
                    <dd>
                      {!employee?.user_id && 'Pas de compte'}
                      {employee?.user_id && (employee.employee_portal_enabled ? 'Ouvert' : 'Fermé')}
                    </dd>
                  </div>
                  <div>
                    <dt>Dernière connexion</dt>
                    <dd>
                      {employee?.last_login_at
                        ? new Date(employee.last_login_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
                        : 'Jamais'}
                    </dd>
                  </div>
                  <div>
                    <dt>Contact</dt>
                    <dd>
                      {[employee?.phone, employee?.email].filter(Boolean).join(' · ') || '—'}
                    </dd>
                  </div>
                </dl>
              </section>
            </div>

            {/* ── Colonne 2 : aujourd'hui + mois ── */}
            <div className="e360-colonne">
              <section className="e360-carte" aria-label="Aujourd'hui">
                <h3 className="e360-carte-titre">
                  Aujourd’hui
                  <span className="e360-periode">{libelleDateLiseuse(d.dateDuJour)} · {libelleFuseau(d.fuseau)}</span>
                </h3>

                <div className="e360-jour">
                  <div className="e360-jour-ligne">
                    <LogIn size={15} />
                    <span>Entrée</span>
                    <strong>{d.etat.entreeHHMM || '—'}</strong>
                  </div>
                  <div className="e360-jour-ligne">
                    <LogOut size={15} />
                    <span>Sortie</span>
                    <strong>{d.etat.sortieHHMM || '—'}</strong>
                  </div>
                  <div className="e360-jour-ligne">
                    <Coffee size={15} />
                    <span>Pauses</span>
                    <strong>
                      {d.pausesDuJourCount === 0
                        ? 'Aucune'
                        : `${d.pausesDuJourCount} pause${d.pausesDuJourCount > 1 ? 's' : ''}`
                          + (libelleDureePauses(d.dureePausesDuJour) ? ` · ${libelleDureePauses(d.dureePausesDuJour)}` : '')}
                    </strong>
                  </div>
                  <div className={`e360-jour-ligne${d.retard ? ' is-alerte' : ''}`}>
                    <AlertTriangle size={15} />
                    <span>Retard</span>
                    <strong>
                      {!d.aPlanDuJour && 'Aucun horaire de référence'}
                      {d.aPlanDuJour && d.retard === null && (d.etat.entreeHHMM ? 'Aucun' : '—')}
                      {d.retard !== null && `${d.retard} min de retard`}
                    </strong>
                  </div>
                </div>
              </section>

              <section className="e360-carte" aria-label="Présence du mois">
                <h3 className="e360-carte-titre">
                  Présence du mois
                  <span className="e360-periode">{d.moisLabel}</span>
                </h3>

                {(d.joursPointes > 0 || d.joursPrevus > 0) ? (
                  <>
                    <div className="e360-tiles">
                      <div className="e360-tile">
                        <strong>{d.joursPointes}</strong>
                        <span>jour{d.joursPointes > 1 ? 's' : ''} pointé{d.joursPointes > 1 ? 's' : ''}</span>
                      </div>
                      <div className="e360-tile">
                        <strong>{d.joursPrevus > 0 ? d.joursPrevus : '—'}</strong>
                        <span>jour{d.joursPrevus > 1 ? 's' : ''} prévu{d.joursPrevus > 1 ? 's' : ''}</span>
                      </div>
                      <div className="e360-tile">
                        <strong>{d.presencePct != null ? `${d.presencePct} %` : '—'}</strong>
                        <span>taux de présence</span>
                      </div>
                    </div>

                    <div className="e360-grille-mois" aria-label="Grille du mois">
                      {d.grilleMois.cases.map((c) => (
                        <span
                          key={c.jour}
                          className={`e360-case e360-case--${c.etat}`}
                          title={`${c.numero} — ${c.etat === 'pointe' ? 'pointé' : c.etat === 'prevu' ? 'prévu, non pointé' : c.etat === 'avenir' ? 'à venir' : 'hors planning'}`}
                        />
                      ))}
                    </div>
                    <p className="e360-legende">
                      <i className="e360-legende-point" /> pointé · <i className="e360-legende-prevu" /> prévu non pointé · <i className="e360-legende-avenir" /> à venir
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
            </div>

            {/* ── Colonne 3 : activité récente ── */}
            <div className="e360-colonne">
              <section className="e360-carte e360-carte-activite" aria-label="Activité récente">
                <h3 className="e360-carte-titre">
                  Activité
                  <span className="e360-periode">14 derniers jours</span>
                </h3>

                {d.fil.length > 0 ? (
                  <ol className="e360-fil">
                    {d.fil.map((groupe) => (
                      <li key={groupe.jour} className="e360-fil-groupe">
                        <h4>{groupe.libelle}</h4>
                        {groupe.entrees.map((e) => {
                          const spec = TYPE_FIL[e.type] || TYPE_FIL.absence
                          const Icone = spec.icone
                          return (
                            <div key={e.id} className={`e360-fil-entree e360-fil-entree--${e.type}`}>
                              <span className="e360-fil-icone" aria-hidden="true"><Icone size={13} /></span>
                              <span className="e360-fil-libelle">
                                {e.libelle}
                                {e.periode && <em> {e.periode}</em>}
                              </span>
                              {e.heure && <time className="e360-fil-heure">{e.heure}</time>}
                            </div>
                          )
                        })}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="e360-vide">Aucune activité enregistrée sur les 14 derniers jours.</p>
                )}
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

      <PageCulturalBand pathname="/employes" placement="bottom" />

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

