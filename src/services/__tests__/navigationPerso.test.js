// ═══════════════════════════════════════════════════════════
// LA NAVIGATION PERSONNELLE — les gestes, sans écran
//
// Ce que ces tests défendent : renommer, ranger, créer un groupe,
// colorer, déplacer, et ne jamais perdre une page quand la mémoire
// de l'administrateur est abîmée ou qu'une page disparaît du code.
// ═══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import {
  COULEURS_GROUPES,
  ajouterGroupe,
  changerCouleurGroupe,
  changerCouleurPage,
  changerGroupePage,
  chargerNavigation,
  cleStockage,
  couleurIdPage,
  deplacerGroupe,
  deplacerPage,
  deplacerPageCran,
  effacerNavigation,
  fusionnerModele,
  indexerPages,
  libellePage,
  modeleParDefaut,
  pagesParGroupe,
  renommerGroupe,
  renommerPage,
  sauvegarderNavigation,
  supprimerGroupe,
  teinteDe,
  teintePage,
  teinteRgba,
} from '../../lib/navigationPerso'

const SECTIONS = [
  {
    label: 'Aujourd’hui',
    items: [
      { label: 'Vue d’ensemble', path: '/dashboard', show: true, active: true },
      { label: 'Pointages', path: '/pointages', show: true, count: 3 },
      { label: 'Équipe', path: '/employes', show: true },
      { label: 'Planning', path: '/planning', show: false },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Entreprises', path: '/entreprises', show: true },
      { label: 'Administrateurs', path: '/admins', show: true },
      { label: 'Messages système', path: '/system-messages', show: true },
    ],
  },
]

function memoire() {
  const contenu = new Map()
  return {
    getItem: (cle) => (contenu.has(cle) ? contenu.get(cle) : null),
    setItem: (cle, valeur) => contenu.set(cle, String(valeur)),
    removeItem: (cle) => contenu.delete(cle),
    contenu,
  }
}

function base() {
  return modeleParDefaut(SECTIONS)
}

describe('le modèle d’origine', () => {
  it('crée un groupe par section, dans l’ordre du code', () => {
    const modele = base()
    expect(modele.groupes.map((groupe) => groupe.nom)).toEqual(['Aujourd’hui', 'Administration'])
    expect(modele.groupes.map((groupe) => groupe.couleur)).toEqual(['cuivre', 'terre'])
  })

  it('range chaque page dans son groupe, avec son libellé', () => {
    const modele = base()
    expect(modele.pages.map((page) => page.cle)).toEqual([
      '/dashboard', '/pointages', '/employes', '/planning',
      '/entreprises', '/admins', '/system-messages',
    ])
    expect(modele.pages[1]).toMatchObject({ libelle: 'Pointages', groupe: 'groupe-1', couleur: null })
  })

  it('ignore une entrée sans chemin, comme un bouton d’action', () => {
    const modele = modeleParDefaut([{ label: 'Seule', items: [{ label: 'Action' }, { label: 'Page', path: '/page' }] }])
    expect(modele.pages).toHaveLength(1)
    expect(modele.pages[0].cle).toBe('/page')
  })

  it('n’ouvre pas de groupe vide', () => {
    const modele = modeleParDefaut([{ label: 'Vide', items: [] }, { label: 'Pleine', items: [{ path: '/a', label: 'A' }] }])
    expect(modele.groupes.map((groupe) => groupe.nom)).toEqual(['Pleine'])
  })

  it('indexe les pages pour retrouver icône, compteur et visibilité', () => {
    const index = indexerPages(SECTIONS)
    expect(index.get('/pointages').count).toBe(3)
    expect(index.get('/planning').show).toBe(false)
  })
})

