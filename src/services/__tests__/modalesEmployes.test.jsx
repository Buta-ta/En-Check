// ═══════════════════════════════════════════════════════════
// LES FENÊTRES DE LA PAGE EMPLOYÉS
//
// Ce que ces tests défendent :
//
//   · l'accès au portail se lit d'un coup d'œil : l'identifiant
//     réel, la dernière connexion, l'état du portail — et le mot
//     de passe ne part que lorsqu'il est sûr ;
//   · « Envoyer les horaires » montre toujours quelque chose :
//     le message exact, ce qu'il contient, et les moyens de
//     l'envoyer. Un navigateur qui bloque la fenêtre ne peut plus
//     faire croire que le bouton est mort ;
//   · aucun mot d'atelier, aucun code technique dans le texte lu.
// ═══════════════════════════════════════════════════════════

// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

import ModaleAccesPortail from '../../components/employes/ModaleAccesPortail'
import ModaleHoraires from '../../components/employes/ModaleHoraires'

const personne = (extra = {}) => ({
  id: 'emp-1',
  first_name: 'Hippo',
  last_name: 'Biyokila',
  matricule: 'ENN-0002',
  phone: '+229 97 00 00 00',
  email: 'hippo@exemple.test',
  ...extra,
})

const planningPersonnalise = {
  use_custom_hours: true,
  custom_start_time: '08:00:00',
  custom_end_time: '17:00:00',
  custom_has_break: true,
  custom_break_start: '12:00:00',
  custom_break_end: '13:00:00',
  custom_work_days: [1, 2, 3, 4, 5],
}

let hote
let racine

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  hote = document.createElement('div')
  document.body.appendChild(hote)
  racine = createRoot(hote)
})

afterEach(() => {
  act(() => racine.unmount())
  hote.remove()
  document.body.style.overflow = ''
  vi.restoreAllMocks()
})

async function rendre(element) {
  await act(async () => racine.render(element))
  return hote
}

const bouton = (texte) => [...hote.querySelectorAll('button')].find((b) => b.textContent.includes(texte))

