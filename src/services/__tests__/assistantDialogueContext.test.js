import { describe, expect, it, vi } from 'vitest'
import { resolveDialogue, dialogueScope, currentDialogue, SESSION_TTL } from '../assistantDialogue'
import { parseRhQuestion, answerRhQuestion } from '../assistantRh'
import { answerExplanation } from '../assistantExplanation'

describe('Compréhension locale conservatrice', () => {
  it.each([
    ['Qui est arrivé après l’heure aujourd’hui ?', 'retards', "aujourd'hui"],
    ['On a des retardataires hier ?', 'retards', 'hier'],
    ['Fais voir les retards la semaine passée', 'retards', 'la semaine precedente'],
    ['Hier, tu peux me montrer les retards stp ?', 'retards', 'hier'],
    ['Peux-tu me montrer nos pointages cette semaine ?', 'pointages', 'cette semaine'],
    ['Donne-moi le nombre de pointages de la semaine', 'pointages', 'cette semaine'],
    ['Affiche les sorties à confirmer les 7 derniers jours', 'confirmations', 'les 7 derniers jours'],
    ['Les sorties présumées hier', 'confirmations', 'hier'],
    ['Bonjour, pouvez-vous me montrer les retards aujourd’hui svp ?', 'retards', "aujourd'hui"],
  ])('%s', (query, intent, period) => {
    expect(parseRhQuestion(query)).toEqual({ intent, period })
    expect(parseRhQuestion(resolveDialogue(query).query)).toEqual({ intent, period })
  })
  it.each([
    'Montre les retards de Sara hier', 'Ne montre pas les retards hier',
    'Les retards sauf ceux de Paul hier', 'Les pointages de Paris hier',
    'Les retards demain', 'Les retards ce matin', 'Les retards de plus de 15 minutes hier',
    'Les retards hier et les pointages aujourd’hui', 'Les retards hier aujourd’hui',
    'Les retards le mois passé', 'Les retards sans planning hier',
  ])('ne supprime jamais les contraintes non comprises : %s', query => {
    expect(parseRhQuestion(resolveDialogue(query).query)).toEqual({ unsupported: true })
  })
  it('préserve une recherche de personne et ne la convertit pas en bilan collectif', () => {
    expect(resolveDialogue('Sara Dupont').query).toBe('Sara Dupont')
    expect(resolveDialogue('Sara Dupont').state).toBeNull()
  })
})

describe('Contexte et clarifications', () => {
  it('plainte → choix explicite → consultation → autre période', () => {
    const first = resolveDialogue('Encore des retards ce matin…')
    expect(first.answer.text).toContain('journée entière')
    expect(first.query).toBeUndefined()
    const second = resolveDialogue('regarde déjà', first.state)
    expect(parseRhQuestion(second.query)).toEqual({ intent: 'retards', period: "aujourd'hui" })
    const third = resolveDialogue('et hier ?', second.state)
    expect(parseRhQuestion(third.query)).toEqual({ intent: 'retards', period: 'hier' })
    const fourth = resolveDialogue('et la semaine passée ?', third.state)
    expect(parseRhQuestion(fourth.query)).toEqual({ intent: 'retards', period: 'la semaine precedente' })
  })
  it('ne choisit pas une période ou un sujet absent', () => {
    const first = resolveDialogue('Encore des retards')
    const second = resolveDialogue('regarde déjà', first.state)
    expect(parseRhQuestion(second.query).period).toBeNull()
    expect(resolveDialogue('et hier ?').answer.title).toBe('Précisons ensemble')
    expect(resolveDialogue('oui').query).toBeUndefined()
    expect(resolveDialogue('Ça ne va pas aujourd’hui').query).toBeUndefined()
  })
  it('conseils locaux identifiés et pas de causes inventées', () => {
    const result = resolveDialogue('Comment les réduire ?', { intent: 'retards' })
    expect(result.query).toBeUndefined()
    expect(result.answer.source).toContain('référence locale')
    expect(result.answer.warning).toContain('Aucune cause')
    expect(resolveDialogue('et pourquoi ?', { intent: 'retards' }).answer.title).toBe('Précisons ensemble')
  })
  it('merci conserve le contexte, annuler et une nouvelle recherche l’effacent', () => {
    const { state } = resolveDialogue('Les retards hier')
    expect(resolveDialogue('Merci beaucoup', state).state).toEqual(state)
    expect(resolveDialogue('annule', state).state).toBeNull()
    expect(resolveDialogue('Sara Dupont', state).state).toBeNull()
    expect(resolveDialogue('Les pointages', state).state).toEqual({ intent: 'pointages', period: null, pending: null })
  })
  it('isole compte, entreprise et expiration', () => {
    const scope = dialogueScope({ id: 'user-a', enterprise_id: 'one' })
    const state = { intent: 'retards', period: 'hier' }
    const session = { scope, state, at: 1000 }
    expect(currentDialogue(session, scope, 1001)).toEqual(state)
    expect(currentDialogue(session, scope, 1000 + SESSION_TTL)).toBeNull()
    expect(currentDialogue(session, scope, 999)).toBeNull()
    expect(currentDialogue(session, dialogueScope({ id: 'user-b', enterprise_id: 'one' }), 1001)).toBeNull()
    expect(currentDialogue(session, dialogueScope({ id: 'user-a', enterprise_id: 'two' }), 1001)).toBeNull()
  })
  it('une clarification ne nécessite aucune lecture ni aucun appel IA', async () => {
    const client = { functions: { invoke: vi.fn() }, auth: { getUser: vi.fn() }, rpc: vi.fn() }
    const response = await answerRhQuestion({ query: resolveDialogue('Fais voir les retards').query, admin: { enterprise_id: 'demo' }, client })
    expect(response.title).toBe('Pour quelle période ?')
    expect(client.auth.getUser).not.toHaveBeenCalled()
    expect(await answerExplanation('Les retards de Sara hier', client)).toBeNull()
    expect(client.functions.invoke).not.toHaveBeenCalled()
  })
  it('une reformulation passe encore par le contrôle serveur des droits', async () => {
    const client = { auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'a' } } })) }, rpc: vi.fn(async () => ({ data: false })), from: vi.fn() }
    const response = await answerRhQuestion({ query: resolveDialogue('On a des retardataires hier ?').query, admin: { enterprise_id: 'demo' }, client })
    expect(response.title).toBe('Accès non confirmé')
    expect(client.rpc).toHaveBeenCalledWith('encheck_est_admin_de', { p_enterprise: 'demo' })
    expect(client.from).not.toHaveBeenCalled()
  })
})
