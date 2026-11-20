// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════════
// CHANGER D'ENTREPRISE RECHARGE LA PAGE — son reproche du 24/11 :
// « je viens de sélectionner une autre entreprise mais ça ne charge pas
// cette entreprise, la page reste celle de l'entreprise avant »
//
// Et : l'image de l'entreprise doit être DÉCOUPÉE dans son rond.
// ═══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const EMPLOYES = readFileSync('src/pages/Employes.jsx', 'utf8')
const CSS = readFileSync('src/components/SidebarUnique.css', 'utf8')
const SELECTEUR = readFileSync('src/components/SelecteurEntreprise.jsx', 'utf8')

describe('changer d’entreprise recharge les données', () => {
  it('a un compteur qui déclenche le rechargement', () => {
    expect(EMPLOYES).toContain('const [rechargement, setRechargement] = useState(0)')
    // et il est incrémenté au changement d'entreprise
    expect(EMPLOYES).toContain('setRechargement((n) => n + 1)')
  })

  it('relit l’administrateur et rappelle loadData quand il change', () => {
    // ⚠️ la cause : loadData n'était appelé qu'une fois, au montage
    expect(EMPLOYES).toMatch(/useEffect\(\(\) => \{[\s\S]{0,300}rechargement[\s\S]{0,400}loadData\(frais\)/)
    // et la boucle est évitée : loadData n'est pas dans les dépendances
    expect(EMPLOYES).toContain('}, [rechargement])')
  })

  it('garde les employés filtrés sur l’entreprise active', () => {
    // ne pas confondre « charger la liste des entreprises » et « filtrer
    // les employés » : cette ligne ne doit PAS disparaître
    expect(EMPLOYES).toContain("if (targetEnterpriseId) employesQuery = employesQuery.eq('enterprise_id', targetEnterpriseId)")
  })
})

describe('l’image de l’entreprise ne déborde plus (sa capture image-52)', () => {
  it('le rond découpe toujours ce qu’il contient', () => {
    // ⚠️ la découpe vivait dans .se-rond--photo, absente de la bande :
    // l'image s'affichait à sa taille NATURELLE et recouvrait le nom
    expect(CSS).toMatch(/\.se-rond \{[\s\S]{0,400}overflow: hidden/)
    expect(CSS).toMatch(/\.se-rond \{[\s\S]{0,400}border-radius: 999px/)
  })

  it('cadre l’image, quelle que soit sa forme', () => {
    expect(CSS).toMatch(/\.se-rond img \{[\s\S]{0,200}object-fit: cover/)
    expect(CSS).toMatch(/\.se-rond img \{[\s\S]{0,200}max-width: 100%/)
  })

  it('utilise la même pastille dans la liste et dans la bande', () => {
    // une seule source de vérité : deux implémentations divergeraient
    expect(SELECTEUR).toContain('function PastilleInterne')
    const bande = SELECTEUR.slice(SELECTEUR.indexOf('se-rond--bande'), SELECTEUR.indexOf('se-bande-nom'))
    expect(bande).toContain('PastilleInterne')
  })
})
