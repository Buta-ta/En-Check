// ═══════════════════════════════════════════════════════════════════════════
//  LA PHOTO SIGNÉE — une image de stockage privé, affichée sans trou
//
//  Le principe n'a pas changé : l'adresse enregistrée en base est un chemin de
//  bucket privé, il faut la signer avant de l'afficher.
//
//  Ce qui a changé le 26/11 (« fais apparaître le profil image de la personne
//  qui est en pause réelle ») : le composant disait `src` avec un pixel
//  transparent en attendant la signature, et RIEN ne prenait le relais quand
//  la signature échouait — photo absente, bucket supprimé, réseau coupé. On
//  voyait donc un cercle vide, exactement comme s'il n'y avait pas de photo.
//
//  Désormais :
//   · `fallback` s'affiche tant que l'image n'est pas réellement peinte ;
//   · `onError` bascule aussi sur le repli — une image cassée n'est jamais
//     laissée à l'écran.
//  Le repli est rendu dans le même cadre, donc l'assiette garde sa taille.
//
//  ⚠️ CE QUE CE PROTOCOLE INTERDIT À L'APPELANT — mesuré le 29/11, sur les
//  sceaux des Rémunérations (« on ne voit pas l'image de profil de chaque
//  employé qui en a »). Tant qu'elle n'est pas peinte, l'image est
//  `display: none`. Une image marquée `loading="lazy"` que rien ne rend n'est
//  JAMAIS demandée : `onLoad` ne vient pas, le cache ne se lève pas, et la
//  page conclut à l'absence de photo. Un appel différé n'a donc rien de
//  « prudent » ici — il est bloquant. `decoding="async"` n'est pas concerné :
//  il reporte le décodage, pas la demande.
//
//  Si un jour ce cache doit devenir un `visibility: hidden` (pour rendre le
//  lazy possible), c'est ICI que ça se règle, et la loi qui défend `loading`
//  aux pages tombe avec lui — les deux sont écrites l'une en face de l'autre,
//  dans `remunerationsBogolan.test.jsx`, §16.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Adresses déjà signées : on ne re-signe pas la même photo dix fois.
// (clé = bucket + chemin, valeur = { adresse, expire })
const cache = new Map()

/**
 * Retrouve le bucket et le chemin à partir de l'adresse enregistrée en base.
 * Comprend l'adresse publique d'avant, l'adresse signée, ou un chemin nu.
 * Renvoie null si on ne sait pas faire — l'appelant retombe alors sur
 * l'adresse d'origine, sans casser l'affichage.
 */
export function decouperAdresseStockage(url) {
  if (!url || typeof url !== 'string') return null
  const m = /\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/.exec(url)
  if (m) return { bucket: m[1], chemin: m[2].split('?')[0] }
  if (!url.startsWith('http') && url.includes('/')) return { bucket: null, chemin: url }
  return null
}

/**
 * Adresse signée (valable `secondes`), ou l'adresse d'origine si on ne peut pas.
 * Utilisable en dehors de React (export PDF, impression…).
 */
export async function adresseSignee(url, bucketParDefaut = null, secondes = 3600) {
  const parts = decouperAdresseStockage(url)
  if (!parts) return url || null
  const bucket = parts.bucket || bucketParDefaut
  if (!bucket) return url                                   // bucket inconnu : on n'y touche pas
  if (!parts.bucket && !bucketParDefaut) return url

  const cle = `${bucket}/${parts.chemin}/${secondes}`
  const garde = cache.get(cle)
  if (garde && garde.expire > Date.now() + 60_000) return garde.adresse

  try {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(parts.chemin, secondes)
    if (error || !data?.signedUrl) return url               // bucket encore public : l'originale suffit
    cache.set(cle, { adresse: data.signedUrl, expire: Date.now() + secondes * 1000 })
    return data.signedUrl
  } catch {
    return url
  }
}

/**
 * La balise <img>, en mieux : elle signe son adresse avant de l'afficher, et
 * elle laisse le repli à l'écran jusqu'à ce que l'image soit VRAIMENT peinte.
 * Toutes les autres propriétés (style, className, alt, onClick…) passent
 * directement à l'image.
 */
//  Une adresse déjà utilisable telle quelle : rien à signer, donc rien à
//  attendre. Un `data:` (aperçu, photo locale) ou un `blob:` s'affiche
//  immédiatement — inutile de faire patienter l'image derrière un aller-retour
//  de signature qui n'a pas lieu d'être.
export function adresseDirecte(url) {
  return typeof url === 'string' && /^(data:|blob:)/.test(url)
}

export default function PhotoSignee({ url, bucket = null, secondes = 3600, fallback = null, style, ...props }) {
  const [adresse, setAdresse] = useState(null)
  const [ratee, setRatee] = useState(false)
  const [peinte, setPeinte] = useState(false)

  useEffect(() => {
    let vivant = true
    setRatee(false)
    setPeinte(false)
    if (!url) { setAdresse(null); return undefined }
    if (adresseDirecte(url)) { setAdresse(url); return undefined }
    /*  Une adresse PUBLIQUE de Supabase : son propriétaire a choisi qu'elle
         se lise sans signature. On la laisse telle quelle — sans cette
         sortie, le logo d'entreprise (bucket `photos`, public) passait par
         `createSignedUrl` pour rien et pouvait n'en rien rapporter. */
    if (/\/storage\/v1\/object\/public\//.test(url)) { setAdresse(url); return undefined }
    adresseSignee(url, bucket, secondes).then((a) => { if (vivant) setAdresse(a) })
    return () => { vivant = false }
  }, [url, bucket, secondes])

  //  Pas d'adresse, adresse refusée, ou signature pas encore revenue : c'est
  //  le repli qui occupe le cadre. Il ne clignote pas, il attend.
  if (!adresse || ratee) {
    return fallback ? <span style={style} className={props.className}>{fallback}</span> : null
  }

  return (
    <>
      <img
        src={adresse}
        style={{ ...style, display: peinte ? undefined : 'none' }}
        onLoad={() => setPeinte(true)}
        onError={() => setRatee(true)}
        {...props}
      />
      {!peinte && fallback ? (
        <span style={style} className={props.className}>{fallback}</span>
      ) : null}
    </>
  )
}
