import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";

// Server-side rate limiting configuration
interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
}

interface RateLimitEntry {
  attempts: number;
  windowStart: number;
  blockedUntil?: number;
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  login: { maxAttempts: 5, windowMs: 15 * 60 * 1000 }, // 5 attempts per 15 min
  register: { maxAttempts: 3, windowMs: 60 * 60 * 1000 }, // 3 attempts per hour
  password_reset: { maxAttempts: 3, windowMs: 60 * 60 * 1000 }, // 3 per hour
};

// In-memory rate limit store (persists for edge function lifetime)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up old entries periodically
function cleanupRateLimitStore() {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    const config = RATE_LIMITS[key.split(":")[0]];
    if (config && now - entry.windowStart >= config.windowMs) {
      rateLimitStore.delete(key);
    }
  }
}

function checkRateLimit(action: string, identifier: string): { 
  allowed: boolean; 
  remainingAttempts: number; 
  retryAfterMs?: number;
} {
  const config = RATE_LIMITS[action];
  if (!config) {
    return { allowed: true, remainingAttempts: Infinity };
  }

  const key = `${action}:${identifier}`;
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  // Clean up old entries periodically
  if (Math.random() < 0.1) cleanupRateLimitStore();

  // No previous attempts or window expired
  if (!entry || now - entry.windowStart >= config.windowMs) {
    rateLimitStore.set(key, { attempts: 1, windowStart: now });
    return { allowed: true, remainingAttempts: config.maxAttempts - 1 };
  }

  // Check if currently blocked
  if (entry.blockedUntil && now < entry.blockedUntil) {
    return { 
      allowed: false, 
      remainingAttempts: 0, 
      retryAfterMs: entry.blockedUntil - now 
    };
  }

  // Within window, check attempts
  if (entry.attempts >= config.maxAttempts) {
    // Block for the remainder of the window
    entry.blockedUntil = entry.windowStart + config.windowMs;
    rateLimitStore.set(key, entry);
    return { 
      allowed: false, 
      remainingAttempts: 0, 
      retryAfterMs: entry.blockedUntil - now 
    };
  }

  // Increment attempts
  entry.attempts += 1;
  rateLimitStore.set(key, entry);
  
  return { 
    allowed: true, 
    remainingAttempts: config.maxAttempts - entry.attempts 
  };
}

function resetRateLimit(action: string, identifier: string): void {
  const key = `${action}:${identifier}`;
  rateLimitStore.delete(key);
}

function getClientIdentifier(req: Request): string {
  // Use multiple headers to get client IP
  const forwardedFor = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const cfConnectingIp = req.headers.get("cf-connecting-ip");
  
  // Return first available IP or fallback to a hash of user-agent
  const ip = cfConnectingIp || realIp || (forwardedFor?.split(",")[0]?.trim()) || "unknown";
  return ip;
}

