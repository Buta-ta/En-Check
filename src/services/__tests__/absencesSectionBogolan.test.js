// ═══════════════════════════════════════════════════════════════════════════
// 🧵 ABSENCES · LA SECTION DU HAUT — contrat de lecture de la maquette validée
//
// Maquette : `maquettes/absences-section-bogolan-cadre.png` (24/11/2026).
// Consigne du fondateur : « utilise le bogolan comme motif, remplace l'autre »
// et, pour Export et « + Déclarer » : « je les veux comme dans la maquette ».
//
// Comme `cablagePlanningEnCheck.test.js` pour le planning : on ne teste pas ici
// un rendu React, on verrouille que la SECTION dit la vérité — ce que le code
// promet à l'écran. Un contrat par point de la maquette, dans son ordre de
// lecture. Ce qui n'est PAS dans la maquette est dit dans la fiche
// `docs/ABSENCES-SECTION-BOGOLAN.md`, § F.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const lire = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const page = lire('src/pages/Absences.jsx')
const feuille = lire('src/pages/AbsencesAfroTech.css')
const laniere = lire('src/components/AbsencesKpiCards.jsx')
const toile = lire('src/components/PageCulturalBand.css')

describe('Absences · la section du haut, maquette bogolan', () => {
  it('1. le motif n\'est plus un bandeau posé au-dessus : il ENCADRE la section', () => {
    // Une seule toile, le même mécanisme qu'au planning (`placement="cadre"`).
    expect(page).toContain('<PageCulturalBand pathname="/absences" placement="cadre"')
    expect(page).toContain('className="abs-section-cadre"')
    expect(page).toContain('className="abs-section-papier"')
    // la toile est un fond : muet, sans clic, et c\'est la feuille qui écrit
    expect(toile).toContain('.ec-cultural-cadre { position: absolute; inset: 0; z-index: 0')
    expect(toile).toContain('pointer-events: none')
    // un seul nombre règle l\'épaisseur du tissu ET le respirse du papier
    expect(feuille).toContain('--abs-cadre: 26px')
    expect(feuille).toContain('--ec-cadre-epaisseur: var(--abs-cadre)')
    expect(feuille).toContain('padding: var(--abs-cadre)')
    // la feuille est opaque et posée PAR-DESSUS la toile, sinon les mots
    // se liraient sur le motif (D-004)
    expect(feuille).toMatch(/\.abs-section-papier \{[^}]*z-index: 1[^}]*background: var\(--abs-bg-elevated\)/)
    // et les deux bandeaux de la page ont bien disparu
    expect(page).not.toContain('<AbsencesCulturalBand/>')
    expect(page).not.toContain('<AbsencesCulturalBand position="bottom"/>')
  })

  it('2. le bogolan remplace le ndebele, l\'image reste sur le disque', () => {
    const table = lire('src/components/culturalMotif.js')
    expect(table).toContain("if (page === 'absences') return 'bogolan'")
    expect(table).not.toContain("return 'ndebele'")
    // la règle de la page peint le pagne de boue, plus la peinture ndebele
    expect(feuille).toContain("url('/images/paie-bogolan-haut.webp')")
    expect(feuille).not.toContain('absences-ndebele.webp')
    // …mais le ndebele est toujours l\'artiste du badge employé : on a remplacé
    // un EMPLOI, pas le fichier. Ce verrou est la protection demandée.
    expect(fs.existsSync(path.join(ROOT, 'public/images/absences-ndebele.webp'))).toBe(true)
    expect(lire('src/components/badge/motifs.js')).toContain("image: '/images/absences-ndebele.webp'")
  })

  it('3. les onglets sont des rabats cousus sur la lisière haute, pas une barre', () => {
    expect(page).toContain('abs-section-tabs abs-onglets-rabats')
    // la rangée remonte à cheval sur la toile…
    expect(feuille).toMatch(/\.abs-onglets-rabats \{[^}]*margin-top: calc\(var\(--abs-cadre\) \* -1/)
    // …et chaque rabat prend son fond opaque : un mot ne se lit pas à cru sur un motif
    expect(feuille).toMatch(/\.abs-onglets-rabats \{[^}]*background: transparent !important/)
    expect(feuille).toContain('.abs-onglets-rabats .tab-btn { background: var(--abs-bg-panel)')
    // une seule teinte pour les trois pastilles de compte, en jeton
    expect(page).toMatch(/badge: \{[^}]*background: 'var\(--abs-line-soft\)'/)
    expect(page).not.toContain("background: activeTab === 'absences' ? 'rgba(245,158,11,0.2)'")
  })

  it('4. six lanières de compteurs, deux poches — et les câbles existent déjà', () => {
    // la maquette ne crée aucun voyage : les deux poches branchent les deux
    // setters que la page utilisait déjà pour ces deux comptes
    expect(page).toContain('onVoirConflits={() => setFilterConflict(\'with_conflict\')}')
    expect(page).toContain('onVoirDemandes={() => setActiveTab(\'demandes\')}')
    // six lanières inégales en poids, pas six cartes bordées
    expect(laniere).toContain('repeat(4, minmax(0, 1fr)) minmax(0, 1.15fr) minmax(0, 1.35fr)')
    expect(laniere).not.toContain('borderRadius: 12, padding: \'10px 12px\'')
    // les libellés véridiques sont gardés tels quels : la maquette les avait
    // raccourcis (« Solde moyen », « À traiter ») et illisibles en capitales
    for (const label of ['Absents aujourd\'hui', 'Absences ce mois-ci', 'Taux d\'absence du mois',
      'Congés restants (moyenne)', 'Demandes en attente', 'Conflits absence / pointage']) {
      expect(laniere).toContain(`label="${label}"`)
    }
  })

  it('5. Export et « + Déclarer » ne sont plus branchés deux fois', () => {
    // la maquette ne les garde qu\'en tête ; le code les avait en tête ET dans la
    // barre d\'outils. Ce n\'est pas une fonction retirée, c\'est un doublon retiré.
    expect((page.match(/onClick=\{handleExportCSV\}/g) || [])).toHaveLength(1)
    expect((page.match(/onClick=\{\(\) => handleAdd\(\)\}/g) || [])).toHaveLength(1)
    // la ligne d\'en-tête garde les trois commandes annoncées : thème, Export, Déclarer
    const entete = page.slice(page.indexOf('className="abs-topbar-right"'), page.indexOf('abs-topbar-nav'))
    expect(entete).toContain('data-testid="abs-theme-toggle"')
    expect(entete).toContain('<span>Export</span>')
    expect(entete).toContain('<span>Déclarer</span>')
    // la barre d\'outils, elle, garde la recherche, l\'entreprise, les filtres, les vues
    const outils = page.slice(page.indexOf('className="toolbar-top"'), page.indexOf('{showFilters &&'))
    expect(outils).toContain('Rechercher un employé')
    expect(outils).toContain('aria-label="Entreprise"')
    expect(outils).toContain('aria-label="Afficher les filtres"')
    for (const vue of ['planning', 'calendar', 'list']) expect(outils).toContain(`viewMode === '${vue}'`)
    // la barre d'outils ne branche plus aucune des deux actions (seul un
    // commentaire en parle encore — c'est le JSX qui compte)
    expect(outils).not.toContain('onClick={handleExportCSV}')
    // les outils s'ouvrent sur la couture pointillée du dessin (point 3)
    expect(feuille).toMatch(/\.abs-section-papier \.toolbar-top \{[^}]*border-top: 1px dashed var\(--abs-border-strong\)/)
    expect(outils).not.toContain('className="afro-btn"')
    // et les styles des boutons retirés sont partis avec eux : pas de dette orpheline
    expect(page).not.toContain('exportBtn')
    expect(page).not.toContain('addBtn')
  })

  it('6. l\'alerte de conflit est une couture, plus un bandeau plein', () => {
    expect(page).toContain('className="abs-couture-alerte"')
    expect(feuille).toMatch(/\.abs-couture-alerte \{[^}]*border-top: 1px dashed var\(--abs-border-strong\)/)
    expect(feuille).toMatch(/\.abs-couture-alerte \{[^}]*border-bottom: 1px dashed var\(--abs-border-strong\)/)
    // La bannière pleine en orange translucide a disparu de LA SECTION. Dit
    // aussi ce qui reste : le rappel « Conflit RH détecté » à l'intérieur d'une
    // ligne de liste n'est pas la même alerte — c'est un paragraphe, il garde
    // son bloc (et ses teintes sont passées au jeton).
    const section = page.slice(page.indexOf('abs-section-cadre'), page.indexOf('className="toolbar-top"'))
    expect(section).not.toContain('rgba(249,115,22')
    expect(section).toContain('abs-couture-alerte')
  })

  it('7. la ligne d\'absence porte la tuile de motif, muette', () => {
    expect(page).toContain('<BogolanPastilleSvg size={22} couleur="var(--abs-copper)" />')
    // muette : le motif ne se lit pas, il se regarde
    expect(page).toMatch(/className="abs-tuile" aria-hidden="true"/)
    expect(feuille).toContain('.abs-tuile { width: 22px; height: 22px')
  })

  it('8. la reprise n\'a pas rendu la page plus sale', () => {
    // Cinq teintes en dur des quatre pastilles d\'état de la ligne sont parties
    // au jeton : le compteur de la dette ne doit pas remonter derrière nous.
    const durs = (page.match(/rgba\(|#[0-9A-Fa-f]{6}/g) || []).length
    expect(durs).toBeLessThan(135) // 143 à la base `cf56084`, 127 après reprise
    // et les styles en dur que nous avons remplacés ne reviennent pas
    expect(page).not.toContain("color: 'var(--abs-text-muted)'") // jeton inexistant
  })
})
