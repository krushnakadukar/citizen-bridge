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
  const path = url.pathname.replace("/api-report-details", "");
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

    // Evidence routes: /reports/:id/evidence
    const evidenceMatch = path.match(/^\/([a-f0-9-]+)\/evidence$/);
    if (evidenceMatch) {
      const reportId = evidenceMatch[1];

      // POST - Upload evidence
      if (req.method === "POST") {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        const fileType = formData.get("file_type") as string || "image";

        if (!file) {
          return new Response(
            JSON.stringify({ error: "File is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Upload to storage
        const fileName = `${reportId}/${Date.now()}-${file.name}`;
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
          .from("evidence-media")
          .upload(fileName, file);

        if (uploadError) {
          console.error("Upload error:", uploadError);
          return new Response(
            JSON.stringify({ error: uploadError.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: urlData } = supabaseAdmin.storage
          .from("evidence-media")
          .getPublicUrl(fileName);

        // Save evidence record
        const { data: evidence, error } = await supabaseAdmin
          .from("report_evidence")
          .insert({
            report_id: reportId,
            file_url: urlData.publicUrl,
            file_type: fileType,
            original_filename: file.name,
            uploaded_by_user_id: profileId,
          })
          .select()
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Create timeline event
        await supabaseAdmin.from("report_timeline_events").insert({
          report_id: reportId,
          event_type: "evidence_added",
          performed_by_user_id: profileId,
          metadata: { file_name: file.name, file_type: fileType },
        });

        console.log("Evidence uploaded for report:", reportId);

        return new Response(
          JSON.stringify(evidence),
          { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // GET - List evidence
      if (req.method === "GET") {
        const { data: evidence, error } = await supabaseAdmin
          .from("report_evidence")
          .select("*")
          .eq("report_id", reportId)
          .order("created_at", { ascending: false });

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ evidence }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // GET signed URL for evidence: /evidence/:evidenceId
    const signedUrlMatch = path.match(/^\/evidence\/([a-f0-9-]+)$/);
    if (req.method === "GET" && signedUrlMatch) {
      const evidenceId = signedUrlMatch[1];

      const { data: evidence, error } = await supabaseAdmin
        .from("report_evidence")
        .select("*")
        .eq("id", evidenceId)
        .single();

      if (error || !evidence) {
        return new Response(
          JSON.stringify({ error: "Evidence not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Extract path from URL for signed URL
      const urlParts = evidence.file_url.split("/evidence-media/");
      const filePath = urlParts[1];

      const { data: signedData, error: signedError } = await supabaseAdmin.storage
        .from("evidence-media")
        .createSignedUrl(filePath, 3600); // 1 hour expiry

      if (signedError) {
        return new Response(
          JSON.stringify({ error: signedError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ signed_url: signedData.signedUrl, expires_in: 3600 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Comments routes: /reports/:id/comments
    const commentsMatch = path.match(/^\/([a-f0-9-]+)\/comments$/);
    if (commentsMatch) {
      const reportId = commentsMatch[1];

      // POST - Add comment
      if (req.method === "POST") {
        if (!user) {
          return new Response(
            JSON.stringify({ error: "Authentication required" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { content, is_public = true } = await req.json();

        if (!content) {
          return new Response(
            JSON.stringify({ error: "Content is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: comment, error } = await supabaseAdmin
          .from("report_comments")
          .insert({
            report_id: reportId,
            author_user_id: profileId,
            author_role: role,
            content,
            is_public,
          })
          .select(`*, author:author_user_id(id, full_name)`)
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Create timeline event
        await supabaseAdmin.from("report_timeline_events").insert({
          report_id: reportId,
          event_type: "comment_added",
          performed_by_user_id: profileId,
          metadata: { is_public },
        });

        // Notify report owner if comment is from official/admin
        if (["official", "admin"].includes(role)) {
          const { data: report } = await supabaseAdmin
            .from("reports")
            .select("reporter_user_id, title")
            .eq("id", reportId)
            .single();

          if (report?.reporter_user_id) {
            await supabaseAdmin.from("notifications").insert({
              user_id: report.reporter_user_id,
              type: "new_comment",
              title: "New Comment on Your Report",
              body: `An official commented on your report "${report.title}"`,
            });
          }
        }

        console.log("Comment added to report:", reportId);

        return new Response(
          JSON.stringify(comment),
          { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // GET - List comments
      if (req.method === "GET") {
        let query = supabaseAdmin
          .from("report_comments")
          .select(`*, author:author_user_id(id, full_name)`)
          .eq("report_id", reportId)
          .order("created_at", { ascending: true });

        // Non-officials can only see public comments
        if (!["admin", "official"].includes(role)) {
          query = query.eq("is_public", true);
        }

        const { data: comments, error } = await query;

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
    }

    // Timeline routes: /reports/:id/timeline
    const timelineMatch = path.match(/^\/([a-f0-9-]+)\/timeline$/);
    if (req.method === "GET" && timelineMatch) {
      const reportId = timelineMatch[1];

      const { data: timeline, error } = await supabaseAdmin
        .from("report_timeline_events")
        .select(`*, performed_by:performed_by_user_id(id, full_name)`)
        .eq("report_id", reportId)
        .order("created_at", { ascending: true });

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ timeline }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Report details API error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
