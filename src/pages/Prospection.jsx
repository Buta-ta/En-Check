// ═══════════════════════════════════════════════════════════
// 📋 PAGE PROSPECTION - ESPACE EN-CHECK V2
// Avec informations entreprise enrichies
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp, Plus, Search, X, Edit, Trash2, Save,
  ArrowLeft, Phone, Mail, MapPin, Users, Building2,
  Calendar, FileText, AlertTriangle, CheckCircle2,
  Clock, XCircle, MessageCircle, Filter, Eye,
  Briefcase, StickyNote, Globe, Link, DollarSign,
  Instagram, Facebook, Linkedin, Twitter, ExternalLink,
  Star, Target, Hash, ChevronDown, ChevronUp,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ═══════════════════════════════════════════════════════════
// 📊 CONFIG STATUTS
// ═══════════════════════════════════════════════════════════
const STATUTS = [
  { key: 'a_contacter',    label: 'À contacter',    color: '#6B7280', bg: 'rgba(107,114,128,0.12)', border: 'rgba(107,114,128,0.25)', icon: Clock },
  { key: 'contacte',       label: 'Contacté',       color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.25)',  icon: Phone },
  { key: 'en_negociation', label: 'En négociation', color: '#6366F1', bg: 'rgba(99,102,241,0.12)',  border: 'rgba(99,102,241,0.25)',  icon: MessageCircle },
  { key: 'devis_envoye',   label: 'Devis envoyé',   color: '#F97316', bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.25)',  icon: FileText },
  { key: 'signe',          label: 'Signé ✓',        color: '#10B981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.25)', icon: CheckCircle2 },
  { key: 'perdu',          label: 'Perdu',           color: '#EF4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.25)',  icon: XCircle },
]

const SECTEURS = [
  'Commerce / Retail', 'BTP / Construction', 'Banque / Finance',
  'Télécom', 'Santé / Médical', 'Éducation / Formation',
  'Administration / ONG', 'Industrie / Production',
  'Hôtellerie / Restauration', 'Transport / Logistique', 'Autre',
]

const FORMES_JURIDIQUES = [
  'SARL', 'SA', 'SAS', 'SUARL', 'GIE', 'Association / ONG',
  'Entreprise individuelle', 'Autre',
]

const NIVEAUX_CONTACT = [
  { value: 'decisionnaire', label: '⭐ Décisionnaire' },
  { value: 'influenceur',   label: '💡 Influenceur' },
  { value: 'utilisateur',   label: '👤 Utilisateur' },
  { value: 'inconnu',       label: '❓ Inconnu' },
]

const CANAUX = [
  'Réseau / Bouche-à-oreille', 'LinkedIn', 'Prospection directe',
  'Site web', 'Événement / Salon', 'Partenaire', 'Autre',
]

const POTENTIELS = [
  { value: 'fort',   label: '🔥 Fort',   color: '#10B981' },
  { value: 'moyen',  label: '⚡ Moyen',  color: '#F59E0B' },
  { value: 'faible', label: '❄️ Faible', color: '#6B7280' },
]

const FORM_INITIAL = {
  // Infos de base
  company_name: '',
  sector: '',
  city: '',
  nb_employees_estimate: '',
  nb_sites_estimate: 1,
  // Infos entreprise enrichies
  website: '',
  adresse: '',
  google_maps_url: '',
  chiffre_affaires: '',
  forme_juridique: '',
  date_creation: '',
  reseaux_sociaux: { linkedin: '', facebook: '', instagram: '', twitter: '' },
  concurrent_actuel: '',
  potentiel: '',
  canal_acquisition: '',
  niveau_contact: '',
  // Contact
  contact_name: '',
  contact_phone: '',
  contact_email: '',
  contact_role: '',
  // Suivi
  status: 'a_contacter',
  next_contact_date: '',
  notes: '',
}

