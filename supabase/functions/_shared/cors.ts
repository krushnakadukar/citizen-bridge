/**
 * Shared CORS configuration for edge functions
 * 
 * Supports environment-based configuration for production security.
 * Set ALLOWED_ORIGINS environment variable to a comma-separated list
 * of allowed origins for production (e.g., "https://myapp.com,https://www.myapp.com")
 * 
 * If ALLOWED_ORIGINS is not set, defaults to "*" for development.
 */

// Get allowed origins from environment, fallback to "*" for development
const ALLOWED_ORIGINS_ENV = Deno.env.get("ALLOWED_ORIGINS");

// Parse allowed origins from comma-separated string
const allowedOrigins: string[] = ALLOWED_ORIGINS_ENV 
  ? ALLOWED_ORIGINS_ENV.split(",").map(origin => origin.trim()).filter(Boolean)
  : [];

/**
 * Check if an origin is allowed
 */
function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return true; // No origin header (same-origin or non-browser request)
  if (allowedOrigins.length === 0) return true; // No restrictions in dev mode
  return allowedOrigins.includes(origin);
}

/**
 * Get the appropriate Access-Control-Allow-Origin value
 */
function getAllowOrigin(requestOrigin: string | null): string {
  // If no allowed origins configured (dev mode), use wildcard
  if (allowedOrigins.length === 0) {
    return "*";
  }
  
  // If the request origin is in our allowed list, reflect it back
  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }
  
  // If origin is not allowed, return the first allowed origin (will fail CORS check)
  return allowedOrigins[0] || "*";
}

/**
 * Get CORS headers for a request
 * @param req - The incoming request (optional, for dynamic origin checking)
 * @returns CORS headers object
 */
export function getCorsHeaders(req?: Request): Record<string, string> {
  const requestOrigin = req?.headers.get("origin") || null;
  
  return {
    "Access-Control-Allow-Origin": getAllowOrigin(requestOrigin),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Max-Age": "86400", // Cache preflight for 24 hours
  };
}

/**
 * Handle CORS preflight OPTIONS request
 * @param req - The incoming request
 * @returns Response with CORS headers
 */
export function handleCorsPreFlight(req: Request): Response {
  return new Response(null, { 
    status: 204,
    headers: getCorsHeaders(req) 
  });
}

/**
 * Check if the request origin is allowed (for additional validation)
 * @param req - The incoming request
 * @returns boolean indicating if origin is allowed
 */
export function checkCorsOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  return isOriginAllowed(origin);
}

// Legacy export for backward compatibility
// Legacy export for backward compatibility - static headers for simple usage
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};
