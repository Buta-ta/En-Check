// Local courtesies only; not a claim of unrestricted generative conversation.
export function conversationalRequest(value) {
  const original = String(value || '').trim()
  const greeting = original.match(/^(bonjour|bonsoir|salut|coucou)(?=$|[\s,!?.])/i)
  const query = greeting ? original.slice(greeting[0].length).replace(/^[\s,!?.]+/, '') : original
  if (greeting && !query) return { answer: { title: greeting[1].toLowerCase() === 'bonsoir' ? 'Bonsoir !' : 'Bonjour !', text: 'Je peux vous aider à consulter les pointages, comprendre les retards ou retrouver les sorties présumées à confirmer. Que souhaitez-vous vérifier ?', choices: ['Combien de pointages', 'Qui est en retard', 'Sorties présumées à confirmer'] } }
  if (/^(merci( beaucoup)?|super merci|parfait merci)[!.\s]*$/i.test(original)) return { answer: { title: 'Avec plaisir !', text: 'Vous pouvez poursuivre avec une autre période ou me poser une nouvelle question.' } }
  return { query, greeting: Boolean(greeting) }
}
