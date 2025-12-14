import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";

// File validation constants
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  image: ["image/jpeg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif"],
  video: ["video/mp4", "video/quicktime", "video/webm", "video/mpeg"],
  document: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
};

// Magic bytes for file type validation
const MAGIC_BYTES: Record<string, number[][]> = {
  "image/jpeg": [[0xFF, 0xD8, 0xFF]],
  "image/png": [[0x89, 0x50, 0x4E, 0x47]],
  "image/gif": [[0x47, 0x49, 0x46, 0x38]],
  "image/webp": [[0x52, 0x49, 0x46, 0x46]], // RIFF header
  "application/pdf": [[0x25, 0x50, 0x44, 0x46]], // %PDF
  "video/mp4": [[0x00, 0x00, 0x00], [0x66, 0x74, 0x79, 0x70]], // ftyp
};

// Rate limiting store (in-memory for edge function)
const rateLimitStore = new Map<string, { count: number; timestamp: number }>();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 50; // 50 uploads per hour per user

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  if (!entry || now - entry.timestamp >= RATE_LIMIT_WINDOW) {
    rateLimitStore.set(identifier, { count: 1, timestamp: now });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  rateLimitStore.set(identifier, entry);
  return true;
}

function sanitizeFilename(filename: string): string {
  // Remove path traversal attempts and special characters
  return filename
    .replace(/\.\./g, "") // Remove path traversal
    .replace(/[\/\\]/g, "_") // Replace path separators
    .replace(/[^a-zA-Z0-9._-]/g, "_") // Only allow safe characters
    .substring(0, 255); // Limit length
}

function getAllowedMimeTypes(): string[] {
  return Object.values(ALLOWED_MIME_TYPES).flat();
}

async function validateMagicBytes(file: File): Promise<boolean> {
  const mimeType = file.type;
  const patterns = MAGIC_BYTES[mimeType];
  
  if (!patterns) {
    // For types without magic byte patterns, allow based on MIME type
    return getAllowedMimeTypes().includes(mimeType);
  }

  try {
    const buffer = await file.slice(0, 12).arrayBuffer();
    const bytes = new Uint8Array(buffer);

    return patterns.some(pattern => 
      pattern.every((byte, index) => bytes[index] === byte)
    );
  } catch {
    return false;
  }
}

function getFileType(mimeType: string): "image" | "video" | "document" | null {
  if (ALLOWED_MIME_TYPES.image.includes(mimeType)) return "image";
  if (ALLOWED_MIME_TYPES.video.includes(mimeType)) return "video";
  if (ALLOWED_MIME_TYPES.document.includes(mimeType)) return "document";
  return null;
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

  try {
    // Get authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limiting check
    if (!checkRateLimit(user.id)) {
      console.log(`Rate limit exceeded for user: ${user.id}`);
      return new Response(
        JSON.stringify({ error: "Upload rate limit exceeded. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (!profile) {
      return new Response(
        JSON.stringify({ error: "User profile not found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const reportId = formData.get("report_id") as string | null;

    if (!file) {
      return new Response(
        JSON.stringify({ error: "No file provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!reportId) {
      return new Response(
        JSON.stringify({ error: "Report ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate report ID format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(reportId)) {
      return new Response(
        JSON.stringify({ error: "Invalid report ID format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify report exists and user has access
    const { data: report, error: reportError } = await supabaseAdmin
      .from("reports")
      .select("id, reporter_user_id, is_anonymous")
      .eq("id", reportId)
      .single();

    if (reportError || !report) {
      return new Response(
        JSON.stringify({ error: "Report not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check user has permission to upload to this report
    const { data: userRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", profile.id)
      .single();

    const isOfficialOrAdmin = userRole?.role === "official" || userRole?.role === "admin";
    const isReportOwner = report.reporter_user_id === profile.id;

    if (!isOfficialOrAdmin && !isReportOwner) {
      console.log(`Access denied for user ${profile.id} to report ${reportId}`);
      return new Response(
        JSON.stringify({ error: "You do not have permission to upload to this report" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({ error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate MIME type
    const allowedMimes = getAllowedMimeTypes();
    if (!allowedMimes.includes(file.type)) {
      return new Response(
        JSON.stringify({ 
          error: "Invalid file type. Allowed: images, videos, and PDF/Word documents",
          allowed_types: allowedMimes
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate magic bytes (file content)
    const validContent = await validateMagicBytes(file);
    if (!validContent) {
      console.log(`Magic bytes validation failed for file: ${file.name}, type: ${file.type}`);
      return new Response(
        JSON.stringify({ error: "File content does not match declared type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine file type for database
    const fileType = getFileType(file.type);
    if (!fileType) {
      return new Response(
        JSON.stringify({ error: "Could not determine file type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sanitize filename
    const sanitizedName = sanitizeFilename(file.name);
    const fileExt = sanitizedName.split(".").pop() || "bin";
    const storagePath = `${reportId}/${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${fileExt}`;

    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from("evidence-media")
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return new Response(
        JSON.stringify({ error: "Failed to upload file to storage" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create evidence record
    const { data: evidence, error: evidenceError } = await supabaseAdmin
      .from("report_evidence")
      .insert({
        report_id: reportId,
        file_url: storagePath,
        file_type: fileType,
        original_filename: sanitizedName,
        uploaded_by_user_id: profile.id,
      })
      .select()
      .single();

    if (evidenceError) {
      console.error("Evidence record creation error:", evidenceError);
      // Clean up uploaded file on failure
      await supabaseAdmin.storage.from("evidence-media").remove([storagePath]);
      return new Response(
        JSON.stringify({ error: "Failed to create evidence record" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log audit
    await supabaseAdmin.from("audit_logs").insert({
      actor_user_id: profile.id,
      action: "evidence_uploaded",
      entity_type: "report_evidence",
      entity_id: evidence.id,
      metadata: {
        report_id: reportId,
        file_type: fileType,
        file_size: file.size,
        original_filename: sanitizedName,
      },
    });

    console.log(`Evidence uploaded: ${evidence.id} for report ${reportId} by user ${profile.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        evidence: {
          id: evidence.id,
          file_type: fileType,
          original_filename: sanitizedName,
        },
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Upload evidence error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
