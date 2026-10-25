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
  cumuler,
  etatAcces,
  filtrerParRole,
  formaterDerniereConnexion,
  libelleEtatAcces,
  libelleRole,
  serieMensuelle,
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
  const maintenant = new Date(2026, 9, 25, 9, 0, 0)

  it('compte les créations dans les douze derniers mois, jamais au-delà', () => {
    const serie = serieMensuelle(
      [
        { created_at: '2026-10-03T00:00:00Z' }, // ce mois-ci
        { created_at: '2026-09-20T00:00:00Z' }, // le mois d'avant
        { created_at: '2025-11-15T00:00:00Z' }, // premier mois de la fenêtre
        { created_at: '2025-10-31T00:00:00Z' }, // treizième mois : dehors
        { created_at: 'pas une date' },
        { created_at: null },
      ],
      () => true,
      maintenant,
    )
    expect(serie).toHaveLength(12)
    expect(serie[11]).toBe(1) // octobre 2026
    expect(serie[10]).toBe(1) // septembre 2026
    expect(serie[0]).toBe(1) // novembre 2025
    expect(serie.reduce((a, b) => a + b, 0)).toBe(3)
  })

  it('ne compte que les lignes retenues par le filtre', () => {
    const serie = serieMensuelle(
      [
        { created_at: '2026-10-03T00:00:00Z', is_active: true },
        { created_at: '2026-10-04T00:00:00Z', is_active: false },
      ],
      (row) => row.is_active,
      maintenant,
    )
    expect(serie.reduce((a, b) => a + b, 0)).toBe(1)
  })

  it('cumule sans jamais redescendre', () => {
    expect(cumuler([])).toEqual([])
    expect(cumuler([0, 2, 0, 1])).toEqual([0, 2, 2, 3])
    const serie = cumuler(serieMensuelle([{ created_at: '2026-10-03T00:00:00Z' }], () => true, maintenant))
    for (let i = 1; i < serie.length; i += 1) {
      expect(serie[i]).toBeGreaterThanOrEqual(serie[i - 1])
    }
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

describe('6. la page reconstruite (v3, mesurée sur la maquette)', () => {
  it('pose une bande haute pleine largeur et une bande basse insérée', () => {
    expect(page).toContain('className="aa-bande"')
    expect(page).toContain('className="aa-bande-basse"')
    expect(page).toContain('placement="bottom"')
    // la bande haute est une vraie hauteur, pas le gabarit de 88 px
    expect(css).toMatch(
      /\.aa-register \.aa-bande \.ec-cultural-top\[data-cultural-motif='abomey'\][^}]*height:\s*var\(--aa-bande-h\)/,
    )
    expect(css).toMatch(/--aa-bande-h:\s*clamp\(120px,\s*12\.8vw,\s*163px\)/)
    // et la bande basse est insérée dans la colonne de contenu, arrondie
    expect(css).toMatch(
      /\.aa-register \.aa-bande-basse\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) var\(--aa-panneau-w\)/,
    )
    expect(css).toMatch(/\.aa-register \.aa-bande-basse-cadre\s*\{[^}]*border-radius:\s*10px/)
  })

  it('garde le panneau à droite comme un meuble, jamais une fenêtre', () => {
    expect(page).toContain('className="aa-grille"')
    expect(page).toContain('className="aa-panneau"')
    expect(css).toMatch(
      /\.aa-register \.aa-grille\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) var\(--aa-panneau-w\)/,
    )
    // 205 px sur 1024 : environ 20 % de la largeur, et collé au bord droit
    expect(css).toMatch(/--aa-panneau-w:\s*clamp\(206px,\s*20vw,\s*300px\)/)
    expect(css).toMatch(/\.aa-register \.aa-grille\s*\{[^}]*padding:[^;]*0 0 var\(--aa-pad\)/)
    // le tiroir modal de la v2 a disparu : ni `position: fixed`, ni 460 px
    expect(css).not.toMatch(/\.aa-drawer(?![-a-z])/)
    expect(css).not.toContain('width: 460px')
  })

  it('a un tableau à quatre colonnes, des lignes de 48 px', () => {
    for (const colonne of ['Administrateur', 'Rôle', 'Entreprise', 'Action']) {
      expect(page).toContain(colonne)
    }
    expect(css).toMatch(
      /\.aa-register \.aa-list-head,\s*\.aa-register \.aa-row\s*\{[^}]*grid-template-columns:\s*minmax\(150px, 1\.55fr\)/,
    )
    expect(css).toMatch(/--aa-ligne-h:\s*clamp\(48px,\s*4\.65vw,\s*67px\)/)
  })

  it('affiche les actions en tuiles pleines de 30 × 30, pas en contours', () => {
    expect(page).toContain('className="aa-tuile"')
    expect(page).toContain('aria-label={`Ouvrir la fiche de')
    expect(css).toMatch(
      /\.aa-register \.aa-tuile\s*\{[^}]*width:\s*30px[^}]*height:\s*30px[^}]*border:\s*0[^}]*border-radius:\s*8px[^}]*background:\s*var\(--aa-tuile\)/,
    )
    // la ligne entière reste cliquable
    expect(page).toContain('className={`aa-row')
    expect(page).toContain('onClick={() => choisirPourLeTiroir(admin)}')
  })

  it('colore la page comme la maquette, pas comme la v2', () => {
    expect(css).toContain('--aa-fond: #180d0a')
    expect(css).toContain('--aa-carte: #241b17')
    expect(css).toContain('--aa-panneau: #291e1b')
    expect(css).toContain('--aa-tuile: #3a2b26')
    expect(css).toContain('--aa-terre: #8b3e1d')
    // le terracotta clair de la v2 ne doit plus revenir
    expect(css).not.toContain('#c4703f')
    expect(css).not.toContain('#15110e')
  })

  it('coud chaque carte : pointillé au périmètre, pièces aux deux coins', () => {
    expect(css).toMatch(
      /\.aa-register \.aa-metrique\s*\{[^}]*border:\s*1px dashed var\(--aa-couture\)/,
    )
    expect(page).toContain('aa-metrique-coin--haut')
    expect(page).toContain('aa-metrique-coin--bas')
    expect(page).toContain('<AbomeyCoinSvg variante="indigo"')
    expect(page).toContain('<AbomeyCoinSvg variante="ivoire"')
  })

  it('trace les vraies courbes, à 68 % de la carte et sans aplat', () => {
    expect(page).toContain('serieMensuelle')
    expect(page).toContain('CourbeOnduleeSvg')
    expect(css).toMatch(/\.aa-register \.aa-metrique-courbe\s*\{[^}]*width:\s*68%/)
    const svg = lire('src/components/AbomeySvg.jsx')
    expect(svg).toMatch(/strokeWidth="1\.8"/)
    expect(svg).toMatch(/fill="none"/)
  })

  it('affiche la dernière connexion depuis la base', () => {
    expect(page).toContain('formaterDerniereConnexion(admin.last_login_at)')
    const service = lire('src/services/adminAccounts.js')
    expect(service).toContain('last_login_at')
    expect(service).toContain('ADMIN_FIELDS')
  })

  it('a des filtres par rôle, en plus de la recherche', () => {
    expect(page).toContain('roleFiltre')
    expect(page).toContain('className="aa-puces"')
    expect(page).toContain('filtrerParRole(filtered, roleFiltre)')
  })

  it('garde la fiche et ses quatre onglets, dessinés en sélecteur', () => {
    expect(page).toMatch(
      /\['Profil', User\],[\s\S]*\['Accès', KeyRound\],[\s\S]*\['Sécurité', ShieldCheck\],[\s\S]*\['Historique', History\],/,
    )
    expect(page).toContain('className="aa-fiche-onglets"')
    // un vrai sélecteur segmenté : piste sombre, onglet actif en terre cuite
    expect(css).toMatch(
      /\.aa-fiche-onglets\s*\{[^}]*border-radius:\s*999px[^}]*background:\s*rgba\(0, 0, 0, 0\.3\)/,
    )
    const actif = css.match(
      /\.aa-fiche-onglets > button\[aria-pressed='true'\]\s*\{([^}]*)\}/,
    )
    expect(actif).not.toBeNull()
    expect(actif[1]).toMatch(/background:\s*var\(--aa-terre\)/)
    expect(actif[1]).toMatch(/color:\s*var\(--aa-ivoire\)/)
    // et le bandeau reste une seule ligne compacte
    expect(css).toMatch(/\.aa-fiche-tete\s*\{[^}]*padding:\s*9px/)
    expect(css).toMatch(/\.aa-fiche \.aa-avatar--grand\s*\{[^}]*width:\s*34px/)
    // la fiche est un dialogue, mais le panneau, lui, n'en est pas un
    expect(page).toContain('className="aa-fiche')
    expect(css).toMatch(/\.aa-fiche\s*\{[^}]*width:\s*min\(1120px, 96vw\)/)
  })

  it('ne laisse aucun bouton natif dans les panneaux', () => {
    // les composants partagés n'ont pas de classe : un filet les dessine
    expect(css).toMatch(/button:not\(\[class\]\)/)
    expect(css).toMatch(
      /:is\(\.aa-panel, \.aa-workflow, \.aa-section, \.aa-security-check,/,
    )
  })

  it('retravaille le bouton « Mon compte » et les onglets internes', () => {
    expect(page).toContain('className="aa-lien-compte"')
    expect(page).toContain('to="/mon-compte"')
    expect(css).toMatch(/\.aa-register \.aa-lien-compte\s*\{[^}]*border:\s*1px dashed/)
    expect(page).toContain('className="aa-tabs"')
    expect(css).toMatch(/\.aa-register \.aa-tabs > button\[aria-pressed='true'\]::after/)
    // l'ancien titre du tiroir n'existe plus
    expect(page).not.toContain('aa-account-title')
  })

  it('ne casse pas l’écran « Mon compte », qui partage `.aa-page`', () => {
    const monCompte = lire('src/pages/MyAdminAccount.jsx')
    expect(monCompte).toContain('aa-page')
    expect(monCompte).not.toContain('aa-register')
    // aucun sélecteur nu `.aa-page { padding: 0 }` n'a été introduit
    expect(css).not.toMatch(/^\.aa-page\s*\{[^}]*padding:\s*0;/m)
    // les composants partagés gardent leurs crochets de style
    for (const crochet of ['.aa-panel', '.aa-workflow', '.aa-journal', '.aa-section', '.aa-formulaire']) {
      expect(css).toContain(crochet)
    }
  })

  it('reste utilisable au clavier, sans animation imposée', () => {
    expect(page).toContain('aria-label')
    expect(page).toContain('role="tablist"')
    expect(page).toContain('aria-pressed')
    expect(css).toContain('prefers-reduced-motion')
    expect(css).toContain(':focus-visible')
  })

  it('a un vrai responsive', () => {
    expect(css).toMatch(/@media \(max-width: 1180px\)/)
    expect(css).toMatch(/@media \(max-width: 980px\)/)
    expect(css).toMatch(/@media \(max-width: 760px\)/)
    expect(css).toMatch(/@media \(max-width: 520px\)/)
  })

  it('garde toutes les protections de compte', () => {
    expect(page).toContain('aa-danger-section')
    expect(page).toContain('target.id === me?.id')
    expect(page).toContain('Votre propre compte est protégé')
    expect(page).toContain('changeAccountPassword')
    expect(page).toContain('encheck_account_password')
  })
})

