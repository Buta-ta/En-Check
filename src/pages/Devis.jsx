import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  FileText, Plus, ArrowLeft, Search, X, Edit, Trash2,
  Save, ChevronRight, ChevronLeft, AlertTriangle,
  CheckCircle2, Building2, Shield, Zap, TrendingUp,
  Eye, Send, Clock, XCircle, Calculator, Download,
  Gift, MessageSquare, Lock, Tag, Hash, CreditCard, Calendar,
  MapPin, ScanFace, Map, Phone, Users, Briefcase, HeartPulse,
  ShoppingCart, Factory, ShieldCheck, Pill,
} from 'lucide-react'
import toast from 'react-hot-toast'
import html2pdf from 'html2pdf.js'

// ═══════════════════════════════════════════════════════════
// TARIFS - MISE À JOUR AVEC FICHES DE PAIE ET JOURS FÉRIÉS
// ═══════════════════════════════════════════════════════════
const TARIFS = {
  logiciel: { mini: 12000, moy: 15000, max: 20000 },
  installation: { mini: 1000, moy: 2000, max: 5000 },
  formation_equipe: { mini: 200, moy: 500, max: 1000 },
  formation_admin: { mini: 1000, moy: 1500, max: 2000 },
  formation_option: { mini: 300, moy: 500, max: 1000 },
  pack_base: { mini: 1000, moy: 3000, max: 5000 },
  pointage_pin: { mini: 500, moy: 1000, max: 1500 },
  pointage_qr: { mini: 700, moy: 1500, max: 2000 },
  photo_pointage: { mini: 800, moy: 1500, max: 5000 },
  planning: { mini: 500, moy: 1000, max: 2000 },
  retards: { mini: 500, moy: 1000, max: 2000 },
  modifier_pointages: { mini: 100, moy: 500, max: 1000 },
  absences_conges: { mini: 1000, moy: 2000, max: 5000 },
  heures_supplementaires: { mini: 500, moy: 1000, max: 2000 },
  admin_supplementaire: { mini: 500, moy: 1000, max: 1500 },
  espace_employe: { mini: 500, moy: 1000, max: 2000 },
  geofencing: { mini: 1000, moy: 2000, max: 5000 },
  maps_temps_reel: { mini: 500, moy: 1000, max: 2000 },
  reconnaissance_faciale: { mini: 2000, moy: 5000, max: 10000 },
  // NOUVELLES OPTIONS
  fiches_paie: { mini: 50, moy: 200, max: 500 }, // Par employé/mois
  jours_feries: { mini: 0, moy: 0, max: 0 }, // GRATUIT
}

const STATUTS_DEVIS = [
  { key: 'brouillon', label: 'Brouillon', color: '#6B7280', bg: 'rgba(107,114,128,0.12)', icon: Clock },
  { key: 'envoye', label: 'Envoyé', color: '#F97316', bg: 'rgba(249,115,22,0.12)', icon: Send },
  { key: 'accepte', label: 'Accepté ✓', color: '#10B981', bg: 'rgba(16,185,129,0.12)', icon: CheckCircle2 },
  { key: 'refuse', label: 'Refusé', color: '#EF4444', bg: 'rgba(239,68,68,0.12)', icon: XCircle },
]

// ═══════════════════════════════════════════════════════════
// OPTIONS D'ENGAGEMENT
// ═══════════════════════════════════════════════════════════
const ENGAGEMENTS = [
  { value: 'sans', label: '🔓 Sans engagement', desc: 'Résiliable à tout moment', mois: 1, color: '#10B981', remise: 0 },
  { value: '2mois', label: '📅 2 mois', desc: 'Engagement 2 mois', mois: 2, color: '#6366F1', remise: 0 },
  { value: '3mois', label: '📅 3 mois', desc: 'Engagement 3 mois', mois: 3, color: '#8B5CF6', remise: 5 },
  { value: '6mois', label: '📅 6 mois', desc: 'Engagement 6 mois', mois: 6, color: '#F59E0B', remise: 10 },
  { value: 'annuel', label: '📅 Annuel', desc: '12 mois minimum', mois: 12, color: '#EC4899', remise: 15 },
]

const CRITERES_SCORING = [
  {
    key: 'secteur', label: 'Secteur d\'activité', icon: '🏢',
    options: [
      { value: 'mini', label: 'Informel / Association / ONG', desc: 'Budget limité' },
      { value: 'moy', label: 'Commerce / PME / Startup', desc: 'Budget correct' },
      { value: 'max', label: 'Banque / Télécom / Administration', desc: 'Budget confortable' },
    ]
  },
  {
    key: 'budget', label: 'Budget exprimé', icon: '💰',
    options: [
      { value: 'mini', label: 'Pas de budget / "On verra..."', desc: 'Difficile à évaluer' },
      { value: 'moy', label: 'Budget vague / "Raisonnable"', desc: 'Ouvert à la discussion' },
      { value: 'max', label: 'Budget défini / "On peut"', desc: 'Prêt à investir' },
    ]
  },
  {
    key: 'urgence', label: 'Urgence', icon: '⏱️',
    options: [
      { value: 'mini', label: 'Pas pressé', desc: 'Pas de deadline' },
      { value: 'moy', label: '"Dans 1-2 mois"', desc: 'Délai raisonnable' },
      { value: 'max', label: '"Dès que possible"', desc: 'Besoin immédiat' },
    ]
  },
  {
    key: 'attitude_prix', label: 'Attitude face au prix', icon: '🤝',
    options: [
      { value: 'mini', label: 'Négocie tout', desc: 'Attention aux marges' },
      { value: 'moy', label: 'Quelques questions', desc: 'Négociation normale' },
      { value: 'max', label: 'Peu sensible au prix', desc: 'Priorité qualité' },
    ]
  },
  {
    key: 'maturite_digitale', label: 'Maturité digitale', icon: '💻',
    options: [
      { value: 'mini', label: 'Peu numérique', desc: 'Formation importante' },
      { value: 'moy', label: 'Quelques outils', desc: 'Adoption normale' },
      { value: 'max', label: 'Très digitalisé', desc: 'Adoption facile' },
    ]
  },
  {
    key: 'relation', label: 'Relation commerciale', icon: '🌐',
    options: [
      { value: 'mini', label: 'Contact froid', desc: 'Confiance à construire' },
      { value: 'moy', label: 'Déjà en discussion', desc: 'Relation établie' },
      { value: 'max', label: 'Recommandé / Réseau', desc: 'Relation privilégiée' },
    ]
  },
]

// ═══════════════════════════════════════════════════════════
// SCÉNARIOS DE PROSPECTION TÉLÉPHONIQUE
// ═══════════════════════════════════════════════════════════
const SCENARIOS_PROSPECTION = [
  {
    id: 'pharmacies',
    label: '💊 Pharmacies',
    icon: Pill,
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
    label: '🏗️ BTP / Chantiers',
    icon: Building2,
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
    label: '🏨 Hôtels & Restaurants',
    icon: Briefcase,
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
    label: '🏥 Cliniques & Cabinets',
    icon: HeartPulse,
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
    label: '🛒 Commerces & Supermarchés',
    icon: ShoppingCart,
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
    label: '🛡️ Sécurité / Gardiennage',
    icon: ShieldCheck,
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
    label: '🏭 Industries / Usines',
    icon: Factory,
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
const OBJECTIONS_UNIVERSELLES = [
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

const NEGO_LIGNE_INITIAL = {
  logiciel: { unitaire: '', total: '' },
  installation: { unitaire: '', total: '' },
  formation_equipe: { unitaire: '', total: '' },
  formation_admin: { unitaire: '', total: '' },
  formation_option: { unitaire: '', total: '' },
  pack_base: { unitaire: '', total: '' },
  pointage: { unitaire: '', total: '' },
  photo_pointage: { unitaire: '', total: '' },
  planning: { unitaire: '', total: '' },
  retards: { unitaire: '', total: '' },
  modifier_pointages: { unitaire: '', total: '' },
  absences_conges: { unitaire: '', total: '' },
  heures_supplementaires: { unitaire: '', total: '' },
  admin_supplementaire: { unitaire: '', total: '' },
  espace_employe: { unitaire: '', total: '' },
  geofencing: { unitaire: '', total: '' },
  maps_temps_reel: { unitaire: '', total: '' },
  reconnaissance_faciale: { unitaire: '', total: '' },
  fiches_paie: { unitaire: '', total: '' },
  jours_feries: { unitaire: '', total: '' },
}

const TOTAL_CATEGORIE_INITIAL = { fixe: '', mensuel: '' }
const MONTANT_CONVENU_INITIAL = { fixe: '', mensuel: '' }

const CONFIG_INITIAL = {
  nb_sites: 1, nb_employes: 10, nb_machines: 2,
  nb_admins: 1, nb_admins_supp: 0, nb_employes_a_former: 10,
  type_pointage: 'pin',
  options: {
    photo_pointage: false, planning: false, retards: false,
    modifier_pointages: false, absences_conges: false,
    heures_supplementaires: false, espace_employe: false,
    geofencing: false, maps_temps_reel: false, reconnaissance_faciale: false,
    fiches_paie: false, jours_feries: true, // Jours fériés activé par défaut (gratuit)
  }
}

const SCORING_INITIAL = {
  secteur: null, budget: null, urgence: null,
  attitude_prix: null, maturite_digitale: null, relation: null,
}

export default function Devis() {
  const [admin, setAdmin] = useState(null)
  const [devisList, setDevisList] = useState([])
  const [prospects, setProspects] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  const [showGenerator, setShowGenerator] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [editingDevis, setEditingDevis] = useState(null)

  const [selectedProspect, setSelectedProspect] = useState(null)
  const [scoring, setScoring] = useState(SCORING_INITIAL)
  const [niveauSuggere, setNiveauSuggere] = useState(null)
  const [niveauFinal, setNiveauFinal] = useState('moy')
  const [config, setConfig] = useState(CONFIG_INITIAL)
  const [remiseFixe, setRemiseFixe] = useState(0)
  const [remiseMensuel, setRemiseMensuel] = useState(0)
  const [moisGratuit, setMoisGratuit] = useState(false)
  const [notesDevis, setNotesDevis] = useState('')

  const [paiementFois, setPaiementFois] = useState(1)
  const [engagement, setEngagement] = useState('annuel')

  const [negoLigne, setNegoLigne] = useState(NEGO_LIGNE_INITIAL)
  const [totalCategorie, setTotalCategorie] = useState(TOTAL_CATEGORIE_INITIAL)
  const [montantConvenu, setMontantConvenu] = useState(MONTANT_CONVENU_INITIAL)

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [devisToDelete, setDevisToDelete] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedDevis, setSelectedDevis] = useState(null)

  const [showScenariosModal, setShowScenariosModal] = useState(false)
  const [selectedScenario, setSelectedScenario] = useState(null)

  // Dates facture
  const [showFactureModal, setShowFactureModal] = useState(false)
  const [factureDevisData, setFactureDevisData] = useState(null)
  const [factureCalculData, setFactureCalculData] = useState(null)
  const [factureTotauxData, setFactureTotauxData] = useState(null)
  const [factureDateEmission, setFactureDateEmission] = useState('')
  const [factureDateEcheance, setFactureDateEcheance] = useState('')
  // ✅ AJOUTER — états facture simplifiée
  const [factureSimplifiee, setFactureSimplifiee] = useState(false)
  const [factureLignesEdit, setFactureLignesEdit] = useState([
    { label: 'Investissement initial En-Check', montant: '', frequence: 'unique' },
    { label: 'Abonnement mensuel En-Check (Pack Complet)', montant: '', frequence: 'mensuel' },
  ])

  // Dates échéancier
  const [showEcheancierModal, setShowEcheancierModal] = useState(false)
  const [echeancierDevisData, setEcheancierDevisData] = useState(null)
  const [echeancierCalculData, setEcheancierCalculData] = useState(null)
  const [echeancierTotauxData, setEcheancierTotauxData] = useState(null)
  const [echeancierDateDepart, setEcheancierDateDepart] = useState('')
  const [echeancesStatuts, setEcheancesStatuts] = useState({}) // { ligneNum: 'paye'|'cours'|'attente' }
  const [echeancesDates, setEcheancesDates] = useState({}) // { ligneNum: 'YYYY-MM-DD' }
  const [echeancesAutoDecalage, setEcheancesAutoDecalage] = useState(false)

  // Modal dates de signature (2ème modal)
  const [showSignatureDatesModal, setShowSignatureDatesModal] = useState(false)
  const [signatureDatesData, setSignatureDatesData] = useState({
    documentType: null, // 'facture', 'echeancier', 'devis'
    devisData: null,
    calculData: null,
    totauxData: null,
    dateEmission: '',
    dateEcheance: '',
    dateEcheancierDepart: '',
    echeancesStatuts: {},
    signatureDateEnCheck: '',
    signatureDateClient: '',
    applyStamp: false, // ✅ AJOUTER
  })

  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const adminData = localStorage.getItem('admin')
    if (!adminData) { navigate('/login'); return }
    const parsedAdmin = JSON.parse(adminData)
    if (parsedAdmin.role !== 'super_admin') { navigate('/dashboard'); return }
    setAdmin(parsedAdmin)
    loadData()
    const prospectId = searchParams.get('prospect')
    if (prospectId) handleNewDevisFromProspect(prospectId)
  }, [navigate])

  const loadData = async () => {
    setLoading(true)
    try {
      const [{ data: devisData }, { data: prospectsData }] = await Promise.all([
        supabase.from('devis').select('*').order('created_at', { ascending: false }),
        supabase.from('prospects').select('id, company_name, contact_name, contact_phone, contact_role, city, nb_employees_estimate, nb_sites_estimate').order('company_name'),
      ])
      setDevisList(devisData || [])
      setProspects(prospectsData || [])
    } catch (error) {
      console.error('Erreur chargement:', error)
      toast.error('Erreur lors du chargement')
    }
    setLoading(false)
  }

  const handleNewDevisFromProspect = async (prospectId) => {
    const { data: prospect } = await supabase.from('prospects').select('*').eq('id', prospectId).single()
    if (prospect) {
      setSelectedProspect(prospect)
      setConfig(prev => ({
        ...prev,
        nb_employes: prospect.nb_employees_estimate || 10,
        nb_employes_a_former: prospect.nb_employees_estimate || 10,
        nb_sites: prospect.nb_sites_estimate || 1,
      }))
      setShowGenerator(true)
      setCurrentStep(1)
    }
  }

  const calculerScore = (scoringData) => {
    const values = { mini: 1, moy: 2, max: 3 }
    const criteres = Object.values(scoringData).filter(v => v !== null)
    if (criteres.length === 0) return null
    const moyenne = criteres.reduce((sum, v) => sum + (values[v] || 0), 0) / criteres.length
    if (moyenne <= 1.5) return 'mini'
    if (moyenne <= 2.5) return 'moy'
    return 'max'
  }

  const handleScoringChange = (critere, valeur) => {
    const newScoring = { ...scoring, [critere]: valeur }
    setScoring(newScoring)
    const suggestion = calculerScore(newScoring)
    setNiveauSuggere(suggestion)
    if (suggestion) setNiveauFinal(suggestion)
  }

  const prixAutoUnitaire = (key, niveau = niveauFinal) => {
    if (key === 'pointage') {
      return config.type_pointage === 'pin'
        ? TARIFS.pointage_pin[niveau]
        : TARIFS.pointage_qr[niveau]
    }
    return TARIFS[key]?.[niveau] || 0
  }

  const getTarifMinUnitaire = (key) => {
    if (key === 'pointage') {
      return config.type_pointage === 'pin'
        ? TARIFS.pointage_pin.mini
        : TARIFS.pointage_qr.mini
    }
    return TARIFS[key]?.mini || 0
  }

  const prixTotalEffectif = (key, qte, niveau = niveauFinal) => {
    const nego = negoLigne[key] || { unitaire: '', total: '' }
    const negoTotal = parseFloat(nego.total)
    if (!isNaN(negoTotal) && negoTotal > 0) return negoTotal
    const negoUnitaire = parseFloat(nego.unitaire)
    if (!isNaN(negoUnitaire) && negoUnitaire > 0) return negoUnitaire * qte
    return prixAutoUnitaire(key, niveau) * qte
  }

  const prixUnitaireEffectif = (key, qte, niveau = niveauFinal) => {
    const nego = negoLigne[key] || { unitaire: '', total: '' }
    const negoTotal = parseFloat(nego.total)
    if (!isNaN(negoTotal) && negoTotal > 0 && qte > 0) {
      return negoTotal / qte
    }
    const negoUnitaire = parseFloat(nego.unitaire)
    if (!isNaN(negoUnitaire) && negoUnitaire > 0) return negoUnitaire
    return prixAutoUnitaire(key, niveau)
  }

  const estLigneNegociee = (key) => {
    const nego = negoLigne[key] || {}
    const u = parseFloat(nego.unitaire)
    const t = parseFloat(nego.total)
    return (!isNaN(u) && u > 0) || (!isNaN(t) && t > 0)
  }

  const modeNegoLigne = (key) => {
    const nego = negoLigne[key] || {}
    const t = parseFloat(nego.total)
    if (!isNaN(t) && t > 0) return 'total'
    const u = parseFloat(nego.unitaire)
    if (!isNaN(u) && u > 0) return 'unitaire'
    return 'auto'
  }

  const estLigneSousMinimum = (key, qte) => {
    // Jours fériés est gratuit, pas de minimum
    if (key === 'jours_feries') return false

    const nego = negoLigne[key] || { unitaire: '', total: '' }
    const tarifMin = getTarifMinUnitaire(key)
    if (!tarifMin || !qte || qte <= 0) return false

    const negoUnitaire = parseFloat(nego.unitaire)
    if (!isNaN(negoUnitaire) && negoUnitaire > 0 && negoUnitaire < tarifMin) return true

    const negoTotal = parseFloat(nego.total)
    if (!isNaN(negoTotal) && negoTotal > 0) {
      const unitaireImplicite = negoTotal / qte
      if (unitaireImplicite < tarifMin) return true
    }

    return false
  }

  const getAlerteMinDetail = (key, qte) => {
    // Jours fériés est gratuit
    if (key === 'jours_feries') {
      return { sousMin: false, unitaireSousMin: false, totalSousMin: false, tarifMin: 0, totalMin: 0 }
    }

    const nego = negoLigne[key] || { unitaire: '', total: '' }
    const tarifMin = getTarifMinUnitaire(key)
    const totalMin = tarifMin * qte

    const negoUnitaire = parseFloat(nego.unitaire)
    const negoTotal = parseFloat(nego.total)

    const unitaireSousMin = !isNaN(negoUnitaire) && negoUnitaire > 0 && negoUnitaire < tarifMin
    const totalSousMin = !isNaN(negoTotal) && negoTotal > 0 && (negoTotal / qte) < tarifMin

    return {
      sousMin: unitaireSousMin || totalSousMin,
      unitaireSousMin,
      totalSousMin,
      tarifMin,
      totalMin,
      ecartUnitaire: unitaireSousMin ? Math.round(tarifMin - negoUnitaire) : 0,
      ecartTotal: totalSousMin ? Math.round(totalMin - negoTotal) : 0,
      unitaireImplicite: !isNaN(negoTotal) && negoTotal > 0 && qte > 0 ? Math.round(negoTotal / qte) : null,
    }
  }

  const updateNegoLigne = (key, field, value) => {
    setNegoLigne(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value }
    }))
  }

  const clearNegoLigne = (key) => {
    setNegoLigne(prev => ({
      ...prev,
      [key]: { unitaire: '', total: '' }
    }))
  }

  const estCategorieNegociee = (cat) => {
    const val = parseFloat(totalCategorie[cat])
    return !isNaN(val) && val > 0
  }

  // ═══════════════════════════════════════════════════════════
  // CALCUL DU DEVIS - MISE À JOUR AVEC FICHES DE PAIE ET JOURS FÉRIÉS
  // ═══════════════════════════════════════════════════════════
  const calculerDevis = (cfg = config, niveau = niveauFinal) => {
    const opts = cfg.options
    const nbOpts = Object.values(opts).filter(Boolean).length

    const qtes = {
      logiciel: cfg.nb_sites,
      installation: cfg.nb_machines,
      formation_equipe: cfg.nb_employes_a_former,
      formation_admin: cfg.nb_admins,
      formation_option: nbOpts * cfg.nb_admins,
      pack_base: cfg.nb_sites,
      pointage: cfg.nb_employes,
      photo_pointage: cfg.nb_employes,
      planning: cfg.nb_sites,
      retards: cfg.nb_sites,
      modifier_pointages: cfg.nb_employes,
      absences_conges: cfg.nb_sites,
      heures_supplementaires: cfg.nb_sites,
      admin_supplementaire: cfg.nb_admins_supp,
      espace_employe: cfg.nb_employes,
      geofencing: cfg.nb_employes,
      maps_temps_reel: cfg.nb_employes,
      reconnaissance_faciale: cfg.nb_employes,
      fiches_paie: cfg.nb_employes,
      jours_feries: cfg.nb_sites, // Par site (gratuit)
    }

    const T = (key) => prixTotalEffectif(key, qtes[key], niveau)
    const U = (key, qte) => prixUnitaireEffectif(key, qte, niveau)
    const A = (key) => prixAutoUnitaire(key, niveau)

    const logiciel = T('logiciel')
    const installation = T('installation')
    const formEq = T('formation_equipe')
    const formAdmin = T('formation_admin')
    const formOpt = nbOpts > 0 ? T('formation_option') : 0
    const sousTotalFixe = logiciel + installation + formEq + formAdmin + formOpt

    const packBase = T('pack_base')
    const pointage = T('pointage')
    const photo = opts.photo_pointage ? T('photo_pointage') : 0
    const planning = opts.planning ? T('planning') : 0
    const retards = opts.retards ? T('retards') : 0
    const modifPt = opts.modifier_pointages ? T('modifier_pointages') : 0
    const absCong = opts.absences_conges ? T('absences_conges') : 0
    const heuresSup = opts.heures_supplementaires ? T('heures_supplementaires') : 0
    const adminSupp = cfg.nb_admins_supp > 0 ? T('admin_supplementaire') : 0
    const espaceEmp = opts.espace_employe ? T('espace_employe') : 0
    const geofenc = opts.geofencing ? T('geofencing') : 0
    const mapsRT = opts.maps_temps_reel ? T('maps_temps_reel') : 0
    const recoFace = opts.reconnaissance_faciale ? T('reconnaissance_faciale') : 0
    const fichePaie = opts.fiches_paie ? T('fiches_paie') : 0
    const joursFeries = opts.jours_feries ? 0 : 0 // Toujours gratuit

    const sousTotalMensuel = packBase + pointage + photo + planning + retards +
      modifPt + absCong + heuresSup + adminSupp + espaceEmp + geofenc + mapsRT + recoFace + fichePaie + joursFeries

    const makeLigne = (key, label, qte, total, autoUnitaire, isGratuit = false) => ({
      key,
      label,
      qte,
      autoUnitaire,
      autoTotal: autoUnitaire * qte,
      unitaire: U(key, qte),
      total,
      negocie: estLigneNegociee(key),
      modeNego: modeNegoLigne(key),
      negoUnitaire: parseFloat(negoLigne[key]?.unitaire) || null,
      negoTotal: parseFloat(negoLigne[key]?.total) || null,
      sousMinimum: estLigneSousMinimum(key, qte),
      isGratuit,
    })

    const lignesFixe = [
      makeLigne('logiciel', `Logiciel (${cfg.nb_sites} site${cfg.nb_sites > 1 ? 's' : ''})`, cfg.nb_sites, logiciel, A('logiciel')),
      makeLigne('installation', `Installation (${cfg.nb_machines} machine${cfg.nb_machines > 1 ? 's' : ''})`, cfg.nb_machines, installation, A('installation')),
      makeLigne('formation_equipe', `Formation équipes (${cfg.nb_employes_a_former} pers.)`, cfg.nb_employes_a_former, formEq, A('formation_equipe')),
      makeLigne('formation_admin', `Formation admin (${cfg.nb_admins} admin)`, cfg.nb_admins, formAdmin, A('formation_admin')),
      ...(nbOpts > 0 ? [makeLigne('formation_option', `Formation options (${nbOpts} opt. × ${cfg.nb_admins} admin)`, nbOpts * cfg.nb_admins, formOpt, A('formation_option'))] : []),
    ].filter(l => l.total > 0)

    const lignesMensuel = [
      makeLigne('pack_base', `Pack de base (${cfg.nb_sites} site${cfg.nb_sites > 1 ? 's' : ''})`, cfg.nb_sites, packBase, A('pack_base')),
      makeLigne('pointage', `Pointage ${cfg.type_pointage === 'pin' ? 'PIN' : 'QR Code'} (${cfg.nb_employes} emp)`, cfg.nb_employes, pointage, A('pointage')),
      ...(photo > 0 ? [makeLigne('photo_pointage', `Photo pointage (${cfg.nb_employes} emp)`, cfg.nb_employes, photo, A('photo_pointage'))] : []),
      ...(planning > 0 ? [makeLigne('planning', `Planning (${cfg.nb_sites} site${cfg.nb_sites > 1 ? 's' : ''})`, cfg.nb_sites, planning, A('planning'))] : []),
      ...(retards > 0 ? [makeLigne('retards', `Retards (${cfg.nb_sites} site${cfg.nb_sites > 1 ? 's' : ''})`, cfg.nb_sites, retards, A('retards'))] : []),
      ...(modifPt > 0 ? [makeLigne('modifier_pointages', `Modif. pointages (${cfg.nb_employes} emp)`, cfg.nb_employes, modifPt, A('modifier_pointages'))] : []),
      ...(absCong > 0 ? [makeLigne('absences_conges', `Absences & Congés (${cfg.nb_sites} site${cfg.nb_sites > 1 ? 's' : ''})`, cfg.nb_sites, absCong, A('absences_conges'))] : []),
      ...(heuresSup > 0 ? [makeLigne('heures_supplementaires', `Heures supp. (${cfg.nb_sites} site${cfg.nb_sites > 1 ? 's' : ''})`, cfg.nb_sites, heuresSup, A('heures_supplementaires'))] : []),
      ...(adminSupp > 0 ? [makeLigne('admin_supplementaire', `Admin supp. (${cfg.nb_admins_supp})`, cfg.nb_admins_supp, adminSupp, A('admin_supplementaire'))] : []),
      ...(espaceEmp > 0 ? [makeLigne('espace_employe', `Espace Employé (${cfg.nb_employes} emp)`, cfg.nb_employes, espaceEmp, A('espace_employe'))] : []),
      ...(geofenc > 0 ? [makeLigne('geofencing', `Geofencing (${cfg.nb_employes} emp)`, cfg.nb_employes, geofenc, A('geofencing'))] : []),
      ...(mapsRT > 0 ? [makeLigne('maps_temps_reel', `Maps temps réel (${cfg.nb_employes} emp)`, cfg.nb_employes, mapsRT, A('maps_temps_reel'))] : []),
      ...(recoFace > 0 ? [makeLigne('reconnaissance_faciale', `Reconnaissance faciale (${cfg.nb_employes} emp)`, cfg.nb_employes, recoFace, A('reconnaissance_faciale'))] : []),
      ...(fichePaie > 0 ? [makeLigne('fiches_paie', `💰 Fiches de paie (${cfg.nb_employes} emp)`, cfg.nb_employes, fichePaie, A('fiches_paie'))] : []),
      ...(opts.jours_feries ? [makeLigne('jours_feries', `🎌 Jours fériés (${cfg.nb_sites} site${cfg.nb_sites > 1 ? 's' : ''})`, cfg.nb_sites, 0, 0, true)] : []),
    ].filter(l => l.total > 0 || l.isGratuit)

    return { lignesFixe, lignesMensuel, sousTotalFixe, sousTotalMensuel }
  }

  const getEngagementConfig = (engValue) => {
    return ENGAGEMENTS.find(e => e.value === engValue) || ENGAGEMENTS[4] // Annuel par défaut
  }

  const appliquerPriorites = (calcul) => {
    const engConfig = getEngagementConfig(engagement)
    const nbMoisBase = engConfig.mois
    const nbMois = moisGratuit ? Math.max(nbMoisBase - 1, 1) : nbMoisBase
    const remiseEngagement = engConfig.remise

    const convFixe = parseFloat(montantConvenu.fixe)
    const catFixe = parseFloat(totalCategorie.fixe)
    let totalFixeNet, modeFixe

    if (!isNaN(convFixe) && convFixe > 0) {
      totalFixeNet = convFixe
      modeFixe = 'convenu'
    } else if (!isNaN(catFixe) && catFixe > 0) {
      totalFixeNet = catFixe
      modeFixe = 'categorie'
    } else {
      totalFixeNet = Math.round(calcul.sousTotalFixe * (1 - remiseFixe / 100))
      modeFixe = 'lignes'
    }

    const convMensuel = parseFloat(montantConvenu.mensuel)
    const catMensuel = parseFloat(totalCategorie.mensuel)
    let totalMensuelNet, modeMensuel

    if (!isNaN(convMensuel) && convMensuel > 0) {
      totalMensuelNet = convMensuel
      modeMensuel = 'convenu'
    } else if (!isNaN(catMensuel) && catMensuel > 0) {
      totalMensuelNet = catMensuel
      modeMensuel = 'categorie'
    } else {
      // Appliquer remise mensuelle + remise engagement
      const remiseTotale = Math.min(remiseMensuel + remiseEngagement, 50) // Max 50%
      totalMensuelNet = Math.round(calcul.sousTotalMensuel * (1 - remiseTotale / 100))
      modeMensuel = 'lignes'
    }

    const totalAnnuelNet = totalFixeNet + (totalMensuelNet * nbMois)

    const echeanceFixe = paiementFois > 1 ? Math.ceil(totalFixeNet / paiementFois) : totalFixeNet

    return {
      totalFixeNet,
      totalMensuelNet,
      totalAnnuelNet,
      nbMois,
      modeFixe,
      modeMensuel,
      echeanceFixe,
      paiementFois,
      engagement,
      remiseEngagement,
      engagementLabel: engConfig.label
    }
  }



  // ═══════════════════════════════════════════════════════════
  // NOUVELLE FONCTION : GÉNÉRATION FACTURE PDF
  // ═══════════════════════════════════════════════════════════
