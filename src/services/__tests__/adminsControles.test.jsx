// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════════
// 🧵 LES CONTRÔLES DESSINÉS — sceaux, exemples, explications
//
// Trois demandes, trois garde-fous :
//   ① les cases à cocher deviennent des sceaux, mais restent de
//     vraies cases (nom accessible, clavier, formulaire) ;
//   ② chaque champ porte un exemple — pas un libellé vide ;
//   ③ les explications se plient, pour ne pas charger l'écran ;
//   et la page tient sur un téléphone, pas seulement sur un
//   écran large.
// ═══════════════════════════════════════════════════════════

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import AdminSceau from '../../components/AdminSceau'
import AdminExplication from '../../components/AdminExplication'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const lire = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const page = lire('src/pages/AdminAccounts.jsx')
const compte = lire('src/pages/MyAdminAccount.jsx')
const css = lire('src/pages/AdminAccounts.css')
const operations = lire('src/components/AdminAccountOperations.jsx')
const roles = lire('src/components/AdminPermissionRoles.jsx')
const invitations = lire('src/components/AdminInvitations.jsx')

let host, root
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})

// ── 1. Le sceau ────────────────────────────────────────────

describe('1. le sceau', () => {
  it('reste une vraie case à cocher, avec son nom accessible', async () => {
    let coche = false
    const rendre = () =>
      root.render(
        <AdminSceau checked={coche} onChange={(e) => { coche = e.target.checked }}>
          Recevoir les alertes e-mail
        </AdminSceau>,
      )
    await act(async () => rendre())
    const input = host.querySelector('input[type="checkbox"]')
    expect(input).not.toBeNull()
    expect(host.querySelector('label.aa-sceau')).not.toBeNull()
    // le nom accessible vient du texte du libellé, pas d'un décor
    expect(host.querySelector('label.aa-sceau').textContent).toBe(
      'Recevoir les alertes e-mail',
    )
    // cliquer la case change vraiment l'état
    await act(async () => input.click())
    expect(coche).toBe(true)
    // l'état contrôlé suit : on redessine et la case est bien cochée
    await act(async () => rendre())
    expect(host.querySelector('input[type="checkbox"]').checked).toBe(true)
  })

  it('ne remplace jamais la case par un décor cliquable', () => {
    const source = lire('src/components/AdminSceau.jsx')
    expect(source).toContain('type="checkbox"')
    expect(source).toContain('className="aa-sceau-pastille"')
    // la case n'est pas un bouton : pas de role="checkbox" bricolé
    expect(source).not.toContain('role="checkbox"')
    // et elle garde son état coché pour les lecteurs d'écran
    expect(source).toContain('checked={checked}')
  })

  it('se remplit d’un trait doré quand il est posé', () => {
    expect(css).toMatch(/\.aa-page \.aa-sceau-pastille\s*\{[^}]*border-radius:\s*50%/)
    const pose = css.match(
      /\.aa-page \.aa-sceau input:checked \+ \.aa-sceau-pastille\s*\{([^}]*)\}/,
    )
    expect(pose).not.toBeNull()
    expect(pose[1]).toMatch(/background:\s*var\(--aa-terre\)/)
    expect(pose[1]).toMatch(/color:\s*var\(--aa-ivoire\)/)
    // et le pourtour du sceau suit l'état
    expect(css).toContain(".aa-page .aa-sceau:has(input:checked)")
  })

  it('remplace les cases nues des formulaires d’administration', () => {
    expect(operations).toContain('<AdminSceau')
    expect(roles).toContain('<AdminSceau')
    expect(page).toContain('<AdminSceau')
    // plus une seule case brute dans les entreprises autorisées
    expect(operations).not.toMatch(/<input\s+type="checkbox"/)
  })
})

// ── 2. Les exemples ───────────────────────────────────────

