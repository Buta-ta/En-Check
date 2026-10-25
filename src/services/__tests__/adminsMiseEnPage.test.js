// ═══════════════════════════════════════════════════════════
// 👤 COMPTES & ACCÈS — la mise en page et les règles
//
// La page a été refaite sur une maquette : bandes tissées pleine
// largeur, trois cartes de chiffres, tableau à cinq colonnes,
// tiroir latéral. Ces tests tiennent ce que la refonte promet —
// et interdisent les régressions qu'on vient de corriger.
// ═══════════════════════════════════════════════════════════

import { it, expect, describe } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  ROLES,
  entreprisesCouvertes,
  etatAcces,
  filtrerParRole,
  formaterDerniereConnexion,
  libelleEtatAcces,
  libelleRole,
  serieCouverture,
  serieCumulative,
  tonRole,
} from '../../utils/adminsPresentation'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const lire = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')
const page = lire('src/pages/AdminAccounts.jsx')
const css = lire('src/pages/AdminAccounts.css')

// ── 1. Les mots ─────────────────────────────────────────────

describe('1. les libellés', () => {
  it('ne laisse aucun nom technique à l’écran', () => {
    expect(libelleRole('super_admin')).toBe('Super Admin')
    expect(libelleRole('manager')).toBe('Responsable')
    expect(libelleRole('viewer')).toBe('Lecture seule')
    for (const role of ROLES) expect(libelleRole(role)).not.toContain('_')
  })

  it('donne une famille de couleur stable à chaque rôle', () => {
    expect(tonRole('super_admin')).toBe('or')
    expect(tonRole('admin')).toBe('vert')
    expect(tonRole(undefined)).toBe('neutre')
  })

  it('nomme l’accès sans jargon', () => {
    expect(libelleEtatAcces('non_lie')).toBe('Sans accès de connexion')
    expect(libelleEtatAcces('non_lie')).not.toMatch(/supabase|auth|user_id/i)
  })
})

// ── 2. L'accès réel ────────────────────────────────────────

describe('2. qui peut réellement se connecter', () => {
  it('distingue lié, non lié et verrouillé', () => {
    expect(etatAcces({ user_id: 'u' })).toBe('lie')
    expect(etatAcces({})).toBe('non_lie')
    const dans1h = new Date(Date.now() + 3600000).toISOString()
    const ilYa1h = new Date(Date.now() - 3600000).toISOString()
    expect(etatAcces({ user_id: 'u', locked_until: dans1h })).toBe('verrouille')
    expect(etatAcces({ user_id: 'u', locked_until: ilYa1h })).toBe('lie')
  })
})

// ── 3. La dernière connexion ───────────────────────────────

describe('3. la dernière connexion', () => {
  const maintenant = new Date(2026, 9, 25, 9, 0, 0)

  it('parle comme un humain', () => {
    expect(formaterDerniereConnexion(null, maintenant)).toBe('Jamais')
    expect(formaterDerniereConnexion('pas une date', maintenant)).toBe('Jamais')
    expect(formaterDerniereConnexion(new Date(2026, 9, 25, 7, 30), maintenant)).toBe("Aujourd'hui")
    expect(formaterDerniereConnexion(new Date(2026, 9, 24, 22, 0), maintenant)).toBe('Hier')
    expect(formaterDerniereConnexion(new Date(2026, 9, 22, 12, 0), maintenant)).toBe('Il y a 3 j')
    expect(formaterDerniereConnexion(new Date(2026, 9, 11, 12, 0), maintenant)).toBe('Il y a 2 sem.')
  })

  it('tronque au jour, pas à 24 heures', () => {
    expect(formaterDerniereConnexion(new Date(2026, 9, 24, 23, 30), maintenant)).toBe('Hier')
  })
})

// ── 4. Les courbes ─────────────────────────────────────────

describe('4. les courbes des cartes', () => {
  it('ne dessine jamais une tendance inventée', () => {
    expect(serieCumulative([])).toEqual([0, 0])
    expect(serieCumulative([{ created_at: '2026-01-01T00:00:00Z' }])).toEqual([0, 1])
    const serie = serieCumulative([
      { created_at: '2026-01-01T00:00:00Z' },
      { created_at: '2026-02-01T00:00:00Z' },
      { created_at: '2026-03-01T00:00:00Z' },
    ])
    expect(serie[serie.length - 1]).toBe(3)
    expect(serie.every((v) => v <= 3)).toBe(true)
  })

  it('compte une entreprise au jour de son PREMIER administrateur', () => {
    const serie = serieCouverture([
      { role: 'admin', enterprise_id: 'e1', created_at: '2026-01-10T00:00:00Z' },
      { role: 'manager', enterprise_id: 'e1', created_at: '2026-02-10T00:00:00Z' },
      { role: 'admin', enterprise_id: 'e2', created_at: '2026-03-10T00:00:00Z' },
      // un super admin ne « couvre » aucune entreprise : il n'y est pas rattaché
      { role: 'super_admin', enterprise_id: 'e3', created_at: '2026-04-10T00:00:00Z' },
    ])
    expect(serie).toEqual([1, 2])
  })
})

