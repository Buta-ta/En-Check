import { Link } from 'react-router-dom'
import {
  Home,
  Users,
  ScanLine,
  CalendarDays,
  Landmark,
  ShieldCheck,
} from 'lucide-react'
export default function AdminAccountRail() {
  return (
    <aside className="aa-rail" aria-label="Navigation administrative">
      <Link className="aa-brand" to="/dashboard">
        En-Check<span>On gère !</span>
      </Link>
      <nav>
        {[
          ['/dashboard', 'Accueil', Home],
          ['/employes', 'Employés', Users],
          ['/pointages', 'Pointages', ScanLine],
          ['/planning', 'Planning', CalendarDays],
          ['/paie', 'Paie', Landmark],
          ['/admins', 'Administration', ShieldCheck],
        ].map(([path, label, Icon]) => (
          <Link
            to={path}
            key={path}
            aria-current={path === '/admins' ? 'page' : undefined}
          >
            <span>
              <Icon size={20} />
            </span>
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
