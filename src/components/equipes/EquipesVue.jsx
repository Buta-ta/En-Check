// ════════════════════════════════════════════════════════════════
// 👥 VUE « ÉQUIPES » — page Employés
//
// L'écran se lit en quatre plans :
//
//   0. sa tête — le titre « Équipes » et les quatre chiffres, cerclés d'une
//      seule bande de bogolan. Depuis le 21/11, l'onglet porte le haut de la
//      page : l'en-tête d'annuaire ne se monte plus ici ;
//   1. quatre chiffres comptés sur les équipes chargées ;
//   2. les équipes en cartes, à bordure colorée : le nom, la
//      pastille de santé, la pile d'avatars (le chef couronné),
//      le pied qui compte ;
//   3. un rail à droite : les personnes à rattacher, la
//      répartition de la santé ; et le pied « À décider »,
//      replié par défaut.
//
// Mêmes tokens, même police, même thème que le reste de la page.
// Les fenêtres (créer, membres, chef, supprimer) sont partagées :
// voir EquipesModales.jsx.
// ════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronDown, Crown, HelpCircle, History,
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
import '../../pages/EmployesRefonte.css'
import './EquipesVue.css'

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
// ── la carte d'équipe : trait de couleur, nom, santé, membres ──
function CarteEquipe({ equipe, onMembres, onModifier, onRetirer, onChangerChef }) {
  const [menu, setMenu] = useState(false)
  const actionsRef = useRef(null)
  const membres = equipe?.members || []
  const effectif = equipe.member_count ?? membres.length
  const score = Number(equipe?.health?.health_score)
  const suivi = Number.isFinite(score)
  const etat = suivi ? (ETAT_SANTE[equipe?.health?.status] || ETAT_SANTE.healthy) : null

  // même règle que dans l'annuaire : le menu se referme au clic
  // ailleurs et à Échap, et sa carte passe devant les suivantes
  useEffect(() => {
    if (!menu) return undefined
    const surPointeur = (evenement) => {
      if (!actionsRef.current?.contains(evenement.target)) setMenu(false)
    }
    const surTouche = (evenement) => {
      if (evenement.key === 'Escape') setMenu(false)
    }
    document.addEventListener('pointerdown', surPointeur)
    document.addEventListener('keydown', surTouche)
    return () => {
      document.removeEventListener('pointerdown', surPointeur)
      document.removeEventListener('keydown', surTouche)
    }
  }, [menu])

  return (
    <article className="eqv2-carte" data-menu={menu ? 'ouvert' : undefined}>
      <span
        className="eqv2-carte-trait"
        style={{ background: equipe.color || '#c9a961' }}
        aria-hidden="true"
      />
      <div className="eqv2-carte-corps">
        <div className="eqv2-carte-tete">
          <h4 className="eqv2-carte-nom">
            <button type="button" onClick={() => onModifier(equipe)}>{equipe.name}</button>
          </h4>
          <span className={`eqv2-sante-badge eqv2-sante-badge--${etat ? etat.ton : 'inconnue'}`}>
            {etat ? etat.libelle : 'Non suivie'}
          </span>
          <span className="eqv2-carte-menu-wrap" ref={actionsRef}>
            <button
              type="button"
              className="eqv2-plus"
              aria-label={`Actions pour ${equipe.name}`}
              aria-expanded={menu}
              aria-haspopup="true"
              onClick={() => setMenu((v) => !v)}
            >
              <MoreVertical size={14} />
            </button>
            {menu && (
              <div className="empv2-menu" role="group" aria-label={`Actions pour ${equipe.name}`}>
                <button type="button" onClick={() => { setMenu(false); onModifier(equipe) }}>
                  <UserCog size={13} /> Modifier l’équipe
                </button>
                <button type="button" onClick={() => { setMenu(false); onMembres(equipe) }}>
                  <UserPlus size={13} /> Gérer les membres
                </button>
                <button type="button" onClick={() => { setMenu(false); onChangerChef(equipe) }}>
                  <Users size={13} /> Changer de chef
                </button>
                <span className="empv2-menu-sep" aria-hidden="true" />
                <button type="button" className="is-danger" onClick={() => { setMenu(false); onRetirer(equipe) }}>
                  <UserMinus size={13} /> Supprimer
                </button>
              </div>
            )}
          </span>
        </div>

        <p className="eqv2-carte-note">
          {equipe.description || 'Sans description — utile pour situer l’équipe.'}
        </p>

        <div className="eqv2-avatars" aria-label={`Membres de ${equipe.name}`}>
          {membres.slice(0, 5).map((m) => {
            const personne = m.employee || m
            const chef = (personne?.id || m.employee_id) === equipe.leader_employee_id
            return (
              <span
                className="eqv2-avatar"
                key={personne?.id || m.id || m.employee_id}
                data-chef={chef ? 'oui' : 'non'}
                title={`${nomComplet(personne)}${chef ? ' — chef d’équipe' : ''}`}
              >
                {chef && <Crown size={10} className="eqv2-couronne" aria-hidden="true" />}
                {personne?.photo_url
                  ? <img src={personne.photo_url} alt="" />
                  : initiales(personne)}
              </span>
            )
          })}
          {membres.length > 5 && <span className="eqv2-avatars-note">+{membres.length - 5}</span>}
        </div>

        <p className="eqv2-carte-pied">
          <span>{effectif} membre{effectif > 1 ? 's' : ''}</span>
          <span className={equipe.leader ? undefined : 'eqv2-carte-sanschef'}>
            {equipe.leader ? `chef : ${nomComplet(equipe.leader)}` : 'sans chef'}
          </span>
        </p>
      </div>
    </article>
  )
}