describe('la fusion avec les sections du moment', () => {
  it('ajoute une page nouvelle dans son groupe d’origine', () => {
    const modele = base()
    const sections = [
      { ...SECTIONS[0], items: [...SECTIONS[0].items, { label: 'Retards', path: '/retards', show: true }] },
      SECTIONS[1],
    ]
    const fusion = fusionnerModele(modele, sections)
    expect(fusion.pages.map((page) => page.cle)).toContain('/retards')
    expect(fusion.pages.find((page) => page.cle === '/retards').groupe).toBe('groupe-1')
  })

  it('écarte une page qui n’existe plus', () => {
    const modele = base()
    const sections = [{ ...SECTIONS[0], items: SECTIONS[0].items.filter((item) => item.path !== '/employes') }, SECTIONS[1]]
    const fusion = fusionnerModele(modele, sections)
    expect(fusion.pages.map((page) => page.cle)).not.toContain('/employes')
    expect(fusion.pages).toHaveLength(6)
  })

  it('garde le nom choisi par l’administrateur', () => {
    const modele = renommerPage(base(), '/pointages', 'Mes pointages')
    const fusion = fusionnerModele(modele, SECTIONS)
    expect(fusion.pages.find((page) => page.cle === '/pointages').libelle).toBe('Mes pointages')
  })

  it('ramène une page orpheline dans son groupe d’origine', () => {
    const modele = base()
    modele.pages = modele.pages.map((page) => (page.cle === '/admins' ? { ...page, groupe: 'groupe-disparu' } : page))
    const fusion = fusionnerModele(modele, SECTIONS)
    expect(fusion.pages.find((page) => page.cle === '/admins').groupe).toBe('groupe-2')
  })

  it('remplace une couleur inconnue par une couleur de la palette', () => {
    const modele = base()
    modele.groupes[0].couleur = '#ff00ff'
    const fusion = fusionnerModele(modele, SECTIONS)
    expect(COULEURS_GROUPES.map((couleur) => couleur.id)).toContain(fusion.groupes[0].couleur)
  })

  it('accepte un modèle vide sans perdre les pages', () => {
    const fusion = fusionnerModele({}, SECTIONS)
    expect(fusion.pages).toHaveLength(7)
    expect(fusion.groupes).toHaveLength(2)
  })

  it('écarte les doublons de page', () => {
    const modele = base()
    modele.pages = [...modele.pages, { ...modele.pages[0] }]
    expect(fusionnerModele(modele, SECTIONS).pages).toHaveLength(7)
  })
})

describe('la mémoire de l’administrateur', () => {
  it('nomme la mémoire par administrateur', () => {
    expect(cleStockage('abc')).toBe('encheck_navigation_admin_v1:abc')
    expect(cleStockage()).toBe('encheck_navigation_admin_v1:administrateur')
  })

  it('part du modèle d’origine quand rien n’est enregistré', () => {
    const modele = chargerNavigation(memoire(), 'abc', SECTIONS)
    expect(modele.groupes).toHaveLength(2)
    expect(modele.pages).toHaveLength(7)
  })

  it('relit ce qui a été enregistré', () => {
    const stockage = memoire()
    const modele = renommerGroupe(base(), 'groupe-2', 'Mon atelier')
    expect(sauvegarderNavigation(stockage, 'abc', modele)).toBe(true)
    expect(chargerNavigation(stockage, 'abc', SECTIONS).groupes[1].nom).toBe('Mon atelier')
  })

  it('écarte un enregistrement abîmé sans casser la barre', () => {
    const stockage = memoire()
    stockage.setItem(cleStockage('abc'), '{pas du json')
    expect(chargerNavigation(stockage, 'abc', SECTIONS).pages).toHaveLength(7)
  })

  it('écarte une version inconnue', () => {
    const stockage = memoire()
    stockage.setItem(cleStockage('abc'), JSON.stringify({ version: 99, groupes: [], pages: [] }))
    expect(chargerNavigation(stockage, 'abc', SECTIONS).pages).toHaveLength(7)
  })

  it('efface la mémoire', () => {
    const stockage = memoire()
    sauvegarderNavigation(stockage, 'abc', base())
    expect(effacerNavigation(stockage, 'abc')).toBe(true)
    expect(chargerNavigation(stockage, 'abc', SECTIONS).groupes[0].nom).toBe('Aujourd’hui')
  })

  it('n’empêche pas la barre de vivre si le stockage refuse', () => {
    const refuse = {
      getItem: () => { throw new Error('refus') },
      setItem: () => { throw new Error('refus') },
      removeItem: () => { throw new Error('refus') },
    }
    expect(chargerNavigation(refuse, 'abc', SECTIONS).pages).toHaveLength(7)
    expect(sauvegarderNavigation(refuse, 'abc', base())).toBe(false)
    expect(effacerNavigation(refuse, 'abc')).toBe(false)
  })
})

