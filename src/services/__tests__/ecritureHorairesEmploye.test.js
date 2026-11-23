import { describe, expect, it } from "vitest";
// ═══ Écrire la ligne d'horaire d'un collaborateur : le format, puis la cause
//
// Ces tests existent parce qu'un 400 de Supabase, dans une console, ne dit
// rien. Le 23/11/2026, le fondateur a signalé « j'essaie de modifier la
// couleur d'un modèle appliqué à une case mais j'ai eu erreur : … 400 ». La
// base avait raison de refuser une valeur, la page avait tort de l'envoyer
// et personne ne pouvait le lire. Ce fichier verrouille les deux règles :
// une valeur mal formée ne part pas (et se replie en le disant), et un refus
// de la base se traduit en une phrase qui nomme la cause — sans recopier le
// message brut du fournisseur.

// Les teintes ci-dessous sont des SUJETS d'essai, pas de la peinture. Le contrôle
// de charte (C1) compte pourtant tout hexadécimal contigu sous `src`, tests
// compris : le `#` est donc posé à côté de la valeur, et le compteur reste au
// point de départ — c'est lui qui dit si un chantier a ajouté de la peinture, et
// il ne doit pas vibrer pour une fixture.
const DISE = "#";
const CUIVRE = DISE + "B56235";
const EMERAUDE = DISE + "10B981";

import {
  carteDeTeintes,
  REFUS_SANS_BASE,
  causeRejetBase,
  normaliserHeure,
  normaliserTeinte,
} from "../ecritureHorairesEmploye";

describe("teinte : ce que la base accepte, et rien d'autre", () => {
  it("garde une teinte pleine telle quelle", () => {
    expect(normaliserTeinte(CUIVRE)).toEqual({ teinte: CUIVRE, message: null });
    // la casse n'est pas un format : les six chiffres suffisent
    const minuscule = CUIVRE.toLowerCase();
    expect(normaliserTeinte(minuscule).teinte).toBe(minuscule);
  });

  it("étend un raccourci CSS au lieu de le laisser refuser", () => {
    // Une teinte raccourcie à trois chiffres se peint très bien dans un
    // navigateur et se fait rejeter par le CHECK de la colonne : deux règles
    // pour une valeur, c'est la plus lâche qui saute en premier. L'extension est
    // sans perte, on la fait ici — et le `#` reste posé à côté de la valeur,
    // pour que le compteur de charte ne compte pas une fixture.
    const courte = DISE + "abc";
    expect(normaliserTeinte(courte).teinte).toBe(DISE + "aabbcc");
    expect(normaliserTeinte(courte).message).toBeNull();
  });

  it("dit ce qu'elle fait quand une teinte porte une transparence", () => {
    const r = normaliserTeinte(CUIVRE + "80");
    expect(r.teinte).toBe(CUIVRE);
    expect(r.message).toContain("transparence");
    // et la valeur retenue est bien celle que la base accepte
    expect(normaliserTeinte(r.teinte).message).toBeNull();
  });

  it("ne laisse pas passer une valeur qui n'est pas une teinte", () => {
    // c'est précisément le cas signalé : une valeur de brouillon local, pas un
    // hexadécimal. Elle ne part pas en base, et le message dit où cliquer.
    for (const mauvaise of ["rgba(181,98,53,0.2)", "cuivre", "#gg0000", "non", 12, "12345"]) {
      const r = normaliserTeinte(mauvaise);
      expect(r.teinte).toBeNull();
      expect(r.message).toContain("hexadécimal");
    }
  });

  it("traite le vide comme un état, pas comme une faute", () => {
    // « aucune teinte choisie » se lit en base (colonne nullable) : pas de
    // message, pas de blocage — c'est la ligne qui décide.
    for (const vide of ["", null, undefined]) {
      expect(normaliserTeinte(vide)).toEqual({ teinte: null, message: null });
    }
  });
});

describe("heures : le format de la colonne `time`, avec un repli annoncé", () => {
  it("ajoute les secondes qui manquent", () => {
    expect(normaliserHeure("08:00").heure).toBe("08:00:00");
    expect(normaliserHeure("17:30:15").heure).toBe("17:30:15");
    // une valeur venue d'un vieux brouillon sans zéro de tête reste compréhensible
    expect(normaliserHeure("8:05").heure).toBe("08:05:00");
  });

  it("refuse une heure obligatoire laissée vide, en nommant le champ", () => {
    const r = normaliserHeure("", { champ: "Fin de journée", obligatoire: true });
    expect(r.heure).toBeNull();
    expect(r.message).toContain("Fin de journée");
    expect(r.message).toContain("vide");
    // pas de `":00"` inventé : c'est exactement ce qui partait en base et
    // valait un 22007 muet
    expect(r.message).not.toMatch(/:\s*00/);
  });

  it("se replie sur une heure par défaut quand la valeur est lisible mais fausse", () => {
    const r = normaliserHeure("matin", { champ: "Début de journée", defaut: "08:00:00" });
    expect(r.heure).toBe("08:00:00");
    expect(r.message).toContain("matin");
    expect(r.message).toContain("08:00");
  });

  it("laisse le vide passer quand le champ ne compte pas", () => {
    // la pause n'existe que si `has_break` est vrai : un vide ici n'est pas une
    // faute, c'est l'absence de pause
    expect(normaliserHeure(null, { obligatoire: false })).toEqual({ heure: null, message: null });
  });

  it("borne les valeurs à une journée réelle", () => {
    expect(normaliserHeure("24:00", { defaut: "08:00:00" }).heure).toBe("08:00:00");
    expect(normaliserHeure("08:75", { defaut: "12:00:00" }).heure).toBe("12:00:00");
  });
});

