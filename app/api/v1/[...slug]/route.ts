import type { NextRequest } from "next/server";
import { PASS_HEADERS, matchRoute } from "@/lib/bff";

/**
 * BFF proxy to the Python science service.
 *
 * - The upstream URL and token come from server-side environment variables only.
 * - Only allow-listed routes are forwarded; the upstream path is rebuilt, never copied.
 * - Cookies and other browser headers are not forwarded, except If-None-Match for a cache revalidation.
 * - Cache headers come only from the service (immutable finished results, revalidated validation
 *   cards); anything the service does not mark stays no-store.
 * - Upstream errors pass through unchanged (their codes are part of the contract); a failure to
 *   reach the service becomes a 502 in the same envelope.
 */

const UPSTREAM = (process.env.SCIENCE_API_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, "");

function envelope(status: number, code: string, message: string, cid: string, retryable = false) {
  return Response.json(
    { error: { code, message, field: null, retryable, correlation_id: cid } },
    { status, headers: { "x-correlation-id": cid, "cache-control": "no-store" } },
  );
}

async function forward(request: NextRequest, ctx: RouteContext<"/api/v1/[...slug]">) {
  const cid = request.headers.get("x-correlation-id") ?? crypto.randomUUID().replaceAll("-", "");
  const { slug } = await ctx.params;
  const found = matchRoute(request.method, slug, request.nextUrl.searchParams);

  if (!found.ok) {
    if (found.reason === "method_not_allowed")
      return envelope(405, "METHOD_NOT_ALLOWED", "This route does not accept that method.", cid);
    if (found.reason === "invalid_query")
      return envelope(422, "INVALID_INPUT", "Unsupported or invalid query parameter.", cid);
    return envelope(404, "NOT_FOUND", "No such route.", cid);
  }
  const { match } = found;

  let body: string | undefined;
  if (match.method === "POST") {
    body = await request.text();
    if (new TextEncoder().encode(body).length > match.maxBodyBytes)
      return envelope(413, "INVALID_INPUT", "Request body is too large.", cid);
  }

  const headers: Record<string, string> = { accept: "application/json", "x-correlation-id": cid };
  if (body !== undefined) headers["content-type"] = "application/json";
  const inm = request.headers.get("if-none-match");
  if (match.method === "GET" && inm && /^"[0-9a-zA-Z-]{1,80}"$/.test(inm)) headers["if-none-match"] = inm;
  if (process.env.SCIENCE_API_TOKEN) headers.authorization = `Bearer ${process.env.SCIENCE_API_TOKEN}`;

  try {
    const upstream = await fetch(`${UPSTREAM}${match.upstreamPath}${match.query}`, {
      method: match.method,
      headers,
      body,
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(match.timeoutMs),
    });
    const out = new Headers({ "cache-control": "no-store" });
    for (const name of PASS_HEADERS) {
      const v = upstream.headers.get(name);
      if (v) out.set(name, v);
    }
    out.set("x-correlation-id", cid);
    // 304 carries no body; a Response with a null-body status must not be given one.
    const payload = upstream.status === 304 ? null : await upstream.arrayBuffer();
    return new Response(payload, { status: upstream.status, headers: out });
  } catch {
    return envelope(502, "SERVICE_UNAVAILABLE", "The science service could not be reached.", cid, true);
  }
}

export const GET = forward;
export const POST = forward;