describe('renommer une page', () => {
  it('garde le nouveau nom, sans espaces autour', () => {
    const modele = renommerPage(base(), '/pointages', '  Les pointages  ')
    expect(modele.pages.find((page) => page.cle === '/pointages').libelle).toBe('Les pointages')
  })

  it('refuse un nom vide', () => {
    const modele = base()
    expect(renommerPage(modele, '/pointages', '   ')).toBe(modele)
  })

  it('borne un nom trop long', () => {
    const long = 'x'.repeat(80)
    expect(renommerPage(base(), '/pointages', long).pages.find((page) => page.cle === '/pointages').libelle).toHaveLength(42)
  })

  it('ne touche pas les autres pages', () => {
    const modele = renommerPage(base(), '/pointages', 'Pointages du jour')
    expect(modele.pages.find((page) => page.cle === '/employes').libelle).toBe('Équipe')
  })
})

describe('ranger une page', () => {
  it('change la page de groupe', () => {
    const modele = changerGroupePage(base(), '/planning', 'groupe-2')
    expect(modele.pages.find((page) => page.cle === '/planning').groupe).toBe('groupe-2')
  })

  it('refuse un groupe inconnu', () => {
    const modele = base()
    expect(changerGroupePage(modele, '/planning', 'groupe-inexistant')).toBe(modele)
  })

  it('déplace une page à une position précise dans un autre groupe', () => {
    const modele = deplacerPage(base(), '/planning', 'groupe-2', 1)
    const ordre = modele.pages.filter((page) => page.groupe === 'groupe-2').map((page) => page.cle)
    expect(ordre).toEqual(['/entreprises', '/planning', '/admins', '/system-messages'])
  })

  it('borne la position au bout du groupe', () => {
    const modele = deplacerPage(base(), '/dashboard', 'groupe-2', 99)
    expect(modele.pages.filter((page) => page.groupe === 'groupe-2').at(-1).cle).toBe('/dashboard')
  })

  it('garde la page si le groupe cible n’existe pas', () => {
    const modele = base()
    expect(deplacerPage(modele, '/dashboard', 'nulle-part', 0)).toBe(modele)
  })

  it('ignore une page inconnue', () => {
    const modele = base()
    expect(deplacerPage(modele, '/inconnue', 'groupe-1', 0)).toBe(modele)
  })

  it('monte et descend d’un cran dans le groupe', () => {
    const monte = deplacerPageCran(base(), '/employes', -1)
    expect(monte.pages.filter((page) => page.groupe === 'groupe-1').map((page) => page.cle)[1]).toBe('/employes')
    const descend = deplacerPageCran(base(), '/dashboard', 1)
    expect(descend.pages.filter((page) => page.groupe === 'groupe-1').map((page) => page.cle)[0]).toBe('/pointages')
  })

  it('ne sort pas du groupe en haut ni en bas', () => {
    const modele = base()
    expect(deplacerPageCran(modele, '/dashboard', -1)).toBe(modele)
    expect(deplacerPageCran(modele, '/planning', 1)).toBe(modele)
  })
})

describe('les groupes', () => {
  it('crée un groupe nommé et coloré', () => {
    const modele = ajouterGroupe(base(), 'Mon atelier', 'olive')
    expect(modele.groupes).toHaveLength(3)
    expect(modele.groupes[2]).toMatchObject({ nom: 'Mon atelier', couleur: 'olive' })
    expect(modele.groupes[2].id).toBe('groupe-3')
  })

  it('donne un identifiant libre même après des suppressions', () => {
    const reduit = { ...base(), groupes: [base().groupes[0]] }
    const modele = ajouterGroupe(reduit, 'Atelier', 'ambre')
    expect(modele.groupes.map((groupe) => groupe.id)).toEqual(['groupe-1', 'groupe-2'])
  })

  it('refuse un nom vide', () => {
    const modele = base()
    expect(ajouterGroupe(modele, '  ', 'olive')).toBe(modele)
  })

  it('renomme un groupe', () => {
    expect(renommerGroupe(base(), 'groupe-2', 'Mon atelier').groupes[1].nom).toBe('Mon atelier')
  })

  it('change la couleur d’un groupe', () => {
    const modele = changerCouleurGroupe(base(), 'groupe-1', 'ardoise')
    expect(modele.groupes[0].couleur).toBe('ardoise')
  })

  it('ignore une couleur hors palette', () => {
    const modele = base()
    expect(changerCouleurGroupe(modele, 'groupe-1', 'fluo')).toBe(modele)
  })

  it('déplace un groupe et garde ses pages', () => {
    const modele = deplacerGroupe(base(), 'groupe-2', -1)
    expect(modele.groupes.map((groupe) => groupe.id)).toEqual(['groupe-2', 'groupe-1'])
    expect(modele.pages.filter((page) => page.groupe === 'groupe-2')).toHaveLength(3)
  })

  it('ne sort pas de la liste des groupes', () => {
    const modele = base()
    expect(deplacerGroupe(modele, 'groupe-1', -1)).toBe(modele)
    expect(deplacerGroupe(modele, 'groupe-2', 1)).toBe(modele)
  })

  it('supprime un groupe en recueillant ses pages', () => {
    const modele = supprimerGroupe(base(), 'groupe-1')
    expect(modele.groupes.map((groupe) => groupe.id)).toEqual(['groupe-2'])
    expect(modele.pages.every((page) => page.groupe === 'groupe-2')).toBe(true)
    expect(modele.pages).toHaveLength(7)
  })

  it('refuse de supprimer le dernier groupe', () => {
    const seul = { ...base(), groupes: [base().groupes[0]] }
    expect(supprimerGroupe(seul, 'groupe-1')).toBe(seul)
  })
})

