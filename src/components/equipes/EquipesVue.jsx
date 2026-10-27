// ════════════════════════════════════════════════════════════════════
// 👥 VUE « ÉQUIPES » — page Employés, motif perles zoulou
//
// Trois idées tiennent cet écran :
//   1. une équipe est un FIL : un chef, des membres enfilés dans
//      l'ordre où ils ont rejoint, un point de couleur pour la
//      reconnaître ;
//   2. l'état se lit du premier coup d'œil — cinq perles de santé,
//      pas un pourcentage à interpréter ;
//   3. ce qui demande une décision (alertes, personnes sans équipe,
//      regroupements possibles) est posé en haut, dans un collier
//      qu'on déplie.
//
// Les fenêtres (créer, membres, leader, supprimer) sont partagées
// avec le reste de la page : voir EquipesModales.jsx.
// ════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle, Check, Crown, HelpCircle, History,
  LayoutGrid, Lightbulb, List, Loader2, MoreVertical, Plus, RefreshCw,
  Search, Sparkles, TrendingUp, UserCog, UserMinus, UserPlus, Users, X,
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
import {
  AnneauPerlesSvg, FilMembresSvg, FrisePerlesSvg, LosangePerlesSvg,
  PampillesSvg, RosacePerlesSvg,
} from '../zoulou/PerlesZoulouSvg'
import '../zoulou/zoulou.css'

const FILTRES = [
  { key: 'all', label: 'Toutes' },
  { key: 'with_leader', label: 'Avec chef d’équipe' },
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

// Les initiales d'une équipe, pour le médaillon : deux mots → deux
// lettres ; un seul mot → ses deux premières lettres. Jamais vide.
const cleEquipe = (nom = '') => {
  const mots = nom.trim().split(/\s+/).filter(Boolean)
  if (mots.length === 0) return '—'
  if (mots.length === 1) return mots[0].slice(0, 2).toUpperCase()
  return `${mots[0][0]}${mots[1][0]}`.toUpperCase()
}

// Une proportion lisible par un anneau : on ne remplit jamais un
// cercle sans savoir sur quoi on le remplit.
const part = (morceau, total, perles = 22) => {
  if (!total || total <= 0) return 0
  return Math.round((Math.max(0, morceau) / total) * perles)
}

function PerleAvatar({ personne, chef = false }) {
  return (
    <span className={`zl-perle-avatar${chef ? ' is-chef' : ''}`} title={nomComplet(personne)}>
      {personne?.photo_url
        ? <img src={personne.photo_url} alt="" />
        : initiales(personne)}
    </span>
  )
}

function SanteEquipe({ equipe }) {
  const score = Number(equipe?.health?.health_score)
  const suivi = Number.isFinite(score)
  const etat = ETAT_SANTE[equipe?.health?.status] || ETAT_SANTE.healthy
  const note = suivi ? Math.round(score) : null
  //  cinq perles : chacune vaut 20 points. Sans mesure, aucune perle
  //  n'est remplie et l'étiquette le dit — on ne fait pas semblant.
  const perlesPleines = note === null ? 0 : Math.max(1, Math.ceil(note / 20))
  const libelle = note === null ? 'Non suivie' : `${note}%`
  return (
    <span
      className="zl-sante"
      data-etat={note === null ? 'inconnu' : etat.ton}
      title={note === null ? 'Aucune mesure de santé pour cette équipe' : `Santé de l’équipe : ${etat.libelle}`}
    >
      <span className="zl-sante-perles" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className={`zl-sante-perle${i < perlesPleines ? ' is-pleine' : ''}`} />
        ))}
      </span>
      {libelle}
    </span>
  )
}

