// ═══════════════════════════════════════════════════════════
// 🎨 CONFIGURATION DES ANIMATIONS PAR ONGLET
// ═══════════════════════════════════════════════════════════

import {
  Users,
  Clock,
  CalendarOff,
  ClipboardList,
  MapPin,
  AlertTriangle,
  Timer,
  Wallet,
  Calendar,
  Sparkles,
  CalendarDays
} from 'lucide-react'

// ═══ CONFIGURATION DES ONGLETS ═══
export const TABS_CONFIG = {
  EMPLOYES: {
    key: 'EMPLOYES',
    path: '/employes',
    label: 'Employés',
    color: '#10B981',
    icon: Users,
    triggers: {
      new_employees: {
        label: 'Nouveaux employés',
        priority: 'info',
        duration: 15,
        sound: false,
        icon: '👋'
      },
      without_photo: {
        label: 'Sans photo',
        priority: 'medium',
        duration: 30,
        sound: false,
        icon: '📸',
        threshold: 5 // Alerte si > 5
      },
      without_matricule: {
        label: 'Sans matricule',
        priority: 'medium',
        duration: 30,
        sound: false,
        icon: '🔢'
      },
      birthdays: {
        label: 'Anniversaires',
        priority: 'info',
        duration: 60,
        sound: false,
        icon: '🎂'
      },
      expiring_contracts: {
        label: 'Contrats expirant',
        priority: 'high',
        duration: 60,
        sound: true,
        icon: '📄'
      },
      portal_disabled: {
        label: 'Portail désactivé',
        priority: 'low',
        duration: 20,
        sound: false,
        icon: '🔒',
        threshold: 10
      }
    }
  },

  POINTAGES: {
    key: 'POINTAGES',
    path: '/pointages',
    label: 'Pointages',
    color: '#6366F1',
    icon: Clock,
    triggers: {
      new_attendances: {
        label: 'Nouveaux pointages',
        priority: 'info',
        duration: 10,
        sound: true,
        soundType: 'soft',
        icon: '✨'
      },
      new_ins: {
        label: 'Nouvelles entrées',
        priority: 'info',
        duration: 10,
        sound: true,
        soundType: 'in',
        icon: '🟢'
      },
      new_outs: {
        label: 'Nouvelles sorties',
        priority: 'info',
        duration: 10,
        sound: true,
        soundType: 'out',
        icon: '🔴'
      },
      new_lates: {
        label: 'Nouveaux retards',
        priority: 'high',
        duration: 60,
        sound: true,
        soundType: 'alert',
        icon: '⏰'
      },
      auto_closed: {
        label: 'Oublis de sortie',
        priority: 'medium',
        duration: 30,
        sound: false,
        icon: '🚪'
      },
      outside_zone: {
        label: 'Hors zone',
        priority: 'critical',
        duration: 0, // Infini
        sound: true,
        soundType: 'critical',
        icon: '📍'
      },
      no_photo: {
        label: 'Sans photo',
        priority: 'medium',
        duration: 30,
        sound: false,
        icon: '📸'
      },
      low_quality: {
        label: 'Qualité faciale faible',
        priority: 'medium',
        duration: 30,
        sound: false,
        icon: '🔍'
      }
    }
  },

  ABSENCES: {
    key: 'ABSENCES',
    path: '/absences',
    label: 'Absences & Congés',
    color: '#8B5CF6',
    icon: CalendarOff,
    triggers: {
      new_requests: {
        label: 'Nouvelles demandes',
        priority: 'high',
        duration: 60,
        sound: true,
        icon: '📋'
      },
      urgent_requests: {
        label: 'Demandes urgentes',
        priority: 'critical',
        duration: 0,
        sound: true,
        soundType: 'urgent',
        icon: '⚡'
      },
      missing_documents: {
        label: 'Documents manquants',
        priority: 'medium',
        duration: 30,
        sound: false,
        icon: '📎'
      },
      active_absences: {
        label: 'Absences en cours',
        priority: 'info',
        duration: 20,
        sound: false,
        icon: '📅'
      },
      conflicts: {
        label: 'Conflits',
        priority: 'critical',
        duration: 0,
        sound: true,
        soundType: 'critical',
        icon: '⚠️'
      }
    }
  },

  TACHES: {
    key: 'TACHES',
    path: '/employes?vue=taches',
    label: 'Équipes et tâches',
    color: '#F59E0B',
    icon: ClipboardList,
    triggers: {
      new_tasks: {
        label: 'Nouvelles tâches',
        priority: 'info',
        duration: 15,
        sound: true,
        icon: '➕'
      },
      overdue_tasks: {
        label: 'Tâches en retard',
        priority: 'critical',
        duration: 0,
        sound: true,
        soundType: 'critical',
        icon: '🚨'
      },
      due_today: {
        label: 'Dues aujourd\'hui',
        priority: 'high',
        duration: 60,
        sound: true,
        icon: '📆'
      },
      unassigned_tasks: {
        label: 'Non assignées',
        priority: 'medium',
        duration: 30,
        sound: false,
        icon: '👤'
      },
      newly_completed: {
        label: 'Complétées',
        priority: 'info',
        duration: 15,
        sound: false,
        icon: '✅'
      },
      urgent_tasks: {
        label: 'Urgentes',
        priority: 'high',
        duration: 60,
        sound: true,
        icon: '⚡'
      },
      teams_without_leader: {
        label: 'Équipes sans chef',
        priority: 'medium',
        duration: 30,
        sound: false,
        icon: '👥'
      },
      empty_teams: {
        label: 'Équipes vides',
        priority: 'low',
        duration: 20,
        sound: false,
        icon: '📭'
      }
    }
  },

  GEOFENCING: {
    key: 'GEOFENCING',
    path: '/geofencing',
    label: 'Geofencing',
    color: '#10B981',
    icon: MapPin,
    triggers: {
      outside_zone: {
        label: 'Pointages hors zone',
        priority: 'critical',
        duration: 0,
        sound: true,
        soundType: 'critical',
        icon: '🚨'
      },
      no_geofences: {
        label: 'Aucune zone définie',
        priority: 'high',
        duration: 60,
        sound: true,
        icon: '📍'
      },
      gps_disabled: {
        label: 'GPS désactivé',
        priority: 'medium',
        duration: 30,
        sound: false,
        icon: '📡'
      },
      low_accuracy: {
        label: 'Précision GPS faible',
        priority: 'low',
        duration: 20,
        sound: false,
        icon: '🎯'
      }
    }
  },

  RETARDS: {
    key: 'RETARDS',
    path: '/retards',
    label: 'Retards',
    color: '#EF4444',
    icon: AlertTriangle,
    triggers: {
      new_lates: {
        label: 'Nouveaux retards',
        priority: 'high',
        duration: 60,
        sound: true,
        soundType: 'alert',
        icon: '⏰'
      },
      repeated_lates: {
        label: 'Retards répétés',
        priority: 'critical',
        duration: 0,
        sound: true,
        soundType: 'critical',
        icon: '🔄'
      },
      excessive_lates: {
        label: 'Retards excessifs',
        priority: 'critical',
        duration: 0,
        sound: true,
        soundType: 'critical',
        icon: '⚠️'
      }
    }
  },

  HEURES_SUP: {
    key: 'HEURES_SUP',
    path: '/heures-supplementaires',
    label: 'Heures Sup',
    color: '#F97316',
    icon: Timer,
    triggers: {
      new_overtime: {
        label: 'Nouvelles heures sup',
        priority: 'info',
        duration: 15,
        sound: false,
        icon: '⏱️'
      },
      threshold_exceeded: {
        label: 'Seuil dépassé',
        priority: 'critical',
        duration: 0,
        sound: true,
        soundType: 'alert',
        icon: '⚠️'
      },
      overtime_today: {
        label: 'Heures sup aujourd\'hui',
        priority: 'info',
        duration: 20,
        sound: false,
        icon: '📊'
      },
      rate_100: {
        label: 'Majorations 100%',
        priority: 'high',
        duration: 60,
        sound: true,
        icon: '💯'
      }
    }
  },

  FICHES_PAIE: {
    key: 'FICHES_PAIE',
    path: '/fiches-paie',
    label: 'Fiches de Paie',
    color: '#F59E0B',
    icon: Wallet,
    triggers: {
      missing_slips: {
        label: 'Fiches manquantes',
        priority: 'high',
        duration: 60,
        sound: true,
        icon: '📋'
      },
      no_pdf: {
        label: 'Sans PDF',
        priority: 'medium',
        duration: 30,
        sound: false,
        icon: '📄'
      },
      zero_salary: {
        label: 'Salaire = 0',
        priority: 'critical',
        duration: 0,
        sound: true,
        soundType: 'critical',
        icon: '⚠️'
      }
    }
  },

  PLANNING: {
    key: 'PLANNING',
    path: '/planning',
    label: 'Planning',
    color: '#F59E0B',
    icon: Calendar,
    triggers: {
      without_schedule: {
        label: 'Sans horaire',
        priority: 'medium',
        duration: 30,
        sound: false,
        icon: '📅'
      },
      schedule_modified: {
        label: 'Horaires modifiés',
        priority: 'info',
        duration: 15,
        sound: false,
        icon: '✏️'
      },
      schedule_requests: {
        label: 'Demandes modification',
        priority: 'high',
        duration: 60,
        sound: true,
        icon: '📝'
      }
    }
  },

  PREDICTIONS: {
    key: 'PREDICTIONS',
    path: '/predictions',
    label: 'Prédictions',
    color: '#8B5CF6',
    icon: Sparkles,
    triggers: {
      critical_predictions: {
        label: 'Alertes critiques',
        priority: 'critical',
        duration: 0,
        sound: true,
        soundType: 'critical',
        icon: '🚨'
      },
      warning_predictions: {
        label: 'Avertissements',
        priority: 'high',
        duration: 60,
        sound: true,
        icon: '⚠️'
      },
      new_predictions: {
        label: 'Nouvelles prédictions',
        priority: 'info',
        duration: 20,
        sound: false,
        icon: '✨'
      }
    }
  },

  JOURS_FERIES: {
    key: 'JOURS_FERIES',
    path: '/jours-feries',
    label: 'Jours Fériés',
    color: '#8B5CF6',
    icon: CalendarDays,
    triggers: {
      today_holiday: {
        label: 'Jour férié aujourd\'hui',
        priority: 'info',
        duration: 0, // Toute la journée
        sound: false,
        icon: '🎌'
      },
      tomorrow_holiday: {
        label: 'Jour férié demain',
        priority: 'info',
        duration: 60,
        sound: false,
        icon: '📅'
      }
    }
  }
}

