import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  const url = new URL(req.url);
  const path = url.pathname.replace("/api-transparency", "");

  try {
    // GET /reports/summary - Aggregate statistics
    if (req.method === "GET" && path === "/reports/summary") {
      // Get project counts by status
      const { data: projects } = await supabaseAdmin
        .from("projects")
        .select("status, total_budget_amount");

      const projectStats = {
        total_projects: projects?.length || 0,
        planned: 0,
        ongoing: 0,
        completed: 0,
        on_hold: 0,
        total_budget: 0,
      };

      projects?.forEach((p: any) => {
        if (p.status) projectStats[p.status as keyof typeof projectStats]++;
        projectStats.total_budget += parseFloat(p.total_budget_amount) || 0;
      });

      // Get financial totals
      const { data: transactions } = await supabaseAdmin
        .from("financial_transactions")
        .select("transaction_type, amount");

      const financialStats = {
        total_allocated: 0,
        total_released: 0,
        total_expenditure: 0,
      };

      transactions?.forEach((t: any) => {
        if (t.transaction_type === "allocation") financialStats.total_allocated += parseFloat(t.amount);
        if (t.transaction_type === "release") financialStats.total_released += parseFloat(t.amount);
        if (t.transaction_type === "expenditure") financialStats.total_expenditure += parseFloat(t.amount);
      });

      // Get department breakdown
      const { data: departmentData } = await supabaseAdmin
        .from("projects")
        .select("department, total_budget_amount");

      const departmentBreakdown: Record<string, { count: number; budget: number }> = {};
      departmentData?.forEach((p: any) => {
        const dept = p.department || "Unknown";
        if (!departmentBreakdown[dept]) {
          departmentBreakdown[dept] = { count: 0, budget: 0 };
        }
        departmentBreakdown[dept].count++;
        departmentBreakdown[dept].budget += parseFloat(p.total_budget_amount) || 0;
      });

      return new Response(
        JSON.stringify({
          projects: projectStats,
          financials: financialStats,
          utilization_rate: financialStats.total_allocated > 0
            ? ((financialStats.total_expenditure / financialStats.total_allocated) * 100).toFixed(2)
            : 0,
          departments: departmentBreakdown,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET /reports/custom - Custom filtered report
    if (req.method === "GET" && path === "/reports/custom") {
      const department = url.searchParams.get("department");
      const status = url.searchParams.get("status");
      const dateFrom = url.searchParams.get("date_from");
      const dateTo = url.searchParams.get("date_to");
      const minBudget = url.searchParams.get("min_budget");
      const maxBudget = url.searchParams.get("max_budget");

      let query = supabaseAdmin.from("projects").select("*");

      if (department) query = query.ilike("department", `%${department}%`);
      if (status) query = query.eq("status", status);
      if (dateFrom) query = query.gte("start_date", dateFrom);
      if (dateTo) query = query.lte("end_date", dateTo);
      if (minBudget) query = query.gte("total_budget_amount", parseFloat(minBudget));
      if (maxBudget) query = query.lte("total_budget_amount", parseFloat(maxBudget));

      const { data: projects, error } = await query.order("total_budget_amount", { ascending: false });

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get financial details for each project
      const projectIds = projects?.map((p: any) => p.id) || [];
      const { data: allTransactions } = await supabaseAdmin
        .from("financial_transactions")
        .select("*")
        .in("project_id", projectIds);

      const transactionsByProject: Record<string, any[]> = {};
      allTransactions?.forEach((t: any) => {
        if (!transactionsByProject[t.project_id]) {
          transactionsByProject[t.project_id] = [];
        }
        transactionsByProject[t.project_id].push(t);
      });

      const enrichedProjects = projects?.map((p: any) => {
        const projectTransactions = transactionsByProject[p.id] || [];
        const financialSummary = {
          allocated: 0,
          released: 0,
          expenditure: 0,
        };
        projectTransactions.forEach((t: any) => {
          if (t.transaction_type === "allocation") financialSummary.allocated += parseFloat(t.amount);
          if (t.transaction_type === "release") financialSummary.released += parseFloat(t.amount);
          if (t.transaction_type === "expenditure") financialSummary.expenditure += parseFloat(t.amount);
        });
        return {
          ...p,
          financial_summary: financialSummary,
        };
      });

      // Calculate totals
      const totals = {
        total_projects: enrichedProjects?.length || 0,
        total_budget: enrichedProjects?.reduce((sum: number, p: any) => sum + parseFloat(p.total_budget_amount || 0), 0),
        total_allocated: enrichedProjects?.reduce((sum: number, p: any) => sum + p.financial_summary.allocated, 0),
        total_released: enrichedProjects?.reduce((sum: number, p: any) => sum + p.financial_summary.released, 0),
        total_expenditure: enrichedProjects?.reduce((sum: number, p: any) => sum + p.financial_summary.expenditure, 0),
      };

      return new Response(
        JSON.stringify({
          projects: enrichedProjects,
          totals,
          filters_applied: { department, status, dateFrom, dateTo, minBudget, maxBudget },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Transparency API error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
