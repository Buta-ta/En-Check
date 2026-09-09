// src/components/SpotlightSearch/SearchResults.jsx
// ═══════════════════════════════════════════════════════════
// 🎨 SEARCH RESULTS (v2.0 - Design Pro & Moderne)
// ═══════════════════════════════════════════════════════════

// ✅ COMPOSANTS (depuis ./ResultCards)
import { EmployeeCard, HoursDetailCard, DownloadAppCard } from './ResultCards'
import { 
  CheckSquare, LogIn, LogOut, Camera, Clock, 
  AlertTriangle, Calendar, MapPin, Users, TrendingUp,
  FileText, Shield, Briefcase, Mail, Phone
} from 'lucide-react'

export default function SearchResults({ results, selectedIndex, onSelect }) {
  const renderCard = (result, index) => {


    
    const isSelected = index === selectedIndex


     const handleClick = () => onSelect(result)

  // ✅ NOUVEAU : Carte de téléchargement
  if (result.type === 'download_app') {
    return (
      <DownloadAppCard
        key={`download-${index}`}
        result={result}
        isSelected={isSelected}
        onClick={handleClick}
      />
    )
  }

    // ═══════════════════════════════════════════════════════
    // 👤 EMPLOYÉS
    // ═══════════════════════════════════════════════════════
    if (result.type === 'employee') {
      return (
        <EmployeeCard 
          key={result.id} 
          employee={result} 
          isSelected={isSelected}
          onClick={() => onSelect(result)}
        />
      )
    }

    // ═══════════════════════════════════════════════════════
    // ⏱️ HEURES
    // ═══════════════════════════════════════════════════════
    if (result.type === 'hours_detail') {
      return (
        <HoursDetailCard
          key={result.id}
          data={result}
          isSelected={isSelected}
          onClick={() => onSelect(result)}
        />
      )
    }

    // ═══════════════════════════════════════════════════════
    // ✅ TÂCHES (Design Pro)
    // ═══════════════════════════════════════════════════════
    if (result.type === 'task') {
      const priorityColors = {
        urgent: '#EF4444',
        high: '#F97316',
        medium: '#F59E0B',
        low: '#10B981',
      }
      const statusColors = {
        pending: '#6B7280',
        in_progress: '#3B82F6',
        completed: '#10B981',
        validated: '#8B5CF6',
      }

      const priorityColor = priorityColors[result.priority] || '#F59E0B'
      const statusColor = statusColors[result.status] || '#6B7280'

      return (
        <div 
          key={result.id} 
          className={`result-card-modern ${isSelected ? 'selected' : ''}`}
          onClick={() => onSelect(result)}
          style={{ borderLeft: `4px solid ${priorityColor}` }}
        >
          <div style={{ display: 'flex', gap: '14px' }}>
            <div style={{
              width: '50px',
              height: '50px',
              borderRadius: '14px',
              background: `${priorityColor}15`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <CheckSquare size={24} color={priorityColor} />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '10px',
                marginBottom: '8px',
                flexWrap: 'wrap'
              }}>
                <h3 style={{ 
                  color: '#FFF', 
                  fontSize: '15px', 
                  fontWeight: '700',
                  margin: 0,
                  flex: 1,
                  minWidth: '120px'
                }}>
                  {result.title}
                </h3>

                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: '8px',
                    fontSize: '10px',
                    fontWeight: '700',
                    background: `${priorityColor}15`,
                    color: priorityColor,
                    border: `1px solid ${priorityColor}40`,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    {result.priority || 'Medium'}
                  </span>

                  <span style={{
                    padding: '4px 10px',
                    borderRadius: '8px',
                    fontSize: '10px',
                    fontWeight: '700',
                    background: `${statusColor}15`,
                    color: statusColor,
                    border: `1px solid ${statusColor}40`,
                  }}>
                    {result.status || 'Pending'}
                  </span>
                </div>
              </div>

              {result.description && (
                <p style={{ 
                  color: '#999', 
                  fontSize: '13px', 
                  margin: '0 0 10px 0',
                  lineHeight: '1.5',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical'
                }}>
                  {result.description}
                </p>
              )}

              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                {result.assigned_employee && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: '700',
                      color: '#000',
                      overflow: 'hidden'
                    }}>
                      {result.assigned_employee.photo_url ? (
                        <img src={result.assigned_employee.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        `${result.assigned_employee.first_name?.[0]}${result.assigned_employee.last_name?.[0]}`
                      )}
                    </div>
                    <span style={{ color: '#AAA', fontSize: '12px', fontWeight: '500' }}>
                      {result.assigned_employee.first_name} {result.assigned_employee.last_name}
                    </span>
                  </div>
                )}

                {result.team && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Users size={14} color="#6366F1" />
                    <span style={{ color: '#6366F1', fontSize: '12px', fontWeight: '600' }}>
                      {result.team.name}
                    </span>
                  </div>
                )}

                {result.due_date && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={14} color="#EC4899" />
                    <span style={{ color: '#EC4899', fontSize: '12px' }}>
                      {new Date(result.due_date).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )
    }

    // ═══════════════════════════════════════════════════════
    // 🕒 POINTAGES (Design Pro)
    // ═══════════════════════════════════════════════════════
    if (result.type === 'attendance') {
      const isIn = result.check_type === 'in'
      const color = isIn ? '#10B981' : '#F59E0B'
      const Icon = isIn ? LogIn : LogOut

      return (
        <div 
          key={result.id} 
          className={`result-card-modern ${isSelected ? 'selected' : ''}`}
          onClick={() => onSelect(result)}
          style={{ borderLeft: `4px solid ${color}` }}
        >
          <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
            <div style={{
              width: '50px',
              height: '50px',
              borderRadius: '14px',
              background: `${color}15`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Icon size={24} color={color} />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <h3 style={{ color: '#FFF', fontSize: '15px', fontWeight: '700', margin: 0 }}>
                  {result.employee?.first_name} {result.employee?.last_name}
                </h3>
                <span style={{
                  padding: '3px 10px',
                  borderRadius: '8px',
                  fontSize: '10px',
                  fontWeight: '700',
                  background: `${color}15`,
                  color: color,
                  border: `1px solid ${color}40`,
                }}>
                  {isIn ? '📥 ENTRÉE' : '📤 SORTIE'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={14} color="#F59E0B" />
                  <span style={{ color: '#CCC', fontSize: '13px', fontWeight: '600' }}>
                    {new Date(result.check_time).toLocaleString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                      day: '2-digit',
                      month: 'short'
                    })}
                  </span>
                </div>

                {result.employee?.matricule && (
                  <span style={{ color: '#888', fontSize: '12px' }}>
                    {result.employee.matricule}
                  </span>
                )}

                {result.has_photo && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    background: 'rgba(236, 72, 153, 0.1)',
                    padding: '4px 10px',
                    borderRadius: '8px',
                  }}>
                    <Camera size={12} color="#EC4899" />
                    <span style={{ color: '#EC4899', fontSize: '11px', fontWeight: '600' }}>
                      Photo
                    </span>
                  </div>
                )}

                {result.location_lat && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <MapPin size={12} color="#6366F1" />
                    <span style={{ color: '#6366F1', fontSize: '11px' }}>GPS</span>
                  </div>
                )}
              </div>

              {result.is_auto_closed && (
                <div style={{
                  marginTop: '8px',
                  padding: '6px 10px',
                  borderRadius: '8px',
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.2)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <AlertTriangle size={12} color="#F59E0B" />
                  <span style={{ color: '#F59E0B', fontSize: '11px', fontWeight: '600' }}>
                    Fermeture automatique
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )
    }

    // ═══════════════════════════════════════════════════════
    // ⏰ RETARDS (Design Pro)
    // ═══════════════════════════════════════════════════════
    if (result.type === 'retard') {
      return (
        <div 
          key={result.id} 
          className={`result-card-modern ${isSelected ? 'selected' : ''}`}
          onClick={() => onSelect(result)}
          style={{ borderLeft: '4px solid #EF4444' }}
        >
          <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
            <div style={{
              width: '50px',
              height: '50px',
              borderRadius: '14px',
              background: 'rgba(239, 68, 68, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              fontSize: '24px'
            }}>
              ⏰
            </div>

            <div style={{ flex: 1 }}>
              <h3 style={{ color: '#FFF', fontSize: '15px', fontWeight: '700', margin: '0 0 8px 0' }}>
                {result.title}
              </h3>
              <p style={{ color: '#EF4444', fontSize: '13px', margin: 0, fontWeight: '600', lineHeight: '1.5' }}>
                {result.subtitle}
              </p>
            </div>
          </div>
        </div>
      )
    }

    // ═══════════════════════════════════════════════════════
    // 📊 STATS SUMMARY
    // ═══════════════════════════════════════════════════════
    if (result.type === 'stats_summary') {
      return (
        <div 
          key={result.id} 
          className={`result-card-modern ${isSelected ? 'selected' : ''}`}
          onClick={() => onSelect(result)}
          style={{ borderLeft: '4px solid #6366F1' }}
        >
          <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
            <div style={{
              width: '50px',
              height: '50px',
              borderRadius: '14px',
              background: 'rgba(99, 102, 241, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <TrendingUp size={24} color="#6366F1" />
            </div>

            <div style={{ flex: 1 }}>
              <h3 style={{ color: '#FFF', fontSize: '15px', fontWeight: '700', margin: '0 0 6px 0' }}>
                {result.title}
              </h3>
              <p style={{ color: '#AAA', fontSize: '13px', margin: 0, lineHeight: '1.5' }}>
                {result.subtitle}
              </p>
            </div>
          </div>
        </div>
      )
    }

    // ═══════════════════════════════════════════════════════
    // 🏖️ ABSENCES
    // ═══════════════════════════════════════════════════════
    if (result.type === 'absence') {
      const statusColors = {
        approuve: '#10B981',
        en_attente: '#F59E0B',
        rejete: '#EF4444',
      }
      const statusColor = statusColors[result.status] || '#6B7280'

      return (
        <div 
          key={result.id} 
          className={`result-card-modern ${isSelected ? 'selected' : ''}`}
          onClick={() => onSelect(result)}
          style={{ borderLeft: '4px solid #8B5CF6' }}
        >
          <div style={{ display: 'flex', gap: '14px' }}>
            <div style={{
              width: '50px',
              height: '50px',
              borderRadius: '14px',
              background: result.employee?.photo_url ? 'transparent' : 'rgba(139, 92, 246, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              flexShrink: 0,
            }}>
              {result.employee?.photo_url ? (
                <img src={result.employee.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <Calendar size={24} color="#8B5CF6" />
              )}
            </div>

            <div style={{ flex: 1 }}>
              <h3 style={{ color: '#FFF', fontSize: '15px', fontWeight: '700', margin: '0 0 6px 0' }}>
                {result.employee?.first_name} {result.employee?.last_name}
              </h3>

              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{
                  padding: '4px 10px',
                  borderRadius: '8px',
                  fontSize: '10px',
                  fontWeight: '700',
                  background: `${statusColor}15`,
                  color: statusColor,
                  border: `1px solid ${statusColor}40`,
                  textTransform: 'uppercase'
                }}>
                  {result.status}
                </span>

                <span style={{ color: '#8B5CF6', fontSize: '12px', fontWeight: '600' }}>
                  {result.reason}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={14} color="#AAA" />
                <span style={{ color: '#AAA', fontSize: '12px' }}>
                  Du {new Date(result.start_date).toLocaleDateString('fr-FR')} au {new Date(result.end_date).toLocaleDateString('fr-FR')}
                </span>
              </div>
            </div>
          </div>
        </div>
      )
    }



    // ═══════════════════════════════════════════════════════
// 💰 FICHES DE PAIE
// ═══════════════════════════════════════════════════════
if (result.type === 'payslip') {
  return (
    <div 
      key={result.id} 
      className={`result-card-modern ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(result)}
      style={{ borderLeft: '4px solid #10B981' }}
    >
      <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
        <div style={{
          width: '50px',
          height: '50px',
          borderRadius: '14px',
          background: 'rgba(16, 185, 129, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <FileText size={24} color="#10B981" />
        </div>

        <div style={{ flex: 1 }}>
          <h3 style={{ color: '#FFF', fontSize: '15px', fontWeight: '700', margin: '0 0 6px 0' }}>
            Fiche de paie • {result.employee?.first_name} {result.employee?.last_name}
          </h3>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ color: '#AAA', fontSize: '12px' }}>
              {new Date(result.period_start).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
            </span>

            {result.net_salary && (
              <span style={{
                padding: '4px 10px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: '700',
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10B981',
              }}>
                {result.net_salary.toLocaleString('fr-FR')} FCFA
              </span>
            )}

            {result.employee?.matricule && (
              <span style={{ color: '#666', fontSize: '11px' }}>
                {result.employee.matricule}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

    // ═══════════════════════════════════════════════════════
    // 🔹 FALLBACK GÉNÉRIQUE
    // ═══════════════════════════════════════════════════════
    return (
      <div 
        key={result.id} 
        className={`result-card-modern ${isSelected ? 'selected' : ''}`}
        onClick={() => onSelect(result)}
      >
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
          <div style={{
            width: '50px',
            height: '50px',
            borderRadius: '14px',
            background: 'rgba(245, 158, 11, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <FileText size={24} color="#F59E0B" />
          </div>

          <div style={{ flex: 1 }}>
            <h3 style={{ color: '#FFF', fontSize: '15px', fontWeight: '700', margin: '0 0 4px 0' }}>
              {result.title || result.name || 'Résultat'}
            </h3>
            {result.subtitle && (
              <p style={{ color: '#AAA', fontSize: '13px', margin: 0 }}>
                {result.subtitle}
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="search-results-modern">
      {results.map((result, index) => renderCard(result, index))}
    </div>
  )
}