function CarteEquipe({ equipe, totalMembres, onMembres, onModifier, onRetirer, onChangerChef }) {
  const [menu, setMenu] = useState(false)
  const membres = equipe?.members || []
  const visibles = membres.slice(0, 6)
  const effectif = equipe.member_count ?? membres.length
  //  l'anneau dit la part de CETTE équipe dans l'effectif en équipe :
  //  une échelle réelle, pas un remplissage décoratif
  const anneau = part(effectif, totalMembres, 22)
  const partEffectif = totalMembres > 0 ? Math.round((effectif / totalMembres) * 100) : 0

  return (
    <article className="zl-carte">
      <RosacePerlesSvg className="zl-carte-filigrane" taille={104} ton="teal" />

      <div className="zl-carte-tete">
        <h4 className="zl-carte-titre">
          <span className="zl-pastille" style={{ background: equipe.color || 'var(--zl-perle-cuivre)' }} aria-hidden="true" />
          <span>{equipe.name}</span>
        </h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <SanteEquipe equipe={equipe} />
          <button
            type="button"
            className="zl-menage"
            aria-label={`Actions pour ${equipe.name}`}
            aria-expanded={menu}
            onClick={() => setMenu((v) => !v)}
          >
            <MoreVertical size={14} />
          </button>
        </div>
        {menu && (
          <div className="zl-menu">
            <button type="button" onClick={() => { setMenu(false); onModifier(equipe) }}>
              <UserCog size={13} /> Modifier l’équipe
            </button>
            <button type="button" onClick={() => { setMenu(false); onChangerChef(equipe) }}>
              <Crown size={13} /> Changer de chef
            </button>
            <button type="button" className="is-danger" onClick={() => { setMenu(false); onRetirer(equipe) }}>
              <UserMinus size={13} /> Supprimer
            </button>
          </div>
        )}
      </div>

      <div className="zl-carte-medaillon">
        <span className="zl-carte-medaillon-rond">
          <AnneauPerlesSvg taille={56} parts={22} remplis={anneau} ton="teal" />
          <span className="zl-carte-medaillon-cle">{cleEquipe(equipe.name)}</span>
        </span>
        <div className="zl-carte-medaillon-texte">
          <p className="zl-carte-note">
            {equipe.description || 'Aucune description — utile pour situer l’équipe.'}
          </p>
          <span className="zl-meta">
            <Users size={12} />
            <strong>{effectif}</strong> membre{effectif > 1 ? 's' : ''}
            <span aria-hidden="true">·</span>
            {partEffectif} % des personnes en équipe
          </span>
        </div>
      </div>

      <div className="zl-membres">
        <FilMembresSvg className="zl-membres-fil" />
        {visibles.map((m) => (
          <PerleAvatar
            key={m.id || m.employee?.id}
            personne={m.employee}
            chef={m.employee?.id === equipe.leader_employee_id}
          />
        ))}
        {membres.length > visibles.length && (
          <span className="zl-perle-plus">+{membres.length - visibles.length}</span>
        )}
        {membres.length === 0 && <span className="zl-compte">Aucun membre pour l’instant</span>}
      </div>

      <div className="zl-carte-pied">
        <span className="zl-meta">
          {equipe.leader ? (
            <>
              <PerleAvatar personne={equipe.leader} chef />
              Chef : <strong>{nomComplet(equipe.leader)}</strong>
            </>
          ) : (
            <>
              <LosangePerlesSvg taille={16} ton="corail" />
              Sans chef d’équipe
            </>
          )}
        </span>
        <div className="zl-carte-actions">
          <button type="button" className="zl-mini" onClick={() => onMembres(equipe)}>
            <UserPlus size={12} /> Membres
          </button>
          <button type="button" className="zl-mini" onClick={() => onModifier(equipe)}>
            <UserCog size={12} /> Modifier
          </button>
        </div>
      </div>
    </article>
  )
}

