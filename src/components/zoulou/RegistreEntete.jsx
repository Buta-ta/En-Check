// ═══════════════════════════════════════════════════════════
// 📄 L'EN-TÊTE DU REGISTRE — commun aux trois vues
//
// Les vues Annuaire, Équipes et Tâches s'ouvrent de la même façon :
// un folio (la marque et le nom du registre ouvert), puis un titre
// serif avec son point de cuivre, et un colophon de quatre chiffres
// séparés par un filet.
//
// Ces deux pièces vivent ici pour qu'elles ne divergent pas : une
// seule règle d'écriture, trois écrans.
// ═══════════════════════════════════════════════════════════

/**
 * Le folio : la marque à gauche, le nom du registre ouvert à droite,
 * un filet dessous. C'est ce qui fait ressembler l'écran à une page
 * de registre plutôt qu'à un tableau de bord.
 */
export function Folio({ droite = '' }) {
  return (
    <div className="rg-folio">
      <p className="rg-marque"><strong>En-Check</strong> · Gestion du personnel</p>
      <p className="rg-folio-droite">{droite}</p>
    </div>
  )
}

/**
 * Le colophon : quatre chiffres, un filet entre chacun. Chaque
 * chiffre porte son libellé et une note calculée — jamais une note
 * décorative. Quand il n'y a rien à compter, la note est « — ».
 */
export function Colophon({ chiffres = [] }) {
  return (
    <dl className="rg-colophon">
      {chiffres.map(({ valeur, libelle, note, ton }) => (
        <div className="rg-chiffre" key={libelle} data-ton={ton || 'normal'}>
          <dd className="rg-chiffre-valeur">{valeur}</dd>
          <dt className="rg-chiffre-libelle">{libelle}</dt>
          <dd className="rg-chiffre-note">{note}</dd>
        </div>
      ))}
    </dl>
  )
}

export default { Folio, Colophon }
