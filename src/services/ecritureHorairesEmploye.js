// ═══ ÉCRIRE LA LIGNE D'HORAIRE D'UN COLLABORATEUR — le format d'abord, la cause ensuite
//
// Le 23/11/2026, le fondateur signale : « j'essaie de modifier la couleur d'un
// modèle appliqué à une case mais j'ai eu erreur : Failed to load resource:
// the server responded with a status of 400 ». Dans la console, un 400 ne dit
// rien ; la page répondait « Erreur sauvegarde » et le vrai motif restait
// enfermé dans un `console.error` que personne ne lit. Une erreur qu'on ne
// peut pas lire est une erreur qu'on ne peut pas réparer — `adminMfaErrors`
// existe pour exactement la même raison côté authentification.
//
// Ce module tient les deux bouts qui manquaient.
//
//  1. LE FORMAT, AVANT L'APPEL. La fenêtre « Ajuster le planning » ne peint pas
//     ses champs avec ce qu'elle croit savoir : elle repart d'une valeur déjà en
//     place, lue dans `dayOverrides` — le brouillon LOCAL de ce navigateur,
//     écrit par les versions antérieures de la page, avant que la teinte ne
//     soit contrainte en base. Une valeur de brouillon peut donc être n'importe
//     quoi (un raccourci à trois chiffres, un `rgba(...)` de lavage, une heure à
//     l'envers) et partait
//     telle quelle, les heures being même concaténées à ":00". En face, la base
//     a deux CHECK de format (`custom_color`, `custom_day_colors`, migrations
//     20261122000002 et 20261122000004) et une colonne `time` stricte : elle
//     répond 23514 ou 22007, c'est-à-dire 400.
//     Règle de ce module, et elle est délibérée : une valeur mal formée est
//     REPLIÉE sur ce que la fenêtre sait faire de mieux (la première teinte de
//     la palette, l'heure attendue) et la page le DIT — bloquer l'enregistrement
//     serait interdire au fondateur de réparer son propre brouillon. Une heure
//     obligatoire laissée vide est le seul cas où l'on refuse, parce que là il
//     n'y a rien à inventer : c'est à la personne de choisir.
//
//  2. LA CAUSE, APRÈS LE REFUS. `causeRejetBase` traduit le rejet de la base en
//     une phrase, sur une LISTE BLANCHE de codes. Rien du message brut du
//     fournisseur n'est recopié à l'écran — même discipline que pour le MFA le
//     26/10 — mais le code est cité, parce que c'est la seule chose que le
//     support peut vérifier sans se faire raconter la requête.
//
// Fonctions pures : ni React, ni supabase-js ici, donc testables sans
// navigateur. La table a été relue sur le projet réel le 23/11, en lecture
// seule : `employee_schedules` porte bien `custom_color` (texte) et
// `custom_day_colors` (jsonb) avec leurs deux CHECK, UNIQUE (`employee_id`) —
// ce qui légitime l'`upsert` et ferme la piste « clé de fusion absente » — et
// aucune politique RLS active sur ce projet (aucun rôle personnalisé créé, les
// huit politiques de la table renvoient vrai). Le contrôle, rejouable quand un
// 400 se représentera : `supabase/outils-sql/20261123_diagnostic_teinte_horaire_refusee.sql`.

// Le format des deux colonnes de teinte : six chiffres, rien d'autre. Un
// Un raccourci à trois chiffres est du CSS valide mais pas du format de la base :
// on l'étend plutôt
// que de le refuser, il ne porte aucune information qu'on perde. Un `#rrggbbaa`
// porte une transparence, et là le dire vaut mieux qu'un repli muet — les cases
// du Planning se peignent en plein.
const TEINTE_COURTE = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/;
const TEINTE_PLEINE = /^#[0-9a-fA-F]{6}$/;
const TEINTE_AVEC_ALPHA = /^#[0-9a-fA-F]{8}$/;

