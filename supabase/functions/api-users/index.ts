import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getUserFromToken(supabaseClient: any, authHeader: string | null) {
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  const { data: { user } } = await supabaseClient.auth.getUser(token);
  return user;
}

async function getUserRole(supabaseAdmin: any, authUserId: string) {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, user_roles(role)")
    .eq("auth_user_id", authUserId)
    .single();
  
  return {
    profileId: profile?.id,
    role: profile?.user_roles?.[0]?.role || "citizen",
  };
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
  const path = url.pathname.replace("/api-users", "");
  const authHeader = req.headers.get("Authorization");

  try {
    const user = await getUserFromToken(supabaseClient, authHeader);
    
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { profileId, role } = await getUserRole(supabaseAdmin, user.id);

    // GET /me or PATCH /me
    if (path === "/me") {
      if (req.method === "GET") {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select(`*, user_roles(role)`)
          .eq("auth_user_id", user.id)
          .single();

        return new Response(
          JSON.stringify({ 
            ...profile, 
            role: profile?.user_roles?.[0]?.role || "citizen" 
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (req.method === "PATCH") {
        const { full_name, phone } = await req.json();
        
        const { data: updated, error } = await supabaseAdmin
          .from("profiles")
          .update({ full_name, phone })
          .eq("auth_user_id", user.id)
          .select()
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify(updated),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Admin-only routes
    if (role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET /users
    if (req.method === "GET" && path === "") {
      const page = parseInt(url.searchParams.get("page") || "1");
      const limit = parseInt(url.searchParams.get("limit") || "20");
      const search = url.searchParams.get("search");
      const roleFilter = url.searchParams.get("role");

      let query = supabaseAdmin
        .from("profiles")
        .select(`*, user_roles(role)`, { count: "exact" });

      if (search) {
        query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
      }

      const { data: profiles, count, error } = await query
        .range((page - 1) * limit, page * limit - 1)
        .order("created_at", { ascending: false });

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const usersWithRoles = profiles?.map((p: any) => ({
        ...p,
        role: p.user_roles?.[0]?.role || "citizen",
      }));

      // Filter by role if specified
      const filteredUsers = roleFilter 
        ? usersWithRoles?.filter((u: any) => u.role === roleFilter)
        : usersWithRoles;

      return new Response(
        JSON.stringify({
          users: filteredUsers,
          pagination: {
            page,
            limit,
            total: count,
            totalPages: Math.ceil((count || 0) / limit),
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET /users/:id
    const userIdMatch = path.match(/^\/([a-f0-9-]+)$/);
    if (req.method === "GET" && userIdMatch) {
      const userId = userIdMatch[1];
      
      const { data: profile, error } = await supabaseAdmin
        .from("profiles")
        .select(`*, user_roles(role)`)
        .eq("id", userId)
        .single();

      if (error || !profile) {
        return new Response(
          JSON.stringify({ error: "User not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ ...profile, role: profile.user_roles?.[0]?.role || "citizen" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PATCH /users/:id/role
    const roleUpdateMatch = path.match(/^\/([a-f0-9-]+)\/role$/);
    if (req.method === "PATCH" && roleUpdateMatch) {
      const userId = roleUpdateMatch[1];
      const { role: newRole } = await req.json();

      if (!["citizen", "official", "admin"].includes(newRole)) {
        return new Response(
          JSON.stringify({ error: "Invalid role. Must be citizen, official, or admin" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update or insert role
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .upsert(
          { user_id: userId, role: newRole },
          { onConflict: "user_id,role" }
        );

      if (roleError) {
        // If upsert fails, try delete + insert
        await supabaseAdmin
          .from("user_roles")
          .delete()
          .eq("user_id", userId);

        await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: userId, role: newRole });
      }

      // Log audit
      await supabaseAdmin.from("audit_logs").insert({
        actor_user_id: profileId,
        action: "role_changed",
        entity_type: "user",
        entity_id: userId,
        metadata: { new_role: newRole },
      });

      console.log(`Role updated for user ${userId} to ${newRole}`);

      return new Response(
        JSON.stringify({ message: "Role updated successfully", role: newRole }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Users API error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
