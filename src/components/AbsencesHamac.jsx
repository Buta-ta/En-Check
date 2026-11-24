import '../pages/AbsencesAfroTech.css'

// ═══════════════════════════════════════════════════════════
// 🪑 LE TRANSAT — figure de la section du haut des Absences
//
// Maquette retenue `maquettes/absences-haut-E-cremaillere.png`
// (27/11/2026). Les vacances, ici, ne se dessinent pas : elles se
// suspendent. Deux montants, une suspente, et dans la suspente le
// nombre de jours qui restent — un objet qui tient quelque chose
// au milieu de rien.
//
// La peau de la page est raide (D-016 : aucun flou, rayons fermés,
// pas de courbe). Le dessinateur, lui, avait rendu la suspente en
// escalier de carrés — c'est la seule façon d'avoir un affaissement
// sans courbe : la corde n'est pas une ligne oblique, c'est une suite
// de marches franches de 8 px, descendues puis remontées.
//
// Ce composant ne calcule rien : les deux nombres viennent de
// `services/congesRestants`, les mêmes que lit la tuile de compteur.
// ═══════════════════════════════════════════════════════════

// Les marches de part et d'autre du point bas. C'est aussi le nombre
// de colonnes rendues : 2 × MARCHES + 1.
export const MARCHES = 8

// Le pas, en pixels : la hauteur d'une marche ET l'épaisseur du trait.
// Les deux sont le même nombre, sinon l'escalier se défait sous ses
// propres marches. La feuille de style, elle, pose `8px` sur le cran —
// et le contrat de la section vérifie que les deux disent bien 8.
export const PAS_PX = 8

// Le HAUT du cran le plus bas : 8 marches de 8 px sous le niveau haut. Le BAS du
// transat est 8 px plus profond — `FONDS + PAS_PX`, 72 px — et c'est ce chiffre-là
// que lit la feuille de style pour faire remonter la tuile (`margin-top` du bloc
// `.abs-hamac-suspendu`, vérifié dans `absencesSectionHaut.test.jsx`).
export const FONDS = MARCHES * PAS_PX

// Une colonne par cran ; la valeur est le nombre de marches sous le
// niveau haut. Au centre, on est au fond du transat.
const descente = () => {
  const colonnes = []
  for (let i = 0; i <= MARCHES * 2; i += 1) {
    colonnes.push(MARCHES - Math.abs(MARCHES - i))
  }
  return colonnes
}

export default function AbsencesHamac({ jours = null, retour = null, etiquette = 'jours de congé qui restent' }) {
  const fond = jours != null && Number.isFinite(Number(jours)) ? Number(jours) : null
  return (
    <div className="abs-hamac" data-testid="abs-hamac">
      {/* la corde : 17 colonnes de 8 px, chaque colonne descendue de son
          nombre de marches. Muette — c'est un dessin, pas un mot. */}
      <div className="abs-hamac-corde" aria-hidden="true">
        <span className="abs-hamac-montant" />
        {descente().map((marche, i) => (
          <span key={i} className="abs-hamac-cran" style={{ marginTop: `${marche * PAS_PX}px` }} />
        ))}
        <span className="abs-hamac-montant abs-hamac-montant-fin" />
      </div>

      {/* ce que tient la suspente : un seul nombre, et son mot */}
      <div className="abs-hamac-suspendu">
        {fond != null ? (
          <>
            <span className="abs-hamac-valeur">{fond}</span>
            <span className="abs-hamac-etiquette">{etiquette}</span>
          </>
        ) : (
          <span className="abs-hamac-etiquette">soldes non chargés</span>
        )}
      </div>

      {/* à droite du montant : le jour du retour, ou rien. Personne ne
          « revient » d'une absence déjà passée, et une date inventée à
          l'endroit le plus visible de la page serait un mensonge. */}
      {retour && (
        <p className="abs-hamac-retour">
          <span className="abs-hamac-retour-label">Retour</span>
          <span className="abs-hamac-retour-date">{retour}</span>
        </p>
      )}
    </div>
  )
}
