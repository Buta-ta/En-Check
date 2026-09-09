// ═══════════════════════════════════════════════════════════════════
// ✉️ send-email — les alertes de pointage par courrier électronique
// ═══════════════════════════════════════════════════════════════════
// EMPLACEMENT : supabase/functions/send-email/index.ts
//
// À QUOI ÇA SERT
// ──────────────
// Le téléphone ne répond pas toujours : appareil éteint, autorisation refusée,
// application non installée, ou responsable simplement loin de son bureau. Le
// courrier électronique, lui, arrive partout et laisse une trace consultable.
//
// QUI REÇOIT
// ──────────
// Les responsables rattachés à l'entreprise concernée (table `admin_entreprises`
// pour le rattachement, table `admins` pour la case `alertes_email`), jamais les
// employés pointés, jamais une autre entreprise.
//
// COMMENT ELLE EST APPELÉE
// ─────────────────────────
//  1. Depuis la base, à l'instant où une alerte grave est créée — l'en-tête
//     `x-email-secret` porte le secret partagé ;
//  2. depuis le tableau de bord, pour un essai — le jeton du responsable fait foi.
//
// CE QU'IL FAUT DANS LES SECRETS DE LA FONCTION
// ─────────────────────────────────────────────
//  BREVO_API_KEY          la clé du fournisseur (elle commence par xkeysib-)
//  MAIL_FROM              une adresse d'envoi VÉRIFIÉE chez le fournisseur
//  MAIL_FROM_NAME         le nom qui s'affiche chez le destinataire
//  EMAIL_TRIGGER_SECRET   32 caractères minimum, le même que celui posé en base
//
//  Facultatif — seulement si tu envoies depuis un serveur de courrier à toi :
//  SMTP_HOST  SMTP_PORT  SMTP_USER  SMTP_PASS
//
// RÉPONSE : { ok, envoyes, echecs, destinataires, duree_ms }
// ═══════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.16";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
//  Le mot de passe partagé entre la base et cette fonction : le même que celui
//  écrit dans alertes-par-email.sql (étape 3). À retirer en même temps que la clé.
const EMAIL_TRIGGER_SECRET = Deno.env.get("EMAIL_TRIGGER_SECRET") ?? "959944d32035a13ff482880420158f58c52ecc704f7e613f";

const SMTP_HOST = Deno.env.get("SMTP_HOST") ?? "";
const SMTP_PORT = Number(Deno.env.get("SMTP_PORT") ?? "587");
const SMTP_USER = Deno.env.get("SMTP_USER") ?? "";
const SMTP_PASS = Deno.env.get("SMTP_PASS") ?? "";
const MAIL_FROM = Deno.env.get("MAIL_FROM") ?? "";
const MAIL_FROM_NAME = Deno.env.get("MAIL_FROM_NAME") ?? "En-Check";

// ── L'identité du message : le même visage partout ──────────────────────────
// L'adresse de l'application, le logo et l'adresse de contact. Les trois
// peuvent être repris depuis les secrets de la fonction ; les valeurs ci-dessous
// sont celles de la production.
const APP_URL = (Deno.env.get("APP_URL") ?? "https://en-check.vercel.app").replace(/\/+$/, "");
const LOGO_URL = Deno.env.get("LOGO_URL") ?? `${APP_URL}/pwa-192x192.png`;
const CONTACT_EMAIL = Deno.env.get("CONTACT_EMAIL") ?? "en.check.contact@gmail.com";
//  ⚠️⚠️  CLÉ D'ESSAI — À RETIRER AVANT D'ENVOYER CE FICHIER SUR UN DÉPÔT  ⚠️⚠️
//  C'est la clé Brevo, ici en clair pour que tu voies où elle se branche.
//  Dès que tu la poses en secret dans Supabase, c'est le secret qui gagne :
//  tu remplaces alors la valeur entre guillemets par "" et cette ligne redevient inoffensive.
const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY") ?? "";

