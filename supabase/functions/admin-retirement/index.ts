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
    if (text.length > 1024) {
      return reply(400, { error: "Requête trop longue." });
    }
    const input = JSON.parse(text);
    // Client supplies only a request ID. SQL supplies the immutable identity
    // after validating two distinct superadmins, AAL2 and a seven-day archive.
    const { data: job, error } = await caller.rpc(
      "encheck_retirement_execute",
      { p_request_id: input.request_id },
    );
    if (error || !job) {
      return reply(403, {
        error:
          "Suppression refusée. Vérifiez les approbateurs, l’archivage, les responsabilités et votre MFA.",
      });
    }
    if (job.state === "completed") {
      return reply(200, { completed: true, shared_identity_preserved: false });
    }
    if (
      !["auth_pending", "shared_identity_preserved"].includes(job.state) ||
      !/^[0-9a-f-]{36}$/i.test(job.auth_user_id)
    ) return reply(503, { error: "État serveur à vérifier." });
    const server = createClient(
      url,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    // Delete only files listed in this administrative avatar prefix. Never
    // touch employee buckets or arbitrary URLs supplied by the browser.
    let emptied = false;
    for (let batch = 0; batch < 20; batch++) {
      const listed = await server.storage.from("admin-avatars").list(
        job.auth_user_id,
        { limit: 100 },
      );
      if (listed.error) throw listed.error;
      if (!listed.data.length) {
        emptied = true;
        break;
      }
      if (
        listed.data.some((file) =>
          !file.id || file.name.includes("/") || file.name === ".."
        )
      ) throw new Error("Unexpected storage layout");
      const removed = await server.storage.from("admin-avatars").remove(
        listed.data.map((file) => `${job.auth_user_id}/${file.name}`),
      );
      if (removed.error) throw removed.error;
    }
    if (!emptied) throw new Error("Cleanup needs another batch");
    if (job.state === "auth_pending") {
      const deleted = await server.auth.admin.deleteUser(job.auth_user_id);
      if (deleted.error && deleted.error.status !== 404) throw deleted.error;
    }
    // SQL verifies the absence of avatar objects and (unless shared) Auth user.
    const finished = await server.rpc("encheck_retirement_finish", {
      p_request_id: job.id,
    });
    if (finished.error) throw finished.error;
    return reply(200, {
      completed: true,
      shared_identity_preserved: job.state === "shared_identity_preserved",
    });
  } catch {
    return reply(503, {
      error:
        "Nettoyage non confirmé. Le profil peut déjà être clôturé ; consultez l’état et reprenez le nettoyage, sans recréer le compte.",
    });
  }
});
