// Les sections du rail de gauche (SidebarUnique), une seule fois pour toutes
// les pages de la coque admin. Née le 08/11 quand la fiche employé a demandé
// « la sidebar et le rail exactement comme la page employée » : copier le
// tableau de `Employes.jsx` aurait fait deux listes à entretenir — le rail
// de la fiche aurait dérivé du premier bouton oublié. Les deux pages lisent
// donc LA même fabrique ; « exactement comme » veut dire pareil pour toujours,
// pas pareil aujourd'hui.
//
// `moduleActif(champ)` : renvoyé par la page appelante — l'annuaire le calcule
// sur son `entrepriseActive`, la fiche sur l'entreprise de l'employé ouvert.
import {
  Bell,
  Building2,
  Calendar,
  CalendarDays,
  CalendarOff,
  Clock,
  Coffee,
  Cpu,
  FileText,
  LayoutDashboard,
  MapPin,
  Megaphone,
  Router,
  ScanFace,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  Timer,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'

export function sectionsNavAdmin({ admin, moduleActif }) {
  return [
    {
      id: 'accueil',
      label: 'Accueil',
      icon: LayoutDashboard,
      items: [
        { label: 'Vue d’ensemble', icon: LayoutDashboard, path: '/dashboard', show: true },
      ],
    },
    {
      id: 'equipe',
      label: 'Équipe',
      icon: Users,
      items: [
        { label: 'Employés', icon: Users, path: '/employes', show: true },
        { label: 'Planning', icon: Calendar, path: '/planning', show: moduleActif('module_planning') },
        { label: 'Absences', icon: CalendarOff, path: '/absences', show: moduleActif('module_conges') },
        { label: 'Annonces d’accueil', icon: Megaphone, path: '/annonces-accueil', show: admin?.role === 'super_admin' },
      ],
    },
    {
      id: 'temps',
      label: 'Temps de travail',
      icon: Clock,
      items: [
        { label: 'Pointages', icon: Clock, path: '/pointages', show: true },
        { label: 'Retards', icon: Timer, path: '/retards', show: moduleActif('module_retards') },
        { label: 'Pauses', icon: Coffee, path: '/pauses', show: true },
        { label: 'Jours fériés', icon: CalendarDays, path: '/jours-feries', show: true },
      ],
    },
    {
      id: 'paie',
      label: 'Paie',
      icon: Wallet,
      items: [
        { label: 'Heures supplémentaires', icon: Timer, path: '/heures-supplementaires', show: moduleActif('module_heures_supplementaires') },
        { label: 'Rémunérations', icon: Wallet, path: '/remunerations', show: moduleActif('module_remunerations') },
        { label: 'Paie & fiscalité', icon: Shield, path: '/paie', show: moduleActif('module_fiches_paie') || moduleActif('module_config_fiscale') },
      ],
    },
    {
      id: 'rapports',
      label: 'Rapports',
      icon: FileText,
      items: [
        { label: 'Rapports', icon: FileText, path: '/rapports', show: true },
        { label: 'Prédictions', icon: Sparkles, path: '/predictions', show: moduleActif('module_predictions') },
      ],
    },
    {
      id: 'reglages',
      label: 'Réglages',
      icon: Settings,
      items: [
        { label: 'Configuration pointeuse', icon: Router, path: '/configuration-pointeuse', show: moduleActif('module_pointeuses') || moduleActif('module_poste_pointage') },
        { label: 'Géopointage', icon: MapPin, path: '/geopointage', show: moduleActif('module_carte_temps_reel') || moduleActif('module_geolocalisation') },
        { label: 'Reconnaissance faciale', icon: ScanFace, path: '/reconnaissance-faciale', show: moduleActif('module_reconnaissance_faciale') },
      ],
    },
    // L'intérieur de la maison ne s'ouvre qu'au super admin.
    ...(admin?.role === 'super_admin' ? [{
      id: 'interne',
      label: 'En-Check interne',
      icon: Cpu,
      items: [
        { label: 'Entreprises', icon: Building2, path: '/entreprises', show: true },
        { label: 'Administrateurs', icon: ShieldCheck, path: '/admins', show: true },
        { label: 'Messages système', icon: Bell, path: '/system-messages', show: true },
        { label: 'Prospection', icon: TrendingUp, path: '/prospection', show: true },
        { label: 'Analytics du site', icon: TrendingUp, path: '/analytics', show: true },
      ],
    }] : []),
  ]
}
