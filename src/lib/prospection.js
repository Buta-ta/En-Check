// ═══════════════════════════════════════════════════════════
// 🧭 LA PROSPECTION — statuts, secteur, contacts, appels
//
// Les mots de la prospection : les six étapes d'un prospect, les
// secteurs, les formes juridiques, les canaux, les potentiels, le
// formulaire vide, les scénarios d'appel et les objections.
//
// Ce fichier est de la donnée, pas du dessin : les icônes et les
// couleurs de la page sont choisies ailleurs, pour qu'une même
// étape se lise de la même façon partout.
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// 📊 CONFIG STATUTS
// ═══════════════════════════════════════════════════════════
export const STATUTS = [
  { key: 'a_contacter',    label: 'À contacter',    color: '#6B7280', bg: 'rgba(107,114,128,0.12)', border: 'rgba(107,114,128,0.25)' },
  { key: 'contacte',       label: 'Contacté',       color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.25)' },
  { key: 'en_negociation', label: 'En négociation', color: '#6366F1', bg: 'rgba(99,102,241,0.12)',  border: 'rgba(99,102,241,0.25)' },
  { key: 'devis_envoye',   label: 'Devis envoyé',   color: '#F97316', bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.25)' },
  { key: 'signe',          label: 'Signé ',        color: '#10B981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.25)' },
  { key: 'perdu',          label: 'Perdu',           color: '#EF4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.25)' },
]

export const SECTEURS = [
  'Commerce / Retail', 'BTP / Construction', 'Banque / Finance',
  'Télécom', 'Santé / Médical', 'Éducation / Formation',
  'Administration / ONG', 'Industrie / Production',
  'Hôtellerie / Restauration', 'Transport / Logistique', 'Autre',
]

export const FORMES_JURIDIQUES = [
  'SARL', 'SA', 'SAS', 'SUARL', 'GIE', 'Association / ONG',
  'Entreprise individuelle', 'Autre',
]

export const NIVEAUX_CONTACT = [
  { value: 'decisionnaire', label: 'Décisionnaire' },
  { value: 'influenceur',   label: 'Influenceur' },
  { value: 'utilisateur',   label: 'Utilisateur' },
  { value: 'inconnu',       label: 'Inconnu' },
]

export const CANAUX = [
  'Réseau / Bouche-à-oreille', 'LinkedIn', 'Prospection directe',
  'Site web', 'Événement / Salon', 'Partenaire', 'Autre',
]

export const POTENTIELS = [
  { value: 'fort',   label: 'Fort',   color: '#10B981' },
  { value: 'moyen',  label: 'Moyen',  color: '#F59E0B' },
  { value: 'faible', label: 'Faible', color: '#6B7280' },
]

export const FORM_INITIAL = {
  // Infos de base
  company_name: '',
  sector: '',
  city: '',
  nb_employees_estimate: '',
  nb_sites_estimate: 1,
  // Infos entreprise enrichies
  website: '',
  adresse: '',
  google_maps_url: '',
  chiffre_affaires: '',
  forme_juridique: '',
  date_creation: '',
  reseaux_sociaux: { linkedin: '', facebook: '', instagram: '', twitter: '' },
  concurrent_actuel: '',
  potentiel: '',
  canal_acquisition: '',
  niveau_contact: '',
  // Contact
  contact_name: '',
  contact_phone: '',
  contact_email: '',
  contact_role: '',
  // Suivi
  status: 'a_contacter',
  next_contact_date: '',
  notes: '',
}

