// ═══════════════════════════════════════════════════════════
// LES ÉQUIPES FORMÉES, VUES DEPUIS LE PLANNING
//
// Les équipes se créent dans Employés → Équipes : une table `teams`,
// une table `team_members`. Le planning, lui, rangeait jusqu'ici les
// personnes par `department` et par des équipes locales gardées dans
// le navigateur.
//
// Ce module fait la seule chose qui compte : décider à quelle équipe
// appartient une personne, dans cet ordre —
//
//   1. l'équipe formée dans la page Équipes (la vraie organisation) ;
//   2. l'affectation locale du planning (l'ancien geste) ;
//   3. le département de la fiche employé (l'héritage).
//
// Une équipe formée n'est pas un département qui porte le même nom :
// seuls ses membres en font partie. Deux personnes du département
// « Équipe de vente » qui ne sont pas dans la table `team_members`
// restent dans une barre « département », à côté.
//
// Rien ici ne touche au réseau ni au DOM : que des listes et des noms.
// ═══════════════════════════════════════════════════════════

export const SANS_EQUIPE = "SANS ÉQUIPE";

const texte = (valeur) => String(valeur ?? "").trim();

/**
 * Les équipes lues en base, ramenées à la forme dont le planning a
 * besoin : un identifiant, un nom, une couleur, des identifiants de
 * membres. On accepte les deux écritures (`name`/`nom`, `members`/`membres`)
 * parce que la page Équipes et le planning n'ont pas les mêmes habitudes.
 */
export function equipesDuPlanning(equipes = []) {
  return (Array.isArray(equipes) ? equipes : [])
    .map((equipe) => {
      const membres = equipe?.membres ?? equipe?.members ?? [];
      return {
        id: equipe?.id ?? null,
        nom: texte(equipe?.name ?? equipe?.nom),
        couleur: equipe?.color ?? equipe?.couleur ?? null,
        membres: (Array.isArray(membres) ? membres : [])
          .map((membre) =>
            typeof membre === "string"
              ? membre
              : membre?.employee_id ?? membre?.employee?.id ?? membre?.id ?? null
          )
          .filter(Boolean),
      };
    })
    .filter((equipe) => equipe.nom.length > 0);
}

/**
 * Table « identifiant d'employé → équipe formée ».
 * Une personne qui figure dans deux équipes garde la première : on ne
 * la compte pas deux fois dans le planning.
 */
export function equipeParEmploye(equipes = []) {
  const table = new Map();
  equipesDuPlanning(equipes).forEach((equipe) => {
    equipe.membres.forEach((idEmploye) => {
      if (!table.has(idEmploye)) {
        table.set(idEmploye, { id: equipe.id, nom: equipe.nom, couleur: equipe.couleur });
      }
    });
  });
  return table;
}

/** L'équipe formée d'une personne, ou null. */
export function equipeFormeeDe(employe, table) {
  if (!table || typeof table.get !== "function") return null;
  return table.get(employe?.id) || null;
}

/**
 * Le nom d'équipe effectif d'une personne :
 * équipe formée, sinon affectation du planning, sinon département.
 */
export function nomEquipeDe(employe, { equipeParEmploye: table, affectations } = {}) {
  const id = employe?.id;

  const equipeFormee = equipeFormeeDe(employe, table);
  if (equipeFormee) return equipeFormee.nom;

  const affectation = affectations?.[id];
  if (affectation) return texte(affectation);

  const departement = texte(employe?.department).toUpperCase();
  return departement || null;
}

/** Le nom du groupe affiché dans la grille (jamais vide). */
export function nomDeGroupe(employe, options) {
  return nomEquipeDe(employe, options) || SANS_EQUIPE;
}

/**
 * La barre de la grille qui accueille une personne : sa clé (stable,
 * unique), le titre affiché et sa nature. Une équipe formée et un
 * département du même nom donnent deux barres différentes — c'est
 * exactement ce qui évite d'attribuer à une équipe des personnes qui
 * n'en sont pas membres.
 */
export function groupeDeLEmploye(employe, { equipeParEmploye: table, affectations } = {}) {
  const equipeFormee = equipeFormeeDe(employe, table);
  if (equipeFormee) {
    return {
      cle: `equipe:${equipeFormee.id ?? equipeFormee.nom}`,
      titre: equipeFormee.nom,
      type: "equipe",
    };
  }

  const affectation = texte(affectations?.[employe?.id]);
  if (affectation) {
    return { cle: `locale:${affectation.toUpperCase()}`, titre: affectation, type: "locale" };
  }

  const departement = texte(employe?.department).toUpperCase();
  if (departement) {
    return { cle: `departement:${departement}`, titre: departement, type: "departement" };
  }

  return { cle: "sans", titre: SANS_EQUIPE, type: "sans" };
}

/** La clé de barre d'une équipe formée (identique à celle de ses membres). */
export function cleEquipeFormee(equipe) {
  const nom = texte(equipe?.name ?? equipe?.nom);
  return `equipe:${equipe?.id ?? nom}`;
}

/** Vrai si ce nom d'équipe vient de la page Équipes. */
export function estEquipeFormee(nom, equipes = []) {
  const cible = texte(nom).toUpperCase();
  if (!cible) return false;
  return equipesDuPlanning(equipes).some(
    (equipe) => equipe.nom.toUpperCase() === cible
  );
}
