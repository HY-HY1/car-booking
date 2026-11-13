import { keyFromAuthHeader } from "@leadgen/core/api/key-format";
import { holderOfApiKey, type KeyHolder } from "@leadgen/core/api/keys";
import type { Parsed } from "@leadgen/core/api/query";
import { hitRateLimit } from "@leadgen/core/api/rate-limit";
import { API_SCOPES } from "@leadgen/core/api/scopes";
import type { ApiError, ErrorCode, Scope } from "@leadgen/core/api/types";

// The public API's plumbing (app/api/v1/*). Every endpoint goes through
// apiRoute: it reads the key, counts the request against the key's limit,
// checks the key has the endpoint's scope, and turns anything unexpected into
// a 500 with the usual error body. The key alone decides the business.
//
// Meant for servers, never browsers: no CORS headers, so a browser can't
// call it from another site and show the key to visitors.

export function apiError(status: number, code: ErrorCode, message: string, param?: string, headers?: HeadersInit) {
  const body: ApiError = { error: { code, message, ...(param && { param }) } };
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...(status === 401 && { "WWW-Authenticate": 'Bearer realm="api"' }),
      ...headers,
    },
  });
}

export function json(body: unknown, init?: { status?: number; headers?: HeadersInit }) {
  return Response.json(body, { status: init?.status ?? 200, headers: { "Cache-Control": "no-store", ...init?.headers } });
}

export const notSetUp = () =>
  apiError(409, "not_set_up", "This business hasn't finished setting up its booking page, so it can't be quoted or booked yet.");

export const notFound = (what: string) => apiError(404, "not_found", `No ${what} with that id.`);

export const badParam = (problem: Extract<Parsed<unknown>, { ok: false }>) =>
  apiError(400, "invalid_request", problem.message, problem.param);

// Errors from the booking engine (quotes and availability).
const ENGINE_CODES = new Set<ErrorCode>([
  "unknown_service",
  "unknown_add_on",
  "add_on_not_for_service",
  "location_not_offered",
  "postcode_required",
  "unknown_postcode",
  "outside_area",
]);

export function engineError(result: { code: string; message: string }) {
  if (ENGINE_CODES.has(result.code as ErrorCode)) {
    const param = result.code.startsWith("postcode") || result.code === "unknown_postcode" ? "postcode" : undefined;
    return apiError(422, result.code as ErrorCode, result.message, param);
  }
  return apiError(400, "invalid_request", result.message);
}

// Reads a JSON body. Null means it wasn't JSON (or wasn't an object).
export async function jsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}

export type ApiContext<Params> = { request: Request; url: URL; key: KeyHolder; params: Params };

export function apiRoute<Params = Record<string, never>>(
  scope: Scope,
  handler: (ctx: ApiContext<Params>) => Promise<Response>,
) {
  return async (request: Request, context: { params: Promise<Params> }) => {
    const raw = keyFromAuthHeader(request.headers.get("authorization"));
    if (!raw) return apiError(401, "missing_key", "Send your API key as: Authorization: Bearer <key>.");

    try {
      const key = await holderOfApiKey(raw);
      if (!key) return apiError(401, "invalid_key", "That API key isn't valid, or has been revoked.");

      const limit = await hitRateLimit(`key:${key.keyId}`);
      const limitHeaders = {
        "RateLimit-Limit": String(limit.limit),
        "RateLimit-Remaining": String(limit.remaining),
        "RateLimit-Reset": String(limit.resetSeconds),
      };
      if (!limit.allowed) {
        return apiError(
          429,
          "rate_limited",
          `Too many requests: each key can make ${limit.limit} a minute. Try again in ${limit.resetSeconds} seconds.`,
          undefined,
          { ...limitHeaders, "Retry-After": String(Math.max(1, limit.resetSeconds)) },
        );
      }

      if (!key.scopes.includes(scope)) {
        return apiError(
          403,
          "insufficient_scope",
          `This key can't do that. It needs the "${scope}" scope (${API_SCOPES[scope].label}): the business owner can make a key with it under Settings → Integrations.`,
          undefined,
          limitHeaders,
        );
      }

      const response = await handler({ request, url: new URL(request.url), key, params: await context.params });
      for (const [name, value] of Object.entries(limitHeaders)) response.headers.set(name, value);
      return response;
    } catch (error) {
      console.error(`[api] ${request.method} ${new URL(request.url).pathname} failed`, error);
      return apiError(500, "server_error", "Something went wrong. Try again shortly.");
    }
  };
}