const handleDownloadFacture = (devisData, calculData, totauxData, dateEmissionParam, dateEcheanceParam, signatureDateEnCheck = '', signatureDateClient = '', applyStamp = false) => {
    const prospect = prospects.find(p => p.id === devisData.prospect_id)
    const lignesFixe = calculData?.lignesFixe || devisData.detail_calcul?.lignesFixe || []
    const lignesMensuel = calculData?.lignesMensuel || devisData.detail_calcul?.lignesMensuel || []
    const fixeNet = totauxData?.totalFixeNet || devisData.montant_fixe_net
    const mensuelNet = totauxData?.totalMensuelNet || devisData.montant_mensuel_net
    const annuelNet = totauxData?.totalAnnuelNet || devisData.montant_annuel_net
    const engConfig = getEngagementConfig(totauxData?.engagement || devisData.engagement || 'annuel')
    const nbMois = (devisData.mois_gratuit || totauxData?.nbMois)
      ? (totauxData?.nbMois || Math.max(engConfig.mois - 1, 1))
      : engConfig.mois
    const nbFois = totauxData?.paiementFois || devisData.paiement_fois || 1
    const echeance = nbFois > 1 ? Math.ceil(fixeNet / nbFois) : fixeNet
    const numeroFacture = (devisData.numero || '').replace('DEV-', 'FAC-')
    const dateFacture = dateEmissionParam
      ? new Date(dateEmissionParam).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
      : new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    const dateEcheance = dateEcheanceParam
      ? new Date(dateEcheanceParam).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

    const renderLignesFacture = (lignes) => lignes.map(l => `
    <tr>
      <td>${l.label}${l.isGratuit ? ' <span class="gratuit-tag">GRATUIT</span>' : ''}</td>
      <td class="num">${l.isGratuit ? '0' : formatF(l.unitaire)} FCFA</td>
      <td class="num">${l.qte}</td>
      <td class="num">${l.isGratuit ? '<span class="green">GRATUIT</span>' : `${formatF(l.total)} FCFA`}</td>
    </tr>
  `).join('')

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Facture ${numeroFacture}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Segoe UI', Arial, sans-serif; background:#fff; color:#1a1a2e; font-size:13px; line-height:1.6; }
    .page { max-width:800px; margin:0 auto; padding:48px 40px;position:relative; }

    /* EN-TÊTE */
    .header { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:24px; border-bottom:3px solid #6366F1; margin-bottom:32px; }
    .brand { font-size:30px; font-weight:900; color:#6366F1; letter-spacing:4px; }
    .brand-sub { font-size:10px; color:#999; letter-spacing:2px; text-transform:uppercase; margin-top:4px; }
    .brand-editor { font-size:9px; color:#999; letter-spacing:1px; margin-top:8px; padding-top:8px; border-top:1px solid #EEE; }
    .facture-ref { text-align:right; }
    .facture-title { font-size:28px; font-weight:900; color:#1a1a2e; text-transform:uppercase; letter-spacing:2px; }
    .facture-num { font-size:16px; color:#6366F1; font-weight:700; margin-top:4px; }
    .facture-date { font-size:11px; color:#999; margin-top:2px; }

    /* INFOS */
    .infos-grid { display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-bottom:28px; }
    .info-block { padding:16px; border-radius:10px; background:#f8f7ff; }
    .info-block.client { border-left:4px solid #6366F1; }
    .info-block.vendeur { border-left:4px solid #10B981; }
    .info-label { font-size:10px; text-transform:uppercase; letter-spacing:1px; font-weight:700; margin-bottom:8px; }
    .info-label.blue { color:#6366F1; }
    .info-label.green { color:#10B981; }
    .info-name { font-size:16px; font-weight:700; color:#1a1a2e; }
    .info-detail { font-size:12px; color:#777; margin-top:3px; }
    .info-rccm { font-size:10px; color:#999; margin-top:6px; padding-top:6px; border-top:1px solid #EEE; font-style:italic; }

    /* STATUT */
    .statut-bar { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:24px; }
    .statut-badge { display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius:8px; font-size:12px; font-weight:600; }
    .statut-badge.payable { background:#fef3c7; border:1px solid #fcd34d; color:#92400e; }
    .statut-badge.engagement { background:#ede9fe; border:1px solid #c4b5fd; color:#5b21b6; }
    .statut-badge.gratuit { background:#dcfce7; border:1px solid #86efac; color:#15803d; }

    /* TABLEAU */
    table { width:100%; border-collapse:collapse; margin-bottom:4px; border-radius:10px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,0.07); }
    thead tr { background:#6366F1; }
    thead th { padding:12px 14px; text-align:left; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:#fff; }
    thead th.num { text-align:right; }
    tbody tr { border-bottom:1px solid #f0f0f8; }
    tbody tr:nth-child(even) { background:#fbfbff; }
    tbody td { padding:11px 14px; color:#374151; vertical-align:top; }
    tbody td.num { text-align:right; }
    .gratuit-tag { display:inline-block; background:#dcfce7; color:#15803d; font-size:9px; font-weight:800; padding:2px 6px; border-radius:4px; border:1px solid #86efac; margin-left:4px; }
    .green { color:#10B981; font-weight:700; }
    .section-sep { height:6px; }

    /* TOTAUX */
    .totaux { margin-top:16px; display:flex; justify-content:flex-end; }
    .totaux-table { width:340px; border-radius:12px; overflow:hidden; border:1px solid #e5e7eb; }
    .totaux-row { display:flex; justify-content:space-between; padding:10px 16px; border-bottom:1px solid #f0f0f8; }
    .totaux-row:last-child { border-bottom:none; }
    .totaux-row.subtotal { background:#f9fafb; }
    .totaux-row.total-fixe { background:#ede9fe; }
    .totaux-row.total-mensuel { background:#ede9fe; }
    .totaux-row.grand-total { background:#6366F1; }
    .totaux-label { font-size:12px; color:#6b7280; }
    .totaux-value { font-size:13px; font-weight:700; color:#1a1a2e; font-family:monospace; }
    .totaux-row.grand-total .totaux-label,
    .totaux-row.grand-total .totaux-value { color:#fff; font-size:15px; }

    /* PAIEMENT */
    .paiement-box { margin-top:24px; background:#eff6ff; border:2px solid #93c5fd; border-radius:14px; padding:20px 24px; }
    .paiement-title { font-size:14px; font-weight:700; color:#1d4ed8; margin-bottom:12px; }
    .paiement-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:12px; }
    .paiement-item { background:#fff; border-radius:10px; padding:12px; border:1px solid #bfdbfe; text-align:center; }
    .paiement-item-label { font-size:10px; color:#93c5fd; text-transform:uppercase; letter-spacing:0.5px; font-weight:700; margin-bottom:4px; }
    .paiement-item-value { font-size:18px; font-weight:800; color:#1d4ed8; font-family:monospace; }
    .paiement-item-sub { font-size:10px; color:#6b7280; margin-top:2px; }

    /* CONDITIONS */
    .conditions { margin-top:24px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:12px; padding:18px; }
    .conditions-title { font-size:12px; font-weight:700; color:#374151; margin-bottom:10px; text-transform:uppercase; letter-spacing:0.5px; }
    .conditions-list { list-style:none; display:flex; flex-direction:column; gap:5px; }
    .conditions-list li { font-size:11px; color:#6b7280; display:flex; align-items:flex-start; gap:6px; }
    .conditions-list li::before { content:"•"; color:#6366F1; font-weight:700; }

    /* SIGNATURES */
    .signatures { display:flex; justify-content:space-between; gap:40px; margin-top:36px; }
    .sig-block { flex:1; }
    .sig-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#6366F1; margin-bottom:6px; }
    .sig-name { font-size:12px; color:#888; margin-bottom:40px; }
    .sig-line { border-bottom:1px dashed #ccc; margin-bottom:6px; }
    .sig-footer { font-size:10px; color:#aaa; }

    .stamp-box {
  position: absolute;
  top: 45%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-18deg);
  border: 6px double #dc2626;
  border-radius: 50%;
  width: 190px;
  height: 190px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  opacity: 0.75;
  pointer-events: none;
  z-index: 100;
}
.stamp-paid {
  color: #dc2626;
  font-size: 40px;
  font-weight: 900;
  letter-spacing: 5px;
}
.stamp-info {
  color: #dc2626;
  font-size: 9px;
  font-weight: 700;
  text-align: center;
  letter-spacing: 0.5px;
  margin-top: 6px;
  line-height: 1.4;
}


        /* ═══ GESTION DES SAUTS DE PAGE ═══ */
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; page-break-after: auto; }
    thead { display: table-header-group; }
    .client-box, .resume-card, .paiement-box, .conditions, .signatures, .totaux { page-break-inside: avoid; }
    h3, .section-title, .section-sep { page-break-after: avoid; }

    /* PIED */
    .footer { border-top:1px solid #e5e7eb; padding-top:20px; margin-top:32px; display:flex; justify-content:space-between; align-items:center; }
    .footer-brand { font-size:10px; color:#aaa; }
    .footer-mention { font-size:9px; color:#aaa; font-style:italic; }

    @media print {
      body { print-color-adjust:exact; -webkit-print-color-adjust:exact; }
      .page { padding:20px; }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- EN-TÊTE -->
  <div class="header">
    <div>
      <div class="brand">EN-CHECK</div>
      <div class="brand-sub">Système de pointage intelligent</div>
      <div class="brand-editor">Édité par MOYI TECH | RCCM : RB/COT/26 A 117584</div>
    </div>
    <div class="facture-ref">
      <div class="facture-title">Facture</div>
      <div class="facture-num">${numeroFacture}</div>
      <div class="facture-date">Émise le ${dateFacture}</div>
      <div class="facture-date" style="color:#EF4444; font-weight:600;">Échéance : ${dateEcheance}</div>
    </div>
  </div>

  <!-- INFOS CLIENT / VENDEUR -->
  <div class="infos-grid">
    <div class="info-block vendeur">
      <div class="info-label green">Émetteur</div>
      <div class="info-name">En-Check</div>
      <div class="info-detail">Un produit MOYI TECH</div>
      <div class="info-detail">Système de pointage intelligent</div>
      <div class="info-detail">Cotonou, Bénin</div>
      <div class="info-rccm">RCCM : RB/COT/26 A 117584</div>
    </div>
    <div class="info-block client">
      <div class="info-label blue">Facturé à</div>
      ${prospect ? `
        <div class="info-name">${prospect.company_name}</div>
        <div class="info-detail">${prospect.contact_name ? `👤 ${prospect.contact_name}` : ''}${prospect.contact_role ? ` — ${prospect.contact_role}` : ''}</div>
        <div class="info-detail">${prospect.contact_phone ? `📞 ${prospect.contact_phone}` : ''}${prospect.city ? ` &nbsp;•&nbsp; 📍 ${prospect.city}` : ''}</div>
      ` : '<div class="info-name">—</div>'}
    </div>
  </div>

  <!-- STATUT / CONDITIONS -->
  <div class="statut-bar">
    <span class="statut-badge payable">📋 Paiement sous 30 jours</span>
    <span class="statut-badge engagement">${engConfig.label} · ${nbMois} mois</span>
    ${devisData.mois_gratuit ? '<span class="statut-badge gratuit">🎁 1 mois offert</span>' : ''}
    ${nbFois > 1 ? `<span class="statut-badge payable">💳 Paiement en ${nbFois}x</span>` : ''}
  </div>

  <!-- TABLEAU INVESTISSEMENT INITIAL -->
  <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#6366F1; margin-bottom:8px; padding-bottom:6px; border-bottom:2px solid #e8e8f8;">
    📦 Investissement initial — À régler ${nbFois > 1 ? `en ${nbFois} fois` : 'comptant'}
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:46%">Désignation</th>
        <th class="num">Prix unitaire</th>
        <th class="num">Qté</th>
        <th class="num">Montant HT</th>
      </tr>
    </thead>
    <tbody>
      ${renderLignesFacture(lignesFixe)}
    </tbody>
  </table>
  <div class="section-sep"></div>

  <!-- TABLEAU ABONNEMENT -->
  <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#6366F1; margin:16px 0 8px; padding-bottom:6px; border-bottom:2px solid #e8e8f8;">
    📅 Abonnement mensuel · ${formatF(mensuelNet)} FCFA/mois × ${nbMois} mois
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:46%">Service</th>
        <th class="num">Prix unitaire</th>
        <th class="num">Qté</th>
        <th class="num">Montant HT</th>
      </tr>
    </thead>
    <tbody>
      ${renderLignesFacture(lignesMensuel)}
    </tbody>
  </table>

  <!-- TOTAUX -->
  <div class="totaux">
    <div class="totaux-table">
      <div class="totaux-row subtotal">
        <span class="totaux-label">Investissement initial</span>
        <span class="totaux-value">${formatF(fixeNet)} FCFA</span>
      </div>
      <div class="totaux-row subtotal">
        <span class="totaux-label">Abonnement mensuel</span>
        <span class="totaux-value">${formatF(mensuelNet)} FCFA/mois</span>
      </div>
      <div class="totaux-row subtotal">
        <span class="totaux-label">Durée engagement</span>
        <span class="totaux-value">${nbMois} mois</span>
      </div>
      <div class="totaux-row grand-total">
        <span class="totaux-label">TOTAL GÉNÉRAL</span>
        <span class="totaux-value">${formatF(annuelNet)} FCFA</span>
      </div>
    </div>
  </div>

  <!-- MODALITÉS DE PAIEMENT -->
  <div class="paiement-box">
    <div class="paiement-title">💳 Modalités de règlement</div>
    <div class="paiement-grid">
      <div class="paiement-item">
        <div class="paiement-item-label">Investissement initial</div>
        <div class="paiement-item-value">${formatF(fixeNet)}</div>
        <div class="paiement-item-sub">FCFA ${nbFois > 1 ? `en ${nbFois}x` : 'comptant'}</div>
      </div>
      ${nbFois > 1 ? `
      <div class="paiement-item">
        <div class="paiement-item-label">Par échéance</div>
        <div class="paiement-item-value">${formatF(echeance)}</div>
        <div class="paiement-item-sub">FCFA × ${nbFois} fois</div>
      </div>
      ` : ''}
      <div class="paiement-item">
        <div class="paiement-item-label">Mensuel</div>
        <div class="paiement-item-value">${formatF(mensuelNet)}</div>
        <div class="paiement-item-sub">FCFA / mois</div>
      </div>
      <div class="paiement-item">
        <div class="paiement-item-label">Total engagement</div>
        <div class="paiement-item-value">${formatF(annuelNet)}</div>
        <div class="paiement-item-sub">FCFA sur ${nbMois} mois</div>
      </div>
    </div>
  </div>

  <!-- CONDITIONS -->
  <div class="conditions">
    <div class="conditions-title">📋 Conditions générales</div>
    <ul class="conditions-list">
      <li>Paiement de l'investissement initial dû à la signature du contrat${nbFois > 1 ? `, en ${nbFois} échéances égales de ${formatF(echeance)} FCFA` : ''}.</li>
      <li>Abonnement mensuel de ${formatF(mensuelNet)} FCFA dû le 1er de chaque mois, pour une durée de ${nbMois} mois.</li>
      ${devisData.mois_gratuit ? '<li>🎁 Premier mois d\'abonnement offert — déduit du plan de paiement.</li>' : ''}
      <li>Engagement : ${engConfig.label} — ${engConfig.desc}.</li>
      <li>Toute résiliation anticipée en dehors des conditions d'engagement fera l'objet d'une pénalité contractuelle.</li>
      <li>En cas de retard de paiement, des pénalités de 1,5% par mois seront appliquées.</li>
      <li>La présente facture tient lieu de document contractuel entre les parties.</li>
    </ul>
  </div>

    <!-- SIGNATURES -->
  <div class="signatures">
    <div class="sig-block">
      <div class="sig-title">Pour En-Check</div>
      <div class="sig-name">Signature</div>
      <div class="sig-line"></div>
      <div class="sig-footer">Date : ${signatureDateEnCheck ? new Date(signatureDateEnCheck).toLocaleDateString('fr-FR', { day: 'numeric', month: 'numeric', year: 'numeric' }) : '__ / __ / ____'}</div>
    </div>
    <div class="sig-block">
      <div class="sig-title">Pour le client</div>
      <div class="sig-name">Signature</div>
      <div class="sig-line"></div>
      <div class="sig-footer">Date : ${signatureDateClient ? new Date(signatureDateClient).toLocaleDateString('fr-FR', { day: 'numeric', month: 'numeric', year: 'numeric' }) : '__ / __ / ____'}</div>
    </div>
  </div>


    ${applyStamp ? `
  <div class="stamp-box">
    <div class="stamp-paid">PAYÉ</div>
    <div class="stamp-info">MOYI TECH<br/>RCCM : RB/COT/26 A 117584</div>
  </div>
  ` : ''}

  <!-- PIED DE PAGE -->
  <div class="footer">
    <div class="footer-brand">Facture établie par En-Check</div>
    <div class="footer-mention">Édité par MOYI TECH — RCCM : RB/COT/26 A 117584 | Réf. ${numeroFacture}</div>
  </div>

</div>
<script>window.onload = function() { window.print(); }</script>
</body>
</html>`

    generateStyledPDF(html, numeroFacture)

  }



  // ═══════════════════════════════════════════════════════════
  // FACTURE SIMPLIFIÉE — Lignes éditables
  // ═══════════════════════════════════════════════════════════
const handleDownloadFactureSimplifiee = (devisData, totauxData, dateEmissionParam, dateEcheanceParam, signatureDateEnCheck = '', signatureDateClient = '', lignesEdit = [], applyStamp = false) => {
    const prospect = prospects.find(p => p.id === devisData.prospect_id)
    const numeroFacture = (devisData.numero || '').replace('DEV-', 'FAC-')
    const engConfig = getEngagementConfig(totauxData?.engagement || devisData.engagement || 'annuel')
    const nbMois = (devisData.mois_gratuit || totauxData?.nbMois)
      ? (totauxData?.nbMois || Math.max(engConfig.mois - 1, 1))
      : engConfig.mois

    const dateFacture = dateEmissionParam
      ? new Date(dateEmissionParam).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
      : new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    const dateEcheance = dateEcheanceParam
      ? new Date(dateEcheanceParam).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

    // Construire les lignes depuis l'éditeur
    const lignes = lignesEdit.length > 0 ? lignesEdit : [
      { label: 'Investissement initial En-Check', montant: String(totauxData?.totalFixeNet || devisData?.montant_fixe_net || 0), frequence: 'unique' },
      { label: 'Abonnement mensuel En-Check', montant: String(totauxData?.totalMensuelNet || devisData?.montant_mensuel_net || 0), frequence: 'mensuel' },
    ]

    const totalGeneral = lignes.reduce((s, l) => s + (parseFloat(l.montant) || 0), 0)

    const renderLignes = lignes.map((l, i) => {
      const montant = parseFloat(l.montant) || 0
      const frequenceLabel = l.frequence === 'mensuel' ? '/mois' : l.frequence === 'an' ? '/an' : ''
      return `
    <tr style="${i % 2 === 0 ? 'background:#fbfbff;' : ''}">
      <td style="padding:14px 16px; font-size:14px; color:#374151; font-weight:600;">
        ${l.label || 'Ligne libre'}
      </td>
      <td style="padding:14px 16px; text-align:right; font-size:14px; color:#374151;">
        ${montant > 0 ? `${formatF(montant)} FCFA` : '—'}
        ${frequenceLabel ? `<span style="color:#888; font-size:11px;"> ${frequenceLabel}</span>` : ''}
      </td>
    </tr>`
    }).join('')

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Facture ${numeroFacture}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Segoe UI', Arial, sans-serif; background:#fff; color:#1a1a2e; font-size:13px; line-height:1.6; }
    .page { max-width:800px; margin:0 auto; padding:48px 40px;position:relative; }

    .header { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:24px; border-bottom:3px solid #6366F1; margin-bottom:32px; }
    .brand { font-size:30px; font-weight:900; color:#6366F1; letter-spacing:4px; }
    .brand-sub { font-size:10px; color:#999; letter-spacing:2px; text-transform:uppercase; margin-top:4px; }
    .brand-editor { font-size:9px; color:#999; letter-spacing:1px; margin-top:8px; padding-top:8px; border-top:1px solid #EEE; }
    .facture-ref { text-align:right; }
    .facture-title { font-size:28px; font-weight:900; color:#1a1a2e; text-transform:uppercase; letter-spacing:2px; }
    .facture-num { font-size:16px; color:#6366F1; font-weight:700; margin-top:4px; }
    .facture-date { font-size:11px; color:#999; margin-top:2px; }

    .infos-grid { display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-bottom:28px; }
    .info-block { padding:16px; border-radius:10px; background:#f8f7ff; }
    .info-block.client { border-left:4px solid #6366F1; }
    .info-block.vendeur { border-left:4px solid #10B981; }
    .info-label { font-size:10px; text-transform:uppercase; letter-spacing:1px; font-weight:700; margin-bottom:8px; }
    .info-label.blue { color:#6366F1; }
    .info-label.green { color:#10B981; }
    .info-name { font-size:16px; font-weight:700; color:#1a1a2e; }
    .info-detail { font-size:12px; color:#777; margin-top:3px; }
    .info-rccm { font-size:10px; color:#999; margin-top:6px; padding-top:6px; border-top:1px solid #EEE; font-style:italic; }

    .statut-bar { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:24px; }
    .statut-badge { display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius:8px; font-size:12px; font-weight:600; }
    .statut-badge.payable { background:#fef3c7; border:1px solid #fcd34d; color:#92400e; }
    .statut-badge.engagement { background:#ede9fe; border:1px solid #c4b5fd; color:#5b21b6; }

    table { width:100%; border-collapse:collapse; margin-bottom:16px; border-radius:10px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,0.07); }
    thead tr { background:#6366F1; }
    thead th { padding:12px 16px; text-align:left; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:#fff; }
    thead th.montant { text-align:right; }
    tbody tr { border-bottom:1px solid #f0f0f8; }

    .totaux { margin-top:16px; display:flex; justify-content:flex-end; }
    .totaux-table { width:340px; border-radius:12px; overflow:hidden; border:1px solid #e5e7eb; }
    .totaux-row { display:flex; justify-content:space-between; padding:10px 16px; border-bottom:1px solid #f0f0f8; }
    .totaux-row:last-child { border-bottom:none; }
    .totaux-row.subtotal { background:#f9fafb; }
    .totaux-row.grand-total { background:#6366F1; }
    .totaux-label { font-size:12px; color:#6b7280; }
    .totaux-value { font-size:13px; font-weight:700; color:#1a1a2e; font-family:monospace; }
    .totaux-row.grand-total .totaux-label, .totaux-row.grand-total .totaux-value { color:#fff; font-size:15px; }

    .paiement-box { margin-top:24px; background:#eff6ff; border:2px solid #93c5fd; border-radius:14px; padding:20px 24px; }
    .paiement-title { font-size:14px; font-weight:700; color:#1d4ed8; margin-bottom:12px; }
    .paiement-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:12px; }
    .paiement-item { background:#fff; border-radius:10px; padding:12px; border:1px solid #bfdbfe; text-align:center; }
    .paiement-item-label { font-size:10px; color:#93c5fd; text-transform:uppercase; letter-spacing:0.5px; font-weight:700; margin-bottom:4px; }
    .paiement-item-value { font-size:18px; font-weight:800; color:#1d4ed8; font-family:monospace; }
    .paiement-item-sub { font-size:10px; color:#6b7280; margin-top:2px; }

    .conditions { margin-top:24px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:12px; padding:18px; }
    .conditions-title { font-size:12px; font-weight:700; color:#374151; margin-bottom:10px; text-transform:uppercase; letter-spacing:0.5px; }
    .conditions-list { list-style:none; display:flex; flex-direction:column; gap:5px; }
    .conditions-list li { font-size:11px; color:#6b7280; display:flex; align-items:flex-start; gap:6px; }
    .conditions-list li::before { content:"•"; color:#6366F1; font-weight:700; }

    

    .stamp-box {
  position: absolute;
  top: 45%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-18deg);
  border: 6px double #dc2626;
  border-radius: 50%;
  width: 190px;
  height: 190px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  opacity: 0.75;
  pointer-events: none;
  z-index: 100;
}
.stamp-paid {
  color: #dc2626;
  font-size: 40px;
  font-weight: 900;
  letter-spacing: 5px;
}
.stamp-info {
  color: #dc2626;
  font-size: 9px;
  font-weight: 700;
  text-align: center;
  letter-spacing: 0.5px;
  margin-top: 6px;
  line-height: 1.4;
}

    .footer { border-top:1px solid #e5e7eb; padding-top:20px; margin-top:32px; display:flex; justify-content:space-between; align-items:center; }
    .footer-brand { font-size:10px; color:#aaa; }
    .footer-mention { font-size:9px; color:#aaa; font-style:italic; }

    @media print { body { print-color-adjust:exact; -webkit-print-color-adjust:exact; } .page { padding:20px; } }
  </style>
</head>
<body>
<div class="page">

  <div class="header">
    <div>
      <div class="brand">EN-CHECK</div>
      <div class="brand-sub">Système de pointage intelligent</div>
      <div class="brand-editor">Édité par MOYI TECH | RCCM : RB/COT/26 A 117584</div>
    </div>
    <div class="facture-ref">
      <div class="facture-title">Facture</div>
      <div class="facture-num">${numeroFacture}</div>
      <div class="facture-date">Émise le ${dateFacture}</div>
      <div class="facture-date" style="color:#EF4444; font-weight:600;">Échéance : ${dateEcheance}</div>
    </div>
  </div>

  <div class="infos-grid">
    <div class="info-block vendeur">
      <div class="info-label green">Émetteur</div>
      <div class="info-name">En-Check</div>
      <div class="info-detail">Un produit MOYI TECH</div>
      <div class="info-detail">Système de pointage intelligent</div>
      <div class="info-detail">Cotonou, Bénin</div>
      <div class="info-rccm">RCCM : RB/COT/26 A 117584</div>
    </div>
    <div class="info-block client">
      <div class="info-label blue">Facturé à</div>
      ${prospect ? `
        <div class="info-name">${prospect.company_name}</div>
        <div class="info-detail">${prospect.contact_name ? `👤 ${prospect.contact_name}` : ''}${prospect.contact_role ? ` — ${prospect.contact_role}` : ''}</div>
        <div class="info-detail">${prospect.contact_phone ? `📞 ${prospect.contact_phone}` : ''}${prospect.city ? ` &nbsp;•&nbsp; 📍 ${prospect.city}` : ''}</div>
      ` : '<div class="info-name">—</div>'}
    </div>
  </div>

  <div class="statut-bar">
    <span class="statut-badge payable">📋 Paiement sous 30 jours</span>
    <span class="statut-badge engagement">${engConfig.label} · ${nbMois} mois</span>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:65%">Désignation</th>
        <th class="montant">Montant HT</th>
      </tr>
    </thead>
    <tbody>
      ${renderLignes}
    </tbody>
  </table>

  <div class="totaux">
    <div class="totaux-table">
      <div class="totaux-row grand-total">
        <span class="totaux-label">TOTAL GÉNÉRAL</span>
        <span class="totaux-value">${formatF(totalGeneral)} FCFA</span>
      </div>
    </div>
  </div>

  <div class="paiement-box">
    <div class="paiement-title">💳 Modalités de règlement</div>
    <div class="paiement-grid">
      <div class="paiement-item">
        <div class="paiement-item-label">Total facture</div>
        <div class="paiement-item-value">${formatF(totalGeneral)}</div>
        <div class="paiement-item-sub">FCFA</div>
      </div>
      <div class="paiement-item">
        <div class="paiement-item-label">Échéance</div>
        <div class="paiement-item-value" style="font-size:14px;">${dateEcheance}</div>
        <div class="paiement-item-sub">Date limite</div>
      </div>
    </div>
  </div>

  <div class="conditions">
    <div class="conditions-title">📋 Conditions générales</div>
    <ul class="conditions-list">
      <li>Paiement dû à la signature du présent document.</li>
      <li>En cas de retard de paiement, des pénalités de 1,5% par mois seront appliquées.</li>
      <li>La présente facture tient lieu de document contractuel entre les parties.</li>
    </ul>
  </div>

  ${applyStamp ? `
  <div class="stamp-box">
    <div class="stamp-paid">PAYÉ</div>
    <div class="stamp-info">MOYI TECH<br/>RCCM : RB/COT/26 A 117584</div>
  </div>
  ` : ''}

  <div class="footer">
    <div class="footer-brand">Facture établie par En-Check</div>
    <div class="footer-mention">Édité par MOYI TECH — RCCM : RB/COT/26 A 117584 | Réf. ${numeroFacture}</div>
  </div>

</div>
</body>
</html>`

    generateStyledPDF(html, numeroFacture)
  }

  // ═══════════════════════════════════════════════════════════
  // NOUVELLE FONCTION : GÉNÉRATION ÉCHÉANCIER PDF
  // ═══════════════════════════════════════════════════════════
const handleDownloadEcheancier = (devisData, calculData, totauxData, dateDepartParam, echeancesStatutsParam = {}, signatureDateEnCheck = '', signatureDateClient = '', echeancesDatesParam = {}, applyStamp = false) => {
    const prospect = prospects.find(p => p.id === devisData.prospect_id)
    const fixeNet = totauxData?.totalFixeNet || devisData.montant_fixe_net
    const mensuelNet = totauxData?.totalMensuelNet || devisData.montant_mensuel_net
    const annuelNet = totauxData?.totalAnnuelNet || devisData.montant_annuel_net
    const engConfig = getEngagementConfig(totauxData?.engagement || devisData.engagement || 'annuel')
    const nbMois = (devisData.mois_gratuit || totauxData?.nbMois)
      ? (totauxData?.nbMois || Math.max(engConfig.mois - 1, 1))
      : engConfig.mois
    const nbFois = totauxData?.paiementFois || devisData.paiement_fois || 1
    const echeance = nbFois > 1 ? Math.ceil(fixeNet / nbFois) : fixeNet
    const numeroEch = (devisData.numero || '').replace('DEV-', 'ECH-')
    const dateDepart = dateDepartParam ? new Date(dateDepartParam) : new Date()

    const lignesEcheancier = []
    let cumul = 0
    let numLigne = 1

    if (nbFois > 1) {
      for (let i = 0; i < nbFois; i++) {
        const montantEch = i < nbFois - 1 ? echeance : fixeNet - echeance * (nbFois - 1)
        const dateEch = new Date(dateDepart)
        dateEch.setMonth(dateEch.getMonth() + i)
        cumul += montantEch
        const numActuel = numLigne++
        // ← ICI : on prend la date modifiée si elle existe
        const datePaiement = echeancesDatesParam[numActuel]
          ? new Date(echeancesDatesParam[numActuel]).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
          : dateEch.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
        lignesEcheancier.push({
          num: numActuel,
          date: datePaiement,
          type: `💳 Investissement initial — Échéance ${i + 1}/${nbFois}`,
          montant: montantEch,
          cumul,
          categorie: 'fixe',
          statut: echeancesStatutsParam[numActuel] || 'attente',

        })
      }
    } else {
      cumul += fixeNet
      const numActuel = numLigne++
      // ← ICI : on prend la date modifiée si elle existe
      const datePaiement = echeancesDatesParam[numActuel]
        ? new Date(echeancesDatesParam[numActuel]).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
        : dateDepart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
      lignesEcheancier.push({
        num: numActuel,
        date: datePaiement,
        type: '💳 Investissement initial — Paiement comptant',
        montant: fixeNet,
        cumul,
        categorie: 'fixe',
        statut: echeancesStatutsParam[numActuel] || 'attente',
      })
    }

    for (let m = 0; m < nbMois; m++) {
      const dateMois = new Date(dateDepart)
      dateMois.setMonth(dateMois.getMonth() + (nbFois > 1 ? nbFois - 1 : 0) + m + 1)
      const isMoisOffert = devisData.mois_gratuit && m === 0
      const montantLigne = isMoisOffert ? 0 : mensuelNet
      cumul += montantLigne
      const numActuel = numLigne++
      // ← ICI : on prend la date modifiée si elle existe
      const datePaiement = echeancesDatesParam[numActuel]
        ? new Date(echeancesDatesParam[numActuel]).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
        : dateMois.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
      lignesEcheancier.push({
        num: numActuel,
        date: datePaiement,
        type: `📅 Abonnement mensuel — Mois ${m + 1}/${nbMois}${isMoisOffert ? ' 🎁 (offert)' : ''}`,
        montant: montantLigne,
        cumul,
        categorie: isMoisOffert ? 'offert' : 'mensuel',
        statut: isMoisOffert ? 'offert' : (echeancesStatutsParam[numActuel] || 'attente'),

      })
    }

    const totalReel = lignesEcheancier.reduce((s, l) => s + l.montant, 0)

    const renderLignesEch = () => lignesEcheancier.map(l => {
      // Statuts SANS émojis - badges textuels lisibles
      let statutBadge = ''
      let statutText = ''
      let statutColor = ''

      if (l.statut === 'paye') {
        statutBadge = 'PAYÉ'
        statutColor = '#10B981'
      } else if (l.statut === 'cours') {
        statutBadge = 'EN COURS'
        statutColor = '#F59E0B'
      } else if (l.statut === 'offert') {
        statutBadge = 'OFFERT'
        statutColor = '#10B981'
      } else {
        statutBadge = 'EN ATTENTE'
        statutColor = '#EF4444'
      }

      const bgColor = l.categorie === 'fixe' ? '#ede9fe' : l.categorie === 'offert' ? '#dcfce7' : '#fff'
      const textColor = l.categorie === 'fixe' ? '#5b21b6' : l.categorie === 'offert' ? '#15803d' : '#374151'
      const montantColor = l.categorie === 'offert' ? '#10B981' : '#1a1a2e'

      return `
    <tr style="background:${bgColor};">
      <td style="color:#6b7280; font-weight:700; text-align:center;">
        ${l.num}
      </td>
      <td style="color:#374151;">${l.date}</td>
      <td style="color:${textColor}; font-weight:600;">
        ${l.type}
      </td>
      <td style="text-align:right; font-weight:800; font-family:monospace; color:${montantColor}; font-size:14px;">
        ${l.categorie === 'offert' ? '<span style="color:#10B981; font-weight:800;">OFFERT</span>' : `${formatF(l.montant)} FCFA`}
      </td>
      <td style="text-align:center;">
        <span style="display:inline-block; background:${statutColor}; color:#fff; font-size:11px; font-weight:800; padding:4px 8px; border-radius:6px; letter-spacing:0.5px;">
          ${statutBadge}
        </span>
      </td>
      <td style="text-align:right; font-family:monospace; color:#6b7280; font-size:12px;">${formatF(l.cumul)} FCFA</td>
    </tr>`
    }).join('')

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Échéancier ${numeroEch}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Segoe UI', Arial, sans-serif; background:#fff; color:#1a1a2e; font-size:13px; line-height:1.6; }
    .page { max-width:820px; margin:0 auto; padding:48px 40px;position:relative; }

    /* EN-TÊTE */
    .header { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:24px; border-bottom:3px solid #6366F1; margin-bottom:32px; }
    .brand { font-size:30px; font-weight:900; color:#6366F1; letter-spacing:4px; }
    .brand-sub { font-size:10px; color:#999; letter-spacing:2px; text-transform:uppercase; margin-top:4px; }
    .brand-editor { font-size:9px; color:#999; letter-spacing:1px; margin-top:8px; padding-top:8px; border-top:1px solid #EEE; }
    .ech-ref { text-align:right; }
    .ech-title { font-size:26px; font-weight:900; color:#1a1a2e; text-transform:uppercase; letter-spacing:2px; }
    .ech-num { font-size:16px; color:#6366F1; font-weight:700; margin-top:4px; }
    .ech-date { font-size:11px; color:#999; margin-top:2px; }

    /* CLIENT */
    .client-box { background:#f8f7ff; border-left:4px solid #6366F1; padding:16px 20px; border-radius:0 10px 10px 0; margin-bottom:24px; }
    .client-label { font-size:10px; text-transform:uppercase; letter-spacing:1px; color:#6366F1; font-weight:700; margin-bottom:4px; }
    .client-name { font-size:18px; font-weight:700; }
    .client-sub { color:#777; font-size:12px; margin-top:4px; }

    /* RÉSUMÉ FINANCIER */
    .resume { display:grid; grid-template-columns:repeat(4, 1fr); gap:12px; margin-bottom:28px; }
    .resume-card { border-radius:12px; padding:16px; text-align:center; }
    .rc-fixe { background:#ede9fe; border:1px solid #c4b5fd; }
    .rc-mensuel { background:#eff6ff; border:1px solid #93c5fd; }
    .rc-total { background:linear-gradient(135deg,#fef3c7,#fde68a); border:2px solid #f59e0b; }
    .rc-duree { background:#f0fdf4; border:1px solid #86efac; }
    .rc-label { font-size:9px; text-transform:uppercase; letter-spacing:1px; font-weight:700; margin-bottom:6px; }
    .rc-fixe .rc-label { color:#6d28d9; }
    .rc-mensuel .rc-label { color:#1d4ed8; }
    .rc-total .rc-label { color:#b45309; }
    .rc-duree .rc-label { color:#15803d; }
    .rc-value { font-size:18px; font-weight:900; font-family:monospace; }
    .rc-fixe .rc-value { color:#5b21b6; }
    .rc-mensuel .rc-value { color:#1d4ed8; }
    .rc-total .rc-value { color:#d97706; }
    .rc-duree .rc-value { color:#15803d; font-size:22px; }
    .rc-sub { font-size:10px; color:#888; margin-top:4px; }

    /* LÉGENDE */
    .legende { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:16px; }
    .leg-item { display:inline-flex; align-items:center; gap:6px; font-size:11px; }
    .leg-dot { width:12px; height:12px; border-radius:3px; }

    /* TABLEAU */
    table { width:100%; border-collapse:collapse; border-radius:12px; overflow:hidden; box-shadow:0 2px 16px rgba(0,0,0,0.08); margin-bottom:24px; }
    thead tr { background:#6366F1; }
    thead th { padding:12px 14px; text-align:left; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:#fff; }
    tbody tr { border-bottom:1px solid rgba(0,0,0,0.04); }
    tbody td { padding:11px 14px; vertical-align:middle; font-size:13px; }
    tfoot tr { background:#6366F1; }
    tfoot td { padding:14px; font-weight:800; color:#fff; font-size:14px; }

    /* SYNTHÈSE */
    .synthese { background:linear-gradient(135deg,#fef3c7,#fde68a); border:2px solid #f59e0b; border-radius:16px; padding:24px; margin-bottom:24px; display:flex; justify-content:space-between; align-items:center; }
    .syn-left .syn-title { font-size:16px; font-weight:700; color:#92400e; }
    .syn-left .syn-desc { font-size:12px; color:#b45309; margin-top:4px; }
    .syn-value { font-size:32px; font-weight:900; color:#d97706; font-family:monospace; }

    /* NOTES */
    .notes { background:#f9fafb; border:1px solid #e5e7eb; border-radius:12px; padding:18px; margin-bottom:24px; }
    .notes-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; margin-bottom:10px; }
    .notes-list { list-style:none; display:flex; flex-direction:column; gap:5px; }
    .notes-list li { font-size:11px; color:#6b7280; display:flex; gap:6px; }
    .notes-list li::before { content:"→"; color:#6366F1; font-weight:700; }

        /* ═══ GESTION DES SAUTS DE PAGE ═══ */
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; page-break-after: auto; }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
    .client-box, .resume-card, .synthese, .notes, .signatures { page-break-inside: avoid; }
    h3, .section-title { page-break-after: avoid; }

    /* SIGNATURES */
    .signatures { display:flex; gap:40px; margin-top:32px; }
    .sig-block { flex:1; border-top:2px solid #e5e7eb; padding-top:14px; }
    .sig-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#6366F1; margin-bottom:6px; }
    .sig-name { font-size:12px; color:#888; margin-bottom:40px; }
    .sig-line { border-bottom:1px dashed #ccc; margin-bottom:6px; }
    .sig-footer { font-size:10px; color:#aaa; }


    .stamp-box {
  position: absolute;
  top: 45%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-18deg);
  border: 6px double #dc2626;
  border-radius: 50%;
  width: 190px;
  height: 190px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  opacity: 0.75;
  pointer-events: none;
  z-index: 100;
}
.stamp-paid {
  color: #dc2626;
  font-size: 40px;
  font-weight: 900;
  letter-spacing: 5px;
}
.stamp-info {
  color: #dc2626;
  font-size: 9px;
  font-weight: 700;
  text-align: center;
  letter-spacing: 0.5px;
  margin-top: 6px;
  line-height: 1.4;
}

    /* FOOTER */
    .footer { border-top:1px solid #e5e7eb; padding-top:18px; margin-top:24px; display:flex; justify-content:space-between; }
    .footer-brand { font-size:10px; color:#aaa; }
    .footer-mention { font-size:9px; color:#aaa; font-style:italic; }

    @media print {
      body { print-color-adjust:exact; -webkit-print-color-adjust:exact; }
      .page { padding:20px; }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- EN-TÊTE -->
  <div class="header">
    <div>
      <div class="brand">EN-CHECK</div>
      <div class="brand-sub">Système de pointage intelligent</div>
      <div class="brand-editor">Édité par MOYI TECH | RCCM : RB/COT/26 A 117584</div>
    </div>
    <div class="ech-ref">
      <div class="ech-title">Échéancier</div>
      <div class="ech-num">${numeroEch}</div>
      <div class="ech-date">Établi le ${dateDepart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
    </div>
  </div>

  <!-- CLIENT -->
  ${prospect ? `
  <div class="client-box">
    <div class="client-label">Client</div>
    <div class="client-name">${prospect.company_name}</div>
    <div class="client-sub">
      ${prospect.contact_name ? `👤 ${prospect.contact_name}` : ''}
      ${prospect.contact_role ? ` — ${prospect.contact_role}` : ''}
      ${prospect.contact_phone ? ` &nbsp;•&nbsp; 📞 ${prospect.contact_phone}` : ''}
      ${prospect.city ? ` &nbsp;•&nbsp; 📍 ${prospect.city}` : ''}
    </div>
  </div>` : ''}

  <!-- RÉSUMÉ FINANCIER -->
  <div class="resume">
    <div class="resume-card rc-fixe">
      <div class="rc-label">Investissement initial</div>
      <div class="rc-value">${formatF(fixeNet)}</div>
      <div class="rc-sub">FCFA ${nbFois > 1 ? `· ${nbFois}x ${formatF(echeance)} F` : '· comptant'}</div>
    </div>
    <div class="resume-card rc-mensuel">
      <div class="rc-label">Abonnement mensuel</div>
      <div class="rc-value">${formatF(mensuelNet)}</div>
      <div class="rc-sub">FCFA / mois</div>
    </div>
    <div class="resume-card rc-total">
      <div class="rc-label">Total engagement</div>
      <div class="rc-value">${formatF(annuelNet)}</div>
      <div class="rc-sub">FCFA sur ${nbMois} mois</div>
    </div>
    <div class="resume-card rc-duree">
      <div class="rc-label">Durée</div>
      <div class="rc-value">${nbMois}</div>
      <div class="rc-sub">mois · ${engConfig.label.replace(/[📅🔓]/g, '').trim()}</div>
    </div>
  </div>

  <!-- LÉGENDE -->
  <div class="legende">
    <div class="leg-item"><div class="leg-dot" style="background:#c4b5fd;"></div><span>Investissement initial</span></div>
    <div class="leg-item"><div class="leg-dot" style="background:#e5e7eb;"></div><span>Abonnement mensuel</span></div>
    ${devisData.mois_gratuit ? '<div class="leg-item"><div class="leg-dot" style="background:#86efac;"></div><span>Mois offert</span></div>' : ''}
  </div>

  <!-- TABLEAU ÉCHÉANCIER -->
  <table>
    <thead>
      <tr>
        <th style="width:30px; text-align:center;">N°</th>
        <th style="width:100px;">Date</th>
        <th style="flex:1;">Description</th>
        <th style="width:100px; text-align:right;">Montant</th>
        <th style="width:120px; text-align:center;">Statut</th>
        <th style="width:100px; text-align:right;">Cumul</th>
      </tr>
    </thead>
    <tbody>
      ${renderLignesEch()}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="4">TOTAL GÉNÉRAL</td>
        <td style="text-align:right; font-family:monospace;">${formatF(totalReel)} FCFA</td>
      </tr>
    </tfoot>
  </table>

  <!-- SYNTHÈSE -->
  <div class="synthese">
    <div class="syn-left">
      <div class="syn-title">📊 ${engConfig.label} — ${nbMois} mois</div>
      <div class="syn-desc">
        Initial ${nbFois > 1 ? `(${nbFois}x ${formatF(echeance)} FCFA)` : `(${formatF(fixeNet)} FCFA)`}
        + ${nbMois} mois × ${formatF(mensuelNet)} FCFA
        ${devisData.mois_gratuit ? '· 🎁 1 mois offert' : ''}
      </div>
    </div>
    <div class="syn-value">${formatF(annuelNet)} FCFA</div>
  </div>

  <!-- NOTES -->
  <div class="notes">
    <div class="notes-title">📋 Notes importantes</div>
    <ul class="notes-list">
      <li>Le paiement de l'investissement initial est exigible à la signature du présent document.</li>
      ${nbFois > 1 ? `<li>Le paiement initial est fractionné en ${nbFois} fois. Chaque échéance de ${formatF(echeance)} FCFA est due à la date indiquée.</li>` : ''}
      <li>Les mensualités d'abonnement sont dues le 1er de chaque mois à la date indiquée dans le tableau.</li>
      ${devisData.mois_gratuit ? '<li>🎁 Le premier mois d\'abonnement est offert. Il n\'est pas comptabilisé dans le total.</li>' : ''}
      <li>En cas de retard de paiement, des pénalités de 1,5% par mois de retard seront facturées.</li>
      <li>Engagement ${engConfig.label} — ${engConfig.desc}.</li>
    </ul>
  </div>

   <!-- SIGNATURES -->
  <div class="signatures">
    <div class="sig-block">
      <div class="sig-title">Pour En-Check</div>
      <div class="sig-name">Signature</div>
      <div class="sig-line"></div>
      <div class="sig-footer">Date : ${signatureDateEnCheck ? new Date(signatureDateEnCheck).toLocaleDateString('fr-FR', { day: 'numeric', month: 'numeric', year: 'numeric' }) : '__ / __ / ____'}</div>
    </div>
    <div class="sig-block">
      <div class="sig-title">Pour le client</div>
      <div class="sig-name">Signature</div>
      <div class="sig-line"></div>
      <div class="sig-footer">Date : ${signatureDateEnCheck ? new Date(signatureDateEnCheck).toLocaleDateString('fr-FR', { day: 'numeric', month: 'numeric', year: 'numeric' }) : '__ / __ / ____'}</div>
    </div>
  </div>

    ${applyStamp ? `
  <div class="stamp-box">
    <div class="stamp-paid">PAYÉ</div>
    <div class="stamp-info">MOYI TECH<br/>RCCM : RB/COT/26 A 117584</div>
  </div>
  ` : ''}

  <!-- FOOTER -->
  <div class="footer">
    <div class="footer-brand">Échéancier établi par En-Check</div>
    <div class="footer-mention">Édité par MOYI TECH — RCCM : RB/COT/26 A 117584 | Réf. ${numeroEch}</div>
  </div>

</div>
<script>window.onload = function() { window.print(); }</script>
</body>
</html>`

    // ✅ NOUVEAU

    generateStyledPDF(html, numeroEch)

  } // ← ferme handleDownloadEcheancier

  const genererNumero = async () => {
    const annee = new Date().getFullYear()
    const { count } = await supabase.from('devis').select('*', { count: 'exact', head: true })
    const num = ((count || 0) + 1).toString().padStart(3, '0')
    return `DEV-${annee}-${num}`
  }

  const handleSaveDevis = async () => {
    try {
      const calcul = calculerDevis()
      const totaux = appliquerPriorites(calcul)
      const numero = editingDevis ? editingDevis.numero : await genererNumero()

      const dataToSave = {
        numero,
        prospect_id: selectedProspect?.id || null,
        scoring, niveau: niveauFinal, config,
        montant_fixe_brut: calcul.sousTotalFixe,
        montant_fixe_net: totaux.totalFixeNet,
        montant_mensuel_brut: calcul.sousTotalMensuel,
        montant_mensuel_net: totaux.totalMensuelNet,
        montant_annuel_net: totaux.totalAnnuelNet,
        remise_fixe_pct: remiseFixe,
        remise_mensuel_pct: remiseMensuel,
        mois_gratuit: moisGratuit,
        paiement_fois: paiementFois,
        engagement: engagement,
        detail_calcul: { ...calcul, nego_ligne: negoLigne, total_categorie: totalCategorie, montant_convenu: montantConvenu, totaux, echeancesDates: echeancesDates, },
        status: 'brouillon',
        notes: notesDevis || null,
        updated_at: new Date().toISOString(),
      }

      if (editingDevis) {
        const { error } = await supabase.from('devis').update(dataToSave).eq('id', editingDevis.id)
        if (error) throw error
        toast.success('Devis mis à jour !')
      } else {
        const { error } = await supabase.from('devis').insert({ ...dataToSave, created_by: admin.id })
        if (error) throw error
        toast.success('Devis créé !')
        if (selectedProspect) {
          await supabase.from('prospects')
            .update({ status: 'devis_envoye', updated_at: new Date().toISOString() })
            .eq('id', selectedProspect.id)
        }
      }

      setShowGenerator(false)
      resetGenerator()
      loadData()
    } catch (error) {
      console.error('Erreur sauvegarde:', error)
      toast.error('Erreur lors de la sauvegarde')
    }
  }

  const resetGenerator = () => {
    setCurrentStep(1)
    setSelectedProspect(null)
    setScoring(SCORING_INITIAL)
    setNiveauSuggere(null)
    setNiveauFinal('moy')
    setConfig(CONFIG_INITIAL)
    setRemiseFixe(0)
    setRemiseMensuel(0)
    setMoisGratuit(false)
    setNotesDevis('')
    setNegoLigne(NEGO_LIGNE_INITIAL)
    setTotalCategorie(TOTAL_CATEGORIE_INITIAL)
    setMontantConvenu(MONTANT_CONVENU_INITIAL)
    setEditingDevis(null)
    setPaiementFois(1)
    setEngagement('annuel')
  }

  const handleEdit = (devis) => {
    setEditingDevis(devis)
    setSelectedProspect(prospects.find(p => p.id === devis.prospect_id) || null)
    setScoring(devis.scoring || SCORING_INITIAL)
    setNiveauFinal(devis.niveau || 'moy')
    setNiveauSuggere(calculerScore(devis.scoring || SCORING_INITIAL))
    setConfig(devis.config || CONFIG_INITIAL)
    setRemiseFixe(devis.remise_fixe_pct || 0)
    setRemiseMensuel(devis.remise_mensuel_pct || 0)
    setMoisGratuit(devis.mois_gratuit || false)
    setNotesDevis(devis.notes || '')
    setNegoLigne(devis.detail_calcul?.nego_ligne || NEGO_LIGNE_INITIAL)
    setTotalCategorie(devis.detail_calcul?.total_categorie || TOTAL_CATEGORIE_INITIAL)
    setMontantConvenu(devis.detail_calcul?.montant_convenu || MONTANT_CONVENU_INITIAL)
    setPaiementFois(devis.paiement_fois || 1)
    setEngagement(devis.engagement || 'annuel')
    setCurrentStep(1)
    setShowGenerator(true)
  }

  const handleDelete = async () => {
    if (!devisToDelete) return
    try {
      const { error } = await supabase.from('devis').delete().eq('id', devisToDelete.id)
      if (error) throw error
      toast.success('Devis supprimé')
      setShowDeleteModal(false)
      setDevisToDelete(null)
      loadData()
    } catch { toast.error('Erreur') }
  }

  const handleChangeStatusDevis = async (devis, newStatus) => {
    try {
      await supabase.from('devis').update({ status: newStatus }).eq('id', devis.id)
      toast.success('Statut mis à jour')
      loadData()
    } catch { toast.error('Erreur') }
  }

  const handleWhatsApp = (devisData, totaux) => {
    const prospect = prospects.find(p => p.id === devisData.prospect_id)
    const fixeNet = totaux?.totalFixeNet || devisData.montant_fixe_net
    const mensuelNet = totaux?.totalMensuelNet || devisData.montant_mensuel_net
    const annuelNet = totaux?.totalAnnuelNet || devisData.montant_annuel_net
    const engConfig = getEngagementConfig(totaux?.engagement || devisData.engagement || 'annuel')
    const nbMois = (devisData.mois_gratuit || totaux?.nbMois) ? (totaux?.nbMois || Math.max(engConfig.mois - 1, 1)) : engConfig.mois
    const nbFois = totaux?.paiementFois || devisData.paiement_fois || 1
    const echeance = nbFois > 1 ? Math.ceil(fixeNet / nbFois) : fixeNet

    const msg = `
🧾 *DEVIS EN-CHECK* — ${devisData.numero || 'BROUILLON'}
${prospect ? `\n🏢 Client : *${prospect.company_name}*` : ''}

━━━━━━━━━━━━━━━━━━━
📦 *INVESTISSEMENT INITIAL*
*${formatF(fixeNet)} FCFA*
${nbFois > 1 ? `💳 Paiement en *${nbFois}x* : *${formatF(echeance)} FCFA* par échéance` : ''}

━━━━━━━━━━━━━━━━━━━
📅 *ABONNEMENT MENSUEL*
*${formatF(mensuelNet)} FCFA/mois*
${nbMois < engConfig.mois ? '🎁 *1 mois offert inclus !*' : ''}
📋 *${engConfig.label}*

━━━━━━━━━━━━━━━━━━━
📊 *TOTAL SUR ${nbMois} MOIS*
*${formatF(annuelNet)} FCFA*
━━━━━━━━━━━━━━━━━━━

_Devis établi par En-Check_
    `.trim()

    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }


  // ═══════════════════════════════════════════════════════════
  // UTILITAIRE PDF — Injecte le HTML dans le DOM pour que
  // les <style> soient appliqués, puis capture avec html2pdf
  // ═══════════════════════════════════════════════════════════
  const generateStyledPDF = (htmlString, filename) => {
    // 1. Créer un conteneur caché
    const container = document.createElement('div')
    container.style.cssText = `
    position: fixed;
    left: -9999px;
    top: 0;
    width: 800px;
    background: #fff;
    z-index: -1;
  `

    // 2. Injecter le HTML complet (avec <style>)
    container.innerHTML = htmlString

    // 3. Ajouter au DOM pour que les styles soient appliqués
    document.body.appendChild(container)

    // 4. Laisser le temps au navigateur de calculer les styles
    setTimeout(() => {
      const opt = {
        margin: 0.5,
        filename: `${filename}.pdf`,
        image: { type: 'jpeg', quality: 1 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          letterRendering: true,
          backgroundColor: '#ffffff',
        },
        jsPDF: {
          unit: 'in',
          format: 'a4',
          orientation: 'portrait',
        },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
      }

      // 5. Capturer l'élément (pas la chaîne)
      html2pdf()
        .set(opt)
        .from(container.querySelector('.page') || container)
        .save()
        .then(() => {
          // 6. Nettoyer
          document.body.removeChild(container)

          // 7. Ouvrir la fenêtre d'impression
          const printWindow = window.open('', '_blank', 'width=900,height=700')
          printWindow.document.write(htmlString)
          printWindow.document.close()
        })
        .catch((err) => {
          console.error('Erreur PDF:', err)
          if (container.parentNode) document.body.removeChild(container)
        })
    }, 400) // 400ms pour que les styles soient calculés
  }

  const handleDownloadPDF = (devisData, calculData, totauxData, signatureDateEnCheck = '', signatureDateClient = '') => {
    const prospect = prospects.find(p => p.id === devisData.prospect_id)
    const lignesFixe = calculData?.lignesFixe || devisData.detail_calcul?.lignesFixe || []
    const lignesMensuel = calculData?.lignesMensuel || devisData.detail_calcul?.lignesMensuel || []
    const fixeNet = totauxData?.totalFixeNet || devisData.montant_fixe_net
    const mensuelNet = totauxData?.totalMensuelNet || devisData.montant_mensuel_net
    const annuelNet = totauxData?.totalAnnuelNet || devisData.montant_annuel_net
    const engConfig = getEngagementConfig(totauxData?.engagement || devisData.engagement || 'annuel')
    const nbMois = (devisData.mois_gratuit || totauxData?.nbMois) ? (totauxData?.nbMois || Math.max(engConfig.mois - 1, 1)) : engConfig.mois
    const modeFixe = totauxData?.modeFixe || devisData.detail_calcul?.totaux?.modeFixe || 'lignes'
    const modeMensuel = totauxData?.modeMensuel || devisData.detail_calcul?.totaux?.modeMensuel || 'lignes'
    const nbFois = totauxData?.paiementFois || devisData.paiement_fois || 1
    const echeance = nbFois > 1 ? Math.ceil(fixeNet / nbFois) : fixeNet

    const sousTotalFixe = lignesFixe.reduce((s, l) => s + l.total, 0)
    const sousTotalMensuel = lignesMensuel.reduce((s, l) => s + l.total, 0)

    const renderLignes = (lignes) => lignes.map(l => `
    <tr>
      <td>
        ${l.label}
        ${l.isGratuit ? '<span class="gratuit-tag">🎁 GRATUIT</span>' : ''}
        ${l.negocie ? '<span class="nego-tag">✏️ négocié</span>' : ''}
      </td>
      <td>
        ${l.isGratuit ? '0 F' : `${formatF(l.unitaire)} F`}
        ${l.negocie && l.modeNego === 'total' ? '<span class="nego-tag-small">(total convenu)</span>' : ''}
      </td>
      <td>${l.qte}</td>
      <td class="total-col">
        ${l.isGratuit ? '<span style="color:#10B981;font-weight:800;">GRATUIT</span>' : `${formatF(l.total)} F`}
        ${l.negocie && l.autoTotal !== l.total ? `<div class="auto-price">Base : ${formatF(l.autoTotal)} F</div>` : ''}
      </td>
    </tr>
  `).join('')

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Devis ${devisData.numero || 'DEVIS'}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Segoe UI',Arial,sans-serif; background:#fff; color:#1a1a2e; font-size:13px; line-height:1.6; }
    .page { max-width:800px; margin:0 auto; padding:48px 40px; }
    .header { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:28px; border-bottom:3px solid #6366F1; margin-bottom:32px; }
    .brand-name { font-size:32px; font-weight:900; color:#6366F1; letter-spacing:4px; }
    .brand-tagline { font-size:11px; color:#999; letter-spacing:2px; text-transform:uppercase; margin-top:6px; }
    .brand-editor { font-size:9px; color:#999; letter-spacing:1px; margin-top:8px; padding-top:8px; border-top:1px solid #EEE; }
    .devis-ref { text-align:right; }
    .devis-numero { font-size:22px; font-weight:700; color:#1a1a2e; }
    .devis-date { color:#999; font-size:12px; margin-top:4px; }
    .client-box { background:#f8f7ff; border-left:4px solid #6366F1; padding:16px 20px; border-radius:0 10px 10px 0; margin-bottom:28px; }
    .client-label { font-size:10px; text-transform:uppercase; letter-spacing:1px; color:#6366F1; font-weight:700; margin-bottom:6px; }
    .client-name { font-size:20px; font-weight:700; color:#1a1a2e; }
    .client-sub { color:#777; font-size:12px; margin-top:4px; }
    .offert-badge { display:inline-flex; align-items:center; gap:8px; background:#dcfce7; border:1px solid #86efac; border-radius:8px; padding:10px 16px; margin-bottom:20px; color:#15803d; font-size:12px; font-weight:600; }
    .conditions-box { display:flex; gap:16px; flex-wrap:wrap; margin-bottom:20px; }
    .condition-tag { display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius:8px; font-size:12px; font-weight:600; }
    .condition-paiement { background:#eff6ff; border:1px solid #93c5fd; color:#1d4ed8; }
    .condition-engagement { background:#fef3c7; border:1px solid #fcd34d; color:#92400e; }
    .resume { display:grid; grid-template-columns:1fr 1fr 1fr; gap:14px; margin-bottom:32px; }
    .resume-card { border-radius:12px; padding:18px; text-align:center; }
    .resume-card.fixe { background:#f0f0ff; border:1px solid #d4d4f7; }
    .resume-card.mensuel { background:#f0f0ff; border:1px solid #d4d4f7; }
    .resume-card.annuel { background:linear-gradient(135deg,#fef3c7,#fde68a); border:2px solid #f59e0b; }
    .resume-label { font-size:10px; text-transform:uppercase; letter-spacing:1px; color:#888; font-weight:700; }
    .resume-value { font-size:22px; font-weight:900; color:#6366F1; margin-top:6px; font-family:monospace; }
    .resume-card.annuel .resume-value { color:#d97706; }
    .resume-sub { font-size:10px; color:#16a34a; margin-top:4px; font-weight:600; }
    .section-title { font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:1.5px; color:#6366F1; margin-bottom:12px; padding-bottom:8px; border-bottom:2px solid #e8e8f8; }
    table { width:100%; border-collapse:collapse; margin-bottom:8px; border-radius:10px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.07); }
    thead tr { background:#6366F1; }
    thead th { padding:11px 14px; text-align:left; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:white; }
    thead th:not(:first-child) { text-align:right; }
    tbody tr { border-bottom:1px solid #f0f0f8; }
    tbody tr:nth-child(even) { background:#fbfbff; }
    tbody td { padding:10px 14px; font-size:13px; color:#374151; vertical-align:top; }
    tbody td:not(:first-child) { text-align:right; }
    .total-col { font-weight:700; color:#1a1a2e; }
    .nego-tag { display:inline-block; background:#fffbeb; color:#d97706; font-size:10px; font-weight:600; padding:2px 6px; border-radius:4px; border:1px solid #fde68a; margin-left:6px; }
    .gratuit-tag { display:inline-block; background:#dcfce7; color:#15803d; font-size:10px; font-weight:700; padding:2px 8px; border-radius:4px; border:1px solid #86efac; margin-left:6px; }
    .nego-tag-small { display:block; color:#9ca3af; font-size:10px; font-style:italic; }
    .auto-price { color:#9ca3af; font-size:10px; font-style:italic; text-decoration:line-through; }
    .subtotal-row td { background:#f0f0ff; color:#6366F1; font-weight:700; font-size:13px; }
    .nego-cat-row td { background:#fffbeb; color:#d97706; font-weight:800; font-size:14px; border-top:2px solid #fde68a; }
    .total-row td { background:#6366F1 !important; color:white !important; font-weight:800 !important; font-size:15px !important; padding:13px 14px !important; }
    .projection { background:linear-gradient(135deg,#fef3c7,#fde68a); border:2px solid #f59e0b; border-radius:14px; padding:22px 28px; display:flex; justify-content:space-between; align-items:center; margin-bottom:28px; }
    .projection-left .label { font-size:15px; font-weight:700; color:#92400e; }
    .projection-left .desc { font-size:11px; color:#b45309; margin-top:4px; }
    .projection-value { font-size:30px; font-weight:900; color:#d97706; font-family:monospace; }
    .echeances-box { background:#eff6ff; border:2px solid #93c5fd; border-radius:14px; padding:18px 24px; margin-bottom:28px; }
    .echeances-title { font-size:14px; font-weight:700; color:#1d4ed8; margin-bottom:8px; }
    .echeances-detail { font-size:13px; color:#1e40af; }
    .echeances-montant { font-size:22px; font-weight:900; color:#1d4ed8; font-family:monospace; margin-top:4px; }
    .config-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:24px; }
    .config-item { background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:10px 12px; }
    .config-item-label { font-size:10px; color:#9ca3af; text-transform:uppercase; letter-spacing:0.3px; margin-bottom:3px; }
    .config-item-value { font-size:14px; font-weight:700; color:#374151; }
    .options-chips { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:24px; }
    .chip { padding:5px 12px; border-radius:6px; background:#ede9fe; color:#6366F1; font-size:11px; font-weight:600; border:1px solid #c4b5fd; }
    .chip.gratuit { background:#dcfce7; color:#15803d; border-color:#86efac; }
    .notes-box { background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:16px; color:#6b7280; font-size:12px; line-height:1.7; margin-bottom:24px; }
    .footer { border-top:1px solid #e5e7eb; padding-top:20px; margin-top:8px; display:flex; justify-content:space-between; align-items:center; }
    .footer-brand { font-size:10px; color:#aaa; }
    .footer-validity { font-size:11px; color:#aaa; font-style:italic; }
    .table-note { font-size:10px; color:#888; font-style:italic; margin-bottom:24px; padding-left:4px; }
    /* ═══ GESTION DES SAUTS DE PAGE ═══ */
table { page-break-inside: auto; }
tr { page-break-inside: avoid; page-break-after: auto; }
thead { display: table-header-group; }
tfoot { display: table-footer-group; }
.client-box, .resume, .resume-card, .projection, .synthese, .echeances-box, .notes, .config-grid, .options-chips, .paiement-box, .conditions, .signatures, .totaux { page-break-inside: avoid; }
h3, .section-title, .section-sep { page-break-after: avoid; }
    @media print { body { print-color-adjust:exact; -webkit-print-color-adjust:exact; } .page { padding:20px; } }
  </style>
</head>
<body>
<div class="page">

  <div class="header">
    <div>
      <div class="brand-name">EN-CHECK</div>
      <div class="brand-tagline">Système de pointage intelligent</div>
      <div class="brand-editor">Édité par MOYI TECH | RCCM : RB/COT/26 A 117584</div>
    </div>
    <div class="devis-ref">
      <div class="devis-numero">${devisData.numero || 'DEVIS'}</div>
      <div class="devis-date">Établi le ${new Date(devisData.created_at || new Date()).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
    </div>
  </div>

  ${prospect ? `
  <div class="client-box">
    <div class="client-label">Client</div>
    <div class="client-name">${prospect.company_name}</div>
    <div class="client-sub">
      ${prospect.contact_name ? `👤 ${prospect.contact_name}` : ''}
      ${prospect.contact_role ? ` — ${prospect.contact_role}` : ''}
      ${prospect.contact_phone ? ` &nbsp;•&nbsp; 📞 ${prospect.contact_phone}` : ''}
      ${prospect.city ? ` &nbsp;•&nbsp; 📍 ${prospect.city}` : ''}
    </div>
  </div>` : ''}

  <div class="conditions-box">
    ${nbMois < engConfig.mois ? `<div class="offert-badge">🎁 Offre spéciale : 1 mois d'abonnement offert — Facturation sur ${nbMois} mois</div>` : ''}
    ${nbFois > 1 ? `<span class="condition-tag condition-paiement">💳 Paiement en ${nbFois}x — ${formatF(echeance)} FCFA/échéance</span>` : ''}
    <span class="condition-tag condition-engagement">${engConfig.label}</span>
  </div>

  <div class="resume">
    <div class="resume-card fixe">
      <div class="resume-label">Investissement initial</div>
      <div class="resume-value">${formatF(fixeNet)} F</div>
      <div class="resume-sub">${nbFois > 1 ? `${nbFois}x ${formatF(echeance)} F` : 'Paiement unique'}</div>
    </div>
    <div class="resume-card mensuel">
      <div class="resume-label">Abonnement mensuel</div>
      <div class="resume-value">${formatF(mensuelNet)} F</div>
      ${nbMois < engConfig.mois ? '<div class="resume-sub">🎁 1er mois offert</div>' : ''}
    </div>
    <div class="resume-card annuel">
      <div class="resume-label">${engConfig.label} (${nbMois} mois)</div>
      <div class="resume-value">${formatF(annuelNet)} F</div>
    </div>
  </div>

  <div class="section-title">📦 Détail de l'investissement initial</div>
  <table>
    <thead><tr><th style="width:45%">Prestation</th><th>Prix unitaire</th><th>Quantité</th><th>Montant</th></tr></thead>
    <tbody>
      ${renderLignes(lignesFixe)}
      ${modeFixe === 'lignes' ? `
      <tr class="total-row"><td colspan="3">TOTAL INVESTISSEMENT INITIAL</td><td>${formatF(fixeNet)} FCFA</td></tr>
      ` : `
      <tr class="subtotal-row"><td colspan="3">Sous-total</td><td>${formatF(sousTotalFixe)} F</td></tr>
      <tr class="nego-cat-row"><td colspan="3">✅ Prix convenu</td><td>${formatF(fixeNet)} FCFA</td></tr>
      `}
    </tbody>
  </table>
  ${modeFixe !== 'lignes' ? '<p class="table-note">Prix convenu entre les parties.</p>' : ''}

  ${nbFois > 1 ? `
  <div class="echeances-box">
    <div class="echeances-title">💳 Échéancier de paiement — ${nbFois} fois</div>
    <div class="echeances-detail">${Array.from({ length: nbFois }, (_, i) => `Échéance ${i + 1} : <strong>${formatF(i < nbFois - 1 ? echeance : fixeNet - echeance * (nbFois - 1))} FCFA</strong>`).join(' &nbsp;•&nbsp; ')}</div>
  </div>
  ` : ''}

  <div class="section-title">📅 Détail de l'abonnement mensuel</div>
  <table>
    <thead><tr><th style="width:45%">Service</th><th>Prix unitaire</th><th>Quantité</th><th>Montant</th></tr></thead>
    <tbody>
      ${renderLignes(lignesMensuel)}
      ${modeMensuel === 'lignes' ? `
      <tr class="total-row"><td colspan="3">TOTAL ABONNEMENT MENSUEL</td><td>${formatF(mensuelNet)} FCFA/mois</td></tr>
      ` : `
      <tr class="subtotal-row"><td colspan="3">Sous-total</td><td>${formatF(sousTotalMensuel)} F/mois</td></tr>
      <tr class="nego-cat-row"><td colspan="3">✅ Prix convenu</td><td>${formatF(mensuelNet)} FCFA/mois</td></tr>
      `}
    </tbody>
  </table>
  ${modeMensuel !== 'lignes' ? '<p class="table-note">Prix convenu entre les parties.</p>' : ''}

  <div class="projection">
    <div class="projection-left">
      <div class="label">${engConfig.label} sur ${nbMois} mois</div>
      <div class="desc">Investissement initial + abonnement × ${nbMois} mois${nbMois < engConfig.mois ? ' (1 mois offert déduit)' : ''}</div>
    </div>
    <div class="projection-value">${formatF(annuelNet)} FCFA</div>
  </div>

  <div class="section-title">⚙️ Configuration</div>
  <div class="config-grid">
    ${[
        { label: 'Sites', value: devisData.config?.nb_sites || '—' },
        { label: 'Employés', value: devisData.config?.nb_employes || '—' },
        { label: 'Machines', value: devisData.config?.nb_machines || '—' },
        { label: 'Admins', value: devisData.config?.nb_admins || '—' },
        { label: 'Pointage', value: (devisData.config?.type_pointage || '—').toUpperCase() },
        { label: 'Engagement', value: engConfig.label.replace(/[📅🔓]/g, '').trim() },
        { label: 'Paiement', value: nbFois > 1 ? `${nbFois}x` : 'Comptant' },
        { label: 'Validité', value: '30 jours' },
      ].map(c => `<div class="config-item"><div class="config-item-label">${c.label}</div><div class="config-item-value">${c.value}</div></div>`).join('')}
  </div>

  ${devisData.config?.options && Object.values(devisData.config.options).some(Boolean) ? `
  <div class="section-title">🔌 Services inclus</div>
  <div class="options-chips">
    ${Object.entries(devisData.config.options).filter(([, v]) => v).map(([k]) => {
        const isGratuit = k === 'jours_feries'
        return `<span class="chip ${isGratuit ? 'gratuit' : ''}">${k === 'jours_feries' ? '🎌 Jours fériés (GRATUIT)' : k === 'fiches_paie' ? '💰 Fiches de paie' : k.replace(/_/g, ' ')}</span>`
      }).join('')}
  </div>` : ''}

  ${devisData.notes ? `<div class="section-title">📝 Notes</div><div class="notes-box">${devisData.notes}</div>` : ''}

  

  <div class="footer">
    <div class="footer-brand">Devis établi par En-Check</div>
    <div class="footer-validity">Édité par MOYI TECH — RCCM : RB/COT/26 A 117584 | Offre valable 30 jours</div>
  </div>

</div>
<script>window.onload = function() { window.print(); }</script>
</body>
</html>`

    // ✅ NOUVEAU
    const numero = devisData.numero || 'DEVIS'
    generateStyledPDF(html, numero)

  } // ← ferme handleDownloadPDF

  const formatF = (n) => {
    if (n === null || n === undefined || isNaN(n)) return '0'
    return Number(n).toLocaleString('fr-FR')
  }
  const getStatutDevis = (key) => STATUTS_DEVIS.find(s => s.key === key) || STATUTS_DEVIS[0]
  const getNiveauColor = (n) => n === 'mini' ? '#10B981' : n === 'max' ? '#EF4444' : '#F59E0B'

  const devisFiltres = devisList.filter(d => {
    const prospect = prospects.find(p => p.id === d.prospect_id)
    const search = searchTerm.toLowerCase()
    return d.numero?.toLowerCase().includes(search) ||
      prospect?.company_name?.toLowerCase().includes(search)
  })



  // ─── Persistence localStorage des dates ───────────────────
  const STORAGE_KEY_FACTURE = 'encheck_facture_dates'
  const STORAGE_KEY_ECHEANCIER = 'encheck_echeancier_dates'

  const saveFactureDates = (emission, echeance) => {
    try {
      localStorage.setItem(STORAGE_KEY_FACTURE, JSON.stringify({ emission, echeance }))
    } catch { }
  }

  const loadFactureDates = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_FACTURE)
      return raw ? JSON.parse(raw) : { emission: '', echeance: '' }
    } catch { return { emission: '', echeance: '' } }
  }

  const saveEcheancierDates = (depart, statuts, dates) => {
    try {
      localStorage.setItem(STORAGE_KEY_ECHEANCIER, JSON.stringify({ depart, statuts, dates }))
    } catch { }
  }

  const loadEcheancierDates = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_ECHEANCIER)
      return raw ? JSON.parse(raw) : { depart: '', statuts: {}, dates: {} }
    } catch { return { depart: '', statuts: {}, dates: {} } }
  }


  // ✅ PRÉ-REMPLISSAGE DES LIGNES FACTURE SIMPLIFIÉE
  const prefilledFactureLignes = (devisData, totauxData) => {
    const fixeNet = totauxData?.totalFixeNet || devisData?.montant_fixe_net || 0
    const mensuelNet = totauxData?.totalMensuelNet || devisData?.montant_mensuel_net || 0
    return [
      { label: 'Investissement initial En-Check', montant: String(fixeNet || ''), frequence: 'unique' },
      { label: 'Abonnement mensuel En-Check (Pack Complet)', montant: String(mensuelNet || ''), frequence: 'mensuel' },
    ]
  }

  const calculTR = calculerDevis()
  const totauxTR = appliquerPriorites(calculTR)

  const nbAlertesMin = [...calculTR.lignesFixe, ...calculTR.lignesMensuel].filter(l => l.sousMinimum).length

  // Vérification spéciale pour fiches de paie sous 50F
  const alerteFichePaie = (() => {
    if (!config.options.fiches_paie) return null
    const nego = negoLigne.fiches_paie || { unitaire: '', total: '' }
    const negoUnitaire = parseFloat(nego.unitaire)
    const negoTotal = parseFloat(nego.total)
    const minUnitaire = TARIFS.fiches_paie.mini // 50F

    if (!isNaN(negoUnitaire) && negoUnitaire > 0 && negoUnitaire < minUnitaire) {
      return { type: 'unitaire', valeur: negoUnitaire, min: minUnitaire, ecart: minUnitaire - negoUnitaire }
    }
    if (!isNaN(negoTotal) && negoTotal > 0) {
      const unitaireImplicite = negoTotal / config.nb_employes
      if (unitaireImplicite < minUnitaire) {
        return { type: 'total', valeur: unitaireImplicite, min: minUnitaire, ecart: minUnitaire - unitaireImplicite }
      }
    }
    return null
  })()

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={{ animation: 'float 2s ease-in-out infinite' }}>
          <FileText size={50} color="#6366F1" />
        </div>
        <p style={styles.loadingText}>Chargement des devis...</p>
      </div>
    )
  }

  return (
    <>
      <style>{`
        @keyframes fadeInUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes pulseRed { 0%,100%{opacity:1} 50%{opacity:0.6} }
        @keyframes shakeAlert { 0%,100%{transform:translateX(0)} 10%,30%,50%,70%,90%{transform:translateX(-2px)} 20%,40%,60%,80%{transform:translateX(2px)} }
        @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.05)} }
        .devis-card { transition:all 0.3s ease !important; }
        .devis-card:hover { transform:translateY(-3px) !important; box-shadow:0 12px 40px rgba(0,0,0,0.4) !important; }
        .afro-action-icon { transition:all 0.2s ease !important; }
        .afro-action-icon:hover { transform:scale(1.1) !important; }
        .niveau-btn { transition:all 0.2s ease !important; }
        .niveau-btn:hover { transform:scale(1.05) !important; }
        .scoring-option { transition:all 0.2s ease !important; cursor:pointer; }
        .nego-input:focus { border-color:#F59E0B !important; box-shadow:0 0 0 2px rgba(245,158,11,0.15) !important; outline:none; }
        .nego-total-input:focus { border-color:#10B981 !important; box-shadow:0 0 0 2px rgba(16,185,129,0.15) !important; outline:none; }
        .cat-input:focus { border-color:#6366F1 !important; box-shadow:0 0 0 2px rgba(99,102,241,0.15) !important; outline:none; }
        .alerte-min-input { border-color:rgba(239,68,68,0.7) !important; box-shadow:0 0 0 2px rgba(239,68,68,0.25) !important; background:rgba(239,68,68,0.08) !important; color:#EF4444 !important; }
        .alerte-min-input:focus { border-color:#EF4444 !important; box-shadow:0 0 0 3px rgba(239,68,68,0.3) !important; }
        .scenario-card { transition:all 0.2s ease !important; cursor:pointer; }
        .scenario-card:hover { transform:translateY(-2px) !important; box-shadow:0 8px 24px rgba(0,0,0,0.3) !important; }
        input::placeholder { color:#444; }
        ::-webkit-scrollbar { width:6px; }
        ::-webkit-scrollbar-track { background:#0A0A0F; }
        ::-webkit-scrollbar-thumb { background:#6366F1; border-radius:3px; }
        select option { background:#141423; color:#E5E5E5; }
      `}</style>

      <div style={styles.container}>
        <div style={styles.bgPattern}></div>

        <header style={styles.header}>
          <div style={styles.headerInner}>
            <div style={styles.headerLeft}>
              <button onClick={() => navigate('/dashboard')} style={styles.backBtn}><ArrowLeft size={20} /></button>
              <div style={styles.logoMark}><FileText size={22} color="#6366F1" /></div>
              <div>
                <h1 style={styles.headerTitle}>DEVIS</h1>
                <span style={styles.headerSub}>Espace En-Check</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              {/* NOUVEAU BOUTON SCÉNARIOS */}
              <button onClick={() => setShowScenariosModal(true)} style={styles.scenariosBtn}>
                <Phone size={16} /><span>Scénarios Appels</span>
              </button>
              <button onClick={() => navigate('/prospection')} style={styles.secondaryBtn}>
                <TrendingUp size={16} /><span>Prospects</span>
              </button>
              <button onClick={() => { resetGenerator(); setShowGenerator(true) }} style={styles.addBtn}>
                <Plus size={18} /><span>Nouveau devis</span>
              </button>
            </div>
          </div>
        </header>

        <main style={styles.main}>
          <div style={styles.statsGrid}>
            {[
              { label: 'Total devis', value: devisList.length, color: '#6366F1' },
              { label: 'Envoyés', value: devisList.filter(d => d.status === 'envoye').length, color: '#F97316' },
              { label: 'Acceptés', value: devisList.filter(d => d.status === 'accepte').length, color: '#10B981' },
              { label: 'MRR potentiel', value: `${formatF(devisList.filter(d => d.status === 'accepte').reduce((s, d) => s + (d.montant_mensuel_net || 0), 0))} F`, color: '#F59E0B' },
            ].map((stat, i) => (
              <div key={i} style={{ ...styles.statCard, borderColor: stat.color + '30' }}>
                <span style={{ ...styles.statNumber, color: stat.color }}>{stat.value}</span>
                <span style={styles.statLabel}>{stat.label}</span>
              </div>
            ))}
          </div>

          <div style={styles.toolbar}>
            <div style={styles.searchBox}>
              <Search size={16} color="#666" />
              <input type="text" placeholder="Rechercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={styles.searchInput} />
              {searchTerm && <button onClick={() => setSearchTerm('')} style={styles.clearBtn}><X size={14} /></button>}
            </div>
            <span style={styles.resultCount}>{devisFiltres.length} devis</span>
          </div>

          <div style={styles.list}>
            {devisFiltres.length === 0 ? (
              <div style={styles.empty}>
                <div style={styles.emptyIcon}><FileText size={48} color="#6366F1" /></div>
                <p style={styles.emptyTitle}>Aucun devis</p>
                <p style={styles.emptySubtitle}>Créez votre premier devis</p>
                <button onClick={() => { resetGenerator(); setShowGenerator(true) }} style={styles.emptyBtn}>
                  <Plus size={16} /> Créer un devis
                </button>
              </div>
            ) : devisFiltres.map((devis, index) => {
              const prospect = prospects.find(p => p.id === devis.prospect_id)
              const statut = getStatutDevis(devis.status)
              const StatutIcon = statut.icon
              const engConfigDevis = getEngagementConfig(devis.engagement || 'annuel')
              const nbMoisDevis = devis.mois_gratuit ? Math.max(engConfigDevis.mois - 1, 1) : engConfigDevis.mois
              const nbFoisDevis = devis.paiement_fois || 1
              return (
                <div key={devis.id} className="devis-card" style={{ ...styles.devisCard, animation: `fadeInUp 0.4s ease ${index * 0.04}s forwards`, opacity: 0 }}>
                  <div style={styles.devisCardTop}>
                    <div style={styles.devisInfo}>
                      <div style={styles.devisTitleRow}>
                        <span style={styles.devisNumero}>{devis.numero}</span>
                        <div style={{ ...styles.statutDevisBadge, background: statut.bg, color: statut.color }}>
                          <StatutIcon size={11} /><span>{statut.label}</span>
                        </div>
                        {devis.mois_gratuit && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '8px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: '#10B981', fontSize: '10px', fontWeight: '700' }}>
                            <Gift size={10} /> 1 mois offert
                          </span>
                        )}
                        {nbFoisDevis > 1 && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '8px', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', color: '#6366F1', fontSize: '10px', fontWeight: '700' }}>
                            <CreditCard size={10} /> {nbFoisDevis}x
                          </span>
                        )}
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '8px', background: `${engConfigDevis.color}15`, border: `1px solid ${engConfigDevis.color}40`, color: engConfigDevis.color, fontSize: '10px', fontWeight: '700' }}>
                          <Calendar size={10} /> {engConfigDevis.label.replace(/[📅🔓]/g, '').trim()}
                        </span>
                      </div>
                      {prospect && <div style={styles.devisProspect}><Building2 size={12} color="#888" /><span>{prospect.company_name}</span></div>}
                      <div style={styles.devisMontants}>
                        <div style={styles.montantBlock}>
                          <span style={styles.montantLabel}>Fixe</span>
                          <span style={styles.montantValue}>{formatF(devis.montant_fixe_net)} F</span>
                          {nbFoisDevis > 1 && <span style={{ color: '#6366F1', fontSize: '10px' }}>{nbFoisDevis}x {formatF(Math.ceil(devis.montant_fixe_net / nbFoisDevis))} F</span>}
                        </div>
                        <div style={styles.montantSep}>/</div>
                        <div style={styles.montantBlock}>
                          <span style={styles.montantLabel}>Mensuel</span>
                          <span style={{ ...styles.montantValue, color: '#6366F1' }}>{formatF(devis.montant_mensuel_net)} F</span>
                        </div>
                        <div style={styles.montantSep}>/</div>
                        <div style={styles.montantBlock}>
                          <span style={styles.montantLabel}>Total ({nbMoisDevis}m)</span>
                          <span style={{ ...styles.montantValue, color: '#F59E0B' }}>{formatF(devis.montant_annuel_net)} F</span>
                        </div>
                      </div>
                      <div style={styles.devisDate}><Clock size={11} color="#555" /><span>Créé le {new Date(devis.created_at).toLocaleDateString('fr-FR')}</span></div>
                    </div>
                    <div style={styles.devisActions}>
                      <button className="afro-action-icon" onClick={() => { setSelectedDevis(devis); setShowDetailModal(true) }} style={{ ...styles.actionBtn, color: '#F59E0B' }} title="Voir"><Eye size={16} /></button>
                      <button className="afro-action-icon" onClick={() => {
                        setSignatureDatesData({
                          documentType: 'devis',
                          devisData: devis,
                          calculData: null,
                          totauxData: null,
                          dateEmission: '',
                          dateEcheance: '',
                          dateEcheancierDepart: '',
                          echeancesStatuts: {},
                          signatureDateEnCheck: '',
                          signatureDateClient: '',
                          applyStamp: false, // ✅ AJOUTER
                        })
                        setShowSignatureDatesModal(true)
                      }} style={{ ...styles.actionBtn, color: '#EC4899' }} title="PDF"><Download size={16} /></button>
                      <button className="afro-action-icon" onClick={() => {
                        const saved = loadFactureDates()
                        setFactureDevisData(devis)
                        setFactureCalculData(null)
                        setFactureTotauxData(null)
                        setFactureDateEmission(saved.emission || '')
                        setFactureDateEcheance(saved.echeance || '')
                        setShowFactureModal(true)
                      }} style={{ ...styles.actionBtn, color: '#10B981' }} title="Facture PDF"><FileText size={16} /></button>
                      <button className="afro-action-icon" onClick={() => {
                        const saved = loadEcheancierDates()

                        // ← CRÉER l'objet temporaire (comme pour Facture)
                        const d = {
                          numero: editingDevis?.numero || '',
                          prospect_id: selectedProspect?.id,
                          mois_gratuit: moisGratuit,
                          paiement_fois: paiementFois,
                          engagement,
                          config,
                          notes: notesDevis,
                          created_at: new Date().toISOString(),
                          detail_calcul: { echeancesDates: {} }
                        }

                        setEcheancierDevisData(d)  // ← 'd' au lieu de 'devis'
                        setEcheancierCalculData(calculTR)
                        setEcheancierTotauxData(totauxTR)
                        setEcheancierDateDepart(saved.depart || '')
                        setShowEcheancierModal(true)

                        // ← 'editingDevis' au lieu de 'devis'
                        if (editingDevis?.detail_calcul?.echeancesDates && Object.keys(editingDevis.detail_calcul.echeancesDates).length > 0) {
                          setEcheancesDates(editingDevis.detail_calcul.echeancesDates)
                        } else if (Object.keys(saved.dates || {}).length > 0) {
                          setEcheancesDates(saved.dates)
                        } else {
                          setEcheancesDates({})
                        }
                        setEcheancesStatuts(saved.statuts || {})
                      }} style={{ ...styles.actionBtn, color: '#6366F1' }} title="Échéancier PDF"><Calendar size={16} /></button>
                      <button className="afro-action-icon" onClick={() => handleWhatsApp(devis, null)} style={{ ...styles.actionBtn, color: '#25D366' }} title="WhatsApp"><Send size={16} /></button>
                      <button className="afro-action-icon" onClick={() => handleEdit(devis)} style={{ ...styles.actionBtn, color: '#6366F1' }} title="Modifier"><Edit size={16} /></button>
                      <button className="afro-action-icon" onClick={() => { setDevisToDelete(devis); setShowDeleteModal(true) }} style={{ ...styles.actionBtn, color: '#EF4444' }} title="Supprimer"><Trash2 size={16} /></button>
                    </div>
                  </div>
                  <div style={styles.devisStatusRow}>
                    <span style={styles.statusRowLabel}>Statut :</span>
                    {STATUTS_DEVIS.map(s => (
                      <button key={s.key} onClick={() => handleChangeStatusDevis(devis, s.key)} style={{ ...styles.statusChip, background: devis.status === s.key ? s.bg : 'transparent', borderColor: devis.status === s.key ? s.color + '50' : 'rgba(255,255,255,0.06)', color: devis.status === s.key ? s.color : '#555', fontWeight: devis.status === s.key ? '700' : '400' }}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </main>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* GÉNÉRATEUR DE DEVIS */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {showGenerator && (
          <div style={styles.generatorOverlay} onClick={() => setShowGenerator(false)}>
            <div style={styles.generatorPanel} onClick={e => e.stopPropagation()}>

              <div style={styles.genHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={styles.genIcon}><Calculator size={20} color="#6366F1" /></div>
                  <div>
                    <h2 style={styles.genTitle}>{editingDevis ? `Modifier ${editingDevis.numero}` : 'Nouveau Devis'}</h2>
                    <span style={styles.genSub}>{selectedProspect ? selectedProspect.company_name : 'Sans prospect lié'}</span>
                  </div>
                </div>
                <button onClick={() => { setShowGenerator(false); resetGenerator() }} style={styles.closeBtn}><X size={20} /></button>
              </div>

              <div style={styles.stepsBar}>
                {[{ num: 1, label: 'Scoring' }, { num: 2, label: 'Configuration' }, { num: 3, label: 'Négociation' }, { num: 4, label: 'Résultat' }].map((step, i, arr) => (
                  <div key={step.num} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ ...styles.stepCircle, background: currentStep >= step.num ? '#6366F1' : 'rgba(255,255,255,0.06)', color: currentStep >= step.num ? '#FFF' : '#555', borderColor: currentStep >= step.num ? '#6366F1' : 'rgba(255,255,255,0.1)' }}>
                      {currentStep > step.num ? <CheckCircle2 size={14} /> : step.num}
                    </div>
                    <span style={{ ...styles.stepLabel, color: currentStep >= step.num ? '#FFF' : '#555' }}>{step.label}</span>
                    {i < arr.length - 1 && <div style={{ width: '24px', height: '1px', background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />}
                  </div>
                ))}
              </div>

              <div style={styles.genBody}>

                {/* ═══════════════════════════════════════════════════════════ */}
                {/* ÉTAPE 1 : SCORING */}
                {/* ═══════════════════════════════════════════════════════════ */}
                {currentStep === 1 && (
                  <div style={styles.stepContent}>
                    <div style={styles.stepTitleWrap}>
                      <h3 style={styles.stepTitle}>📊 Scoring commercial</h3>
                      <p style={styles.stepDesc}>Évaluez le profil du client. Usage interne uniquement.</p>
                    </div>

                    <div style={styles.formField}>
                      <label style={styles.label}>Lier à un prospect (optionnel)</label>
                      <select value={selectedProspect?.id || ''} onChange={e => {
                        const p = prospects.find(p => p.id === e.target.value)
                        setSelectedProspect(p || null)
                        if (p) setConfig(prev => ({ ...prev, nb_employes: p.nb_employees_estimate || prev.nb_employes, nb_employes_a_former: p.nb_employees_estimate || prev.nb_employes_a_former, nb_sites: p.nb_sites_estimate || prev.nb_sites }))
                      }} style={styles.select}>
                        <option value="">-- Aucun prospect --</option>
                        {prospects.map(p => <option key={p.id} value={p.id}>{p.company_name}</option>)}
                      </select>
                    </div>

                    {CRITERES_SCORING.map(critere => (
                      <div key={critere.key} style={styles.critereBlock}>
                        <div style={styles.critereTitle}>
                          <span>{critere.icon}</span>
                          <span style={styles.critereTitleText}>{critere.label}</span>
                          {scoring[critere.key] && (
                            <>
                              <span style={{ ...styles.critereChoisi, color: getNiveauColor(scoring[critere.key]), background: getNiveauColor(scoring[critere.key]) + '15' }}>{scoring[critere.key].toUpperCase()}</span>
                              <button onClick={() => handleScoringChange(critere.key, null)} style={styles.resetCritere}><X size={10} /></button>
                            </>
                          )}
                        </div>
                        <div style={styles.critereOptions}>
                          {critere.options.map(opt => (
                            <label key={opt.value} className="scoring-option" style={{ ...styles.scoringOption, borderColor: scoring[critere.key] === opt.value ? getNiveauColor(opt.value) + '60' : 'rgba(255,255,255,0.06)', background: scoring[critere.key] === opt.value ? getNiveauColor(opt.value) + '10' : 'transparent' }}>
                              <input type="radio" name={critere.key} value={opt.value} checked={scoring[critere.key] === opt.value} onChange={() => handleScoringChange(critere.key, opt.value)} style={{ display: 'none' }} />
                              <div style={styles.scoringOptionLeft}>
                                <div style={{ ...styles.scoringRadio, borderColor: scoring[critere.key] === opt.value ? getNiveauColor(opt.value) : 'rgba(255,255,255,0.2)', background: scoring[critere.key] === opt.value ? getNiveauColor(opt.value) : 'transparent' }}></div>
                                <div>
                                  <span style={{ ...styles.scoringOptionLabel, color: scoring[critere.key] === opt.value ? '#FFF' : '#888' }}>{opt.label}</span>
                                  <span style={styles.scoringOptionDesc}>{opt.desc}</span>
                                </div>
                              </div>
                              <span style={{ ...styles.scoringNiveauTag, color: getNiveauColor(opt.value), background: getNiveauColor(opt.value) + '15' }}>{opt.value.toUpperCase()}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}

                    <div style={styles.scoringResult}>
                      <div style={styles.scoringResultTop}>
                        <span style={styles.scoringResultLabel}>Niveau suggéré :</span>
                        {niveauSuggere
                          ? <span style={{ ...styles.scoringResultValue, color: getNiveauColor(niveauSuggere) }}>{niveauSuggere.toUpperCase()}</span>
                          : <span style={{ color: '#555', fontSize: '13px' }}>Évaluez au moins un critère</span>
                        }
                      </div>
                      <div style={styles.scoringResultBottom}>
                        <span style={styles.scoringResultLabel}>Niveau de base :</span>
                        <div style={styles.niveauBtns}>
                          {['mini', 'moy', 'max'].map(n => (
                            <button key={n} className="niveau-btn" onClick={() => setNiveauFinal(n)} style={{ ...styles.niveauBtn, background: niveauFinal === n ? getNiveauColor(n) : 'transparent', borderColor: niveauFinal === n ? getNiveauColor(n) : 'rgba(255,255,255,0.1)', color: niveauFinal === n ? '#000' : getNiveauColor(n) }}>
                              {n.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ═══════════════════════════════════════════════════════════ */}
                {/* ÉTAPE 2 : CONFIGURATION */}
                {/* ═══════════════════════════════════════════════════════════ */}
                {currentStep === 2 && (
                  <div style={styles.stepContent}>
                    <div style={styles.stepTitleWrap}>
                      <h3 style={styles.stepTitle}>⚙️ Configuration & Aperçu des prix</h3>
                      <p style={styles.stepDesc}>Renseignez les données. Les totaux par ligne sont affichés en temps réel.</p>
                    </div>

                    <div style={styles.configSection}>
                      <div style={styles.configSectionTitle}><Building2 size={14} color="#6366F1" /> Infrastructure</div>
                      <div style={styles.configGrid}>
                        {[
                          { key: 'nb_sites', label: 'Nb de sites', min: 1 },
                          { key: 'nb_employes', label: 'Nb d\'employés', min: 1 },
                          { key: 'nb_machines', label: 'Nb de machines', min: 1 },
                          { key: 'nb_admins', label: 'Nb d\'admins', min: 1 },
                          { key: 'nb_admins_supp', label: 'Admins supplémentaires', min: 0 },
                          { key: 'nb_employes_a_former', label: 'Employés à former', min: 0 },
                        ].map(field => (
                          <div key={field.key} style={styles.configField}>
                            <label style={styles.label}>{field.label}</label>
                            <input type="number" min={field.min} value={config[field.key]} onChange={e => setConfig({ ...config, [field.key]: parseInt(e.target.value) || 0 })} style={styles.configInput} />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={styles.configSection}>
                      <div style={styles.configSectionTitle}><Shield size={14} color="#6366F1" /> Type de pointage</div>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        {[
                          { value: 'pin', label: '🔢 Code PIN', key: 'pointage_pin' },
                          { value: 'qr', label: '📱 QR Code', key: 'pointage_qr' },
                        ].map(opt => {
                          const unitaire = TARIFS[opt.key][niveauFinal]
                          const total = unitaire * config.nb_employes
                          return (
                            <label key={opt.value} style={{ ...styles.pointageOption, borderColor: config.type_pointage === opt.value ? '#6366F1' : 'rgba(255,255,255,0.06)', background: config.type_pointage === opt.value ? 'rgba(99,102,241,0.08)' : 'transparent', cursor: 'pointer' }}>
                              <input type="radio" name="type_pointage" value={opt.value} checked={config.type_pointage === opt.value} onChange={() => setConfig({ ...config, type_pointage: opt.value })} style={{ display: 'none' }} />
                              <span style={{ color: config.type_pointage === opt.value ? '#FFF' : '#888', fontWeight: '600', fontSize: '14px' }}>{opt.label}</span>
                              <span style={{ color: '#6366F1', fontSize: '12px' }}>{formatF(unitaire)} F/emp/mois</span>
                              <span style={{ color: '#F59E0B', fontSize: '12px', fontWeight: '700' }}>
                                = {formatF(total)} F/mois ({config.nb_employes} emp)
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    </div>

                    <div style={styles.configSection}>
                      <div style={styles.configSectionTitle}><Zap size={14} color="#6366F1" /> Options mensuelles — prix total inclus</div>
                      <div style={styles.optionsGrid}>
                        {[
                          { key: 'photo_pointage', label: 'Photo pointage', tarifKey: 'photo_pointage', qte: config.nb_employes, unite: 'emp', icon: '📸' },
                          { key: 'planning', label: 'Planning', tarifKey: 'planning', qte: config.nb_sites, unite: 'site', icon: '📅' },
                          { key: 'retards', label: 'Retards', tarifKey: 'retards', qte: config.nb_sites, unite: 'site', icon: '⏰' },
                          { key: 'modifier_pointages', label: 'Modifier pointages', tarifKey: 'modifier_pointages', qte: config.nb_employes, unite: 'emp', icon: '✏️' },
                          { key: 'absences_conges', label: 'Absences & Congés', tarifKey: 'absences_conges', qte: config.nb_sites, unite: 'site', icon: '🏖️' },
                          { key: 'heures_supplementaires', label: 'Heures supplémentaires', tarifKey: 'heures_supplementaires', qte: config.nb_sites, unite: 'site', icon: '⏱️' },
                          { key: 'espace_employe', label: 'Espace Employé', tarifKey: 'espace_employe', qte: config.nb_employes, unite: 'emp', icon: '👤' },
                          { key: 'geofencing', label: 'Geofencing', tarifKey: 'geofencing', qte: config.nb_employes, unite: 'emp', icon: '📍' },
                          { key: 'maps_temps_reel', label: 'Maps temps réel', tarifKey: 'maps_temps_reel', qte: config.nb_employes, unite: 'emp', icon: '🗺️' },
                          { key: 'reconnaissance_faciale', label: 'Reconnaissance faciale', tarifKey: 'reconnaissance_faciale', qte: config.nb_employes, unite: 'emp', icon: '🤖' },
                          // NOUVELLE OPTION : FICHES DE PAIE
                          { key: 'fiches_paie', label: 'Fiches de paie', tarifKey: 'fiches_paie', qte: config.nb_employes, unite: 'emp', icon: '💰', isNew: true },
                          // NOUVELLE OPTION : JOURS FÉRIÉS (GRATUIT)
                          { key: 'jours_feries', label: 'Jours fériés', tarifKey: 'jours_feries', qte: config.nb_sites, unite: 'site', icon: '🎌', isGratuit: true },
                        ].map(opt => {
                          const unitaire = TARIFS[opt.tarifKey][niveauFinal]
                          const total = unitaire * opt.qte
                          const isActive = config.options[opt.key]
                          const isGratuit = opt.isGratuit
                          return (
                            <label key={opt.key} style={{
                              ...styles.optionToggle,
                              borderColor: isGratuit && isActive
                                ? 'rgba(16,185,129,0.5)'
                                : isActive ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.06)',
                              background: isGratuit && isActive
                                ? 'rgba(16,185,129,0.08)'
                                : isActive ? 'rgba(99,102,241,0.08)' : 'transparent',
                              cursor: 'pointer',
                              position: 'relative',
                            }}>
                              {opt.isNew && (
                                <span style={{
                                  position: 'absolute', top: '-8px', right: '8px',
                                  background: '#F59E0B', color: '#000',
                                  fontSize: '9px', fontWeight: '800',
                                  padding: '2px 6px', borderRadius: '4px',
                                }}>NOUVEAU</span>
                              )}
                              {isGratuit && (
                                <span style={{
                                  position: 'absolute', top: '-8px', right: '8px',
                                  background: '#10B981', color: '#FFF',
                                  fontSize: '9px', fontWeight: '800',
                                  padding: '2px 6px', borderRadius: '4px',
                                }}>GRATUIT</span>
                              )}
                              <input type="checkbox" checked={isActive} onChange={e => setConfig({ ...config, options: { ...config.options, [opt.key]: e.target.checked } })} style={{ display: 'none' }} />
                              <div style={styles.optionToggleLeft}>
                                <div style={{ ...styles.optionCheckbox, background: isActive ? (isGratuit ? '#10B981' : '#6366F1') : 'transparent', borderColor: isActive ? (isGratuit ? '#10B981' : '#6366F1') : 'rgba(255,255,255,0.2)' }}>
                                  {isActive && <CheckCircle2 size={12} color="#FFF" />}
                                </div>
                                <div>
                                  <span style={{ ...styles.optionLabel, color: isActive ? '#FFF' : '#888' }}>{opt.icon} {opt.label}</span>
                                  {isGratuit ? (
                                    <span style={{ display: 'block', color: '#10B981', fontSize: '12px', fontWeight: '700' }}>
                                      GRATUIT — Inclus dans tous les plans
                                    </span>
                                  ) : (
                                    <>
                                      <span style={styles.optionTarif}>
                                        {formatF(unitaire)} F/{opt.unite}/mois
                                        {opt.key === 'fiches_paie' && <span style={{ color: '#F59E0B', marginLeft: '4px' }}>(min 50F)</span>}
                                      </span>
                                      <span style={{
                                        display: 'block',
                                        fontSize: '12px',
                                        fontWeight: '700',
                                        color: isActive ? '#F59E0B' : '#555',
                                        marginTop: '2px',
                                      }}>
                                        = {formatF(total)} F/mois
                                        <span style={{ fontWeight: '400', color: '#666', fontSize: '10px' }}>
                                          {' '}({formatF(unitaire)} × {opt.qte} {opt.unite}{opt.qte > 1 ? 's' : ''})
                                        </span>
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    </div>

                    {/* SECTION ENGAGEMENT MISE À JOUR */}
                    <div style={styles.configSection}>
                      <div style={styles.configSectionTitle}><CreditCard size={14} color="#6366F1" /> Paiement & Engagement</div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <div>
                          <label style={{ ...styles.label, marginBottom: '8px', display: 'block' }}>💳 Paiement de l'investissement initial</label>
                          <div style={{ display: 'flex', gap: '10px' }}>
                            {[
                              { value: 1, label: 'Comptant', desc: 'Paiement unique' },
                              { value: 2, label: 'En 2 fois', desc: `${formatF(Math.ceil(calculTR.sousTotalFixe / 2))} F/éch.` },
                              { value: 3, label: 'En 3 fois', desc: `${formatF(Math.ceil(calculTR.sousTotalFixe / 3))} F/éch.` },
                            ].map(opt => (
                              <label key={opt.value} style={{
                                flex: 1,
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                                padding: '14px 12px', borderRadius: '12px',
                                border: `2px solid ${paiementFois === opt.value ? '#6366F1' : 'rgba(255,255,255,0.06)'}`,
                                background: paiementFois === opt.value ? 'rgba(99,102,241,0.08)' : 'transparent',
                                cursor: 'pointer', transition: 'all 0.2s ease',
                              }}>
                                <input type="radio" name="paiement_fois" value={opt.value} checked={paiementFois === opt.value} onChange={() => setPaiementFois(opt.value)} style={{ display: 'none' }} />
                                <div style={{
                                  width: '20px', height: '20px', borderRadius: '50%',
                                  border: `2px solid ${paiementFois === opt.value ? '#6366F1' : 'rgba(255,255,255,0.2)'}`,
                                  background: paiementFois === opt.value ? '#6366F1' : 'transparent',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                  {paiementFois === opt.value && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FFF' }} />}
                                </div>
                                <span style={{ color: paiementFois === opt.value ? '#FFF' : '#888', fontSize: '13px', fontWeight: '700' }}>{opt.label}</span>
                                <span style={{ color: paiementFois === opt.value ? '#6366F1' : '#555', fontSize: '11px' }}>{opt.desc}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* ENGAGEMENTS MIS À JOUR : 2 mois, 3 mois, 6 mois, annuel, sans */}
                        <div>
                          <label style={{ ...styles.label, marginBottom: '8px', display: 'block' }}>📋 Durée d'engagement</label>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
                            {ENGAGEMENTS.map(eng => (
                              <label key={eng.value} style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                                padding: '14px 12px', borderRadius: '12px',
                                border: `2px solid ${engagement === eng.value ? eng.color : 'rgba(255,255,255,0.06)'}`,
                                background: engagement === eng.value ? eng.color + '15' : 'transparent',
                                cursor: 'pointer', transition: 'all 0.2s ease',
                                position: 'relative',
                              }}>
                                {eng.remise > 0 && (
                                  <span style={{
                                    position: 'absolute', top: '-8px', right: '8px',
                                    background: eng.color, color: '#FFF',
                                    fontSize: '9px', fontWeight: '800',
                                    padding: '2px 6px', borderRadius: '4px',
                                  }}>-{eng.remise}%</span>
                                )}
                                <input type="radio" name="engagement" value={eng.value} checked={engagement === eng.value} onChange={() => setEngagement(eng.value)} style={{ display: 'none' }} />
                                <div style={{
                                  width: '20px', height: '20px', borderRadius: '50%',
                                  border: `2px solid ${engagement === eng.value ? eng.color : 'rgba(255,255,255,0.2)'}`,
                                  background: engagement === eng.value ? eng.color : 'transparent',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                  {engagement === eng.value && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FFF' }} />}
                                </div>
                                <span style={{ color: engagement === eng.value ? '#FFF' : '#888', fontSize: '13px', fontWeight: '700' }}>{eng.label}</span>
                                <span style={{ color: engagement === eng.value ? eng.color : '#555', fontSize: '11px' }}>{eng.desc}</span>
                                {eng.mois > 1 && (
                                  <span style={{ color: '#666', fontSize: '10px' }}>({eng.mois} mois)</span>
                                )}
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div style={styles.configSection}>
                      <div style={styles.configSectionTitle}><TrendingUp size={14} color="#6366F1" /> Remises globales & Offre</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div style={styles.configField}>
                          <label style={styles.label}>Remise fixe (%)</label>
                          <input type="number" min="0" max="50" value={remiseFixe} onChange={e => setRemiseFixe(parseFloat(e.target.value) || 0)} style={styles.configInput} />
                        </div>
                        <div style={styles.configField}>
                          <label style={styles.label}>Remise mensuelle (%) <span style={{ color: '#888', fontSize: '10px' }}>+ {getEngagementConfig(engagement).remise}% engagement</span></label>
                          <input type="number" min="0" max="50" value={remiseMensuel} onChange={e => setRemiseMensuel(parseFloat(e.target.value) || 0)} style={styles.configInput} />
                        </div>
                      </div>

                      <label style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', borderRadius: '12px', border: `2px solid ${moisGratuit ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.08)'}`, background: moisGratuit ? 'rgba(16,185,129,0.06)' : 'transparent', cursor: 'pointer', marginTop: '4px' }}>
                        <input type="checkbox" checked={moisGratuit} onChange={e => setMoisGratuit(e.target.checked)} style={{ display: 'none' }} />
                        <div style={{ width: '44px', height: '24px', borderRadius: '12px', background: moisGratuit ? '#10B981' : 'rgba(255,255,255,0.1)', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
                          <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#FFF', position: 'absolute', top: '3px', left: moisGratuit ? '23px' : '3px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                        </div>
                        <div>
                          <span style={{ display: 'block', fontSize: '14px', fontWeight: '700', color: moisGratuit ? '#10B981' : '#888' }}>🎁 1 mois offert</span>
                          <span style={{ display: 'block', fontSize: '12px', color: '#666', marginTop: '2px' }}>{moisGratuit ? `Actif — facturation sur ${getEngagementConfig(engagement).mois - 1} mois` : 'Offrir le premier mois d\'abonnement'}</span>
                        </div>
                      </label>
                    </div>

                    <div style={styles.formField}>
                      <label style={styles.label}>Notes internes</label>
                      <textarea value={notesDevis} onChange={e => setNotesDevis(e.target.value)} style={{ ...styles.configInput, minHeight: '80px', resize: 'vertical' }} placeholder="Observations, conditions particulières..." />
                    </div>

                    <div style={styles.previewBar}>
                      <div style={styles.previewItem}>
                        <span style={styles.previewLabel}>Sous-total fixe</span>
                        <span style={styles.previewValue}>{formatF(calculTR.sousTotalFixe)} F</span>
                        {paiementFois > 1 && <span style={{ color: '#6366F1', fontSize: '10px', marginTop: '2px' }}>{paiementFois}x {formatF(Math.ceil(totauxTR.totalFixeNet / paiementFois))} F</span>}
                      </div>
                      <div style={styles.previewSep}></div>
                      <div style={styles.previewItem}>
                        <span style={styles.previewLabel}>Sous-total mensuel</span>
                        <span style={{ ...styles.previewValue, color: '#6366F1' }}>{formatF(calculTR.sousTotalMensuel)} F</span>
                        {totauxTR.remiseEngagement > 0 && <span style={{ color: '#10B981', fontSize: '10px' }}>-{totauxTR.remiseEngagement}% eng.</span>}
                      </div>
                      <div style={styles.previewSep}></div>
                      <div style={styles.previewItem}>
                        <span style={styles.previewLabel}>Total ({totauxTR.nbMois}m)</span>
                        <span style={{ ...styles.previewValue, color: '#F59E0B' }}>{formatF(totauxTR.totalAnnuelNet)} F</span>
                      </div>
                      <div style={styles.previewSep}></div>
                      <div style={styles.previewItem}>
                        <span style={styles.previewLabel}>Engagement</span>
                        <span style={{ color: getEngagementConfig(engagement).color, fontSize: '12px', fontWeight: '700' }}>{getEngagementConfig(engagement).label.replace(/[📅🔓]/g, '').trim()}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* ═══════════════════════════════════════════════════════════ */}
                {/* ÉTAPE 3 : NÉGOCIATION */}
                {/* ═══════════════════════════════════════════════════════════ */}
                {currentStep === 3 && (
                  <div style={styles.stepContent}>
                    <div style={styles.stepTitleWrap}>
                      <h3 style={styles.stepTitle}>🤝 Négociation</h3>
                      <p style={styles.stepDesc}>
                        3 niveaux —
                        <strong style={{ color: '#F97316' }}> Global</strong> →
                        <strong style={{ color: '#6366F1' }}> Catégorie</strong> →
                        <strong style={{ color: '#F59E0B' }}> Ligne (unitaire ou total)</strong>
                      </p>
                    </div>

                    {/* ALERTE GÉNÉRALE MINIMUM */}
                    {nbAlertesMin > 0 && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '14px 18px', borderRadius: '14px',
                        background: 'rgba(239,68,68,0.12)',
                        border: '2px solid rgba(239,68,68,0.5)',
                        animation: 'pulseRed 1.5s infinite',
                      }}>
                        <div style={{
                          width: '40px', height: '40px', borderRadius: '50%',
                          background: 'rgba(239,68,68,0.2)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <AlertTriangle size={22} color="#EF4444" />
                        </div>
                        <div>
                          <span style={{ color: '#EF4444', fontSize: '15px', fontWeight: '800', display: 'block' }}>
                            🔴 {nbAlertesMin} ligne{nbAlertesMin > 1 ? 's' : ''} sous le prix minimum En-Check !
                          </span>
                          <span style={{ color: '#F87171', fontSize: '12px', display: 'block', marginTop: '2px' }}>
                            Les prix négociés en rouge sont inférieurs aux tarifs minimum autorisés. Vérifiez avant de sauvegarder.
                          </span>
                        </div>
                      </div>
                    )}

                    {/* ALERTE SPÉCIALE FICHES DE PAIE */}
                    {alerteFichePaie && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '14px 18px', borderRadius: '14px',
                        background: 'rgba(245,158,11,0.12)',
                        border: '2px solid rgba(245,158,11,0.5)',
                        animation: 'pulseRed 1.5s infinite',
                      }}>
                        <div style={{
                          width: '40px', height: '40px', borderRadius: '50%',
                          background: 'rgba(245,158,11,0.2)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <AlertTriangle size={22} color="#F59E0B" />
                        </div>
                        <div>
                          <span style={{ color: '#F59E0B', fontSize: '15px', fontWeight: '800', display: 'block' }}>
                            💰 Fiches de paie : prix sous le minimum de 50F/employé !
                          </span>
                          <span style={{ color: '#FBBF24', fontSize: '12px', display: 'block', marginTop: '2px' }}>
                            Prix actuel : {formatF(alerteFichePaie.valeur)} F/emp — Minimum requis : {formatF(alerteFichePaie.min)} F/emp
                            <br />Écart : {formatF(alerteFichePaie.ecart)} F/employé en dessous du minimum.
                          </span>
                        </div>
                      </div>
                    )}

                    {/* NIVEAU 1 : MONTANT GLOBAL CONVENU */}
                    <div style={negoStyles.niveauBlock}>
                      <div style={negoStyles.niveauHeader}>
                        <div style={{ ...negoStyles.niveauBadge, background: 'rgba(249,115,22,0.15)', color: '#F97316', borderColor: 'rgba(249,115,22,0.3)' }}>
                          <Lock size={12} /> Niveau 1 — Montant global convenu
                        </div>
                        <span style={negoStyles.niveauDesc}>Priorité maximale — écrase tout</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                        <div style={styles.configField}>
                          <label style={styles.label}>
                            Fixe global (F) {montantConvenu.fixe && <span style={{ color: '#F97316', marginLeft: '6px', fontSize: '10px', fontWeight: '800' }}>✓ ACTIF</span>}
                          </label>
                          <div style={{ position: 'relative' }}>
                            <input type="number" className="nego-input" value={montantConvenu.fixe} onChange={e => setMontantConvenu({ ...montantConvenu, fixe: e.target.value })} style={{ ...styles.configInput, paddingRight: '54px', borderColor: montantConvenu.fixe ? 'rgba(249,115,22,0.5)' : 'rgba(255,255,255,0.08)', background: montantConvenu.fixe ? 'rgba(249,115,22,0.06)' : 'rgba(255,255,255,0.04)' }} placeholder={`Base : ${formatF(totauxTR.totalFixeNet)} F`} />
                            <span style={negoStyles.unitTag}>FCFA</span>
                          </div>
                          {montantConvenu.fixe && <span style={{ ...negoStyles.economieLine, color: parseFloat(montantConvenu.fixe) < totauxTR.totalFixeNet ? '#10B981' : '#EF4444' }}>{parseFloat(montantConvenu.fixe) < totauxTR.totalFixeNet ? `↓ -${formatF(totauxTR.totalFixeNet - parseFloat(montantConvenu.fixe))} F` : `↑ +${formatF(parseFloat(montantConvenu.fixe) - totauxTR.totalFixeNet)} F`}</span>}
                        </div>
                        <div style={styles.configField}>
                          <label style={styles.label}>
                            Mensuel global (F/mois) {montantConvenu.mensuel && <span style={{ color: '#F97316', marginLeft: '6px', fontSize: '10px', fontWeight: '800' }}>✓ ACTIF</span>}
                          </label>
                          <div style={{ position: 'relative' }}>
                            <input type="number" className="nego-input" value={montantConvenu.mensuel} onChange={e => setMontantConvenu({ ...montantConvenu, mensuel: e.target.value })} style={{ ...styles.configInput, paddingRight: '54px', borderColor: montantConvenu.mensuel ? 'rgba(249,115,22,0.5)' : 'rgba(255,255,255,0.08)', background: montantConvenu.mensuel ? 'rgba(249,115,22,0.06)' : 'rgba(255,255,255,0.04)' }} placeholder={`Base : ${formatF(totauxTR.totalMensuelNet)} F`} />
                            <span style={negoStyles.unitTag}>FCFA</span>
                          </div>
                          {montantConvenu.mensuel && <span style={{ ...negoStyles.economieLine, color: parseFloat(montantConvenu.mensuel) < totauxTR.totalMensuelNet ? '#10B981' : '#EF4444' }}>{parseFloat(montantConvenu.mensuel) < totauxTR.totalMensuelNet ? `↓ -${formatF(totauxTR.totalMensuelNet - parseFloat(montantConvenu.mensuel))} F/mois` : `↑ +${formatF(parseFloat(montantConvenu.mensuel) - totauxTR.totalMensuelNet)} F/mois`}</span>}
                        </div>
                      </div>
                      {(montantConvenu.fixe || montantConvenu.mensuel) && (
                        <button onClick={() => setMontantConvenu(MONTANT_CONVENU_INITIAL)} style={negoStyles.clearBtn}><X size={11} /> Effacer</button>
                      )}
                    </div>

                    {/* NIVEAU 2 : TOTAL PAR CATÉGORIE */}
                    <div style={{ ...negoStyles.niveauBlock, borderColor: 'rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.02)' }}>
                      <div style={negoStyles.niveauHeader}>
                        <div style={{ ...negoStyles.niveauBadge, background: 'rgba(99,102,241,0.15)', color: '#6366F1', borderColor: 'rgba(99,102,241,0.3)' }}>
                          <Tag size={12} /> Niveau 2 — Total par catégorie
                        </div>
                        <span style={negoStyles.niveauDesc}>Écrase les lignes si renseigné</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                        <div style={styles.configField}>
                          <label style={styles.label}>
                            Total fixe (F) {estCategorieNegociee('fixe') && !montantConvenu.fixe && <span style={{ color: '#6366F1', marginLeft: '6px', fontSize: '10px', fontWeight: '800' }}>✓ ACTIF</span>}
                          </label>
                          <div style={negoStyles.sousTotalDisplay}>
                            <span style={{ color: '#888', fontSize: '11px' }}>Sous-total lignes :</span>
                            <span style={{ color: '#FFF', fontSize: '13px', fontWeight: '700', fontFamily: 'monospace' }}>{formatF(calculTR.sousTotalFixe)} F</span>
                          </div>
                          <div style={{ position: 'relative' }}>
                            <input type="number" className="cat-input" value={totalCategorie.fixe} onChange={e => setTotalCategorie({ ...totalCategorie, fixe: e.target.value })} style={{ ...styles.configInput, paddingRight: '54px', borderColor: estCategorieNegociee('fixe') ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.08)', background: estCategorieNegociee('fixe') ? 'rgba(99,102,241,0.06)' : 'rgba(255,255,255,0.04)' }} placeholder={`Ex. ${formatF(Math.round(calculTR.sousTotalFixe * 0.9))} F`} />
                            <span style={{ ...negoStyles.unitTag, color: '#6366F1' }}>FCFA</span>
                          </div>
                          {estCategorieNegociee('fixe') && <span style={{ ...negoStyles.economieLine, color: parseFloat(totalCategorie.fixe) < calculTR.sousTotalFixe ? '#10B981' : '#EF4444' }}>{parseFloat(totalCategorie.fixe) < calculTR.sousTotalFixe ? `↓ -${formatF(calculTR.sousTotalFixe - parseFloat(totalCategorie.fixe))} F` : `↑ +${formatF(parseFloat(totalCategorie.fixe) - calculTR.sousTotalFixe)} F`}</span>}
                        </div>
                        <div style={styles.configField}>
                          <label style={styles.label}>
                            Total mensuel (F/mois) {estCategorieNegociee('mensuel') && !montantConvenu.mensuel && <span style={{ color: '#6366F1', marginLeft: '6px', fontSize: '10px', fontWeight: '800' }}>✓ ACTIF</span>}
                          </label>
                          <div style={negoStyles.sousTotalDisplay}>
                            <span style={{ color: '#888', fontSize: '11px' }}>Sous-total lignes :</span>
                            <span style={{ color: '#FFF', fontSize: '13px', fontWeight: '700', fontFamily: 'monospace' }}>{formatF(calculTR.sousTotalMensuel)} F</span>
                          </div>
                          <div style={{ position: 'relative' }}>
                            <input type="number" className="cat-input" value={totalCategorie.mensuel} onChange={e => setTotalCategorie({ ...totalCategorie, mensuel: e.target.value })} style={{ ...styles.configInput, paddingRight: '54px', borderColor: estCategorieNegociee('mensuel') ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.08)', background: estCategorieNegociee('mensuel') ? 'rgba(99,102,241,0.06)' : 'rgba(255,255,255,0.04)' }} placeholder={`Ex. ${formatF(Math.round(calculTR.sousTotalMensuel * 0.9))} F`} />
                            <span style={{ ...negoStyles.unitTag, color: '#6366F1' }}>FCFA</span>
                          </div>
                          {estCategorieNegociee('mensuel') && <span style={{ ...negoStyles.economieLine, color: parseFloat(totalCategorie.mensuel) < calculTR.sousTotalMensuel ? '#10B981' : '#EF4444' }}>{parseFloat(totalCategorie.mensuel) < calculTR.sousTotalMensuel ? `↓ -${formatF(calculTR.sousTotalMensuel - parseFloat(totalCategorie.mensuel))} F` : `↑ +${formatF(parseFloat(totalCategorie.mensuel) - calculTR.sousTotalMensuel)} F`}</span>}
                        </div>
                      </div>
                      {(totalCategorie.fixe || totalCategorie.mensuel) && (
                        <button onClick={() => setTotalCategorie(TOTAL_CATEGORIE_INITIAL)} style={{ ...negoStyles.clearBtn, color: '#6366F1', borderColor: 'rgba(99,102,241,0.2)' }}><X size={11} /> Effacer</button>
                      )}
                    </div>

                    {/* NIVEAU 3 : LIGNE PAR LIGNE */}
                    <div style={{ ...negoStyles.niveauBlock, borderColor: 'rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.01)' }}>
                      <div style={negoStyles.niveauHeader}>
                        <div style={{ ...negoStyles.niveauBadge, background: 'rgba(245,158,11,0.15)', color: '#F59E0B', borderColor: 'rgba(245,158,11,0.3)' }}>
                          <MessageSquare size={12} /> Niveau 3 — Ligne par ligne
                        </div>
                        <span style={negoStyles.niveauDesc}>Négocier le prix unitaire OU le total de la ligne — au choix</span>
                      </div>

                      <div style={{ display: 'flex', gap: '16px', padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#888' }}>
                          <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'rgba(245,158,11,0.3)', border: '1px solid rgba(245,158,11,0.5)' }}></div>
                          <span>Champ <strong style={{ color: '#F59E0B' }}>jaune</strong> = prix unitaire</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#888' }}>
                          <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'rgba(16,185,129,0.3)', border: '1px solid rgba(16,185,129,0.5)' }}></div>
                          <span>Champ <strong style={{ color: '#10B981' }}>vert</strong> = total de la ligne</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#888' }}>
                          <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'rgba(239,68,68,0.4)', border: '1px solid rgba(239,68,68,0.6)' }}></div>
                          <span>Champ <strong style={{ color: '#EF4444' }}>rouge</strong> = sous le minimum !</span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#666' }}>
                          ⚠️ Si les deux sont renseignés, le <strong>total prime</strong>
                        </div>
                      </div>

                      <div>
                        <div style={negoStyles.sectionLabel}>
                          <span>📦 Partie fixe</span>
                          {calculTR.lignesFixe.some(l => estLigneNegociee(l.key)) && (
                            <button onClick={() => calculTR.lignesFixe.forEach(l => clearNegoLigne(l.key))} style={negoStyles.resetLineBtn}><X size={10} /> Reset</button>
                          )}
                        </div>
                        <div style={negoStyles.lignesGrid}>
                          {calculTR.lignesFixe.map(ligne => (
                            <LigneNegoV5
                              key={ligne.key}
                              ligne={ligne}
                              negoData={negoLigne[ligne.key] || { unitaire: '', total: '' }}
                              onChangeUnitaire={val => updateNegoLigne(ligne.key, 'unitaire', val)}
                              onChangeTotal={val => updateNegoLigne(ligne.key, 'total', val)}
                              onClear={() => clearNegoLigne(ligne.key)}
                              disabled={estCategorieNegociee('fixe') || (!!montantConvenu.fixe)}
                              formatF={formatF}
                              alerteMin={getAlerteMinDetail(ligne.key, ligne.qte)}
                            />
                          ))}
                        </div>
                      </div>

                      <div style={{ marginTop: '16px' }}>
                        <div style={negoStyles.sectionLabel}>
                          <span>📅 Abonnement mensuel</span>
                          {calculTR.lignesMensuel.some(l => estLigneNegociee(l.key)) && (
                            <button onClick={() => calculTR.lignesMensuel.forEach(l => clearNegoLigne(l.key))} style={negoStyles.resetLineBtn}><X size={10} /> Reset</button>
                          )}
                        </div>
                        <div style={negoStyles.lignesGrid}>
                          {calculTR.lignesMensuel.filter(l => !l.isGratuit).map(ligne => (
                            <LigneNegoV5
                              key={ligne.key}
                              ligne={ligne}
                              negoData={negoLigne[ligne.key] || { unitaire: '', total: '' }}
                              onChangeUnitaire={val => updateNegoLigne(ligne.key, 'unitaire', val)}
                              onChangeTotal={val => updateNegoLigne(ligne.key, 'total', val)}
                              onClear={() => clearNegoLigne(ligne.key)}
                              disabled={estCategorieNegociee('mensuel') || (!!montantConvenu.mensuel)}
                              formatF={formatF}
                              alerteMin={getAlerteMinDetail(ligne.key, ligne.qte)}
                              isFichePaie={ligne.key === 'fiches_paie'}
                            />
                          ))}
                          {/* Affichage des lignes gratuites (Jours fériés) */}
                          {calculTR.lignesMensuel.filter(l => l.isGratuit).map(ligne => (
                            <div key={ligne.key} style={{
                              ...negoStyles.ligneCard,
                              borderColor: 'rgba(16,185,129,0.3)',
                              background: 'rgba(16,185,129,0.05)',
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: '#10B981', fontSize: '13px', fontWeight: '700' }}>🎌 {ligne.label}</span>
                                <span style={{
                                  background: '#10B981', color: '#FFF',
                                  fontSize: '10px', fontWeight: '800',
                                  padding: '3px 10px', borderRadius: '6px',
                                }}>GRATUIT</span>
                              </div>
                              <div style={{
                                padding: '10px 12px',
                                background: 'rgba(16,185,129,0.1)',
                                borderRadius: '8px',
                                marginTop: '8px',
                              }}>
                                <span style={{ color: '#10B981', fontSize: '12px' }}>
                                  ✓ Inclus sans frais supplémentaires
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* RÉSUMÉ FINAL NÉGOCIATION */}
                    <div style={negoStyles.resumeFinal}>
                      <div style={negoStyles.resumeFinalTitle}>💰 Résumé après négociation</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                        {[
                          { label: `Fixe (${totauxTR.modeFixe})`, value: `${formatF(totauxTR.totalFixeNet)} F`, color: totauxTR.modeFixe === 'convenu' ? '#F97316' : totauxTR.modeFixe === 'categorie' ? '#6366F1' : '#FFF' },
                          { label: `Mensuel (${totauxTR.modeMensuel})`, value: `${formatF(totauxTR.totalMensuelNet)} F`, color: totauxTR.modeMensuel === 'convenu' ? '#F97316' : totauxTR.modeMensuel === 'categorie' ? '#6366F1' : '#6366F1' },
                          { label: `Total (${totauxTR.nbMois}m)`, value: `${formatF(totauxTR.totalAnnuelNet)} F`, color: '#F59E0B' },
                        ].map((item, i) => (
                          <div key={i} style={negoStyles.resumeFinalItem}>
                            <span style={{ color: '#888', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{item.label}</span>
                            <span style={{ color: item.color, fontSize: '16px', fontWeight: '800', fontFamily: 'monospace', marginTop: '4px' }}>{item.value}</span>
                          </div>
                        ))}
                      </div>
                      {paiementFois > 1 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'rgba(99,102,241,0.08)', borderRadius: '10px', border: '1px solid rgba(99,102,241,0.15)' }}>
                          <CreditCard size={14} color="#6366F1" />
                          <span style={{ color: '#6366F1', fontSize: '12px', fontWeight: '700' }}>
                            Paiement en {paiementFois}x : {formatF(totauxTR.echeanceFixe)} F / échéance
                          </span>
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: `${getEngagementConfig(engagement).color}15`, borderRadius: '10px', border: `1px solid ${getEngagementConfig(engagement).color}30` }}>
                        <Calendar size={14} color={getEngagementConfig(engagement).color} />
                        <span style={{ color: getEngagementConfig(engagement).color, fontSize: '12px', fontWeight: '700' }}>
                          {getEngagementConfig(engagement).label} — {getEngagementConfig(engagement).mois} mois
                          {getEngagementConfig(engagement).remise > 0 && ` (remise ${getEngagementConfig(engagement).remise}% incluse)`}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* ═══════════════════════════════════════════════════════════ */}
                {/* ÉTAPE 4 : RÉSULTAT FINAL */}
                {/* ═══════════════════════════════════════════════════════════ */}
                {currentStep === 4 && (
                  <div style={styles.stepContent}>
                    <div style={styles.stepTitleWrap}>
                      <h3 style={styles.stepTitle}>💰 Récapitulatif final</h3>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {selectedProspect && <span style={{ color: '#888', fontSize: '13px' }}>{selectedProspect.company_name}</span>}
                        {moisGratuit && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '8px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: '#10B981', fontSize: '11px', fontWeight: '700' }}>
                            <Gift size={11} /> 1 mois offert
                          </span>
                        )}
                        {paiementFois > 1 && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '8px', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', color: '#6366F1', fontSize: '11px', fontWeight: '700' }}>
                            <CreditCard size={11} /> Paiement en {paiementFois}x
                          </span>
                        )}
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '8px', background: `${getEngagementConfig(engagement).color}15`, border: `1px solid ${getEngagementConfig(engagement).color}40`, color: getEngagementConfig(engagement).color, fontSize: '11px', fontWeight: '700' }}>
                          <Calendar size={11} /> {getEngagementConfig(engagement).label.replace(/[📅🔓]/g, '').trim()}
                        </span>
                      </div>
                    </div>

                    {/* ALERTES MINIMUM */}
                    {nbAlertesMin > 0 && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '14px 18px', borderRadius: '14px',
                        background: 'rgba(239,68,68,0.12)',
                        border: '2px solid rgba(239,68,68,0.5)',
                        animation: 'pulseRed 1.5s infinite',
                      }}>
                        <AlertTriangle size={20} color="#EF4444" />
                        <div>
                          <span style={{ color: '#EF4444', fontSize: '14px', fontWeight: '800' }}>
                            ⚠️ {nbAlertesMin} ligne{nbAlertesMin > 1 ? 's' : ''} sous le minimum En-Check
                          </span>
                          <span style={{ display: 'block', color: '#F87171', fontSize: '11px', marginTop: '2px' }}>
                            Attention : certains prix négociés sont inférieurs aux tarifs plancher.
                          </span>
                        </div>
                      </div>
                    )}

                    {/* ALERTE FICHES DE PAIE */}
                    {alerteFichePaie && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '14px 18px', borderRadius: '14px',
                        background: 'rgba(245,158,11,0.12)',
                        border: '2px solid rgba(245,158,11,0.5)',
                      }}>
                        <AlertTriangle size={20} color="#F59E0B" />
                        <div>
                          <span style={{ color: '#F59E0B', fontSize: '14px', fontWeight: '800' }}>
                            💰 Fiches de paie sous le minimum (50F/emp)
                          </span>
                          <span style={{ display: 'block', color: '#FBBF24', fontSize: '11px', marginTop: '2px' }}>
                            Prix actuel : {formatF(alerteFichePaie.valeur)} F/emp — Écart : {formatF(alerteFichePaie.ecart)} F
                          </span>
                        </div>
                      </div>
                    )}

                    {/* TABLEAU INVESTISSEMENT INITIAL */}
                    <div style={styles.tableSection}>
                      <div style={styles.tableSectionTitle}>📦 Investissement initial</div>
                      <div style={styles.table}>
                        <div style={styles.tableHeader}>
                          <span style={{ flex: 3 }}>Description</span>
                          <span style={{ flex: 1, textAlign: 'right' }}>Unitaire</span>
                          <span style={{ flex: 1, textAlign: 'right' }}>Qté</span>
                          <span style={{ flex: 2, textAlign: 'right' }}>Total ligne</span>
                        </div>
                        {calculTR.lignesFixe.map((ligne, i) => (
                          <div key={i} style={{
                            ...styles.tableRow,
                            background: ligne.sousMinimum
                              ? 'rgba(239,68,68,0.08)'
                              : ligne.negocie
                                ? 'rgba(245,158,11,0.03)'
                                : 'transparent',
                            borderLeft: ligne.sousMinimum ? '3px solid #EF4444' : 'none',
                          }}>
                            <span style={{ flex: 3, color: ligne.sousMinimum ? '#FCA5A5' : '#E5E5E5', fontSize: '13px' }}>
                              {ligne.label}
                              {ligne.sousMinimum && (
                                <span style={{
                                  marginLeft: '6px', fontSize: '9px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px',
                                  background: 'rgba(239,68,68,0.2)', color: '#EF4444', animation: 'pulseRed 1.5s infinite',
                                }}>
                                  🔴 SOUS MINIMUM
                                </span>
                              )}
                              {ligne.negocie && !ligne.sousMinimum && (
                                <span style={{
                                  marginLeft: '6px', fontSize: '9px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px',
                                  background: ligne.modeNego === 'total' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                                  color: ligne.modeNego === 'total' ? '#10B981' : '#F59E0B',
                                }}>
                                  ✏️ {ligne.modeNego === 'total' ? 'total négocié' : 'unitaire négocié'}
                                </span>
                              )}
                            </span>
                            <span style={{ flex: 1, textAlign: 'right', color: ligne.sousMinimum ? '#EF4444' : ligne.negocie ? '#F59E0B' : '#888', fontSize: '12px', fontWeight: ligne.sousMinimum ? '700' : '400' }}>
                              {formatF(ligne.unitaire)} F
                            </span>
                            <span style={{ flex: 1, textAlign: 'right', color: '#888', fontSize: '12px' }}>{ligne.qte}</span>
                            <div style={{ flex: 2, textAlign: 'right' }}>
                              <span style={{ color: ligne.sousMinimum ? '#EF4444' : '#FFF', fontSize: '14px', fontWeight: '700' }}>{formatF(ligne.total)} F</span>
                              {ligne.negocie && ligne.autoTotal !== ligne.total && (
                                <span style={{ display: 'block', color: '#555', fontSize: '10px', textDecoration: 'line-through' }}>
                                  {formatF(ligne.autoTotal)} F
                                </span>
                              )}
                              {ligne.sousMinimum && (
                                <span style={{ display: 'block', color: '#EF4444', fontSize: '10px', fontWeight: '600' }}>
                                  Min: {formatF(getTarifMinUnitaire(ligne.key) * ligne.qte)} F
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                        <div style={{ ...styles.tableTotalRow, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                          <span style={{ flex: 5, color: '#888', fontSize: '12px' }}>Sous-total lignes</span>
                          <span style={{ flex: 2, textAlign: 'right', color: '#888', fontSize: '12px' }}>{formatF(calculTR.sousTotalFixe)} F</span>
                        </div>
                        {totauxTR.modeFixe === 'lignes' && remiseFixe > 0 && (
                          <div style={styles.tableTotalRow}>
                            <span style={{ flex: 5, color: '#10B981' }}>Remise {remiseFixe}%</span>
                            <span style={{ flex: 2, textAlign: 'right', color: '#10B981' }}>-{formatF(Math.round(calculTR.sousTotalFixe * remiseFixe / 100))} F</span>
                          </div>
                        )}
                        {totauxTR.modeFixe === 'categorie' && (
                          <div style={{ ...styles.tableTotalRow, background: 'rgba(99,102,241,0.08)', borderRadius: '8px' }}>
                            <span style={{ flex: 5, color: '#6366F1', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}><Tag size={13} /> Total catégorie négocié</span>
                            <span style={{ flex: 2, textAlign: 'right', color: '#6366F1', fontWeight: '800' }}>{formatF(totauxTR.totalFixeNet)} F</span>
                          </div>
                        )}
                        <div style={{ ...styles.tableTotalRow, background: 'rgba(99,102,241,0.1)', borderRadius: '10px' }}>
                          <span style={{ flex: 5, color: '#FFF', fontWeight: '700', fontSize: '15px' }}>TOTAL FIXE</span>
                          <span style={{ flex: 2, textAlign: 'right', color: '#6366F1', fontWeight: '700', fontSize: '15px' }}>{formatF(totauxTR.totalFixeNet)} F</span>
                        </div>
                        {paiementFois > 1 && (
                          <div style={{ ...styles.tableTotalRow, background: 'rgba(99,102,241,0.06)', borderRadius: '8px', marginTop: '4px' }}>
                            <span style={{ flex: 5, color: '#6366F1', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <CreditCard size={13} /> Paiement en {paiementFois}x
                            </span>
                            <span style={{ flex: 2, textAlign: 'right', color: '#6366F1', fontWeight: '700', fontSize: '13px' }}>
                              {formatF(totauxTR.echeanceFixe)} F / échéance
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* TABLEAU ABONNEMENT MENSUEL */}
                    <div style={styles.tableSection}>
                      <div style={styles.tableSectionTitle}>📅 Abonnement mensuel</div>
                      <div style={styles.table}>
                        <div style={styles.tableHeader}>
                          <span style={{ flex: 3 }}>Description</span>
                          <span style={{ flex: 1, textAlign: 'right' }}>Unitaire</span>
                          <span style={{ flex: 1, textAlign: 'right' }}>Qté</span>
                          <span style={{ flex: 2, textAlign: 'right' }}>Total ligne</span>
                        </div>
                        {calculTR.lignesMensuel.map((ligne, i) => (
                          <div key={i} style={{
                            ...styles.tableRow,
                            background: ligne.isGratuit
                              ? 'rgba(16,185,129,0.06)'
                              : ligne.sousMinimum
                                ? 'rgba(239,68,68,0.08)'
                                : ligne.negocie
                                  ? 'rgba(245,158,11,0.03)'
                                  : 'transparent',
                            borderLeft: ligne.isGratuit
                              ? '3px solid #10B981'
                              : ligne.sousMinimum
                                ? '3px solid #EF4444'
                                : 'none',
                          }}>
                            <span style={{ flex: 3, color: ligne.isGratuit ? '#10B981' : ligne.sousMinimum ? '#FCA5A5' : '#E5E5E5', fontSize: '13px' }}>
                              {ligne.label}
                              {ligne.isGratuit && (
                                <span style={{
                                  marginLeft: '6px', fontSize: '9px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px',
                                  background: 'rgba(16,185,129,0.2)', color: '#10B981',
                                }}>
                                  🎁 GRATUIT
                                </span>
                              )}
                              {ligne.sousMinimum && (
                                <span style={{
                                  marginLeft: '6px', fontSize: '9px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px',
                                  background: 'rgba(239,68,68,0.2)', color: '#EF4444', animation: 'pulseRed 1.5s infinite',
                                }}>
                                  🔴 SOUS MINIMUM
                                </span>
                              )}
                              {ligne.negocie && !ligne.sousMinimum && !ligne.isGratuit && (
                                <span style={{
                                  marginLeft: '6px', fontSize: '9px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px',
                                  background: ligne.modeNego === 'total' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                                  color: ligne.modeNego === 'total' ? '#10B981' : '#F59E0B',
                                }}>
                                  ✏️ {ligne.modeNego === 'total' ? 'total négocié' : 'unitaire négocié'}
                                </span>
                              )}
                            </span>
                            <span style={{ flex: 1, textAlign: 'right', color: ligne.isGratuit ? '#10B981' : ligne.sousMinimum ? '#EF4444' : ligne.negocie ? '#F59E0B' : '#888', fontSize: '12px', fontWeight: ligne.sousMinimum ? '700' : '400' }}>
                              {ligne.isGratuit ? '0 F' : `${formatF(ligne.unitaire)} F`}
                            </span>
                            <span style={{ flex: 1, textAlign: 'right', color: '#888', fontSize: '12px' }}>{ligne.qte}</span>
                            <div style={{ flex: 2, textAlign: 'right' }}>
                              {ligne.isGratuit ? (
                                <span style={{ color: '#10B981', fontSize: '14px', fontWeight: '800' }}>GRATUIT</span>
                              ) : (
                                <>
                                  <span style={{ color: ligne.sousMinimum ? '#EF4444' : '#FFF', fontSize: '14px', fontWeight: '700' }}>{formatF(ligne.total)} F</span>
                                  {ligne.negocie && ligne.autoTotal !== ligne.total && (
                                    <span style={{ display: 'block', color: '#555', fontSize: '10px', textDecoration: 'line-through' }}>
                                      {formatF(ligne.autoTotal)} F
                                    </span>
                                  )}
                                  {ligne.sousMinimum && (
                                    <span style={{ display: 'block', color: '#EF4444', fontSize: '10px', fontWeight: '600' }}>
                                      Min: {formatF(getTarifMinUnitaire(ligne.key) * ligne.qte)} F
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                        <div style={{ ...styles.tableTotalRow, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                          <span style={{ flex: 5, color: '#888', fontSize: '12px' }}>Sous-total lignes</span>
                          <span style={{ flex: 2, textAlign: 'right', color: '#888', fontSize: '12px' }}>{formatF(calculTR.sousTotalMensuel)} F/mois</span>
                        </div>
                        {totauxTR.modeMensuel === 'lignes' && (remiseMensuel > 0 || totauxTR.remiseEngagement > 0) && (
                          <div style={styles.tableTotalRow}>
                            <span style={{ flex: 5, color: '#10B981' }}>
                              Remise {remiseMensuel > 0 ? `${remiseMensuel}%` : ''}
                              {remiseMensuel > 0 && totauxTR.remiseEngagement > 0 ? ' + ' : ''}
                              {totauxTR.remiseEngagement > 0 ? `${totauxTR.remiseEngagement}% engagement` : ''}
                            </span>
                            <span style={{ flex: 2, textAlign: 'right', color: '#10B981' }}>
                              -{formatF(Math.round(calculTR.sousTotalMensuel * (remiseMensuel + totauxTR.remiseEngagement) / 100))} F
                            </span>
                          </div>
                        )}
                        {totauxTR.modeMensuel === 'categorie' && (
                          <div style={{ ...styles.tableTotalRow, background: 'rgba(99,102,241,0.08)', borderRadius: '8px' }}>
                            <span style={{ flex: 5, color: '#6366F1', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}><Tag size={13} /> Total catégorie négocié</span>
                            <span style={{ flex: 2, textAlign: 'right', color: '#6366F1', fontWeight: '800' }}>{formatF(totauxTR.totalMensuelNet)} F/mois</span>
                          </div>
                        )}
                        {moisGratuit && (
                          <div style={{ ...styles.tableTotalRow, background: 'rgba(16,185,129,0.06)', borderRadius: '8px' }}>
                            <span style={{ flex: 5, color: '#10B981', fontWeight: '600' }}>🎁 1 mois offert (× {totauxTR.nbMois} mois)</span>
                            <span style={{ flex: 2, textAlign: 'right', color: '#10B981' }}>-{formatF(totauxTR.totalMensuelNet)} F</span>
                          </div>
                        )}
                        <div style={{ ...styles.tableTotalRow, background: 'rgba(99,102,241,0.1)', borderRadius: '10px' }}>
                          <span style={{ flex: 5, color: '#FFF', fontWeight: '700', fontSize: '15px' }}>TOTAL MENSUEL</span>
                          <span style={{ flex: 2, textAlign: 'right', color: '#6366F1', fontWeight: '700', fontSize: '15px' }}>{formatF(totauxTR.totalMensuelNet)} F/mois</span>
                        </div>
                      </div>
                    </div>

                    {/* BLOC TOTAL ANNUEL/ENGAGEMENT */}
                    <div style={styles.annuelBlock}>
                      <div style={styles.annuelLeft}>
                        <span style={styles.annuelLabel}>📊 {getEngagementConfig(engagement).label.replace(/[📅🔓]/g, '').trim()} sur {totauxTR.nbMois} mois</span>
                        <span style={styles.annuelDesc}>
                          Fixe + Mensuel × {totauxTR.nbMois} mois{moisGratuit && ' — 1 mois offert'}
                          {' · '}{getEngagementConfig(engagement).label}
                          {paiementFois > 1 && ` · 💳 ${paiementFois}x`}
                          {totauxTR.remiseEngagement > 0 && ` · -${totauxTR.remiseEngagement}% engagement`}
                        </span>
                      </div>
                      <span style={styles.annuelValue}>{formatF(totauxTR.totalAnnuelNet)} F</span>
                    </div>
                  </div>
                )}
              </div>

              {/* FOOTER GÉNÉRATEUR */}
              <div style={styles.genFooter}>
                <div>
                  {currentStep > 1 && (
                    <button onClick={() => setCurrentStep(currentStep - 1)} style={styles.prevBtn}>
                      <ChevronLeft size={16} /> Précédent
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {currentStep < 4 && (
                    <button onClick={() => setCurrentStep(currentStep + 1)} style={styles.nextBtn}>
                      Suivant <ChevronRight size={16} />
                    </button>
                  )}
                  {currentStep === 4 && (
                    <>
                      <button
                        onClick={() => {
                          const d = { numero: editingDevis?.numero || '', prospect_id: selectedProspect?.id, mois_gratuit: moisGratuit, paiement_fois: paiementFois, engagement, config, notes: notesDevis, created_at: new Date().toISOString() }
                          setFactureDevisData(d)
                          setFactureCalculData(calculTR)
                          setFactureTotauxData(totauxTR)
                          setFactureDateEmission('')
                          setFactureDateEcheance('')
                          setShowFactureModal(true)
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#10B981', padding: '10px 18px', borderRadius: '10px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
                      >
                        <FileText size={16} /> Facture
                      </button>


                      <button
                        onClick={() => {
                          const saved = loadEcheancierDates()

                          // Créer un objet devis temporaire depuis l'état du générateur
                          const d = {
                            numero: editingDevis?.numero || '',
                            prospect_id: selectedProspect?.id,
                            mois_gratuit: moisGratuit,
                            paiement_fois: paiementFois,
                            engagement,
                            config,
                            notes: notesDevis,
                            created_at: new Date().toISOString(),
                            detail_calcul: { echeancesDates: {} }
                          }

                          setEcheancierDevisData(d)
                          setEcheancierCalculData(calculTR)
                          setEcheancierTotauxData(totauxTR)
                          setEcheancierDateDepart(saved.depart || '')
                          setShowEcheancierModal(true)

                          // Priorité : dates sauvegardées dans le devis > localStorage
                          if (editingDevis?.detail_calcul?.echeancesDates && Object.keys(editingDevis.detail_calcul.echeancesDates).length > 0) {
                            setEcheancesDates(editingDevis.detail_calcul.echeancesDates)
                          } else if (Object.keys(saved.dates || {}).length > 0) {
                            setEcheancesDates(saved.dates)
                          } else {
                            setEcheancesDates({})
                          }
                          setEcheancesStatuts(saved.statuts || {})
                        }}

                        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', color: '#6366F1', padding: '10px 18px', borderRadius: '10px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
                      >
                        <Calendar size={16} /> Échéancier
                      </button>
                      <button onClick={() => handleWhatsApp({ prospect_id: selectedProspect?.id, numero: editingDevis?.numero || 'BROUILLON', mois_gratuit: moisGratuit, paiement_fois: paiementFois, engagement }, totauxTR)} style={styles.whatsappBtn}>
                        <Send size={16} /> WhatsApp
                      </button>
                      <button onClick={handleSaveDevis} style={styles.saveDevisBtn}>
                        <Save size={16} /> {editingDevis ? 'Mettre à jour' : 'Sauvegarder'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}


        {/* ═══════════════════════════════════════════════════════════ */}
        {/* MODAL DATES FACTURE */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {showFactureModal && (
          <div style={styles.overlay} onClick={() => setShowFactureModal(false)}>
            <div style={{
              background: '#0F0F19',
              border: '1px solid rgba(16,185,129,0.2)',
              borderRadius: '20px',
              width: '100%',
              maxWidth: factureSimplifiee ? '600px' : '420px',
              padding: '32px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
              maxHeight: '90vh',
              overflow: 'auto',
            }} onClick={e => e.stopPropagation()}>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={20} color="#10B981" />
                </div>
                <div>
                  <h2 style={{ color: '#FFF', fontSize: '16px', fontWeight: '700', margin: 0 }}>Générer la Facture</h2>
                  <span style={{ color: '#666', fontSize: '12px' }}>
                    {factureSimplifiee ? 'Facture simplifiée — modifiez les lignes' : 'Facture détaillée — complète'}
                  </span>
                </div>
              </div>

              {/* ═══ TOGGLE DÉTAILLÉE / SIMPLIFIÉE ═══ */}
              <div style={{
                display: 'flex', gap: '0', borderRadius: '12px', overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.1)', marginBottom: '20px',
              }}>
                <button
                  onClick={() => setFactureSimplifiee(false)}
                  style={{
                    flex: 1, padding: '12px', border: 'none',
                    background: !factureSimplifiee ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.03)',
                    color: !factureSimplifiee ? '#6366F1' : '#666',
                    fontSize: '13px', fontWeight: !factureSimplifiee ? '700' : '400',
                    cursor: 'pointer', fontFamily: 'inherit',
                    borderRight: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  📋 Détaillée
                </button>
                <button
                  onClick={() => {
                    setFactureSimplifiee(true)
                    // Pré-remplir les lignes si vides
                    if (!factureLignesEdit[0]?.montant) {
                      setFactureLignesEdit(prefilledFactureLignes(factureDevisData, factureTotauxData))
                    }
                  }}
                  style={{
                    flex: 1, padding: '12px', border: 'none',
                    background: factureSimplifiee ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.03)',
                    color: factureSimplifiee ? '#10B981' : '#666',
                    fontSize: '13px', fontWeight: factureSimplifiee ? '700' : '400',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  ⚡ Simplifiée
                </button>
              </div>

              {/* ═══ ÉDITEUR LIGNES (si simplifiée) ═══ */}
              {factureSimplifiee && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ color: '#888', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      ✏️ Lignes de la facture
                    </span>
                    <button
                      onClick={() => setFactureLignesEdit([
                        ...factureLignesEdit,
                        { label: '', montant: '', frequence: 'unique' }
                      ])}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
                        color: '#10B981', padding: '5px 10px', borderRadius: '8px',
                        fontSize: '11px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      <Plus size={12} /> Ajouter
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {factureLignesEdit.map((ligne, i) => (
                      <div key={i} style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 120px 110px 32px',
                        gap: '6px', alignItems: 'center',
                        padding: '8px 10px', borderRadius: '10px',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.06)',
                      }}>
                        {/* Intitulé */}
                        <input
                          type="text"
                          value={ligne.label}
                          onChange={e => {
                            const newLignes = [...factureLignesEdit]
                            newLignes[i] = { ...newLignes[i], label: e.target.value }
                            setFactureLignesEdit(newLignes)
                          }}
                          placeholder="Intitulé de la ligne"
                          style={{
                            padding: '7px 10px', border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '8px', fontSize: '12px', outline: 'none',
                            background: 'rgba(255,255,255,0.04)', color: '#E5E5E5',
                            fontFamily: 'inherit',
                          }}
                        />
                        {/* Montant */}
                        <div style={{ position: 'relative' }}>
                          <input
                            type="number"
                            value={ligne.montant}
                            onChange={e => {
                              const newLignes = [...factureLignesEdit]
                              newLignes[i] = { ...newLignes[i], montant: e.target.value }
                              setFactureLignesEdit(newLignes)
                            }}
                            placeholder="Montant"
                            min="0"
                            style={{
                              padding: '7px 30px 7px 10px', border: '1px solid rgba(255,255,255,0.08)',
                              borderRadius: '8px', fontSize: '12px', outline: 'none',
                              background: 'rgba(255,255,255,0.04)', color: '#F59E0B',
                              fontFamily: 'monospace', fontWeight: '700', width: '100%',
                              boxSizing: 'border-box',
                            }}
                          />
                          <span style={{
                            position: 'absolute', right: '8px', top: '50%',
                            transform: 'translateY(-50%)', color: '#555',
                            fontSize: '9px', fontWeight: '700', pointerEvents: 'none',
                          }}>F</span>
                        </div>
                        {/* Fréquence */}
                        <select
                          value={ligne.frequence}
                          onChange={e => {
                            const newLignes = [...factureLignesEdit]
                            newLignes[i] = { ...newLignes[i], frequence: e.target.value }
                            setFactureLignesEdit(newLignes)
                          }}
                          style={{
                            padding: '7px 8px', border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '8px', fontSize: '11px', outline: 'none',
                            background: 'rgba(255,255,255,0.04)', color: '#888',
                            fontFamily: 'inherit', cursor: 'pointer',
                          }}
                        >
                          <option value="unique">💰 Comptant</option>
                          <option value="mensuel">📅 /mois</option>
                          <option value="an">📅 /an</option>
                        </select>
                        {/* Supprimer */}
                        {factureLignesEdit.length > 1 && (
                          <button
                            onClick={() => {
                              const newLignes = factureLignesEdit.filter((_, j) => j !== i)
                              setFactureLignesEdit(newLignes)
                            }}
                            style={{
                              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                              borderRadius: '8px', padding: '6px', color: '#EF4444',
                              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Résumé rapide */}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    marginTop: '12px', padding: '10px 14px', borderRadius: '10px',
                    background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
                  }}>
                    <span style={{ color: '#888', fontSize: '12px', fontWeight: '600' }}>Total facture</span>
                    <span style={{ color: '#F59E0B', fontSize: '16px', fontWeight: '800', fontFamily: 'monospace' }}>
                      {formatF(factureLignesEdit.reduce((s, l) => s + (parseFloat(l.montant) || 0), 0))} FCFA
                    </span>
                  </div>
                </div>
              )}

              {/* ═══ DATES ═══ */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ color: '#888', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    📅 Date d'émission
                  </label>
                  <input
                    type="date"
                    value={factureDateEmission}
                    onChange={e => {
                      setFactureDateEmission(e.target.value)
                      saveFactureDates(e.target.value, factureDateEcheance)
                    }}
                    style={{
                      padding: '11px 14px', border: '1px solid rgba(16,185,129,0.3)',
                      borderRadius: '10px', fontSize: '14px', outline: 'none',
                      background: 'rgba(16,185,129,0.06)', color: '#E5E5E5',
                      width: '100%', boxSizing: 'border-box', fontFamily: 'inherit',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ color: '#888', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    ⏰ Date d'échéance de paiement
                  </label>
                  <input
                    type="date"
                    value={factureDateEcheance}
                    onChange={e => {
                      setFactureDateEcheance(e.target.value)
                      saveFactureDates(factureDateEmission, e.target.value)
                    }}
                    style={{
                      padding: '11px 14px', border: '1px solid rgba(239,68,68,0.3)',
                      borderRadius: '10px', fontSize: '14px', outline: 'none',
                      background: 'rgba(239,68,68,0.06)', color: '#E5E5E5',
                      width: '100%', boxSizing: 'border-box', fontFamily: 'inherit',
                    }}
                  />
                </div>
                <div style={{
                  padding: '10px 14px', background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px',
                  fontSize: '12px', color: '#666', lineHeight: '1.6',
                }}>
                  💡 Si laissés vides : émission = aujourd'hui, échéance = dans 30 jours
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => { setShowFactureModal(false); setFactureSimplifiee(false) }}
                  style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#E5E5E5', borderRadius: '12px', fontWeight: '600', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Annuler
                </button>
                <button
                  onClick={() => {
                    setShowFactureModal(false)
                    setSignatureDatesData({
                      documentType: factureSimplifiee ? 'facture_simplifiee' : 'facture',
                      devisData: factureDevisData,
                      calculData: factureCalculData,
                      totauxData: factureTotauxData,
                      dateEmission: factureDateEmission,
                      dateEcheance: factureDateEcheance,
                      echeancesStatuts: {},
                      signatureDateEnCheck: '',
                      signatureDateClient: '',
                      applyStamp: false, // ✅ AJOUTER
                      factureLignesEdit: factureSimplifiee ? factureLignesEdit : null,
                    })
                    setShowSignatureDatesModal(true)
                  }}
                  style={{ flex: 2, padding: '12px', background: 'linear-gradient(135deg,#10B981,#059669)', border: 'none', color: '#FFF', borderRadius: '12px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <FileText size={16} /> {factureSimplifiee ? 'Générer la Facture Simplifiée' : 'Générer la Facture'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* MODAL DATE ÉCHÉANCIER */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {showEcheancierModal && (
          <div style={styles.overlay} onClick={() => setShowEcheancierModal(false)}>
            <div style={{
              background: '#0F0F19',
              border: '1px solid rgba(99,102,241,0.2)',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '700px',
              maxHeight: '90vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
            }} onClick={e => e.stopPropagation()}>

              <div style={{ padding: '32px 32px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Calendar size={20} color="#6366F1" />
                  </div>
                  <div>
                    <h2 style={{ color: '#FFF', fontSize: '16px', fontWeight: '700', margin: 0 }}>Générer l'Échéancier</h2>
                    <span style={{ color: '#666', fontSize: '12px' }}>Date de départ & suivi des paiements</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ color: '#888', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    📅 Date de départ de l'échéancier
                  </label>
                  <input
                    type="date"
                    value={echeancierDateDepart}
                    onChange={e => {
                      setEcheancierDateDepart(e.target.value)
                      saveEcheancierDates(e.target.value, echeancesStatuts, echeancesDates)
                    }}
                    style={{
                      padding: '11px 14px',
                      border: '1px solid rgba(99,102,241,0.3)',
                      borderRadius: '10px',
                      fontSize: '14px',
                      outline: 'none',
                      background: 'rgba(99,102,241,0.06)',
                      color: '#E5E5E5',
                      width: '100%',
                      boxSizing: 'border-box',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>
              </div>

              <div style={{ flex: 1, overflow: 'auto', padding: '20px 32px' }}>
                <div style={{ marginBottom: '16px' }}>
                  <h3 style={{ color: '#FFF', fontSize: '14px', fontWeight: '700', marginBottom: '8px' }}>💳 Suivi des paiements</h3>
                  <p style={{ color: '#666', fontSize: '11px', margin: 0, lineHeight: '1.5' }}>
                    Marquez le statut de chaque échéance. Cela apparaîtra visuellement dans l'échéancier PDF généré.
                  </p>
                </div>

                <div style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '14px 16px', borderRadius: '12px',
                  background: echeancesAutoDecalage ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${echeancesAutoDecalage ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.06)'}`,
                  marginBottom: '16px',
                }}>
                  <label style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    flex: 1, cursor: 'pointer',
                  }}>
                    <input
                      type="checkbox"
                      checked={echeancesAutoDecalage}
                      onChange={e => setEcheancesAutoDecalage(e.target.checked)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <div>
                      <span style={{ color: '#FFF', fontSize: '13px', fontWeight: '700', display: 'block' }}>
                        📅 Décalage automatique
                      </span>
                      <span style={{ color: '#666', fontSize: '11px', display: 'block', marginTop: '2px' }}>
                        Modifier une date décale les suivantes
                      </span>
                    </div>
                  </label>
                </div>

                {(() => {
                  // Calculs pour prévisualiser les lignes
                  const devis = echeancierDevisData || {}
                  const fixeNet = echeancierTotauxData?.totalFixeNet || devis.montant_fixe_net || 0



                  const mensuelNet = echeancierTotauxData?.totalMensuelNet || devis.montant_mensuel_net || 0
                  const engConfig = getEngagementConfig(echeancierTotauxData?.engagement || devis.engagement || 'annuel')
                  const nbMois = (devis.mois_gratuit || echeancierTotauxData?.nbMois) ? (echeancierTotauxData?.nbMois || Math.max(engConfig.mois - 1, 1)) : engConfig.mois
                  const nbFois = echeancierTotauxData?.paiementFois || devis.paiement_fois || 1
                  const echeance = nbFois > 1 ? Math.ceil(fixeNet / nbFois) : fixeNet
                  const dateDepart = echeancierDateDepart ? new Date(echeancierDateDepart) : new Date()

                  const lignesPreview = []
                  let numLigne = 1

                  // Investissement initial
                  if (nbFois > 1) {
                    for (let i = 0; i < nbFois; i++) {
                      const montantEch = i < nbFois - 1 ? echeance : fixeNet - echeance * (nbFois - 1)
                      const dateEch = new Date(dateDepart)
                      dateEch.setMonth(dateEch.getMonth() + i)
                      lignesPreview.push({
                        num: numLigne++,
                        date: dateEch.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
                        dateObj: new Date(dateEch), // ← AJOUTER
                        type: `💳 Investissement — Éch. ${i + 1}/${nbFois}`,
                        montant: montantEch,
                        categorie: 'fixe',
                      })
                    }
                  } else {
                    lignesPreview.push({
                      num: numLigne++,
                      date: dateDepart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
                      dateObj: new Date(dateDepart), // ← AJOUTER
                      type: '💳 Investissement initial',
                      montant: fixeNet,
                      categorie: 'fixe',
                    })
                  }

                  // Abonnements
                  for (let m = 0; m < nbMois; m++) {
                    const dateMois = new Date(dateDepart)
                    dateMois.setMonth(dateMois.getMonth() + (nbFois > 1 ? nbFois - 1 : 0) + m + 1)
                    const isMoisOffert = devis.mois_gratuit && m === 0
                    lignesPreview.push({
                      num: numLigne++,
                      date: dateMois.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
                      dateObj: new Date(dateMois), // ← AJOUTER
                      type: `📅 Abonnement mois ${m + 1}${isMoisOffert ? ' 🎁' : ''}`,
                      montant: isMoisOffert ? 0 : mensuelNet,
                      categorie: isMoisOffert ? 'offert' : 'mensuel',
                    })
                  }

                  return (
                    <div style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '12px',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '40px 140px 1fr 100px 100px',
                        gap: '8px',
                        padding: '10px 12px',
                        background: 'rgba(99,102,241,0.1)',
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                        alignItems: 'center',
                      }}>
                        <span style={{ color: '#6366F1', fontSize: '10px', fontWeight: '700', textAlign: 'center' }}>#</span>
                        <span style={{ color: '#6366F1', fontSize: '10px', fontWeight: '700' }}>Date de paiement</span>
                        <span style={{ color: '#6366F1', fontSize: '10px', fontWeight: '700' }}>Description</span>
                        <span style={{ color: '#6366F1', fontSize: '10px', fontWeight: '700', textAlign: 'right' }}>Montant</span>
                        <span style={{ color: '#6366F1', fontSize: '10px', fontWeight: '700', textAlign: 'center' }}>Statut</span>
                      </div>

                      <div style={{ maxHeight: '300px', overflow: 'auto' }}>
                        {lignesPreview.map((ligne, i) => {
                          const statutActuel = echeancesStatuts[ligne.num] || 'attente'
                          const bgColor = ligne.categorie === 'fixe' ? 'rgba(99,102,241,0.04)'
                            : ligne.categorie === 'offert' ? 'rgba(16,185,129,0.04)'
                              : 'transparent'

                          return (
                            <div
                              key={i}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '40px 140px 1fr 100px 100px',
                                gap: '8px',
                                padding: '8px 12px',
                                borderBottom: i < lignesPreview.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                                background: bgColor,
                                alignItems: 'center',
                              }}
                            >
                              <span style={{ color: '#888', fontSize: '12px', textAlign: 'center', fontWeight: '600' }}>{ligne.num}</span>
                              <input
                                type="date"
                                value={echeancesDates[ligne.num] || (() => {
                                  // Convertir la date affichée en YYYY-MM-DD pour le champ input
                                  const dateObj = ligne.dateObj
                                  return dateObj ? dateObj.toISOString().split('T')[0] : ''
                                })()}
                                onChange={e => {
                                  const newDate = e.target.value
                                  if (!newDate) return

                                  setEcheancesDates(prev => {
                                    const updated = { ...prev, [ligne.num]: newDate }

                                    if (echeancesAutoDecalage) {
                                      const dateModifiee = new Date(newDate)

                                      // Date de référence = date modifiée précédemment si elle existe, sinon date originale
                                      const dateRefStr = prev[ligne.num]
                                      const dateRef = dateRefStr ? new Date(dateRefStr) : ligne.dateObj
                                      const joursDiff = Math.round((dateModifiee - dateRef) / (1000 * 60 * 60 * 24))

                                      if (joursDiff !== 0) {
                                        lignesPreview.forEach(ligneRef => {
                                          if (ligneRef.num > ligne.num) {
                                            // Date de base = date déjà modifiée si elle existe, sinon date originale
                                            const dateBaseStr = prev[ligneRef.num]
                                            const dateBase = dateBaseStr
                                              ? new Date(dateBaseStr)
                                              : new Date(ligneRef.dateObj)
                                            dateBase.setDate(dateBase.getDate() + joursDiff)
                                            updated[ligneRef.num] = dateBase.toISOString().split('T')[0]
                                          }
                                        })
                                      }
                                    }

                                    // Sauvegarder automatiquement
                                    setTimeout(() => {
                                      saveEcheancierDates(echeancierDateDepart, echeancesStatuts, updated)
                                    }, 0)

                                    return updated
                                  })
                                }}

                                style={{
                                  padding: '4px 6px',
                                  border: '1px solid rgba(99,102,241,0.3)',
                                  borderRadius: '6px',
                                  background: 'rgba(99,102,241,0.06)',
                                  color: '#E5E5E5',
                                  fontSize: '11px',
                                  fontFamily: 'inherit',
                                  outline: 'none',
                                  width: '100%',
                                  boxSizing: 'border-box',
                                }}
                              />
                              <span style={{
                                color: ligne.categorie === 'fixe' ? '#8B5CF6'
                                  : ligne.categorie === 'offert' ? '#10B981'
                                    : '#E5E5E5',
                                fontSize: '12px',
                                fontWeight: '500',
                              }}>
                                {ligne.type}
                              </span>
                              <span style={{
                                color: ligne.categorie === 'offert' ? '#10B981' : '#FFF',
                                fontSize: '12px',
                                fontWeight: '700',
                                textAlign: 'right',
                                fontFamily: 'monospace',
                              }}>
                                {ligne.categorie === 'offert' ? 'OFFERT' : `${formatF(ligne.montant)} F`}
                              </span>
                              <div style={{ display: 'flex', justifyContent: 'center' }}>
                                <select
                                  value={statutActuel}
                                  onChange={e => {
                                    const newStatuts = { ...echeancesStatuts, [ligne.num]: e.target.value }
                                    setEcheancesStatuts(newStatuts)
                                    saveEcheancierDates(echeancierDateDepart, newStatuts, echeancesDates)
                                  }}
                                  disabled={ligne.categorie === 'offert'}
                                  style={{
                                    padding: '4px 6px',
                                    borderRadius: '6px',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    background: ligne.categorie === 'offert'
                                      ? 'rgba(16,185,129,0.1)'
                                      : statutActuel === 'paye'
                                        ? 'rgba(16,185,129,0.1)'
                                        : statutActuel === 'cours'
                                          ? 'rgba(245,158,11,0.1)'
                                          : 'rgba(239,68,68,0.1)',
                                    color: ligne.categorie === 'offert'
                                      ? '#10B981'
                                      : statutActuel === 'paye'
                                        ? '#10B981'
                                        : statutActuel === 'cours'
                                          ? '#F59E0B'
                                          : '#EF4444',
                                    fontSize: '9px',
                                    fontWeight: '700',
                                    cursor: ligne.categorie === 'offert' ? 'not-allowed' : 'pointer',
                                    fontFamily: 'inherit',
                                    textAlign: 'center',
                                    minWidth: '70px',
                                  }}
                                >
                                  <option value="attente">⏳ Attente</option>
                                  <option value="cours">🔄 En cours</option>
                                  <option value="paye">✅ Payé</option>
                                </select>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}

                <div style={{
                  padding: '12px 14px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '10px',
                  fontSize: '12px',
                  color: '#666',
                  lineHeight: '1.6',
                  marginTop: '16px',
                }}>
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span>💡 <strong>Légende :</strong></span>
                    <span style={{ color: '#EF4444' }}>⏳ Attente</span>
                    <span style={{ color: '#F59E0B' }}>🔄 En cours</span>
                    <span style={{ color: '#10B981' }}>✅ Payé</span>
                  </div>
                  <div style={{ marginTop: '6px', fontSize: '11px' }}>
                    Ces statuts apparaîtront visuellement dans l'échéancier PDF avec des couleurs et des badges.
                  </div>
                </div>
              </div>

              <div style={{ padding: '20px 32px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => {
                    setShowEcheancierModal(false)

                    setEcheancesAutoDecalage(false)
                  }}
                  style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#E5E5E5', borderRadius: '12px', fontWeight: '600', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Annuler
                </button>
                <button
                  onClick={() => {
                    setShowEcheancierModal(false)

                    saveEcheancierDates(echeancierDateDepart, echeancesStatuts, echeancesDates)

                    setSignatureDatesData({
                      documentType: 'echeancier',
                      devisData: echeancierDevisData,
                      calculData: echeancierCalculData,
                      totauxData: echeancierTotauxData,
                      dateEmission: '',
                      dateEcheance: '',
                      dateEcheancierDepart: echeancierDateDepart,
                      echeancesStatuts,
                      echeancesDates,
                      signatureDateEnCheck: '',
                      signatureDateClient: '',
                      applyStamp: false, // ✅ AJOUTER
                    })
                    setShowSignatureDatesModal(true)
                  }}
                  style={{ flex: 2, padding: '12px', background: 'linear-gradient(135deg,#6366F1,#4F46E5)', border: 'none', color: '#FFF', borderRadius: '12px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <Calendar size={16} /> Générer l'Échéancier
                </button>
              </div>
            </div>
          </div>
        )}







        {/* ═══════════════════════════════════════════════════════════ */}
        {/* MODAL SCÉNARIOS DE PROSPECTION TÉLÉPHONIQUE */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {showScenariosModal && (
          <div style={styles.overlay} onClick={() => { setShowScenariosModal(false); setSelectedScenario(null) }}>
            <div style={{ ...styles.scenariosModal, maxWidth: selectedScenario ? '900px' : '700px' }} onClick={e => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ ...styles.modalIcon, background: 'rgba(16,185,129,0.12)' }}>
                    <Phone size={20} color="#10B981" />
                  </div>
                  <div>
                    <h2 style={styles.modalTitle}>
                      {selectedScenario ? `📞 ${selectedScenario.label}` : '📞 Scénarios de Prospection'}
                    </h2>
                    <span style={{ color: '#666', fontSize: '12px' }}>
                      {selectedScenario ? 'Script de prospection téléphonique' : 'Choisissez un secteur d\'activité'}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {selectedScenario && (
                    <button onClick={() => setSelectedScenario(null)} style={{ ...styles.closeBtn, background: 'rgba(99,102,241,0.1)', borderColor: 'rgba(99,102,241,0.2)' }}>
                      <ArrowLeft size={18} color="#6366F1" />
                    </button>
                  )}
                  <button onClick={() => { setShowScenariosModal(false); setSelectedScenario(null) }} style={styles.closeBtn}>
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div style={{ ...styles.modalBody, maxHeight: '70vh', overflow: 'auto' }}>
                {!selectedScenario ? (
                  <>
                    {/* LISTE DES SECTEURS */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                      {SCENARIOS_PROSPECTION.map(scenario => {
                        const IconComponent = scenario.icon
                        return (
                          <div
                            key={scenario.id}
                            className="scenario-card"
                            onClick={() => setSelectedScenario(scenario)}
                            style={{
                              background: 'rgba(20,20,35,0.8)',
                              border: `2px solid ${scenario.color}30`,
                              borderRadius: '16px',
                              padding: '20px',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                              <div style={{
                                width: '44px', height: '44px', borderRadius: '12px',
                                background: `${scenario.color}15`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                <IconComponent size={22} color={scenario.color} />
                              </div>
                              <span style={{ color: '#FFF', fontSize: '15px', fontWeight: '700' }}>{scenario.label}</span>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {scenario.context.slice(0, 2).map((ctx, i) => (
                                <span key={i} style={{
                                  fontSize: '10px', color: '#888',
                                  background: 'rgba(255,255,255,0.05)',
                                  padding: '3px 8px', borderRadius: '4px',
                                }}>
                                  {ctx.length > 30 ? ctx.substring(0, 30) + '...' : ctx}
                                </span>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* OBJECTIONS UNIVERSELLES */}
                    <div style={{
                      background: 'rgba(245,158,11,0.06)',
                      border: '1px solid rgba(245,158,11,0.2)',
                      borderRadius: '16px',
                      padding: '20px',
                    }}>
                      <h3 style={{ color: '#F59E0B', fontSize: '14px', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AlertTriangle size={16} /> Réponses aux objections universelles
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {OBJECTIONS_UNIVERSELLES.map((obj, i) => (
                          <div key={i} style={{
                            background: 'rgba(255,255,255,0.03)',
                            borderRadius: '10px',
                            padding: '12px',
                          }}>
                            <div style={{ color: '#EF4444', fontSize: '12px', fontWeight: '700', marginBottom: '6px' }}>
                              ❌ {obj.objection}
                            </div>
                            <div style={{ color: '#10B981', fontSize: '12px', lineHeight: '1.5' }}>
                              ✓ {obj.reponse}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* DÉTAIL D'UN SCÉNARIO */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                      {/* CONTEXTE */}
                      <div style={{
                        background: `${selectedScenario.color}10`,
                        border: `1px solid ${selectedScenario.color}30`,
                        borderRadius: '14px',
                        padding: '16px',
                      }}>
                        <h4 style={{ color: selectedScenario.color, fontSize: '13px', fontWeight: '700', marginBottom: '10px' }}>
                          📋 Contexte du secteur
                        </h4>
                        <ul style={{ margin: 0, paddingLeft: '20px' }}>
                          {selectedScenario.context.map((ctx, i) => (
                            <li key={i} style={{ color: '#CCC', fontSize: '13px', marginBottom: '4px' }}>{ctx}</li>
                          ))}
                        </ul>
                      </div>

                      {/* BARRIÈRES */}
                      <div style={{
                        background: 'rgba(239,68,68,0.06)',
                        border: '1px solid rgba(239,68,68,0.2)',
                        borderRadius: '14px',
                        padding: '16px',
                      }}>
                        <h4 style={{ color: '#EF4444', fontSize: '13px', fontWeight: '700', marginBottom: '10px' }}>
                          🚧 Barrières classiques & Réponses
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {selectedScenario.barrieres.map((bar, i) => (
                            <div key={i} style={{
                              background: 'rgba(255,255,255,0.03)',
                              borderRadius: '10px',
                              padding: '12px',
                            }}>
                              <div style={{ color: '#F87171', fontSize: '12px', fontWeight: '700', marginBottom: '6px' }}>
                                ❌ {bar.situation}
                              </div>
                              <div style={{ color: '#10B981', fontSize: '12px', lineHeight: '1.5', fontStyle: 'italic' }}>
                                → "{bar.reponse}"
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* ACCROCHE */}
                      <div style={{
                        background: 'rgba(99,102,241,0.08)',
                        border: '1px solid rgba(99,102,241,0.2)',
                        borderRadius: '14px',
                        padding: '16px',
                      }}>
                        <h4 style={{ color: '#6366F1', fontSize: '13px', fontWeight: '700', marginBottom: '10px' }}>
                          🎯 Accroche (quand vous avez le décideur)
                        </h4>
                        <p style={{ color: '#E5E5E5', fontSize: '13px', lineHeight: '1.6', margin: 0, fontStyle: 'italic' }}>
                          "{selectedScenario.accroche}"
                        </p>
                      </div>

                      {/* PITCH */}
                      <div style={{
                        background: 'rgba(16,185,129,0.08)',
                        border: '1px solid rgba(16,185,129,0.2)',
                        borderRadius: '14px',
                        padding: '16px',
                      }}>
                        <h4 style={{ color: '#10B981', fontSize: '13px', fontWeight: '700', marginBottom: '10px' }}>
                          💬 Pitch (si intérêt)
                        </h4>
                        <p style={{ color: '#E5E5E5', fontSize: '13px', lineHeight: '1.6', margin: 0, fontStyle: 'italic' }}>
                          "{selectedScenario.pitch}"
                        </p>

                        {/* Arguments spécifiques */}
                        {(selectedScenario.chiffreImpact || selectedScenario.argumentCle || selectedScenario.argumentConformite || selectedScenario.argumentPratique || selectedScenario.argumentBusiness || selectedScenario.argumentROI) && (
                          <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                            <span style={{ color: '#F59E0B', fontSize: '11px', fontWeight: '700' }}>💡 Argument clé :</span>
                            <p style={{ color: '#FCD34D', fontSize: '12px', margin: '4px 0 0 0', lineHeight: '1.5' }}>
                              "{selectedScenario.chiffreImpact || selectedScenario.argumentCle || selectedScenario.argumentConformite || selectedScenario.argumentPratique || selectedScenario.argumentBusiness || selectedScenario.argumentROI}"
                            </p>
                          </div>
                        )}
                      </div>

                      {/* CLOSE */}
                      <div style={{
                        background: 'rgba(245,158,11,0.08)',
                        border: '1px solid rgba(245,158,11,0.2)',
                        borderRadius: '14px',
                        padding: '16px',
                      }}>
                        <h4 style={{ color: '#F59E0B', fontSize: '13px', fontWeight: '700', marginBottom: '10px' }}>
                          🎁 Close (proposition de RDV)
                        </h4>
                        <p style={{ color: '#E5E5E5', fontSize: '13px', lineHeight: '1.6', margin: 0, fontStyle: 'italic' }}>
                          "{selectedScenario.close}"
                        </p>
                      </div>

                      {/* OBJECTION PRIX */}
                      {selectedScenario.objectionPrix && (
                        <div style={{
                          background: 'rgba(236,72,153,0.08)',
                          border: '1px solid rgba(236,72,153,0.2)',
                          borderRadius: '14px',
                          padding: '16px',
                        }}>
                          <h4 style={{ color: '#EC4899', fontSize: '13px', fontWeight: '700', marginBottom: '10px' }}>
                            💰 Si objection prix
                          </h4>
                          <p style={{ color: '#E5E5E5', fontSize: '13px', lineHeight: '1.6', margin: 0, fontStyle: 'italic' }}>
                            "{selectedScenario.objectionPrix}"
                          </p>
                        </div>
                      )}

                      {/* SCRIPT WHATSAPP DE SUIVI */}
                      <div style={{
                        background: 'rgba(37,211,102,0.08)',
                        border: '1px solid rgba(37,211,102,0.2)',
                        borderRadius: '14px',
                        padding: '16px',
                      }}>
                        <h4 style={{ color: '#25D366', fontSize: '13px', fontWeight: '700', marginBottom: '10px' }}>
                          📱 Message WhatsApp de suivi (après l'appel)
                        </h4>
                        <div style={{
                          background: 'rgba(255,255,255,0.03)',
                          borderRadius: '10px',
                          padding: '14px',
                          fontFamily: 'monospace',
                          fontSize: '11px',
                          color: '#CCC',
                          lineHeight: '1.6',
                          whiteSpace: 'pre-wrap',
                        }}>
                          {`Bonjour M./Mme [Nom],

Suite à notre échange, voici En-Check en 30 secondes :

✅ Pointage mobile (PIN, QR, ou reconnaissance faciale)
✅ Géolocalisation pour vérifier la présence sur site
✅ Calcul automatique des heures sup
✅ Fiches de paie générées en 1 clic
✅ Jours fériés gérés automatiquement (GRATUIT)

📱 Vos employés pointent depuis leur téléphone
📊 Vous suivez tout en temps réel

Voulez-vous une démo de 10 min cette semaine ?

[Votre prénom] - En-Check
📞 +229 XX XX XX XX`}
                        </div>
                        <button
                          onClick={() => {
                            const msg = `Bonjour M./Mme [Nom],\n\nSuite à notre échange, voici En-Check en 30 secondes :\n\n✅ Pointage mobile (PIN, QR, ou reconnaissance faciale)\n✅ Géolocalisation pour vérifier la présence sur site\n✅ Calcul automatique des heures sup\n✅ Fiches de paie générées en 1 clic\n✅ Jours fériés gérés automatiquement (GRATUIT)\n\n📱 Vos employés pointent depuis leur téléphone\n📊 Vous suivez tout en temps réel\n\nVoulez-vous une démo de 10 min cette semaine ?\n\n[Votre prénom] - En-Check`
                            navigator.clipboard.writeText(msg)
                            toast.success('Message copié !')
                          }}
                          style={{
                            marginTop: '10px',
                            display: 'flex', alignItems: 'center', gap: '6px',
                            background: 'rgba(37,211,102,0.15)',
                            border: '1px solid rgba(37,211,102,0.3)',
                            color: '#25D366',
                            padding: '8px 14px', borderRadius: '8px',
                            fontSize: '12px', fontWeight: '700',
                            cursor: 'pointer',
                          }}
                        >
                          📋 Copier le message
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div style={styles.modalFooter}>
                <button onClick={() => { setShowScenariosModal(false); setSelectedScenario(null) }} style={styles.cancelBtn}>
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* MODAL DÉTAIL DEVIS */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {showDetailModal && selectedDevis && (() => {
          const prospect = prospects.find(p => p.id === selectedDevis.prospect_id)
          const engConfigDetail = getEngagementConfig(selectedDevis.engagement || 'annuel')
          const nbMoisDetail = selectedDevis.mois_gratuit ? Math.max(engConfigDetail.mois - 1, 1) : engConfigDetail.mois
          const nbFoisDetail = selectedDevis.paiement_fois || 1
          return (
            <div style={styles.overlay} onClick={() => setShowDetailModal(false)}>
              <div style={styles.detailModal} onClick={e => e.stopPropagation()}>
                <div style={styles.modalHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={styles.modalIcon}><FileText size={20} color="#6366F1" /></div>
                    <div>
                      <h2 style={styles.modalTitle}>{selectedDevis.numero}</h2>
                      <span style={{ color: '#666', fontSize: '12px' }}>{prospect?.company_name || 'Sans prospect'}{selectedDevis.mois_gratuit && ' · 🎁 1 mois offert'}</span>
                    </div>
                  </div>
                  <button onClick={() => setShowDetailModal(false)} style={styles.closeBtn}><X size={20} /></button>
                </div>
                <div style={{ ...styles.modalBody, gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px' }}>
                    {[
                      { label: 'Fixe', value: `${formatF(selectedDevis.montant_fixe_net)} F`, color: '#FFFFFF' },
                      { label: 'Mensuel', value: `${formatF(selectedDevis.montant_mensuel_net)} F/mois`, color: '#6366F1' },
                      { label: `Total (${nbMoisDetail}m)`, value: `${formatF(selectedDevis.montant_annuel_net)} F`, color: '#F59E0B' },
                    ].map((m, i) => (
                      <div key={i} style={styles.detailItem}>
                        <span style={styles.detailLabel}>{m.label}</span>
                        <span style={{ ...styles.detailValue, color: m.color, fontSize: '15px' }}>{m.value}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {selectedDevis.mois_gratuit && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '12px' }}>
                        <Gift size={16} color="#10B981" />
                        <p style={{ color: '#10B981', fontSize: '12px', fontWeight: '700', margin: 0 }}>1 mois offert</p>
                      </div>
                    )}
                    {nbFoisDetail > 1 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '12px' }}>
                        <CreditCard size={16} color="#6366F1" />
                        <p style={{ color: '#6366F1', fontSize: '12px', fontWeight: '700', margin: 0 }}>
                          Paiement en {nbFoisDetail}x — {formatF(Math.ceil(selectedDevis.montant_fixe_net / nbFoisDetail))} F/éch.
                        </p>
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: `${engConfigDetail.color}15`, border: `1px solid ${engConfigDetail.color}30`, borderRadius: '12px' }}>
                      <Calendar size={16} color={engConfigDetail.color} />
                      <p style={{ color: engConfigDetail.color, fontSize: '12px', fontWeight: '700', margin: 0 }}>
                        {engConfigDetail.label}
                      </p>
                    </div>
                  </div>
                  <div style={styles.sectionTitle}>⚙️ Configuration</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: '8px' }}>
                    {[
                      { label: 'Sites', value: selectedDevis.config?.nb_sites },
                      { label: 'Employés', value: selectedDevis.config?.nb_employes },
                      { label: 'Machines', value: selectedDevis.config?.nb_machines },
                      { label: 'Admins', value: selectedDevis.config?.nb_admins },
                      { label: 'Pointage', value: selectedDevis.config?.type_pointage?.toUpperCase() },
                      { label: 'Paiement', value: nbFoisDetail > 1 ? `${nbFoisDetail}x` : 'Comptant' },
                      { label: 'Engagement', value: engConfigDetail.label.replace(/[📅🔓]/g, '').trim() },
                    ].map((item, i) => (
                      <div key={i} style={styles.detailItem}>
                        <span style={styles.detailLabel}>{item.label}</span>
                        <span style={styles.detailValue}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                  {/* Options actives */}
                  {selectedDevis.config?.options && Object.values(selectedDevis.config.options).some(Boolean) && (
                    <>
                      <div style={styles.sectionTitle}>🔌 Options actives</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {Object.entries(selectedDevis.config.options).filter(([, v]) => v).map(([k]) => {
                          const isGratuit = k === 'jours_feries'
                          const isFichePaie = k === 'fiches_paie'
                          return (
                            <span key={k} style={{
                              padding: '4px 10px', borderRadius: '6px',
                              background: isGratuit ? 'rgba(16,185,129,0.1)' : isFichePaie ? 'rgba(245,158,11,0.1)' : 'rgba(99,102,241,0.1)',
                              border: `1px solid ${isGratuit ? 'rgba(16,185,129,0.3)' : isFichePaie ? 'rgba(245,158,11,0.3)' : 'rgba(99,102,241,0.3)'}`,
                              color: isGratuit ? '#10B981' : isFichePaie ? '#F59E0B' : '#6366F1',
                              fontSize: '11px', fontWeight: '600',
                            }}>
                              {k === 'jours_feries' ? '🎌 Jours fériés (GRATUIT)' : k === 'fiches_paie' ? '💰 Fiches de paie' : k.replace(/_/g, ' ')}
                            </span>
                          )
                        })}
                      </div>
                    </>
                  )}
                  {selectedDevis.notes && <><div style={styles.sectionTitle}>📝 Notes</div><div style={styles.notesBox}>{selectedDevis.notes}</div></>}
                </div>
                <div style={styles.modalFooter}>
                  <button onClick={() => { setShowDetailModal(false); handleEdit(selectedDevis) }} style={styles.cancelBtn}><Edit size={14} /> Modifier</button>
                  <button onClick={() => {
                    setShowDetailModal(false)
                    setSignatureDatesData({
                      documentType: 'devis',
                      devisData: selectedDevis,
                      calculData: null,
                      totauxData: null,
                      dateEmission: '',
                      dateEcheance: '',
                      dateEcheancierDepart: '',
                      echeancesStatuts: {},
                      echeancesDates: echeancesDates, // ← AJOUTER
                      signatureDateEnCheck: '',
                      signatureDateClient: '',
                      applyStamp: false, // ✅ AJOUTER
                    })
                    setShowSignatureDatesModal(true)
                  }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', background: 'rgba(236,72,153,0.1)', border: '1px solid rgba(236,72,153,0.25)', color: '#EC4899', borderRadius: '12px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' }}>
                    <Download size={16} /> PDF
                  </button>
                  <button onClick={() => {
                    const saved = loadFactureDates()
                    setFactureDevisData(selectedDevis)  // ← Utiliser 'selectedDevis'
                    setFactureCalculData(null)
                    setFactureTotauxData(null)
                    setFactureDateEmission(saved.emission || '')
                    setFactureDateEcheance(saved.echeance || '')
                    setShowFactureModal(true)
                  }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#10B981', borderRadius: '12px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' }}>
                    <FileText size={16} /> Facture
                  </button>
                  <button onClick={() => {
                    const saved = loadEcheancierDates()

                    setEcheancierDevisData(selectedDevis)  // ← Utiliser selectedDevis
                    setEcheancierCalculData(selectedDevis.detail_calcul || null)
                    setEcheancierTotauxData(selectedDevis.detail_calcul?.totaux || null)
                    setEcheancierDateDepart(saved.depart || '')
                    setShowEcheancierModal(true)

                    // ← Utiliser selectedDevis au lieu de editingDevis
                    if (selectedDevis?.detail_calcul?.echeancesDates && Object.keys(selectedDevis.detail_calcul.echeancesDates).length > 0) {
                      setEcheancesDates(selectedDevis.detail_calcul.echeancesDates)
                    } else if (Object.keys(saved.dates || {}).length > 0) {
                      setEcheancesDates(saved.dates)
                    } else {
                      setEcheancesDates({})
                    }
                    setEcheancesStatuts(saved.statuts || {})
                  }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', color: '#6366F1', borderRadius: '12px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' }}>
                    <Calendar size={16} /> Échéancier
                  </button>
                  <button onClick={() => { setShowDetailModal(false); handleWhatsApp(selectedDevis, null) }} style={styles.saveBtn}><Send size={16} /> WhatsApp</button>
                </div>
              </div>
            </div>
          )
        })()}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* MODAL SUPPRESSION */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {showDeleteModal && devisToDelete && (
          <div style={styles.overlay} onClick={() => setShowDeleteModal(false)}>
            <div style={styles.confirmModal} onClick={e => e.stopPropagation()}>
              <div style={styles.confirmIcon}><AlertTriangle size={28} color="#EF4444" /></div>
              <h3 style={styles.confirmTitle}>Supprimer ce devis ?</h3>
              <p style={styles.confirmText}><strong style={{ color: '#6366F1' }}>{devisToDelete.numero}</strong><br />Cette action est irréversible.</p>
              <div style={styles.confirmBtns}>
                <button onClick={() => setShowDeleteModal(false)} style={styles.cancelBtn}>Annuler</button>
                <button onClick={handleDelete} style={styles.deleteBtn}><Trash2 size={16} /> Supprimer</button>
              </div>
            </div>
          </div>
        )}



        {/* ═══════════════════════════════════════════════════════════ */}
        {/* MODAL 2 - DATES DE SIGNATURE */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {showSignatureDatesModal && (
          <div style={styles.overlay} onClick={() => setShowSignatureDatesModal(false)}>
            <div style={{
              background: '#0F0F19',
              border: '1px solid rgba(99,102,241,0.2)',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '450px',
              padding: '32px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
            }} onClick={e => e.stopPropagation()}>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Calendar size={20} color="#6366F1" />
                </div>
                <div>
                  <h2 style={{ color: '#FFF', fontSize: '16px', fontWeight: '700', margin: 0 }}>Dates de signature</h2>
                  <span style={{ color: '#666', fontSize: '12px' }}>Complétez les signatures</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ color: '#888', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    ✍️ Date signature En-Check
                  </label>
                  <input
                    type="date"
                    value={signatureDatesData.signatureDateEnCheck}
                    onChange={e => setSignatureDatesData({ ...signatureDatesData, signatureDateEnCheck: e.target.value })}
                    style={{
                      padding: '11px 14px',
                      border: '1px solid rgba(99,102,241,0.3)',
                      borderRadius: '10px',
                      fontSize: '14px',
                      outline: 'none',
                      background: 'rgba(99,102,241,0.06)',
                      color: '#E5E5E5',
                      width: '100%',
                      boxSizing: 'border-box',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ color: '#888', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    ✍️ Date signature Client
                  </label>
                  <input
                    type="date"
                    value={signatureDatesData.signatureDateClient}
                    onChange={e => setSignatureDatesData({ ...signatureDatesData, signatureDateClient: e.target.value })}
                    style={{
                      padding: '11px 14px',
                      border: '1px solid rgba(99,102,241,0.3)',
                      borderRadius: '10px',
                      fontSize: '14px',
                      outline: 'none',
                      background: 'rgba(99,102,241,0.06)',
                      color: '#E5E5E5',
                      width: '100%',
                      boxSizing: 'border-box',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>

                <div style={{
                  padding: '12px 14px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '10px',
                  fontSize: '12px',
                  color: '#666',
                  lineHeight: '1.6',
                }}>
                  💡 Vous pouvez laisser vide pour remplir manuellement après impression
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setShowSignatureDatesModal(false)}
                  style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#E5E5E5', borderRadius: '12px', fontWeight: '600', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Annuler
                </button>


                {/* ═══ TAMPOP PAYÉ ═══ */}
<label style={{
  display: 'flex', alignItems: 'center', gap: '12px',
  padding: '14px 16px', borderRadius: '12px',
  background: signatureDatesData.applyStamp ? 'rgba(220,38,38,0.1)' : 'rgba(255,255,255,0.03)',
  border: `2px solid ${signatureDatesData.applyStamp ? 'rgba(220,38,38,0.5)' : 'rgba(255,255,255,0.06)'}`,
  cursor: 'pointer', marginBottom: '16px',
  transition: 'all 0.2s ease',
}}>
  <input
    type="checkbox"
    checked={signatureDatesData.applyStamp || false}
    onChange={e => setSignatureDatesData({ ...signatureDatesData, applyStamp: e.target.checked })}
    style={{ width: '20px', height: '20px', cursor: 'pointer' }}
  />
  <div>
    <span style={{
      color: signatureDatesData.applyStamp ? '#DC2626' : '#888',
      fontSize: '14px', fontWeight: '700', display: 'block',
    }}>
      🔴 Apposer le tampon « PAYÉ »
    </span>
    <span style={{ color: '#666', fontSize: '11px', display: 'block', marginTop: '2px' }}>
      MOYI TECH | RCCM : RB/COT/26 A 117584
    </span>
  </div>
</label>
                <button
                 onClick={() => {
  setShowSignatureDatesModal(false)
  const { documentType, devisData, calculData, totauxData, dateEmission, dateEcheance, dateEcheancierDepart, echeancesStatuts, signatureDateEnCheck, signatureDateClient, applyStamp, factureLignesEdit } = signatureDatesData

  if (documentType === 'facture') {
    saveFactureDates(dateEmission, dateEcheance)
    handleDownloadFacture(devisData, calculData, totauxData, dateEmission, dateEcheance, signatureDateEnCheck, signatureDateClient, applyStamp)
  } else if (documentType === 'facture_simplifiee') {
    saveFactureDates(dateEmission, dateEcheance)
    handleDownloadFactureSimplifiee(devisData, totauxData, dateEmission, dateEcheance, signatureDateEnCheck, signatureDateClient, factureLignesEdit || [], applyStamp)
  } else if (documentType === 'echeancier') {
    saveEcheancierDates(dateEcheancierDepart, echeancesStatuts, signatureDatesData.echeancesDates || {})
    handleDownloadEcheancier(devisData, calculData, totauxData, dateEcheancierDepart, echeancesStatuts, signatureDateEnCheck, signatureDateClient, signatureDatesData.echeancesDates || {}, applyStamp)
  } else if (documentType === 'devis') {
    handleDownloadPDF(devisData, calculData, totauxData, signatureDateEnCheck, signatureDateClient)
  }
}}
                  style={{ flex: 2, padding: '12px', background: 'linear-gradient(135deg,#6366F1,#4F46E5)', border: 'none', color: '#FFF', borderRadius: '12px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <FileText size={16} /> Générer le PDF
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════
// COMPOSANT LIGNE NÉGOCIATION V5
// ═══════════════════════════════════════════════════════════
function LigneNegoV5({ ligne, negoData, onChangeUnitaire, onChangeTotal, onClear, disabled, formatF, alerteMin, isFichePaie = false }) {
  const hasUnitaire = negoData.unitaire && parseFloat(negoData.unitaire) > 0
  const hasTotal = negoData.total && parseFloat(negoData.total) > 0
  const isNego = hasUnitaire || hasTotal
  const modeActif = hasTotal ? 'total' : hasUnitaire ? 'unitaire' : null

  const totalEffectif = hasTotal
    ? parseFloat(negoData.total)
    : hasUnitaire
      ? parseFloat(negoData.unitaire) * ligne.qte
      : ligne.autoTotal

  const sousMin = alerteMin?.sousMin || false
  const unitaireSousMin = alerteMin?.unitaireSousMin || false
  const totalSousMin = alerteMin?.totalSousMin || false

  return (
    <div style={{
      ...negoStyles.ligneCard,
      borderColor: disabled ? 'rgba(255,255,255,0.04)'
        : sousMin ? 'rgba(239,68,68,0.6)'
          : hasTotal ? 'rgba(16,185,129,0.3)'
            : hasUnitaire ? 'rgba(245,158,11,0.3)'
              : 'rgba(255,255,255,0.08)',
      background: disabled ? 'rgba(0,0,0,0.1)'
        : sousMin ? 'rgba(239,68,68,0.06)'
          : hasTotal ? 'rgba(16,185,129,0.03)'
            : hasUnitaire ? 'rgba(245,158,11,0.03)'
              : 'transparent',
      opacity: disabled ? 0.4 : 1,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Badge alerte minimum */}
      {sousMin && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          background: 'linear-gradient(90deg, #EF4444, #DC2626)',
          color: '#FFF', fontSize: '9px', fontWeight: '800',
          padding: '3px 10px', display: 'flex', alignItems: 'center', gap: '4px',
          letterSpacing: '0.5px', textTransform: 'uppercase',
        }}>
          <AlertTriangle size={10} /> {isFichePaie ? 'SOUS 50F/EMP !' : 'PRIX SOUS LE MINIMUM !'}
        </div>
      )}

      {/* Badge fiches de paie */}
      {isFichePaie && !sousMin && (
        <div style={{
          position: 'absolute', top: 0, right: 0,
          background: '#F59E0B',
          color: '#000', fontSize: '8px', fontWeight: '800',
          padding: '2px 8px', borderRadius: '0 0 0 8px',
        }}>
          MIN 50F/EMP
        </div>
      )}

      <div style={{ paddingTop: sousMin ? '20px' : '0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
          <span style={{ color: sousMin ? '#FCA5A5' : '#E5E5E5', fontSize: '12px', fontWeight: '600', lineHeight: '1.3' }}>{ligne.label}</span>
          {isNego && !disabled && (
            <button onClick={onClear} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: '2px', display: 'flex', flexShrink: 0 }}>
              <X size={12} />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
          <span style={{ color: '#666', fontSize: '10px' }}>Base auto</span>
          <div style={{ textAlign: 'right' }}>
            <span style={{ color: '#888', fontSize: '11px' }}>{formatF(ligne.autoUnitaire)} F × {ligne.qte}</span>
            <span style={{ display: 'block', color: '#AAA', fontSize: '12px', fontWeight: '700' }}>= {formatF(ligne.autoTotal)} F</span>
          </div>
        </div>

        {alerteMin?.tarifMin > 0 && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '5px 8px', borderRadius: '6px',
            background: sousMin ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.02)',
            border: `1px solid ${sousMin ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.04)'}`,
          }}>
            <span style={{ color: sousMin ? '#EF4444' : '#555', fontSize: '10px', fontWeight: '600' }}>
              📌 Minimum {isFichePaie ? '(50F/emp)' : ''}
            </span>
            <span style={{ color: sousMin ? '#EF4444' : '#666', fontSize: '11px', fontWeight: '700', fontFamily: 'monospace' }}>
              {formatF(alerteMin.tarifMin)} F/u · {formatF(alerteMin.totalMin)} F total
            </span>
          </div>
        )}

        {isNego && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '6px 8px', borderRadius: '6px',
            background: sousMin ? 'rgba(239,68,68,0.12)' : hasTotal ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
            border: `1px solid ${sousMin ? 'rgba(239,68,68,0.3)' : hasTotal ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`,
          }}>
            <span style={{ color: sousMin ? '#EF4444' : hasTotal ? '#10B981' : '#F59E0B', fontSize: '10px', fontWeight: '600' }}>
              {sousMin ? '⚠️ Total négocié' : hasTotal ? '✓ Total négocié' : '✓ Via unitaire négocié'}
            </span>
            <span style={{
              color: sousMin ? '#EF4444' : hasTotal ? '#10B981' : '#F59E0B',
              fontSize: '13px', fontWeight: '800', fontFamily: 'monospace',
            }}>
              {formatF(totalEffectif)} F {sousMin && '🔴'}
            </span>
          </div>
        )}

        {/* Champ unitaire */}
        <div style={negoStyles.fieldGroup}>
          <label style={{ ...negoStyles.fieldLabel, color: unitaireSousMin ? '#EF4444' : hasUnitaire ? '#F59E0B' : '#666' }}>
            <Hash size={10} /> Prix unitaire
            {unitaireSousMin && (
              <span style={{
                marginLeft: '4px', fontSize: '9px', fontWeight: '800', color: '#EF4444',
                padding: '1px 5px', borderRadius: '3px', background: 'rgba(239,68,68,0.15)'
              }}>
                ↓ -{formatF(alerteMin.ecartUnitaire)} F
              </span>
            )}
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type="number"
              className={`nego-input ${unitaireSousMin ? 'alerte-min-input' : ''}`}
              value={negoData.unitaire}
              onChange={e => onChangeUnitaire(e.target.value)}
              disabled={disabled}
              style={{
                width: '100%', padding: '8px 10px', border: '1px solid',
                borderColor: unitaireSousMin ? 'rgba(239,68,68,0.7)'
                  : hasUnitaire ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.1)',
                borderRadius: '8px', fontSize: '13px',
                background: unitaireSousMin ? 'rgba(239,68,68,0.08)'
                  : hasUnitaire ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.03)',
                color: unitaireSousMin ? '#EF4444' : hasUnitaire ? '#F59E0B' : '#888',
                outline: 'none', fontFamily: 'inherit',
                cursor: disabled ? 'not-allowed' : 'text',
                boxShadow: unitaireSousMin ? '0 0 0 2px rgba(239,68,68,0.25)' : 'none',
              }}
              placeholder={`${formatF(ligne.autoUnitaire)} F`}
              min="0"
            />
          </div>
          {unitaireSousMin && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '3px 8px', borderRadius: '4px',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            }}>
              <AlertTriangle size={10} color="#EF4444" />
              <span style={{ color: '#EF4444', fontSize: '10px', fontWeight: '700' }}>
                Min. {formatF(alerteMin.tarifMin)} F/unité
              </span>
            </div>
          )}
          {hasUnitaire && !unitaireSousMin && (
            <span style={{ fontSize: '10px', color: '#888' }}>
              → Total : {formatF(parseFloat(negoData.unitaire) * ligne.qte)} F
              {parseFloat(negoData.unitaire) * ligne.qte < ligne.autoTotal
                ? <span style={{ color: '#10B981' }}> (↓ -{formatF(ligne.autoTotal - parseFloat(negoData.unitaire) * ligne.qte)} F)</span>
                : <span style={{ color: '#EF4444' }}> (↑ +{formatF(parseFloat(negoData.unitaire) * ligne.qte - ligne.autoTotal)} F)</span>
              }
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }}></div>
          <span style={{ color: '#444', fontSize: '10px', fontWeight: '600' }}>OU</span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }}></div>
        </div>

        {/* Champ total */}
        <div style={negoStyles.fieldGroup}>
          <label style={{ ...negoStyles.fieldLabel, color: totalSousMin ? '#EF4444' : hasTotal ? '#10B981' : '#666' }}>
            <Tag size={10} /> Total de la ligne — prioritaire
            {totalSousMin && (
              <span style={{
                marginLeft: '4px', fontSize: '9px', fontWeight: '800', color: '#EF4444',
                padding: '1px 5px', borderRadius: '3px', background: 'rgba(239,68,68,0.15)'
              }}>
                ↓ -{formatF(alerteMin.ecartTotal)} F
              </span>
            )}
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type="number"
              className={`nego-total-input ${totalSousMin ? 'alerte-min-input' : ''}`}
              value={negoData.total}
              onChange={e => onChangeTotal(e.target.value)}
              disabled={disabled}
              style={{
                width: '100%', padding: '8px 10px', border: '1px solid',
                borderColor: totalSousMin ? 'rgba(239,68,68,0.7)'
                  : hasTotal ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.1)',
                borderRadius: '8px', fontSize: '13px', fontWeight: hasTotal ? '700' : '400',
                background: totalSousMin ? 'rgba(239,68,68,0.08)'
                  : hasTotal ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.03)',
                color: totalSousMin ? '#EF4444' : hasTotal ? '#10B981' : '#888',
                outline: 'none', fontFamily: 'inherit',
                cursor: disabled ? 'not-allowed' : 'text',
                boxShadow: totalSousMin ? '0 0 0 2px rgba(239,68,68,0.25)' : 'none',
              }}
              placeholder={`${formatF(ligne.autoTotal)} F`}
              min="0"
            />
          </div>
          {totalSousMin && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '3px 8px', borderRadius: '4px',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            }}>
              <AlertTriangle size={10} color="#EF4444" />
              <span style={{ color: '#EF4444', fontSize: '10px', fontWeight: '700' }}>
                Min. {formatF(alerteMin.totalMin)} F ({ligne.qte} × {formatF(alerteMin.tarifMin)} F)
              </span>
            </div>
          )}
          {hasTotal && !totalSousMin && (
            <span style={{ fontSize: '10px' }}>
              {parseFloat(negoData.total) < ligne.autoTotal
                ? <span style={{ color: '#10B981' }}>↓ -{formatF(ligne.autoTotal - parseFloat(negoData.total))} F vs base</span>
                : <span style={{ color: '#EF4444' }}>↑ +{formatF(parseFloat(negoData.total) - ligne.autoTotal)} F vs base</span>
              }
            </span>
          )}
          {hasTotal && alerteMin?.unitaireImplicite !== null && alerteMin.unitaireImplicite < alerteMin.tarifMin && !totalSousMin && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '3px 8px', borderRadius: '4px',
              background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)',
            }}>
              <AlertTriangle size={10} color="#F59E0B" />
              <span style={{ color: '#F59E0B', fontSize: '10px', fontWeight: '600' }}>
                Unitaire implicite ({formatF(alerteMin.unitaireImplicite)} F) sous le min ({formatF(alerteMin.tarifMin)} F)
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// STYLES NÉGOCIATION
// ═══════════════════════════════════════════════════════════
const negoStyles = {
  niveauBlock: {
    background: 'rgba(249,115,22,0.03)',
    border: '1px solid rgba(249,115,22,0.15)',
    borderRadius: '16px', padding: '16px',
    display: 'flex', flexDirection: 'column', gap: '12px',
  },
  niveauHeader: {
    display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
  },
  niveauBadge: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '5px 12px', borderRadius: '8px',
    fontSize: '12px', fontWeight: '700', border: '1px solid',
  },
  niveauDesc: { color: '#666', fontSize: '12px' },
  unitTag: {
    position: 'absolute', right: '12px', top: '50%',
    transform: 'translateY(-50%)',
    color: '#F97316', fontSize: '11px', fontWeight: '700', pointerEvents: 'none',
  },
  economieLine: {
    fontSize: '11px', fontWeight: '600', marginTop: '2px', paddingLeft: '2px',
  },
  clearBtn: {
    display: 'flex', alignItems: 'center', gap: '6px',
    background: 'none', border: '1px solid rgba(239,68,68,0.2)',
    color: '#EF4444', padding: '6px 12px', borderRadius: '8px',
    fontSize: '11px', fontWeight: '600', cursor: 'pointer',
    fontFamily: 'inherit', alignSelf: 'flex-start',
  },
  sousTotalDisplay: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '8px', marginBottom: '6px',
  },
  sectionLabel: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    color: '#888', fontSize: '11px', fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: '1px',
    paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.04)',
    marginBottom: '10px',
  },
  resetLineBtn: {
    display: 'flex', alignItems: 'center', gap: '4px',
    background: 'none', border: 'none', color: '#EF4444',
    fontSize: '10px', fontWeight: '600', cursor: 'pointer',
    fontFamily: 'inherit', padding: '2px 6px',
  },
  lignesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: '10px',
  },
  ligneCard: {
    borderRadius: '12px', border: '1px solid',
    padding: '12px', display: 'flex',
    flexDirection: 'column', gap: '8px',
    transition: 'all 0.2s ease',
  },
  fieldGroup: {
    display: 'flex', flexDirection: 'column', gap: '4px',
  },
  fieldLabel: {
    fontSize: '10px', fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: '0.5px',
    display: 'flex', alignItems: 'center', gap: '4px',
  },
  resumeFinal: {
    background: 'rgba(99,102,241,0.06)',
    border: '1px solid rgba(99,102,241,0.15)',
    borderRadius: '14px', padding: '16px',
    display: 'flex', flexDirection: 'column', gap: '12px',
  },
  resumeFinalTitle: { color: '#FFF', fontSize: '14px', fontWeight: '700' },
  resumeFinalItem: {
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '10px', padding: '12px',
    display: 'flex', flexDirection: 'column',
  },
}

// ═══════════════════════════════════════════════════════════
// STYLES PRINCIPAUX
// ═══════════════════════
const styles = {
  container: { minHeight: '100vh', background: '#0A0A0F', position: 'relative', overflow: 'hidden' },
  bgPattern: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: `radial-gradient(circle at 20% 30%, rgba(99,102,241,0.04) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(16,185,129,0.03) 0%, transparent 50%)`, pointerEvents: 'none', zIndex: 0 },
  loadingContainer: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px', background: '#0A0A0F' },
  loadingText: { color: '#888', fontSize: '16px', letterSpacing: '2px' },
  header: { background: 'rgba(15,15,25,0.95)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(99,102,241,0.15)', position: 'sticky', top: 0, zIndex: 100 },
  headerInner: { maxWidth: '1400px', margin: '0 auto', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
  backBtn: { background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '10px', padding: '8px', color: '#6366F1', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  logoMark: { width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#FFFFFF', fontSize: '18px', fontWeight: '700', letterSpacing: '3px', margin: 0 },
  headerSub: { color: '#6366F1', fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: '500' },
  // NOUVEAU BOUTON SCÉNARIOS
  scenariosBtn: { display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#F59E0B', padding: '9px 16px', borderRadius: '10px', fontWeight: '600', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' },
  secondaryBtn: { display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#10B981', padding: '9px 16px', borderRadius: '10px', fontWeight: '600', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' },
  addBtn: { display: 'flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(135deg,#6366F1,#4F46E5)', color: '#FFF', padding: '10px 20px', borderRadius: '12px', border: 'none', fontWeight: '700', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' },
  main: { padding: '20px', maxWidth: '1400px', margin: '0 auto', position: 'relative', zIndex: 1 },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,180px),1fr))', gap: '12px', marginBottom: '24px' },
  statCard: { background: 'rgba(20,20,35,0.8)', borderRadius: '14px', border: '1px solid', padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' },
  statNumber: { fontSize: '26px', fontWeight: '700', lineHeight: '1' },
  statLabel: { color: '#888', fontSize: '12px' },
  toolbar: { display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' },
  searchBox: { flex: '1 1 280px', display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(20,20,35,0.8)', border: '1px solid rgba(255,255,255,0.06)', padding: '10px 14px', borderRadius: '12px' },
  searchInput: { flex: 1, border: 'none', outline: 'none', background: 'transparent', color: '#E5E5E5', fontSize: '14px', fontFamily: 'inherit' },
  clearBtn: { background: 'none', border: 'none', color: '#666', cursor: 'pointer', display: 'flex', alignItems: 'center', fontFamily: 'inherit' },
  resultCount: { color: '#666', fontSize: '13px' },
  list: { display: 'flex', flexDirection: 'column', gap: '10px' },
  empty: { textAlign: 'center', padding: '60px 20px', background: 'rgba(20,20,35,0.6)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.06)' },
  emptyIcon: { width: '80px', height: '80px', borderRadius: '20px', background: 'rgba(99,102,241,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' },
  emptyTitle: { color: '#FFFFFF', fontSize: '18px', fontWeight: '600', margin: '0 0 8px' },
  emptySubtitle: { color: '#666', fontSize: '14px', margin: '0 0 24px' },
  emptyBtn: { display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(135deg,#6366F1,#4F46E5)', color: '#FFF', padding: '12px 24px', borderRadius: '12px', border: 'none', fontWeight: '700', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' },
  devisCard: { background: 'rgba(20,20,35,0.7)', backdropFilter: 'blur(10px)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '12px' },
  devisCardTop: { display: 'flex', gap: '16px', justifyContent: 'space-between', alignItems: 'flex-start' },
  devisInfo: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '8px' },
  devisTitleRow: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  devisNumero: { color: '#FFFFFF', fontSize: '16px', fontWeight: '700' },
  statutDevisBadge: { display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' },
  devisProspect: { display: 'flex', alignItems: 'center', gap: '6px', color: '#888', fontSize: '13px' },
  devisMontants: { display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', padding: '10px 14px' },
  montantBlock: { display: 'flex', flexDirection: 'column', gap: '2px' },
  montantLabel: { color: '#666', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  montantValue: { color: '#FFFFFF', fontSize: '15px', fontWeight: '700', fontFamily: 'monospace' },
  montantSep: { color: '#333', fontSize: '20px' },
  devisDate: { display: 'flex', alignItems: 'center', gap: '5px', color: '#555', fontSize: '11px' },
  devisActions: { display: 'flex', gap: '6px', flexShrink: 0, flexDirection: 'column' },
  actionBtn: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' },
  devisStatusRow: { display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.04)', flexWrap: 'wrap' },
  statusRowLabel: { color: '#555', fontSize: '11px', fontWeight: '600' },
  statusChip: { padding: '4px 10px', borderRadius: '8px', border: '1px solid', cursor: 'pointer', fontSize: '11px', transition: 'all 0.2s ease', background: 'transparent', fontFamily: 'inherit' },

  // GÉNÉRATEUR
  generatorOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 1000, animation: 'fadeIn 0.2s ease' },
  generatorPanel: { background: '#0F0F19', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '24px', width: '100%', maxWidth: '800px', maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 80px rgba(0,0,0,0.7)' },
  genHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 },
  genIcon: { width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  genTitle: { color: '#FFFFFF', fontSize: '18px', fontWeight: '700', margin: 0 },
  genSub: { color: '#6366F1', fontSize: '12px', marginTop: '2px', display: 'block' },
  stepsBar: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '14px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, flexWrap: 'wrap' },
  stepCircle: { width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '700', border: '1px solid', flexShrink: 0 },
  stepLabel: { fontSize: '12px', fontWeight: '600' },
  genBody: { flex: 1, overflow: 'auto' },
  stepContent: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' },
  stepTitleWrap: { display: 'flex', flexDirection: 'column', gap: '6px' },
  stepTitle: { color: '#FFFFFF', fontSize: '16px', fontWeight: '700', margin: 0 },
  stepDesc: { color: '#888', fontSize: '13px', margin: 0, lineHeight: '1.5' },

  // SCORING
  critereBlock: { display: 'flex', flexDirection: 'column', gap: '8px' },
  critereTitle: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '700', color: '#E5E5E5' },
  critereTitleText: { flex: 1 },
  critereChoisi: { padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: '800' },
  resetCritere: { background: 'none', border: 'none', color: '#555', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px', fontFamily: 'inherit' },
  critereOptions: { display: 'flex', flexDirection: 'column', gap: '6px' },
  scoringOption: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)', transition: 'all 0.2s ease' },
  scoringOptionLeft: { display: 'flex', alignItems: 'center', gap: '10px' },
  scoringRadio: { width: '14px', height: '14px', borderRadius: '50%', border: '2px solid', flexShrink: 0 },
  scoringOptionLabel: { display: 'block', fontSize: '13px', fontWeight: '500' },
  scoringOptionDesc: { display: 'block', color: '#555', fontSize: '11px', marginTop: '1px' },
  scoringNiveauTag: { padding: '3px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: '800', flexShrink: 0 },
  scoringResult: { background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '14px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' },
  scoringResultTop: { display: 'flex', alignItems: 'center', gap: '12px' },
  scoringResultBottom: { display: 'flex', alignItems: 'center', gap: '12px' },
  scoringResultLabel: { color: '#888', fontSize: '13px', fontWeight: '600' },
  scoringResultValue: { fontSize: '18px', fontWeight: '800' },
  niveauBtns: { display: 'flex', gap: '8px' },
  niveauBtn: { padding: '8px 20px', borderRadius: '10px', border: '2px solid', fontSize: '13px', fontWeight: '800', cursor: 'pointer', letterSpacing: '1px', transition: 'all 0.2s ease', fontFamily: 'inherit' },

  // CONFIGURATION
  configSection: { display: 'flex', flexDirection: 'column', gap: '10px' },
  configSectionTitle: { display: 'flex', alignItems: 'center', gap: '6px', color: '#888', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', paddingBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.04)' },
  configGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: '10px' },
  configField: { display: 'flex', flexDirection: 'column', gap: '5px' },
  configInput: { padding: '10px 12px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', color: '#E5E5E5', fontFamily: 'inherit' },
  pointageOption: { flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', padding: '14px 16px', borderRadius: '12px', border: '2px solid', transition: 'all 0.2s ease' },
  optionsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: '8px' },
  optionToggle: { display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', borderRadius: '10px', border: '1px solid', transition: 'all 0.2s ease' },
  optionToggleLeft: { display: 'flex', alignItems: 'center', gap: '10px' },
  optionCheckbox: { width: '20px', height: '20px', borderRadius: '6px', border: '2px solid', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  optionLabel: { display: 'block', fontSize: '13px', fontWeight: '600' },
  optionTarif: { display: 'block', color: '#6366F1', fontSize: '11px', marginTop: '1px' },

  // PREVIEW BAR
  previewBar: { display: 'flex', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '14px', padding: '14px 20px', justifyContent: 'space-around', flexWrap: 'wrap', gap: '10px' },
  previewItem: { display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center' },
  previewLabel: { color: '#666', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  previewValue: { color: '#FFFFFF', fontSize: '16px', fontWeight: '700', fontFamily: 'monospace' },
  previewSep: { width: '1px', background: 'rgba(255,255,255,0.06)', alignSelf: 'stretch' },

  // TABLEAU RÉCAP
  tableSection: { display: 'flex', flexDirection: 'column', gap: '8px' },
  tableSectionTitle: { color: '#888', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '8px' },
  table: { background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)', overflow: 'hidden' },
  tableHeader: { display: 'flex', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', color: '#666', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid rgba(255,255,255,0.04)' },
  tableRow: { display: 'flex', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.03)', alignItems: 'center' },
  tableTotalRow: { display: 'flex', padding: '10px 14px', alignItems: 'center' },
  annuelBlock: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '14px', padding: '16px 20px' },
  annuelLeft: { display: 'flex', flexDirection: 'column', gap: '4px' },
  annuelLabel: { color: '#FFFFFF', fontSize: '15px', fontWeight: '700' },
  annuelDesc: { color: '#888', fontSize: '12px' },
  annuelValue: { color: '#F59E0B', fontSize: '22px', fontWeight: '800', fontFamily: 'monospace' },

  // FOOTER GÉNÉRATEUR
  genFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 },
  prevBtn: { display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#E5E5E5', padding: '10px 18px', borderRadius: '10px', fontWeight: '600', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' },
  nextBtn: { display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg,#6366F1,#4F46E5)', color: '#FFF', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' },
  whatsappBtn: { display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(37,211,102,0.15)', border: '1px solid rgba(37,211,102,0.3)', color: '#25D366', padding: '10px 18px', borderRadius: '10px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' },
  saveDevisBtn: { display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg,#6366F1,#4F46E5)', color: '#FFF', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' },

  // MODALS
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 1000, animation: 'fadeIn 0.2s ease' },
  scenariosModal: { background: '#0F0F19', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '24px', width: '100%', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 80px rgba(0,0,0,0.6)' },
  detailModal: { background: '#0F0F19', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '24px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 80px rgba(0,0,0,0.6)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 },
  modalIcon: { width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modalTitle: { color: '#FFFFFF', fontSize: '18px', fontWeight: '700', margin: 0 },
  modalBody: { padding: '24px', overflow: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 },
  closeBtn: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '8px', color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' },

  // FORMULAIRE
  formField: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { color: '#888', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' },
  select: { padding: '11px 14px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', fontSize: '14px', outline: 'none', background: 'rgba(255,255,255,0.04)', color: '#E5E5E5', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', cursor: 'pointer' },

  // BOUTONS
  cancelBtn: { display: 'flex', alignItems: 'center', gap: '6px', padding: '12px 20px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#E5E5E5', borderRadius: '12px', fontWeight: '600', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' },
  saveBtn: { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: 'linear-gradient(135deg,#6366F1,#4F46E5)', color: '#FFF', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' },
  deleteBtn: { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: 'linear-gradient(135deg,#EF4444,#B91C1C)', color: '#FFF', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' },

  // MODAL CONFIRMATION
  confirmModal: { background: '#141423', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px', width: '100%', maxWidth: '420px', padding: '36px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' },
  confirmIcon: { width: '64px', height: '64px', borderRadius: '18px', background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' },
  confirmTitle: { color: '#FFFFFF', fontSize: '20px', fontWeight: '700', marginBottom: '12px' },
  confirmText: { color: '#888', marginBottom: '28px', lineHeight: '1.6', fontSize: '14px' },
  confirmBtns: { display: 'flex', gap: '12px' },

  // DÉTAIL DEVIS
  sectionTitle: { color: '#888', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.04)' },
  detailItem: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' },
  detailLabel: { color: '#666', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  detailValue: { color: '#FFFFFF', fontSize: '14px', fontWeight: '600' },
  notesBox: { padding: '14px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', color: '#888', fontSize: '13px', lineHeight: '1.6' },
}