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
// Secret partagé entre pg_net et cette fonction. Il doit être défini dans les
// secrets Supabase et ne doit jamais être conservé en clair dans le dépôt.
const EMAIL_TRIGGER_SECRET = Deno.env.get("EMAIL_TRIGGER_SECRET") ?? "";

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
// Clé Brevo : uniquement dans les Custom secrets du projet Supabase, jamais dans Git.
const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY") ?? "";

const DEFAULT_APP_ORIGIN = (() => {
  try {
    return new URL(APP_URL).origin;
  } catch {
    return "";
  }
})();
const ALLOWED_ORIGINS = [...new Set([
  DEFAULT_APP_ORIGIN,
  ...(Deno.env.get("PUSH_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean),
].filter(Boolean))];

if (!SUPABASE_URL) throw new Error("SUPABASE_URL manquant");
if (!SERVICE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY manquant");

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

type StatutDestinataire = "accepted" | "failed" | "not_sent" | "blocked";
type ResultatDestinataire = {
  email: string;
  statut: StatutDestinataire;
  erreur: string | null;
};

type EmailLogInput = {
  enterpriseId: string | null;
  sujet: string;
  lignes: Ligne[];
  destinataires: string[];
  resultatsDestinataires?: ResultatDestinataire[];
  envoyes?: number;
  echecs?: number;
  erreur?: string | null;
  source: string;
  dureeMs: number;
  statut: string;
  payload: Record<string, unknown>;
  fournisseur?: string;
  providerMessageId?: string | null;
  retryOf?: string | null;
};

async function enregistrerJournal(input: EmailLogInput): Promise<{ id: string | null; erreur: string | null }> {
  try {
    const { data, error } = await supabase
      .from("encheck_email_logs")
      .insert({
        enterprise_id: input.enterpriseId,
        sujet: input.sujet,
        nb_alertes: input.lignes.length,
        destinataires: input.destinataires.join(", "),
        destinataires_json: input.destinataires,
        resultats_destinataires: input.resultatsDestinataires ?? [],
        nb_destinataires: input.destinataires.length,
        envoyes: input.envoyes ?? 0,
        echecs: input.echecs ?? 0,
        erreur: input.erreur ?? null,
        source: input.source,
        duree_ms: input.dureeMs,
        statut: input.statut,
        payload: input.payload,
        fournisseur: input.fournisseur ?? "aucun",
        provider_message_id: input.providerMessageId ?? null,
        retry_of: input.retryOf ?? null,
      })
      .select("id")
      .maybeSingle();

    return { id: data?.id ?? null, erreur: error?.message ?? null };
  } catch (error) {
    return {
      id: null,
      erreur: error instanceof Error ? error.message : String(error),
    };
  }
}

// ────────────────────────────────────────────────
// 🧰 OUTILS
// ────────────────────────────────────────────────
function corsHeaders(origin: string | null): Record<string, string> {
  const base: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-email-secret",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
type ResultatEnvoi = {
  envoyes: number;
  echecs: number;
  erreur: string | null;
  fournisseur: string;
  providerMessageId: string | null;
  resultatsDestinataires: ResultatDestinataire[];
};

function resultatsPourTous(
  destinataires: string[],
  statut: StatutDestinataire,
  erreur: string | null,
): ResultatDestinataire[] {
  return destinataires.map((email) => ({ email, statut, erreur }));
}

function adresseDepuisReponse(value: unknown): string {
  let address = "";
  if (typeof value === "string") address = value.trim();
  else if (value && typeof value === "object") {
    const rawAddress = (value as Record<string, unknown>).address;
    if (typeof rawAddress === "string") address = rawAddress.trim();
  }
  const enclosed = address.match(/<([^<>\s]+@[^<>\s]+)>/);
  return enclosed?.[1] ?? address;
}

async function envoyer(
  destinataires: string[],
  sujet: string,
  html: string,
  texteBrut: string,
): Promise<ResultatEnvoi> {
  if (!MAIL_FROM) {
    const erreur = "MAIL_FROM manquant dans les secrets de la fonction";
    return {
      envoyes: 0,
      echecs: destinataires.length,
      erreur,
      fournisseur: "aucun",
      providerMessageId: null,
      resultatsDestinataires: resultatsPourTous(destinataires, "not_sent", erreur),
    };
  }

  const erreurs: string[] = [];

  // ① Brevo : son acceptation ne signifie pas encore une livraison en boîte.
  if (BREVO_API_KEY) {
    try {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
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
      const responseText = await response.text();
      let responseBody: Record<string, unknown> = {};
      try {
        responseBody = responseText ? JSON.parse(responseText) as Record<string, unknown> : {};
      } catch {
        // Certaines réponses d'erreur du fournisseur ne sont pas du JSON.
      }
      if (response.ok) {
        return {
          envoyes: destinataires.length,
          echecs: 0,
          erreur: null,
          fournisseur: "brevo",
          providerMessageId: typeof responseBody.messageId === "string" ? responseBody.messageId : null,
          resultatsDestinataires: resultatsPourTous(destinataires, "accepted", null),
        };
      }
      erreurs.push(`Brevo ${response.status} : ${responseText.slice(0, 300)}`);
    } catch (error) {
      erreurs.push(error instanceof Error ? error.message : String(error));
    }

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      const erreur = erreurs.join(" · ") || "Échec de l’envoi par Brevo.";
      return {
        envoyes: 0,
        echecs: destinataires.length,
        erreur,
        fournisseur: "brevo",
        providerMessageId: null,
        resultatsDestinataires: resultatsPourTous(destinataires, "failed", erreur),
      };
    }
  }

  // ② SMTP de secours : conserve les adresses acceptées/refusées par le serveur.
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
      const accepted = new Set(
        (Array.isArray(info?.accepted) ? info.accepted : [])
          .map(adresseDepuisReponse).filter(Boolean).map((email) => email.toLowerCase()),
      );
      const rejectedValues = Array.isArray(info?.rejected) ? info.rejected : [];
      const rejected = new Set(
        rejectedValues.map(adresseDepuisReponse).filter(Boolean).map((email) => email.toLowerCase()),
      );
      const refusSansAdresse = rejectedValues.length > 0 && rejected.size === 0;
      const resultatsDestinataires = destinataires.map((email): ResultatDestinataire => {
        const normalized = email.toLowerCase();
        if (rejected.has(normalized)) {
          return { email, statut: "failed", erreur: "Adresse refusée par le serveur SMTP." };
        }
        if (accepted.has(normalized) || (accepted.size === 0 && rejected.size === 0)) {
          return { email, statut: "accepted", erreur: null };
        }
        if (refusSansAdresse) {
          return { email, statut: "not_sent", erreur: "Le serveur SMTP n'a pas identifié l'adresse refusée." };
        }
        if (accepted.size > 0) {
          return { email, statut: "not_sent", erreur: "Le serveur SMTP n'a pas confirmé cette adresse." };
        }
        return { email, statut: "accepted", erreur: null };
      });
      const envoyes = resultatsDestinataires.filter((item) => item.statut === "accepted").length;
      const echecs = destinataires.length - envoyes;
      const erreur = echecs > 0 ? `${echecs} destinataire(s) refusé(s) ou non confirmé(s) par SMTP` : null;
      return {
        envoyes,
        echecs,
        erreur,
        fournisseur: "smtp",
        providerMessageId: typeof info?.messageId === "string" ? info.messageId : null,
        resultatsDestinataires,
      };
    } catch (error) {
      erreurs.push(error instanceof Error ? error.message : String(error));
      const erreur = erreurs.join(" · ");
      return {
        envoyes: 0,
        echecs: destinataires.length,
        erreur,
        fournisseur: "smtp",
        providerMessageId: null,
        resultatsDestinataires: resultatsPourTous(destinataires, "failed", erreur),
      };
    }
  }

  const erreur = erreurs.length
    ? erreurs.join(" · ")
    : "Aucun fournisseur configuré : ajoute BREVO_API_KEY ou les paramètres SMTP dans les secrets.";
  return {
    envoyes: 0,
    echecs: destinataires.length,
    erreur,
    fournisseur: erreurs.length ? "brevo" : "aucun",
    providerMessageId: null,
    resultatsDestinataires: resultatsPourTous(
      destinataires,
      erreurs.length ? "failed" : "not_sent",
      erreur,
    ),
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
  if (req.method !== "GET" && req.method !== "POST") {
    return json(405, { error: "method_not_allowed" }, origin);
  }

  const parLeSecret = EMAIL_TRIGGER_SECRET.length >= 32 &&
    !echec(req.headers.get("x-email-secret") ?? "", EMAIL_TRIGGER_SECRET);
  const parLeResponsable = parLeSecret
    ? false
    : await appelantEstSuperAdmin(req.headers.get("authorization"));

  if (!parLeSecret && !parLeResponsable) {
    return json(401, { error: "unauthorized" }, origin);
  }

  // Health check authentifié, sans envoi ni exposition de valeurs secrètes.
  if (req.method === "GET") {
    return json(200, {
      service: "send-email",
      version: "email-monitor-v1",
      configuration: {
        sender_configured: Boolean(MAIL_FROM),
        provider_configured: Boolean(BREVO_API_KEY || (SMTP_HOST && SMTP_USER && SMTP_PASS)),
        trigger_secret_configured: EMAIL_TRIGGER_SECRET.length >= 32,
        origin_allowed: !origin || ALLOWED_ORIGINS.includes(origin),
      },
    }, origin);
  }

  let source = parLeSecret ? "base" : "tableau_de_bord";
  let brut: Record<string, unknown>;
  try {
    brut = await req.json();
  } catch {
    const journal = await enregistrerJournal({
      enterpriseId: null,
      sujet: "Requête e-mail invalide",
      lignes: [],
      destinataires: [],
      erreur: "invalid_json",
      source,
      dureeMs: Date.now() - t0,
      statut: "not_sent",
      payload: {},
    });
    return json(400, { error: "invalid_json", journal_id: journal.id, journalise: !journal.erreur }, origin);
  }

  const enterpriseId = texte(brut.enterprise_id, 60) || null;
  const retryOfValue = texte(brut.retry_of, 60);
  const retryOf = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(retryOfValue)
    ? retryOfValue
    : null;
  if (retryOf) source = "relance";

  const destinatairesImposes = Array.isArray(brut.destinataires)
    ? [...new Set((brut.destinataires as unknown[]).map((d) => texte(d, 200)).filter(adresseValide))]
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
    const journal = await enregistrerJournal({
      enterpriseId,
      sujet: texte(brut.sujet, 160) || "Requête e-mail sans alerte",
      lignes: [],
      destinataires: [],
      erreur: "aucune_alerte",
      source,
      dureeMs: Date.now() - t0,
      statut: "not_sent",
      payload: { enterprise_id: enterpriseId, sujet: texte(brut.sujet, 160), destinataires: [] },
      retryOf,
    });
    return json(400, { error: "aucune_alerte", journal_id: journal.id, journalise: !journal.erreur }, origin);
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
  const analyseDestinataires: Record<string, unknown>[] = destinatairesImposes.map((email) => ({
    email_auth: email,
    inclus: true,
    raison: "Adresse explicitement demandée par l'appelant.",
  }));

  if (destinataires.length === 0) {
    if (!enterpriseId) {
      const note = "enterprise_id_requis";
      const journal = await enregistrerJournal({
        enterpriseId: null,
        sujet: texte(brut.sujet, 160) || "Alerte e-mail sans entreprise",
        lignes,
        destinataires: [],
        erreur: note,
        source,
        dureeMs: Date.now() - t0,
        statut: "not_sent",
        payload: { sujet: texte(brut.sujet, 160), lignes, destinataires: [] },
        retryOf,
      });
      return json(400, { error: note, journal_id: journal.id, journalise: !journal.erreur }, origin);
    }

    const { data: liens, error: eLiens } = await supabase
      .from("admin_entreprises")
      .select("admin_id")
      .eq("enterprise_id", enterpriseId)
      .eq("is_active", true);

    if (eLiens) {
      const journal = await enregistrerJournal({
        enterpriseId,
        sujet: texte(brut.sujet, 160) || "Erreur de routage e-mail",
        lignes,
        destinataires: [],
        erreur: `lecture_des_rattachements_impossible: ${eLiens.message}`,
        source,
        dureeMs: Date.now() - t0,
        statut: "not_sent",
        payload: { enterprise_id: enterpriseId, lignes, destinataires: [] },
        retryOf,
      });
      return json(500, { error: "lecture_des_rattachements_impossible", detail: eLiens.message, journal_id: journal.id }, origin);
    }

    const idsResponsables = [...new Set((liens ?? [])
      .map((l) => String((l as Record<string, unknown>).admin_id ?? ""))
      .filter(Boolean))];

    let responsables: Record<string, unknown>[] = [];
    if (idsResponsables.length > 0) {
      const { data, error: eAdmins } = await supabase
        .from("admins")
        .select("id, user_id, is_active, alertes_email, first_name, last_name, email")
        .in("id", idsResponsables);
      if (eAdmins) {
        const journal = await enregistrerJournal({
          enterpriseId,
          sujet: texte(brut.sujet, 160) || "Erreur de routage e-mail",
          lignes,
          destinataires: [],
          erreur: `lecture_des_responsables_impossible: ${eAdmins.message}`,
          source,
          dureeMs: Date.now() - t0,
          statut: "not_sent",
          payload: { enterprise_id: enterpriseId, lignes, destinataires: [] },
          retryOf,
        });
        return json(500, { error: "lecture_des_responsables_impossible", detail: eAdmins.message, journal_id: journal.id }, origin);
      }
      responsables = (data ?? []) as Record<string, unknown>[];
    }

    for (const ligne of responsables) {
      const audit: Record<string, unknown> = {
        admin_id: String(ligne.id ?? ""),
        nom: `${texte(ligne.first_name, 100)} ${texte(ligne.last_name, 100)}`.trim() || "Admin",
        email_fiche: texte(ligne.email, 200) || null,
        email_auth: null,
        inclus: false,
        raison: "",
      };
      if (ligne.is_active === false) {
        audit.raison = "La fiche Admin est inactive.";
      } else if (ligne.alertes_email === false) {
        audit.raison = "Les alertes e-mail sont désactivées sur la fiche Admin.";
      } else if (!ligne.user_id) {
        audit.raison = "La fiche Admin n'est pas liée à un compte Supabase Auth.";
      } else {
        try {
          const { data, error } = await supabase.auth.admin.getUserById(String(ligne.user_id));
          const emailAuth = texte(data?.user?.email, 200);
          if (error || !emailAuth) {
            audit.raison = "Aucune adresse disponible sur le compte Supabase Auth.";
          } else if (!adresseValide(emailAuth)) {
            audit.raison = "L'adresse du compte Supabase Auth n'est pas valide.";
          } else {
            audit.email_auth = emailAuth;
            audit.inclus = true;
            if (audit.email_fiche && String(audit.email_fiche).toLowerCase() !== emailAuth.toLowerCase()) {
              audit.raison = "L'adresse du compte Auth est utilisée; elle diffère de l'adresse de la fiche.";
            } else {
              audit.raison = "Prêt à recevoir les alertes e-mail.";
            }
            destinataires.push(emailAuth);
          }
        } catch {
          audit.raison = "Impossible de lire l'adresse du compte Supabase Auth.";
        }
      }
      analyseDestinataires.push(audit);
    }
    destinataires = [...new Set(destinataires)];
  }

  // Aperçu sans envoi : le superadmin peut voir les destinataires calculés
  // avant de lancer un vrai test ou une relance, y compris quand la liste est vide.
  if (brut.preview_only === true) {
    return json(200, {
      ok: true,
      preview: true,
      enterprise_id: enterpriseId,
      entreprise,
      destinataires,
      analyse_destinataires: analyseDestinataires,
      nb_destinataires: destinataires.length,
      note: destinataires.length
        ? "Aucun e-mail n'a été envoyé."
        : enterpriseId && analyseDestinataires.length === 0
        ? "Aucun rattachement actif trouvé dans admin_entreprises pour cette entreprise."
        : "Aucun destinataire éligible; consulte les raisons de non-inclusion ci-dessous.",
    }, origin);
  }

  if (destinataires.length === 0) {
    const note = "Aucun responsable éligible : rattachement, préférence e-mail ou compte Auth manquant.";
    const journal = await enregistrerJournal({
      enterpriseId,
      sujet: texte(brut.sujet, 160) || "Alerte e-mail sans destinataire",
      lignes,
      destinataires: [],
      erreur: note,
      source,
      dureeMs: Date.now() - t0,
      statut: "not_sent",
      payload: {
        enterprise_id: enterpriseId,
        sujet: texte(brut.sujet, 160),
        lien: texte(brut.lien, 300),
        lignes,
        destinataires: [],
        analyse_destinataires: analyseDestinataires,
      },
      retryOf,
    });
    return json(200, {
      ok: false,
      envoyes: 0,
      echecs: 0,
      destinataires: [],
      statut: "not_sent",
      note,
      journal_id: journal.id,
      journalise: !journal.erreur,
      erreur_journal: journal.erreur,
    }, origin);
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
        .in("statut", ["accepted", "failed", "partial"])
        .gte("cree_le", depuis);
      if ((count ?? 0) >= 40) {
        const note = "Limite anti-emballement atteinte : 40 tentatives d’envoi sur 10 minutes.";
        const journal = await enregistrerJournal({
          enterpriseId,
          sujet: texte(brut.sujet, 160) || "Envoi e-mail limité",
          lignes,
          destinataires,
          resultatsDestinataires: resultatsPourTous(destinataires, "blocked", note),
          erreur: note,
          source,
          dureeMs: Date.now() - t0,
          statut: "blocked",
          payload: {
            enterprise_id: enterpriseId,
            sujet: texte(brut.sujet, 160),
            lien: texte(brut.lien, 300),
            lignes,
            destinataires,
            analyse_destinataires: analyseDestinataires,
          },
          retryOf,
        });
        return json(429, { error: "trop_de_messages", detail: note, journal_id: journal.id }, origin);
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
  const statut = resultat.envoyes > 0 && resultat.echecs > 0
    ? "partial"
    : resultat.envoyes > 0
    ? "accepted"
    : resultat.resultatsDestinataires.length > 0 && resultat.resultatsDestinataires.every((item) => item.statut === "not_sent")
    ? "not_sent"
    : "failed";
  const payloadJournal = {
    enterprise_id: enterpriseId,
    sujet: texte(brut.sujet, 160),
    lien,
    lignes,
    // Garder la liste effectivement utilisée afin de permettre une relance
    // contrôlée vers les mêmes boîtes, même si les rattachements changent ensuite.
    destinataires,
    analyse_destinataires: analyseDestinataires,
    resultats_destinataires: resultat.resultatsDestinataires,
  };

  const journal = await enregistrerJournal({
    enterpriseId,
    sujet,
    lignes,
    destinataires,
    resultatsDestinataires: resultat.resultatsDestinataires,
    envoyes: resultat.envoyes,
    echecs: resultat.echecs,
    erreur: resultat.erreur,
    source,
    dureeMs,
    statut,
    payload: payloadJournal,
    fournisseur: resultat.fournisseur,
    providerMessageId: resultat.providerMessageId,
    retryOf,
  });

  return json(
    resultat.erreur && resultat.envoyes === 0 ? 502 : 200,
    {
      ok: !resultat.erreur,
      envoyes: resultat.envoyes,
      echecs: resultat.echecs,
      destinataires,
      resultats_destinataires: resultat.resultatsDestinataires,
      erreur: resultat.erreur,
      duree_ms: dureeMs,
      statut,
      fournisseur: resultat.fournisseur,
      provider_message_id: resultat.providerMessageId,
      journal_id: journal.id,
      journalise: !journal.erreur,
      erreur_journal: journal.erreur,
    },
    origin,
  );
});
