// ═══════════════════════════════════════════════════════════
// TABLEAU DE BORD — MODALES
// Catalogues (widgets, barre du haut, actions rapides), détail
// d'un pointage, sorties manquantes et résolution de conflit
// absence/pointage.
// ═══════════════════════════════════════════════════════════
import { useNavigate } from 'react-router-dom'
import {
  CalendarOff, CheckCircle2, ChevronRight, Clock, LogOut, Plus, RotateCcw,
  ShieldCheck, X,
} from 'lucide-react'
import PhotoSignee from '../../components/PhotoSignee'
import { formaterHeureLocale } from '../../utils/timezoneUtils'
import { formatDate, formatName } from './experienceCatalogs'

export default function DashboardDialogs({ layout, data }) {
  const navigate = useNavigate()
  const {
    isWidgetCatalogOpen, setIsWidgetCatalogOpen, unaddedWidgets, addWidget,
    isTopbarCatalogOpen, setIsTopbarCatalogOpen, unaddedTopbarItems,
    addTopbarItem, resetTopbarLayout, isQuickActionCatalogOpen,
    setIsQuickActionCatalogOpen, unaddedQuickActions, addQuickAction,
    selectedActivityItem, setSelectedActivityItem, isForgottenExitModalOpen,
    setIsForgottenExitModalOpen, exitTimesById, setExitTimesById,
  } = layout
  const {
    forgottenExitItems, confirmForgottenExit, savingForgottenExitId,
    showConflictModal, setShowConflictModal, selectedConflict, conflictNote,
    setConflictNote, resolvingConflict, resolveConflict,
  } = data
  return (
    <>
      {isWidgetCatalogOpen && (
        <div className="dashboard-widget-catalog-overlay" role="presentation" onClick={() => setIsWidgetCatalogOpen(false)}>
          <section
            className="dashboard-widget-catalog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dashboard-widget-catalog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="dashboard-widget-catalog-header">
              <div>
                <span className="dashboard-eyebrow">En-Check · Tableau personnel</span>
                <h2 id="dashboard-widget-catalog-title">Ajouter un widget</h2>
                <p>Choisis tes indicateurs. Seules les données réellement chargées par tes modules sont proposées.</p>
              </div>
              <button type="button" className="dashboard-widget-catalog-close" onClick={() => setIsWidgetCatalogOpen(false)} aria-label="Fermer la liste des widgets"><X size={17} /></button>
            </header>
            <div className="dashboard-widget-catalog-body">
              {unaddedWidgets.length > 0 ? (
                <div className="dashboard-widget-catalog-grid">
                  {unaddedWidgets.map((widget) => {
                    const Icon = widget.icon
                    return (
                      <article className={`dashboard-widget-choice dashboard-kpi--${widget.tone}`} key={widget.id}>
                        <span className="dashboard-widget-choice-icon"><Icon size={16} /></span>
                        <div className="dashboard-widget-choice-copy">
                          <strong>{widget.label}</strong>
                          <span>{widget.description}</span>
                          <small>{widget.sourceLabel}</small>
                        </div>
                        <button type="button" onClick={() => addWidget(widget.id)} aria-label={`Ajouter ${widget.label}`}><Plus size={15} /><span>Ajouter</span></button>
                      </article>
                    )
                  })}
                </div>
              ) : (
                <div className="dashboard-widget-catalog-empty">
                  <CheckCircle2 size={22} />
                  <strong>Tous les indicateurs disponibles sont déjà sur ton tableau.</strong>
                  <span>Tu peux les réorganiser ou retirer ceux dont tu n’as pas besoin.</span>
                </div>
              )}
              <p className="dashboard-widget-storage-note">Ta disposition est enregistrée sur cet appareil et pour ce compte.</p>
            </div>
          </section>
        </div>
      )}

      {isTopbarCatalogOpen && (
        <div className="dashboard-widget-catalog-overlay" role="presentation" onClick={() => setIsTopbarCatalogOpen(false)}>
          <section className="dashboard-widget-catalog" role="dialog" aria-modal="true" aria-labelledby="dashboard-topbar-catalog-title" onClick={(event) => event.stopPropagation()}>
            <header className="dashboard-widget-catalog-header">
              <div>
                <span className="dashboard-eyebrow">En-Check · En-tête personnel</span>
                <h2 id="dashboard-topbar-catalog-title">Ajouter un élément en haut</h2>
                <p>Choisis les éléments visibles dans la barre. Tu pourras ensuite les glisser, les retirer ou les réordonner.</p>
              </div>
              <div className="dashboard-widget-catalog-header-actions">
                <button type="button" className="dashboard-widget-catalog-reset" onClick={resetTopbarLayout}><RotateCcw size={13} /><span>Réinitialiser</span></button>
                <button type="button" className="dashboard-widget-catalog-close" onClick={() => setIsTopbarCatalogOpen(false)} aria-label="Fermer le catalogue de la barre du haut"><X size={17} /></button>
              </div>
            </header>
            <div className="dashboard-widget-catalog-body">
              {unaddedTopbarItems.length > 0 ? (
                <div className="dashboard-widget-catalog-grid">
                  {unaddedTopbarItems.map((item) => {
                    const Icon = item.icon
                    return (
                      <article className="dashboard-widget-choice dashboard-topbar-choice" key={item.id}>
                        <span className="dashboard-widget-choice-icon"><Icon size={16} /></span>
                        <div className="dashboard-widget-choice-copy">
                          <strong>{item.label}</strong>
                          <span>{item.description}</span>
                          <small>Zone par défaut · {item.region === 'left' ? 'entreprise et date' : 'commandes'}</small>
                        </div>
                        <button type="button" onClick={() => addTopbarItem(item)} aria-label={`Ajouter ${item.label}`}><Plus size={15} /><span>Ajouter</span></button>
                      </article>
                    )
                  })}
                </div>
              ) : (
                <div className="dashboard-widget-catalog-empty">
                  <CheckCircle2 size={22} />
                  <strong>Tous les éléments de la barre sont déjà affichés.</strong>
                  <span>Tu peux les réorganiser ou retirer ceux que tu n’utilises pas.</span>
                </div>
              )}
              <p className="dashboard-widget-storage-note">La disposition est mémorisée par compte et par entreprise sur cet appareil.</p>
            </div>
          </section>
        </div>
      )}

      {isQuickActionCatalogOpen && (
        <div className="dashboard-widget-catalog-overlay" role="presentation" onClick={() => setIsQuickActionCatalogOpen(false)}>
          <section className="dashboard-widget-catalog" role="dialog" aria-modal="true" aria-labelledby="dashboard-quick-action-catalog-title" onClick={(event) => event.stopPropagation()}>
            <header className="dashboard-widget-catalog-header">
              <div>
                <span className="dashboard-eyebrow">En-Check · Actions rapides</span>
                <h2 id="dashboard-quick-action-catalog-title">Ajouter une action rapide</h2>
                <p>Choisis les raccourcis vers les pages auxquelles ton compte a accès.</p>
              </div>
              <button type="button" className="dashboard-widget-catalog-close" onClick={() => setIsQuickActionCatalogOpen(false)} aria-label="Fermer le catalogue des actions"><X size={17} /></button>
            </header>
            <div className="dashboard-widget-catalog-body">
              {unaddedQuickActions.length > 0 ? (
                <div className="dashboard-widget-catalog-grid">
                  {unaddedQuickActions.map((action) => {
                    const Icon = action.icon
                    return (
                      <article className="dashboard-widget-choice dashboard-quick-action-choice" key={action.id}>
                        <span className="dashboard-widget-choice-icon"><Icon size={16} /></span>
                        <div className="dashboard-widget-choice-copy">
                          <strong>{action.label}</strong>
                          <span>{action.description}</span>
                          <small>{action.category}</small>
                        </div>
                        <button type="button" onClick={() => addQuickAction(action.id)} aria-label={`Ajouter ${action.label}`}><Plus size={15} /><span>Ajouter</span></button>
                      </article>
                    )
                  })}
                </div>
              ) : (
                <div className="dashboard-widget-catalog-empty">
                  <CheckCircle2 size={22} />
                  <strong>Toutes les actions disponibles sont déjà dans tes accès rapides.</strong>
                  <span>Tu peux les réorganiser ou retirer celles dont tu n’as pas besoin.</span>
                </div>
              )}
              <p className="dashboard-widget-storage-note">Seuls les raccourcis vers les modules accessibles à ton compte sont proposés.</p>
            </div>
          </section>
        </div>
      )}

      {selectedActivityItem && (
        <div className="dashboard-conflict-overlay" role="presentation" onClick={() => setSelectedActivityItem(null)}>
          <section className="dashboard-conflict-modal" role="dialog" aria-modal="true" aria-labelledby="dashboard-activity-detail-title" onClick={(event) => event.stopPropagation()}>
            <header className="dashboard-conflict-header">
              <div className="dashboard-conflict-heading-icon"><Clock size={20} /></div>
              <div className="dashboard-conflict-heading-copy">
                <h2 id="dashboard-activity-detail-title">{formatName(selectedActivityItem.employee)}</h2>
                <p>{selectedActivityItem.employee?.matricule || 'Employé'} · {String(selectedActivityItem.type || '').toLowerCase() === 'in' ? 'Entrée' : 'Sortie'}</p>
              </div>
              <button type="button" className="dashboard-conflict-close" onClick={() => setSelectedActivityItem(null)} aria-label="Fermer"><X size={17} /></button>
            </header>
            <div className="dashboard-conflict-body">
              <div className="dashboard-conflict-facts">
                <div><span>Heure enregistrée</span><strong>{formaterHeureLocale(selectedActivityItem.time)}</strong></div>
                <div><span>Statut</span><strong>{selectedActivityItem.isLate ? 'Arrivée en retard' : (String(selectedActivityItem.type || '').toLowerCase() === 'in' ? 'Arrivée à l’heure' : (selectedActivityItem.isAutoClosed ? 'Sortie auto-clôturée' : 'Sortie enregistrée'))}</strong></div>
                <div><span>Preuve</span><strong>{selectedActivityItem.hasPhoto ? 'Photo de pointage vérifiée' : 'Badge / Poste En-Check'}</strong></div>
              </div>
              {selectedActivityItem.photoUrl && (
                <div className="dashboard-activity-photo-preview">
                  <PhotoSignee url={selectedActivityItem.photoUrl} alt={`Pointage de ${formatName(selectedActivityItem.employee)}`} />
                </div>
              )}
              <div className="dashboard-conflict-actions">
                <button
                  type="button"
                  className="dashboard-conflict-option is-keep"
                  onClick={() => {
                    const query = selectedActivityItem.employee?.matricule || selectedActivityItem.employee?.last_name || ''
                    setSelectedActivityItem(null)
                    navigate(query ? `/pointages?q=${encodeURIComponent(query)}` : '/pointages')
                  }}
                >
                  <Clock size={17} /><span><strong>Ouvrir dans Pointages</strong><small>Consulter ou modifier la journée complète de ce collaborateur.</small></span><ChevronRight size={15} />
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {isForgottenExitModalOpen && (
        <div className="dashboard-conflict-overlay" role="presentation" onClick={() => setIsForgottenExitModalOpen(false)}>
          <section className="dashboard-conflict-modal" role="dialog" aria-modal="true" aria-labelledby="dashboard-forgotten-exit-title" onClick={(event) => event.stopPropagation()}>
            <header className="dashboard-conflict-header">
              <div className="dashboard-conflict-heading-icon"><LogOut size={20} /></div>
              <div className="dashboard-conflict-heading-copy">
                <h2 id="dashboard-forgotten-exit-title">Sorties manquantes à vérifier</h2>
                <p>Vérifiez les badges avant de renseigner une sortie manquante. Cette alerte ne constitue pas une estimation.</p>
              </div>
              <button type="button" className="dashboard-conflict-close" onClick={() => setIsForgottenExitModalOpen(false)} aria-label="Fermer"><X size={17} /></button>
            </header>
            <div className="dashboard-conflict-body">
              {forgottenExitItems.length > 0 ? (
                <div className="dashboard-forgotten-exit-list">
                  {forgottenExitItems.map((item) => {
                    const exitTime = exitTimesById[item.id] || '18:00'
                    const isSaving = savingForgottenExitId === item.id
                    return (
                      <div className="dashboard-forgotten-exit-row" key={item.id}>
                        <div className="dashboard-forgotten-exit-copy">
                          <strong>{formatName(item.employee)}</strong>
                          <span>Arrivée à {formaterHeureLocale(item.check_time)}</span>
                        </div>
                        <div className="dashboard-forgotten-exit-controls">
                          <input
                            type="time"
                            value={exitTime}
                            aria-label={`Heure de sortie pour ${formatName(item.employee)}`}
                            onChange={(event) => setExitTimesById((current) => ({ ...current, [item.id]: event.target.value }))}
                          />
                          <button
                            type="button"
                            disabled={isSaving || !confirmForgottenExit}
                            onClick={async () => {
                              const ok = await confirmForgottenExit(item, exitTime)
                              if (ok && forgottenExitItems.length <= 1) setIsForgottenExitModalOpen(false)
                            }}
                          >
                            <CheckCircle2 size={13} />
                            <span>{isSaving ? 'Enregistrement…' : 'Confirmer'}</span>
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="dashboard-widget-storage-note">Toutes les sorties en attente ont été confirmées.</p>
              )}
              <div className="dashboard-conflict-actions">
                <button type="button" className="dashboard-conflict-option is-ignore" onClick={() => { setIsForgottenExitModalOpen(false); navigate('/pointages') }}>
                  <Clock size={17} /><span><strong>Voir tous les pointages</strong><small>Accéder au journal complet des entrées et sorties.</small></span><ChevronRight size={15} />
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {showConflictModal && selectedConflict && (
        <div className="dashboard-conflict-overlay" role="presentation" onClick={() => setShowConflictModal(false)}>
          <section className="dashboard-conflict-modal" role="dialog" aria-modal="true" aria-labelledby="dashboard-conflict-title" onClick={(event) => event.stopPropagation()}>
            <header className="dashboard-conflict-header">
              <div className="dashboard-conflict-heading-icon"><ShieldCheck size={21} /></div>
              <div className="dashboard-conflict-heading-copy">
                <h2 id="dashboard-conflict-title">Examiner le conflit</h2>
                <p>{formatName(selectedConflict.employees)}</p>
              </div>
              <button type="button" className="dashboard-conflict-close" onClick={() => setShowConflictModal(false)} aria-label="Fermer"><X size={17} /></button>
            </header>
            <div className="dashboard-conflict-body">
              <div className="dashboard-conflict-facts">
                <div><span>Motif d’absence</span><strong>{selectedConflict.absences?.reason || 'Non précisé'}</strong></div>
                <div><span>Période</span><strong>{selectedConflict.absences?.start_date ? `${formatDate(selectedConflict.absences.start_date)}${selectedConflict.absences?.end_date ? ` – ${formatDate(selectedConflict.absences.end_date)}` : ''}` : '—'}</strong></div>
              </div>
              <label className="dashboard-conflict-label" htmlFor="dashboard-conflict-note">Note de résolution <span>(facultatif)</span></label>
              <textarea
                id="dashboard-conflict-note"
                className="dashboard-conflict-note"
                value={conflictNote}
                onChange={(event) => setConflictNote(event.target.value)}
                placeholder="Ajouter un contexte pour le suivi…"
                rows={3}
              />
              <div className="dashboard-conflict-actions">
                <button type="button" className="dashboard-conflict-option is-keep" onClick={() => resolveConflict('kept_absence')} disabled={resolvingConflict}>
                  <CheckCircle2 size={17} /><span><strong>Maintenir l’absence</strong><small>Conserver l’absence et le pointage.</small></span><ChevronRight size={15} />
                </button>
                <button type="button" className="dashboard-conflict-option is-cancel" onClick={() => resolveConflict('cancelled_absence')} disabled={resolvingConflict}>
                  <CalendarOff size={17} /><span><strong>Annuler l’absence</strong><small>Le pointage est conservé, l’absence annulée.</small></span><ChevronRight size={15} />
                </button>
                <button type="button" className="dashboard-conflict-option is-ignore" onClick={() => resolveConflict('ignored_conflict')} disabled={resolvingConflict}>
                  <X size={17} /><span><strong>Ignorer le conflit</strong><small>Marquer comme vu sans autre modification.</small></span><ChevronRight size={15} />
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
