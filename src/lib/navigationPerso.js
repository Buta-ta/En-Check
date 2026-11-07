// ═══════════════════════════════════════════════════════════
// LA NAVIGATION PERSONNELLE DE L'ADMINISTRATEUR
//
// La barre latérale n'est plus une liste figée : chaque
// administrateur peut renommer ses pages, les ranger dans les
// groupes qu'il crée, changer l'ordre et choisir la teinte d'un
// groupe ou d'une page. Tout est tenu par ce module, sans React :
// les mêmes fonctions servent à l'écran et aux tests.
//
// Rien n'est inventé : une page qui n'existe pas dans les sections
// fournies est ignorée, une page nouvelle y apparaît d'elle-même,
// et un enregistrement abîmé est écarté sans casser la barre.
// ═══════════════════════════════════════════════════════════

export const VERSION_MODELE = 1

// Les cinq teintes de la planche : cuivre, terre, olive, ambre, ardoise.
// Elles remplacent l'ancienne palette indigo : le bogolan se lit en
// terres chaudes sur espresso.
export const COULEURS_GROUPES = [
  { id: 'cuivre', libelle: 'Cuivre', teinte: '#C1743C' },
  { id: 'terre', libelle: 'Terre', teinte: '#9A4A2E' },
  { id: 'olive', libelle: 'Olive', teinte: '#7C8A46' },
  { id: 'ambre', libelle: 'Ambre', teinte: '#D8A13C' },
  { id: 'ardoise', libelle: 'Ardoise', teinte: '#6E7F91' },
]

const TEINTE_PAR_ID = new Map(COULEURS_GROUPES.map((couleur) => [couleur.id, couleur.teinte]))
const PREMIERE_TEINTE = COULEURS_GROUPES[0].teinte

/** La teinte d'une couleur connue, sinon celle du groupe par défaut. */
export function teinteDe(couleurId) {
  return TEINTE_PAR_ID.get(couleurId) || PREMIERE_TEINTE
}

/** Un identifiant sûr pour un groupe créé par l'administrateur. */
function nouvelIdGroupe(groupes) {
  let numero = groupes.length + 1
  let id = `groupe-${numero}`
  const pris = new Set(groupes.map((groupe) => groupe.id))
  while (pris.has(id)) {
    numero += 1
    id = `groupe-${numero}`
  }
  return id
}

/** Les pages réellement proposées par les sections de la barre. */
function clesDesSections(sections = []) {
  const cles = []
  sections.forEach((section) => {
    ;(section.items || []).forEach((item) => {
      if (item && item.path && !cles.includes(item.path)) cles.push(item.path)
    })
  })
  return cles
}

/**
 * Le modèle d'origine : un groupe par section, une page par entrée,
 * dans l'ordre du code et avec les couleurs de la planche.
 */
export function modeleParDefaut(sections = []) {
  const groupes = []
  const pages = []

  sections.forEach((section, indexSection) => {
    const items = (section.items || []).filter((item) => item && item.path)
    if (!items.length) return
    const couleur = COULEURS_GROUPES[indexSection % COULEURS_GROUPES.length]
    const id = `groupe-${groupes.length + 1}`
    groupes.push({
      id,
      nom: String(section.label || `Groupe ${groupes.length + 1}`),
      couleur: couleur.id,
    })
    items.forEach((item) => {
      if (pages.some((page) => page.cle === item.path)) return
      pages.push({ cle: item.path, libelle: String(item.label || item.path), groupe: id, couleur: null })
    })
  })

  return { version: VERSION_MODELE, groupes, pages }
}

/** Un index pratique : clé de page → entrée de section (icône, compteur, show). */
export function indexerPages(sections = []) {
  const index = new Map()
  sections.forEach((section) => {
    ;(section.items || []).forEach((item) => {
      if (item && item.path && !index.has(item.path)) index.set(item.path, item)
    })
  })
  return index
}