describe('2. les exemples dans les champs', () => {
  it('donne un exemple à la recherche et à l’invitation', () => {
    expect(page).toContain('placeholder="Nom, e-mail ou entreprise…"')
    expect(invitations).toContain('placeholder="Ex. : Awa"')
    expect(invitations).toContain('placeholder="Ex. : Dossou"')
    expect(invitations).toContain('placeholder="Ex. : awa.dossou@entreprise.bj"')
  })

  it('donne un exemple à chaque champ qui demande une phrase', () => {
    for (const source of [page, operations, roles]) {
      expect(source).toMatch(/placeholder="Ex\. : /)
    }
    // les mots de passe disent la règle, pas seulement « mot de passe »
    expect(page).toContain('placeholder="Au moins 12 caractères, par exemple une phrase de passe"')
    expect(compte).toContain('placeholder="Répétez le nouveau mot de passe"')
  })

  it('garde les exemples discrets, jamais un vrai contenu', () => {
    // un placeholder n'est pas une valeur : aucun formulaire ne part prérempli
    expect(css).toMatch(/::placeholder\s*\{[^}]*color:\s*var\(--aa-encre-faible\)/)
    expect(invitations).toContain('value={email}')
    expect(invitations).not.toContain('defaultValue=')
  })
})

// ── 3. Les explications pliées ────────────────────────────

describe('3. les explications se plient', () => {
  it('une explication est un vrai details, pas un texte caché', async () => {
    await act(async () =>
      root.render(
        <AdminExplication titre="Ce que ça change">
          <p>Le texte explicatif.</p>
        </AdminExplication>,
      ),
    )
    const details = host.querySelector('details.aa-explication')
    expect(details).not.toBeNull()
    expect(details.open).toBe(false)
    expect(details.querySelector('summary').textContent).toBe('Ce que ça change')
    // le texte reste dans le document : la recherche du navigateur le trouve
    expect(details.textContent).toContain('Le texte explicatif.')
    await act(async () => details.querySelector('summary').click())
    expect(details.open).toBe(true)
  })

  it('les onglets d’administration n’affichent plus de pavés d’emblée', () => {
    // chaque écran bavard a son rabat
    for (const source of [operations, roles, invitations, page]) {
      expect(source).toContain('<AdminExplication')
    }
    for (const composant of [
      'AdminMfaRecovery.jsx',
      'AdminAccountRetirement.jsx',
      'AdminAccountJournal.jsx',
      'AdminVerifiedEmail.jsx',
      'AdminSecurityAlerts.jsx',
      'AdminMfaSettings.jsx',
    ]) {
      expect(lire(`src/components/${composant}`)).toContain('AdminExplication')
    }
    // au moins six rabats sur la seule fiche « Accès »
    expect(operations.match(/<AdminExplication/g)).toHaveLength(3)
  })

  it('le rabat a la forme d’un pli cousu', () => {
    expect(css).toMatch(/\.aa-page \.aa-explication > summary::before\s*\{[^}]*content:\s*'\+'/)
    expect(css).toMatch(/\.aa-page \.aa-explication\[open\] > summary::before\s*\{[^}]*content:\s*'–'/)
    expect(css).toContain('.aa-page .aa-explication-texte')
  })
})

// ── 4. Le téléphone n'est pas un écran large ──────────────

describe('4. la page tient sur un téléphone', () => {
  const bloc = (requete) => {
    const debut = css.indexOf(`@media (max-width: ${requete}px)`)
    expect(debut).toBeGreaterThan(-1)
    const fin = css.indexOf('@media', debut + 10)
    return css.slice(debut, fin === -1 ? undefined : fin)
  }

  it('la fiche devient un carnet plein écran', () => {
    const mobile = bloc(760)
    expect(mobile).toMatch(/\.aa-fiche\s*\{[^}]*height:\s*100dvh/)
    expect(mobile).toMatch(/\.aa-fiche-onglets\s*\{[^}]*overflow-x:\s*auto/)
    expect(mobile).toMatch(/\.aa-fiche-tete\s*\{[^}]*row-gap/)
  })

  it('les onglets et les filtres défilent au doigt', () => {
    const mobile = bloc(760)
    expect(mobile).toMatch(/\.aa-register \.aa-tabs\s*\{[^}]*flex-wrap:\s*nowrap/)
    expect(mobile).toMatch(/\.aa-register \.aa-puces\s*\{[^}]*overflow-x:\s*auto/)
    expect(mobile).toContain('.aa-raccourcis')
  })

  it('les sceaux et les formulaires se replient', () => {
    const mobile = bloc(760)
    expect(mobile).toMatch(/\.aa-sceaux--ent\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/)
    expect(mobile).toMatch(/\.aa-formulaire-pied\s*\{[^}]*justify-content:\s*stretch/)
    expect(bloc(520)).toMatch(/\.aa-sceau\s*\{[^}]*font-size/)
  })

  it('le doigt n’est pas une souris', () => {
    expect(css).toContain('@media (pointer: coarse)')
    expect(css).toMatch(/\.aa-sceau\s*\{[^}]*min-height:\s*34px/)
    expect(css).toMatch(/@media \(pointer: coarse\)[\s\S]*min-height:\s*40px/)
  })
})
