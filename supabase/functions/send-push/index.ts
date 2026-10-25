import { adminSessionAllowed } from '../_shared/admin-session.js'
// supabase/functions/send-push/index.ts

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? "https://cxggndvhwdolbtyezjde.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";

const PUSH_TRIGGER_SECRET = Deno.env.get("PUSH_TRIGGER_SECRET") ?? "";

if (!SUPABASE_URL) throw new Error("SUPABASE_URL manquant");
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY manquant");
if (!VAPID_PUBLIC_KEY) throw new Error("VAPID_PUBLIC_KEY manquant");
if (!VAPID_PRIVATE_KEY) throw new Error("VAPID_PRIVATE_KEY manquant");
if (!PUSH_TRIGGER_SECRET) throw new Error("PUSH_TRIGGER_SECRET manquant");

webpush.setVapidDetails(
  "mailto:contact@en-check.app",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
);

type SendPushPayload = {
  user_type?: "admin" | "employee";
  enterprise_id?: string | null;
  user_ids?: string[] | null;

  title?: string;
  body?: string;
  url?: string;
  tag?: string;

  severity?: "info" | "warning" | "critical";
  requireInteraction?: boolean;
  vibrate?: number[];
};

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-push-trigger-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

function jsonResponse(status: number, data: unknown) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders });
}

async function isSuperAdminCaller(authHeader: string | null) {
  if (!authHeader?.toLowerCase().startsWith("bearer ")) return false;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !authData?.user) return false;
  if (!await adminSessionAllowed(createClient, SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY'), authHeader)) return false;

  const userId = authData.user.id;

  const { data: adminRow, error } = await supabase
    .from("admins")
    .select("id, role, is_active")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return false;
  if (!adminRow) return false;
  if (adminRow.is_active !== true) return false;

  return adminRow.role === "super_admin";
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "method_not_allowed" });
  }

  // Auth:
  // - DB trigger: header x-push-trigger-secret
  // - UI superadmin: Authorization Bearer + check role super_admin
  const triggerSecret = req.headers.get("x-push-trigger-secret");
  const authHeader = req.headers.get("authorization");

  const authorizedByTrigger = !!triggerSecret && triggerSecret === PUSH_TRIGGER_SECRET;
  const authorizedBySuperAdmin = await isSuperAdminCaller(authHeader);

  if (!authorizedByTrigger && !authorizedBySuperAdmin) {
    return jsonResponse(401, { error: "unauthorized" });
  }

  let payload: SendPushPayload;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(400, { error: "invalid_json" });
  }

  const {
    user_type,
    enterprise_id = null,
    user_ids = null,
    title = "En-Check",
    body = "",
    url = "/",
    tag = "encheck",
    severity = "info",
    requireInteraction = false,
    vibrate,
  } = payload;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let query = supabase
    .from("push_subscriptions")
    .select("id, endpoint, keys_p256dh, keys_auth")
    .eq("is_active", true);

  if (user_type) query = query.eq("user_type", user_type);

  // Si enterprise_id fourni: cible enterprise_id = X + enterprise_id IS NULL (pour superadmin/global)
  if (enterprise_id) {
    query = query.or(`enterprise_id.eq.${enterprise_id},enterprise_id.is.null`);
  }

  if (user_ids && Array.isArray(user_ids) && user_ids.length > 0) {
    query = query.in("user_id", user_ids);
  }

  const { data: subs, error: subsErr } = await query;
  if (subsErr) return jsonResponse(500, { error: subsErr.message });

  if (!subs || subs.length === 0) {
    return jsonResponse(200, { sent: 0, failed: 0, total: 0 });
  }

  const finalVibrate =
    vibrate ??
    (severity === "critical"
      ? [250, 100, 250, 100, 250]
      : severity === "warning"
      ? [200, 80, 200]
      : [200, 100, 200]);

  const pushPayload = JSON.stringify({
    title,
    body,
    url,
    tag,
    severity,
    requireInteraction: severity === "critical" ? true : !!requireInteraction,
    vibrate: finalVibrate,
  });

  let sent = 0;
  let failed = 0;

  for (const s of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: s.endpoint,
          keys: { p256dh: s.keys_p256dh, auth: s.keys_auth },
        },
        pushPayload,
      );
      sent++;
    } catch (e: any) {
      failed++;

      const statusCode = e?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await supabase
          .from("push_subscriptions")
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq("id", s.id);
      }
    }
  }

  return jsonResponse(200, { sent, failed, total: subs.length });
});