function estTexte(value) {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * Rapproche un modèle enregistré des sections du moment : on garde
 * l'ordre et les noms de l'administrateur, on ajoute les nouvelles
 * pages, on écarte les pages disparues et les groupes inconnus.
 */
export function fusionnerModele(modele, sections = []) {
  const defaut = modeleParDefaut(sections)
  const cles = clesDesSections(sections)
  const clesConnues = new Set(cles)

  const groupesSource = Array.isArray(modele?.groupes) ? modele.groupes : []
  const groupes = []
  const idsVus = new Set()

  groupesSource.forEach((groupe) => {
    if (!groupe || !estTexte(groupe.id) || idsVus.has(groupe.id)) return
    idsVus.add(groupe.id)
    groupes.push({
      id: groupe.id,
      nom: estTexte(groupe.nom) ? groupe.nom.trim() : `Groupe ${groupes.length + 1}`,
      couleur: TEINTE_PAR_ID.has(groupe.couleur) ? groupe.couleur : COULEURS_GROUPES[groupes.length % COULEURS_GROUPES.length].id,
    })
  })

  defaut.groupes.forEach((groupe) => {
    if (!idsVus.has(groupe.id)) {
      idsVus.add(groupe.id)
      groupes.push({ ...groupe })
    }
  })

  const idsGroupes = new Set(groupes.map((groupe) => groupe.id))
  const groupeDeSecours = groupes[0]?.id || null
  const pagesSource = Array.isArray(modele?.pages) ? modele.pages : []
  const pages = []
  const pagesVues = new Set()

  pagesSource.forEach((page) => {
    if (!page || !clesConnues.has(page.cle) || pagesVues.has(page.cle)) return
    pagesVues.add(page.cle)
    const defautPage = defaut.pages.find((candidate) => candidate.cle === page.cle)
    const groupe = idsGroupes.has(page.groupe) ? page.groupe : (defautPage?.groupe || groupeDeSecours)
    pages.push({
      cle: page.cle,
      libelle: estTexte(page.libelle) ? page.libelle.trim() : (defautPage?.libelle || page.cle),
      groupe,
      couleur: TEINTE_PAR_ID.has(page.couleur) ? page.couleur : null,
    })
  })

  defaut.pages.forEach((page) => {
    if (pagesVues.has(page.cle)) return
    pagesVues.add(page.cle)
    pages.push({
      ...page,
      groupe: idsGroupes.has(page.groupe) ? page.groupe : groupeDeSecours,
    })
  })

  return { version: VERSION_MODELE, groupes, pages }
}

// ── Lecture et écriture de la mémoire de l'administrateur ──

export function cleStockage(idAdmin) {
  return `encheck_navigation_admin_v1:${idAdmin || 'administrateur'}`
}

/** Rend un stockage utilisable même si le navigateur le refuse. */
function stockageSur(stockage) {
  if (stockage) return stockage
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

export function chargerNavigation(stockage, idAdmin, sections = []) {
  const cible = stockageSur(stockage)
  if (!cible) return modeleParDefaut(sections)
  try {
    const brut = cible.getItem(cleStockage(idAdmin))
    if (!brut) return modeleParDefaut(sections)
    const lu = JSON.parse(brut)
    if (!lu || lu.version !== VERSION_MODELE) return modeleParDefaut(sections)
    return fusionnerModele(lu, sections)
  } catch {
    return modeleParDefaut(sections)
  }
}

export function sauvegarderNavigation(stockage, idAdmin, modele) {
  const cible = stockageSur(stockage)
  if (!cible) return false
  try {
    cible.setItem(cleStockage(idAdmin), JSON.stringify(modele))
    return true
  } catch {
    return false
  }
}

export function effacerNavigation(stockage, idAdmin) {
  const cible = stockageSur(stockage)
  if (!cible) return false
  try {
    cible.removeItem(cleStockage(idAdmin))
    return true
  } catch {
    return false
  }
}

// ── Les gestes ──

function remplacerGroupes(modele, groupes) {
  return { ...modele, groupes }
}

function remplacerPages(modele, pages) {
  return { ...modele, pages }
}

/** Le nom affiché d'une page : le sien, sinon celui de la section. */
export function libellePage(page, item) {
  return page?.libelle || item?.label || page?.cle || ''
}

/** La teinte d'une page : la sienne, sinon celle de son groupe. */
export function teintePage(modele, page) {
  if (page?.couleur) return teinteDe(page.couleur)
  const groupe = modele?.groupes?.find((candidate) => candidate.id === page?.groupe)
  return teinteDe(groupe?.couleur)
}

export function couleurIdPage(modele, page) {
  if (page?.couleur) return page.couleur
  const groupe = modele?.groupes?.find((candidate) => candidate.id === page?.groupe)
  return groupe?.couleur || COULEURS_GROUPES[0].id
}

/** Une teinte en rgba, pour les fonds doux calculés côté JS. */
export function teinteRgba(teinte, alpha = 1) {
  const hex = String(teinte || '').replace('#', '')
  if (!/^[0-9a-f]{6}$/i.test(hex)) return `rgba(193, 116, 60, ${alpha})`
  const r = parseInt(hex.slice(0, 2), 16)
  const v = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  return `rgba(${r}, ${v}, ${b}, ${alpha})`
}

export function renommerPage(modele, cle, libelle) {
  const propre = String(libelle || '').trim()
  if (!propre) return modele
  return remplacerPages(modele, modele.pages.map((page) => (
    page.cle === cle ? { ...page, libelle: propre.slice(0, 42) } : page
  )))
}

export function changerGroupePage(modele, cle, groupeId) {
  if (!modele.groupes.some((groupe) => groupe.id === groupeId)) return modele
  return remplacerPages(modele, modele.pages.map((page) => (
    page.cle === cle ? { ...page, groupe: groupeId } : page
  )))
}

export function changerCouleurPage(modele, cle, couleurId) {
  const couleur = TEINTE_PAR_ID.has(couleurId) ? couleurId : null
  return remplacerPages(modele, modele.pages.map((page) => (
    page.cle === cle ? { ...page, couleur } : page
  )))
}

export function renommerGroupe(modele, id, nom) {
  const propre = String(nom || '').trim()
  if (!propre) return modele
  return remplacerGroupes(modele, modele.groupes.map((groupe) => (
    groupe.id === id ? { ...groupe, nom: propre.slice(0, 32) } : groupe
  )))
}

export function changerCouleurGroupe(modele, id, couleurId) {
  if (!TEINTE_PAR_ID.has(couleurId)) return modele
  return remplacerGroupes(modele, modele.groupes.map((groupe) => (
    groupe.id === id ? { ...groupe, couleur: couleurId } : groupe
  )))
}

export function ajouterGroupe(modele, nom, couleurId) {
  const propre = String(nom || '').trim()
  if (!propre) return modele
  const id = nouvelIdGroupe(modele.groupes)
  const couleur = TEINTE_PAR_ID.has(couleurId) ? couleurId : COULEURS_GROUPES[modele.groupes.length % COULEURS_GROUPES.length].id
  return remplacerGroupes(modele, [...modele.groupes, { id, nom: propre.slice(0, 32), couleur }])
}

/** Un groupe supprimé ne perd aucune page : elles rejoignent le premier groupe. */
export function supprimerGroupe(modele, id) {
  if (modele.groupes.length <= 1) return modele
  const groupes = modele.groupes.filter((groupe) => groupe.id !== id)
  const secours = groupes[0].id
  const pages = modele.pages.map((page) => (page.groupe === id ? { ...page, groupe: secours } : page))
  return { ...modele, groupes, pages }
}

export function deplacerGroupe(modele, id, sens) {
  const index = modele.groupes.findIndex((groupe) => groupe.id === id)
  const cible = index + sens
  if (index < 0 || cible < 0 || cible >= modele.groupes.length) return modele
  const groupes = [...modele.groupes]
  const [groupe] = groupes.splice(index, 1)
  groupes.splice(cible, 0, groupe)
  return remplacerGroupes(modele, groupes)
}

function pagesOrdonneesParGroupe(modele) {
  const parGroupe = new Map(modele.groupes.map((groupe) => [groupe.id, []]))
  modele.pages.forEach((page) => {
    if (!parGroupe.has(page.groupe)) parGroupe.set(page.groupe, [])
    parGroupe.get(page.groupe).push(page)
  })
  return parGroupe
}

/**
 * Déplace une page vers un groupe, à une position précise.
 * `index` compte les pages déjà présentes dans le groupe cible.
 */
export function deplacerPage(modele, cle, groupeCible, indexCible) {
  if (!modele.groupes.some((groupe) => groupe.id === groupeCible)) return modele
  const page = modele.pages.find((candidate) => candidate.cle === cle)
  if (!page) return modele

  const parGroupe = pagesOrdonneesParGroupe(modele)
  const source = parGroupe.get(page.groupe) || []
  const sourceSans = source.filter((candidate) => candidate.cle !== cle)
  parGroupe.set(page.groupe, sourceSans)

  const cible = parGroupe.get(groupeCible) || []
  const position = Math.max(0, Math.min(Number.isFinite(indexCible) ? indexCible : cible.length, cible.length))
  const deplacee = { ...page, groupe: groupeCible }
  cible.splice(position, 0, deplacee)
  parGroupe.set(groupeCible, cible)

  const pages = []
  modele.groupes.forEach((groupe) => {
    ;(parGroupe.get(groupe.id) || []).forEach((candidate) => pages.push(candidate))
  })
  return remplacerPages(modele, pages)
}

/** Monter / descendre d'un cran, dans le groupe de la page. */
export function deplacerPageCran(modele, cle, sens) {
  const page = modele.pages.find((candidate) => candidate.cle === cle)
  if (!page) return modele
  const dansGroupe = modele.pages.filter((candidate) => candidate.groupe === page.groupe)
  const index = dansGroupe.findIndex((candidate) => candidate.cle === cle)
  const cible = index + sens
  if (index < 0 || cible < 0 || cible >= dansGroupe.length) return modele
  return deplacerPage(modele, cle, page.groupe, cible)
}

/**
 * La barre, prête à dessiner : les groupes dans l'ordre, leurs pages
 * résolues, et le nombre de pages visibles par groupe.
 */
export function pagesParGroupe(modele, index = new Map()) {
  return modele.groupes.map((groupe) => {
    const pages = modele.pages
      .filter((page) => page.groupe === groupe.id)
      .filter((page) => index.size === 0 || index.get(page.cle)?.show !== false)
      .map((page) => {
        const item = index.get(page.cle)
        return {
          ...page,
          libelle: libellePage(page, item),
          teinte: teintePage(modele, page),
          couleurId: couleurIdPage(modele, page),
          item,
        }
      })
    return {
      groupe: { ...groupe, teinte: teinteDe(groupe.couleur) },
      pages,
    }
  })
}
