// src/utils/jourCourt.js
// « 2026-10-05 » → « 5 oct. » — sans passer par Date, donc sans dépendre du
// fuseau du navigateur : une clé locale ne doit jamais glisser d'un jour.

const MOIS_COURTS = [
  'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
]

export function jourCourt(cle) {
  const [annee, mois, jour] = String(cle || '').split('-').map(Number)
  if (!annee || !mois || !jour) return String(cle || '')
  return `${jour} ${MOIS_COURTS[mois - 1] || ''}`.trim()
}