export const SCENARIOS_PROSPECTION = [
  {
    id: 'pharmacies',
    label: 'Pharmacies',
    color: '#10B981',
    context: [
      'Horaires décalés (gardes de nuit, week-ends)',
      'Personnel qui tourne entre officine et stock',
      'Problème de pointage pendant les gardes',
      'Décideur : pharmacien titulaire ou gérant'
    ],
    barrieres: [
      {
        situation: '"C\'est à quel sujet exactement ?"',
        reponse: 'C\'est concernant un outil qui simplifie le suivi des heures de travail, notamment pour les gardes de nuit. Ça prend 2 minutes, est-ce qu\'il peut me prendre rapidement ?'
      },
      {
        situation: '"Il est occupé / en consultation"',
        reponse: 'Je comprends parfaitement. Quel serait le meilleur moment pour le rappeler ? Ou si vous préférez, je peux lui envoyer un message WhatsApp et il me répond quand il est libre ?'
      },
      {
        situation: '"On n\'est pas intéressés"',
        reponse: 'Je comprends, juste une question rapide : comment vous gérez actuellement le pointage pendant les gardes de nuit ? C\'est justement pour ça que j\'appelle.'
      }
    ],
    accroche: 'Bonjour ! Je vous appelle de En-Check. Je vous contacte parce qu\'on travaille avec plusieurs pharmacies sur Cotonou qui avaient un souci : impossible de savoir exactement qui était présent pendant les gardes de nuit. Est-ce que c\'est aussi un sujet chez vous ?',
    pitch: 'En fait, on a développé une application où vos préparateurs pointent depuis leur téléphone - avec photo automatique et géolocalisation. Vous voyez en temps réel qui est à l\'officine, même à 3h du matin. Plus de cahier papier, plus de discussions sur les heures.',
    close: 'Je peux vous faire une démo de 10 minutes sur WhatsApp, vous verrez comment ça marche concrètement. Vous préférez aujourd\'hui en fin de journée ou demain matin ?',
    objectionPrix: 'On fait du sur-mesure. Une pharmacie avec 5-8 employés, c\'est vraiment accessible. Je vous envoie un devis personnalisé sur WhatsApp ?'
  },
  {
    id: 'btp',
    label: 'BTP / Chantiers',
    color: '#F97316',
    context: [
      'Équipes dispersées sur plusieurs chantiers',
      'Chefs de chantier sur le terrain',
      'Fraude aux heures fréquente',
      'Décideur : DG, DAF ou DRH au siège'
    ],
    barrieres: [
      {
        situation: '"Il est sur chantier"',
        reponse: 'Parfait, c\'est justement pour les équipes terrain que j\'appelle ! Vous avez son WhatsApp que je puisse lui envoyer une courte présentation ? Ou il rentre à quelle heure au bureau ?'
      },
      {
        situation: '"Envoyez un mail"',
        reponse: 'Je peux faire ça, mais honnêtement, 2 minutes au téléphone c\'est plus efficace. On aide des entreprises BTP à Cotonou à économiser sur les heures fantômes. C\'est vraiment son sujet. Il est là cet après-midi ?'
      },
      {
        situation: '"On a déjà un système"',
        reponse: 'Ah super ! Vous utilisez quoi actuellement ? Des pointeuses sur chantier ou du papier ? D\'accord, et pour les équipes qui changent de site dans la journée, comment vous faites ?'
      }
    ],
    accroche: 'Bonjour ! Je suis de En-Check. Question directe : sur vos chantiers, vous êtes certain à 100% que tous les ouvriers pointés sont vraiment présents sur site ?',
    pitch: 'On a développé un système avec géolocalisation. Concrètement : vous définissez le périmètre de chaque chantier sur une carte. Si un ouvrier essaie de pointer depuis chez lui, c\'est bloqué automatiquement. Et vous avez une carte en temps réel avec tous vos gars positionnés.',
    close: 'Je peux vous montrer la carte temps réel en 10 minutes sur WhatsApp. Vous êtes dispo quand ?',
    chiffreImpact: 'Les entreprises BTP qu\'on accompagne nous disent économiser entre 10 et 15% sur la masse salariale juste en éliminant les heures fantômes.'
  },
  {
    id: 'hotels_restaurants',
    label: 'Hôtels & Restaurants',
    color: '#8B5CF6',
    context: [
      'Équipes en rotation (jour/nuit)',
      'Turn-over important',
      'Retards fréquents',
      'Décideur : Gérant, DRH ou Directeur d\'exploitation'
    ],
    barrieres: [
      {
        situation: '"Il est en service / en salle"',
        reponse: 'Je comprends, c\'est le rush ! Quel serait le meilleur créneau pour le joindre ? Avant le service de midi ou après 15h ?'
      },
      {
        situation: '"C\'est le groupe/siège qui gère"',
        reponse: 'D\'accord, vous avez les coordonnées du siège ? Et localement, qui gère les plannings au quotidien ici ?'
      }
    ],
    accroche: 'Bonjour ! Je suis de En-Check. Rapide question : vos équipes de salle et cuisine, elles pointent comment actuellement ? Cahier, badgeuse, ou rien du tout ?',
    pitch: 'On a une solution simple : le serveur arrive, il sort son téléphone, tape son code ou se fait reconnaître par caméra, et c\'est pointé. Vous recevez une alerte si quelqu\'un est en retard. Plus besoin de courir après les feuilles de présence en fin de mois.',
    argumentCle: 'Et pour les extras, c\'est parfait : vous les ajoutez en 30 secondes, ils pointent le soir même, et vous avez le décompte exact pour la paie.',
    close: 'On travaille avec plusieurs établissements sur Cotonou. Je vous montre comment ça marche, 10 minutes max ?'
  },
  {
    id: 'cliniques',
    label: 'Cliniques & Cabinets',
    color: '#EF4444',
    context: [
      'Personnel soignant avec horaires variables',
      'Gardes et astreintes',
      'Besoin de traçabilité',
      'Décideur : Directeur, Médecin-chef ou DAF'
    ],
    barrieres: [
      {
        situation: '"Le docteur est en consultation"',
        reponse: 'Bien sûr, je ne veux pas le déranger pendant les consultations. Y a-t-il un responsable administratif ou RH que je pourrais joindre ? Sinon, à quelle heure est-il généralement disponible ?'
      },
      {
        situation: '"On est un petit cabinet"',
        reponse: 'Justement ! Notre solution est pensée pour les structures de 5 à 50 personnes. Vous êtes combien au cabinet ? Ok, et les présences, vous les gérez comment actuellement ?'
      }
    ],
    accroche: 'Bonjour ! Je suis de En-Check. Je travaille avec plusieurs structures de santé sur la gestion des présences. Une question : pour vos infirmiers de garde, comment vous tracez exactement leurs heures actuellement ?',
    pitch: 'On a développé un système où chaque soignant pointe depuis son téléphone avec photo. Vous voyez qui est arrivé, à quelle heure exactement, et c\'est horodaté automatiquement. Pour les gardes de nuit, c\'est idéal.',
    argumentConformite: 'Et côté traçabilité, tout est enregistré : si jamais il y a un contrôle ou un litige sur les heures, vous avez les preuves.',
    close: 'Je peux vous faire une démo rapide, ça prend 10 minutes. Vous préférez sur WhatsApp ou en visio ?'
  },
  {
    id: 'commerces',
    label: 'Commerces & Supermarchés',
    color: '#F59E0B',
    context: [
      'Caissières, rayonnistes en rotation',
      'Retards fréquents',
      'Besoin de flexibilité',
      'Décideur : Gérant ou Directeur de magasin'
    ],
    barrieres: [
      {
        situation: '"Il est en réserve / pas là"',
        reponse: 'D\'accord, il revient à quelle heure ? Ou vous pouvez me donner son numéro direct ? C\'est rapide, ça concerne le pointage des équipes.'
      },
      {
        situation: '"C\'est le siège qui décide"',
        reponse: 'Je comprends. Et sur place, qui gère les plannings ? Le chef de caisse ? Je peux lui parler 2 minutes ?'
      }
    ],
    accroche: 'Bonjour ! Je suis de En-Check. Question directe : vos caissières qui arrivent avec 10 minutes de retard le matin, vous le détectez comment aujourd\'hui ?',
    pitch: 'On a une app où chaque employé pointe en arrivant - code PIN ou QR code à scanner. Vous recevez une notification immédiate si quelqu\'un est en retard. Et en fin de mois, vous avez le récap automatique pour la paie.',
    argumentPratique: 'Pas besoin de matériel, pas de badgeuse à installer. Ça marche sur n\'importe quel téléphone.',
    close: 'Je vous montre en 5 minutes sur WhatsApp comment ça fonctionne ?'
  },
  {
    id: 'securite',
    label: 'Sécurité / Gardiennage',
    color: '#6366F1',
    context: [
      'Agents dispersés sur plusieurs sites clients',
      'Rondes de nuit',
      'Besoin de preuve de présence pour facturation client',
      'Décideur : DG ou Directeur d\'exploitation'
    ],
    barrieres: [
      {
        situation: '"Il est en tournée des sites"',
        reponse: 'C\'est parfait, justement c\'est pour lui faciliter ça ! Vous avez son portable que je puisse l\'appeler directement, ou je le rappelle cet après-midi ?'
      }
    ],
    accroche: 'Bonjour ! Je suis de En-Check. Vos agents en poste la nuit, vous avez un moyen de prouver à vos clients qu\'ils étaient bien sur site ?',
    pitch: 'On a un système où l\'agent pointe avec son téléphone + géolocalisation. Vous voyez sur une carte en temps réel où sont tous vos agents. Et si un client vous demande des preuves, vous avez l\'historique avec position GPS et photo.',
    argumentBusiness: 'Certaines sociétés de gardiennage utilisent ça pour facturer leurs clients : preuve de présence = pas de discussion sur la facture.',
    close: 'Je peux vous montrer la carte temps réel avec les positions, c\'est vraiment parlant. 10 minutes sur WhatsApp ?'
  },
  {
    id: 'industries',
    label: 'Industries / Usines',
    color: '#14B8A6',
    context: [
      'Équipes en 2x8 ou 3x8',
      'Pointage à l\'entrée du site',
      'Calcul des heures sup critique',
      'Décideur : DRH, DAF ou Directeur de production'
    ],
    barrieres: [
      {
        situation: '"Le DRH est en réunion"',
        reponse: 'Je comprends. Je peux le rappeler à quelle heure ? Ou si vous me donnez son mail, je lui envoie une présentation et je le relance demain ?'
      },
      {
        situation: '"On a déjà des pointeuses"',
        reponse: 'Parfait ! Vous utilisez quoi comme système ? D\'accord. Et pour les équipes qui travaillent à l\'extérieur du site, comment vous faites ?'
      }
    ],
    accroche: 'Bonjour ! Je suis de En-Check. Une question : vos heures supplémentaires, elles sont calculées automatiquement ou c\'est encore du travail manuel en fin de mois ?',
    pitch: 'On a développé un système qui calcule automatiquement les heures sup avec vos taux de majoration. L\'ouvrier pointe, et le système sait si c\'est une heure normale, une heure sup à 25%, 50% ou 100%. Plus d\'erreurs de calcul.',
    argumentROI: 'Et on génère les fiches de paie automatiquement depuis les pointages. Votre service paie gagne plusieurs jours par mois.',
    close: 'Je vous montre le module de calcul des heures sup, c\'est ce qui intéresse le plus les industriels. 15 minutes en visio ?'
  }
]

