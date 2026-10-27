// ════════════════════════════════════════════════════════════════════
// 👥 VUE « ÉQUIPES » — page Employés, le registre perlé
//
// L'écran est un registre, pas une planche de cartes :
//
//   1. un feuillet — folio, titre serif, colophon de quatre chiffres ;
//   2. le collier de l'entreprise — une perle par personne, groupée
//      par équipe, la perle du chef cerclée, les personnes à
//      rattacher en creux sur un fil pointillé ;
//   3. le registre — une entrée par équipe : son rang, son nom, sa
//      description au filet de couleur, ses membres, sa santé en
//      cinq perles, ses actions en mots.
//
// Aucune carte : ce qui sépare, c'est un filet ; ce qui compte, c'est
// une perle. Les fenêtres (créer, membres, chef, supprimer) sont
// partagées : voir EquipesModales.jsx.
// ════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronDown, HelpCircle, History,
  Loader2, MoreVertical, Plus, RefreshCw,
  Search, Sparkles, UserCog, UserMinus, UserPlus, Users, X,
} from 'lucide-react'
import toast from 'react-hot-toast'

import FeatureService, { FEATURES } from '../../services/featureService'
import {
  getTeams, createTeam, updateTeam, deleteTeam,
  addTeamMembers, removeTeamMember,
  getAvailableEmployeesForTeam,
  getOrphanEmployees, getTeamHealthMetrics, getTeamAlerts,
  detectPotentialTeams, predictStaffingNeeds, getTeamHistory, logTeamAction,
} from '../../services/teamService'
import {
  TeamModal, MembersModal, DeleteModal, HistoryModal, ShortcutsModal,
} from './EquipesModales'
import { RosacePerlesSvg } from '../zoulou/PerlesZoulouSvg'
import { Folio, Colophon } from '../zoulou/RegistreEntete'
import '../zoulou/zoulou.css'

const FILTRES = [
  { key: 'all', label: 'Toutes' },
  { key: 'with_leader', label: 'Avec chef' },
  { key: 'without_leader', label: 'Sans chef' },
  { key: 'empty', label: 'Vides' },
  { key: 'critical', label: 'À surveiller' },
]

const TRIS = [
  { key: 'name_asc', label: 'Nom (A → Z)' },
  { key: 'name_desc', label: 'Nom (Z → A)' },
  { key: 'members_desc', label: 'Effectif décroissant' },
  { key: 'members_asc', label: 'Effectif croissant' },
  { key: 'health_asc', label: 'Santé la plus basse' },
]

const ETAT_SANTE = {
  healthy: { libelle: 'Solide', ton: 'solide' },
  warning: { libelle: 'À surveiller', ton: 'a-surveiller' },
  critical: { libelle: 'Critique', ton: 'critique' },
}

const initiales = (personne) =>
  `${personne?.first_name?.[0] || ''}${personne?.last_name?.[0] || ''}`.toUpperCase()

const nomComplet = (personne) =>
  [personne?.first_name, personne?.last_name].filter(Boolean).join(' ') || 'Sans nom'

// Le ton d'une perle pour une équipe : sa couleur si elle en a une
// lisible, sinon le cuivre de la maison.
const TONS_PERLE = ['cuivre', 'teal', 'sauge', 'corail', 'creme']
const tonEquipe = (equipe, rang) => {
  const couleur = equipe?.color
  if (couleur === '#4F9389' || couleur === '#2B6A5F') return 'teal'
  if (couleur === '#8BA268' || couleur === '#56652A') return 'sauge'
  if (couleur === '#C8785C' || couleur === '#A2452E') return 'corail'
  if (couleur === '#E0C9A0') return 'creme'
  return TONS_PERLE[rang % TONS_PERLE.length]
}