// ── 7. Mon compte ─────────────────────────────────────────

describe('7. la page Mon compte', () => {
  const compte = lire('src/pages/MyAdminAccount.jsx')

  it('a une bande plus basse que le registre', () => {
    expect(compte).toContain('className="aa-compte-bande"')
    expect(css).toMatch(
      /\.aa-compte-bande \.ec-cultural-top\[data-cultural-motif='abomey'\]\s*\{[^}]*height:\s*clamp\(44px, 5\.2vw, 58px\)/,
    )
    // la bande du registre, elle, monte jusqu'à 163 px
    expect(css).toMatch(/--aa-bande-h:\s*clamp\(120px, 12\.8vw, 163px\)/)
  })

  it('dessine ses trois rubriques en sélecteur, pas en texte nu', () => {
    expect(compte).toContain('className="aa-compte-onglets"')
    expect(compte).toMatch(/role="tablist"/)
    for (const libelle of ['Mon profil', 'Ma sécurité', 'Mes préférences']) {
      expect(compte).toContain(libelle)
    }
    const actif = css.match(
      /\.aa-compte-onglets > button\[aria-pressed='true'\]\s*\{([^}]*)\}/,
    )
    expect(actif).not.toBeNull()
    expect(actif[1]).toMatch(/background:\s*var\(--aa-terre\)/)
    expect(actif[1]).toMatch(/color:\s*var\(--aa-ivoire\)/)
  })

  it('place ses actions dans un pied de formulaire, avec de vrais boutons', () => {
    expect(compte).toContain('className="aa-compte-pied"')
    expect(compte).toContain('className="aa-bouton-plein"')
    expect(css).toMatch(/\.aa-compte-pied\s*\{[^}]*justify-content:\s*flex-end/)
    // plus aucun bouton nu pour changer de thème : un interrupteur
    expect(compte.match(/role="switch"/g)).toHaveLength(2)
    expect(compte).toContain('className="aa-bascule"')
    expect(compte).not.toContain('SunMoon')
  })

  it('nomme le rôle en français, jamais le nom technique', () => {
    expect(compte).toContain('libelleRole(me.role)')
    expect(compte).not.toMatch(/\{me\.role\}/)
    expect(compte).not.toContain('Rôle serveur')
  })

  it('renvoie vers l’administration, pas vers l’accueil', () => {
    expect(compte).toContain('className="aa-compte-retour"')
    // le superadministrateur revient d'où il vient
    expect(compte).toMatch(
      /me\?\.role === 'super_admin'[\s\S]*to="\/admins"[\s\S]*Administration des accès/,
    )
    // les autres gardent leur tableau de bord
    expect(compte).toContain('to="/dashboard"')
  })

  it('pose les raccourcis sur les deux pages', () => {
    expect(page).toContain('RaccourcisPages')
    expect(compte).toContain('RaccourcisPages')
    expect(page).toContain('className="aa-raccourcis"')
    expect(compte).toContain('className="aa-raccourcis"')
    // et chacun sait où il est : la page courante est marquée par le composant
    expect(css).toMatch(/\.aa-raccourcis \.abs-raccourci\[data-actif='oui'\]/)
  })
})
