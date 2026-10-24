// ═══════════════════════════════════════════════════════════
// 📡 DIRECT DES POINTAGES
//
// CE QUI ÉTAIT CASSÉ
// ────────────────────────────────────────────────────────────
// L'écran Pointages ouvrait UN SEUL canal portant DEUX
// abonnements : `attendances` et `encheck_pauses`. Sur Supabase,
// l'abonnement se négocie en bloc : `encheck_pauses` n'étant pas
// dans la publication temps réel, le serveur refusait le canal
// ENTIER. Les pointages — pourtant, eux, bien publiés — cessèrent
// aussi d'arriver.
//
// Et comme `.subscribe()` était appelé SANS écouter son statut,
// l'échec était totalement silencieux : l'écran croyait être en
// direct et ne l'était pas.
//
// CE QUE FAIT CE HOOK
// ────────────────────────────────────────────────────────────
//   ① un canal PAR TABLE — une table muette ne tue plus les autres ;
//   ② on ÉCOUTE le statut, et on le rend visible ;
//   ③ on RETENTE indéfiniment, avec un délai qui s'allonge ;
//   ④ on se RECONNECTE au retour de l'onglet et au retour du réseau :
//      c'est la cause n°1 des « il faut que je recharge », avec la
//      mise en veille de l'ordinateur.
//
// Le nom du canal porte un suffixe aléatoire : après une coupure,
// l'ancien canal peut mettre un instant à être libéré côté serveur,
// et réutiliser le même nom ferait échouer la reconnexion.
// ═══════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  TABLES_SUIVIES,
  agregerEtat,
  delaiReconnexion,
  etatAbonnement,
} from '../utils/directPointages'

const suffixe = () => Math.random().toString(36).slice(2, 9)

export default function useDirectPointages({ enterpriseId = 'all', onChangement, actif = true }) {
  const [etats, setEtats] = useState({})
  const [tentative, setTentative] = useState(0)

  const callbackRef = useRef(onChangement)
  useEffect(() => {
    callbackRef.current = onChangement
  }, [onChangement])

  // Un pointage et sa sortie peuvent arriver à 200 ms d'intervalle
  // (badge + validation) : on regroupe, sinon on recharge dix fois.
  const minuteurRef = useRef(null)
  const signalerRef = useRef(() => {
    if (minuteurRef.current) window.clearTimeout(minuteurRef.current)
    minuteurRef.current = window.setTimeout(() => {
      minuteurRef.current = null
      callbackRef.current?.()
    }, 350)
  })

  useEffect(() => {
    if (!actif) {
      setEtats({})
      return undefined
    }

    let vivant = true
    // On recrée à chaque tentative : c'est ce qui répare vraiment.
    const prefixeCanal = `direct-${suffixe()}`
    const canaux = []

    const abonner = (table) => {
      const filtre =
        enterpriseId && enterpriseId !== 'all' ? `enterprise_id=eq.${enterpriseId}` : undefined

      const canal = supabase
        .channel(`${prefixeCanal}-${table}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table,
            ...(filtre ? { filter: filtre } : {}),
          },
          () => signalerRef.current(),
        )
        .subscribe((statut) => {
          if (!vivant) return
          const etat = etatAbonnement(statut)
          setEtats((precedent) => ({ ...precedent, [table]: etat }))
          // ⚠️ On ne relance PAS ici, même quand c'est cassé : ce serait
          //    une boucle serrée (erreur → reconnexion → erreur) sans
          //    aucune temporisation. C'est l'effet « Reconnexion
          //    automatique » ci-dessous qui décide QUAND réessayer.
        })

      canaux.push(canal)
    }

    TABLES_SUIVIES.forEach(abonner)

    return () => {
      vivant = false
      if (minuteurRef.current) {
        window.clearTimeout(minuteurRef.current)
        minuteurRef.current = null
      }
      canaux.forEach((canal) => {
        try {
          supabase.removeChannel(canal)
        } catch {
          /* le canal est peut-être déjà fermé : sans conséquence */
        }
      })
    }
  }, [actif, enterpriseId, tentative])

  // ── Reconnexion automatique ─────────────────────────────────
  useEffect(() => {
    if (!actif) return undefined
    const etat = agregerEtat(etats)
    if (etat !== 'fige') return undefined
    const delai = delaiReconnexion(tentative)
    const minuteur = window.setTimeout(() => setTentative((n) => n + 1), delai)
    return () => window.clearTimeout(minuteur)
  }, [actif, etats, tentative])

  // ── Retour de l'onglet, retour du réseau ────────────────────
  // L'ordinateur en veille coupe la connexion sans prévenir.
  useEffect(() => {
    if (!actif) return undefined

    const relancer = () => {
      // Un canal peut « croire » être abonné alors que le socket est mort :
      // on force une reconstruction complète, c'est plus sûr qu'un diagnostic.
      setTentative((n) => n + 1)
      signalerRef.current()
    }
    const surVisibilite = () => {
      if (document.visibilityState === 'visible') relancer()
    }

    document.addEventListener('visibilitychange', surVisibilite)
    window.addEventListener('online', relancer)
    return () => {
      document.removeEventListener('visibilitychange', surVisibilite)
      window.removeEventListener('online', relancer)
    }
  }, [actif])

  // Une reconnexion réussie remet le compteur à zéro, sinon le délai
  // d'attente resterait au maximum après un simple passage en veille.
  useEffect(() => {
    if (agregerEtat(etats) === 'direct' && tentative !== 0) setTentative(0)
  }, [etats, tentative])

  return { etat: agregerEtat(etats), tentatives: tentative }
}
