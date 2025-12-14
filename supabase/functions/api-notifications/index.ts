import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";

async function getUserFromToken(supabaseClient: any, authHeader: string | null) {
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  const { data: { user } } = await supabaseClient.auth.getUser(token);
  return user;
}

async function getProfileId(supabaseAdmin: any, authUserId: string) {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("auth_user_id", authUserId)
    .single();
  return profile?.id;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

  const url = new URL(req.url);
  const path = url.pathname.replace("/api-notifications", "");
  const authHeader = req.headers.get("Authorization");

  try {
    const user = await getUserFromToken(supabaseClient, authHeader);

    if (!user) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const profileId = await getProfileId(supabaseAdmin, user.id);

    if (!profileId) {
      return new Response(
        JSON.stringify({ error: "Profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET /notifications - List user's notifications
    if (req.method === "GET" && path === "") {
      const page = parseInt(url.searchParams.get("page") || "1");
      const limit = parseInt(url.searchParams.get("limit") || "20");
      const unreadOnly = url.searchParams.get("unread_only") === "true";

      let query = supabaseAdmin
        .from("notifications")
        .select("*", { count: "exact" })
        .eq("user_id", profileId);

      if (unreadOnly) {
        query = query.eq("is_read", false);
      }

      const { data: notifications, count, error } = await query
        .order("created_at", { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get unread count
      const { count: unreadCount } = await supabaseAdmin
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", profileId)
        .eq("is_read", false);

      return new Response(
        JSON.stringify({
          notifications,
          unread_count: unreadCount || 0,
          pagination: { page, limit, total: count, totalPages: Math.ceil((count || 0) / limit) },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PATCH /:id/read - Mark notification as read
    const readMatch = path.match(/^\/([a-f0-9-]+)\/read$/);
    if (req.method === "PATCH" && readMatch) {
      const notificationId = readMatch[1];

      const { data: notification, error } = await supabaseAdmin
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notificationId)
        .eq("user_id", profileId)
        .select()
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify(notification),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PATCH /read-all - Mark all notifications as read
    if (req.method === "PATCH" && path === "/read-all") {
      const { error } = await supabaseAdmin
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", profileId)
        .eq("is_read", false);

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ message: "All notifications marked as read" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Notifications API error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