// Une heure, telle que la colonne `time` de Postgres l'accepte. Le formulaire
// rend `HH:MM`, le brouillon local peut rendre `HH:MM:SS`, et un old draft peut
// rendre n'importe quoi.
const HEURE = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

const deuxChiffres = (n) => String(n).padStart(2, "0");

/**
 * La teinte qu'on peut écrire en base ET poser dans un `style` en ligne.
 *
 * @param {string|null|undefined} valeur
 * @returns {{ teinte: string|null, message: string|null }} — `teinte` à écrire,
 *   `message` à montrer s'il y a eu un repli. `null` sans message veut dire
 *   « aucune teinte choisie », un état légitime (la colonne est nullable et
 *   « la ligne décide » quand la carte d'un jour ne dit rien).
 */
export function normaliserTeinte(valeur) {
  if (valeur === null || valeur === undefined || valeur === "") {
    return { teinte: null, message: null };
  }
  const brute = String(valeur).trim();
  const courte = TEINTE_COURTE.exec(brute);
  if (courte) {
    return {
      teinte: `#${courte[1]}${courte[1]}${courte[2]}${courte[2]}${courte[3]}${courte[3]}`,
      message: null,
    };
  }
  if (TEINTE_PLEINE.test(brute)) return { teinte: brute, message: null };
  if (TEINTE_AVEC_ALPHA.test(brute)) {
    return {
      teinte: brute.slice(0, 7),
      message:
        "La teinte enregistrée comportait une transparence : elle a été reprise pleine, les cases du Planning ne peignent pas en demi-teinte.",
    };
  }
  return {
    teinte: null,
    message:
      "« " +
      brute +
      " » n'est pas une teinte que la base accepte (elle attend un hexadécimal à six chiffres). Choisissez une pastille du nuancier : elle sera enregistrée à la place.",
  };
}

/**
 * Une heure du formulaire, mise au format de la colonne `time`.
 *
 * @param {string|null|undefined} valeur
 * @param {{ champ?: string, obligatoire?: boolean, defaut?: string|null }}
 *   options — `champ` est le libellé visible : ne dites pas « heure invalide »,
 *   dites « Fin de journée est vide ». `defaut` est la valeur reprise quand
 *   celle du champ est illisible ; `obligatoire` refuse le vide sans repli.
 * @returns {{ heure: string|null, message: string|null }} — quand `heure` est
 *   `null` et `message` présent, l'écriture doit être refusée : c'est le seul
 *   cas où il n'y a rien à inventer.
 */
export function normaliserHeure(valeur, { champ = "L'heure", obligatoire = false, defaut = null } = {}) {
  const brute = valeur === null || valeur === undefined ? "" : String(valeur).trim();
  if (brute === "") {
    return {
      heure: null,
      message: obligatoire
        ? `${champ} est vide. Renseignez l'heure, ou choisissez un horaire d'entreprise au lieu d'heures libres : la page n'invente pas une heure à votre place.`
        : null,
    };
  }
  const m = HEURE.exec(brute);
  const h = m ? Number(m[1]) : NaN;
  const min = m ? Number(m[2]) : NaN;
  const s = m && m[3] !== undefined ? Number(m[3]) : 0;
  if (!m || Number.isNaN(h) || h > 23 || min > 59 || s > 59) {
    return {
      heure: defaut,
      message: `${champ} « ${brute} » n'est pas une heure au format HH:MM${
        defaut ? ` ; la page a repris ${defaut.slice(0, 5)}.` : " et la base n'a rien à en faire."
      }`,
    };
  }
  return { heure: `${deuxChiffres(h)}:${deuxChiffres(min)}:${deuxChiffres(s)}`, message: null };
}

