// ═══════════════════════════════════════════════════════════
// 📢 PAGE MESSAGES SYSTÈME (SuperAdmin uniquement)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import { AlertTriangle, Info, Wrench, Trash2, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'

export default function SystemMessages() {
    const [admin, setAdmin] = useState(null)
    const [messages, setMessages] = useState([])
    const [loading, setLoading] = useState(true)
    const [formData, setFormData] = useState({
        type: 'info',
        titre: '',
        message: '',
        date_debut: '',
        date_fin: '',
        priorite: 'normale',
        cible: 'tous'
    })

    const navigate = useNavigate()

    useEffect(() => {
        const adminData = localStorage.getItem('admin')
        if (!adminData) {
            navigate('/login')
            return
        }

        const parsedAdmin = JSON.parse(adminData)

        // Seul le super admin peut accéder
        if (parsedAdmin.role !== 'super_admin') {
            toast.error('Accès réservé au Super Admin')
            navigate('/dashboard')
            return
        }

        setAdmin(parsedAdmin)
        fetchMessages()
    }, [navigate])

    const fetchMessages = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('messages_systeme')
            .select('*')
            .order('created_at', { ascending: false })

        if (data) setMessages(data)
        setLoading(false)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (!formData.titre || !formData.message) {
            toast.error('Titre et message obligatoires')
            return
        }

        // Fonction pour garder l'heure locale sans conversion UTC
        const formatDateTimeLocal = (localDateTime) => {
  if (!localDateTime) return null
  
  // Parser manuellement "2026-02-01T14:30"
  const [datePart, timePart] = localDateTime.split('T')
  
  // Construire directement la chaîne UTC SANS conversion
  return `${datePart} ${timePart}:00+00:00`
}

        const dataToInsert = {
            type: formData.type,
            titre: formData.titre,
            message: formData.message,
            date_debut: formatDateTimeLocal(formData.date_debut),
            date_fin: formatDateTimeLocal(formData.date_fin),
            priorite: formData.priorite,
            cible: formData.cible,
            created_by: admin.id,
            is_active: true
        }
        console.log('📤 Data envoyée à Supabase:', dataToInsert)
        const { error } = await supabase
            .from('messages_systeme')
            .insert([dataToInsert])

        if (error) {
            toast.error('Erreur création message')
            console.error(error)
            return
        }

        toast.success('Message créé avec succès !')
        fetchMessages()

        // Reset form
        setFormData({
            type: 'info',
            titre: '',
            message: '',
            date_debut: '',
            date_fin: '',
            priorite: 'normale',
            cible: 'tous'
        })
    }

    const toggleActive = async (id, currentStatus) => {
        const { error } = await supabase
            .from('messages_systeme')
            .update({ is_active: !currentStatus })
            .eq('id', id)

        if (error) {
            toast.error('Erreur mise à jour')
            return
        }

        toast.success(currentStatus ? 'Message désactivé' : 'Message activé')
        fetchMessages()
    }

    const handleDelete = async (id) => {
        if (!confirm('Supprimer ce message ?')) return

        const { error } = await supabase
            .from('messages_systeme')
            .delete()
            .eq('id', id)

        if (error) {
            toast.error('Erreur suppression')
            return
        }

        toast.success('Message supprimé')
        fetchMessages()
    }

    const getIcon = (type) => {
        switch (type) {
            case 'maintenance': return <Wrench size={20} />
            case 'mise_a_jour': return <Info size={20} />
            default: return <Info size={20} />
        }
    }

    const getPriorityColor = (priorite) => {
        switch (priorite) {
            case 'haute': return '#9B2C2C'
            case 'normale': return '#8B6914'
            case 'basse': return '#4A7C59'
            default: return '#8B6914'
        }
    }

    if (loading) {
        return <div style={styles.loading}>Chargement...</div>
    }

    return (
        <div style={styles.container}>
            <PageHeader title="MESSAGES SYSTÈME" />

            <main style={styles.main}>
                {/* Formulaire création */}
                <div style={styles.formCard}>
                    <h2 style={styles.sectionTitle}>📢 Nouveau Message</h2>

                    <form onSubmit={handleSubmit} style={styles.form}>
                        <div style={styles.row}>
                            <div style={styles.field}>
                                <label style={styles.label}>Type</label>
                                <select
                                    value={formData.type}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                    style={styles.select}
                                >
                                    <option value="info">Information</option>
                                    <option value="maintenance">Maintenance</option>
                                    <option value="mise_a_jour">Mise à jour</option>
                                </select>
                            </div>

                            <div style={styles.field}>
                                <label style={styles.label}>Priorité</label>
                                <select
                                    value={formData.priorite}
                                    onChange={(e) => setFormData({ ...formData, priorite: e.target.value })}
                                    style={styles.select}
                                >
                                    <option value="basse">Basse</option>
                                    <option value="normale">Normale</option>
                                    <option value="haute">Haute</option>
                                </select>
                            </div>

                            <div style={styles.field}>
                                <label style={styles.label}>Cible</label>
                                <select
                                    value={formData.cible}
                                    onChange={(e) => setFormData({ ...formData, cible: e.target.value })}
                                    style={styles.select}
                                >
                                    <option value="tous">Tous</option>
                                    <option value="admins">Admins uniquement</option>
                                    <option value="employes">Employés uniquement</option>
                                </select>
                            </div>
                        </div>

                        <div style={styles.field}>
                            <label style={styles.label}>Titre</label>
                            <input
                                type="text"
                                value={formData.titre}
                                onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
                                placeholder="Ex: Maintenance prévue le 25 janvier"
                                style={styles.input}
                                required
                            />
                        </div>

                        <div style={styles.field}>
                            <label style={styles.label}>Message</label>
                            <textarea
                                value={formData.message}
                                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                placeholder="Détails du message..."
                                style={styles.textarea}
                                rows="4"
                                required
                            />
                        </div>

                        <div style={styles.row}>
                            <div style={styles.field}>
                                <label style={styles.label}>Date début (optionnel)</label>
                                <input
                                    type="datetime-local"
                                    value={formData.date_debut}
                                    onChange={(e) => setFormData({ ...formData, date_debut: e.target.value })}
                                    style={styles.input}
                                />
                            </div>

                            <div style={styles.field}>
                                <label style={styles.label}>Date fin (optionnel)</label>
                                <input
                                    type="datetime-local"
                                    value={formData.date_fin}
                                    onChange={(e) => setFormData({ ...formData, date_fin: e.target.value })}
                                    style={styles.input}
                                />
                            </div>
                        </div>

                        <button type="submit" style={styles.submitBtn}>
                            Publier le message
                        </button>
                    </form>
                </div>

                {/* Liste messages */}
                <div style={styles.listCard}>
                    <h2 style={styles.sectionTitle}>📋 Messages existants</h2>

                    {messages.length === 0 ? (
                        <p style={styles.empty}>Aucun message créé</p>
                    ) : (
                        <div style={styles.messagesList}>
                            {messages.map(msg => (
                                <div
                                    key={msg.id}
                                    style={{
                                        ...styles.messageItem,
                                        borderLeft: `4px solid ${getPriorityColor(msg.priorite)}`
                                    }}
                                >
                                    <div style={styles.messageHeader}>
                                        <div style={styles.messageHeaderLeft}>
                                            {getIcon(msg.type)}
                                            <span style={styles.messageTitle}>{msg.titre}</span>
                                        </div>
                                        <div style={styles.badges}>
                                            <span style={styles.badge}>{msg.type}</span>
                                            <span style={styles.badge}>{msg.cible}</span>
                                            <span style={{
                                                ...styles.badge,
                                                background: msg.is_active ? '#DEF7EC' : '#FEE2E2',
                                                color: msg.is_active ? '#03543F' : '#9B2C2C'
                                            }}>
                                                {msg.is_active ? 'Actif' : 'Inactif'}
                                            </span>
                                        </div>
                                    </div>

                                    <p style={styles.messageText}>{msg.message}</p>

                                    {(msg.date_debut || msg.date_fin) && (
                                        <p style={styles.messageDates}>
                                            {msg.date_debut && `Du ${new Date(msg.date_debut).toLocaleString('fr-FR', { timeZone: 'UTC' })}`}
                                            {msg.date_fin && ` au ${new Date(msg.date_fin).toLocaleString('fr-FR', { timeZone: 'UTC' })}`}
                                        </p>
                                    )}

                                    <div style={styles.messageActions}>
                                        <button
                                            onClick={() => toggleActive(msg.id, msg.is_active)}
                                            style={styles.actionBtn}
                                            title={msg.is_active ? 'Désactiver' : 'Activer'}
                                        >
                                            {msg.is_active ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                        <button
                                            onClick={() => handleDelete(msg.id)}
                                            style={{ ...styles.actionBtn, color: '#9B2C2C' }}
                                            title="Supprimer"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}

const styles = {
    container: { minHeight: '100vh', background: '#E5D4C0' },
    loading: { display: 'flex', justifyContent: 'center', padding: '60px', color: '#8B6914' },
    main: { padding: '24px', maxWidth: '1200px', margin: '0 auto' },

    formCard: { background: '#FFFBF5', borderRadius: '16px', padding: '24px', marginBottom: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
    listCard: { background: '#FFFBF5', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },

    sectionTitle: { fontSize: '20px', fontWeight: '600', color: '#3D2B1F', marginBottom: '20px' },

    form: { display: 'flex', flexDirection: 'column', gap: '16px' },
    row: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' },
    field: { display: 'flex', flexDirection: 'column' },
    label: { fontSize: '14px', fontWeight: '500', color: '#3D2B1F', marginBottom: '6px' },
    input: { padding: '10px 12px', border: '2px solid #C4A574', borderRadius: '8px', fontSize: '15px', outline: 'none' },
    select: { padding: '10px 12px', border: '2px solid #C4A574', borderRadius: '8px', fontSize: '15px', outline: 'none', cursor: 'pointer' },
    textarea: { padding: '10px 12px', border: '2px solid #C4A574', borderRadius: '8px', fontSize: '15px', outline: 'none', resize: 'vertical' },

    submitBtn: { padding: '14px', background: '#8B6914', color: '#FFFBF5', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', marginTop: '8px' },

    empty: { textAlign: 'center', padding: '40px', color: '#9E9E9E' },

    messagesList: { display: 'flex', flexDirection: 'column', gap: '12px' },
    messageItem: { background: '#F9FAFB', padding: '16px', borderRadius: '12px', position: 'relative' },

    messageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' },
    messageHeaderLeft: { display: 'flex', alignItems: 'center', gap: '8px' },
    messageTitle: { fontWeight: '600', color: '#3D2B1F', fontSize: '15px' },

    badges: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
    badge: { padding: '4px 10px', background: '#E5D4C0', color: '#3D2B1F', borderRadius: '12px', fontSize: '12px', fontWeight: '500' },

    messageText: { color: '#4B5563', fontSize: '14px', marginBottom: '8px', lineHeight: '1.5' },
    messageDates: { fontSize: '12px', color: '#9E9E9E', marginBottom: '12px' },

    messageActions: { display: 'flex', gap: '8px' },
    actionBtn: { background: 'none', border: 'none', color: '#8B6914', cursor: 'pointer', padding: '6px' },
}