function LigneEquipe({ equipe, onMembres, onModifier, onRetirer }) {
  const membres = equipe?.members || []
  const effectif = equipe.member_count ?? membres.length
  return (
    <div className="zl-ligne">
      <div className="zl-ligne-principal">
        <span className="zl-pastille" style={{ background: equipe.color || 'var(--zl-perle-cuivre)' }} aria-hidden="true" />
        <div style={{ minWidth: 0 }}>
          <p className="zl-ligne-nom">{equipe.name}</p>
          <p className="zl-ligne-note">{equipe.description || 'Sans description'}</p>
        </div>
      </div>
      <div className="zl-ligne-secondaire">
        <div className="zl-membres">
          <FilMembresSvg className="zl-membres-fil" />
          {membres.slice(0, 4).map((m) => (
            <PerleAvatar key={m.id || m.employee?.id} personne={m.employee} chef={m.employee?.id === equipe.leader_employee_id} />
          ))}
          {membres.length > 4 && <span className="zl-perle-plus">+{membres.length - 4}</span>}
          {membres.length === 0 && <span className="zl-compte">Aucun membre</span>}
          {membres.length > 0 && <span className="zl-compte" style={{ marginLeft: 12 }}>{effectif} au total</span>}
        </div>
        <SanteEquipe equipe={equipe} />
      </div>
      <div className="zl-carte-actions">
        <button type="button" className="zl-mini" onClick={() => onMembres(equipe)}><UserPlus size={12} /> Membres</button>
        <button type="button" className="zl-mini" onClick={() => onModifier(equipe)}><UserCog size={12} /> Modifier</button>
        <button type="button" className="zl-mini" onClick={() => onRetirer(equipe)} aria-label={`Supprimer ${equipe.name}`}><X size={12} /></button>
      </div>
    </div>
  )
}

