// ═══════════════════════════════════════════════════════════
// LA NAVIGATION — bogolan, renommable, rangeable, colorée
//
// Ce que l'administrateur peut faire ici, sans quitter la barre :
// renommer une page, la glisser dans un autre groupe (ou la
// remonter/descendre au clavier), créer un groupe, le nommer, le
// colorer, et choisir la teinte d'une page. Tout est retenu par
// administrateur dans le navigateur — `navigationPerso.js` tient
// la logique, ce fichier ne fait que la dessiner.
// ═══════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  CheckCircle2,
  ChevronDown,
  GripVertical,
  LayoutGrid,
  MoveDown,
  MoveUp,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
  Zap,
} from 'lucide-react'
import {
  COULEURS_GROUPES,
  ajouterGroupe,
  changerCouleurGroupe,
  changerCouleurPage,
  changerGroupePage,
  chargerNavigation,
  chargerReplis,
  deplacerGroupe,
  deplacerPage,
  deplacerPageCran,
  effacerNavigation,
  fusionnerModele,
  indexerPages,
  modeleParDefaut,
  pagesParGroupe,
  renommerGroupe,
  renommerPage,
  sauvegarderNavigation,
  sauvegarderReplis,
  supprimerGroupe,
  teinteRgba,
} from '../lib/navigationPerso'
import './SidebarNavigation.css'

function signatureSections(sections) {
  return sections
    .map((section) => `${section.label}:${(section.items || []).map((item) => `${item.path}:${item.show ? 1 : 0}`).join(',')}`)
    .join('|')
}

function teinteVersRgba(teinte, alpha) {
  return teinteRgba(teinte, alpha)
}

function NavItem({ page, item, cheminActif, tabState, onSelect }) {
  const Icon = item?.icon
  const actif = Boolean(item?.active) || item?.path === cheminActif
  const activiteNeuve = Boolean(tabState?.activeTriggers?.length && !tabState.viewed)
  return (
    <button
      type="button"
      className={`sidebar-link${actif ? ' is-active' : ''}`}
      style={{
        '--teinte-page': page.teinte,
        '--teinte-page-fond': teinteVersRgba(page.teinte, 0.18),
        '--teinte-page-trait': teinteVersRgba(page.teinte, 0.42),
      }}
      aria-current={actif ? 'page' : undefined}
      onClick={() => onSelect(item)}
    >
      <span className="sidebar-link-icon">{Icon ? <Icon size={16} strokeWidth={1.8} /> : null}</span>
      <span className="sidebar-link-label">{page.libelle}</span>
      {item?.count > 0 && <span className="sidebar-link-count">{item.count > 99 ? '99+' : item.count}</span>}
      {!item?.count && activiteNeuve && <span className="sidebar-link-dot" aria-label="Nouvelle activité" />}
    </button>
  )
}

function Pastilles({ valeur, surChoix, prefixe }) {
  return (
    <span className="sn-pastilles" role="group" aria-label={prefixe}>
      {COULEURS_GROUPES.map((couleur) => (
        <button
          key={couleur.id}
          type="button"
          className={`sn-pastille${valeur === couleur.id ? ' is-active' : ''}`}
          style={{ '--pastille': couleur.teinte }}
          aria-pressed={valeur === couleur.id}
          aria-label={`${prefixe} : ${couleur.libelle}`}
          title={couleur.libelle}
          onClick={() => surChoix(couleur.id)}
        />
      ))}
    </span>
  )
}