// ── 5. Les chiffres ────────────────────────────────────────

describe('5. les trois chiffres', () => {
  const rows = [
    { role: 'super_admin', enterprise_id: null, user_id: 'u1' },
    { role: 'admin', enterprise_id: 'e1', user_id: 'u2' },
    { role: 'manager', enterprise_id: 'e2' },
    { role: 'admin', enterprise_id: 'e1', user_id: 'u3' },
  ]

  it('compte les entreprises réellement couvertes, sans doublon', () => {
    expect(entreprisesCouvertes(rows)).toBe(2)
    expect(entreprisesCouvertes([])).toBe(0)
  })

  it('filtre par rôle, et « tous » ne cache rien', () => {
    expect(filtrerParRole(rows, 'tous')).toHaveLength(4)
    expect(filtrerParRole(rows, 'admin')).toHaveLength(2)
    expect(filtrerParRole(rows, 'super_admin')).toHaveLength(1)
    expect(filtrerParRole(rows, '')).toHaveLength(4)
  })
})

// ── 6. La mise en page, vérifiée dans le code ─────────────

describe('6. la page reconstruite', () => {
  it('a deux bandes tissées pleine largeur', () => {
    // avant : la bande vivait DANS la coque de 1280 px, donc encadrée
    expect(page).toContain('className="aa-bande"')
    expect(page).toContain("placement=\"bottom\"")
    expect(css).toMatch(/\.aa-register \.aa-bande\s*\{[^}]*width:\s*100%/)
    // et la page ne garde pas le rembourrage qui empêcherait le pleine largeur
    expect(css).toMatch(/\.aa-register\s*\{[^}]*padding:\s*0;/)
  })

  it('a un tableau à cinq colonnes, pas une liste de cartes', () => {
    for (const colonne of ['Administrateur', 'Rôle', 'Entreprises', 'Dernière connexion', 'Actions']) {
      expect(page).toContain(colonne)
    }
    expect(css).toMatch(/grid-template-columns:\s*minmax\(0, 1\.7fr\)[^;]*96px/)
  })

  it('affiche de vraies actions par ligne', () => {
    // deux boutons : ouvrir la fiche, voir les interventions
    expect(page).toContain('className="aa-action"')
    expect(page).toContain('Ouvrir la fiche')
    expect(page).toContain('Historique')
    // et la ligne entière reste cliquable, comme avant
    expect(page).toContain('className="aa-row"')
  })

  it('affiche la dernière connexion depuis la base', () => {
    expect(page).toContain('formaterDerniereConnexion(admin.last_login_at)')
    const service = lire('src/services/adminAccounts.js')
    // le champ doit être RÉELLEMENT demandé, sinon la colonne serait vide
    expect(service).toContain('last_login_at')
    expect(service).toContain('ADMIN_FIELDS')
  })

  it('a des filtres par rôle, en plus de la recherche', () => {
    expect(page).toContain('roleFiltre')
    expect(page).toContain('className="aa-puces"')
    expect(page).toContain('filtrerParRole(filtered, roleFiltre)')
  })

  it('garde le tiroir, la fiche et ses quatre onglets', () => {
    expect(page).toContain("['Profil', 'Accès', 'Sécurité', 'Historique']")
    expect(page).toContain('aa-account-title')
    expect(css).toMatch(/\.aa-drawer\s*\{[^}]*position:\s*fixed/)
    expect(css).toMatch(/\.aa-drawer\s*\{[^}]*width:\s*460px/)
  })

  it('ne casse pas l’écran « Mon compte », qui partage `.aa-page`', () => {
    // la nouvelle mise en page est scopée sous `.aa-register`
    const monCompte = lire('src/pages/MyAdminAccount.jsx')
    expect(monCompte).toContain('aa-page')
    expect(monCompte).not.toContain('aa-register')
    // aucun sélecteur nu `.aa-page { padding: 0 }` n'a été introduit
    expect(css).not.toMatch(/^\.aa-page\s*\{[^}]*padding:\s*0;/m)
  })

  it('reste utilisable au clavier, sans animation imposée', () => {
    expect(page).toContain('aria-label')
    expect(page).toContain('role="tablist"')
    expect(page).toContain('aria-pressed')
    expect(css).toContain('prefers-reduced-motion')
    expect(css).toContain(':focus-visible')
  })

  it('a un vrai responsive', () => {
    expect(css).toMatch(/@media \(max-width: 1100px\)/)
    expect(css).toMatch(/@media \(max-width: 860px\)/)
    expect(css).toMatch(/@media \(max-width: 520px\)/)
  })

  it('garde toutes les protections de compte', () => {
    expect(page).toContain('aa-danger-section')
    expect(page).toContain('selected.id === me?.id')
    expect(page).toContain('Votre propre compte est protégé')
    expect(page).toContain('changeAccountPassword')
    expect(page).toContain('encheck_account_password')
  })
})
