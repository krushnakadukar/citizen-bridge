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
  const path = url.pathname.replace("/api-projects", "");
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

    // GET /projects - List all projects (public)
    if (req.method === "GET" && path === "") {
      const page = parseInt(url.searchParams.get("page") || "1");
      const limit = parseInt(url.searchParams.get("limit") || "20");
      const status = url.searchParams.get("status");
      const department = url.searchParams.get("department");
      const location = url.searchParams.get("location");
      const dateFrom = url.searchParams.get("date_from");
      const dateTo = url.searchParams.get("date_to");

      let query = supabaseAdmin
        .from("projects")
        .select("*", { count: "exact" });

      if (status) query = query.eq("status", status);
      if (department) query = query.ilike("department", `%${department}%`);
      if (location) query = query.ilike("location", `%${location}%`);
      if (dateFrom) query = query.gte("start_date", dateFrom);
      if (dateTo) query = query.lte("end_date", dateTo);

      const { data: projects, count, error } = await query
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
          projects,
          pagination: { page, limit, total: count, totalPages: Math.ceil((count || 0) / limit) },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /projects - Create project (admin only)
    if (req.method === "POST" && path === "") {
      if (!user || role !== "admin") {
        return new Response(
          JSON.stringify({ error: "Admin access required" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const body = await req.json();
      const {
        project_code,
        name,
        description,
        department,
        location,
        start_date,
        end_date,
        status = "planned",
        total_budget_amount = 0,
      } = body;

      if (!project_code || !name) {
        return new Response(
          JSON.stringify({ error: "project_code and name are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: project, error } = await supabaseAdmin
        .from("projects")
        .insert({
          project_code,
          name,
          description,
          department,
          location,
          start_date,
          end_date,
          status,
          total_budget_amount,
        })
        .select()
        .single();

      if (error) {
        console.error("Project creation error:", error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Log audit
      await supabaseAdmin.from("audit_logs").insert({
        actor_user_id: profileId,
        action: "project_created",
        entity_type: "project",
        entity_id: project.id,
        metadata: { project_code, name },
      });

      console.log("Project created:", project.id);

      return new Response(
        JSON.stringify(project),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET /projects/:id - Get project details with budget summary
    const projectIdMatch = path.match(/^\/([a-f0-9-]+)$/);
    if (req.method === "GET" && projectIdMatch) {
      const projectId = projectIdMatch[1];

      const { data: project, error } = await supabaseAdmin
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();

      if (error || !project) {
        return new Response(
          JSON.stringify({ error: "Project not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get financial summary
      const { data: transactions } = await supabaseAdmin
        .from("financial_transactions")
        .select("transaction_type, amount")
        .eq("project_id", projectId);

      const financialSummary = {
        total_allocated: 0,
        total_released: 0,
        total_expenditure: 0,
      };

      transactions?.forEach((t: any) => {
        if (t.transaction_type === "allocation") financialSummary.total_allocated += parseFloat(t.amount);
        if (t.transaction_type === "release") financialSummary.total_released += parseFloat(t.amount);
        if (t.transaction_type === "expenditure") financialSummary.total_expenditure += parseFloat(t.amount);
      });

      // Get latest progress
      const { data: latestUpdate } = await supabaseAdmin
        .from("project_updates")
        .select("progress_percentage")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      return new Response(
        JSON.stringify({
          ...project,
          financial_summary: financialSummary,
          current_progress: latestUpdate?.progress_percentage || 0,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PATCH /projects/:id - Update project (admin only)
    const updateMatch = path.match(/^\/([a-f0-9-]+)$/);
    if (req.method === "PATCH" && updateMatch) {
      const projectId = updateMatch[1];

      if (!user || role !== "admin") {
        return new Response(
          JSON.stringify({ error: "Admin access required" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const body = await req.json();

      const { data: project, error } = await supabaseAdmin
        .from("projects")
        .update(body)
        .eq("id", projectId)
        .select()
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Log audit
      await supabaseAdmin.from("audit_logs").insert({
        actor_user_id: profileId,
        action: "project_updated",
        entity_type: "project",
        entity_id: projectId,
        metadata: body,
      });

      console.log("Project updated:", projectId);

      return new Response(
        JSON.stringify(project),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Transactions: /projects/:id/transactions
    const transactionsMatch = path.match(/^\/([a-f0-9-]+)\/transactions$/);
    if (transactionsMatch) {
      const projectId = transactionsMatch[1];

      // GET - List transactions
      if (req.method === "GET") {
        const { data: transactions, error } = await supabaseAdmin
          .from("financial_transactions")
          .select("*")
          .eq("project_id", projectId)
          .order("transaction_date", { ascending: false });

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ transactions }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // POST - Add transaction (admin only)
      if (req.method === "POST") {
        if (!user || role !== "admin") {
          return new Response(
            JSON.stringify({ error: "Admin access required" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const body = await req.json();
        const { transaction_type, amount, transaction_date, description, contractor_name, invoice_reference, metadata } = body;

        if (!transaction_type || !amount || !transaction_date) {
          return new Response(
            JSON.stringify({ error: "transaction_type, amount, and transaction_date are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: transaction, error } = await supabaseAdmin
          .from("financial_transactions")
          .insert({
            project_id: projectId,
            transaction_type,
            amount,
            transaction_date,
            description,
            contractor_name,
            invoice_reference,
            metadata: metadata || {},
          })
          .select()
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Log audit
        await supabaseAdmin.from("audit_logs").insert({
          actor_user_id: profileId,
          action: "transaction_created",
          entity_type: "financial_transaction",
          entity_id: transaction.id,
          metadata: { project_id: projectId, transaction_type, amount },
        });

        console.log("Transaction added to project:", projectId);

        return new Response(
          JSON.stringify(transaction),
          { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Updates: /projects/:id/updates
    const updatesMatch = path.match(/^\/([a-f0-9-]+)\/updates$/);
    if (updatesMatch) {
      const projectId = updatesMatch[1];

      // GET - List updates
      if (req.method === "GET") {
        const { data: updates, error } = await supabaseAdmin
          .from("project_updates")
          .select("*")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false });

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ updates }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // POST - Add update (admin only)
      if (req.method === "POST") {
        if (!user || role !== "admin") {
          return new Response(
            JSON.stringify({ error: "Admin access required" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const body = await req.json();
        const { title, description, progress_percentage, media_url } = body;

        if (!title) {
          return new Response(
            JSON.stringify({ error: "title is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: update, error } = await supabaseAdmin
          .from("project_updates")
          .insert({
            project_id: projectId,
            title,
            description,
            progress_percentage: progress_percentage || 0,
            media_url,
          })
          .select()
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        console.log("Update added to project:", projectId);

        return new Response(
          JSON.stringify(update),
          { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Comments: /projects/:id/comments
    const commentsMatch = path.match(/^\/([a-f0-9-]+)\/comments$/);
    if (commentsMatch) {
      const projectId = commentsMatch[1];

      // GET - List comments
      if (req.method === "GET") {
        const { data: comments, error } = await supabaseAdmin
          .from("transparency_comments")
          .select(`*, user:user_id(id, full_name)`)
          .eq("project_id", projectId)
          .order("created_at", { ascending: false });

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ comments }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // POST - Add comment (authenticated)
      if (req.method === "POST") {
        if (!user) {
          return new Response(
            JSON.stringify({ error: "Authentication required" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { content } = await req.json();

        if (!content) {
          return new Response(
            JSON.stringify({ error: "content is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: comment, error } = await supabaseAdmin
          .from("transparency_comments")
          .insert({
            project_id: projectId,
            user_id: profileId,
            content,
          })
          .select(`*, user:user_id(id, full_name)`)
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        console.log("Comment added to project:", projectId);

        return new Response(
          JSON.stringify(comment),
          { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: "Not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Projects API error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
