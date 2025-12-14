import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { corsHeaders, getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

// Validation schemas
const RelatedReportsSchema = z.object({
  description: z.string().min(1).max(5000),
  type: z.enum(["infrastructure", "misconduct"]).optional(),
  limit: z.number().int().min(1).max(20).default(5),
});

const TransparencyQuerySchema = z.object({
  query: z.string().min(1).max(500),
});

async function getUserFromToken(supabaseClient: any, authHeader: string | null) {
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  const { data: { user } } = await supabaseClient.auth.getUser(token);
  return user;
}

async function callAI(messages: { role: string; content: string }[]) {
  if (!LOVABLE_API_KEY) {
    throw new Error("AI service not configured");
  }

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages,
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }
    if (response.status === 402) {
      throw new Error("AI credits exhausted. Please add credits.");
    }
    throw new Error(`AI request failed: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
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
  const path = url.pathname.replace("/api-ai", "");
  const authHeader = req.headers.get("Authorization");

  try {
    // Authentication required for all AI endpoints
    const user = await getUserFromToken(supabaseClient, authHeader);
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    // POST /reports/related - Find similar reports
    if (req.method === "POST" && path === "/reports/related") {
      const body = await req.json();
      const parsed = RelatedReportsSchema.safeParse(body);
      
      if (!parsed.success) {
        return new Response(
          JSON.stringify({ error: "Invalid input", details: parsed.error.flatten() }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const { description, type, limit } = parsed.data;

      // Get recent reports for comparison
      let query = supabaseAdmin
        .from("reports")
        .select("id, title, description, type, category, status, created_at")
        .order("created_at", { ascending: false })
        .limit(100);

      if (type) query = query.eq("type", type);

      const { data: reports } = await query;

      if (!reports || reports.length === 0) {
        return new Response(
          JSON.stringify({ similar_reports: [] }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Use AI to find similar reports
      const reportsContext = reports.map((r: any) => ({
        id: r.id,
        title: r.title,
        description: r.description.substring(0, 200),
        category: r.category,
      }));

      const aiResponse = await callAI([
        {
          role: "system",
          content: `You are an AI assistant that finds similar citizen reports. Given a new report description and a list of existing reports, identify the most similar ones based on topic, location, type of issue, and keywords.
Return a JSON array of report IDs that are most similar, ordered by relevance. Return ONLY valid JSON array of strings, no markdown or explanation.
Example: ["id1", "id2", "id3"]`,
        },
        {
          role: "user",
          content: `New report description: ${description}

Existing reports:
${JSON.stringify(reportsContext, null, 2)}

Return up to ${limit} most similar report IDs.`,
        },
      ]);

      let similarIds: string[] = [];
      try {
        similarIds = JSON.parse(aiResponse.replace(/```json\n?|\n?```/g, ""));
      } catch {
        console.error("Failed to parse AI response:", aiResponse);
      }

      // Get full details of similar reports
      const { data: similarReports } = await supabaseAdmin
        .from("reports")
        .select("id, title, type, category, status, created_at")
        .in("id", similarIds);

      return new Response(
        JSON.stringify({ similar_reports: similarReports || [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /transparency/query - Natural language query for projects
    if (req.method === "POST" && path === "/transparency/query") {
      const body = await req.json();
      const parsed = TransparencyQuerySchema.safeParse(body);
      
      if (!parsed.success) {
        return new Response(
          JSON.stringify({ error: "Invalid input", details: parsed.error.flatten() }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const { query } = parsed.data;

      // Use AI to parse the natural language query into filters
      const aiResponse = await callAI([
        {
          role: "system",
          content: `You are an AI assistant that converts natural language queries about government projects into structured filters.
Parse the query and return a JSON object with these optional fields:
- department: string (department name to filter)
- status: "planned" | "ongoing" | "completed" | "on_hold"
- min_budget: number (minimum budget amount)
- max_budget: number (maximum budget amount)
- location: string (location to search)
- date_from: string (YYYY-MM-DD format)
- date_to: string (YYYY-MM-DD format)
- sort_by: "budget" | "date" | "name"
- sort_order: "asc" | "desc"

Return ONLY valid JSON, no markdown or explanation.
If a filter is not mentioned, omit it from the response.`,
        },
        {
          role: "user",
          content: query,
        },
      ]);

      let filters: any = {};
      try {
        filters = JSON.parse(aiResponse.replace(/```json\n?|\n?```/g, ""));
      } catch {
        console.error("Failed to parse AI filter response:", aiResponse);
      }

      // Build and execute query based on parsed filters
      let dbQuery = supabaseAdmin.from("projects").select("*");

      if (filters.department) dbQuery = dbQuery.ilike("department", `%${filters.department}%`);
      if (filters.status) dbQuery = dbQuery.eq("status", filters.status);
      if (filters.min_budget) dbQuery = dbQuery.gte("total_budget_amount", filters.min_budget);
      if (filters.max_budget) dbQuery = dbQuery.lte("total_budget_amount", filters.max_budget);
      if (filters.location) dbQuery = dbQuery.ilike("location", `%${filters.location}%`);
      if (filters.date_from) dbQuery = dbQuery.gte("start_date", filters.date_from);
      if (filters.date_to) dbQuery = dbQuery.lte("end_date", filters.date_to);

      const sortColumn = filters.sort_by === "budget" ? "total_budget_amount" : 
                         filters.sort_by === "date" ? "start_date" : "name";
      dbQuery = dbQuery.order(sortColumn, { ascending: filters.sort_order !== "desc" });

      const { data: projects, error } = await dbQuery.limit(50);

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate AI summary of results
      let summary = "";
      if (projects && projects.length > 0) {
        const totalBudget = projects.reduce((sum: number, p: any) => sum + parseFloat(p.total_budget_amount || 0), 0);
        summary = `Found ${projects.length} projects matching your query with a combined budget of ₹${totalBudget.toLocaleString()}.`;
      } else {
        summary = "No projects found matching your query.";
      }

      return new Response(
        JSON.stringify({
          query: query,
          parsed_filters: filters,
          summary,
          results: projects || [],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("AI API error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
