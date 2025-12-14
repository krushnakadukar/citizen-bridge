import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

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

async function analyzeWithAI(description: string, type: string) {
  if (!LOVABLE_API_KEY) {
    console.log("AI analysis skipped - no API key");
    return { category: null, sentiment: null };
  }

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an AI assistant analyzing citizen reports. Analyze the report and return JSON with:
- category: suggested category (for infrastructure: roads, bridges, public_buildings, water_supply, electricity, drainage, parks, transportation; for misconduct: bribery, negligence, abuse_of_power, fraud, harassment, other)
- sentiment: overall sentiment (positive, negative, neutral, urgent)
Return ONLY valid JSON, no markdown.`,
          },
          {
            role: "user",
            content: `Report Type: ${type}\nDescription: ${description}`,
          },
        ],
      }),
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(content.replace(/```json\n?|\n?```/g, ""));
    return {
      category: parsed.category || null,
      sentiment: parsed.sentiment || null,
    };
  } catch (error) {
    console.error("AI analysis error:", error);
    return { category: null, sentiment: null };
  }
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
  const path = url.pathname.replace("/api-reports", "");
  const authHeader = req.headers.get("Authorization");

  try {
    const user = await getUserFromToken(supabaseClient, authHeader);
    let profileId: string | null = null;
    let role = "citizen";

    if (user) {
      const userData = await getUserRole(supabaseAdmin, user.id);
      profileId = userData.profileId;
      role = userData.role;
    }

    // POST /reports - Create new report (authenticated or anonymous)
    if (req.method === "POST" && path === "") {
      const body = await req.json();
      const {
        type,
        category,
        title,
        description,
        severity = "medium",
        location_lat,
        location_lng,
        location_address,
        is_anonymous = false,
      } = body;

      if (!type || !category || !title || !description) {
        return new Response(
          JSON.stringify({ error: "type, category, title, and description are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!["infrastructure", "misconduct"].includes(type)) {
        return new Response(
          JSON.stringify({ error: "type must be infrastructure or misconduct" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // AI analysis
      const aiAnalysis = await analyzeWithAI(description, type);

      const { data: report, error } = await supabaseAdmin
        .from("reports")
        .insert({
          reporter_user_id: is_anonymous ? null : profileId,
          type,
          category,
          title,
          description,
          severity,
          location_lat,
          location_lng,
          location_address,
          is_anonymous,
          ai_category_suggestion: aiAnalysis.category,
          ai_sentiment: aiAnalysis.sentiment,
        })
        .select()
        .single();

      if (error) {
        console.error("Report creation error:", error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create timeline event
      await supabaseAdmin.from("report_timeline_events").insert({
        report_id: report.id,
        event_type: "report_created",
        to_status: "submitted",
        performed_by_user_id: profileId,
        metadata: { is_anonymous },
      });

      // Log audit
      await supabaseAdmin.from("audit_logs").insert({
        actor_user_id: profileId,
        action: "report_created",
        entity_type: "report",
        entity_id: report.id,
        metadata: { type, category, is_anonymous },
      });

      console.log("Report created:", report.id);

      return new Response(
        JSON.stringify(report),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET /reports/my - Get user's own reports
    if (req.method === "GET" && path === "/my") {
      if (!user) {
        return new Response(
          JSON.stringify({ error: "Authentication required" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const page = parseInt(url.searchParams.get("page") || "1");
      const limit = parseInt(url.searchParams.get("limit") || "20");

      const { data: reports, count, error } = await supabaseAdmin
        .from("reports")
        .select("*", { count: "exact" })
        .eq("reporter_user_id", profileId)
        .eq("is_anonymous", false)
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
          reports,
          pagination: { page, limit, total: count, totalPages: Math.ceil((count || 0) / limit) },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET /reports - List all reports (admin/official only)
    if (req.method === "GET" && path === "") {
      if (!user || !["admin", "official"].includes(role)) {
        return new Response(
          JSON.stringify({ error: "Admin or official access required" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const page = parseInt(url.searchParams.get("page") || "1");
      const limit = parseInt(url.searchParams.get("limit") || "20");
      const status = url.searchParams.get("status");
      const type = url.searchParams.get("type");
      const severity = url.searchParams.get("severity");
      const dateFrom = url.searchParams.get("date_from");
      const dateTo = url.searchParams.get("date_to");

      let query = supabaseAdmin
        .from("reports")
        .select(`
          *,
          reporter:reporter_user_id(id, full_name, email),
          assigned_official:assigned_official_id(id, full_name, email)
        `, { count: "exact" });

      if (status) query = query.eq("status", status);
      if (type) query = query.eq("type", type);
      if (severity) query = query.eq("severity", severity);
      if (dateFrom) query = query.gte("created_at", dateFrom);
      if (dateTo) query = query.lte("created_at", dateTo);

      const { data: reports, count, error } = await query
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
          reports,
          pagination: { page, limit, total: count, totalPages: Math.ceil((count || 0) / limit) },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET /reports/:id
    const reportIdMatch = path.match(/^\/([a-f0-9-]+)$/);
    if (req.method === "GET" && reportIdMatch) {
      const reportId = reportIdMatch[1];

      const { data: report, error } = await supabaseAdmin
        .from("reports")
        .select(`
          *,
          reporter:reporter_user_id(id, full_name, email),
          assigned_official:assigned_official_id(id, full_name, email)
        `)
        .eq("id", reportId)
        .single();

      if (error || !report) {
        return new Response(
          JSON.stringify({ error: "Report not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check access: own report (non-anonymous) or admin/official
      const canAccess = 
        (report.reporter_user_id === profileId && !report.is_anonymous) ||
        ["admin", "official"].includes(role);

      if (!canAccess) {
        return new Response(
          JSON.stringify({ error: "Access denied" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify(report),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PATCH /reports/:id - Update report (official/admin only)
    const updateMatch = path.match(/^\/([a-f0-9-]+)$/);
    if (req.method === "PATCH" && updateMatch) {
      const reportId = updateMatch[1];

      if (!user || !["admin", "official"].includes(role)) {
        return new Response(
          JSON.stringify({ error: "Admin or official access required" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const body = await req.json();
      const { status: newStatus, severity, assigned_official_id } = body;

      // Get current report for timeline
      const { data: currentReport } = await supabaseAdmin
        .from("reports")
        .select("status")
        .eq("id", reportId)
        .single();

      const updateData: any = {};
      if (newStatus) updateData.status = newStatus;
      if (severity) updateData.severity = severity;
      if (assigned_official_id !== undefined) updateData.assigned_official_id = assigned_official_id;

      const { data: updatedReport, error } = await supabaseAdmin
        .from("reports")
        .update(updateData)
        .eq("id", reportId)
        .select()
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create timeline event for status change
      if (newStatus && currentReport?.status !== newStatus) {
        await supabaseAdmin.from("report_timeline_events").insert({
          report_id: reportId,
          event_type: "status_change",
          from_status: currentReport?.status,
          to_status: newStatus,
          performed_by_user_id: profileId,
        });

        // Create notification for reporter if report is not anonymous
        if (updatedReport.reporter_user_id) {
          await supabaseAdmin.from("notifications").insert({
            user_id: updatedReport.reporter_user_id,
            type: "report_status_change",
            title: "Report Status Updated",
            body: `Your report "${updatedReport.title}" status changed to ${newStatus}`,
          });
        }
      }

      // Log audit
      await supabaseAdmin.from("audit_logs").insert({
        actor_user_id: profileId,
        action: "report_updated",
        entity_type: "report",
        entity_id: reportId,
        metadata: updateData,
      });

      console.log("Report updated:", reportId);

      return new Response(
        JSON.stringify(updatedReport),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // DELETE /reports/:id - Delete report (admin only)
    const deleteMatch = path.match(/^\/([a-f0-9-]+)$/);
    if (req.method === "DELETE" && deleteMatch) {
      const reportId = deleteMatch[1];

      if (!user || role !== "admin") {
        return new Response(
          JSON.stringify({ error: "Admin access required" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error } = await supabaseAdmin
        .from("reports")
        .delete()
        .eq("id", reportId);

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Log audit
      await supabaseAdmin.from("audit_logs").insert({
        actor_user_id: profileId,
        action: "report_deleted",
        entity_type: "report",
        entity_id: reportId,
      });

      console.log("Report deleted:", reportId);

      return new Response(
        JSON.stringify({ message: "Report deleted successfully" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Reports API error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
