// ═══════════════════════════════════════════════════════════
// 🏢 LA PASTILLE D'ENTREPRISE — le logo partout où l'icône était
//
// Sa demande du 27/11 : « fais apparaître l'image profil de l'entreprise
// partout où l'icône de l'entreprise apparaît dans cette page ».
//
// Trois endroits portaient un Building2 générique : l'entreprise choisie
// dans le bandeau, la rangée des entreprises du super-admin, et la carte
// « Vos repères » des bulletins. Tous les trois affichent maintenant le
// logo de LEUR entreprise — pas celui de l'entreprise ouverte : dans la
// rangée, chaque ligne montre la sienne.
//
// ⚠️ On ne réécrit pas le chargement de l'image : c'est `PhotoSignee`, le
// même que les avatars et que la bande du rail. Même signature, même repli
// sur l'initiale — un logo mort ne laisse jamais un cadre vide.
// ═══════════════════════════════════════════════════════════

import PhotoSignee from '../PhotoSignee'

const initiale = (nom) => (nom || '?').trim().charAt(0).toUpperCase()

export default function PastilleEntreprise({
  entreprise = null,
  taille = 30,
  icone = null,
  className = '',
  style = null,
}) {
  const logo = entreprise?.logo_url
  const base = {
    width: taille,
    height: taille,
    flex: '0 0 auto',
    borderRadius: 999,
    overflow: 'hidden',
    display: 'grid',
    placeItems: 'center',
    ...style,
  }

  /*  Sans logo — ou si l'image ne charge pas — c'est l'initiale qui prend
      la place. Le repli est le même que celui du rail : on ne montre jamais
      un rond vide, et jamais une icône d'immeuble à la place d'un nom. */
  const repli = (
    <span
      aria-hidden="true"
      style={{
        fontSize: Math.max(10, Math.round(taille * 0.42)),
        fontWeight: 800,
        lineHeight: 1,
      }}
    >
      {icone || initiale(entreprise?.name)}
    </span>
  )

  if (logo) {
    return (
      <span className={`paie-pastille-entreprise ${className}`.trim()} style={base}>
        <PhotoSignee
          url={logo}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          fallback={repli}
        />
      </span>
    )
  }

  return (
    <span className={`paie-pastille-entreprise ${className}`.trim()} style={base}>
      {repli}
    </span>
  )
}