function CollierEquipes({
  alertes, orphelins, suggestions, besoins, santeGlobale,
  onAjouterOrphelin, onCreerSuggestion, chargement, predictions,
}) {
  const [onglet, setOnglet] = useState('alertes')

  if (!predictions) {
    return (
      <div className="zl-note-module">
        <Sparkles size={15} />
        <span>
          Les analyses d’équipe (santé, alertes, regroupements) s’affichent quand
          l’option Prédictions est allumée sur la fiche de l’entreprise.
        </span>
      </div>
    )
  }

  const groupes = {
    alertes: { titre: 'Alertes', items: alertes, vide: 'Aucune alerte : les équipes tiennent.' },
    orphelins: { titre: 'Sans équipe', items: orphelins, vide: 'Tout le monde est rattaché à une équipe.' },
    suggestions: { titre: 'Regroupements', items: suggestions, vide: 'Aucun regroupement évident pour l’instant.' },
    besoins: { titre: 'Effectifs', items: besoins, vide: 'Les effectifs sont cohérents avec la charge.' },
  }
  const choix = [
    { key: 'alertes', icone: AlertTriangle },
    { key: 'orphelins', icone: UserMinus },
    { key: 'suggestions', icone: Lightbulb },
    { key: 'besoins', icone: TrendingUp },
  ]
  const actif = groupes[onglet]

  return (
    <section className="zl-collier" aria-label="Ce qui demande une décision">
      <header className="zl-collier-tete">
        <h3 className="zl-collier-titre"><Sparkles size={13} /> À décider</h3>
        {santeGlobale && (
          <span className="zl-sante" data-etat={santeGlobale.critical_teams > 0 ? 'a-surveiller' : 'solide'}>
            Santé moyenne <strong>{Math.round(santeGlobale.avg_health_score)}%</strong>
            <span aria-hidden="true">·</span>
            {santeGlobale.critical_teams > 0
              ? `${santeGlobale.critical_teams} critique${santeGlobale.critical_teams > 1 ? 's' : ''}`
              : `${santeGlobale.healthy_teams} solide${santeGlobale.healthy_teams > 1 ? 's' : ''}`}
          </span>
        )}
      </header>
      <div className="zl-collier-corps">
        <div className="zl-collier-choix">
          {choix.map(({ key, icone: Icone }) => (
            <button
              key={key}
              type="button"
              className="zl-collier-onglet"
              aria-pressed={onglet === key}
              onClick={() => setOnglet(key)}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                <Icone size={13} /> {groupes[key].titre}
              </span>
              <span className="zl-onglet-nombre">{groupes[key].items?.length || 0}</span>
            </button>
          ))}
        </div>

        <div className="zl-collier-liste">
          {chargement && (
            <p className="zl-collier-vide">Analyse en cours…</p>
          )}
          {!chargement && (actif.items?.length || 0) === 0 && (
            <p className="zl-collier-vide"><Check size={13} /> {actif.vide}</p>
          )}
          {!chargement && onglet === 'alertes' && (alertes || []).map((a) => (
            <div key={a.id} className="zl-collier-item" data-grave={a.severity === 'critical' ? 'oui' : 'non'}>
              <div className="zl-collier-item-texte">
                <p className="zl-collier-item-titre">{a.team_name || 'Équipe'}</p>
                <p className="zl-collier-item-note">{a.message}</p>
              </div>
            </div>
          ))}
          {!chargement && onglet === 'orphelins' && (orphelins || []).map((o) => (
            <div key={o.id} className="zl-collier-item">
              <div className="zl-collier-item-texte">
                <p className="zl-collier-item-titre">{nomComplet(o)}</p>
                <p className="zl-collier-item-note">{o.position || o.department || 'Aucune équipe'}</p>
              </div>
              <div className="zl-carte-actions">
                {(o.suggested_teams || []).slice(0, 2).map((t) => (
                  <button key={t.id} type="button" className="zl-mini" onClick={() => onAjouterOrphelin(o.id, t.id)}>
                    <Plus size={11} /> {t.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {!chargement && onglet === 'suggestions' && (suggestions || []).map((s) => (
            <div key={s.id} className="zl-collier-item">
              <div className="zl-collier-item-texte">
                <p className="zl-collier-item-titre">{s.name} <span className="zl-etiquette" data-ton="bientot">{s.confidence}%</span></p>
                <p className="zl-collier-item-note">{s.reason}</p>
              </div>
              <button type="button" className="zl-mini" onClick={() => onCreerSuggestion(s)}>
                <Plus size={11} /> Créer l’équipe
              </button>
            </div>
          ))}
          {!chargement && onglet === 'besoins' && (besoins || []).map((n) => (
            <div key={n.team_id} className="zl-collier-item">
              <div className="zl-collier-item-texte">
                <p className="zl-collier-item-titre">{n.team_name}</p>
                <p className="zl-collier-item-note">
                  {n.current_size} personne{n.current_size > 1 ? 's' : ''} aujourd’hui,
                  {' '}{n.suggested_hires} de plus suggérée{n.suggested_hires > 1 ? 's' : ''}.
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default function EquipesVue({ enterpriseId: enterpriseIdProp, employes = [] }) {
  const [admin, setAdmin] = useState(null)
  const [enterpriseId, setEnterpriseId] = useState(enterpriseIdProp || null)
  const [raison, setRaison] = useState('ok')
  const [predictions, setPredictions] = useState(false)

  const [equipes, setEquipes] = useState([])
  const [santeGlobale, setSanteGlobale] = useState(null)
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
  const [vue, setVue] = useState('cartes')

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
        setSanteGlobale(sante.global || null)
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
  }, [orphelins, equipes, charger])

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
  // par zéro, et l'écran dit « effectif inconnu » au lieu d'inventer.
  const effectifConnu = useMemo(
    () => Math.max(employes.length, totalMembres, 0),
    [employes.length, totalMembres],
  )

  if (raison === 'sansEntreprise') {
    return (
      <div className="emp-vues">
        <div className="zl-vide">
          <RosacePerlesSvg taille={76} ton="teal" />
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
        <div className="zl-vide">
          <RosacePerlesSvg taille={76} ton="cuivre" />
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
    <div className="emp-vues">
      {/* ══ LA SCÈNE : la frise, le titre, les actions ══ */}
      <section className="zl-scene" aria-label="Vue Équipes">
        <div className="zl-scene-frise">
          <FrisePerlesSvg hauteur={52} motif="chevrons" />
          <div className="zl-scene-frise-pampilles">
            <PampillesSvg nombre={30} hauteur={20} />
          </div>
        </div>

        <div className="zl-scene-corps">
          <div className="zl-scene-texte">
            <p className="zl-eyebrow">
              <LosangePerlesSvg taille={16} ton="cuivre" />
              Vue d’ensemble
            </p>
            <h2 className="zl-scene-titre">Équipes<span>.</span></h2>
            <p className="zl-scene-sous">
              <strong>{equipes.length}</strong> équipe{equipes.length > 1 ? 's' : ''} ·{' '}
              <strong>{totalMembres}</strong> membre{totalMembres > 1 ? 's' : ''} ·{' '}
              <strong>{totalChefs}</strong> chef{totalChefs > 1 ? 's' : ''} d’équipe désigné{totalChefs > 1 ? 's' : ''}
            </p>
          </div>
          <div className="zl-scene-actions">
            <button type="button" className="zl-bouton zl-bouton-icone" onClick={() => charger(enterpriseId)}
              aria-label="Rafraîchir les équipes" title="Rafraîchir (R)">
              <RefreshCw size={15} />
            </button>
            <button type="button" className="zl-bouton zl-bouton-icone"
              onClick={async () => { await chargerHistorique(); setMontrerHistorique(true) }}
              aria-label="Historique des équipes" title="Historique">
              <History size={15} />
            </button>
            <button type="button" className="zl-bouton zl-bouton-icone"
              onClick={() => setMontrerRaccourcis(true)} aria-label="Raccourcis clavier" title="Raccourcis (?)">
              <HelpCircle size={15} />
            </button>
            <button type="button" className="zl-bouton zl-bouton-principal" onClick={ouvrirNouvelleEquipe}>
              <Plus size={15} /> Nouvelle équipe
            </button>
          </div>
        </div>

        {/* ══ LES MÉDAILLONS : un anneau de perles par chiffre ══ */}
        <div className="zl-medaillons">
          <div className="zl-medaillon">
            <span className="zl-medaillon-rond">
              <AnneauPerlesSvg taille={58} parts={26} remplis={part(equipesAvecMembres, equipes.length, 26)} ton="cuivre" />
              <span className="zl-medaillon-cle">{equipes.length}</span>
            </span>
            <span className="zl-medaillon-texte">
              <span className="zl-medaillon-libelle">Équipes</span>
              <span className="zl-medaillon-note">
                {equipes.length === 0 ? 'à créer' : `${equipesAvecMembres} avec des membres`}
              </span>
            </span>
          </div>

          <div className="zl-medaillon">
            <span className="zl-medaillon-rond">
              <AnneauPerlesSvg taille={58} parts={26} remplis={part(totalMembres, effectifConnu, 26)} ton="teal" />
              <span className="zl-medaillon-cle">{totalMembres}</span>
            </span>
            <span className="zl-medaillon-texte">
              <span className="zl-medaillon-libelle">Membres</span>
              <span className="zl-medaillon-note">
                {effectifConnu > 0
                  ? `${Math.round((totalMembres / effectifConnu) * 100)} % de l’effectif`
                  : 'effectif inconnu'}
              </span>
            </span>
          </div>

          <div className="zl-medaillon">
            <span className="zl-medaillon-rond">
              <AnneauPerlesSvg taille={58} parts={26} remplis={part(totalChefs, equipes.length, 26)} ton="sauge" />
              <span className="zl-medaillon-cle">{totalChefs}</span>
            </span>
            <span className="zl-medaillon-texte">
              <span className="zl-medaillon-libelle">Chefs d’équipe</span>
              <span className="zl-medaillon-note">
                {equipes.length > 0 && totalChefs === equipes.length ? 'toutes dirigées' : 'des équipes sans chef'}
              </span>
            </span>
          </div>

          <div className="zl-medaillon">
            <span className="zl-medaillon-rond">
              <AnneauPerlesSvg taille={58} parts={26} remplis={part(orphelins.length, effectifConnu, 26)} ton="corail" />
              <span className="zl-medaillon-cle">{orphelins.length}</span>
            </span>
            <span className="zl-medaillon-texte">
              <span className="zl-medaillon-libelle">Sans équipe</span>
              <span className="zl-medaillon-note" data-ton={orphelins.length > 0 ? 'alerte' : 'ok'}>
                {orphelins.length > 0 ? 'à rattacher' : 'tous rattachés'}
              </span>
            </span>
          </div>
        </div>
      </section>

      <CollierEquipes
        alertes={alertes}
        orphelins={orphelins}
        suggestions={suggestions}
        besoins={besoins}
        santeGlobale={santeGlobale}
        onAjouterOrphelin={ajouterOrphelin}
        onCreerSuggestion={creerSuggestion}
        chargement={chargementAnalyses}
        predictions={predictions}
      />

      <div className="zl-outils">
        <label className="zl-recherche">
          <Search size={16} />
          <input
            ref={rechercheRef}
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher une équipe ou sa description"
            aria-label="Rechercher une équipe"
          />
          {recherche && (
            <button type="button" className="zl-recherche-effacer" onClick={() => setRecherche('')} aria-label="Effacer la recherche">
              <X size={13} />
            </button>
          )}
        </label>

        <div className="zl-choix" role="group" aria-label="Filtrer les équipes">
          {FILTRES.map((f) => (
            <button
              key={f.key}
              type="button"
              className="zl-puce"
              aria-pressed={filtre === f.key}
              onClick={() => setFiltre(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <select className="zl-select" value={tri} onChange={(e) => setTri(e.target.value)} aria-label="Trier les équipes">
          {TRIS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>

        <div className="zl-bascule" role="group" aria-label="Mode d’affichage">
          <button type="button" aria-pressed={vue === 'cartes'} onClick={() => setVue('cartes')}>
            <LayoutGrid size={13} /> Cartes
          </button>
          <button type="button" aria-pressed={vue === 'liste'} onClick={() => setVue('liste')}>
            <List size={13} /> Liste
          </button>
        </div>
        <span className="zl-compte">{equipesAffichees.length} affichée{equipesAffichees.length > 1 ? 's' : ''}</span>
      </div>

      {chargement ? (
        <div className="zl-chargement" aria-live="polite">
          <span className="zl-compte"><Loader2 size={14} className="spin" /> Chargement des équipes…</span>
          <div className="zl-chargement-ligne" />
          <div className="zl-chargement-ligne" />
          <div className="zl-chargement-ligne" />
        </div>
      ) : equipesAffichees.length === 0 ? (
        <div className="zl-vide">
          <Users size={26} />
          <h3>{equipes.length === 0 ? 'Aucune équipe pour l’instant' : 'Aucune équipe ne correspond'}</h3>
          <p>
            {equipes.length === 0
              ? 'Regroupez les personnes qui travaillent ensemble : le chef d’équipe, puis les membres. Les tâches pourront ensuite être confiées à l’équipe entière.'
              : 'Élargissez la recherche ou retirez le filtre pour revoir toutes les équipes.'}
          </p>
          <button type="button" className="zl-bouton zl-bouton-principal" onClick={ouvrirNouvelleEquipe}>
            <Plus size={15} /> Nouvelle équipe
          </button>
        </div>
      ) : vue === 'cartes' ? (
        <div className="zl-grille">
          {equipesAffichees.map((equipe) => (
            <CarteEquipe
              key={equipe.id}
              equipe={equipe}
              totalMembres={totalMembres}
              onMembres={ouvrirMembres}
              onModifier={ouvrirModification}
              onRetirer={(t) => { setASupprimer(t); setMontrerSuppression(true) }}
              onChangerChef={ouvrirModification}
            />
          ))}
        </div>
      ) : (
        <div className="zl-liste">
          {equipesAffichees.map((equipe) => (
            <LigneEquipe
              key={equipe.id}
              equipe={equipe}
              onMembres={ouvrirMembres}
              onModifier={ouvrirModification}
              onRetirer={(t) => { setASupprimer(t); setMontrerSuppression(true) }}
            />
          ))}
        </div>
      )}

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
