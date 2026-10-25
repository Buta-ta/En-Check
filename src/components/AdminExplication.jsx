// ═══════════════════════════════════════════════════════════
// 🧷 L'EXPLICATION PLIÉE
//
// Les onglets d'administration étaient chargés de paragraphes
// avant même qu'on ait choisi une action. Le texte reste là —
// il ne s'affiche qu'à la demande, dans un vrai `<details>` :
// le clavier, la recherche du navigateur et les lecteurs
// d'écran continuent de le trouver.
// ═══════════════════════════════════════════════════════════

export default function AdminExplication({ titre = 'En savoir plus', children, ouvert = false }) {
  return (
    <details className="aa-explication" open={ouvert}>
      <summary>{titre}</summary>
      <div className="aa-explication-texte">{children}</div>
    </details>
  )
}
