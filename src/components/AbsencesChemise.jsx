import { ArrowLeft, Download, Plus } from 'lucide-react'
import EnCheckBrandMark from './EnCheckBrandMark'
import '../pages/AbsencesAfroTech.css'

// ═══════════════════════════════════════════════════════════
// 📁 LA CHEMISE — en-tête de la page Absences
//
// Maquette retenue `maquettes/absences-titre-C-chemise.png` (28/11/2026) :
// « je choisis le C. Je veux exactement ce même rendu. »
//
// Ce que la figure change n'est pas la peau du bandeau, c'est le nombre d'objets.
// Avant : une feuille de titre, et SOUS elle une rangée de trois onglets dans leur
// propre conteneur (deux bordures, deux fonds, deux rayons, deux respirations).
// Maintenant : UN objet — la chemise d'un dossier. Les onglets sortent du bord haut
// de la feuille, et l'onglet ouvert n'a pas de bordure en bas : sa pâte est celle de
// la feuille, les deux contours se continuent. C'est la soudure, pas un style.
//
// Deux choses ne sont PAS recopiées de la maquette, et c'est voulu :
//   · ses épaules d'onglet sont des courbes en S et son rayon fait ~24 px — la maison
//     tient {6, 8, 11, 12, 999} (C10) et aucune courbe libre (D-016) ; ici l'onglet a
//     deux coins du haut à 6 px et des bords droits ;
//   · son troisième onglet dit « Congés ». Le libellé réel est « Configuration congés » :
//     un libellé entier ne se rogne pas pour tenir dans une maquette.
//
// Aucune couleur n'est écrite ici, aucun rayon inventé : tout vient des jetons de
// `src/styles/tokens.css`. Les deux commandes, elles, sont les boutons du kit
// (`ch-btn-contour`, `ch-btn-pleine`) — la page ne se refait pas de boutons à son
// compte depuis quatre tranches, c'était précisément le reproche.
// ═══════════════════════════════════════════════════════════

/**
 * @param {string}   titre        le filigrane de la page, en une seule chaîne
 * @param {string}   sousTitre    ce qu'on y traite, en toutes lettres
 * @param {Array<{id: string, libelle: string, compte?: number|null, alerte?: boolean}>} onglets
 * @param {string}   ongletActif
 */
export default function AbsencesChemise({
  titre,
  sousTitre,
  onglets = [],
  ongletActif = null,
  surChoixOnglet,
  surRetour,
  surExporter,
  surDeclarer,
}) {
  return (
    <header className="abs-chemise" data-testid="abs-chemise">
      <div className="abs-chemise-inner">
        {/* Les onglets d'abord : ils sortent du bord haut de la feuille et la recouvrent
            de l'épaisseur du trait (2 px), c'est ce qui fait la soudure. `nav` parce que
            c'est un choix de vue, pas un formulaire ; `aria-pressed` parce que le kit
            n'a pas d'onglet natif à réutiliser ici. */}
        <nav className="abs-chemise-onglets" aria-label="Sections de la page Absences">
          {onglets.map((onglet) => {
            const actif = onglet.id === ongletActif
            return (
              <button
                key={onglet.id}
                type="button"
                className="abs-chemise-onglet"
                aria-pressed={actif}
                onClick={() => surChoixOnglet?.(onglet.id)}
              >
                <span className="abs-chemise-onglet-label">{onglet.libelle}</span>
                {/* Un chiffre, son mot, et jamais la couleur seule (C7) : l'alerte garde
                    le fond d'alerte MAIS le nombre reste écrit à côté du mot qui le nomme
                    dans le libellé de l'onglet. */}
                {onglet.compte != null && onglet.compte > 0 ? (
                  <span
                    className="abs-chemise-onglet-compte"
                    data-alerte={onglet.alerte ? 'oui' : undefined}
                  >
                    {onglet.compte}
                  </span>
                ) : null}
              </button>
            )
          })}
        </nav>

        <div className="abs-chemise-feuille">
          {/* La flèche de retour, à la recette de la maison (`.e360-retour`, `.empv3-fleche`) :
              34 px, pilule, encre 2 px. Son GESTE non plus ne se réinvente pas : `surRetour`
              vient de `cibleRetour()`, donc on repart d'où on vient — un `navigate('/dashboard')`
              écrit ici aurait fait « retour » alors qu'il aurait fait « accueil ». */}
          <button
            type="button"
            className="abs-chemise-retour"
            onClick={surRetour}
            aria-label="Retour à la page précédente"
            title="Retour"
          >
            <ArrowLeft size={18} aria-hidden="true" />
          </button>

          <span className="abs-chemise-marque" aria-hidden="true">
            <EnCheckBrandMark size={34} />
          </span>

          <div className="abs-chemise-titres">
            <h1 className="abs-chemise-titre">{titre}</h1>
            <p className="abs-chemise-sous">{sousTitre}</p>
          </div>

          {/* Une seule variante pleine par écran (D-016) : « Déclarer » est l'action,
              « Export » est un contour. Les deux sont en pilule parce que le rayon 999
              est le rayon de ce qui se clique dans cette page — la flèche de retour l'emploie
              déjà, à 34 px. */}
          <div className="abs-chemise-commandes">
            <button type="button" className="ch-btn-contour abs-chemise-action" onClick={surExporter}>
              <Download size={16} aria-hidden="true" />
              <span>Export</span>
            </button>
            <button type="button" className="ch-btn-pleine abs-chemise-action" onClick={surDeclarer}>
              <Plus size={16} aria-hidden="true" />
              <span>Déclarer</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