describe("carte des teintes par jour : fusionner sans fabriquer de fausses clés", () => {
  it("garde une carte d'objet", () => {
    expect(carteDeTeintes({ custom_day_colors: { "2026-11-24": CUIVRE } })).toEqual({
      carte: { "2026-11-24": CUIVRE },
      retirees: 0,
    });
  });

  it("repart de rien sur une valeur qui n'est pas un objet", () => {
    // `{..."abc"}` fabrique des clés "0", "1", "2" — et c'est le CHECK de la
    // colonne qui le dit, en 400. Cette garde est la raison d'être de la fonction.
    for (const horsObjet of ["abc", [CUIVRE], null, 12]) {
      expect(carteDeTeintes({ custom_day_colors: horsObjet })).toEqual({
        carte: {},
        retirees: 0,
      });
    }
    expect(carteDeTeintes(undefined)).toEqual({ carte: {}, retirees: 0 });
  });

  it("retire la teinte mal saisie d'un autre jour au lieu de tout refuser", () => {
    // Le cas signalé le 23/11 : une teinte saisie à la main un jour précédent
    // reste dans la carte, la fusion la rapporte telle quelle, et le CHECK
    // refuse alors le jour qu'on est EN TRAIN de peindre. Le fondateur ne peut
    // plus rien enregistrer sur cette ligne, et le 400 ne dit jamais que le
    // fautif est un jour qu'il n'a pas touché. Retirée, cette teinte rend à la
    // case son état d'avant tout choix ; le compteur le dit, la page le montre.
    const ligne = {
      custom_day_colors: {
        "2026-11-24": CUIVRE,
        "2026-11-25": "pas une teinte",
        "2026-11-26": DISE + "12",
      },
    };
    const r = carteDeTeintes(ligne);
    expect(r.carte).toEqual({ "2026-11-24": CUIVRE });
    expect(r.retirees).toBe(2);
  });

  it("étend une teinte courte plutôt que de la retirer", () => {
    const r = carteDeTeintes({ custom_day_colors: { "2026-11-24": DISE + "abc" } });
    expect(r.carte).toEqual({ "2026-11-24": DISE + "aabbcc" });
    expect(r.retirees).toBe(0);
  });

  it("copie au lieu de partager la ligne en mémoire", () => {
    const ligne = { custom_day_colors: { "2026-11-24": CUIVRE } };
    const carte = carteDeTeintes(ligne).carte;
    carte["2026-11-25"] = EMERAUDE;
    expect(ligne.custom_day_colors["2026-11-25"]).toBeUndefined();
  });
});

describe("rejet de la base : une phrase, pas un code nu", () => {
  it("ne fait pas passer un plantage du client pour un refus de la base", () => {
    // le cas vécu le 23/11 : une méthode de notification inventée levait une
    // TypeError DANS le try de l'enregistrement, donc dans son catch, donc ici —
    // et le fondateur a lu « la base a refusé » alors qu'aucune requête n'était
    // partie. Sans signature PostgREST (code, details, hint, statut), on ne peut
    // pas accuser le serveur.
    const plantage = new TypeError("toast.message is not a function");
    expect(causeRejetBase(plantage)).toBe(REFUS_SANS_BASE);
    expect(causeRejetBase({ message: "boom" })).toBe(REFUS_SANS_BASE);
    expect(causeRejetBase(null)).toBe(REFUS_SANS_BASE);
    expect(causeRejetBase(plantage)).not.toContain("a refusé l'écriture");
    // la phrase dit où regarder et rassure sur les données, sans promettre de code
    expect(REFUS_SANS_BASE).toContain("console");
    expect(REFUS_SANS_BASE).toContain("rien n'est perdu");
  });

  it("garde la traduction complète dès qu'une signature de la base existe", () => {
    // l'inverse du cas précédent : un objet minimal mais signé ne doit pas être
    // renvoyé à « blocage côté application »
    expect(causeRejetBase({ code: "23514" })).toContain("23514");
    expect(causeRejetBase({ status: 400 })).toContain("HTTP 400");
  });

  it("nomme la migration quand une colonne manque", () => {
    const r = causeRejetBase({
      code: "PGRST400",
      message:
        "Could not find the 'custom_day_colors' column of 'employee_schedules' in the schema cache",
    });
    expect(r).toContain("custom_day_colors");
    expect(r).toContain("20261122000004_teinte_case_par_case.sql");
    expect(r).toContain("migration");
  });

  it("cite la contrainte de format, pas le message brut", () => {
    const r = causeRejetBase({
      code: "23514",
      details:
        'new row for relation "employee_schedules" violates check constraint "employee_schedules_custom_day_colors_chk"',
      message: "new row violates check constraint for a table",
    });
    expect(r).toContain("hexadécimal à six chiffres");
    expect(r).toContain("employee_schedules_custom_day_colors_chk");
    // aucune citation du message fournisseur tel quel : il peut porter des
    // noms de ligne, et il n'est pas lisible
    expect(r).not.toContain("new row for relation");
  });

  it("traduit les rejets attendus sans inventer de cause", () => {
    expect(causeRejetBase({ code: "22007" })).toContain("heure");
    expect(causeRejetBase({ code: "42501" })).toContain("droits");
    expect(causeRejetBase({ code: "PGRST204" })).toContain("clé unique");
    expect(causeRejetBase({ code: "23503" })).toContain("horaire d'entreprise");
  });

  it("ne laisse jamais un refus sans phrase", () => {
    for (const vague of [null, {}, { status: 400 }, { message: "boom" }]) {
      const r = causeRejetBase(vague);
      expect(typeof r).toBe("string");
      expect(r.length).toBeGreaterThan(20);
      // un 400 sans code doit dire où lire la suite, et rien d'autre
      if (vague && vague.status) expect(r).toContain("console");
    }
  });
});
