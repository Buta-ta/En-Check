// ═══════════════════════════════════════════════════════════
// LE BANDEAU DES MESSAGES SYSTÈME
//
// Le défaut réparé : ce bandeau peignait ses propres couleurs
// claires sur des fonds sombres, en style en ligne. En mode clair,
// « Mises à jour en cours » devenait illisible. Ici, plus une seule
// couleur en dur : des jetons de thème, et le même dessin le jour
// et la nuit. Le bouton de fermeture existe sur tous les messages,
// y compris ceux de priorité haute.
// ═══════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { AlertTriangle, Bell, Info, Wrench, X, Zap } from 'lucide-react'
import { estDansPlageHoraire } from '../utils/timezoneUtils'
import './SystemMessageBanner.css'

const ICONES = {
  maintenance: Wrench,
  mise_a_jour: Zap,
  info: Info,
  alert: AlertTriangle,
}

const CLE_SESSION = 'dismissed_messages'

function lireMessagesFermes() {
  try {
    const brut = sessionStorage.getItem(CLE_SESSION)
    return brut ? JSON.parse(brut) : []
  } catch {
    return []
  }
}

export default function SystemMessageBanner({ userType = 'admins' }) {
  const [messages, setMessages] = useState([])
  const [dismissedIds, setDismissedIds] = useState(lireMessagesFermes)

  useEffect(() => {
    let vivant = true

    const charger = async () => {
      let requete = supabase
        .from('messages_systeme')
        .select('*')
        .eq('is_active', true)

      requete = userType === 'admins'
        ? requete.in('cible', ['tous', 'admins'])
        : requete.in('cible', ['tous', 'employes'])

      const { data } = await requete.order('priorite', { ascending: false })
      if (!vivant || !data) return
      setMessages(data.filter((message) => estDansPlageHoraire(message.date_debut, message.date_fin)))
    }

    charger()

    const canal = supabase
      .channel('system_messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages_systeme' }, charger)
      .subscribe()

    return () => {
      vivant = false
      supabase.removeChannel(canal)
    }
  }, [userType])

  const fermer = (id) => {
    const suites = [...dismissedIds, id]
    setDismissedIds(suites)
    try {
      sessionStorage.setItem(CLE_SESSION, JSON.stringify(suites))
    } catch {
      // Un navigateur qui refuse le stockage ne doit pas bloquer le bandeau.
    }
  }

  const visibles = messages.filter((message) => !dismissedIds.includes(message.id))
  if (visibles.length === 0) return null

  return (
    <div className="bandeau-systeme">
      {visibles.map((message, index) => {
        const Icone = ICONES[message.type] || Bell
        return (
          <article
            key={message.id}
            className="bandeau-message"
            data-type={message.type || 'info'}
            data-priorite={message.priorite || 'normale'}
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <span className="bandeau-trait" aria-hidden="true" />
            <span className="bandeau-icone" aria-hidden="true"><Icone size={17} /></span>
            <div className="bandeau-texte">
              <div className="bandeau-titre-ligne">
                <h3 className="bandeau-titre">{message.titre}</h3>
                {message.priorite === 'haute' && (
                  <span className="bandeau-urgence">
                    <AlertTriangle size={11} aria-hidden="true" />
                    Urgent
                  </span>
                )}
              </div>
              <p className="bandeau-texte-corps">{message.message}</p>
            </div>
            <button
              type="button"
              className="bandeau-fermer"
              onClick={() => fermer(message.id)}
              aria-label={`Fermer le message : ${message.titre}`}
              title="Fermer"
            >
              <X size={15} aria-hidden="true" />
            </button>
          </article>
        )
      })}
    </div>
  )
}