export default function SidebarNavigation({
  sections = [],
  tabStates = {},
  onSelect,
  idAdministrateur,
  // Les personnalisations du tableau et des actions rapides vivent ici
  // (plus de bouton dans la barre du haut) ; leur état est porté par
  // le tableau de bord, la sidebar ne fait que le basculer.
  tableauActif = false,
  surBasculerTableau = () => {},
  actionsActif = false,
  surBasculerActions = () => {},
}) {
  const { pathname } = useLocation()
  const signature = signatureSections(sections)
  const index = useMemo(() => indexerPages(sections), [signature]) // eslint-disable-line react-hooks/exhaustive-deps

  const [modele, setModele] = useState(() => chargerNavigation(null, idAdministrateur, sections))
  const [personnalisation, setPersonnalisation] = useState(false)
  const [pageGlissee, setPageGlissee] = useState(null)
  const [cible, setCible] = useState(null)
  const [nomNouveauGroupe, setNomNouveauGroupe] = useState('')
  const [couleurNouveauGroupe, setCouleurNouveauGroupe] = useState('cuivre')
  const [annonce, setAnnonce] = useState('')
  const [filtre, setFiltre] = useState('')
  const [replis, setReplis] = useState(() => chargerReplis(null, idAdministrateur))

  // Les pages et les groupes du code peuvent changer (module éteint,
  // nouvelle page) : on rapproche sans jamais perdre l'ordre choisi.
  const modeleAffiche = useMemo(() => fusionnerModele(modele, sections), [modele, signature]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    sauvegarderNavigation(null, idAdministrateur, modele)
  }, [modele, idAdministrateur])

  useEffect(() => {
    sauvegarderReplis(null, idAdministrateur, replis)
  }, [replis, idAdministrateur])

  // ── Filtre de navigation (accents et casse ignorés) ──
  const filtreActif = filtre.trim().length > 0
  const sansAccents = (texte) => String(texte || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const correspondFiltre = (libelle) => !filtreActif || sansAccents(libelle).includes(sansAccents(filtre))
  const basculerGroupe = (groupeId) => setReplis((courant) => (
    courant.includes(groupeId) ? courant.filter((id) => id !== groupeId) : [...courant, groupeId]
  ))

  useEffect(() => {
    if (!personnalisation) return undefined
    const surTouche = (evenement) => {
      if (evenement.key === 'Escape') {
        setPersonnalisation(false)
        setPageGlissee(null)
        setCible(null)
      }
    }
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [personnalisation])

  const blocs = useMemo(() => pagesParGroupe(modeleAffiche, index), [modeleAffiche, index])

  const annoncer = (texte) => setAnnonce(texte)

  const terminer = () => {
    setPersonnalisation(false)
    setPageGlissee(null)
    setCible(null)
    annoncer('')
  }

  const retablir = () => {
    const defaut = modeleParDefaut(sections)
    setModele(defaut)
    effacerNavigation(null, idAdministrateur)
    annoncer('Navigation d’origine rétablie.')
  }

  const deplacerVers = (cle, groupeCible, avantCle) => {
    if (!cle) return
    setModele((courant) => {
      const fusion = fusionnerModele(courant, sections)
      const dejaLa = fusion.pages.find((page) => page.cle === cle)
      const cibleGroupe = fusion.pages.filter((page) => page.groupe === groupeCible)
      const sans = cibleGroupe.filter((page) => page.cle !== cle)
      let position = sans.findIndex((page) => page.cle === avantCle)
      if (position < 0) position = sans.length
      if (dejaLa && dejaLa.groupe === groupeCible) {
        const actuelle = cibleGroupe.findIndex((page) => page.cle === cle)
        if (actuelle >= 0 && actuelle < position) position -= 1
      }
      return deplacerPage(fusion, cle, groupeCible, Math.max(0, position))
    })
    setPageGlissee(null)
    setCible(null)
  }

  const bougerPage = (page, sens) => {
    setModele((courant) => deplacerPageCran(fusionnerModele(courant, sections), page.cle, sens))
    annoncer(`${page.libelle} ${sens < 0 ? 'remontée' : 'descendue'}.`)
  }

  const changerDeGroupe = (cle, groupeId) => {
    setModele((courant) => changerGroupePage(fusionnerModele(courant, sections), cle, groupeId))
    const nom = modeleAffiche.groupes.find((groupe) => groupe.id === groupeId)?.nom
    annoncer(`Page rangée dans ${nom || 'le groupe'}.`)
  }

  return (
    <nav className="sidebar-navigation" aria-label="Navigation principale">
      {!personnalisation && (
        <div className="sn-filtre" role="search">
          <Search size={13} aria-hidden="true" />
          <input
            type="text"
            value={filtre}
            placeholder="Filtrer la navigation"
            aria-label="Filtrer la navigation"
            onChange={(evenement) => setFiltre(evenement.target.value)}
          />
          {filtre && (
            <button type="button" className="sn-filtre-effacer" aria-label="Effacer le filtre" onClick={() => setFiltre('')}>
              <X size={11} aria-hidden="true" />
            </button>
          )}
        </div>
      )}
      {personnalisation && (
        <p className="sn-aide">
          Glisse une page pour la ranger, clique son nom pour le changer, choisis sa couleur.
        </p>
      )}

      {blocs.map(({ groupe, pages }) => {
        // Un groupe vide ne s'affiche qu'en personnalisation : on le voit
        // pour y glisser une page, il ne prend pas de place sinon.
        if (!personnalisation && pages.length === 0) return null
        // Le filtre force les groupes dépliés et ne garde que les pages
        // qui correspondent ; le repli manuel ne s'applique pas alors.
        const pagesAffichees = filtreActif && !personnalisation
          ? pages.filter((page) => correspondFiltre(page.libelle))
          : pages
        if (filtreActif && !personnalisation && pagesAffichees.length === 0) return null
        const replie = !personnalisation && !filtreActif && replis.includes(groupe.id)
        const totalGroupe = pages.reduce((somme, page) => somme + (Number(page.item?.count) || 0), 0)
        const groupeCible = cible?.groupe === groupe.id
        const IconeRubrique = groupe.icone || null
        return (
          <section
            className={`sidebar-nav-group${groupeCible ? ' est-cible' : ''}`}
            key={groupe.id}
            data-rubrique={groupe.rubrique || undefined}
            style={{
              '--groupe-teinte': groupe.teinte,
              '--groupe-fond': teinteRgba(groupe.teinte, 0.16),
              '--groupe-trait': teinteRgba(groupe.teinte, 0.4),
            }}
            onDragOver={personnalisation ? (evenement) => {
              if (!pageGlissee) return
              evenement.preventDefault()
              setCible({ groupe: groupe.id, avantCle: null })
            } : undefined}
            onDrop={personnalisation ? (evenement) => {
              evenement.preventDefault()
              deplacerVers(pageGlissee, groupe.id, null)
            } : undefined}
          >
            {personnalisation ? (
              <div className="sn-groupe-tete">
                <span className="sn-groupe-point" aria-hidden="true" />
                <input
                  className="sn-champ sn-champ--groupe"
                  value={groupe.nom}
                  aria-label={`Nom du groupe ${groupe.nom}`}
                  maxLength={32}
                  onChange={(evenement) => setModele((courant) => renommerGroupe(courant, groupe.id, evenement.target.value))}
                  onBlur={(evenement) => setModele((courant) => renommerGroupe(courant, groupe.id, evenement.target.value))}
                />
                <Pastilles
                  valeur={groupe.couleur}
                  prefixe={`Couleur du groupe ${groupe.nom}`}
                  surChoix={(couleurId) => setModele((courant) => changerCouleurGroupe(courant, groupe.id, couleurId))}
                />
                <span className="sn-groupe-actions">
                  <button
                    type="button"
                    className="sn-icone"
                    aria-label={`Monter le groupe ${groupe.nom}`}
                    onClick={() => setModele((courant) => deplacerGroupe(courant, groupe.id, -1))}
                  >
                    <MoveUp size={12} />
                  </button>
                  <button
                    type="button"
                    className="sn-icone"
                    aria-label={`Descendre le groupe ${groupe.nom}`}
                    onClick={() => setModele((courant) => deplacerGroupe(courant, groupe.id, 1))}
                  >
                    <MoveDown size={12} />
                  </button>
                  {modeleAffiche.groupes.length > 1 && (
                    <button
                      type="button"
                      className="sn-icone sn-icone--danger"
                      aria-label={`Supprimer le groupe ${groupe.nom}`}
                      title="Les pages rejoignent le premier groupe"
                      onClick={() => {
                        setModele((courant) => supprimerGroupe(courant, groupe.id))
                        annoncer(`Groupe ${groupe.nom} supprimé ; ses pages ont rejoint le premier groupe.`)
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </span>
              </div>
            ) : (
              <p className={`sidebar-section-label${replie ? ' est-repliee' : ''}`}>
                <span className="sn-groupe-point" aria-hidden="true" />
                {IconeRubrique ? (
                  <span className="sidebar-section-icon" aria-hidden="true">
                    <IconeRubrique size={14} strokeWidth={1.8} />
                  </span>
                ) : null}
                <span className="sidebar-section-name">{groupe.nom}</span>
                {replie && totalGroupe > 0 && (
                  <span className="sidebar-section-count" title="Éléments à traiter dans ce groupe">{totalGroupe}</span>
                )}
                {!filtreActif && (
                  <button
                    type="button"
                    className="sn-chevron"
                    aria-expanded={!replie}
                    aria-label={replie ? `Déplier le groupe ${groupe.nom}` : `Replier le groupe ${groupe.nom}`}
                    onClick={() => basculerGroupe(groupe.id)}
                  >
                    <ChevronDown size={13} aria-hidden="true" />
                  </button>
                )}
              </p>
            )}

            {replie ? null : (
            <div className="sidebar-nav-list">
              {pagesAffichees.length === 0 && (
                <p className="sn-vide">{personnalisation ? 'Groupe vide — glisse une page ici.' : 'Aucune page visible.'}</p>
              )}

              {pagesAffichees.map((page) => {
                if (!personnalisation) {
                  return (
                    <NavItem
                      key={page.cle}
                      page={page}
                      item={page.item}
                      cheminActif={pathname}
                      tabState={page.item?.tabKey ? tabStates[page.item.tabKey] : null}
                      onSelect={onSelect}
                    />
                  )
                }

                const avantMoi = cible?.groupe === groupe.id && cible?.avantCle === page.cle
                return (
                  <div
                    key={page.cle}
                    className={`sn-page${pageGlissee === page.cle ? ' is-glissee' : ''}${avantMoi ? ' est-cible' : ''}`}
                    draggable
                    onDragStart={(evenement) => {
                      setPageGlissee(page.cle)
                      evenement.dataTransfer.effectAllowed = 'move'
                      evenement.dataTransfer.setData('text/plain', page.cle)
                    }}
                    onDragEnd={() => { setPageGlissee(null); setCible(null) }}
                    onDragOver={(evenement) => {
                      evenement.preventDefault()
                      evenement.stopPropagation()
                      setCible({ groupe: groupe.id, avantCle: page.cle })
                    }}
                    onDrop={(evenement) => {
                      evenement.preventDefault()
                      evenement.stopPropagation()
                      deplacerVers(pageGlissee, groupe.id, page.cle)
                    }}
                  >
                    <span className="sn-poignee" aria-hidden="true"><GripVertical size={13} /></span>
                    <input
                      className="sn-champ sn-champ--page"
                      value={page.libelle}
                      aria-label={`Renommer ${page.libelle}`}
                      maxLength={42}
                      onChange={(evenement) => setModele((courant) => renommerPage(courant, page.cle, evenement.target.value))}
                    />
                    <Pastilles
                      valeur={page.couleurId}
                      prefixe={`Couleur de ${page.libelle}`}
                      surChoix={(couleurId) => setModele((courant) => changerCouleurPage(courant, page.cle, couleurId))}
                    />
                    <label className="sn-groupe-choix">
                      <span className="sn-lecteur">Groupe de {page.libelle}</span>
                      <select
                        value={page.groupe}
                        onChange={(evenement) => changerDeGroupe(page.cle, evenement.target.value)}
                      >
                        {modeleAffiche.groupes.map((option) => (
                          <option key={option.id} value={option.id}>{option.nom}</option>
                        ))}
                      </select>
                      <ChevronDown size={11} aria-hidden="true" />
                    </label>
                    <span className="sn-page-actions">
                      <button
                        type="button"
                        className="sn-icone"
                        aria-label={`Monter ${page.libelle}`}
                        onClick={() => bougerPage(page, -1)}
                      >
                        <MoveUp size={12} />
                      </button>
                      <button
                        type="button"
                        className="sn-icone"
                        aria-label={`Descendre ${page.libelle}`}
                        onClick={() => bougerPage(page, 1)}
                      >
                        <MoveDown size={12} />
                      </button>
                    </span>
                  </div>
                )
              })}
            </div>
            )}
          </section>
        )
      })}

      {filtreActif && !personnalisation && (
        blocs.every(({ pages }) => !pages.some((page) => correspondFiltre(page.libelle))) ? (
          <p className="sn-vide sn-vide--filtre">Aucune page ne correspond à « {filtre.trim()} ».</p>
        ) : null
      )}

      {personnalisation && (
        <div className="sn-nouveau">
          <p className="sn-nouveau-titre">
            <Plus size={12} aria-hidden="true" /> Nouveau groupe
          </p>
          <input
            className="sn-champ"
            placeholder="Nom du groupe"
            aria-label="Nom du nouveau groupe"
            value={nomNouveauGroupe}
            maxLength={32}
            onChange={(evenement) => setNomNouveauGroupe(evenement.target.value)}
          />
          <div className="sn-nouveau-pied">
            <Pastilles
              valeur={couleurNouveauGroupe}
              prefixe="Couleur du nouveau groupe"
              surChoix={setCouleurNouveauGroupe}
            />
            <button
              type="button"
              className="sn-creer"
              disabled={!nomNouveauGroupe.trim()}
              onClick={() => {
                if (!nomNouveauGroupe.trim()) return
                setModele((courant) => ajouterGroupe(courant, nomNouveauGroupe, couleurNouveauGroupe))
                annoncer(`Groupe ${nomNouveauGroupe.trim()} créé.`)
                setNomNouveauGroupe('')
              }}
            >
              Créer
            </button>
          </div>
        </div>
      )}

      {/* Les personnalisations, regroupées en bas du panneau (section
          Réglages de la sidebar) : plus aucun bouton « Personnaliser »
          dans la barre du haut ni dans les panneaux du tableau. */}
      <div className="sn-outils">
        <p className="sn-outils-titre">Personnalisation</p>
        <div className="sn-outils-grille">
          <button
            type="button"
            className={`sn-bascule${tableauActif ? ' is-active' : ''}`}
            aria-pressed={tableauActif}
            onClick={surBasculerTableau}
          >
            {tableauActif ? <CheckCircle2 size={13} /> : <LayoutGrid size={13} />}
            <span>{tableauActif ? 'Terminer le tableau' : 'Personnaliser le tableau'}</span>
          </button>
          <button
            type="button"
            className={`sn-bascule${actionsActif ? ' is-active' : ''}`}
            aria-pressed={actionsActif}
            onClick={surBasculerActions}
          >
            {actionsActif ? <CheckCircle2 size={13} /> : <Zap size={13} />}
            <span>{actionsActif ? 'Terminer les actions' : 'Personnaliser les actions'}</span>
          </button>
          <button
            type="button"
            className="sn-bascule sn-bascule--large"
            aria-pressed={personnalisation}
            aria-expanded={personnalisation}
            onClick={() => (personnalisation ? terminer() : setPersonnalisation(true))}
          >
            {personnalisation ? <CheckCircle2 size={13} /> : <SlidersHorizontal size={13} />}
            <span>{personnalisation ? 'Terminer' : 'Personnaliser la navigation'}</span>
          </button>
          {personnalisation && (
            <button type="button" className="sn-retablir" onClick={retablir}>
              <RotateCcw size={12} />
              <span>Rétablir</span>
            </button>
          )}
        </div>
      </div>

      <p className="sn-annonce" role="status" aria-live="polite">{annonce}</p>
    </nav>
  )
}