// ── le rail « À rattacher » : les personnes sans équipe ─────────
function RattacherPanel({ orphelins, equipes, onRattacher }) {
  const [menuOuvert, setMenuOuvert] = useState(null)
  const menuRef = useRef(null)

  // le menu d'une ligne se referme au clic ailleurs ou à Échap
  useEffect(() => {
    if (menuOuvert === null) return undefined
    const surPointeur = (evenement) => {
      if (!menuRef.current?.contains(evenement.target)) setMenuOuvert(null)
    }
    const surTouche = (evenement) => {
      if (evenement.key === 'Escape') setMenuOuvert(null)
    }
    document.addEventListener('pointerdown', surPointeur)
    document.addEventListener('keydown', surTouche)
    return () => {
      document.removeEventListener('pointerdown', surPointeur)
      document.removeEventListener('keydown', surTouche)
    }
  }, [menuOuvert])

  return (
    <section className="eqv2-panneau" aria-label="À rattacher">
      <h3 className="eqv2-panneau-titre">À rattacher</h3>
      {orphelins.length === 0 ? (
        <p className="eqv2-panneau-vide">Tout le monde est rattaché à une équipe.</p>
      ) : (
        <ul className="eqv2-rattacher-liste">
          {orphelins.slice(0, 6).map((o) => (
            <li className="eqv2-rattacher-ligne" key={o.id}>
              <span className="eqv2-avatar" aria-hidden="true">
                {o.photo_url ? <img src={o.photo_url} alt="" /> : initiales(o)}
              </span>
              <span className="eqv2-rattacher-info">
                <strong>{nomComplet(o)}</strong>
                <small>{[o.position, o.department].filter(Boolean).join(' · ') || 'Fiche à compléter'}</small>
              </span>
              <span className="eqv2-rattacher-actions" ref={menuOuvert === o.id ? menuRef : null}>
                <button
                  type="button"
                  className="eqv2-btn-mini"
                  aria-expanded={menuOuvert === o.id}
                  onClick={() => setMenuOuvert(menuOuvert === o.id ? null : o.id)}
                >
                  Rattacher →
                </button>
                {menuOuvert === o.id && (
                  <div className="empv2-menu eqv2-menu-rattacher" role="group" aria-label={`Rattacher ${nomComplet(o)}`}>
                    {equipes.length === 0 && (
                      <p className="eqv2-panneau-vide">Créez d’abord une équipe.</p>
                    )}
                    {equipes.map((e) => (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => { setMenuOuvert(null); onRattacher(o.id, e.id) }}
                      >
                        <span className="eqv2-menu-pastille" style={{ background: e.color || 'var(--empv2-or)' }} aria-hidden="true" />
                        {e.name}
                      </button>
                    ))}
                  </div>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// ── le rail « Santé des équipes » : la répartition, en barres ──
function SantePanel({ equipes, predictions }) {
  const parTon = { solide: 0, 'a-surveiller': 0, critique: 0 }
  let suivies = 0
  equipes.forEach((e) => {
    const score = Number(e?.health?.health_score)
    if (!Number.isFinite(score)) return
    suivies += 1
    const ton = ETAT_SANTE[e.health.status]?.ton || 'solide'
    parTon[ton] += 1
  })

  const lignes = [
    { ton: 'solide', libelle: 'Solides' },
    { ton: 'a-surveiller', libelle: 'À surveiller' },
    { ton: 'critique', libelle: 'Critiques' },
  ]

  return (
    <section className="eqv2-panneau" aria-label="Santé des équipes">
      <h3 className="eqv2-panneau-titre">Santé des équipes</h3>
      {!predictions || suivies === 0 ? (
        <p className="eqv2-panneau-vide">
          La santé des équipes n’est pas mesurée
          {predictions ? '' : ' : l’option Prédictions est désactivée sur cette entreprise'}.
        </p>
      ) : (
        <ul className="eqv2-sante-liste">
          {lignes.map(({ ton, libelle }) => (
            <li className="eqv2-sante-ligne" key={ton} data-ton={ton}>
              <span className="eqv2-sante-haut">
                <span>{libelle}</span>
                <strong>{parTon[ton]}</strong>
              </span>
              <span className="eqv2-sante-jauge" aria-hidden="true">
                <span
                  className="eqv2-sante-remplie"
                  style={{ width: `${equipes.length > 0 ? Math.round((parTon[ton] / equipes.length) * 100) : 0}%` }}
                />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
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
      <footer className="empv2-pied">
        <p className="empv2-pied-titre">
          À décider
          <span className="empv2-pied-texte">
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
    <footer className="empv2-pied">
      <div className="empv2-pied-ligne">
        <p className="empv2-pied-titre">
          À décider
          <span className="empv2-pied-texte">
            {chargement
              ? 'Analyse en cours…'
              : total === 0
                ? 'Rien à arbitrer : les équipes tiennent.'
                : `${total} point${total > 1 ? 's' : ''} à arbitrer`}
          </span>
        </p>
        <button
          type="button"
          className="empv2-lien"
          aria-expanded={ouvert}
          onClick={() => setOuvert((v) => !v)}
        >
          <Sparkles size={12} /> {ouvert ? 'Refermer' : 'Ouvrir le registre'}
          <ChevronDown size={13} style={{ transform: ouvert ? 'rotate(180deg)' : 'none' }} />
        </button>
      </div>

      {ouvert && (
        <>
          <div className="empv2-pied-onglets" role="group" aria-label="Ce qui demande une décision">
            {onglets.map((o) => (
              <button
                key={o.cle}
                type="button"
                className="empv2-lien"
                aria-pressed={onglet === o.cle}
                onClick={() => setOnglet(o.cle)}
              >
                {o.libelle} <span className="empv2-pied-nombre">{o.nombre}</span>
              </button>
            ))}
          </div>

          <div className="empv2-pied-liste">
            {actif.nombre === 0 && (
              <p className="empv2-pied-item-note" style={{ padding: '12px 0' }}>{actif.vide}</p>
            )}

            {onglet === 'alertes' && alertes.map((a) => (
              <div key={a.id} className="empv2-pied-item" data-grave={a.severity === 'critical' ? 'oui' : 'non'}>
                <div>
                  <p className="empv2-pied-item-titre">{a.team_name || 'Équipe'}</p>
                  <p className="empv2-pied-item-note">{a.message}</p>
                </div>
              </div>
            ))}

            {onglet === 'orphelins' && orphelins.map((o) => (
              <div key={o.id} className="empv2-pied-item">
                <div>
                  <p className="empv2-pied-item-titre">{nomComplet(o)}</p>
                  <p className="empv2-pied-item-note">{o.position || o.department || 'Aucune équipe'}</p>
                </div>
                <div className="empv2-pied-item-actions">
                  <select
                    className="empv2-tri"
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
              <div key={s.id} className="empv2-pied-item">
                <div>
                  <p className="empv2-pied-item-titre">{s.name}</p>
                  <p className="empv2-pied-item-note">{s.reason}</p>
                </div>
                <div className="empv2-pied-item-actions">
                  <button type="button" className="empv2-lien" onClick={() => onCreerSuggestion(s)}>
                    Créer cette équipe
                  </button>
                </div>
              </div>
            ))}

            {onglet === 'besoins' && besoins.map((n) => (
              <div key={n.team_id} className="empv2-pied-item">
                <div>
                  <p className="empv2-pied-item-titre">{n.team_name}</p>
                  <p className="empv2-pied-item-note">
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

export default function EquipesVue({ enterpriseId: enterpriseIdProp, employes = [], signalCreation = 0 }) {
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

  // Le bouton « Nouvelle équipe » vit dans la ligne de titre de la
  // page : le signal monte, la vue ouvre sa fenêtre.
  useEffect(() => {
    if (signalCreation > 0) {
      setEquipeChoisie(null)
      setMontrerEquipe(true)
    }
  }, [signalCreation])

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
      <div className="emp-vues eqv2 eqv2--postit">
        <div className="eqv2-vide">
          <h3>Sélectionnez une entreprise</h3>
          <p>
            Les équipes se lisent entreprise par entreprise. Choisissez-la dans
            la sidebar, puis revenez sur cet onglet.
          </p>
        </div>
      </div>
    )
  }

  if (raison === 'sansOption') {
    return (
      <div className="emp-vues eqv2 eqv2--postit">
        <div className="eqv2-vide">
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

  const sansChef = equipes.length - totalChefs

  return (
    <div className="emp-vues eqv2 eqv2--postit">
      {/* la tête de l'onglet — et donc la tête de la page : un en-tête cerclé
          par écran, pas deux. Le titre et les quatre chiffres sous UNE SEULE
          bande de bogolan, le dispositif de la fiche employé et de l'onglet
          Tâches. Le chiffre se lit sur la plaque de papier : le tissu ne passe
          jamais sous un mot (refus enregistré sur la page). */}
      <header className="eqv2-tete">
        <h1 className="eqv2-titre">Équipes</h1>

        <div className="eqv2-kpis" aria-label="Chiffres des équipes">
          <div className="empv2-kpi">
            <div className="empv2-kpi-haut"><strong>{equipes.length}</strong></div>
            <span className="empv2-kpi-libelle">Équipes</span>
          </div>
          <div className="empv2-kpi">
            <div className="empv2-kpi-haut"><strong>{totalMembres}</strong></div>
            <span className="empv2-kpi-libelle">Membres</span>
          </div>
          <div className="empv2-kpi">
            <div className="empv2-kpi-haut"><strong>{sansChef}</strong></div>
            <span className="empv2-kpi-libelle"><i className="empv2-point empv2-point--orange" aria-hidden="true" />Sans chef</span>
          </div>
          <div className="empv2-kpi">
            <div className="empv2-kpi-haut"><strong>{orphelins.length}</strong></div>
            <span className="empv2-kpi-libelle"><i className="empv2-point empv2-point--or" aria-hidden="true" />À rattacher</span>
          </div>
        </div>
      </header>

      {/* la barre d'outils : chercher, filtrer, trier, rafraîchir */}
      <div className="eqv2-outils">
        <label className="empv2-recherche eqv2-recherche">
          <Search size={14} />
          <input
            ref={rechercheRef}
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher une équipe..."
            aria-label="Rechercher une équipe"
          />
          {recherche && (
            <button type="button" className="empv2-recherche-effacer" onClick={() => setRecherche('')} aria-label="Effacer la recherche">
              <X size={12} />
            </button>
          )}
        </label>

        <div className="eqv2-filtres" role="group" aria-label="Filtrer les équipes">
          {FILTRES.map((f) => (
            <button
              key={f.key}
              type="button"
              className="eqv2-filtre"
              aria-pressed={filtre === f.key}
              onClick={() => setFiltre(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <select className="eqv2-tri" value={tri} onChange={(e) => setTri(e.target.value)} aria-label="Trier les équipes">
          {TRIS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>

        <span className="empv2-liens">
          <button type="button" className="empv2-lien" onClick={() => charger(enterpriseId)} title="Rafraîchir (R)">
            <RefreshCw size={12} /> Rafraîchir
          </button>
          <button
            type="button"
            className="empv2-lien"
            onClick={async () => { await chargerHistorique(); setMontrerHistorique(true) }}
          >
            <History size={12} /> Historique
          </button>
          <button
            type="button"
            className="empv2-lien"
            onClick={() => setMontrerRaccourcis(true)}
            aria-label="Raccourcis clavier"
            title="Raccourcis (?)"
          >
            <HelpCircle size={13} />
          </button>
        </span>

        {/* « Nouvelle équipe » : le bouton vivait dans l'en-tête de page, qui
            ne se monte plus sur l'onglet. Le voilà dans la barre d'outils, à la
            place qu'il a dans l'onglet Tâches — la seule variante pleine.
            La touche « n » du clavier fait toujours la même chose. */}
        <span className="eqv2-actions">
          <button type="button" className="empv2-nouvel" onClick={ouvrirNouvelleEquipe}>
            <Plus size={14} aria-hidden="true" /> Nouvelle équipe
          </button>
        </span>
      </div>

      {/* les cartes, à gauche ; le rail des décisions, à droite */}
      <div className="eqv2-corps">
        <div className="eqv2-collonne">
          {chargement ? (
            <div className="eqv2-chargement" aria-live="polite">
              <span className="eqv2-chargement-texte"><Loader2 size={14} className="eqv2-tourne" /> Chargement des équipes…</span>
            </div>
          ) : equipesAffichees.length === 0 ? (
            <div className="eqv2-vide">
              <h3>{equipes.length === 0 ? 'Aucune équipe pour l’instant' : 'Aucune équipe ne correspond'}</h3>
              <p>
                {equipes.length === 0
                  ? 'Regroupez les personnes qui travaillent ensemble : le chef d’équipe, puis les membres. Les tâches pourront ensuite être confiées à l’équipe entière.'
                  : 'Élargissez la recherche ou retirez le filtre pour revoir toutes les équipes.'}
              </p>
              <button type="button" className="empv2-nouvel" onClick={ouvrirNouvelleEquipe}>
                <Plus size={14} /> Nouvelle équipe
              </button>
            </div>
          ) : (
            <div className="eqv2-grille" aria-label="Les équipes">
              {equipesAffichees.map((equipe) => (
                <CarteEquipe
                  key={equipe.id}
                  equipe={equipe}
                  onMembres={ouvrirMembres}
                  onModifier={ouvrirModification}
                  onRetirer={(t) => { setASupprimer(t); setMontrerSuppression(true) }}
                  onChangerChef={ouvrirModification}
                />
              ))}
            </div>
          )}
        </div>

        <div className="eqv2-rais">
          <RattacherPanel orphelins={orphelins} equipes={equipes} onRattacher={ajouterOrphelin} />
          <SantePanel equipes={equipes} predictions={predictions} />
        </div>
      </div>

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
