// ═══════════════════════════════════════════════════════════════════════════
// ☕ LE BANDEAU DES PAUSES EN COURS — pour la borne partagée
//
// Sur un écran que tout le monde voit, on affiche « Merveille B. » et depuis
// combien de temps — jamais un nom complet, jamais un matricule, jamais un
// identifiant. C'est le contrat de `encheck_pauses_bandeau`, et le fondateur
// l'a tranché (option b, 25/11).
//
// TROIS RÈGLES QUE CE COMPOSANT DOIT TENIR :
//
//   1. Il ne bloque jamais la borne. Une panne de ce bandeau ne doit pas
//      empêcher qui que ce soit de pointer — c'est le seul geste qui compte
//      sur cet appareil. Toute erreur est avalée, l'écran n'affiche rien.
//
//   2. Il ne nomme personne s'il n'a pas le droit. La fonction est ouverte à
//      `anon` parce que la borne n'a pas de compte, mais elle ne renvoie que
//      le prénom et une initiale.
//
//   3. Il ne redessine pas l'écran à chaque seconde. La durée se rafraîchit
//      toute seule, en local, à partir de l'heure de début : pas de requête
//      par seconde sur une tablette qui peut rester allumée des heures.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from 'react'
//  Ce composant vit dans la borne web, qui a toujours son .env. Les tests,
//  eux, ne l'ont pas : c'est pourquoi toute la logique testable
//  (`chargerPausesBandeau`, `ListePausesBandeau`) est exportée séparément
//  et reçoit son client en paramètre.
import { supabase } from '../lib/supabase'
//  La logique pure vit dans `lib/bandeauPauses` : elle ne doit pas
//  dépendre de `supabase`, sinon tout test exige un .env.
import { chargerPausesBandeau } from '../lib/bandeauPauses'
import ListePausesBandeau from './ListePausesBandeau'


const RAFRAICHIR_MS = 60000 // une requête par minute, pas plus

export default function BandeauPauses ({ enterpriseId }) {
  const [pauses, setPauses] = useState([])
  //  L'horloge de la durée est locale : elle ne dépend d'aucune requête.
  const [instant, setInstant] = useState(() => Date.now())
  const vivantRef = useRef(true)

  useEffect(() => {
    vivantRef.current = true
    return () => { vivantRef.current = false }
  }, [])

  useEffect(() => {
    if (!enterpriseId) return undefined
    let annule = false

    const charger = async () => {
      const lignes = await chargerPausesBandeau(enterpriseId, supabase)
      if (!annule && vivantRef.current) setPauses(lignes)
    }

    charger()
    const t = setInterval(charger, RAFRAICHIR_MS)
    return () => {
      annule = true
      clearInterval(t)
    }
  }, [enterpriseId])

  //  Les durées avancent localement, sans requête réseau. `maintenant`
  //  n'est PAS utilisé : la borne le rafraîchit pour son horloge, mais s'en
  //  servir ici figerait les durées au moment du dernier rendu du parent.
  useEffect(() => {
    const t = setInterval(() => setInstant(Date.now()), 30000)
    return () => clearInterval(t)
  }, [])

  if (!enterpriseId) return null
  return <ListePausesBandeau pauses={pauses} instant={instant} />
}
