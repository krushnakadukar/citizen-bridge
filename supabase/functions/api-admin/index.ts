import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";

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
  const path = url.pathname.replace("/api-admin", "");
  const authHeader = req.headers.get("Authorization");

  try {
    const user = await getUserFromToken(supabaseClient, authHeader);

    if (!user) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { role } = await getUserRole(supabaseAdmin, user.id);

    if (role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET /dashboard - System overview stats
    if (req.method === "GET" && path === "/dashboard") {
      // Report statistics
      const { data: reports } = await supabaseAdmin
        .from("reports")
        .select("status, severity, type, created_at");

      const reportStats = {
        total: reports?.length || 0,
        by_status: {} as Record<string, number>,
        by_severity: {} as Record<string, number>,
        by_type: {} as Record<string, number>,
        unresolved: 0,
      };

      const unresolvedStatuses = ["submitted", "under_review", "assigned", "in_progress"];
      reports?.forEach((r: any) => {
        reportStats.by_status[r.status] = (reportStats.by_status[r.status] || 0) + 1;
        reportStats.by_severity[r.severity] = (reportStats.by_severity[r.severity] || 0) + 1;
        reportStats.by_type[r.type] = (reportStats.by_type[r.type] || 0) + 1;
        if (unresolvedStatuses.includes(r.status)) reportStats.unresolved++;
      });

      // Calculate average response time (submitted to under_review)
      const { data: timelineEvents } = await supabaseAdmin
        .from("report_timeline_events")
        .select("report_id, event_type, from_status, to_status, created_at")
        .eq("event_type", "status_change")
        .eq("from_status", "submitted")
        .eq("to_status", "under_review");

      let totalResponseTime = 0;
      let responseCount = 0;

      if (timelineEvents && timelineEvents.length > 0) {
        for (const event of timelineEvents) {
          const { data: report } = await supabaseAdmin
            .from("reports")
            .select("created_at")
            .eq("id", event.report_id)
            .single();

          if (report) {
            const submittedAt = new Date(report.created_at).getTime();
            const reviewedAt = new Date(event.created_at).getTime();
            totalResponseTime += reviewedAt - submittedAt;
            responseCount++;
          }
        }
      }

      const avgResponseTimeHours = responseCount > 0
        ? (totalResponseTime / responseCount / (1000 * 60 * 60)).toFixed(2)
        : null;

      // User statistics
      const { count: totalUsers } = await supabaseAdmin
        .from("profiles")
        .select("*", { count: "exact", head: true });

      const { data: userRoles } = await supabaseAdmin
        .from("user_roles")
        .select("role");

      const usersByRole: Record<string, number> = { citizen: 0, official: 0, admin: 0 };
      userRoles?.forEach((ur: any) => {
        usersByRole[ur.role] = (usersByRole[ur.role] || 0) + 1;
      });

      // Project statistics
      const { data: projects } = await supabaseAdmin
        .from("projects")
        .select("status, total_budget_amount");

      const projectStats = {
        total: projects?.length || 0,
        by_status: {} as Record<string, number>,
        total_budget: 0,
      };

      projects?.forEach((p: any) => {
        projectStats.by_status[p.status] = (projectStats.by_status[p.status] || 0) + 1;
        projectStats.total_budget += parseFloat(p.total_budget_amount) || 0;
      });

      // Recent activity (last 24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { count: reportsToday } = await supabaseAdmin
        .from("reports")
        .select("*", { count: "exact", head: true })
        .gte("created_at", oneDayAgo);

      const { count: commentsToday } = await supabaseAdmin
        .from("report_comments")
        .select("*", { count: "exact", head: true })
        .gte("created_at", oneDayAgo);

      return new Response(
        JSON.stringify({
          reports: reportStats,
          users: {
            total: totalUsers || 0,
            by_role: usersByRole,
          },
          projects: projectStats,
          metrics: {
            avg_response_time_hours: avgResponseTimeHours,
            reports_last_24h: reportsToday || 0,
            comments_last_24h: commentsToday || 0,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET /audit-logs - List audit logs
    if (req.method === "GET" && path === "/audit-logs") {
      const page = parseInt(url.searchParams.get("page") || "1");
      const limit = parseInt(url.searchParams.get("limit") || "50");
      const entityType = url.searchParams.get("entity_type");
      const action = url.searchParams.get("action");
      const dateFrom = url.searchParams.get("date_from");
      const dateTo = url.searchParams.get("date_to");

      let query = supabaseAdmin
        .from("audit_logs")
        .select(`
          *,
          actor:actor_user_id(id, full_name, email)
        `, { count: "exact" });

      if (entityType) query = query.eq("entity_type", entityType);
      if (action) query = query.ilike("action", `%${action}%`);
      if (dateFrom) query = query.gte("created_at", dateFrom);
      if (dateTo) query = query.lte("created_at", dateTo);

      const { data: logs, count, error } = await query
        .order("created_at", { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          logs,
          pagination: { page, limit, total: count, totalPages: Math.ceil((count || 0) / limit) },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Admin API error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
