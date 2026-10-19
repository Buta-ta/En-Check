import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import AssistantAnswer from '../../components/AssistantAnswer'
import { usesGeneralConversation } from '../assistantRouting'
import { resolveDialogue } from '../assistantDialogue'

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
})
