// src/lib/controleDisponible.js
// ═══════════════════════════════════════════════════════════════════════════
// 🧭 « CE CONTRÔLE N'A PAS ÉTÉ FAIT » — le dire, au lieu de laisser croire
//
// LE DÉFAUT QUE CE FICHIER CORRIGE (G7, constat V-B3)
//   Quand aucun seuil n'est configuré, les écrans d'alerte se taisent — et c'est
//   la bonne décision : une alerte est une affirmation, elle exige une règle
//   choisie (§5.3.1). Mais le silence, à côté d'un tableau rempli de chiffres,
//   se lit comme « tout va bien ». Un « 0 dépassement » silencieux fait croire à
//   une conformité qui n'a jamais été évaluée.
//
//   Le fondateur avait tranché dans les deux sens, et les deux sont vrais :
//     · pas d'alerte rouge sur une règle que personne n'a posée ;
//     · mais pas de blanc qui se lise comme une conformité.
//   D'où ce module : l'alerte reste MUETTE, et l'écran qui prétend mesurer dit
//   explicitement que ce contrôle-là n'a pas été fait, et pourquoi.
//
// CE QU'IL NE FAIT JAMAIS
//   · inventer un seuil (le défaut produit de 48 h n'est pas une règle) ;
//   · présenter « non évalué » comme « conforme » ;
//   · utiliser le mot « légal » : aucune source pays n'est vérifiée (D5).
//
// ⚠️ Fonctions PURES : la règle se vérifie sans base et sans écran.
// ═══════════════════════════════════════════════════════════════════════════

//  Nommer une semaine (« du 05/10 au 11/10 ») : sans cela, deux messages
//  portant sur deux semaines différentes semblent se contredire.
import { jourCourt } from '../utils/jourCourt'

/** Les trois raisons d'un contrôle non fait, en français. */
export const RAISONS_INDISPONIBLE = {
  aucun_seuil: 'Aucun seuil hebdomadaire choisi par l’entreprise : ce contrôle n’est pas fait.',
  desactive: 'L’alerte hebdomadaire a été désactivée par une décision enregistrée.',
  case_decochee: 'L’alerte hebdomadaire n’est pas activée : personne n’a demandé à être prévenu.',
  non_calcule: 'Le calcul de la semaine n’est pas disponible pour cette période.',
  lecture_impossible: 'Le seuil n’a pas pu être lu : ce contrôle n’est pas fait.',
  regle_sans_verdict: 'Les semaines n’ont pas pu être rattachées à une règle : aucun verdict n’est prononcé.',
  semaine_en_cours: 'La semaine en cours n’est pas terminée : le contrôle se prononcera une fois tous ses jours échus.',
  semaine_a_venir: 'Cette semaine n’a pas encore commencé : il n’y a rien à contrôler.',
  semaine_partielle: 'La semaine n’est couverte que partiellement : « aucun dépassement » ne s’y prononce pas.',
}

/** Le libellé court, pour une puce ou une ligne de pied. */
export const ETIQUETTE_INDISPONIBLE = 'Contrôle indisponible'

/**
 * Pourquoi le contrôle hebdomadaire n'a pas été fait, ou `null` s'il a été fait.
 *
 * @param {object|null} plafond  l'objet `plafond_hebdo` du moteur
 * @returns {{etiquette: string, raison: string}|null}
 */
