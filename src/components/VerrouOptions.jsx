// src/components/VerrouOptions.jsx
//
// ═══════════════════════════════════════════════════════════════════════════
// 💼 LE VERROU DES OPTIONS PAYANTES
// ═══════════════════════════════════════════════════════════════════════════
//
// À QUOI ÇA SERT
//
// Une option payante qu'une entreprise n'a pas achetée ne s'affiche pas dans
// le menu : c'est déjà le cas. Mais rien n'empêche quelqu'un de taper son
// adresse directement dans la barre du navigateur, ou d'ouvrir un lien qu'un
// collègue lui a envoyé. Ce composant ferme cette porte : quand l'adresse
// demandée ouvre une option que l'entreprise n'a pas, on explique pourquoi
// au lieu d'ouvrir l'écran.
//
// COMMENT ÇA MARCHE
//
// Une table de correspondance : ADRESSES donne, pour chaque adresse
// d'écran, l'interrupteur qui la commande sur la fiche entreprise. Quand
// l'adresse change, on demande à la base si l'interrupteur est allumé, et
// c'est tout.
//
// LES TROIS RÈGLES QUE RIEN NE DOIT CASSER
//
//   ① le super administrateur passe partout : c'est lui qui vend les
//     options, il doit pouvoir les voir et les essayer chez tout le monde ;
//   ② on ne bloque QUE ce qu'on a réellement lu éteint. Si la base ne répond
//     pas, si l'interrupteur n'existe pas encore, si l'entreprise est
//     inconnue : on laisse passer. Un verrou qui se referme tout seul sur une
//     panne de réseau est pire qu'un verrou ouvert ;
//   ③ l'écran bloqué dit QUOI demander et À QUI. Ce n'est jamais un mur
//     sans explication.
//
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Lock, ArrowLeft } from 'lucide-react'

// ─── Adresse de l'écran → interrupteur sur la fiche entreprise ──────────────
//  Une adresse absente de cette table n'est jamais bloquée.
const ADRESSES = {
  '/planning': 'module_planning',
  '/retards': 'module_retards',
  '/heures-supplementaires': 'module_heures_supplementaires',
  '/absences': 'module_conges',
  '/fiches-paie': 'module_fiches_paie',
  '/remunerations': 'module_remunerations',
  '/cout-salarial': 'module_cout_salarial',
  '/configuration-fiscale': 'module_config_fiscale',
  '/geofencing': 'module_geolocalisation',
  '/carte-temps-reel': 'module_carte_temps_reel',
  '/enrollements-faciaux': 'module_reconnaissance_faciale',
  '/config-reco-faciale': 'module_reconnaissance_faciale',
  '/pointeuses': 'module_pointeuses',
  '/poste': 'module_poste_pointage',
  '/taches': 'module_taches',
  '/equipes': 'module_taches',
  '/predictions': 'module_predictions',
}

// ─── Ce qu'on appelle chaque option, pour pouvoir en parler ─────────────────
const LIBELLES = {
  module_planning: 'Planning',
  module_retards: 'Retards',
  module_heures_supplementaires: 'Heures supplémentaires',
  module_conges: 'Congés et absences',
  module_fiches_paie: 'Fiches de paie',
  module_remunerations: 'Rémunérations',
  module_cout_salarial: 'Coût salarial',
  module_config_fiscale: 'Configuration fiscale',
  module_geolocalisation: 'Geofencing',
  module_carte_temps_reel: 'Carte temps réel',
  module_reconnaissance_faciale: 'Reconnaissance faciale',
  module_pointeuses: 'Pointeuses',
  module_poste_pointage: 'Poste de pointage',
  module_taches: 'Équipes et tâches',
  module_predictions: 'Prédictions',
}

// ─── La mémoire : on ne redemande pas à chaque clic ─────────────────────────
//  Une minute. Au-delà, on redemande : une option rallumée par le super
//  administrateur est visible sans vider le cache du navigateur.
const DUREE_MEMOIRE = 60 * 1000
let memoire = { cle: null, valeur: null, quand: 0 }

export function viderMemoireOptions() {
  memoire = { cle: null, valeur: null, quand: 0 }
}

function lire(cle) {
  try {
    return JSON.parse(localStorage.getItem(cle) || 'null')
  } catch {
    return null
  }
}

// ─── De quelle entreprise parle-t-on ? ──────────────────────────────────────
//  Deux cas : un administrateur connecté (l'entreprise qu'il a ouverte), ou
//  la tablette du poste de pointage (l'entreprise à laquelle elle est liée).
function entrepriseCourante(adresse) {
  const poste = lire('encheck_poste')
  if (adresse === '/poste' && poste && poste.enterprise_id) {
    return poste.enterprise_id
  }

  const admin = lire('admin')
  if (!admin) return null
  return (
    admin?.selectedEnterprise?.id ||
    admin?.enterprise_id ||
    (Array.isArray(admin?.entreprises) && admin.entreprises[0]?.id) ||
    null
  )
}

