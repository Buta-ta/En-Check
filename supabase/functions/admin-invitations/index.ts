import { createClient } from "npm:@supabase/supabase-js@2.87.3";

// The origin and redirect are configured by the operator, never by the request.
const appOrigin = Deno.env.get("ADMIN_APP_ORIGIN") || "";
const cors = {
  "Access-Control-Allow-Origin": appOrigin,
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
Deno.serve(async (request: Request) => {
  const reply = (status: number, body: object) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  if (
    !appOrigin.startsWith("https://") ||
    request.headers.get("origin") !== appOrigin
  ) return reply(403, { error: "Origine non autorisée." });
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (request.method !== "POST") {
    return reply(405, { error: "Méthode non autorisée." });
  }
  try {
    const authorization = request.headers.get("authorization") || "";
    if (!authorization.startsWith("Bearer ")) {
      return reply(401, { error: "Connexion requise." });
    }
    const url = Deno.env.get("SUPABASE_URL")!;
    const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: user, error: authError } = await caller.auth.getUser();
    if (authError || !user.user) {
      return reply(401, { error: "Connexion requise." });
    }
    const text = await request.text();
    if (text.length > 4096) {
      return reply(400, { error: "Requête trop longue." });
    }
    const input = JSON.parse(text);
    // This RPC enforces active superadmin, valid Auth session, AAL, limits and locks.
    const { data: item, error } = await caller.rpc(
      "encheck_invitation_prepare",
      {
        p_email: input.email ?? null,
        p_first_name: input.first_name ?? null,
        p_last_name: input.last_name ?? null,
        p_enterprise_id: input.enterprise_id ?? null,
        p_id: input.id ?? null,
      },
    ).single<{ id: string; user_id: string | null; email: string }>();
    if (error || !item) {
      return reply(400, {
        error:
          "Invitation refusée. Vérifiez les coordonnées, les droits et le délai de renvoi.",
      });
    }
    const server = createClient(
      url,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const redirectTo = `${appOrigin}/admin/activation`;
    let uid = item.user_id;
    let sent = false;
    if (uid) {
      // A recovery link also authenticates the existing invited identity. Activation
      // still requires the server invitation, matching verified email and expiry.
      const result = await server.auth.resetPasswordForEmail(item.email, {
        redirectTo,
      });
      sent = !result.error;
    } else {
      const result = await server.auth.admin.inviteUserByEmail(item.email, {
        redirectTo,
      });
      uid = result.data?.user?.id ?? null;
      sent = !result.error && !!uid;
    }
    const delivery = await server.rpc("encheck_invitation_delivery", {
      p_id: item.id,
      p_user_id: uid,
      p_success: sent,
    });
    if (delivery.error) {
      return reply(503, {
        error: "Envoi non finalisé : vérifier l’invitation avant de réessayer.",
      });
    }
    return sent
      ? reply(200, { id: item.id, sent: true })
      : reply(502, { error: "Le fournisseur e-mail a refusé l’envoi." });
  } catch {
    return reply(500, {
      error: "Invitation non confirmée. Vérifiez son état avant de réessayer.",
    });
  }
});
