import { createClient } from "npm:@supabase/supabase-js@2.87.3";
const origin = Deno.env.get("ADMIN_APP_ORIGIN") || "";
const cors = {
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
};
Deno.serve(async (request: Request) => {
  const reply = (status: number, body: object) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  if (
    !origin.startsWith("https://") || request.headers.get("origin") !== origin
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
    const user = await caller.auth.getUser();
    if (user.error || !user.data.user) {
      return reply(401, { error: "Connexion requise." });
    }
    const text = await request.text();
    if (text.length > 4096) {
      return reply(400, { error: "Requête trop longue." });
    }
    const input = JSON.parse(text);
    // Server requires an active superadmin with AAL2, a distinct target,
    // matching email and a reason. Logs the intent BEFORE the Auth operation.
    const { data: job, error } = await caller.rpc(
      "encheck_mfa_recovery_prepare",
      {
        p_target_id: input.target_id,
        p_confirm_email: input.confirm_email,
        p_reason: input.reason,
      },
    ).single<{ id: string; user_id: string }>();
    if (error || !job) {
      return reply(403, {
        error:
          "Récupération refusée : vérifiez votre second facteur, la cible, le motif et le délai.",
      });
    }
    const server = createClient(
      url,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    let success = false;
    try {
      const result = await server.auth.admin.mfa.listFactors({
        userId: job.user_id,
      });
      if (result.error) throw result.error;
      for (const factor of result.data.factors) {
        const deleted = await server.auth.admin.mfa.deleteFactor({
          userId: job.user_id,
          id: factor.id,
        });
        if (deleted.error) throw deleted.error;
      }
      success = true;
    } catch { /* Do not leak provider responses or factor identifiers. */ }
    const recorded = await server.rpc("encheck_mfa_recovery_finish", {
      p_job_id: job.id,
      p_success: success,
    });
    if (recorded.error || !success) {
      return reply(503, {
        error:
          "Récupération non confirmée ou partielle. Vérifiez les facteurs et le journal avant de recommencer.",
      });
    }
    return reply(200, { completed: true });
  } catch {
    return reply(500, {
      error: "Récupération non confirmée. Vérifiez le journal.",
    });
  }
});