export function pourquoiControleIndisponible(plafond) {
  //  Évalué : il n'y a rien à dire de plus que le résultat lui-même.
  //  ⚠️ SAUF si la semaine n'a pas été vécue en entier. Une semaine en cours ou
  //  à venir n'est pas « sans dépassement » : elle n'a pas encore eu lieu. La
  //  dire conforme serait exactement la faute que ce module existe pour éviter.
  if (plafond && plafond.disponible === true) {
    const enCours = (plafond.semaines || []).filter(
      (s) => s && (s.a_venir === true || s.partielle === true),
    )
    if (enCours.length === 0) return null
    //  Une semaine partielle ET un dépassement prouvé : l'alerte parle de
    //  cette semaine-là, la ligne n'a pas à la contredire.
    if (enCours.every((s) => s.depasse === true)) return null

    //  ⚠️ PLUSIEURS SEMAINES, PLUSIEURS VÉRITÉS. Une carte peut signaler un
    //  dépassement sur une semaine pendant qu'une AUTRE semaine n'a pas encore
    //  commencé. Dire « cette semaine n'a pas commencé » sans nommer laquelle
    //  donne l'impression que le message contredit l'alerte, ou qu'il la
    //  relativise. On nomme donc la ou les semaines concernées.
    const nonEvalues = enCours.filter((s) => s.depasse !== true)
    const nommer = (s) => (s.debut && s.fin ? `du ${jourCourt(s.debut)} au ${jourCourt(s.fin)}` : null)

    if (nonEvalues.some((s) => s.a_venir === true)) {
      const aVenir = nonEvalues.filter((s) => s.a_venir === true)
      const ou = aVenir.map(nommer).filter(Boolean)
      return {
        etiquette: ETIQUETTE_INDISPONIBLE,
        raison: ou.length
          ? `La semaine ${ou.join(' et ')} n’a pas encore commencé : il n’y a rien à contrôler de ce côté-là.`
          : RAISONS_INDISPONIBLE.semaine_a_venir,
      }
    }

    //  ⚠️ « En cours » n'est vrai que si la semaine contient la journée
    //  d'aujourd'hui. Une semaine PASSÉE que la fenêtre ne couvre qu'en partie
    //  (mois écourté, lecture bornée) n'est pas « en cours » : elle est
    //  incomplète. Confondre les deux ferait attendre un verdict qui ne
    //  viendra jamais.
    const aujourdHui = plafond.aujourd_hui || null
    const contientAujourdHui = (s) =>
      Boolean(aujourdHui) && s.debut && s.fin && s.debut <= aujourdHui && aujourdHui <= s.fin
    const touteLaSemaineEstEnCours = nonEvalues.every(
      (s) => Number(s.joursEchues) < 7 && (aujourdHui ? contientAujourdHui(s) : true),
    )
    const ou = nonEvalues.map(nommer).filter(Boolean)
    const suffixe = ou.length ? ` (semaine ${ou.join(', ')})` : ''
    return {
      etiquette: ETIQUETTE_INDISPONIBLE,
      raison: (touteLaSemaineEstEnCours
        ? RAISONS_INDISPONIBLE.semaine_en_cours
        : RAISONS_INDISPONIBLE.semaine_partielle) + suffixe,
    }
  }

  //  Aucun objet du tout : le calcul n'a pas été produit (période vide, panne).
  if (!plafond) {
    return {
      etiquette: ETIQUETTE_INDISPONIBLE,
      raison: RAISONS_INDISPONIBLE.non_calcule,
    }
  }

  //  Le moteur explique son silence ; on traduit son motif, on ne le réécrit pas.
  //
  //  ⚠️ L'ORDRE COMPTE (constat de vérification). `motif_silence` vient du
  //  chargeur SANS DATE : il décrit l'état « aujourd'hui » du réglage
  //  d'entreprise, pas la raison pour laquelle les semaines n'ont pas été
  //  jugées. Quand le moteur a une raison propre — « 5 semaine(s) sans règle
  //  résolue » —, c'est ELLE qui est vraie.
  //
  //  Cas réel : serveur sans les migrations, seuil d'entreprise à 45 h
  //  enregistré. L'ancien ordre affichait « Aucun seuil hebdomadaire choisi
  //  par l'entreprise » — faux, et il envoyait chercher un réglage qui existe.
  const motif = String(plafond.motif || plafond.motif_silence || '')
  if (/désactivée par une décision/i.test(motif)) {
    return { etiquette: ETIQUETTE_INDISPONIBLE, raison: RAISONS_INDISPONIBLE.desactive }
  }
  if (/case «|n’est pas cochée|n'est pas cochée/i.test(motif)) {
    return { etiquette: ETIQUETTE_INDISPONIBLE, raison: RAISONS_INDISPONIBLE.case_decochee }
  }
  if (/aucun seuil/i.test(motif)) {
    return { etiquette: ETIQUETTE_INDISPONIBLE, raison: RAISONS_INDISPONIBLE.aucun_seuil }
  }
  if (/lecture/i.test(motif)) {
    return { etiquette: ETIQUETTE_INDISPONIBLE, raison: RAISONS_INDISPONIBLE.lecture_impossible }
  }
  //  ⚠️ Le moteur n'a jugé AUCUNE semaine faute de règle résolue (migration
  //  absente, panne de la RPC datée). Le repli final répondait « aucun seuil
  //  choisi » — faux quand un seuil EST enregistré. On dit ce qui s'est
  //  réellement passé, sans accuser un réglage qui existe.
  if (/sans règle résolue|sans regle resolue/i.test(motif)) {
    return { etiquette: ETIQUETTE_INDISPONIBLE, raison: RAISONS_INDISPONIBLE.regle_sans_verdict }
  }

  //  Un silence non expliqué ne devient pas un silence rassurant — et il ne
  //  devient pas non plus une accusation précise. Avant, ce repli rendait
  //  « Aucun seuil hebdomadaire choisi par l'entreprise » alors qu'il n'en
  //  savait rien : un motif inconnu n'autorise pas à nommer une cause.
  return { etiquette: ETIQUETTE_INDISPONIBLE, raison: RAISONS_INDISPONIBLE.regle_sans_verdict }
}

/**
 * Ce que la semaine « prévue » et la semaine « pointée » sont — et ne sont pas.
 *
 * V-C2 : le planning prévu et les heures badgées sont deux sources distinctes.
 * On le dit à l'écran, parce qu'un écart entre deux colonnes voisines se lit
 * sinon comme une erreur de calcul, ou pire, comme un contrôle de conformité.
 */
export const SOURCES_TEMPS = {
  prevue: {
    etiquette: 'Prévu',
    precision: 'Horaires affectés au planning — ce qui était prévu, pas ce qui a été fait.',
  },
  pointee: {
    etiquette: 'Pointé',
    precision: 'Badgeages réels — ce qui a été fait, pas ce qui était prévu.',
  },
}

/**
 * Une ligne de légende qui nomme les deux sources.
 * Rendue telle quelle à l'écran, elle évite deux confusions d'un coup.
 */
export function legendeDesDeuxSources() {
  return `« ${SOURCES_TEMPS.prevue.etiquette} » : ${SOURCES_TEMPS.prevue.precision} « ${SOURCES_TEMPS.pointee.etiquette} » : ${SOURCES_TEMPS.pointee.precision}`
}