// ═══════════════════════════════════════════════════════════
// OBJECTIONS UNIVERSELLES
// ═══════════════════════════════════════════════════════════
export const OBJECTIONS_UNIVERSELLES = [
  {
    objection: '"Envoyez-moi un mail"',
    reponse: 'Je peux faire ça, mais franchement, 2 minutes au téléphone c\'est plus efficace qu\'un mail qui va se perdre. Vous avez vraiment 2 minutes là ?'
  },
  {
    objection: '"On n\'a pas le budget"',
    reponse: 'Je comprends. Justement, on fait du sur-mesure selon votre taille. Une entreprise de votre taille, c\'est vraiment accessible. Je vous fais un devis gratuit sur WhatsApp ?'
  },
  {
    objection: '"On est satisfait de notre système actuel"',
    reponse: 'Super ! Vous utilisez quoi exactement ? D\'accord. Et si je vous dis reconnaissance faciale + géolocalisation + fiches de paie automatiques, c\'est des choses que vous avez ?'
  },
  {
    objection: '"Je n\'ai pas le temps"',
    reponse: 'Je comprends parfaitement. 30 secondes alors : on élimine la paperasse et les fraudes au pointage. Si ça vous parle, je vous envoie une démo de 2 minutes sur WhatsApp que vous regardez quand vous voulez. Votre numéro ?'
  },
  {
    objection: '"Rappelez-moi plus tard"',
    reponse: 'Bien sûr ! Vous préférez que je vous rappelle quand exactement ? Et c\'est quoi le meilleur numéro pour vous joindre ?'
  }
]