// ─── L'interrupteur est-il allumé ? ─────────────────────────────────────────
//  Répond `true`, `false`, ou `null` quand on n'a pas réussi à le lire — et
//  `null` ne bloque jamais rien.
async function interrupteurAllume(entreprise, code) {
  if (!entreprise || !code) return null

  const cle = `${entreprise}|${code}`
  if (memoire.cle === cle && typeof memoire.valeur === 'boolean' && Date.now() - memoire.quand < DUREE_MEMOIRE) {
    return memoire.valeur
  }

  //  ① la fonction prévue pour ça : elle lit l'interrupteur sans jamais
  //     présumer de son nom, et répond « éteint » s'il n'existe pas.
  try {
    const { data, error } = await supabase.rpc('encheck_module_actif', {
      p_enterprise: entreprise,
      p_module: code,
    })
    if (!error && typeof data === 'boolean') {
      memoire = { cle, valeur: data, quand: Date.now() }
      return data
    }
  } catch {
    /* la fonction n'est pas encore sur cette base : on essaie la lecture directe */
  }

  //  ② à défaut, la fiche entreprise elle-même.
  try {
    const { data, error } = await supabase
      .from('enterprises')
      .select('*')
      .eq('id', entreprise)
      .maybeSingle()
    if (!error && data && typeof data[code] === 'boolean') {
      memoire = { cle, valeur: data[code], quand: Date.now() }
      return data[code]
    }
  } catch {
    /* on n'a pas réussi à lire : on laisse passer */
  }

  return null
}

// ═══════════════════════════════════════════════════════════════════════════
// LE COMPOSANT
// ═══════════════════════════════════════════════════════════════════════════
export default function VerrouOptions({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [resultat, setResultat] = useState({ adresse: null, bloque: null })

  const adresse = (location.pathname || '').replace(/\/+$/, '') || '/'
  const code = Object.prototype.hasOwnProperty.call(ADRESSES, adresse) ? ADRESSES[adresse] : null

  //  ① le super administrateur passe partout : c'est lui qui vend les options.
  const admin = lire('admin')
  const passePartout = !!(admin && admin.role === 'super_admin')
  const besoin = !!code && !passePartout

  useEffect(() => {
    let annule = false

    const verifier = async () => {
      if (!besoin) {
        setResultat({ adresse, bloque: null })
        return
      }

      const entreprise = entrepriseCourante(adresse)
      const allume = await interrupteurAllume(entreprise, code)

      if (annule) return
      //  ② on ne bloque que ce qu'on a réellement lu éteint.
      setResultat({ adresse, bloque: allume === false ? code : null })
    }

    verifier()

    return () => {
      annule = true
    }
  }, [adresse, code, besoin])

  //  Calculé pendant l'affichage, pas après : l'écran ne s'ouvre jamais une
  //  demi-seconde avant de se refermer.
  const pret = resultat.adresse === adresse
  const bloque = pret ? resultat.bloque : null

  //  Tant qu'on n'a pas la réponse, on n'affiche rien plutôt que d'ouvrir une
  //  porte qu'on devrait refermer dans la foulée.
  if (besoin && !pret) {
    return (
      <div style={styles.attente}>
        <div style={styles.attenteCercle} />
        <style>{`@keyframes enchecktourne { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  if (!bloque) return children

  //  ③ l'écran bloqué dit quoi demander, et à qui.
  const ouAller = adresse === '/poste' ? null : '/dashboard'

  return (
    <div style={styles.fond}>
      <div style={styles.carte}>
        <div style={styles.pastille}>
          <Lock size={26} color="#F59E0B" />
        </div>

        <h1 style={styles.titre}>{LIBELLES[bloque] || 'Cette option'}</h1>

        <p style={styles.texte}>
          Cette option n'est pas activée sur votre entreprise. Elle fait partie des modules
          qui s'ajoutent à votre formule.
        </p>

        <p style={styles.texteDoux}>
          Rien n'est perdu : vos pointages, vos employés et vos rapports sont intacts. Il suffit
          de demander l'activation à l'équipe En-Check, et l'écran s'ouvre.
        </p>

        {ouAller && (
          <button style={styles.bouton} onClick={() => navigate(ouAller)}>
            <ArrowLeft size={18} />
            Retour au tableau de bord
          </button>
        )}
      </div>
    </div>
  )
}

const styles = {
  attente: {
    minHeight: '100vh',
    background: '#0A0A0F',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attenteCercle: {
    width: '40px',
    height: '40px',
    border: '3px solid rgba(245,158,11,0.2)',
    borderTopColor: '#F59E0B',
    borderRadius: '50%',
    animation: 'enchecktourne 0.8s linear infinite',
  },
  fond: {
    minHeight: '100vh',
    background: '#0A0A0F',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  },
  carte: {
    width: '100%',
    maxWidth: '520px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(245,158,11,0.25)',
    borderRadius: '20px',
    padding: '40px 32px',
    textAlign: 'center',
  },
  pastille: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    background: 'rgba(245,158,11,0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 20px',
  },
  titre: {
    margin: '0 0 14px',
    fontSize: '24px',
    fontWeight: '700',
    color: '#F5F5F5',
  },
  texte: {
    margin: '0 0 12px',
    fontSize: '15px',
    lineHeight: '1.6',
    color: '#C9C9C9',
  },
  texteDoux: {
    margin: '0 0 26px',
    fontSize: '14px',
    lineHeight: '1.6',
    color: '#8A8A8A',
  },
  bouton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 22px',
    background: '#F59E0B',
    color: '#1A1206',
    border: 'none',
    borderRadius: '10px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
  },
}
