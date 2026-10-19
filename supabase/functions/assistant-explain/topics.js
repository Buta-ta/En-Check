// Public documentation only. No raw user text, enterprise identifier or RH record.
export const TOPICS = Object.freeze({
  presumed_exit: {
    title: 'Comprendre une sortie présumée',
    facts: 'Une sortie présumée est une estimation, pas une sortie réellement badgée. Elle reste à statuer. Valider conserve son origine présumée et trace la décision. Écarter retire les heures estimées de la fiche mais conserve la trace d’audit. Une proposition virtuelle peut ne pas encore être enregistrée en base. Consulter une estimation ne la valide pas. Aucun calcul de paie ne doit être inventé.',
    fallback: 'Une sortie présumée est une estimation, pas un badge réel. Vous devez l’examiner avant de décider. La validation conserve sa provenance ; l’écartement retire les heures estimées de la fiche tout en gardant l’audit. La simple consultation ne valide rien.',
  },
  lateness: {
    title: 'Comprendre les retards',
    facts: 'En-Check utilise le moteur métier de retard, la grille applicable au jour concerné, les tolérances configurées et les règles de jours fériés. Aucun horaire ou seuil universel ne doit être inventé. Une absence de planning ne prouve ni repos ni ponctualité. Les données manquantes doivent être signalées. Un retard ne permet pas de déduire sa cause, une sanction ou une retenue sur salaire.',
    fallback: 'Le retard dépend de la grille applicable et des tolérances configurées, avec les règles de jours fériés. Sans planning exploitable, on ne peut pas conclure que la personne est ponctuelle ou en repos. Un retard ne dit pas pourquoi il a eu lieu et ne justifie pas automatiquement une sanction.',
  },
  attendance_count: {
    title: 'Comprendre le nombre de pointages',
    facts: 'Un nombre de lignes de pointage n’est pas un nombre de personnes présentes ni une durée travaillée. Une personne peut avoir plusieurs entrées et sorties. Des estimations enregistrées peuvent faire partie des lignes. Les heures réelles, présumées et validées doivent être distinguées. Les nuits peuvent nécessiter un rattachement au jour travaillé. Le calcul des heures relève des moteurs En-Check et non du modèle génératif.',
    fallback: 'Le compteur de pointages compte des lignes, pas des employés ni des heures. Une même personne peut avoir plusieurs entrées et sorties. Des estimations peuvent aussi être enregistrées. Pour les heures travaillées, consultez le calcul métier, qui distingue notamment les données réelles et présumées.',
  },
})
export function isTopic(topic) {
  return typeof topic === 'string' && Object.hasOwn(TOPICS, topic)
}