/**
 * La carte des teintes jour par jour, prête à être relue puis fusionnée, et le
 * nombre d'entrées qui ont dû en être retirées. Deux gardes, pas une :
 *   · une carte qui n'est PAS un objet (valeur écrite à la main dans l'éditeur,
 *     tableau, texte) ne doit surtout pas être étendue — `{..."abc"}` fabrique
 *     des clés "0", "1", "2" ;
 *   · une teinte de case qui n'est pas un hexadécimal (une valeur saisie à la
 *     main un jour, un lavis `rgba(...)` venu d'un brouillon plus vieux) est
 *     retirée plutôt que réécrite. Sans cette seconde garde, une seule case
 *     mal saisie condamnerait l'enregistrement de TOUTES les autres : le
 *     fondateur ne pourrait plus rien peindre sur cette ligne, et le 400 ne
 *     dirait jamais que le fautif est un jour qu'il n'a pas touché.
 * Retirer ne veut pas dire repeindre : la case retrouve « la ligne décide »,
 * qui est son état avant tout choix, et le message le dit.
 */
export function carteDeTeintes(ligne) {
  const brute = ligne?.custom_day_colors;
  if (!brute || typeof brute !== "object" || Array.isArray(brute)) {
    return { carte: {}, retirees: 0 };
  }
  const carte = {};
  let retirees = 0;
  for (const [cle, valeur] of Object.entries(brute)) {
    if (normaliserTeinte(valeur).teinte) carte[cle] = normaliserTeinte(valeur).teinte;
    else retirees += 1;
  }
  return { carte, retirees };
}

// Les colonnes dont l'absence est le 400 le plus fréquent après un déploiement
// partiel : la page écrit, la base ne connaît pas, et PostgREST l'écrit
// lui-même — « Could not find the '…' column … in the schema cache ». Nommer le
// fichier à appliquer, c'est la moitié du temps de réponse gagnée.
const MIGRATION_PAR_COLONNE = {
  custom_color: "supabase/migrations/20261122000002_teinte_horaire_collaborateur.sql",
  custom_day_colors: "supabase/migrations/20261122000004_teinte_case_par_case.sql",
};

// Une contrainte nommée vaut mieux que le code : elle dit quelle colonne a été
// refusée, donc quelle valeur reprendre.
const CONTRAINTES = {
  employee_schedules_custom_color_chk:
    "La teinte de l'horaire entier doit être un hexadécimal à six chiffres (#rrggbb), ou rester vide.",
  employee_schedules_custom_day_colors_chk:
    "Chaque teinte de case doit être un hexadécimal à six chiffres (#rrggbb), et la carte des jours doit rester un objet.",
};

// Liste blanche des rejets que cette écriture peut rencontrer. Un code qui n'y
// figure pas reste un code cité — jamais un message recopié.
const CAUSES = {
  "23514":
    "Une valeur ne respecte pas une règle de la base : teintes en hexadécimal à six chiffres, heures au format HH:MM:SS.",
  "22007":
    "Une heure ou une date est partie mal écrite — un champ de la fenêtre a été vidé ou porte une valeur qui n'est pas une heure.",
  "22P02":
    "Un identifiant envoyé à la base n'est pas de ce type : le collaborateur ou le modèle concerné n'existe peut-être que dans cette fenêtre, pas encore en base.",
  "23502":
    "La base refuse une colonne laissée vide alors qu'elle est obligatoire — un champ requis n'a pas été renseigné dans la fenêtre.",
  "42703":
    "Cette base ne connaît pas une colonne que la page envoie : la migration correspondante n'a pas été appliquée sur ce projet.",
  "23503":
    "La base refuse le lien vers un horaire d'entreprise qui n'existe plus. Choisissez-en un autre, ou passez par des heures personnalisées.",
  "23505": "Un autre enregistrement porte déjà cette valeur.",
  "42501":
    "Les droits de la base refusent cette écriture pour ce compte (politique de ligne, ou canal de session non autorisé).",
  "PGRST400":
    "L'API de la base a refusé la requête : la colonne ou la vue visée n'est pas dans son cache de schéma.",
  "PGRST204":
    "La base n'offre pas de clé unique sur la colonne utilisée pour fusionner : cette écriture ne peut pas passer par ce chemin.",
  "PGRST202": "Une fonction que la page appelle n'existe pas sur ce projet : migration non appliquée.",
  "PGRST116": "Aucune ligne ne correspond : rien n'a été mis à jour.",
};

