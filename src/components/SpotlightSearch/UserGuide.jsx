// ═══════════════════════════════════════════════════════════
// 📖 USER GUIDE - Guide d'utilisation élégant
// ═══════════════════════════════════════════════════════════

import { MessageSquare, Zap, Keyboard } from 'lucide-react'

export default function UserGuide() {
  const guides = [
    {
      icon: MessageSquare,
      color: '#10B981',
      title: 'Recherche Naturelle',
      description: 'Tapez en langage naturel :',
      examples: [
        'heures Jean Dupont ce mois',
        'absents aujourd\'hui',
        'tâches urgentes équipe RH',
      ],
    },
    {
      icon: Zap,
      color: '#F59E0B',
      title: 'Commandes Rapides',
      description: 'Utilisez le préfixe "/" :',
      examples: [
        '/stats → Statistiques du jour',
        '/export → Exporter des données',
        '/scan → Activer le scanner QR',
      ],
    },
    {
      icon: Keyboard,
      color: '#6366F1',
      title: 'Raccourcis Clavier',
      description: 'Naviguez rapidement :',
      examples: [
        '⌘K / Ctrl+K → Focus recherche',
        '↑↓ → Naviguer dans les résultats',
        'Enter → Ouvrir la sélection',
      ],
    },
  ]

  return (
    <div className="user-guide-container">
      <div className="user-guide-header">
        <h3 className="user-guide-title">💡 Comment utiliser l'Intelligence Hub</h3>
        <p className="user-guide-subtitle">
          Recherchez, explorez et agissez en quelques touches
        </p>
      </div>

      <div className="user-guide-grid">
        {guides.map((guide, index) => {
          const Icon = guide.icon
          
          return (
            <div
              key={index}
              className="user-guide-card"
              style={{ '--guide-color': guide.color }}
            >
              <div className="user-guide-card-header">
                <div className="user-guide-card-icon">
                  <Icon size={20} />
                </div>
                <h4 className="user-guide-card-title">{guide.title}</h4>
              </div>

              <p className="user-guide-card-description">
                {guide.description}
              </p>

              <ul className="user-guide-card-examples">
                {guide.examples.map((example, i) => (
                  <li key={i} className="user-guide-card-example">
                    <span className="user-guide-card-bullet">•</span>
                    <code className="user-guide-card-code">{example}</code>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}