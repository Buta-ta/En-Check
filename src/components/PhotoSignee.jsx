// ═══════════════════════════════════════════════════════════════════════════
// AFFICHER UNE PHOTO D'UN BUCKET PRIVÉ
//   Chemin : src/components/PhotoSignee.jsx   (fichier NOUVEAU)
//
//   AVANT : l'adresse d'une photo de pointage était publique — qui avait
//   l'adresse voyait la photo, sans compte, sans mot de passe, et pour toujours.
//   Elle est enregistrée en base sous forme d'adresse publique, et il y en a
//   dans le code, du tableau de bord aux recherches.
//
//   MAINTENANT : le bucket `attendance-photos` est privé. Une adresse publique
//   n'y mène plus nulle part. Il faut une adresse SIGNÉE : l'adresse + une
//   signature à durée limitée (1 heure), délivrée par Supabase à un compte
//   connecté. C'est ce que fait cette petite pièce : elle lit l'adresse
//   enregistrée, garde le chemin, demande la signature, et affiche l'image.
//
//   ELLE NE CHANGE RIEN AU RESTE. Les lignes de la base gardent leur
//   `photo_url` d'origine — c'est important : la suppression d'une photo
//   (Pointages.jsx) lit cette colonne pour retrouver le fichier. On ajoute,
//   on ne remplace pas.
//
//   ELLE SERT AUSSI POUR LES AUTRES BUCKETS : `<PhotoSignee url={...} />`
//   reproduit exactement une balise <img>, il suffit de remplacer le nom.
//   Tant qu'un bucket est encore public, rien ne casse ; le jour où il passe
//   en privé, la photo continue de s'afficher. C'est ce qui permettra de
//   fermer les autres plus tard, un par un.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Un pixel transparent : évite l'icône d'image cassée pendant la signature.
const TRANSPARENT =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

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
 * La balise <img>, en mieux : elle signe son adresse avant de l'afficher.
 * Toutes les autres propriétés (style, className, alt, onClick…) passent
 * directement à l'image.
 */
export default function PhotoSignee({ url, bucket = null, secondes = 3600, ...props }) {
  const [adresse, setAdresse] = useState(null)

  useEffect(() => {
    let vivant = true
    if (!url) { setAdresse(null); return }
    adresseSignee(url, bucket, secondes).then(a => { if (vivant) setAdresse(a) })
    return () => { vivant = false }
  }, [url, bucket, secondes])

  return <img src={adresse || TRANSPARENT} {...props} />
}
