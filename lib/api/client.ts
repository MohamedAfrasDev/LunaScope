import type { ApiErrorBody } from "./types";

/** Error with the service's stable code, field path and retry hint. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public field: string | null = null,
    public retryable = false,
    public correlationId: string | null = null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const BASE = "/api/v1";

function isEnvelope(x: unknown): x is ApiErrorBody {
  return typeof x === "object" && x !== null && "error" in x;
}

/** Fetch through the BFF. Every failure becomes an ApiError; nothing is silently defaulted. */
export async function api<T>(path: string, init?: RequestInit & { signal?: AbortSignal }): Promise<T> {
  let res: Response;
  try {
    // Default HTTP caching: only finished, immutable results carry cache headers (set by the
    // service); everything else, including run status, is no-store at the BFF.
    res = await fetch(`${BASE}/${path}`, init);
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError(0, "NETWORK_ERROR", "Could not reach the web server.", null, true);
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) {
    if (isEnvelope(body)) {
      const e = body.error;
      throw new ApiError(res.status, e.code, e.message, e.field, e.retryable, e.correlation_id);
    }
    throw new ApiError(res.status, "HTTP_ERROR", `Unexpected response (${res.status}).`, null, res.status >= 500);
  }
  return body as T;
}

export const getJson = <T>(path: string, signal?: AbortSignal) => api<T>(path, { signal });
export const postJson = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

/** Friendly text for the codes a user can actually hit. */
export function describeError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === "QUEUE_FULL") return "The service is busy. Try again in a few seconds.";
    if (e.code === "REPLAY_ONLY")
      return "This is an offline copy that only holds saved runs, so this request cannot be computed. Open the saved reference run instead.";
    if (e.code === "SERVICE_UNAVAILABLE" || e.code === "NETWORK_ERROR")
      return "The science service is not reachable. Nothing was started.";
    return e.message;
  }
  return e instanceof Error ? e.message : "Something went wrong.";
}