function formatRetryTime(ms: number): string {
  const minutes = Math.ceil(ms / 60000);
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    return `${hours} hour${hours > 1 ? "s" : ""}`;
  }
  return `${minutes} minute${minutes > 1 ? "s" : ""}`;
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
  const path = url.pathname.replace("/api-auth", "");
  const clientIp = getClientIdentifier(req);

  try {
    // POST /register
    if (req.method === "POST" && path === "/register") {
      const body = await req.json();
      const { email, password, full_name, phone } = body;

      if (!email || !password) {
        return new Response(
          JSON.stringify({ error: "Email and password are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Server-side rate limiting check (use email + IP for identifier)
      const rateLimitId = `${email.toLowerCase()}:${clientIp}`;
      const rateLimitCheck = checkRateLimit("register", rateLimitId);
      
      if (!rateLimitCheck.allowed) {
        console.log(`Rate limit exceeded for registration: ${rateLimitId}`);
        return new Response(
          JSON.stringify({ 
            error: `Too many registration attempts. Please try again in ${formatRetryTime(rateLimitCheck.retryAfterMs || 0)}.`,
            retry_after_ms: rateLimitCheck.retryAfterMs,
          }),
          { 
            status: 429, 
            headers: { 
              ...corsHeaders, 
              "Content-Type": "application/json",
              "Retry-After": String(Math.ceil((rateLimitCheck.retryAfterMs || 0) / 1000)),
            } 
          }
        );
      }

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name, phone },
      });

      if (authError) {
        console.error("Auth registration error:", authError);
        return new Response(
          JSON.stringify({ error: authError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Reset rate limit on successful registration
      resetRateLimit("register", rateLimitId);

      // Update profile with phone if provided
      if (phone && authData.user) {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("auth_user_id", authData.user.id)
          .single();

        if (profile) {
          await supabaseAdmin
            .from("profiles")
            .update({ phone, full_name })
            .eq("id", profile.id);
        }
      }

      // Log audit
      await supabaseAdmin.from("audit_logs").insert({
        action: "user_registered",
        entity_type: "user",
        entity_id: authData.user?.id,
        metadata: { email },
      });

      console.log("User registered successfully:", email);

      return new Response(
        JSON.stringify({ 
          message: "User registered successfully",
          user: { id: authData.user?.id, email: authData.user?.email }
        }),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /login
    if (req.method === "POST" && path === "/login") {
      const body = await req.json();
      const { email, password } = body;

      if (!email || !password) {
        return new Response(
          JSON.stringify({ error: "Email and password are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Server-side rate limiting check (use email + IP for identifier)
      const rateLimitId = `${email.toLowerCase()}:${clientIp}`;
      const rateLimitCheck = checkRateLimit("login", rateLimitId);
      
      if (!rateLimitCheck.allowed) {
        console.log(`Rate limit exceeded for login: ${rateLimitId}`);
        
        // Log failed login attempt
        await supabaseAdmin.from("audit_logs").insert({
          action: "login_rate_limited",
          entity_type: "auth",
          metadata: { email, ip: clientIp },
        });

        return new Response(
          JSON.stringify({ 
            error: `Too many login attempts. Please try again in ${formatRetryTime(rateLimitCheck.retryAfterMs || 0)}.`,
            retry_after_ms: rateLimitCheck.retryAfterMs,
          }),
          { 
            status: 429, 
            headers: { 
              ...corsHeaders, 
              "Content-Type": "application/json",
              "Retry-After": String(Math.ceil((rateLimitCheck.retryAfterMs || 0) / 1000)),
            } 
          }
        );
      }

      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("Login error:", error);
        
        // Log failed login attempt
        await supabaseAdmin.from("audit_logs").insert({
          action: "login_failed",
          entity_type: "auth",
          metadata: { email, error: error.message, remaining_attempts: rateLimitCheck.remainingAttempts },
        });

        return new Response(
          JSON.stringify({ 
            error: error.message,
            remaining_attempts: rateLimitCheck.remainingAttempts,
          }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Reset rate limit on successful login
      resetRateLimit("login", rateLimitId);

      // Log successful login
      await supabaseAdmin.from("audit_logs").insert({
        action: "login_success",
        entity_type: "auth",
        entity_id: data.user?.id,
        metadata: { email },
      });

      console.log("User logged in:", email);

      return new Response(
        JSON.stringify({
          access_token: data.session?.access_token,
          refresh_token: data.session?.refresh_token,
          expires_in: data.session?.expires_in,
          user: {
            id: data.user?.id,
            email: data.user?.email,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /password-reset
    if (req.method === "POST" && path === "/password-reset") {
      const body = await req.json();
      const { email } = body;

      if (!email) {
        return new Response(
          JSON.stringify({ error: "Email is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Server-side rate limiting check
      const rateLimitId = `${email.toLowerCase()}:${clientIp}`;
      const rateLimitCheck = checkRateLimit("password_reset", rateLimitId);
      
      if (!rateLimitCheck.allowed) {
        console.log(`Rate limit exceeded for password reset: ${rateLimitId}`);
        return new Response(
          JSON.stringify({ 
            error: `Too many password reset attempts. Please try again in ${formatRetryTime(rateLimitCheck.retryAfterMs || 0)}.`,
            retry_after_ms: rateLimitCheck.retryAfterMs,
          }),
          { 
            status: 429, 
            headers: { 
              ...corsHeaders, 
              "Content-Type": "application/json",
              "Retry-After": String(Math.ceil((rateLimitCheck.retryAfterMs || 0) / 1000)),
            } 
          }
        );
      }

      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: `${req.headers.get("origin") || supabaseUrl}/reset-password`,
      });

      if (error) {
        console.error("Password reset error:", error);
        // Don't reveal if email exists or not
      }

      // Log password reset request
      await supabaseAdmin.from("audit_logs").insert({
        action: "password_reset_requested",
        entity_type: "auth",
        metadata: { email },
      });

      // Always return success to prevent email enumeration
      return new Response(
        JSON.stringify({ 
          message: "If an account with that email exists, a password reset link has been sent." 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET /me
    if (req.method === "GET" && path === "/me") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: "Authorization header required" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

      if (userError || !user) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get profile with role
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select(`
          id,
          full_name,
          email,
          phone,
          is_active,
          created_at,
          user_roles (role)
        `)
        .eq("auth_user_id", user.id)
        .single();

      return new Response(
        JSON.stringify({
          user: {
            id: user.id,
            email: user.email,
            profile: profile ? {
              ...profile,
              role: profile.user_roles?.[0]?.role || "citizen",
            } : null,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Auth API error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
