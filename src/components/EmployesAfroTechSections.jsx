// ═══════════════════════════════════════════════════════════
// 👥 EMPLOYÉS — l'en-tête culturel de la page
//
// La page Employés n'a plus qu'une seule pièce dans ce fichier :
// son en-tête (la bande culturelle, la marque, le sélecteur
// d'entreprise, le thème et l'ajout d'un employé). Les cartes de
// chiffres, les courbes et les portraits ont été retirés : les trois
// vues de la page (Annuaire, Équipes, Tâches) parlent maintenant la
// même langue — le registre perlé de zoulou.css.
// ═══════════════════════════════════════════════════════════

import PageCulturalBand from './PageCulturalBand'
import { ArrowLeft, Building2, Moon, Sun, UserPlus } from 'lucide-react'
import EnCheckBrandMark from './EnCheckBrandMark'
import '../pages/PointagesAfroTech.css'

export function EmployesCulturalHero({
  darkMode = true,
  entreprises = [],
  selectedEnterpriseId = 'all',
  onSelectEnterprise,
  onToggleTheme,
  onBackDashboard,
  onAddEmployee,
}) {
  return (
    <header className="employes-concept-header" aria-label="En-tête Employés En-Check">
      <PageCulturalBand pathname="/employes"/>
      <div className="employes-concept-topbar">
        <div className="employes-concept-brand">
          {onBackDashboard && (
            <button
              type="button"
              className="pointages-back-dashboard-btn"
              onClick={onBackDashboard}
              title="Retour au Dashboard"
              aria-label="Retour au Dashboard"
            >
              <ArrowLeft size={17} />
            </button>
          )}
          <EnCheckBrandMark size={44} />
          <div className="employes-concept-brand-text">
            <strong>En-Check · Employés</strong>
            <span>On gère !</span>
          </div>
        </div>

        <div className="employes-concept-center-col">
          <h1 className="employes-concept-center-title">Employés</h1>
        </div>

        <div className="employes-concept-actions">
          {entreprises.length > 1 && onSelectEnterprise && (
            <label className="employes-enterprise-select-pill" title="Filtrer par entreprise">
              <Building2 size={13} />
              <select
                value={selectedEnterpriseId || 'all'}
                onChange={(e) => onSelectEnterprise(e.target.value)}
                aria-label="Sélectionner une entreprise"
              >
                <option value="all">Toutes les entreprises</option>
                {entreprises.map((ent) => (
                  <option key={ent.id} value={ent.id}>{ent.name}</option>
                ))}
              </select>
            </label>
          )}

          {onToggleTheme && (
            <button
              type="button"
              className="employes-theme-pill"
              onClick={onToggleTheme}
              title={darkMode ? 'Passer en mode clair' : 'Passer en mode sombre'}
            >
              {darkMode ? <Sun size={14} /> : <Moon size={14} />}
              <span>{darkMode ? 'Clair' : 'Sombre'}</span>
            </button>
          )}

          {onAddEmployee && (
            <button
              type="button"
              className="employes-add-pill-btn"
              onClick={onAddEmployee}
            >
              <UserPlus size={15} />
              <span>+ Nouvel employé</span>
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
