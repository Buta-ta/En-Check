// ═══════════════════════════════════════════════════════════════════════════
// ☕ LA PARTIE VISIBLE DU BANDEAU — aucune requête, aucun effet
//
// Ce fichier est séparé de `BandeauPauses` pour une raison précise : le
// conteneur importe `supabase`, qui exige un `.env`. Un composant de
// présentation qui a besoin d'une base pour être testé finit par ne plus
// être testé du tout.
// ═══════════════════════════════════════════════════════════════════════════
import { dureeCourte } from '../lib/bandeauPauses'

export default function ListePausesBandeau ({ pauses = [], instant }) {
  if (!pauses.length) return null
  //  L'instant est TOUJOURS fourni par l'appelant : un composant de rendu
  //  ne lit pas l'horloge. Le conteneur, lui, la fait avancer.
  const maintenant = instant ?? 0
  return (
    <section className="pp-bandeau-pauses" aria-label="Pauses en cours">
      <p className="pp-bandeau-pauses-titre">
        ☕ En pause ({pauses.length})
      </p>
      <ul className="pp-bandeau-pauses-liste">
        {pauses.map((p, i) => {
          //  La fonction ne renvoie pas d'identifiant : l'index est la seule
          //  clé possible, et il ne désigne personne hors de cette liste.
          const duree = dureeCourte(p.debut, maintenant)
          return (
            <li key={`${p.affichage}-${p.debut}-${i}`} className="pp-bandeau-pauses-ligne">
              <span className="pp-bandeau-pauses-nom">{p.affichage}</span>
              {duree && <span className="pp-bandeau-pauses-duree">{duree}</span>}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