// ── le collier de l'entreprise : une perle par personne ────────────
function CollierEntreprise({ equipes, orphelins }) {
  return (
    <section className="rg-bloc" aria-label="Tout l’effectif en une parure">
      <header className="rg-bloc-tete">
        <h3 className="rg-bloc-titre">Le collier de l’entreprise</h3>
        <p className="rg-bloc-note">
          une perle par personne · la perle du chef est cerclée · les creuses sont à rattacher
        </p>
      </header>

      <ul className="rg-collier">
        {equipes.map((equipe, rang) => {
          const membres = equipe.members || []
          const ton = tonEquipe(equipe, rang)
          return (
            <li className="rg-collier-groupe" key={equipe.id}>
              <span className="rg-collier-perles" style={{ '--rg-fil': `var(--rg-perle-${ton})` }}>
                {membres.slice(0, 10).map((m) => {
                  const personne = m.employee || m
                  const chef = (personne?.id || m.employee_id) === equipe.leader_employee_id
                  return (
                    <span
                      key={personne?.id || m.id || m.employee_id}
                      className="rg-perle"
                      data-ton={ton}
                      data-chef={chef ? 'oui' : 'non'}
                      title={`${nomComplet(personne)}${chef ? ' — chef d’équipe' : ''}`}
                    >
                      {initiales(personne)}
                    </span>
                  )
                })}
                {membres.length > 10 && <span className="rg-collier-note">+{membres.length - 10}</span>}
                {membres.length === 0 && <span className="rg-collier-note">aucun membre</span>}
              </span>
              <span className="rg-collier-nom">{equipe.name}</span>
              <span className="rg-collier-note">
                {equipe.member_count ?? membres.length} membre{(equipe.member_count ?? membres.length) > 1 ? 's' : ''}
                {equipe.leader_employee_id ? '' : ' · sans chef'}
              </span>
            </li>
          )
        })}

        {orphelins.length > 0 && (
          <li className="rg-collier-groupe" data-orphelin="oui">
            <span className="rg-collier-perles" style={{ '--rg-fil': 'var(--rg-corail)' }}>
              {orphelins.slice(0, 10).map((personne) => (
                <span
                  key={personne.id}
                  className="rg-perle"
                  data-creuse="oui"
                  title={`${nomComplet(personne)} — à rattacher`}
                >
                  {initiales(personne)}
                </span>
              ))}
              {orphelins.length > 10 && <span className="rg-collier-note">+{orphelins.length - 10}</span>}
            </span>
            <span className="rg-collier-nom">Sans équipe</span>
            <span className="rg-collier-note">à rattacher</span>
          </li>
        )}
      </ul>
    </section>
  )
}

// ── une entrée du registre ─────────────────────────────────────────
function EntreeEquipe({ equipe, rang, onMembres, onModifier, onRetirer, onChangerChef }) {
  const [menu, setMenu] = useState(false)
  const membres = equipe?.members || []
  const effectif = equipe.member_count ?? membres.length
  const score = Number(equipe?.health?.health_score)
  const suivi = Number.isFinite(score)
  const etat = ETAT_SANTE[equipe?.health?.status] || ETAT_SANTE.healthy
  const perles = suivi ? Math.min(5, Math.max(0, Math.ceil(Math.round(score) / 20))) : 0

  return (
    <li className="rg-entree">
      <span className="rg-entree-index">{String(rang + 1).padStart(2, '0')}</span>

      <div className="rg-cellule">
        <h4 className="rg-entree-titre">
          <button type="button" onClick={() => onModifier(equipe)}>{equipe.name}</button>
        </h4>
        <p className="rg-entree-note">
          {equipe.description || 'Sans description — utile pour situer l’équipe.'}
        </p>
        <span
          className="rg-entree-filet"
          style={{ '--rg-trait-equipe': `var(--rg-perle-${tonEquipe(equipe, rang)})` }}
          aria-hidden="true"
        />
      </div>

      <div className="rg-cellule rg-cellule-membres">
        <span className="rg-etiquette-champ">
          Membres <span style={{ letterSpacing: 0, textTransform: 'none', fontWeight: 600 }}>· {effectif}</span>
        </span>
        <span className="rg-membres">
          {membres.slice(0, 6).map((m) => {
            const personne = m.employee || m
            const chef = (personne?.id || m.employee_id) === equipe.leader_employee_id
            return (
              <span
                className="rg-membre"
                key={personne?.id || m.id || m.employee_id}
                data-chef={chef ? 'oui' : 'non'}
                title={nomComplet(personne)}
              >
                {personne?.photo_url ? <img src={personne.photo_url} alt="" /> : initiales(personne)}
              </span>
            )
          })}
          {membres.length > 6 && <span className="rg-membres-note">+{membres.length - 6}</span>}
          {membres.length === 0 && <span className="rg-membres-note">aucun membre</span>}
          <span className="rg-membres-note" data-ton={equipe.leader_employee_id ? 'normal' : 'alerte'}>
            {equipe.leader ? `chef : ${nomComplet(equipe.leader)}` : 'sans chef'}
          </span>
        </span>
      </div>

      <div className="rg-cellule rg-cellule-sante">
        <span className="rg-etiquette-champ">Santé</span>
        <span
          className="rg-sante"
          data-etat={suivi ? etat.ton : 'inconnu'}
          title={suivi ? `Santé de l’équipe : ${etat.libelle}` : 'Aucune mesure de santé pour cette équipe'}
        >
          <span className="rg-sante-perles" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className={`rg-sante-perle${i < perles ? ' is-pleine' : ''}`} />
            ))}
          </span>
          <span className="rg-sante-valeur">
            {suivi ? <>{Math.round(score)}<span> %</span></> : 'Non suivie'}
          </span>
        </span>
      </div>

      <div className="rg-entree-actions">
        <button
          type="button"
          className="rg-lien"
          aria-label={`Actions pour ${equipe.name}`}
          aria-expanded={menu}
          onClick={() => setMenu((v) => !v)}
        >
          <MoreVertical size={14} />
        </button>
        <button type="button" className="rg-lien" onClick={() => onModifier(equipe)}>
          <UserCog size={12} /> Modifier
        </button>
        <button type="button" className="rg-lien" data-fort="oui" onClick={() => onMembres(equipe)}>
          <UserPlus size={12} /> Membres
        </button>
        {menu && (
          <div className="rg-menu">
            <button type="button" onClick={() => { setMenu(false); onModifier(equipe) }}>
              <UserCog size={13} /> Modifier l’équipe
            </button>
            <button type="button" onClick={() => { setMenu(false); onChangerChef(equipe) }}>
              <Users size={13} /> Changer de chef
            </button>
            <button type="button" className="is-danger" onClick={() => { setMenu(false); onRetirer(equipe) }}>
              <UserMinus size={13} /> Supprimer
            </button>
          </div>
        )}
      </div>
    </li>
  )
}