// ── l'ordre du pipeline : c'est celui du travail, pas de l'alphabet ──
export const ETAPES = ['a_contacter', 'contacte', 'en_negociation', 'devis_envoye', 'signe', 'perdu']

export function statutDe(key) {
  return STATUTS.find((s) => s.key === key) || STATUTS[0]
}

export function etapeSuivante(key) {
  const i = ETAPES.indexOf(key)
  if (i < 0 || i >= ETAPES.length - 2) return ETAPES[0]
  return ETAPES[i + 1]
}

export function potentielDe(val) {
  return POTENTIELS.find((p) => p.value === val) || null
}

// Une relance est due quand la date promise est arrivée ou passée.
export function relanceDue(dateStr) {
  if (!dateStr) return false
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return false
  const aujourdhui = new Date()
  aujourdhui.setHours(0, 0, 0, 0)
  return date <= aujourdhui
}

export function joursDeRetard(dateStr) {
  if (!relanceDue(dateStr)) return 0
  const date = new Date(dateStr)
  const aujourdhui = new Date()
  aujourdhui.setHours(0, 0, 0, 0)
  return Math.max(Math.round((aujourdhui - date) / 86400000), 0)
}

export function dateCourte(valeur) {
  if (!valeur) return ''
  const date = new Date(valeur)
  if (isNaN(date.getTime())) return ''
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function dateHeureCourte(valeur) {
  if (!valeur) return ''
  const date = new Date(valeur)
  if (isNaN(date.getTime())) return ''
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

// ── une recherche qui ne ment pas : elle regarde ce qui est écrit ──
export function correspond(prospect, recherche) {
  const terme = (recherche || '').trim().toLowerCase()
  if (!terme) return true
  return [
    prospect.company_name, prospect.contact_name, prospect.contact_phone,
    prospect.contact_email, prospect.city, prospect.sector, prospect.notes,
  ].some((champ) => (champ || '').toLowerCase().includes(terme))
}

// ── ce qui manque à une fiche pour être utile, dit en clair ──
export function manquesDe(prospect) {
  const manques = []
  if (!prospect.contact_name) manques.push('contact')
  if (!prospect.contact_phone) manques.push('téléphone')
  if (!prospect.sector) manques.push('secteur')
  return manques
}