// ═══ STYLES PAR PRIORITÉ ═══
export const PRIORITY_STYLES = {
  critical: {
    animationDuration: '0.6s',
    animationType: 'shake-pulse',
    glowIntensity: 'intense',
    badgeColor: '#EF4444',
    badgeGlow: '0 0 20px rgba(239, 68, 68, 0.6)',
    borderColor: 'rgba(239, 68, 68, 0.5)',
    sound: true,
    soundVolume: 0.7
  },
  high: {
    animationDuration: '1s',
    animationType: 'pulse-glow',
    glowIntensity: 'medium',
    badgeColor: '#F97316',
    badgeGlow: '0 0 15px rgba(249, 115, 22, 0.5)',
    borderColor: 'rgba(249, 115, 22, 0.4)',
    sound: true,
    soundVolume: 0.5
  },
  medium: {
    animationDuration: '1.5s',
    animationType: 'pulse',
    glowIntensity: 'low',
    badgeColor: '#F59E0B',
    badgeGlow: '0 0 10px rgba(245, 158, 11, 0.4)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
    sound: false,
    soundVolume: 0
  },
  low: {
    animationDuration: '2s',
    animationType: 'pulse-soft',
    glowIntensity: 'very-low',
    badgeColor: '#6366F1',
    badgeGlow: '0 0 8px rgba(99, 102, 241, 0.3)',
    borderColor: 'rgba(99, 102, 241, 0.2)',
    sound: false,
    soundVolume: 0
  },
  info: {
    animationDuration: '2.5s',
    animationType: 'pulse-minimal',
    glowIntensity: 'minimal',
    badgeColor: '#10B981',
    badgeGlow: '0 0 5px rgba(16, 185, 129, 0.2)',
    borderColor: 'rgba(16, 185, 129, 0.15)',
    sound: false,
    soundVolume: 0
  }
}

