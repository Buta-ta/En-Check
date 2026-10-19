// Conservative local grammar: never drop an unknown name, date, negation or filter.
export const normalizeDialogue = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[’]/g, "'").replace(/[?!.,…]/g, '').trim().replace(/\s+/g, ' ')

export function splitDialoguePeriod(value) {
  let text = normalizeDialogue(value)
    .replace(/^(bonjour|bonsoir|salut)[\s]+/, '')
    .replace(/(?:\s+)(?:s'il (?:te|vous) plait|stp|svp)$/, '')
  const periods = [
    ["aujourd'hui", /^aujourd'hui$/],
    ['hier', /^hier$/],
    ['cette semaine', /^(?:cette semaine|de cette semaine|de la semaine)$/],
    ['les 7 derniers jours', /^(?:les 7 derniers jours|ces 7 derniers jours)$/],
    ['la semaine precedente', /^(?:(?:la )?semaine (?:derniere|passee|precedente))$/],
  ]
  // Morning/evening are NOT silently widened to a whole day.
  const candidates = [...periods.map(([period, pattern]) => ({ period, pattern })), { pattern: /^\d{4}-\d{2}-\d{2}$/ }]
  const words = text.split(' ')
  for (let count = Math.min(5, words.length); count > 0; count--) {
    for (const side of ['end', 'start']) {
      const phrase = (side === 'end' ? words.slice(-count) : words.slice(0, count)).join(' ')
      const found = candidates.find(candidate => candidate.pattern.test(phrase))
      if (found) return { text: (side === 'end' ? words.slice(0, -count) : words.slice(count)).join(' ').trim(), period: found.period || phrase }
    }
  }
  return { text, period: null }
}

export function localRhIntent(text) {
  // Optional polite lead-in, followed by a complete supported expression.
  const body = text.replace(/^(?:peux tu|peux-tu|tu peux|pouvez vous|pouvez-vous) /, '')
    .replace(/^(?:me montrer|me donner|m'afficher|montre[- ]moi|montre|affiche|donne[- ]moi|fais voir|voir|consulter|regarde) /, '')
  if (/^(?:combien de pointages|(?:les |nos |des )?pointages|le nombre de pointages|on a combien de pointages)$/.test(body)) return 'pointages'
  if (/^(?:qui est en retard|qui etait en retard|qui est arrive apres l'heure|qui est arrive en retard|quels sont les retards|(?:les |nos |des )?retards|(?:les |des )?retardataires|on a des retardataires|est-ce qu'on a des retardataires)$/.test(body)) return 'retards'
  if (/^(?:sorties presumees a confirmer|quelles sorties restent a confirmer|(?:les )?sorties presumees(?: a confirmer)?|(?:les )?sorties a confirmer)$/.test(body)) return 'confirmations'
  return null
}