// React garde sa propre trace de la valeur : il faut passer par le
// setter natif pour qu'un `input` soit vraiment entendu.
function saisir(champ, valeur) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(champ, valeur)
  champ.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('la fenêtre d’accès au portail', () => {
  it('nomme le geste : créer, migrer ou modifier', async () => {
    await rendre(<ModaleAccesPortail employee={personne()} onClose={() => {}} />)
    expect(hote.querySelector('.rgm-titre').textContent).toBe('Créer l’accès portail')

    await rendre(<ModaleAccesPortail employee={personne({ password_hash: 'x' })} ancienSysteme onClose={() => {}} />)
    expect(hote.querySelector('.rgm-titre').textContent).toBe('Migrer l’accès portail')

    await rendre(<ModaleAccesPortail employee={personne({ user_id: 'u-1' })} aCompte compteSupabase onClose={() => {}} />)
    expect(hote.querySelector('.rgm-titre').textContent).toBe('Modifier le mot de passe')
  })

  it('montre l’identifiant réel et dit ce qui manque', async () => {
    await rendre(<ModaleAccesPortail employee={personne()} onClose={() => {}} />)
    const texte = hote.textContent
    expect(texte).toContain('ENN-0002')
    expect(texte).toContain('+229 97 00 00 00')
    expect(texte).toContain('hippo@exemple.test')
    expect(texte).toContain('/employee/login')

    await rendre(<ModaleAccesPortail employee={personne({ phone: '', email: '' })} onClose={() => {}} />)
    expect(hote.textContent).toContain('non renseigné')
  })

  it('écrit la dernière connexion, y compris quand elle n’a jamais eu lieu', async () => {
    await rendre(
      <ModaleAccesPortail employee={personne({ user_id: 'u-1' })} aCompte compteSupabase derniereConnexion="Jamais connecté" onClose={() => {}} />
    )
    const valeur = [...hote.querySelectorAll('.rgm-valeur')].find((v) => v.textContent === 'Jamais connecté')
    expect(valeur.getAttribute('data-etat')).toBe('jamais')
    expect(hote.querySelector('.rgm-perle[data-creuse="oui"]')).not.toBeNull()
  })

  it('ne laisse pas enregistrer un mot de passe trop court ou mal confirmé', async () => {
    const onEnregistrer = vi.fn()
    await rendre(<ModaleAccesPortail employee={personne()} onEnregistrer={onEnregistrer} onClose={() => {}} />)

    const principal = bouton('Créer')
    expect(principal.disabled).toBe(true)

    const champs = hote.querySelectorAll('input')
    await act(async () => {
      saisir(champs[0], 'court')
    })
    expect(hote.textContent).toContain('Encore 1 caractère')

    await act(async () => {
      saisir(champs[0], 'motdepasse')
      saisir(champs[1], 'motdepasse')
    })
    expect(bouton('Créer').disabled).toBe(false)
    expect(hote.textContent).toContain('Les deux saisies correspondent')
  })

  it('envoie le mot de passe une seule fois, et affiche le refus de la base', async () => {
    const onEnregistrer = vi.fn().mockResolvedValue({ ok: false, message: 'La base a refusé.' })
    await rendre(<ModaleAccesPortail employee={personne()} onEnregistrer={onEnregistrer} onClose={() => {}} />)

    const champs = hote.querySelectorAll('input')
    await act(async () => {
      saisir(champs[0], 'motdepasse')
      saisir(champs[1], 'motdepasse')
    })
    await act(async () => {
      bouton('Créer').dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(onEnregistrer).toHaveBeenCalledWith('motdepasse')
    expect(hote.querySelector('[role="alert"]').textContent).toContain('La base a refusé.')
  })

  it('ne crée pas d’accès sans matricule, et le dit', async () => {
    await rendre(<ModaleAccesPortail employee={personne({ matricule: '' })} onClose={() => {}} />)
    expect(hote.textContent).toContain('Aucun matricule')
    expect(bouton('Créer').disabled).toBe(true)
  })

  it('bascule l’accès portail et revient en arrière si la base refuse', async () => {
    const onBasculerPortail = vi.fn().mockResolvedValue({ ok: false })
    await rendre(
      <ModaleAccesPortail
        employee={personne({ user_id: 'u-1', employee_portal_enabled: true })}
        aCompte
        compteSupabase
        portailActif
        onBasculerPortail={onBasculerPortail}
        onClose={() => {}}
      />
    )
    const bascule = hote.querySelector('.rgm-bascule')
    expect(bascule.getAttribute('aria-pressed')).toBe('true')
    expect(hote.textContent).toContain('Accès portail actif')

    await act(async () => {
      bascule.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })
    expect(onBasculerPortail).toHaveBeenCalledWith(expect.objectContaining({ id: 'emp-1' }), false)
    expect(hote.querySelector('.rgm-bascule').getAttribute('aria-pressed')).toBe('true')
  })
})

describe('la fenêtre d’envoi des horaires', () => {
  it('montre les horaires réels avant de les envoyer', async () => {
    await rendre(
      <ModaleHoraires employee={personne({ employee_schedules: [planningPersonnalise] })} entrepriseName="AfroTech Bénin" onClose={() => {}} />
    )
    const texte = hote.textContent
    expect(texte).toContain('08:00 – 17:00')
    expect(texte).toContain('12:00 – 13:00')
    expect(texte).toContain('du lundi au vendredi')
  })

  it('compose un message sobre, avec le nom et le matricule', async () => {
    await rendre(
      <ModaleHoraires employee={personne({ employee_schedules: [planningPersonnalise] })} entrepriseName="AfroTech Bénin" onClose={() => {}} />
    )
    const message = hote.querySelector('.rgm-message').textContent
    expect(message).toContain('Hippo Biyokila')
    expect(message).toContain('Matricule : ENN-0002')
    expect(message).toContain('Journée : 08:00 – 17:00')
    expect(message).toContain('Envoyé depuis En-Check')
    expect(message).not.toMatch(/[\u2600-\u27bf]/u)
  })

  it('ouvre WhatsApp sur le numéro de l’employé, message encodé', async () => {
    const ouvert = vi.spyOn(window, 'open').mockReturnValue({ opener: null })
    await rendre(
      <ModaleHoraires employee={personne({ employee_schedules: [planningPersonnalise] })} onClose={() => {}} />
    )
    await act(async () => {
      bouton('Ouvrir WhatsApp').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    const url = ouvert.mock.calls[0][0]
    expect(url.startsWith('https://wa.me/22997000000?text=')).toBe(true)
    expect(decodeURIComponent(url)).toContain('Journée : 08:00 – 17:00')
    expect(hote.textContent).not.toContain('bloqué')
  })

  it('dit quand le navigateur bloque la fenêtre, au lieu de ne rien faire', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null)
    await rendre(
      <ModaleHoraires employee={personne({ employee_schedules: [planningPersonnalise] })} onClose={() => {}} />
    )
    await act(async () => {
      bouton('Ouvrir WhatsApp').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    const alerte = hote.querySelector('[role="alert"]')
    expect(alerte.textContent).toContain('a bloqué l’ouverture de WhatsApp')
    expect(alerte.textContent).toContain('copiez le message')
  })

  it('copie le message', async () => {
    const ecrire = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: ecrire }, configurable: true })
    await rendre(
      <ModaleHoraires employee={personne({ employee_schedules: [planningPersonnalise] })} onClose={() => {}} />
    )
    await act(async () => {
      bouton('Copier').dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })
    expect(ecrire).toHaveBeenCalledTimes(1)
    expect(ecrire.mock.calls[0][0]).toContain('Journée : 08:00 – 17:00')
    expect(bouton('Message copié')).toBeTruthy()
  })

  it('ne propose SMS et email que si l’employé a un numéro ou une adresse', async () => {
    await rendre(
      <ModaleHoraires employee={personne({ employee_schedules: [planningPersonnalise] })} onClose={() => {}} />
    )
    expect(hote.querySelector('a[href^="sms:"]')).not.toBeNull()
    expect(hote.querySelector('a[href^="mailto:"]')).not.toBeNull()

    await rendre(
      <ModaleHoraires
        employee={personne({ phone: '', email: '', employee_schedules: [planningPersonnalise] })}
        onClose={() => {}}
      />
    )
    expect(hote.querySelector('a[href^="sms:"]')).toBeNull()
    expect(hote.querySelector('a[href^="mailto:"]')).toBeNull()
  })

  it('le dit quand aucun horaire n’existe, et propose de les définir', async () => {
    const onDefinirHoraires = vi.fn()
    await rendre(<ModaleHoraires employee={personne()} onDefinirHoraires={onDefinirHoraires} onClose={() => {}} />)

    expect(hote.textContent).toContain('aucun horaire défini')
    expect(hote.querySelector('.rgm-message').textContent).toContain('Journée : à définir')

    await act(async () => {
      bouton('Définir ses horaires').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(onDefinirHoraires).toHaveBeenCalledTimes(1)
  })

  it('se ferme à Échap', async () => {
    const onClose = vi.fn()
    await rendre(<ModaleHoraires employee={personne()} onClose={onClose} />)
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('le ton des fenêtres', () => {
  it('ne met aucun mot d’atelier dans ce qui se lit', async () => {
    await rendre(<ModaleAccesPortail employee={personne()} onClose={() => {}} />)
    expect(hote.textContent).not.toMatch(/atelier|perle du métier|trame|fil de trame/i)

    await rendre(<ModaleHoraires employee={personne()} onClose={() => {}} />)
    expect(hote.textContent).not.toMatch(/atelier|perle du métier|trame|fil de trame/i)
  })
})