// ── le pied : ce qui demande une décision, dépliable ───────────────
function PiedDecisions({
  alertes, orphelins, suggestions, besoins, equipes,
  onAjouterOrphelin, onCreerSuggestion, chargement, predictions,
}) {
  const [ouvert, setOuvert] = useState(false)
  const [onglet, setOnglet] = useState('alertes')

  if (!predictions) {
    return (
      <footer className="rg-pied">
        <p className="rg-pied-titre">
          À décider
          <span className="rg-pied-texte">
            Les analyses d’équipe ne sont pas activées : aucune alerte, aucun regroupement
            proposé. L’option Prédictions s’allume depuis la fiche de l’entreprise.
          </span>
        </p>
      </footer>
    )
  }

  const onglets = [
    { cle: 'alertes', libelle: 'Alertes', nombre: alertes.length, vide: 'Aucune alerte : rien à signaler.' },
    { cle: 'orphelins', libelle: 'Sans équipe', nombre: orphelins.length, vide: 'Tout le monde est rattaché à une équipe.' },
    { cle: 'suggestions', libelle: 'Regroupements', nombre: suggestions.length, vide: 'Aucun regroupement évident.' },
    { cle: 'besoins', libelle: 'Effectif', nombre: besoins.length, vide: 'Aucun besoin d’effectif détecté.' },
  ]
  const actif = onglets.find((o) => o.cle === onglet) || onglets[0]
  const total = onglets.reduce((somme, o) => somme + o.nombre, 0)

  return (
    <footer className="rg-pied">
      <div className="rg-pied-ligne">
        <p className="rg-pied-titre">
          À décider
          <span className="rg-pied-texte">
            {chargement
              ? 'Analyse en cours…'
              : total === 0
                ? 'Rien à arbitrer : les équipes tiennent.'
                : `${total} point${total > 1 ? 's' : ''} à arbitrer`}
          </span>
        </p>
        <button
          type="button"
          className="rg-lien"
          aria-expanded={ouvert}
          onClick={() => setOuvert((v) => !v)}
        >
          <Sparkles size={12} /> {ouvert ? 'Refermer' : 'Ouvrir le registre'}
          <ChevronDown size={13} style={{ transform: ouvert ? 'rotate(180deg)' : 'none' }} />
        </button>
      </div>

      {ouvert && (
        <>
          <div className="rg-pied-onglets" role="group" aria-label="Ce qui demande une décision">
            {onglets.map((o) => (
              <button
                key={o.cle}
                type="button"
                className="rg-lien"
                aria-pressed={onglet === o.cle}
                onClick={() => setOnglet(o.cle)}
              >
                {o.libelle} <span className="rg-categorie-nombre">{o.nombre}</span>
              </button>
            ))}
          </div>

          <div className="rg-pied-liste">
            {actif.nombre === 0 && (
              <p className="rg-pied-item-note" style={{ padding: '12px 0' }}>{actif.vide}</p>
            )}

            {onglet === 'alertes' && alertes.map((a) => (
              <div key={a.id} className="rg-pied-item" data-grave={a.severity === 'critical' ? 'oui' : 'non'}>
                <div>
                  <p className="rg-pied-item-titre">{a.team_name || 'Équipe'}</p>
                  <p className="rg-pied-item-note">{a.message}</p>
                </div>
              </div>
            ))}

            {onglet === 'orphelins' && orphelins.map((o) => (
              <div key={o.id} className="rg-pied-item">
                <div>
                  <p className="rg-pied-item-titre">{nomComplet(o)}</p>
                  <p className="rg-pied-item-note">{o.position || o.department || 'Aucune équipe'}</p>
                </div>
                <div className="rg-pied-item-actions">
                  <select
                    className="rg-tri"
                    aria-label={`Rattacher ${nomComplet(o)} à une équipe`}
                    value=""
                    onChange={(e) => { if (e.target.value) onAjouterOrphelin(o.id, e.target.value) }}
                  >
                    <option value="">Rattacher à…</option>
                    {equipes.map((e) => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}

            {onglet === 'suggestions' && suggestions.map((s) => (
              <div key={s.id} className="rg-pied-item">
                <div>
                  <p className="rg-pied-item-titre">{s.name}</p>
                  <p className="rg-pied-item-note">{s.reason}</p>
                </div>
                <div className="rg-pied-item-actions">
                  <button type="button" className="rg-lien" onClick={() => onCreerSuggestion(s)}>
                    Créer cette équipe
                  </button>
                </div>
              </div>
            ))}

            {onglet === 'besoins' && besoins.map((n) => (
              <div key={n.team_id} className="rg-pied-item">
                <div>
                  <p className="rg-pied-item-titre">{n.team_name}</p>
                  <p className="rg-pied-item-note">
                    {n.message || `${n.needed || 0} personne(s) à recruter ou à affecter`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </footer>
  )
}

export default function EquipesVue({ enterpriseId: enterpriseIdProp, employes = [] }) {
  const [admin, setAdmin] = useState(null)
  const [enterpriseId, setEnterpriseId] = useState(enterpriseIdProp || null)
  const [raison, setRaison] = useState('ok')
  const [predictions, setPredictions] = useState(false)

  const [equipes, setEquipes] = useState([])
  const [alertes, setAlertes] = useState([])
  const [orphelins, setOrphelins] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [besoins, setBesoins] = useState([])
  const [historique, setHistorique] = useState([])

  const [chargement, setChargement] = useState(true)
  const [chargementAnalyses, setChargementAnalyses] = useState(false)
  const [enregistrement, setEnregistrement] = useState(false)

  const [recherche, setRecherche] = useState('')
  const [filtre, setFiltre] = useState('all')
  const [tri, setTri] = useState('name_asc')

  const [equipeChoisie, setEquipeChoisie] = useState(null)
  const [disponibles, setDisponibles] = useState([])
  const [aSupprimer, setASupprimer] = useState(null)

  const [montrerEquipe, setMontrerEquipe] = useState(false)
  const [montrerMembres, setMontrerMembres] = useState(false)
  const [montrerSuppression, setMontrerSuppression] = useState(false)
  const [montrerHistorique, setMontrerHistorique] = useState(false)
  const [montrerRaccourcis, setMontrerRaccourcis] = useState(false)

  const rechercheRef = useRef(null)

  const charger = useCallback(async (eid) => {
    if (!eid) return
    setChargement(true)
    try {
      const { data, error } = await getTeams(eid, { includeMembers: true, includeStats: true })
      if (error) throw error
      let liste = data || []

      if (await FeatureService.hasFeature(eid, FEATURES.PREDICTIONS)) {
        setPredictions(true)
        setChargementAnalyses(true)
        const [sante, al, orph, sugg, bes] = await Promise.all([
          getTeamHealthMetrics(eid),
          getTeamAlerts(eid),
          getOrphanEmployees(eid),
          detectPotentialTeams(eid),
          predictStaffingNeeds(eid),
        ])
        setAlertes(al.data || [])
        setOrphelins(orph.data || [])
        setSuggestions(sugg.data || [])
        setBesoins(bes.data || [])
        if (sante.data) {
          const parEquipe = new Map(sante.data.map((h) => [h.team_id, h]))
          liste = liste.map((t) => ({ ...t, health: parEquipe.get(t.id) || null }))
        }
        setChargementAnalyses(false)
      } else {
        setPredictions(false)
      }

      setEquipes(liste)
    } catch (erreur) {
      console.error('Chargement des équipes :', erreur)
      toast.error('Impossible de charger les équipes')
    } finally {
      setChargement(false)
    }
  }, [])

  useEffect(() => {
    let annule = false
    const demarrer = async () => {
      const donnees = JSON.parse(localStorage.getItem('admin') || '{}')
      if (annule) return
      setAdmin(donnees)
      const eid = enterpriseIdProp || donnees.selectedEnterprise?.id || donnees.enterprise_id || null
      setEnterpriseId(eid)
      if (!eid) {
        setChargement(false)
        setRaison('sansEntreprise')
        return
      }
      const autorise = donnees.role === 'super_admin'
        || await FeatureService.hasFeature(eid, FEATURES.GESTION_EQUIPES)
      if (annule) return
      if (!autorise) {
        setRaison('sansOption')
        setChargement(false)
        return
      }
      setRaison('ok')
      await charger(eid)
    }
    demarrer()
    return () => { annule = true }
  }, [enterpriseIdProp, charger])

  const journaliser = useCallback(async (action, cible, details) => {
    if (!enterpriseId || !admin?.id) return
    try { await logTeamAction(enterpriseId, admin.id, action, cible, details) } catch { /* journal best-effort */ }
  }, [enterpriseId, admin])

  const ouvrirNouvelleEquipe = useCallback(() => {
    setEquipeChoisie(null)
    setMontrerEquipe(true)
  }, [])

  const ouvrirModification = useCallback((equipe) => {
    setEquipeChoisie(equipe)
    setMontrerEquipe(true)
  }, [])

  const enregistrerEquipe = useCallback(async (formulaire) => {
    setEnregistrement(true)
    try {
      if (equipeChoisie) {
        const { error } = await updateTeam(equipeChoisie.id, formulaire, admin?.id)
        if (error) throw error
        await journaliser('update_team', equipeChoisie.id, { team_name: formulaire.name })
        toast.success('Équipe mise à jour')
      } else {
        const { data, error } = await createTeam({ ...formulaire, enterprise_id: enterpriseId }, admin?.id)
        if (error) throw error
        await journaliser('create_team', data?.id, { team_name: formulaire.name })
        toast.success('Équipe créée')
      }
      setMontrerEquipe(false)
      await charger(enterpriseId)
    } catch (erreur) {
      toast.error(erreur.message || 'Enregistrement impossible')
    } finally {
      setEnregistrement(false)
    }
  }, [equipeChoisie, admin, enterpriseId, journaliser, charger])

  const confirmerSuppression = useCallback(async () => {
    if (!aSupprimer) return
    setEnregistrement(true)
    try {
      const { success, error } = await deleteTeam(aSupprimer.id, admin?.id)
      if (!success) throw error
      await journaliser('delete_team', aSupprimer.id, { team_name: aSupprimer.name })
      toast.success('Équipe supprimée')
      setASupprimer(null)
      setMontrerSuppression(false)
      await charger(enterpriseId)
    } catch (erreur) {
      toast.error(erreur.message || 'Suppression impossible')
    } finally {
      setEnregistrement(false)
    }
  }, [aSupprimer, admin, journaliser, charger])

  const ouvrirMembres = useCallback(async (equipe) => {
    setEquipeChoisie(equipe)
    const { data } = await getAvailableEmployeesForTeam(enterpriseId, equipe.id)
    setDisponibles(data || [])
    setMontrerMembres(true)
  }, [enterpriseId])

  const ajouterMembres = useCallback(async (identifiants) => {
    if (!equipeChoisie) return
    setEnregistrement(true)
    try {
      const { error } = await addTeamMembers(equipeChoisie.id, identifiants)
      if (error) throw error
      for (const id of identifiants) {
        const personne = employes.find((e) => e.id === id)
        await journaliser('add_team_member', equipeChoisie.id, {
          team_name: equipeChoisie.name,
          member_name: personne ? nomComplet(personne) : '',
          employee_id: id,
        })
      }
      toast.success(`${identifiants.length} personne${identifiants.length > 1 ? 's ajoutées' : ' ajoutée'}`)
      setMontrerMembres(false)
      await charger(enterpriseId)
    } catch (erreur) {
      toast.error(erreur.message || 'Ajout impossible')
    } finally {
      setEnregistrement(false)
    }
  }, [equipeChoisie, employes, journaliser, charger])

  const retirerMembre = useCallback(async (identifiantEmploye) => {
    if (!equipeChoisie) return
    setEnregistrement(true)
    try {
      const { success, error } = await removeTeamMember(equipeChoisie.id, identifiantEmploye)
      if (!success) throw error
      const personne = employes.find((e) => e.id === identifiantEmploye)
      await journaliser('remove_team_member', equipeChoisie.id, {
        team_name: equipeChoisie.name,
        member_name: personne ? nomComplet(personne) : '',
      })
      toast.success('Personne retirée de l’équipe')
      await charger(enterpriseId)
      const { data } = await getAvailableEmployeesForTeam(enterpriseId, equipeChoisie.id)
      setDisponibles(data || [])
      const { data: fraiches } = await getTeams(enterpriseId, { includeMembers: true })
      const miseAJour = (fraiches || []).find((t) => t.id === equipeChoisie.id)
      if (miseAJour) setEquipeChoisie(miseAJour)
    } catch (erreur) {
      toast.error(erreur.message || 'Retrait impossible')
    } finally {
      setEnregistrement(false)
    }
  }, [equipeChoisie, employes, enterpriseId, journaliser, charger])

  const ajouterOrphelin = useCallback(async (idEmploye, idEquipe) => {
    setEnregistrement(true)
    try {
      const { error } = await addTeamMembers(idEquipe, [idEmploye])
      if (error) throw error
      const personne = orphelins.find((o) => o.id === idEmploye)
      const equipe = equipes.find((t) => t.id === idEquipe)
      toast.success(`${nomComplet(personne)} rejoint ${equipe?.name || 'l’équipe'}`)
      await charger(enterpriseId)
    } catch {
      toast.error('Ajout impossible')
    } finally {
      setEnregistrement(false)
    }
  }, [orphelins, equipes, charger, enterpriseId])

  const creerSuggestion = useCallback(async (suggestion) => {
    setEnregistrement(true)
    try {
      const { error } = await createTeam({
        enterprise_id: enterpriseId,
        name: suggestion.name,
        color: suggestion.suggested_color,
        initial_members: suggestion.employee_ids || [],
      }, admin?.id)
      if (error) throw error
      toast.success(`« ${suggestion.name} » créée`)
      await charger(enterpriseId)
    } catch (erreur) {
      toast.error(erreur.message || 'Création impossible')
    } finally {
      setEnregistrement(false)
    }
  }, [enterpriseId, admin, charger])

  const chargerHistorique = useCallback(async () => {
    if (!enterpriseId) return
    const { data } = await getTeamHistory(enterpriseId)
    setHistorique(data || [])
  }, [enterpriseId])

  useEffect(() => {
    const surTouche = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return
      switch (e.key.toLowerCase()) {
        case 'n': e.preventDefault(); ouvrirNouvelleEquipe(); break
        case '/': e.preventDefault(); rechercheRef.current?.focus(); break
        case 'r': e.preventDefault(); charger(enterpriseId); break
        case 'escape':
          setMontrerEquipe(false); setMontrerMembres(false)
          setMontrerSuppression(false); setMontrerHistorique(false); setMontrerRaccourcis(false)
          break
        case '?': e.preventDefault(); setMontrerRaccourcis(true); break
        default: break
      }
    }
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [charger, ouvrirNouvelleEquipe, enterpriseId])

  const equipesAffichees = useMemo(() => {
    let liste = [...equipes]
    if (recherche.trim()) {
      const terme = recherche.trim().toLowerCase()
      liste = liste.filter((t) =>
        t.name?.toLowerCase().includes(terme) || t.description?.toLowerCase().includes(terme))
    }
    switch (filtre) {
      case 'with_leader': liste = liste.filter((t) => t.leader_employee_id); break
      case 'without_leader': liste = liste.filter((t) => !t.leader_employee_id); break
      case 'empty': liste = liste.filter((t) => (t.member_count || 0) === 0); break
      case 'critical': liste = liste.filter((t) => ['critical', 'warning'].includes(t.health?.status)); break
      default: break
    }
    const critere = TRIS.find((t) => t.key === tri)
    if (critere) {
      liste.sort((a, b) => {
        if (critere.key === 'health_asc') {
          const va = a.health?.health_score ?? 100
          const vb = b.health?.health_score ?? 100
          return va - vb
        }
        if (critere.key.startsWith('members')) {
          const va = a.member_count || 0
          const vb = b.member_count || 0
          return critere.key.endsWith('desc') ? vb - va : va - vb
        }
        const va = (a.name || '').toLowerCase()
        const vb = (b.name || '').toLowerCase()
        return critere.key === 'name_desc' ? vb.localeCompare(va) : va.localeCompare(vb)
      })
    }
    return liste
  }, [equipes, recherche, filtre, tri])

  const totalMembres = useMemo(
    () => equipes.reduce((somme, t) => somme + (t.member_count || t.members?.length || 0), 0),
    [equipes],
  )
  const totalChefs = useMemo(() => equipes.filter((t) => t.leader_employee_id).length, [equipes])
  const equipesAvecMembres = useMemo(
    () => equipes.filter((t) => (t.member_count || t.members?.length || 0) > 0).length,
    [equipes],
  )
  // L'effectif de l'entreprise : celui de l'annuaire s'il est chargé,
  // sinon le plus grand des deux totaux connus. On ne divise jamais
  // par zéro, et l'écran dit « — » au lieu d'inventer.
  const effectifConnu = useMemo(
    () => Math.max(employes.length, totalMembres, 0),
    [employes.length, totalMembres],
  )
  const pourcent = (morceau, total) => (total > 0 ? `${Math.round((morceau / total) * 100)} %` : '—')

  if (raison === 'sansEntreprise') {
    return (
      <div className="emp-vues">
        <div className="rg-vide">
          <RosacePerlesSvg taille={52} />
          <h3>Sélectionnez une entreprise</h3>
          <p>
            Les équipes se lisent entreprise par entreprise. Choisissez-la dans
            l’en-tête de la page, puis revenez sur cet onglet.
          </p>
        </div>
      </div>
    )
  }

  if (raison === 'sansOption') {
    return (
      <div className="emp-vues">
        <div className="rg-vide">
          <RosacePerlesSvg taille={52} />
          <h3>Option Équipes non activée</h3>
          <p>
            Cette entreprise n’a pas l’option Équipes et tâches. Un administrateur
            peut l’allumer depuis la fiche de l’entreprise ; l’annuaire reste
            disponible en attendant.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="emp-vues rg-equipes">
      <Folio droite="Registre des équipes" />

      <header className="rg-tete">
        <div>
          <p className="rg-eyebrow">Vue d’ensemble</p>
          <h2 className="rg-titre">Équipes<span>.</span></h2>
        </div>
        <Colophon
          chiffres={[
            {
              valeur: equipes.length,
              libelle: 'Équipes',
              note: equipes.length > 0
                ? `${pourcent(equipesAvecMembres, equipes.length)} ont des membres`
                : 'aucune pour l’instant',
            },
            {
              valeur: totalMembres,
              libelle: 'Membres',
              note: effectifConnu > 0
                ? `${pourcent(totalMembres, effectifConnu)} de l’effectif`
                : '—',
            },
            {
              valeur: totalChefs,
              libelle: 'Chefs',
              note: equipes.length > 0
                ? `${pourcent(totalChefs, equipes.length)} des équipes`
                : '—',
            },
            {
              valeur: orphelins.length,
              libelle: 'Sans équipe',
              note: effectifConnu > 0
                ? `${pourcent(orphelins.length, effectifConnu)} de l’effectif`
                : '—',
              ton: orphelins.length > 0 ? 'corail' : 'normal',
            },
          ]}
        />
      </header>

      <div className="rg-outils">
        <label className="rg-recherche">
          <Search size={14} />
          <input
            ref={rechercheRef}
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher une équipe"
            aria-label="Rechercher une équipe"
          />
          {recherche && (
            <button type="button" className="rg-recherche-effacer" onClick={() => setRecherche('')} aria-label="Effacer la recherche">
              <X size={12} />
            </button>
          )}
        </label>

        <div className="rg-filtres" role="group" aria-label="Filtrer les équipes">
          {FILTRES.map((f) => (
            <button
              key={f.key}
              type="button"
              className="rg-filtre"
              aria-pressed={filtre === f.key}
              onClick={() => setFiltre(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <select className="rg-tri" value={tri} onChange={(e) => setTri(e.target.value)} aria-label="Trier les équipes">
          {TRIS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>

        <div className="rg-actions">
          <button type="button" className="rg-lien" onClick={() => charger(enterpriseId)} title="Rafraîchir (R)">
            <RefreshCw size={12} /> Rafraîchir
          </button>
          <button
            type="button"
            className="rg-lien"
            onClick={async () => { await chargerHistorique(); setMontrerHistorique(true) }}
          >
            <History size={12} /> Historique
          </button>
          <button
            type="button"
            className="rg-lien"
            onClick={() => setMontrerRaccourcis(true)}
            aria-label="Raccourcis clavier"
            title="Raccourcis (?)"
          >
            <HelpCircle size={13} />
          </button>
          <button type="button" className="rg-primaire" onClick={ouvrirNouvelleEquipe}>
            <Plus size={14} /> Nouvelle équipe
          </button>
        </div>
      </div>

      <CollierEntreprise equipes={equipes} orphelins={orphelins} />

      <section className="rg-bloc" aria-label="Les équipes" style={{ borderBottom: 0 }}>
        <header className="rg-bloc-tete">
          <h3 className="rg-bloc-titre">Les équipes</h3>
          <p className="rg-bloc-note">
            santé en cinq perles · {equipesAffichees.length} affichée{equipesAffichees.length > 1 ? 's' : ''}
          </p>
        </header>

        {chargement ? (
          <div className="rg-chargement" aria-live="polite">
            <span className="rg-chargement-texte"><Loader2 size={14} className="rg-tourne" /> Chargement des équipes…</span>
            <div className="rg-chargement-ligne" />
            <div className="rg-chargement-ligne" />
            <div className="rg-chargement-ligne" />
          </div>
        ) : equipesAffichees.length === 0 ? (
          <div className="rg-vide">
            <RosacePerlesSvg taille={52} />
            <h3>{equipes.length === 0 ? 'Aucune équipe pour l’instant' : 'Aucune équipe ne correspond'}</h3>
            <p>
              {equipes.length === 0
                ? 'Regroupez les personnes qui travaillent ensemble : le chef d’équipe, puis les membres. Les tâches pourront ensuite être confiées à l’équipe entière.'
                : 'Élargissez la recherche ou retirez le filtre pour revoir toutes les équipes.'}
            </p>
            <button type="button" className="rg-primaire" onClick={ouvrirNouvelleEquipe}>
              <Plus size={14} /> Nouvelle équipe
            </button>
          </div>
        ) : (
          <ul className="rg-registre">
            {equipesAffichees.map((equipe, rang) => (
              <EntreeEquipe
                key={equipe.id}
                equipe={equipe}
                rang={rang}
                onMembres={ouvrirMembres}
                onModifier={ouvrirModification}
                onRetirer={(t) => { setASupprimer(t); setMontrerSuppression(true) }}
                onChangerChef={ouvrirModification}
              />
            ))}
          </ul>
        )}
      </section>

      <PiedDecisions
        alertes={alertes}
        orphelins={orphelins}
        suggestions={suggestions}
        besoins={besoins}
        onAjouterOrphelin={ajouterOrphelin}
        onCreerSuggestion={creerSuggestion}
        chargement={chargementAnalyses}
        predictions={predictions}
        equipes={equipes}
      />

      <TeamModal
        isOpen={montrerEquipe}
        onClose={() => setMontrerEquipe(false)}
        team={equipeChoisie}
        employees={employes}
        onSave={enregistrerEquipe}
        loading={enregistrement}
      />
      <MembersModal
        isOpen={montrerMembres}
        onClose={() => setMontrerMembres(false)}
        team={equipeChoisie}
        availableEmployees={disponibles}
        onAddMembers={ajouterMembres}
        onRemoveMember={retirerMembre}
        loading={enregistrement}
      />
      <DeleteModal
        open={montrerSuppression}
        onClose={() => setMontrerSuppression(false)}
        onConfirm={confirmerSuppression}
        teamName={aSupprimer?.name || ''}
        loading={enregistrement}
      />
      <HistoryModal
        open={montrerHistorique}
        onClose={() => setMontrerHistorique(false)}
        history={historique}
        loading={false}
      />
      <ShortcutsModal open={montrerRaccourcis} onClose={() => setMontrerRaccourcis(false)} />
    </div>
  )
}