// ═══ SONS D'ALERTE ═══
export const SOUND_TYPES = {
  soft: { frequency: 800, duration: 100, volume: 0.3 },
  in: { frequency: 1200, duration: 150, volume: 0.4 },
  out: { frequency: 600, duration: 150, volume: 0.4 },
  alert: { frequency: 1500, duration: 200, volume: 0.5 },
  urgent: { frequency: 1800, duration: 300, volume: 0.6, repeat: 2 },
  critical: { frequency: 2000, duration: 400, volume: 0.7, repeat: 3 }
}

// ═══ DURÉES D'ANIMATION ═══
export const ANIMATION_DURATIONS = {
  INSTANT: 0,      // Infini jusqu'à action
  SHORT: 10,       // 10 secondes
  MEDIUM: 30,      // 30 secondes
  LONG: 60,        // 1 minute
  VERY_LONG: 300   // 5 minutes
}

// ═══ HELPER : Obtenir la plus haute priorité ═══
export const getHighestPriority = (triggers) => {
  const priorities = ['critical', 'high', 'medium', 'low', 'info']
  for (const priority of priorities) {
    if (triggers.some(t => t.priority === priority)) {
      return priority
    }
  }
  return 'info'
}

// ═══ HELPER : Obtenir la config d'un onglet ═══
export const getTabConfig = (tabKey) => {
  return TABS_CONFIG[tabKey] || null
}

// ═══ HELPER : Vérifier si un son doit être joué ═══
export const shouldPlaySound = (priority, userPreferences = {}) => {
  if (userPreferences.soundsDisabled) return false
  const style = PRIORITY_STYLES[priority]
  return style?.sound || false
}

export default TABS_CONFIG