export default function Prospection() {
  const [admin, setAdmin] = useState(null)
  const [prospects, setProspects] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')

  // Modals
  const [showModal, setShowModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [editingProspect, setEditingProspect] = useState(null)
  const [prospectToDelete, setProspectToDelete] = useState(null)
  const [selectedProspect, setSelectedProspect] = useState(null)

  // Section active du formulaire
  const [activeSection, setActiveSection] = useState('base')

  const [formData, setFormData] = useState(FORM_INITIAL)

  const navigate = useNavigate()

  useEffect(() => {
    const adminData = localStorage.getItem('admin')
    if (!adminData) { navigate('/login'); return }
    const parsedAdmin = JSON.parse(adminData)
    if (parsedAdmin.role !== 'super_admin') { navigate('/dashboard'); return }
    setAdmin(parsedAdmin)
    loadProspects()
  }, [navigate])

  // ─── CHARGEMENT ──────────────────────────────────────
  const loadProspects = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('prospects')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setProspects(data || [])
    } catch (error) {
      console.error('Erreur chargement prospects:', error)
      toast.error('Erreur lors du chargement')
    }
    setLoading(false)
  }

  // ─── STATS ───────────────────────────────────────────
  const stats = {
    total: prospects.length,
    en_negociation: prospects.filter(p => p.status === 'en_negociation').length,
    devis_envoye: prospects.filter(p => p.status === 'devis_envoye').length,
    signes: prospects.filter(p => p.status === 'signe').length,
    perdus: prospects.filter(p => p.status === 'perdu').length,
    a_relancer: prospects.filter(p => {
      if (!p.next_contact_date) return false
      return new Date(p.next_contact_date) <= new Date()
    }).length,
  }

  // ─── FILTRES ─────────────────────────────────────────
  const prospectsFiltres = prospects.filter(p => {
    const search = searchTerm.toLowerCase()
    const matchSearch = (
      p.company_name?.toLowerCase().includes(search) ||
      p.contact_name?.toLowerCase().includes(search) ||
      p.city?.toLowerCase().includes(search) ||
      p.sector?.toLowerCase().includes(search)
    )
    const matchStatus = filterStatus === 'all' || p.status === filterStatus
    return matchSearch && matchStatus
  })

  // ─── HELPERS ─────────────────────────────────────────
  const getStatut = (key) => STATUTS.find(s => s.key === key) || STATUTS[0]

  const formatDate = (dateStr) => {
    if (!dateStr) return null
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric'
    })
  }

  const isRelanceUrgente = (dateStr) => {
    if (!dateStr) return false
    return new Date(dateStr) <= new Date()
  }

  const getPotentielConfig = (val) =>
    POTENTIELS.find(p => p.value === val) || null

  // ─── CRUD ────────────────────────────────────────────
  const handleAdd = () => {
    setFormData(FORM_INITIAL)
    setEditingProspect(null)
    setActiveSection('base')
    setShowModal(true)
  }

  const handleEdit = (prospect) => {
    setFormData({
      company_name:       prospect.company_name || '',
      sector:             prospect.sector || '',
      city:               prospect.city || '',
      nb_employees_estimate: prospect.nb_employees_estimate || '',
      nb_sites_estimate:  prospect.nb_sites_estimate || 1,
      website:            prospect.website || '',
      adresse:            prospect.adresse || '',
      google_maps_url:    prospect.google_maps_url || '',
      chiffre_affaires:   prospect.chiffre_affaires || '',
      forme_juridique:    prospect.forme_juridique || '',
      date_creation:      prospect.date_creation || '',
      reseaux_sociaux:    prospect.reseaux_sociaux || { linkedin: '', facebook: '', instagram: '', twitter: '' },
      concurrent_actuel:  prospect.concurrent_actuel || '',
      potentiel:          prospect.potentiel || '',
      canal_acquisition:  prospect.canal_acquisition || '',
      niveau_contact:     prospect.niveau_contact || '',
      contact_name:       prospect.contact_name || '',
      contact_phone:      prospect.contact_phone || '',
      contact_email:      prospect.contact_email || '',
      contact_role:       prospect.contact_role || '',
      status:             prospect.status || 'a_contacter',
      next_contact_date:  prospect.next_contact_date || '',
      notes:              prospect.notes || '',
    })
    setEditingProspect(prospect)
    setActiveSection('base')
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!formData.company_name.trim()) {
      toast.error('Le nom de l\'entreprise est obligatoire')
      return
    }

    try {
      const dataToSave = {
        company_name:         formData.company_name.trim(),
        sector:               formData.sector || null,
        city:                 formData.city || null,
        nb_employees_estimate: parseInt(formData.nb_employees_estimate) || 0,
        nb_sites_estimate:    parseInt(formData.nb_sites_estimate) || 1,
        website:              formData.website || null,
        adresse:              formData.adresse || null,
        google_maps_url:      formData.google_maps_url || null,
        chiffre_affaires:     formData.chiffre_affaires || null,
        forme_juridique:      formData.forme_juridique || null,
        date_creation:        formData.date_creation || null,
        reseaux_sociaux:      formData.reseaux_sociaux || {},
        concurrent_actuel:    formData.concurrent_actuel || null,
        potentiel:            formData.potentiel || null,
        canal_acquisition:    formData.canal_acquisition || null,
        niveau_contact:       formData.niveau_contact || null,
        contact_name:         formData.contact_name || null,
        contact_phone:        formData.contact_phone || null,
        contact_email:        formData.contact_email || null,
        contact_role:         formData.contact_role || null,
        status:               formData.status,
        next_contact_date:    formData.next_contact_date || null,
        notes:                formData.notes || null,
        updated_at:           new Date().toISOString(),
        updated_by:           admin.id,
      }

      if (editingProspect) {
        const { error } = await supabase
          .from('prospects')
          .update(dataToSave)
          .eq('id', editingProspect.id)
        if (error) throw error
        toast.success('Prospect modifié !')
      } else {
        const { error } = await supabase
          .from('prospects')
          .insert({ ...dataToSave, created_by: admin.id })
        if (error) throw error
        toast.success('Prospect ajouté !')
      }

      setShowModal(false)
      loadProspects()
    } catch (error) {
      console.error('Erreur sauvegarde:', error)
      toast.error('Erreur lors de la sauvegarde')
    }
  }

  const handleChangeStatus = async (prospect, newStatus) => {
    try {
      const { error } = await supabase
        .from('prospects')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', prospect.id)
      if (error) throw error
      toast.success('Statut mis à jour')
      loadProspects()
      if (selectedProspect?.id === prospect.id) {
        setSelectedProspect({ ...selectedProspect, status: newStatus })
      }
    } catch {
      toast.error('Erreur mise à jour statut')
    }
  }

  const handleDelete = async () => {
    if (!prospectToDelete) return
    try {
      const { error } = await supabase
        .from('prospects')
        .delete()
        .eq('id', prospectToDelete.id)
      if (error) throw error
      toast.success('Prospect supprimé')
      setShowDeleteModal(false)
      setProspectToDelete(null)
      loadProspects()
    } catch {
      toast.error('Erreur lors de la suppression')
    }
  }

  const handleCreateDevis = (prospect) => {
    navigate(`/devis?prospect=${prospect.id}`)
  }

  // ─── SECTIONS FORMULAIRE ─────────────────────────────
  const FORM_SECTIONS = [
    { key: 'base',       label: '🏢 Entreprise',     desc: 'Infos de base' },
    { key: 'enrichi',    label: '📊 Détails',        desc: 'Infos enrichies' },
    { key: 'contact',    label: '👤 Contact',        desc: 'Personne à contacter' },
    { key: 'suivi',      label: '📅 Suivi',          desc: 'Statut commercial' },
  ]

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={{ animation: 'float 2s ease-in-out infinite' }}>
          <TrendingUp size={50} color="#10B981" />
        </div>
        <p style={styles.loadingText}>Chargement des prospects...</p>
      </div>
    )
  }

  return (
    <>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .prospect-card { transition: all 0.3s ease !important; }
        .prospect-card:hover {
          transform: translateY(-3px) !important;
          box-shadow: 0 12px 40px rgba(0,0,0,0.4) !important;
          border-color: rgba(16,185,129,0.3) !important;
        }
        .afro-action-icon { transition: all 0.2s ease !important; }
        .afro-action-icon:hover { transform: scale(1.1) !important; }
        .status-chip { transition: all 0.2s ease !important; cursor: pointer; }
        .status-chip:hover { opacity: 0.8 !important; transform: scale(1.05) !important; }
        .section-tab { transition: all 0.2s ease !important; }
        .section-tab:hover { background: rgba(16,185,129,0.08) !important; }
        .social-link:hover { opacity: 0.7 !important; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #0A0A0F; }
        ::-webkit-scrollbar-thumb { background: #10B981; border-radius: 3px; }
        select option { background: #141423; color: #E5E5E5; }
      `}</style>

      <div style={styles.container}>
        <div style={styles.bgPattern}></div>

        {/* ═══ HEADER ═══ */}
        <header style={styles.header}>
          <div style={styles.headerInner}>
            <div style={styles.headerLeft}>
              <button onClick={() => navigate('/dashboard')} style={styles.backBtn}>
                <ArrowLeft size={20} />
              </button>
              <div style={styles.logoMark}>
                <TrendingUp size={22} color="#10B981" />
              </div>
              <div>
                <h1 style={styles.headerTitle}>PROSPECTION</h1>
                <span style={styles.headerSub}>Espace En-Check</span>
              </div>
            </div>
            <button onClick={handleAdd} style={styles.addBtn}>
              <Plus size={18} />
              <span>Nouveau prospect</span>
            </button>
          </div>
        </header>

        <main style={styles.main}>

          {/* ═══ STATS ═══ */}
          <div style={styles.statsGrid}>
            {[
              { label: 'Total',          value: stats.total,           color: '#F59E0B' },
              { label: 'En négociation', value: stats.en_negociation,  color: '#6366F1' },
              { label: 'Devis envoyés',  value: stats.devis_envoye,    color: '#F97316' },
              { label: 'Signés',         value: stats.signes,          color: '#10B981' },
              { label: 'À relancer',     value: stats.a_relancer,      color: '#EF4444' },
            ].map((stat, i) => (
              <div key={i} style={{ ...styles.statCard, borderColor: stat.color + '30' }}>
                <span style={{ ...styles.statNumber, color: stat.color }}>{stat.value}</span>
                <span style={styles.statLabel}>{stat.label}</span>
              </div>
            ))}
          </div>

          {/* ═══ TOOLBAR ═══ */}
          <div style={styles.toolbar}>
            <div style={styles.searchBox}>
              <Search size={16} color="#666" />
              <input
                type="text"
                placeholder="Rechercher entreprise, contact, ville..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={styles.searchInput}
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} style={styles.clearBtn}>
                  <X size={14} />
                </button>
              )}
            </div>
            <div style={styles.filterBox}>
              <Filter size={14} color="#10B981" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                style={styles.filterSelect}
              >
                <option value="all">Tous les statuts</option>
                {STATUTS.map(s => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </div>
            <span style={styles.resultCount}>
              {prospectsFiltres.length} résultat{prospectsFiltres.length > 1 ? 's' : ''}
            </span>
          </div>

          {/* ═══ PIPELINE ═══ */}
          <div style={styles.pipelineHeader}>
            {STATUTS.map(s => {
              const count = prospects.filter(p => p.status === s.key).length
              return (
                <button
                  key={s.key}
                  onClick={() => setFilterStatus(filterStatus === s.key ? 'all' : s.key)}
                  style={{
                    ...styles.pipelineChip,
                    background: filterStatus === s.key ? s.bg : 'rgba(255,255,255,0.03)',
                    borderColor: filterStatus === s.key ? s.color + '50' : 'rgba(255,255,255,0.06)',
                    color: filterStatus === s.key ? s.color : '#666',
                  }}
                >
                  <span>{s.label}</span>
                  <span style={{
                    ...styles.pipelineCount,
                    background: filterStatus === s.key ? s.color + '20' : 'rgba(255,255,255,0.06)',
                    color: filterStatus === s.key ? s.color : '#555',
                  }}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* ═══ LISTE ═══ */}
          <div style={styles.list}>
            {prospectsFiltres.length === 0 ? (
              <div style={styles.empty}>
                <div style={styles.emptyIcon}>
                  <TrendingUp size={48} color="#10B981" />
                </div>
                <p style={styles.emptyTitle}>Aucun prospect trouvé</p>
                <p style={styles.emptySubtitle}>
                  {searchTerm || filterStatus !== 'all'
                    ? 'Modifiez vos filtres'
                    : 'Commencez par ajouter votre premier prospect'}
                </p>
                {!searchTerm && filterStatus === 'all' && (
                  <button onClick={handleAdd} style={styles.emptyBtn}>
                    <Plus size={16} /> Ajouter un prospect
                  </button>
                )}
              </div>
            ) : (
              prospectsFiltres.map((prospect, index) => {
                const statut = getStatut(prospect.status)
                const StatutIcon = statut.icon
                const urgent = isRelanceUrgente(prospect.next_contact_date)
                const potentiel = getPotentielConfig(prospect.potentiel)

                return (
                  <div
                    key={prospect.id}
                    className="prospect-card"
                    style={{
                      ...styles.card,
                      animation: `fadeInUp 0.4s ease ${index * 0.04}s forwards`,
                      opacity: 0,
                      borderLeftColor: statut.color + '60',
                    }}
                  >
                    <div style={styles.cardTop}>
                      <div style={styles.cardMain}>
                        {/* Titre */}
                        <div style={styles.cardTitleRow}>
                          <h3 style={styles.cardCompany}>{prospect.company_name}</h3>
                          <div style={{
                            ...styles.statutBadge,
                            background: statut.bg,
                            borderColor: statut.border,
                            color: statut.color,
                          }}>
                            <StatutIcon size={11} />
                            <span>{statut.label}</span>
                          </div>
                          {urgent && (
                            <div style={styles.urgentBadge}>
                              <AlertTriangle size={11} />
                              <span>À relancer</span>
                            </div>
                          )}
                          {potentiel && (
                            <span style={{
                              padding: '3px 8px', borderRadius: '6px',
                              fontSize: '10px', fontWeight: '700',
                              color: potentiel.color,
                              background: potentiel.color + '15',
                              border: `1px solid ${potentiel.color}30`,
                            }}>
                              {potentiel.label}
                            </span>
                          )}
                        </div>

                        {/* Meta */}
                        <div style={styles.cardMeta}>
                          {prospect.sector && (
                            <span style={styles.metaItem}>
                              <Briefcase size={11} /> {prospect.sector}
                            </span>
                          )}
                          {prospect.city && (
                            <span style={styles.metaItem}>
                              <MapPin size={11} /> {prospect.city}
                            </span>
                          )}
                          {prospect.nb_employees_estimate > 0 && (
                            <span style={styles.metaItem}>
                              <Users size={11} /> ~{prospect.nb_employees_estimate} emp
                            </span>
                          )}
                          {prospect.nb_sites_estimate > 0 && (
                            <span style={styles.metaItem}>
                              <Building2 size={11} /> {prospect.nb_sites_estimate} site{prospect.nb_sites_estimate > 1 ? 's' : ''}
                            </span>
                          )}
                          {prospect.chiffre_affaires && (
                            <span style={styles.metaItem}>
                              <DollarSign size={11} /> {prospect.chiffre_affaires}
                            </span>
                          )}
                          {prospect.forme_juridique && (
                            <span style={styles.metaItem}>
                              <Hash size={11} /> {prospect.forme_juridique}
                            </span>
                          )}
                        </div>

                        {/* Liens web + réseaux */}
                        {(prospect.website || prospect.reseaux_sociaux?.linkedin) && (
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                            {prospect.website && (
                              <a
                                href={prospect.website.startsWith('http') ? prospect.website : `https://${prospect.website}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ ...styles.contactLink, color: '#10B981' }}
                                onClick={e => e.stopPropagation()}
                              >
                                <Globe size={11} /> Site web
                              </a>
                            )}
                            {prospect.google_maps_url && (
                              <a
                                href={prospect.google_maps_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ ...styles.contactLink, color: '#F59E0B' }}
                                onClick={e => e.stopPropagation()}
                              >
                                <MapPin size={11} /> Google Maps
                              </a>
                            )}
                            {prospect.reseaux_sociaux?.linkedin && (
                              <a
                                href={prospect.reseaux_sociaux.linkedin}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ ...styles.contactLink, color: '#0077B5' }}
                                onClick={e => e.stopPropagation()}
                              >
                                <Linkedin size={11} /> LinkedIn
                              </a>
                            )}
                          </div>
                        )}

                        {/* Contact */}
                        {(prospect.contact_name || prospect.contact_phone) && (
                          <div style={styles.cardContact}>
                            {prospect.contact_name && (
                              <span style={styles.contactItem}>
                                👤 {prospect.contact_name}
                                {prospect.contact_role && ` · ${prospect.contact_role}`}
                                {prospect.niveau_contact && (
                                  <span style={{ color: '#888', marginLeft: '4px' }}>
                                    ({NIVEAUX_CONTACT.find(n => n.value === prospect.niveau_contact)?.label})
                                  </span>
                                )}
                              </span>
                            )}
                            {prospect.contact_phone && (
                              <a href={`tel:${prospect.contact_phone}`} style={styles.contactLink}>
                                <Phone size={11} /> {prospect.contact_phone}
                              </a>
                            )}
                            {prospect.contact_email && (
                              <a href={`mailto:${prospect.contact_email}`} style={styles.contactLink}>
                                <Mail size={11} /> {prospect.contact_email}
                              </a>
                            )}
                          </div>
                        )}

                        {/* Prochain contact */}
                        {prospect.next_contact_date && (
                          <div style={{
                            ...styles.nextContact,
                            background: urgent ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)',
                            borderColor: urgent ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)',
                            color: urgent ? '#EF4444' : '#888',
                          }}>
                            <Calendar size={11} />
                            <span>
                              {urgent ? '⚠️ Relance prévue le ' : 'Prochain contact : '}
                              {formatDate(prospect.next_contact_date)}
                            </span>
                          </div>
                        )}

                        {/* Notes */}
                        {prospect.notes && (
                          <p style={styles.cardNotes}>
                            <StickyNote size={11} color="#666" />
                            {prospect.notes.length > 120
                              ? prospect.notes.slice(0, 120) + '...'
                              : prospect.notes}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div style={styles.cardActions}>
                        <button
                          className="afro-action-icon"
                          onClick={() => { setSelectedProspect(prospect); setShowDetailModal(true) }}
                          style={{ ...styles.actionBtn, color: '#F59E0B' }}
                          title="Voir détail"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          className="afro-action-icon"
                          onClick={() => handleCreateDevis(prospect)}
                          style={{ ...styles.actionBtn, color: '#10B981' }}
                          title="Créer un devis"
                        >
                          <FileText size={16} />
                        </button>
                        <button
                          className="afro-action-icon"
                          onClick={() => handleEdit(prospect)}
                          style={{ ...styles.actionBtn, color: '#6366F1' }}
                          title="Modifier"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          className="afro-action-icon"
                          onClick={() => { setProspectToDelete(prospect); setShowDeleteModal(true) }}
                          style={{ ...styles.actionBtn, color: '#EF4444' }}
                          title="Supprimer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Statut rapide */}
                    <div style={styles.cardStatusRow}>
                      <span style={styles.statusRowLabel}>Changer statut :</span>
                      <div style={styles.statusChips}>
                        {STATUTS.map(s => (
                          <button
                            key={s.key}
                            className="status-chip"
                            onClick={() => handleChangeStatus(prospect, s.key)}
                            style={{
                              ...styles.statusChip,
                              background: prospect.status === s.key ? s.bg : 'transparent',
                              borderColor: prospect.status === s.key ? s.color + '50' : 'rgba(255,255,255,0.06)',
                              color: prospect.status === s.key ? s.color : '#555',
                              fontWeight: prospect.status === s.key ? '700' : '400',
                            }}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </main>

        {/* ═══════════════════════════════════════════════════
            MODAL ADD/EDIT - AVEC SECTIONS
        ═══════════════════════════════════════════════════ */}
        {showModal && (
          <div style={styles.overlay} onClick={() => setShowModal(false)}>
            <div style={styles.modal} onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div style={styles.modalHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={styles.modalIcon}>
                    {editingProspect
                      ? <Edit size={20} color="#10B981" />
                      : <Plus size={20} color="#10B981" />
                    }
                  </div>
                  <div>
                    <h2 style={styles.modalTitle}>
                      {editingProspect ? 'Modifier le prospect' : 'Nouveau prospect'}
                    </h2>
                    <span style={styles.modalSub}>
                      {editingProspect ? editingProspect.company_name : 'Remplissez les informations'}
                    </span>
                  </div>
                </div>
                <button onClick={() => setShowModal(false)} style={styles.closeBtn}>
                  <X size={20} />
                </button>
              </div>

              {/* Tabs sections */}
              <div style={styles.sectionTabs}>
                {FORM_SECTIONS.map(sec => (
                  <button
                    key={sec.key}
                    className="section-tab"
                    onClick={() => setActiveSection(sec.key)}
                    style={{
                      ...styles.sectionTab,
                      background: activeSection === sec.key
                        ? 'rgba(16,185,129,0.1)'
                        : 'transparent',
                      borderColor: activeSection === sec.key
                        ? 'rgba(16,185,129,0.3)'
                        : 'transparent',
                      color: activeSection === sec.key ? '#10B981' : '#666',
                    }}
                  >
                    <span style={{ fontSize: '13px', fontWeight: '600' }}>{sec.label}</span>
                    <span style={{ fontSize: '10px', opacity: 0.7 }}>{sec.desc}</span>
                  </button>
                ))}
              </div>

              <div style={styles.modalBody}>

                {/* ── SECTION BASE ── */}
                {activeSection === 'base' && (
                  <>
                    <div style={styles.sectionTitle}>🏢 Informations de base</div>

                    <div style={styles.formField}>
                      <label style={styles.label}>Nom de l'entreprise *</label>
                      <input
                        type="text"
                        value={formData.company_name}
                        onChange={e => setFormData({ ...formData, company_name: e.target.value })}
                        style={styles.input}
                        placeholder="Ex: TechSenegal SARL"
                      />
                    </div>

                    <div style={styles.formRow}>
                      <div style={styles.formField}>
                        <label style={styles.label}>Secteur</label>
                        <select
                          value={formData.sector}
                          onChange={e => setFormData({ ...formData, sector: e.target.value })}
                          style={styles.select}
                        >
                          <option value="">-- Sélectionner --</option>
                          {SECTEURS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div style={styles.formField}>
                        <label style={styles.label}>Ville</label>
                        <input
                          type="text"
                          value={formData.city}
                          onChange={e => setFormData({ ...formData, city: e.target.value })}
                          style={styles.input}
                          placeholder="Ex: Dakar"
                        />
                      </div>
                    </div>

                    <div style={styles.formRow}>
                      <div style={styles.formField}>
                        <label style={styles.label}>Nb employés (estimation)</label>
                        <input
                          type="number"
                          value={formData.nb_employees_estimate}
                          onChange={e => setFormData({ ...formData, nb_employees_estimate: e.target.value })}
                          style={styles.input}
                          placeholder="Ex: 25"
                          min="0"
                        />
                      </div>
                      <div style={styles.formField}>
                        <label style={styles.label}>Nb sites</label>
                        <input
                          type="number"
                          value={formData.nb_sites_estimate}
                          onChange={e => setFormData({ ...formData, nb_sites_estimate: e.target.value })}
                          style={styles.input}
                          placeholder="Ex: 2"
                          min="1"
                        />
                      </div>
                    </div>

                    <div style={styles.formRow}>
                      <div style={styles.formField}>
                        <label style={styles.label}>Potentiel</label>
                        <select
                          value={formData.potentiel}
                          onChange={e => setFormData({ ...formData, potentiel: e.target.value })}
                          style={styles.select}
                        >
                          <option value="">-- Évaluer --</option>
                          {POTENTIELS.map(p => (
                            <option key={p.value} value={p.value}>{p.label}</option>
                          ))}
                        </select>
                      </div>
                      <div style={styles.formField}>
                        <label style={styles.label}>Canal d'acquisition</label>
                        <select
                          value={formData.canal_acquisition}
                          onChange={e => setFormData({ ...formData, canal_acquisition: e.target.value })}
                          style={styles.select}
                        >
                          <option value="">-- Comment connu --</option>
                          {CANAUX.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    </div>
                  </>
                )}

                {/* ── SECTION ENRICHIE ── */}
                {activeSection === 'enrichi' && (
                  <>
                    <div style={styles.sectionTitle}>📊 Informations détaillées</div>

                    <div style={styles.formRow}>
                      <div style={styles.formField}>
                        <label style={styles.label}>Forme juridique</label>
                        <select
                          value={formData.forme_juridique}
                          onChange={e => setFormData({ ...formData, forme_juridique: e.target.value })}
                          style={styles.select}
                        >
                          <option value="">-- Sélectionner --</option>
                          {FORMES_JURIDIQUES.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </div>
                      <div style={styles.formField}>
                        <label style={styles.label}>Depuis (année de création)</label>
                        <input
                          type="text"
                          value={formData.date_creation}
                          onChange={e => setFormData({ ...formData, date_creation: e.target.value })}
                          style={styles.input}
                          placeholder="Ex: 2010 ou 15 ans"
                        />
                      </div>
                    </div>

                    <div style={styles.formRow}>
                      <div style={styles.formField}>
                        <label style={styles.label}>Chiffre d'affaires</label>
                        <input
                          type="text"
                          value={formData.chiffre_affaires}
                          onChange={e => setFormData({ ...formData, chiffre_affaires: e.target.value })}
                          style={styles.input}
                          placeholder="Ex: 500M FCFA / an"
                        />
                      </div>
                      <div style={styles.formField}>
                        <label style={styles.label}>Concurrent actuel</label>
                        <input
                          type="text"
                          value={formData.concurrent_actuel}
                          onChange={e => setFormData({ ...formData, concurrent_actuel: e.target.value })}
                          style={styles.input}
                          placeholder="Ex: Pointeuse Anviz, Excel..."
                        />
                      </div>
                    </div>

                    <div style={styles.formField}>
                      <label style={styles.label}>Adresse complète</label>
                      <textarea
                        value={formData.adresse}
                        onChange={e => setFormData({ ...formData, adresse: e.target.value })}
                        style={{ ...styles.input, minHeight: '70px', resize: 'vertical' }}
                        placeholder="Ex: Zone industrielle, Rue 10, Dakar"
                      />
                    </div>

                    <div style={styles.sectionTitle}>🌐 Web & Présence en ligne</div>

                    <div style={styles.formRow}>
                      <div style={styles.formField}>
                        <label style={styles.label}>
                          <Globe size={11} style={{ verticalAlign: 'middle' }} /> Site web
                        </label>
                        <input
                          type="url"
                          value={formData.website}
                          onChange={e => setFormData({ ...formData, website: e.target.value })}
                          style={styles.input}
                          placeholder="https://entreprise.sn"
                        />
                      </div>
                      <div style={styles.formField}>
                        <label style={styles.label}>
                          <MapPin size={11} style={{ verticalAlign: 'middle' }} /> Google Maps URL
                        </label>
                        <input
                          type="url"
                          value={formData.google_maps_url}
                          onChange={e => setFormData({ ...formData, google_maps_url: e.target.value })}
                          style={styles.input}
                          placeholder="https://maps.google.com/..."
                        />
                      </div>
                    </div>

                    {/* Réseaux sociaux */}
                    <div style={styles.sectionTitle}>📱 Réseaux sociaux</div>

                    <div style={styles.formRow}>
                      <div style={styles.formField}>
                        <label style={styles.label}>
                          <Linkedin size={11} style={{ verticalAlign: 'middle', color: '#0077B5' }} /> LinkedIn
                        </label>
                        <input
                          type="url"
                          value={formData.reseaux_sociaux?.linkedin || ''}
                          onChange={e => setFormData({
                            ...formData,
                            reseaux_sociaux: { ...formData.reseaux_sociaux, linkedin: e.target.value }
                          })}
                          style={styles.input}
                          placeholder="https://linkedin.com/company/..."
                        />
                      </div>
                      <div style={styles.formField}>
                        <label style={styles.label}>
                          <Facebook size={11} style={{ verticalAlign: 'middle', color: '#1877F2' }} /> Facebook
                        </label>
                        <input
                          type="url"
                          value={formData.reseaux_sociaux?.facebook || ''}
                          onChange={e => setFormData({
                            ...formData,
                            reseaux_sociaux: { ...formData.reseaux_sociaux, facebook: e.target.value }
                          })}
                          style={styles.input}
                          placeholder="https://facebook.com/..."
                        />
                      </div>
                    </div>

                    <div style={styles.formRow}>
                      <div style={styles.formField}>
                        <label style={styles.label}>
                          <Instagram size={11} style={{ verticalAlign: 'middle', color: '#E4405F' }} /> Instagram
                        </label>
                        <input
                          type="url"
                          value={formData.reseaux_sociaux?.instagram || ''}
                          onChange={e => setFormData({
                            ...formData,
                            reseaux_sociaux: { ...formData.reseaux_sociaux, instagram: e.target.value }
                          })}
                          style={styles.input}
                          placeholder="https://instagram.com/..."
                        />
                      </div>
                      <div style={styles.formField}>
                        <label style={styles.label}>
                          <Twitter size={11} style={{ verticalAlign: 'middle', color: '#1DA1F2' }} /> Twitter / X
                        </label>
                        <input
                          type="url"
                          value={formData.reseaux_sociaux?.twitter || ''}
                          onChange={e => setFormData({
                            ...formData,
                            reseaux_sociaux: { ...formData.reseaux_sociaux, twitter: e.target.value }
                          })}
                          style={styles.input}
                          placeholder="https://twitter.com/..."
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* ── SECTION CONTACT ── */}
                {activeSection === 'contact' && (
                  <>
                    <div style={styles.sectionTitle}>👤 Contact principal</div>

                    <div style={styles.formRow}>
                      <div style={styles.formField}>
                        <label style={styles.label}>Nom complet</label>
                        <input
                          type="text"
                          value={formData.contact_name}
                          onChange={e => setFormData({ ...formData, contact_name: e.target.value })}
                          style={styles.input}
                          placeholder="Ex: Moussa Diallo"
                        />
                      </div>
                      <div style={styles.formField}>
                        <label style={styles.label}>Rôle / Poste</label>
                        <input
                          type="text"
                          value={formData.contact_role}
                          onChange={e => setFormData({ ...formData, contact_role: e.target.value })}
                          style={styles.input}
                          placeholder="Ex: Directeur Général"
                        />
                      </div>
                    </div>

                    <div style={styles.formField}>
                      <label style={styles.label}>Niveau de contact</label>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {NIVEAUX_CONTACT.map(n => (
                          <button
                            key={n.value}
                            type="button"
                            onClick={() => setFormData({ ...formData, niveau_contact: n.value })}
                            style={{
                              padding: '8px 14px', borderRadius: '10px',
                              border: '1px solid',
                              borderColor: formData.niveau_contact === n.value
                                ? 'rgba(16,185,129,0.5)'
                                : 'rgba(255,255,255,0.08)',
                              background: formData.niveau_contact === n.value
                                ? 'rgba(16,185,129,0.1)'
                                : 'transparent',
                              color: formData.niveau_contact === n.value ? '#10B981' : '#888',
                              fontSize: '13px', fontWeight: '600',
                              cursor: 'pointer', fontFamily: 'inherit',
                              transition: 'all 0.2s ease',
                            }}
                          >
                            {n.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div style={styles.formRow}>
                      <div style={styles.formField}>
                        <label style={styles.label}>Téléphone</label>
                        <input
                          type="tel"
                          value={formData.contact_phone}
                          onChange={e => setFormData({ ...formData, contact_phone: e.target.value })}
                          style={styles.input}
                          placeholder="+221 77 000 00 00"
                        />
                      </div>
                      <div style={styles.formField}>
                        <label style={styles.label}>Email</label>
                        <input
                          type="email"
                          value={formData.contact_email}
                          onChange={e => setFormData({ ...formData, contact_email: e.target.value })}
                          style={styles.input}
                          placeholder="contact@entreprise.com"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* ── SECTION SUIVI ── */}
                {activeSection === 'suivi' && (
                  <>
                    <div style={styles.sectionTitle}>📅 Suivi commercial</div>

                    <div style={styles.formRow}>
                      <div style={styles.formField}>
                        <label style={styles.label}>Statut</label>
                        <select
                          value={formData.status}
                          onChange={e => setFormData({ ...formData, status: e.target.value })}
                          style={styles.select}
                        >
                          {STATUTS.map(s => (
                            <option key={s.key} value={s.key}>{s.label}</option>
                          ))}
                        </select>
                      </div>
                      <div style={styles.formField}>
                        <label style={styles.label}>Date prochain contact</label>
                        <input
                          type="date"
                          value={formData.next_contact_date}
                          onChange={e => setFormData({ ...formData, next_contact_date: e.target.value })}
                          style={styles.input}
                        />
                      </div>
                    </div>

                    <div style={styles.formField}>
                      <label style={styles.label}>Notes & Observations</label>
                      <textarea
                        value={formData.notes}
                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                        style={{ ...styles.input, minHeight: '120px', resize: 'vertical' }}
                        placeholder="Historique des échanges, points importants, prochaines étapes..."
                      />
                    </div>
                  </>
                )}
              </div>

              <div style={styles.modalFooter}>
                {/* Navigation entre sections */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  {activeSection !== 'base' && (
                    <button
                      onClick={() => {
                        const idx = FORM_SECTIONS.findIndex(s => s.key === activeSection)
                        if (idx > 0) setActiveSection(FORM_SECTIONS[idx - 1].key)
                      }}
                      style={{
                        ...styles.cancelBtn,
                        padding: '10px 16px', fontSize: '13px',
                      }}
                    >
                      ← Précédent
                    </button>
                  )}
                  {activeSection !== 'suivi' && (
                    <button
                      onClick={() => {
                        const idx = FORM_SECTIONS.findIndex(s => s.key === activeSection)
                        if (idx < FORM_SECTIONS.length - 1) setActiveSection(FORM_SECTIONS[idx + 1].key)
                      }}
                      style={{
                        ...styles.cancelBtn,
                        padding: '10px 16px', fontSize: '13px',
                      }}
                    >
                      Suivant →
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setShowModal(false)} style={styles.cancelBtn}>
                    Annuler
                  </button>
                  <button onClick={handleSave} style={styles.saveBtn}>
                    <Save size={16} />
                    {editingProspect ? 'Enregistrer' : 'Ajouter'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ MODAL DETAIL ═══ */}
        {showDetailModal && selectedProspect && (
          <div style={styles.overlay} onClick={() => setShowDetailModal(false)}>
            <div style={styles.modal} onClick={e => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    ...styles.modalIcon,
                    background: getStatut(selectedProspect.status).bg,
                  }}>
                    <Building2 size={20} color={getStatut(selectedProspect.status).color} />
                  </div>
                  <div>
                    <h2 style={styles.modalTitle}>{selectedProspect.company_name}</h2>
                    <span style={{ color: getStatut(selectedProspect.status).color, fontSize: '12px', display: 'block' }}>
                      {getStatut(selectedProspect.status).label}
                    </span>
                  </div>
                </div>
                <button onClick={() => setShowDetailModal(false)} style={styles.closeBtn}>
                  <X size={20} />
                </button>
              </div>

              <div style={styles.modalBody}>
                {/* Infos de base */}
                <div style={styles.detailGrid}>
                  {[
                    { label: 'Secteur',          value: selectedProspect.sector },
                    { label: 'Ville',             value: selectedProspect.city },
                    { label: 'Employés',          value: selectedProspect.nb_employees_estimate ? `~${selectedProspect.nb_employees_estimate}` : null },
                    { label: 'Sites',             value: selectedProspect.nb_sites_estimate },
                    { label: 'Forme juridique',   value: selectedProspect.forme_juridique },
                    { label: 'Création',          value: selectedProspect.date_creation },
                    { label: 'Chiffre d\'affaires', value: selectedProspect.chiffre_affaires },
                    { label: 'Concurrent actuel', value: selectedProspect.concurrent_actuel },
                    { label: 'Canal acquisition', value: selectedProspect.canal_acquisition },
                    { label: 'Potentiel',         value: selectedProspect.potentiel ? getPotentielConfig(selectedProspect.potentiel)?.label : null },
                  ].filter(i => i.value).map((item, i) => (
                    <div key={i} style={styles.detailItem}>
                      <span style={styles.detailLabel}>{item.label}</span>
                      <span style={styles.detailValue}>{item.value}</span>
                    </div>
                  ))}
                </div>

                {/* Adresse */}
                {selectedProspect.adresse && (
                  <>
                    <div style={styles.sectionTitle}>📍 Adresse</div>
                    <div style={styles.notesBox}>{selectedProspect.adresse}</div>
                  </>
                )}

                {/* Liens */}
                {(selectedProspect.website || selectedProspect.google_maps_url ||
                  selectedProspect.reseaux_sociaux?.linkedin ||
                  selectedProspect.reseaux_sociaux?.facebook) && (
                  <>
                    <div style={styles.sectionTitle}>🌐 Web & Réseaux</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {selectedProspect.website && (
                        <a
                          href={selectedProspect.website.startsWith('http') ? selectedProspect.website : `https://${selectedProspect.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={styles.socialLink}
                        >
                          <Globe size={14} /> Site web
                          <ExternalLink size={10} />
                        </a>
                      )}
                      {selectedProspect.google_maps_url && (
                        <a
                          href={selectedProspect.google_maps_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ ...styles.socialLink, background: 'rgba(245,158,11,0.12)', color: '#F59E0B', borderColor: 'rgba(245,158,11,0.25)' }}
                        >
                          <MapPin size={14} /> Google Maps
                          <ExternalLink size={10} />
                        </a>
                      )}
                      {selectedProspect.reseaux_sociaux?.linkedin && (
                        <a href={selectedProspect.reseaux_sociaux.linkedin} target="_blank" rel="noopener noreferrer"
                          style={{ ...styles.socialLink, background: 'rgba(0,119,181,0.12)', color: '#0077B5', borderColor: 'rgba(0,119,181,0.25)' }}>
                          <Linkedin size={14} /> LinkedIn <ExternalLink size={10} />
                        </a>
                      )}
                      {selectedProspect.reseaux_sociaux?.facebook && (
                        <a href={selectedProspect.reseaux_sociaux.facebook} target="_blank" rel="noopener noreferrer"
                          style={{ ...styles.socialLink, background: 'rgba(24,119,242,0.12)', color: '#1877F2', borderColor: 'rgba(24,119,242,0.25)' }}>
                          <Facebook size={14} /> Facebook <ExternalLink size={10} />
                        </a>
                      )}
                      {selectedProspect.reseaux_sociaux?.instagram && (
                        <a href={selectedProspect.reseaux_sociaux.instagram} target="_blank" rel="noopener noreferrer"
                          style={{ ...styles.socialLink, background: 'rgba(228,64,95,0.12)', color: '#E4405F', borderColor: 'rgba(228,64,95,0.25)' }}>
                          <Instagram size={14} /> Instagram <ExternalLink size={10} />
                        </a>
                      )}
                      {selectedProspect.reseaux_sociaux?.twitter && (
                        <a href={selectedProspect.reseaux_sociaux.twitter} target="_blank" rel="noopener noreferrer"
                          style={{ ...styles.socialLink, background: 'rgba(29,161,242,0.12)', color: '#1DA1F2', borderColor: 'rgba(29,161,242,0.25)' }}>
                          <Twitter size={14} /> Twitter <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                  </>
                )}

                {/* Contact */}
                {(selectedProspect.contact_name || selectedProspect.contact_phone) && (
                  <>
                    <div style={styles.sectionTitle}>👤 Contact</div>
                    <div style={styles.detailGrid}>
                      {[
                        { label: 'Nom',            value: selectedProspect.contact_name },
                        { label: 'Rôle',           value: selectedProspect.contact_role },
                        { label: 'Niveau contact', value: NIVEAUX_CONTACT.find(n => n.value === selectedProspect.niveau_contact)?.label },
                        { label: 'Téléphone',      value: selectedProspect.contact_phone },
                        { label: 'Email',          value: selectedProspect.contact_email },
                      ].filter(i => i.value).map((item, i) => (
                        <div key={i} style={styles.detailItem}>
                          <span style={styles.detailLabel}>{item.label}</span>
                          <span style={styles.detailValue}>{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Notes */}
                {selectedProspect.notes && (
                  <>
                    <div style={styles.sectionTitle}>📝 Notes</div>
                    <div style={styles.notesBox}>{selectedProspect.notes}</div>
                  </>
                )}

                {/* Changer statut */}
                <div style={styles.sectionTitle}>🔄 Changer le statut</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {STATUTS.map(s => (
                    <button
                      key={s.key}
                      onClick={() => handleChangeStatus(selectedProspect, s.key)}
                      style={{
                        ...styles.statusChip,
                        background: selectedProspect.status === s.key ? s.bg : 'transparent',
                        borderColor: selectedProspect.status === s.key ? s.color + '50' : 'rgba(255,255,255,0.1)',
                        color: selectedProspect.status === s.key ? s.color : '#888',
                        fontWeight: selectedProspect.status === s.key ? '700' : '400',
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={styles.modalFooter}>
                <button
                  onClick={() => { setShowDetailModal(false); handleEdit(selectedProspect) }}
                  style={styles.cancelBtn}
                >
                  <Edit size={14} /> Modifier
                </button>
                <button
                  onClick={() => { setShowDetailModal(false); handleCreateDevis(selectedProspect) }}
                  style={styles.saveBtn}
                >
                  <FileText size={16} /> Créer un devis
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ MODAL DELETE ═══ */}
        {showDeleteModal && prospectToDelete && (
          <div style={styles.overlay} onClick={() => setShowDeleteModal(false)}>
            <div style={styles.confirmModal} onClick={e => e.stopPropagation()}>
              <div style={styles.confirmIcon}>
                <AlertTriangle size={28} color="#EF4444" />
              </div>
              <h3 style={styles.confirmTitle}>Supprimer ce prospect ?</h3>
              <p style={styles.confirmText}>
                <strong style={{ color: '#F59E0B' }}>{prospectToDelete.company_name}</strong>
                <br />Cette action est irréversible.
              </p>
              <div style={styles.confirmBtns}>
                <button onClick={() => setShowDeleteModal(false)} style={styles.cancelBtn}>
                  Annuler
                </button>
                <button onClick={handleDelete} style={styles.deleteBtn}>
                  <Trash2 size={16} /> Supprimer
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
// 🎨 STYLES
// ═══════════════════════════════════════════════════════════
const styles = {
  container: {
    minHeight: '100vh', background: '#0A0A0F',
    position: 'relative', overflow: 'hidden',
  },
  bgPattern: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundImage: `
      radial-gradient(circle at 20% 30%, rgba(16,185,129,0.04) 0%, transparent 50%),
      radial-gradient(circle at 80% 70%, rgba(99,102,241,0.03) 0%, transparent 50%)
    `,
    pointerEvents: 'none', zIndex: 0,
  },
  loadingContainer: {
    minHeight: '100vh', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: '24px', background: '#0A0A0F',
  },
  loadingText: { color: '#888', fontSize: '16px', letterSpacing: '2px' },
  header: {
    background: 'rgba(15,15,25,0.95)', backdropFilter: 'blur(20px)',
    borderBottom: '1px solid rgba(16,185,129,0.15)',
    position: 'sticky', top: 0, zIndex: 100,
  },
  headerInner: {
    maxWidth: '1400px', margin: '0 auto', padding: '12px 20px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
  backBtn: {
    background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)',
    borderRadius: '10px', padding: '8px', color: '#10B981', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  logoMark: {
    width: '38px', height: '38px', borderRadius: '10px',
    background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFFFFF', fontSize: '18px', fontWeight: '700',
    letterSpacing: '3px', margin: 0,
  },
  headerSub: {
    color: '#10B981', fontSize: '10px', letterSpacing: '3px',
    textTransform: 'uppercase', fontWeight: '500',
  },
  addBtn: {
    display: 'flex', alignItems: 'center', gap: '8px',
    background: 'linear-gradient(135deg, #10B981, #059669)',
    color: '#000', padding: '10px 20px', borderRadius: '12px',
    border: 'none', fontWeight: '700', fontSize: '14px', cursor: 'pointer',
  },
  main: {
    padding: '20px', maxWidth: '1400px',
    margin: '0 auto', position: 'relative', zIndex: 1,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%,160px),1fr))',
    gap: '12px', marginBottom: '24px',
  },
  statCard: {
    background: 'rgba(20,20,35,0.8)', borderRadius: '14px',
    border: '1px solid', padding: '16px',
    display: 'flex', flexDirection: 'column', gap: '4px',
  },
  statNumber: { fontSize: '28px', fontWeight: '700', lineHeight: '1' },
  statLabel: { color: '#888', fontSize: '12px', fontWeight: '500' },
  toolbar: {
    display: 'flex', gap: '10px', marginBottom: '16px',
    flexWrap: 'wrap', alignItems: 'center',
  },
  searchBox: {
    flex: '1 1 280px', display: 'flex', alignItems: 'center', gap: '10px',
    background: 'rgba(20,20,35,0.8)', border: '1px solid rgba(255,255,255,0.06)',
    padding: '10px 14px', borderRadius: '12px',
  },
  searchInput: {
    flex: 1, border: 'none', outline: 'none',
    background: 'transparent', color: '#E5E5E5',
    fontSize: '14px', fontFamily: 'inherit',
  },
  clearBtn: {
    background: 'none', border: 'none', color: '#666',
    cursor: 'pointer', display: 'flex', alignItems: 'center',
  },
  filterBox: {
    display: 'flex', alignItems: 'center', gap: '8px',
    background: 'rgba(20,20,35,0.8)', border: '1px solid rgba(16,185,129,0.15)',
    padding: '10px 14px', borderRadius: '12px',
  },
  filterSelect: {
    background: 'transparent', border: 'none',
    color: '#E5E5E5', fontSize: '14px', cursor: 'pointer',
    outline: 'none', fontFamily: 'inherit',
  },
  resultCount: { color: '#666', fontSize: '13px', whiteSpace: 'nowrap' },
  pipelineHeader: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' },
  pipelineChip: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '8px 14px', borderRadius: '20px',
    border: '1px solid', cursor: 'pointer',
    fontSize: '12px', fontWeight: '600',
    transition: 'all 0.2s ease', background: 'transparent',
  },
  pipelineCount: {
    padding: '2px 8px', borderRadius: '10px',
    fontSize: '11px', fontWeight: '700',
  },
  list: { display: 'flex', flexDirection: 'column', gap: '10px' },
  empty: {
    textAlign: 'center', padding: '60px 20px',
    background: 'rgba(20,20,35,0.6)', borderRadius: '20px',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  emptyIcon: {
    width: '80px', height: '80px', borderRadius: '20px',
    background: 'rgba(16,185,129,0.08)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 20px',
  },
  emptyTitle: { color: '#FFFFFF', fontSize: '18px', fontWeight: '600', margin: '0 0 8px' },
  emptySubtitle: { color: '#666', fontSize: '14px', margin: '0 0 24px' },
  emptyBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '8px',
    background: 'linear-gradient(135deg, #10B981, #059669)',
    color: '#000', padding: '12px 24px', borderRadius: '12px',
    border: 'none', fontWeight: '700', fontSize: '14px', cursor: 'pointer',
  },
  card: {
    background: 'rgba(20,20,35,0.7)', backdropFilter: 'blur(10px)',
    borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)',
    borderLeft: '3px solid', padding: '18px 20px',
    display: 'flex', flexDirection: 'column', gap: '14px',
  },
  cardTop: {
    display: 'flex', gap: '16px',
    justifyContent: 'space-between', alignItems: 'flex-start',
  },
  cardMain: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '8px' },
  cardTitleRow: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  cardCompany: { color: '#FFFFFF', fontSize: '16px', fontWeight: '700', margin: 0 },
  statutBadge: {
    display: 'inline-flex', alignItems: 'center', gap: '5px',
    padding: '4px 12px', borderRadius: '20px',
    fontSize: '11px', fontWeight: '700', border: '1px solid',
  },
  urgentBadge: {
    display: 'inline-flex', alignItems: 'center', gap: '5px',
    padding: '4px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: '700',
    background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444',
  },
  cardMeta: { display: 'flex', flexWrap: 'wrap', gap: '10px' },
  metaItem: {
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    color: '#888', fontSize: '12px',
  },
  cardContact: { display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' },
  contactItem: { color: '#E5E5E5', fontSize: '12px', fontWeight: '500' },
  contactLink: {
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    color: '#10B981', fontSize: '12px', textDecoration: 'none', fontWeight: '500',
  },
  nextContact: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '5px 12px', borderRadius: '8px',
    border: '1px solid', fontSize: '12px', width: 'fit-content',
  },
  cardNotes: {
    display: 'flex', alignItems: 'flex-start', gap: '6px',
    color: '#666', fontSize: '12px', margin: 0, lineHeight: '1.5',
  },
  cardActions: {
    display: 'flex', gap: '6px', flexShrink: 0, flexDirection: 'column',
  },
  actionBtn: {
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '8px', padding: '8px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  cardStatusRow: {
    display: 'flex', alignItems: 'center', gap: '10px',
    paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.04)',
    flexWrap: 'wrap',
  },
  statusRowLabel: { color: '#555', fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' },
  statusChips: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  statusChip: {
    padding: '4px 10px', borderRadius: '8px', border: '1px solid',
    cursor: 'pointer', fontSize: '11px', transition: 'all 0.2s ease',
    background: 'transparent',
  },
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '16px', zIndex: 1000, animation: 'fadeIn 0.2s ease',
  },
  modal: {
    background: '#0F0F19', border: '1px solid rgba(16,185,129,0.15)',
    borderRadius: '24px', width: '100%', maxWidth: '640px',
    maxHeight: '90vh', overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 20px 80px rgba(0,0,0,0.6)',
  },
  modalHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0,
  },
  modalIcon: {
    width: '42px', height: '42px', borderRadius: '12px',
    background: 'rgba(16,185,129,0.12)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  modalTitle: { color: '#FFFFFF', fontSize: '18px', fontWeight: '700', margin: 0 },
  modalSub: { color: '#666', fontSize: '12px', marginTop: '2px', display: 'block' },
  closeBtn: {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '10px', padding: '8px', color: '#888', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },

  // Tabs sections formulaire
  sectionTabs: {
    display: 'flex', gap: '2px', padding: '8px 12px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    flexShrink: 0, flexWrap: 'wrap',
  },
  sectionTab: {
    display: 'flex', flexDirection: 'column', gap: '1px',
    padding: '8px 14px', borderRadius: '8px',
    border: '1px solid transparent',
    cursor: 'pointer', fontFamily: 'inherit',
    flex: '1 1 auto', alignItems: 'center',
    transition: 'all 0.2s ease', background: 'transparent',
  },

  modalBody: {
    padding: '20px 24px', overflow: 'auto', flex: 1,
    display: 'flex', flexDirection: 'column', gap: '14px',
  },
  modalFooter: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    gap: '12px', padding: '16px 24px',
    borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0,
  },
  sectionTitle: {
    color: '#888', fontSize: '11px', fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: '1px',
    paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  formField: { display: 'flex', flexDirection: 'column', gap: '6px' },
  formRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  label: {
    color: '#888', fontSize: '11px', fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: '0.5px',
    display: 'flex', alignItems: 'center', gap: '4px',
  },
  input: {
    padding: '11px 14px', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '10px', fontSize: '14px', outline: 'none',
    width: '100%', boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.04)', color: '#E5E5E5', fontFamily: 'inherit',
  },
  select: {
    padding: '11px 14px', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '10px', fontSize: '14px', outline: 'none',
    background: 'rgba(255,255,255,0.04)', color: '#E5E5E5',
    width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', cursor: 'pointer',
  },
  cancelBtn: {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '12px 20px', background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)', color: '#E5E5E5',
    borderRadius: '12px', fontWeight: '600', fontSize: '14px',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  saveBtn: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '12px 24px', background: 'linear-gradient(135deg, #10B981, #059669)',
    color: '#000', border: 'none', borderRadius: '12px',
    fontWeight: '700', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit',
  },
  deleteBtn: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '12px 24px', background: 'linear-gradient(135deg, #EF4444, #B91C1C)',
    color: '#FFF', border: 'none', borderRadius: '12px',
    fontWeight: '700', fontSize: '14px', cursor: 'pointer',
  },
  confirmModal: {
    background: '#141423', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '24px', width: '100%', maxWidth: '420px',
    padding: '36px', textAlign: 'center',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  },
  confirmIcon: {
    width: '64px', height: '64px', borderRadius: '18px',
    background: 'rgba(239,68,68,0.12)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 20px',
  },
  confirmTitle: { color: '#FFFFFF', fontSize: '20px', fontWeight: '700', marginBottom: '12px' },
  confirmText: { color: '#888', marginBottom: '28px', lineHeight: '1.6', fontSize: '14px' },
  confirmBtns: { display: 'flex', gap: '12px' },
  detailGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: '10px',
  },
  detailItem: {
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: '10px', padding: '12px',
    display: 'flex', flexDirection: 'column', gap: '4px',
  },
  detailLabel: { color: '#666', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  detailValue: { color: '#FFFFFF', fontSize: '14px', fontWeight: '600' },
  notesBox: {
    padding: '14px 16px', background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px',
    color: '#888', fontSize: '13px', lineHeight: '1.6',
  },
  socialLink: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '6px 14px', borderRadius: '8px',
    background: 'rgba(16,185,129,0.12)', color: '#10B981',
    border: '1px solid rgba(16,185,129,0.25)',
    textDecoration: 'none', fontSize: '12px', fontWeight: '600',
    transition: 'opacity 0.2s ease',
  },
}