const ALLOWED_ORIGINS = (Deno.env.get("PUSH_ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((o) => o.trim().replace(/\/+$/, ""))
  .filter(Boolean);

if (!SUPABASE_URL) throw new Error("SUPABASE_URL manquant");
if (!SERVICE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY manquant");
if (!EMAIL_TRIGGER_SECRET) throw new Error("EMAIL_TRIGGER_SECRET manquant");

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// ────────────────────────────────────────────────
// 🧰 OUTILS
// ────────────────────────────────────────────────
function corsHeaders(origin: string | null): Record<string, string> {
  const base: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-email-secret",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    base["Access-Control-Allow-Origin"] = origin;
    base["Vary"] = "Origin";
  }
  return base;
}

function json(
  status: number,
  corps: unknown,
  origin: string | null = null,
): Response {
  return new Response(JSON.stringify(corps), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

function texte(v: unknown, max = 500): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function echec(a: string, b: string): boolean {
  // Comparaison à durée constante : on ne laisse rien deviner par le temps de réponse.
  if (a.length !== b.length) return true;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d !== 0;
}

function adresseValide(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
}

function proteger(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function appelantEstSuperAdmin(authHeader: string | null): Promise<boolean> {
  if (!authHeader?.toLowerCase().startsWith("bearer ")) return false;
  const client = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) return false;
  const { data: ligne, error: e2 } = await supabase
    .from("admins")
    .select("id, role, is_active")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (e2 || !ligne) return false;
  return ligne.is_active === true && ligne.role === "super_admin";
}

// ────────────────────────────────────────────────
// ✉️ LE MESSAGE
// ────────────────────────────────────────────────
type Ligne = {
  titre?: string;
  detail?: string;
  quand?: string;
  gravite?: string;
  type?: string;
  employe?: string;
};

const COULEUR: Record<string, string> = {
  critique: "#DC2626",
  attention: "#D97706",
  info: "#2563EB",
};

const MOT: Record<string, string> = {
  critique: "À TRAITER SANS ATTENDRE",
  attention: "À VÉRIFIER",
  info: "POUR INFORMATION",
};

// Le geste utile, situation par situation. Une phrase, en langage de tous les
// jours : le responsable sait quoi faire sans avoir à deviner.
const CONSEIL: Record<string, string> = {
  pointeuse_muette: "Vérifiez que l'appareil est sous tension, connecté au réseau, et que l'heure affichée est juste. Les pointages faits pendant la coupure remonteront d'eux-mêmes à la reconnexion.",
  badge_inconnu: "Un badge a été présenté sans correspondre à personne : rattachez-le à la fiche de l'employé, ou retirez-le du lot s'il n'est plus utilisé.",
  sans_sortie: "Une entrée a été enregistrée sans sortie. Demandez à la personne de compléter son pointage, ou corrigez la journée depuis le journal des pointages.",
  absent: "Personne n'a pointé là où le planning attendait quelqu'un. Un coup de téléphone suffit souvent à savoir s'il s'agit d'une absence, d'un retard ou d'un oubli.",
  suspect: "Le pointage ne colle pas avec l'horaire prévu. Regardez la journée concernée et confirmez ou corrigez.",
  horloge: "L'heure de l'appareil qui a pointé est décalée. Réglez l'horloge de l'appareil : c'est elle qui fait foi au moment du pointage.",
  hors_zone: "Le pointage a eu lieu en dehors de la zone autorisée. Vérifiez le lieu avec la personne concernée.",
  repos_court: "La personne a repris trop tôt après son service précédent. Décalez la prochaine prise de service pour lui laisser le repos prévu.",
  saisie_manuelle: "Un pointage a été saisi à la main. C'est autorisé : gardez simplement un œil sur la journée concernée.",
  double: "Deux pointages identiques se suivent de très près. Le second a été écarté : rien à faire, sauf si la journée vous semble incomplète.",
  pointage_modifie: "Un pointage a été modifié. Le journal garde qui a fait le geste et quand : vérifiez que c'est bien une correction légitime.",
  pointage_supprime: "Un pointage a été supprimé. Le journal garde qui a fait le geste et quand : vérifiez que la suppression est justifiée.",
  essai: "Vous pouvez retirer cette ligne d'essai : elle ne compte dans aucune statistique.",
};

function graviteDe(l: Ligne): string {
  const g = texte(l.gravite, 20) || "info";
  return g in COULEUR ? g : "info";
}

function conseilDe(l: Ligne): string {
  return CONSEIL[texte(l.type, 40)] ?? "";
}

// La phrase qui ouvre le message. Elle dit pourquoi on écrit, en une ligne.
function introduction(lignes: Ligne[], entreprise: string): string {
  const n = lignes.length;
  const gravite = lignes.some((l) => graviteDe(l) === "critique")
    ? "critique"
    : lignes.some((l) => graviteDe(l) === "attention")
    ? "attention"
    : "info";

  if (n > 1) {
    return gravite === "critique"
      ? `${n} situations viennent d'être détectées sur les pointages de l'entreprise ${entreprise}. Certaines demandent une action de votre part aujourd'hui.`
      : `${n} situations ont retenu notre attention sur les pointages de l'entreprise ${entreprise}. Voici de quoi il s'agit.`;
  }
  if (gravite === "critique") {
    return `Une situation demande votre attention immédiate sur les pointages de l'entreprise ${entreprise}.`;
  }
  if (gravite === "attention") {
    return `Un pointage mérite un coup d'œil de votre part sur l'entreprise ${entreprise}.`;
  }
  return `Une information sur les pointages de l'entreprise ${entreprise}, pour votre suivi.`;
}

function composerHtml(
  entreprise: string,
  titre: string,
  lignes: Ligne[],
  lien: string,
): string {
  const societe = proteger(entreprise);
  const cartes = lignes
    .map((l) => {
      const couleur = COULEUR[graviteDe(l)];
      const mot = MOT[graviteDe(l)];
      const conseil = conseilDe(l);
      const employe = proteger(texte(l.employe, 120));
      const quand = proteger(texte(l.quand, 60));
      const detail = proteger(texte(l.detail, 500));
      return `
        <tr><td style="padding:0 0 14px 0">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
                 style="border-left:4px solid ${couleur};background:#F8FAFC">
            <tr><td style="padding:12px 14px">
              <p style="margin:0 0 4px 0;font:600 11px/1.4 Arial,sans-serif;letter-spacing:.06em;color:${couleur}">${mot}</p>
              <p style="margin:0 0 6px 0;font:600 15px/1.4 Arial,sans-serif;color:#0F172A">${proteger(texte(l.titre, 200))}</p>
              ${employe ? `<p style="margin:0 0 6px 0;font:600 13px/1.5 Arial,sans-serif;color:#334155">Pour : ${employe}</p>` : ""}
              ${detail ? `<p style="margin:0;font:14px/1.5 Arial,sans-serif;color:#334155">${detail}</p>` : ""}
              ${quand ? `<p style="margin:6px 0 0 0;font:12px/1.4 Arial,sans-serif;color:#64748B">${quand}</p>` : ""}
              ${conseil ? `<p style="margin:10px 0 0 0;padding:9px 11px;background:#FFFFFF;border:1px solid #E2E8F0;font:13px/1.5 Arial,sans-serif;color:#334155"><span style="font-weight:600;color:#0F172A">Que faire : </span>${proteger(conseil)}</p>` : ""}
            </td></tr>
          </table>
        </td></tr>`;
    })
    .join("");

  return `<!doctype html>
<html lang="fr"><body style="margin:0;padding:24px 12px;background:#F1F5F9">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:620px;margin:0 auto;background:#FFFFFF">
    <tr><td style="padding:20px 24px;border-bottom:3px solid #0F172A">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
        <td style="width:52px;vertical-align:middle">
          <img src="${proteger(LOGO_URL)}" width="44" height="44" alt="En-Check"
               style="display:block;border:0;border-radius:9px" />
        </td>
        <td style="vertical-align:middle;padding-left:12px">
          <p style="margin:0;font:700 19px/1.3 Arial,sans-serif;color:#0F172A">En-Check</p>
          <p style="margin:2px 0 0 0;font:13px/1.4 Arial,sans-serif;color:#64748B">${societe} — suivi des pointages</p>
        </td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:22px 24px 4px 24px">
      <p style="margin:0 0 8px 0;font:15px/1.5 Arial,sans-serif;color:#0F172A">Bonjour,</p>
      <p style="margin:0 0 18px 0;font:15px/1.6 Arial,sans-serif;color:#334155">${proteger(introduction(lignes, entreprise))}</p>
      ${lignes.length > 1 ? `<p style="margin:0 0 16px 0;font:600 17px/1.4 Arial,sans-serif;color:#0F172A">${proteger(titre)}</p>` : ""}
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">${cartes}</table>
    </td></tr>
    <tr><td style="padding:6px 24px 20px 24px">
      ${lien ? `<p style="margin:0 0 20px 0"><a href="${proteger(lien)}" style="font:600 14px/1.4 Arial,sans-serif;color:#FFFFFF;background:#0F172A;padding:11px 18px;text-decoration:none;display:inline-block">Ouvrir le tableau de bord</a></p>` : ""}
      <p style="margin:0 0 4px 0;font:14px/1.6 Arial,sans-serif;color:#334155">Bonne journée,</p>
      <p style="margin:0 0 10px 0;font:600 14px/1.5 Arial,sans-serif;color:#0F172A">L'équipe En-Check</p>
      <p style="margin:0;font:12px/1.6 Arial,sans-serif;color:#64748B">
        Une question, un réglage à changer&nbsp;? Écrivez-nous&nbsp;:
        <a href="mailto:${proteger(CONTACT_EMAIL)}" style="color:#0F172A">${proteger(CONTACT_EMAIL)}</a><br />
        <a href="${proteger(APP_URL)}" style="color:#64748B">${proteger(APP_URL)}</a>
      </p>
    </td></tr>
    <tr><td style="padding:14px 24px 20px 24px;background:#F8FAFC;border-top:1px solid #E2E8F0">
      <p style="margin:0;font:11px/1.6 Arial,sans-serif;color:#94A3B8">
        Message automatique envoyé aux responsables de ${societe} parce que les alertes par courrier
        sont activées sur leur fiche. Pour ne plus le recevoir, décochez «&nbsp;alertes par courrier&nbsp;»
        sur votre fiche, ou écrivez-nous à ${proteger(CONTACT_EMAIL)}.
      </p>
    </td></tr>
  </table>
</body></html>`;
}

function composerTexte(
  entreprise: string,
  titre: string,
  lignes: Ligne[],
  lien: string,
): string {
  const corps = lignes
    .map((l) =>
      [
        `[${MOT[graviteDe(l)]}] ${texte(l.titre, 200)}`,
        l.employe ? `  Pour : ${texte(l.employe, 120)}` : "",
        l.detail ? `  ${texte(l.detail, 500)}` : "",
        l.quand ? `  ${texte(l.quand, 60)}` : "",
        conseilDe(l) ? `  Que faire : ${conseilDe(l)}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");

  return `En-Check — ${entreprise}

Bonjour,

${introduction(lignes, entreprise)}
${lignes.length > 1 ? `\n${titre}\n` : ""}
${corps}
${lien ? `\nTableau de bord : ${lien}\n` : ""}
Bonne journée,
L'équipe En-Check

Une question, un réglage à changer ? ${CONTACT_EMAIL}
${APP_URL}

--
Message automatique envoyé aux responsables de ${entreprise} parce que les alertes
par courrier sont activées sur leur fiche. Pour ne plus le recevoir, décochez
« alertes par courrier » sur votre fiche, ou écrivez-nous à ${CONTACT_EMAIL}.`;
}

// ────────────────────────────────────────────────
// 📤 L'ENVOI
// ────────────────────────────────────────────────
async function envoyer(
  destinataires: string[],
  sujet: string,
  html: string,
  texteBrut: string,
): Promise<{ envoyes: number; echecs: number; erreur: string | null }> {
  if (!MAIL_FROM) {
    return { envoyes: 0, echecs: destinataires.length, erreur: "MAIL_FROM manquant dans les secrets de la fonction" };
  }

  //  ① L'interface du fournisseur — HTTPS, elle passe toujours.
  if (BREVO_API_KEY) {
    try {
      const r = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": BREVO_API_KEY,
        },
        body: JSON.stringify({
          sender: { email: MAIL_FROM, name: MAIL_FROM_NAME },
          to: destinataires.map((email) => ({ email })),
          subject: sujet,
          htmlContent: html,
          textContent: texteBrut,
        }),
      });
      if (r.ok) return { envoyes: destinataires.length, echecs: 0, erreur: null };
      const t = await r.text();
      const detail = `fournisseur ${r.status} : ${t.slice(0, 200)}`;
      if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
        return { envoyes: 0, echecs: destinataires.length, erreur: detail };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
        return { envoyes: 0, echecs: destinataires.length, erreur: msg };
      }
    }
  }

  //  ② Le courrier direct, si un serveur d'envoi est renseigné.
  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    try {
      const transport = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_PORT === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      });
      const info = await transport.sendMail({
        from: `"${MAIL_FROM_NAME}" <${MAIL_FROM}>`,
        to: destinataires.join(", "),
        subject: sujet,
        text: texteBrut,
        html,
      });
      const refuses = Array.isArray(info?.rejected) ? info.rejected.length : 0;
      return { envoyes: destinataires.length - refuses, echecs: refuses, erreur: null };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!BREVO_API_KEY) return { envoyes: 0, echecs: destinataires.length, erreur: msg };
    }
  }

  return {
    envoyes: 0,
    echecs: destinataires.length,
    erreur: "aucun fournisseur configuré : ajoute la clé BREVO_API_KEY dans les secrets de la fonction",
  };
}

// ────────────────────────────────────────────────
// 🚪 LA PORTE
// ────────────────────────────────────────────────
serve(async (req) => {
  const origin = req.headers.get("origin");
  const t0 = Date.now();

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return json(405, { error: "method_not_allowed" }, origin);
  }

  const parLeSecret = !echec(req.headers.get("x-email-secret") ?? "", EMAIL_TRIGGER_SECRET);
  const parLeResponsable = parLeSecret
    ? false
    : await appelantEstSuperAdmin(req.headers.get("authorization"));

  if (!parLeSecret && !parLeResponsable) {
    return json(401, { error: "unauthorized" }, origin);
  }

  let brut: Record<string, unknown>;
  try {
    brut = await req.json();
  } catch {
    return json(400, { error: "invalid_json" }, origin);
  }

  const enterpriseId = texte(brut.enterprise_id, 60) || null;
  const source = parLeSecret ? "base" : "tableau_de_bord";

  const destinatairesImposes = Array.isArray(brut.destinataires)
    ? (brut.destinataires as unknown[]).map((d) => texte(d, 200)).filter(adresseValide)
    : [];

  const lignes: Ligne[] = Array.isArray(brut.lignes)
    ? (brut.lignes as Ligne[]).slice(0, 25)
    : [];
  if (lignes.length === 0 && texte(brut.detail)) {
    lignes.push({
      titre: texte(brut.titre, 200),
      detail: texte(brut.detail, 500),
      quand: texte(brut.quand, 60),
      gravite: texte(brut.gravite, 20),
    });
  }
  if (lignes.length === 0) {
    return json(400, { error: "aucune_alerte" }, origin);
  }

  // Nom de l'entreprise (le nom de la colonne varie selon les installations).
  let entreprise = "Votre entreprise";
  if (enterpriseId) {
    const { data } = await supabase.from("enterprises").select("*").eq("id", enterpriseId).maybeSingle();
    if (data) {
      const ligne = data as Record<string, unknown>;
      entreprise = texte(ligne.nom ?? ligne.name ?? ligne.raison_sociale, 120) || entreprise;
    }
  }

  // Destinataires : ceux imposés, sinon les responsables de l'entreprise.
  let destinataires = destinatairesImposes;
  if (destinataires.length === 0) {
    if (!enterpriseId) return json(400, { error: "enterprise_id_requis" }, origin);

    const { data: liens, error: eLiens } = await supabase
      .from("admin_entreprises")
      .select("admin_id")
      .eq("enterprise_id", enterpriseId)
      .eq("is_active", true);

    if (eLiens) {
      return json(500, { error: "lecture_des_rattachements_impossible", detail: eLiens.message }, origin);
    }

    const idsResponsables = (liens ?? [])
      .map((l) => String((l as Record<string, unknown>).admin_id ?? ""))
      .filter(Boolean);

    let responsables: Record<string, unknown>[] = [];
    if (idsResponsables.length > 0) {
      const { data, error: eAdmins } = await supabase
        .from("admins")
        .select("id, user_id, is_active, alertes_email")
        .in("id", idsResponsables);
      if (eAdmins) {
        return json(500, { error: "lecture_des_responsables_impossible", detail: eAdmins.message }, origin);
      }
      responsables = (data ?? []) as Record<string, unknown>[];
    }

    for (const ligne of responsables) {
      if (ligne.is_active === false) continue;
      if (ligne.alertes_email === false) continue;
      if (!ligne.user_id) continue;
      try {
        const { data } = await supabase.auth.admin.getUserById(String(ligne.user_id));
        const email = texte(data?.user?.email, 200);
        if (email && adresseValide(email)) destinataires.push(email);
      } catch {
        // un responsable mal rattaché ne doit pas empêcher les autres d'être prévenus
      }
    }
    destinataires = [...new Set(destinataires)];
  }

  if (destinataires.length === 0) {
    return json(200, { ok: true, envoyes: 0, echecs: 0, note: "aucun responsable joignable" }, origin);
  }

  // Anti-emballement : au-delà de 40 messages en 10 minutes pour une même
  // entreprise, on n'inonde plus personne — l'alerte reste dans la cloche.
  if (enterpriseId) {
    try {
      const depuis = new Date(Date.now() - 10 * 60_000).toISOString();
      const { count } = await supabase
        .from("encheck_email_logs")
        .select("id", { count: "exact", head: true })
        .eq("enterprise_id", enterpriseId)
        .gte("cree_le", depuis);
      if ((count ?? 0) >= 40) {
        return json(429, { error: "trop_de_messages", fenetre_minutes: 10 }, origin);
      }
    } catch {
      // jamais bloquant
    }
  }

  const premier = lignes[0];
  const titre = texte(brut.sujet, 160) ||
    (lignes.length === 1
      ? texte(premier.titre, 160) || "Anomalie de pointage"
      : `${lignes.length} anomalies de pointage`);
  const urgent = lignes.some((l) => graviteDe(l) === "critique");
  const sujet = `[En-Check] ${urgent ? "Action requise · " : ""}${entreprise} — ${titre}`;
  const lien = texte(brut.lien, 300) || `${APP_URL}/pointages`;

  const html = composerHtml(entreprise, titre, lignes, lien);
  const texteBrut = composerTexte(entreprise, titre, lignes, lien);

  const resultat = await envoyer(destinataires, sujet, html, texteBrut);
  const dureeMs = Date.now() - t0;

  try {
    await supabase.from("encheck_email_logs").insert({
      enterprise_id: enterpriseId,
      sujet,
      nb_alertes: lignes.length,
      destinataires: destinataires.join(", "),
      nb_destinataires: destinataires.length,
      envoyes: resultat.envoyes,
      echecs: resultat.echecs,
      erreur: resultat.erreur,
      source,
      duree_ms: dureeMs,
    });
  } catch {
    // le journal ne doit jamais faire échouer l'envoi
  }

  return json(
    resultat.erreur && resultat.envoyes === 0 ? 502 : 200,
    {
      ok: !resultat.erreur,
      envoyes: resultat.envoyes,
      echecs: resultat.echecs,
      destinataires,
      erreur: resultat.erreur,
      duree_ms: dureeMs,
    },
    origin,
  );
});
