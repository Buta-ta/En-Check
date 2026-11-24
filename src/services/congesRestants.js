// ═══════════════════════════════════════════════════════════
// 🌴 CONGÉS : CE QUI RESTE, ET LE PROCHAIN RETOUR
//
// Deux nombres que la page Absences affiche, et qu'elle doit donc
// calculer une seule fois. La règle de la maison est simple : un
// chiffre ne se dit pas deux fois, et s'il se dit deux fois — le
// transat de l'en-tête et la tuile du compteur — les deux doivent
// sortir du même calcul, sinon l'un des deux ment le jour où
// l'autre est corrigé.
//
// Le module est un service, pas un composant : un module de
// composants ne doit exporter que des composants (règle du
// rechargement à chaud), et ceci est une donnée.
// ═══════════════════════════════════════════════════════════

// Ce qu'il reste de congés, en moyenne, sur l'effectif passé.
// Formule inchangée depuis la tuile de compteur : un plancher à zéro
// (personne ne doit un congé négatif), un plafond par défaut, une
// décimale seulement — l'écran affiche des jours, pas des promesses.
export function soldeMoyen({ employes = [], joursPrisParEmploye = {}, plafond = 30 } = {}) {
  const plan = plafond || 30
  const restants = employes.map((e) => Math.max(0, plan - (joursPrisParEmploye[e.id] ?? 0)))
  if (!restants.length) return plan
  return Math.round((restants.reduce((somme, n) => somme + n, 0) / restants.length) * 10) / 10
}

// La prochaine date de retour attendue : parmi les absences qui ne sont
// pas refusées et qui ne sont pas déjà passées, la plus proche fin.
// `null` quand personne ne revient — la page n'invente pas de date.
export function prochainRetour(absences = [], aujourdhui = '') {
  let meilleur = null
  for (const a of absences) {
    if ((a.status || 'approuve') === 'refuse') continue
    const fin = a.end_date || a.start_date
    if (!fin) continue
    if (aujourdhui && fin < aujourdhui) continue // passée : personne ne « revient » d'hier
    if (!meilleur || fin < meilleur) meilleur = fin
  }
  return meilleur
}

// « lun. 30 nov. » — le jour court devant la date, parce que ce qui
// compte dans un retour, c'est d'abord le jour de la semaine.
export function formatRetourFr(iso) {
  if (!iso) return null
  return new Date(`${iso}T12:00:00Z`)
    .toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' })
}
