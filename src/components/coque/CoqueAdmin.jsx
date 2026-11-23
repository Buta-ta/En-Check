// ═══════════════════════════════════════════════════════════
//  LA COQUE ADMIN — deux colonnes : la barre, puis la page
//
// Née le 23/11 quand le Planning a demandé « intègre la sidebar + son rail ».
// Le bandeau du 22/11 avait retiré de cette page le sélecteur d'entreprise, le
// voyage « Aller à » et le bouton de thème EN PROMETTANT que le rail du
// tableau de bord les fait. Il les faisait sur les pages voisines. Pas ici.
//
// Deux pages, pourtant, avaient déjà leurs deux colonnes : `Employes.jsx`
// (`.empv2-coque` + `.empv2-layout` + `.nav3-colonne`) et `Employee360.jsx`,
// qui a re-écrit la même chose. Elles sont laissées TELLES QUELLES — y
// toucher ce soir, ce serait refaire une page validée pour un gain nul. Mais
// elles ne sont plus le modèle : la géométrie des colonnes et les variables de
// la barre vivent ici, une fois, et une page nouvelle qui veut la barre rend
// <CoqueAdmin sidebar={…}> au lieu de recopier un patron.
//
// ⚠️ La barre est rendue ENFANT DIRECT de `.coque-admin`. Ce n'est pas un
// détail : les règles de `SidebarUnique.css` qui la collent en sticky, qui
// posent le registre PAR-DESSUS la page (au lieu de la pousser) et qui la
// rangent en bas de l'écran sous 820 px sont écrites sur `.coque-admin > .sb`.
// Un wrapper de plus entre les deux, et la barre redevient un flex-item qui
// ôte 254 px au `main` à chaque dépliage — la faute du 08/11, reproduite.
// ═══════════════════════════════════════════════════════════

import "./CoqueAdmin.css";

export default function CoqueAdmin({ sidebar = null, children, className = "" }) {
  return (
    <div className={`coque-admin${className ? ` ${className}` : ""}`}>
      {sidebar}
      <div className="coque-admin-page">{children}</div>
    </div>
  );
}
