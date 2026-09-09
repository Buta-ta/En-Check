// src/components/SpotlightSearch/QuickSuggestions.jsx
// (MAJ) : suggestions qui déclenchent vraiment des commandes/actions

import { BarChart3, Users, Clock, Camera, DollarSign, Target, Map, Sparkles, FileText } from 'lucide-react'

export default function QuickSuggestions({ onSuggestionClick }) {
  const suggestions = [
    { id: 'stats', label: 'Stats du jour', icon: BarChart3, color: '#10B981', type: 'command', value: '/stats' },
    { id: 'absents', label: 'Absents', icon: Users, color: '#EF4444', type: 'command', value: 'absents aujourd\'hui' },
    { id: 'retards', label: 'Retards', icon: Clock, color: '#F59E0B', type: 'command', value: 'retards aujourd\'hui' },
    { id: 'scan', label: 'Scan QR', icon: Camera, color: '#EC4899', type: 'action', action: 'openScanner' },
    { id: 'payslips', label: 'Fiches paie', icon: DollarSign, color: '#8B5CF6', type: 'command', value: 'fiches paie' },
    { id: 'tasks', label: 'Tâches', icon: Target, color: '#6366F1', type: 'command', value: 'tâches urgentes' },
    { id: 'map', label: 'Carte', icon: Map, color: '#14B8A6', type: 'action', action: 'goMap' },
    { id: 'pred', label: 'Prédictions', icon: Sparkles, color: '#A855F7', type: 'action', action: 'goPredictions' },
    { id: 'export', label: 'Export', icon: FileText, color: '#F59E0B', type: 'action', action: 'goReports' },
  ]

  return (
    <div className="quick-suggestions-container">
      <div className="quick-suggestions-header">
        <h3 className="quick-suggestions-title">⚡ Suggestions pour vous</h3>
        <p className="quick-suggestions-subtitle">Accès rapide aux fonctionnalités les plus utilisées</p>
      </div>

      <div className="quick-suggestions-grid">
        {suggestions.map((s, index) => {
          const Icon = s.icon
          return (
            <button
              key={s.id}
              className="quick-suggestion-card"
              style={{ '--suggestion-color': s.color, animationDelay: `${index * 0.05}s` }}
              onClick={() => onSuggestionClick(s)}
              type="button"
            >
              <div className="quick-suggestion-icon"><Icon size={22} /></div>
              <span className="quick-suggestion-label">{s.label}</span>
              <div className="quick-suggestion-glow"></div>
            </button>
          )
        })}
      </div>
    </div>
  )
}