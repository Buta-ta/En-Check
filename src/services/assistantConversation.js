// Local courtesies and conversational capability overview.
const normalize = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/[?!.,…]+/g, '')
    .trim()
    .replace(/\s+/g, ' ')

const CAPABILITY_PATTERN =
  /^(?:(?:bonjour|bonsoir|salut|coucou|dis[- ]moi|stp|svp)\s+)*(?:que peux[- ]tu faire|qu'est[- ]ce que tu peux faire|qu est ce que tu peux faire|tu peux faire quoi|tu fais quoi|que fais[- ]tu|que sais[- ]tu faire|qu'est[- ]ce que tu sais faire|qui es[- ]tu|tu es qui|presente[- ]toi|a quoi tu sers|a quoi sers[- ]tu|comment tu fonctionnes|comment tu marches|comment t'utiliser|comment peux[- ]tu m'aider|peux[- ]tu m'aider|tu peux m'aider|que proposes[- ]tu|quelles sont tes fonctionnalites|que peut[- ]on te demander)(?:\s+(?:pour moi|dans en[- ]check|ici|aujourd'hui|stp|svp))*$/

const HOW_ARE_YOU_PATTERN =
  /^(?:(?:bonjour|bonsoir|salut|coucou)\s+)?(?:comment ca va|ca va|comment vas[- ]tu|comment allez[- ]vous|tu vas bien|tout va bien)(?:\s+(?:aujourd'hui|et toi|merci))*$/

const ACK_PATTERN =
  /^(?:ok|d'accord|entendu|compris|c'est note|super|parfait|tres bien|nickel|top|genial)$/

const GOODBYE_PATTERN =
  /^(?:au revoir|bonne journee|bonne soiree|a bientot|a plus tard|a plus|bye)$/

const ENCHECK_ABOUT_PATTERN =
  /^(?:(?:bonjour|bonsoir|salut|coucou|dis[- ]moi)\s+)*(?:en[- ]?check|c'est quoi en[- ]?check|qu'est[- ]ce qu'en[- ]?check|qu est ce qu en[- ]?check|parle[- ]moi d'en[- ]?check|presente en[- ]?check|explique en[- ]?check)$/

export function conversationalRequest(value) {
  const original = String(value || '').trim()
  const norm = normalize(original)

  if (ENCHECK_ABOUT_PATTERN.test(norm)) {
    return {
      answer: {
        text:
          "En-Check (« On gère ! ») est votre plateforme de suivi de présence, de pointage et de gestion d’équipe. Ici, dans notre conversation, je peux :\n\n" +
          "• Faire le point en direct sur les pointages enregistrés, les collaborateurs en retard ou les sorties présumées à confirmer.\n" +
          "• Retrouver immédiatement la fiche, le badge QR ou l’activité d’un salarié par son nom ou son matricule.\n" +
          "• Vous expliquer chaque règle métier (retards, sorties présumées, pauses en direct, plannings).\n" +
          "• Échanger avec vous et vous conseiller sur l’organisation de votre équipe.\n\n" +
          "Que souhaitez-vous vérifier ou me demander aujourd’hui ?",
        choices: [
          "Qui est en retard aujourd'hui",
          "Combien de pointages aujourd'hui",
          'Sorties présumées à confirmer',
          'Explique une sortie présumée',
        ],
      },
    }
  }

  if (CAPABILITY_PATTERN.test(norm)) {
    return {
      answer: {
        text:
          "Je suis l’assistant conversationnel d’En-Check ! Voici ce que nous pouvons faire ensemble :\n\n" +
          "• Suivre votre équipe en direct : savoir combien de pointages ont été enregistrés, qui est en retard ou quelles sorties présumées restent à confirmer (aujourd’hui, hier, cette semaine…).\n" +
          "• Retrouver immédiatement un dossier : chercher un collaborateur par son nom ou son matricule, une tâche urgente ou une fiche de paie.\n" +
          "• Comprendre les règles d’En-Check : fonctionnement des sorties présumées, calcul des retards, pauses ou lecture des compteurs.\n" +
          "• Échanger et vous conseiller : répondre à vos questions générales d’organisation et de gestion d’équipe.\n\n" +
          "Dites-moi simplement ce que vous souhaitez vérifier ou demandez-moi conseil !",
        choices: [
          "Qui est en retard aujourd'hui",
          "Combien de pointages aujourd'hui",
          'Sorties présumées à confirmer',
          'Explique une sortie présumée',
        ],
      },
    }
  }

  if (HOW_ARE_YOU_PATTERN.test(norm)) {
    return {
      answer: {
        text: "Tout va très bien, merci ! Je suis prêt à vous accompagner sur l’activité de votre équipe ou à répondre à vos questions. Par quoi commençons-nous ?",
        choices: [
          "Qui est en retard aujourd'hui",
          "Combien de pointages aujourd'hui",
          'Sorties présumées à confirmer',
        ],
      },
    }
  }

  const greeting = original.match(/^(bonjour|bonsoir|salut|coucou)(?=$|[\s,!?.])/i)
  const query = greeting ? original.slice(greeting[0].length).replace(/^[\s,!?.]+/, '') : original
  if (greeting && !query) {
    return {
      answer: {
        title: greeting[1].toLowerCase() === 'bonsoir' ? 'Bonsoir !' : 'Bonjour !',
        text: 'Je peux vous aider à consulter les pointages, comprendre les retards, vérifier les sorties présumées ou discuter de l’organisation de votre équipe. Que souhaitez-vous faire ?',
        choices: ['Combien de pointages', 'Qui est en retard', 'Sorties présumées à confirmer'],
      },
    }
  }

  if (/^(merci( beaucoup)?|super merci|parfait merci)[!.\s]*$/i.test(original)) {
    return {
      answer: {
        title: 'Avec plaisir !',
        text: 'Vous pouvez poursuivre avec une autre période ou me poser une nouvelle question.',
      },
    }
  }

  if (ACK_PATTERN.test(norm)) {
    return {
      answer: {
        text: "Parfait ! N’hésitez pas si vous voulez vérifier une autre période, rechercher un collaborateur ou me poser une autre question.",
        choices: ["Pointages aujourd'hui", "Qui est en retard aujourd'hui", 'Sorties présumées à confirmer'],
      },
    }
  }

  if (GOODBYE_PATTERN.test(norm)) {
    return {
      answer: {
        text: 'À très bientôt ! Bonne continuation sur En-Check — on gère !',
      },
    }
  }

  return { query, greeting: Boolean(greeting) }
}
