import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import AssistantAnswer from '../../components/AssistantAnswer'
import { usesGeneralConversation } from '../assistantRouting'
import { resolveDialogue } from '../assistantDialogue'
import { detectNaturalCompanyIntent, answerNaturalCompanyQuestion } from '../assistantNaturalRh'

describe('Conversation unifiée', () => {
  it('route les questions générales et les suites sans importer le contexte métier', () => {
    expect(usesGeneralConversation('Comment organiser une réunion utile ?')).toBe(true)
    expect(usesGeneralConversation('Que faire pour motiver une équipe ?')).toBe(true)
    expect(usesGeneralConversation('Peux-tu rédiger un message d’accueil ?')).toBe(true)
    expect(usesGeneralConversation('Comment ?')).toBe(true)
    expect(usesGeneralConversation('Bonjour')).toBe(true)
    expect(usesGeneralConversation('Merci')).toBe(true)
    expect(resolveDialogue('Comment ?').answer).toBeTruthy()
    expect(resolveDialogue('que peux tu faire ?').answer.text).toContain('assistant conversationnel')
    expect(resolveDialogue('qui es-tu ?').answer.text).toContain('assistant conversationnel')
    expect(resolveDialogue('tu es un assistant ?').answer.text).toContain('assistant IA conversationnel')
    expect(resolveDialogue('tu es une IA ?').answer.text).toContain('assistant IA conversationnel')
    expect(resolveDialogue('EN check').answer.text).toContain('plateforme de suivi')
    expect(resolveDialogue('comment ça va ?').answer.text).toContain('Tout va très bien')
    expect(usesGeneralConversation('Comment ?', [{role:'user',text:'Réunion'}])).toBe(true)
    for (const text of ['Sara Dupont', 'Les retards hier', 'et hier ?', 'Comment calculer le salaire de Sara ?', 'Comment gérer mon dossier ?', 'Pourquoi exemple@example.org ?', 'Explique une sortie présumée']) {
      expect(usesGeneralConversation(text, [{role:'user',text:'Réunion'}])).toBe(false)
    }
  })
  it('présente une seule identité et garde la provenance dans les précisions', () => {
    const html = renderToStaticMarkup(<AssistantAnswer answer={{title:'Réponse',text:'Texte',source:'Reformulation IA — à vérifier',warning:'Résultat partiel'}} />)
    expect(html).toContain('Assistant En-Check')
    expect(html).not.toContain('ec-dialogue-provenance')
    expect(html.indexOf('Reformulation IA')).toBeGreaterThan(html.indexOf('<details'))
    expect(html.indexOf('Résultat partiel')).toBeLessThan(html.indexOf('<details'))
    const mixedChoicesHtml = renderToStaticMarkup(
      <AssistantAnswer
        answer={{
          text: 'Bonjour',
          choices: ["Qui est en retard aujourd'hui", "Combien de pointages aujourd'hui", 'Sorties présumées à confirmer'],
        }}
        onChoice={() => {}}
      />
    )
    expect(mixedChoicesHtml).toContain("Qui est en retard aujourd&#x27;hui")
    expect(mixedChoicesHtml).toContain("Combien de pointages aujourd&#x27;hui")
  })
  it('une saisie, pas de modes ni confirmation répétitive; activation avant appel', () => {
    const source = readFileSync(new URL('../../components/AssistantDock.jsx', import.meta.url), 'utf8')
    expect(source).not.toMatch(/generalChat|AssistantChat|type="checkbox"|Votre message général/)
    expect(source).toContain('Activer et poursuivre')
    expect(source).toContain('Confidentialité')
    expect(source).toContain('Nouvelle discussion')
    expect(source).toContain('if (general && !activated.current && !activate)')
    expect(source).toContain('if (!general) publicHistory.current = []')
    expect(source).toContain('chatAbort.current?.abort()')
  })
  it('comprend les questions RH naturelles (« qui a dépointé ? », « qui est encore là ? », « qui a pointé ? »)', async () => {
    expect(detectNaturalCompanyIntent('qui a dépointé ?')).toEqual({ intent: 'checked_out', period: "aujourd'hui" })
    expect(detectNaturalCompanyIntent('qui est encore en poste ?')).toEqual({ intent: 'still_in', period: "aujourd'hui" })
    expect(detectNaturalCompanyIntent('qui a pointé ?')).toEqual({ intent: 'checked_in', period: "aujourd'hui" })
    expect(detectNaturalCompanyIntent('qui est absent ?')).toEqual({ intent: 'absents', period: "aujourd'hui" })
    expect(detectNaturalCompanyIntent("combien d'employés ?")).toEqual({ intent: 'headcount', period: null })

    const builder = {
      select: () => builder,
      eq: () => builder,
      gte: () => builder,
      lt: () => builder,
      lte: () => builder,
      order: () => builder,
      maybeSingle: async () => ({ data: { id: 'demo', name: 'EN-NOUS', timezone: 'Africa/Porto-Novo' } }),
      limit: async () => ({
        data: [
          {
            id: 'att-1',
            employee_id: 'emp-1',
            check_time: '2026-10-19T10:42:00Z',
            check_type: 'in',
            is_auto_closed: false,
            employees: { first_name: 'Hippo', last_name: 'BIYOKILA', matricule: 'EMP-01' },
          },
        ],
      }),
    }
    const client = {
      auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
      rpc: async () => ({ data: true }),
      from: () => builder,
    }

    const answer = await answerNaturalCompanyQuestion({
      query: 'qui a dépointé ?',
      admin: { enterprise_id: 'demo' },
      client,
      now: new Date('2026-10-19T14:00:00Z'),
    })
    expect(answer.title).toBe('Collaborateurs ayant dépointé')
    expect(answer.text).toContain('Personne n’a encore dépointé')
    expect(answer.text).toContain('Hippo BIYOKILA')
  })
})