/**
 * La phrase à montrer quand la base a refusé une écriture d'horaire.
 *
 * @param {{code?:string, message?:string, details?:string, hint?:string,
 *   statusCode?:string|number, status?:number}|null} error — la forme renvoyée
 *   par supabase-js (`PostgrestError`) ou par `fetch`.
 * @returns {string} jamais vide : un refus sans cause identifiée doit au moins
 *   dire qu'il y a un refus, et où lire la suite.
 */
/**
 * Un refus n'est pas forcément un refus de la base. Ce correctif-là l'a appris à
 * ses dépens le 23/11, une demi-heure après son déploiement : un appel à une
 * méthode de notification qui n'existe pas levait un `TypeError` DANS le `try` de
 * l'enregistrement — donc dans son `catch`, donc dans `causeRejetBase`, qui
 * concluyait « la base a refusé ». Le fondateur a lu un refus de Postgres pour une
 * faute de JavaScript, et la vraie requête n'avait jamais été envoyée. Un
 * `catch` qui avale le client et le traduit comme le serveur invente une cause.
 *
 * Alors on demande la signature : une réponse de PostgREST porte `code`,
 * `details`, `hint` ou un statut HTTP. Une erreur d'exécution n'en porte aucun.
 */
function vientDeLaBase(error) {
  if (!error || typeof error !== "object") return false;
  return ["code", "details", "hint", "status", "statusCode"].some(
    (champ) => error[champ] !== undefined && error[champ] !== null
  );
}

/** La phrase qu'on lit quand ce n'est PAS la base qui a parlé. */
export const REFUS_SANS_BASE =
  "Blocage côté application, avant tout accord de la base : rien n'a été " +
  "enregistré et rien n'est perdu. Le détail (nom de la fonction et ligne) est " +
  "dans la console du navigateur — ce n'est pas une donnée à corriger, c'est du " +
  "code à réparer.";

export function causeRejetBase(error) {
  if (!vientDeLaBase(error)) return REFUS_SANS_BASE;

  const code = error?.code ? String(error.code) : null;
  const detail = `${error?.details ?? ""} ${error?.message ?? ""}`;

  // une colonne inconnue se détecte au motif : c'est le seul cas où l'API
  // écrit elle-même le nom de la colonne, et c'est précisément ce qu'il faut
  // pouvoir dire à quelqu'un qui déploie
  const colonne = /Could not find the '([^']+)' column/i.exec(detail);
  if (colonne) {
    const nom = colonne[1];
    const fichier = MIGRATION_PAR_COLONNE[nom];
    return `La colonne « ${nom} » n'existe pas sur cette base${
      fichier ? ` — appliquez la migration ${fichier}` : ""
    } (code ${code || "PGRST400"}).`;
  }

  const contrainte = /constraint "([^"]+)"/i.exec(detail);
  if (contrainte && CONTRAINTES[contrainte[1]]) {
    return `${CONTRAINTES[contrainte[1]]} (contrainte ${contrainte[1]})`;
  }

  if (code && CAUSES[code]) return `${CAUSES[code]} (code ${code})`;

  const statut = error?.status ?? error?.statusCode ?? null;
  if (statut) {
    return `La base a refusé l'écriture (HTTP ${statut}). Le détail — code et contrainte — est dans la console du navigateur, et c'est lui qu'il faut transmettre.`;
  }
  return "La base a refusé l'écriture, sans code d'erreur. Le détail est dans la console du navigateur.";
}