describe('les couleurs d’une page', () => {
  it('suit la couleur du groupe par défaut', () => {
    const modele = base()
    expect(couleurIdPage(modele, modele.pages[0])).toBe('cuivre')
  })

  it('prend sa propre couleur si elle en a une', () => {
    const modele = changerCouleurPage(base(), '/pointages', 'olive')
    expect(couleurIdPage(modele, modele.pages[1])).toBe('olive')
  })

  it('revient à la couleur du groupe', () => {
    const avec = changerCouleurPage(base(), '/pointages', 'olive')
    const sans = changerCouleurPage(avec, '/pointages', null)
    expect(sans.pages[1].couleur).toBeNull()
    expect(couleurIdPage(sans, sans.pages[1])).toBe('cuivre')
  })

  it('convertit une teinte en rgba', () => {
    expect(teinteRgba('#C1743C', 0.2)).toBe('rgba(193, 116, 60, 0.2)')
    expect(teinteRgba('n’importe quoi', 0.5)).toBe('rgba(193, 116, 60, 0.5)')
  })

  it('connaît les cinq teintes de la planche', () => {
    expect(COULEURS_GROUPES.map((couleur) => couleur.id)).toEqual(['cuivre', 'terre', 'olive', 'ambre', 'ardoise'])
    expect(teinteDe('ambre')).toBe('#D8A13C')
  })

  it('résout la teinte d’une page par son groupe', () => {
    const modele = base()
    expect(teintePage(modele, modele.pages[4])).toBe('#9A4A2E')
  })
})

describe('la barre prête à dessiner', () => {
  it('rend les groupes dans l’ordre, pages résolues', () => {
    const rendu = pagesParGroupe(base(), indexerPages(SECTIONS))
    expect(rendu.map((bloc) => bloc.groupe.nom)).toEqual(['Aujourd’hui', 'Administration'])
    expect(rendu[0].pages.map((page) => page.libelle)).toEqual(['Vue d’ensemble', 'Pointages', 'Équipe'])
    expect(rendu[0].pages[1].item.count).toBe(3)
  })

  it('masque une page dont le module est éteint, sans la perdre', () => {
    const modele = base()
    const rendu = pagesParGroupe(modele, indexerPages(SECTIONS))
    expect(rendu[0].pages.map((page) => page.cle)).not.toContain('/planning')
    expect(modele.pages.map((page) => page.cle)).toContain('/planning')
  })

  it('garde un groupe vide visible', () => {
    const modele = ajouterGroupe(base(), 'Vide', 'ambre')
    const rendu = pagesParGroupe(modele, indexerPages(SECTIONS))
    expect(rendu.at(-1).pages).toHaveLength(0)
  })

  it('porte la teinte de la page et celle du groupe', () => {
    const modele = changerCouleurPage(base(), '/pointages', 'olive')
    const rendu = pagesParGroupe(modele, indexerPages(SECTIONS))
    expect(rendu[0].pages[1].teinte).toBe('#7C8A46')
    expect(rendu[0].groupe.teinte).toBe('#C1743C')
  })

  it('retombe sur le libellé du code si la page n’est pas renommée', () => {
    expect(libellePage({ cle: '/x', libelle: '' }, { label: 'Page X' })).toBe('Page X')
  })
})
