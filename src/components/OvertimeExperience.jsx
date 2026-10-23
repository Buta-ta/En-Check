import { Link } from 'react-router-dom'
import {
  Clock,
  CalendarDays,
  Users,
  Wallet,
  Sun,
  Moon,
  FileClock,
  ArrowRight,
} from 'lucide-react'
import PageCulturalBand from './PageCulturalBand'

export function OvertimeNavigation({ darkMode, onToggleTheme }) {
  return (
    <div className="ot-navigation">
      <nav aria-label="Raccourcis heures supplémentaires">
        {[
          [Clock, 'Pointages', '/pointages'],
          [CalendarDays, 'Planning', '/planning'],
          [Users, 'Employés', '/employes'],
          [Wallet, 'Paie & Fiscalité', '/paie'],
        ].map(([Icon, title, to]) => (
          <Link key={to} to={to}>
            <Icon size={16} aria-hidden="true" />
            {title}
          </Link>
        ))}
      </nav>
      <button
        onClick={onToggleTheme}
        aria-label={darkMode ? 'Passer en mode clair' : 'Passer en mode sombre'}
      >
        {darkMode ? <Sun size={17} /> : <Moon size={17} />}
        {darkMode ? 'Mode clair' : 'Mode sombre'}
      </button>
    </div>
  )
}

export function OvertimeCalculationGuide() {
  return (
    <section className="ot-panel ot-calculation-guide">
      <div className="ot-guide-heading">
        <span className="ot-coin">
          <FileClock size={22} />
        </span>
        <h2>Comment sont calculées les heures sup. ?</h2>
      </div>
      <ol className="ot-calculation-steps">
        <li>Temps travaillé</li>
        <li>Seuil du planning</li>
        <li>Dépassement</li>
      </ol>
      <div className="ot-example">
        <span>Exemple illustratif · pas les règles de votre entreprise</span>
        <p>
          <strong>9 h</strong> travaillées <b>−</b> <strong>8 h</strong> prévues{' '}
          <ArrowRight size={16} aria-label="donne" />{' '}
          <strong>1 h supplémentaire</strong>
        </p>
      </div>
      <details>
        <summary>Comment s’appliquent les majorations ?</summary>
        <p>
          Les premières heures supplémentaires et celles au-delà du palier
          peuvent avoir des taux différents. Consultez les règles de
          l’entreprise et le détail de chaque jour pour voir les taux appliqués.
        </p>
      </details>
      <details>
        <summary>Et les dimanches et jours fériés ?</summary>
        <p>
          Ces journées peuvent avoir des taux et seuils spécifiques. Le planning
          et les options de l’entreprise déterminent le calcul. Les heures
          affichées ne confirment pas un paiement.
        </p>
      </details>
    </section>
  )
}

export function OvertimeLoadingScreen({ checkingAccess = false }) {
  return (
    <section className="ot-loading" role="status" aria-live="polite">
      <PageCulturalBand
        pathname="/heures-supplementaires"
        placement="loading"
      />
      <div className="ot-loading-scene" aria-hidden="true">
        <div className="ot-loading-paper">
          <FileClock size={38} />
          <i />
          <i />
          <i />
        </div>
        <div className="ot-loading-clock">
          <Clock size={60} />
        </div>
        <div className="ot-loading-timeline">
          <span className="ot-loading-normal" />
          <span className="ot-loading-extra" />
          <i className="ot-loading-marker" />
        </div>
        <div className="ot-loading-legend">
          <span>Temps prévu</span>
          <span>Dépassement</span>
        </div>
      </div>
      <h2>
        {checkingAccess
          ? 'Vérification de l’accès…'
          : 'Calcul des heures supplémentaires…'}
      </h2>
      <p>
        {checkingAccess
          ? 'Vérification des droits de votre entreprise.'
          : 'Lecture des pointages et application des règles du planning.'}
      </p>
      <PageCulturalBand pathname="/heures-supplementaires" placement="bottom" />
    </section>
  )
}
