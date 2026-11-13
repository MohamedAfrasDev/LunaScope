// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/v1/[...slug]/route";

const RUN = "b".repeat(64);
type Ctx = Parameters<typeof GET>[1];
const ctx = (...slug: string[]) => ({ params: Promise.resolve({ slug }) }) as unknown as Ctx;
const req = (path: string, init?: ConstructorParameters<typeof NextRequest>[1]) =>
  new NextRequest(`http://web.test/api/v1/${path}`, init);

let calls: { url: string; init: RequestInit }[] = [];
beforeEach(() => {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ ok: true }), {
        status: 202,
        headers: {
          "content-type": "application/json",
          "x-correlation-id": "up",
          "set-cookie": "leak=1",
          server: "uvicorn",
        },
      });
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("BFF route handler", () => {
  it("forwards an allow-listed POST with only the headers the service needs", async () => {
    const res = await POST(
      req("analyses", {
        method: "POST",
        body: '{"a":1}',
        headers: { cookie: "session=secret", authorization: "Bearer browser", "x-forwarded-host": "evil" },
      }),
      ctx("analyses"),
    );
    expect(res.status).toBe(202);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("http://127.0.0.1:8000/api/v1/analyses");
    const h = calls[0].init.headers as Record<string, string>;
    expect(Object.keys(h).sort()).toEqual(["accept", "content-type", "x-correlation-id"]);
    expect(calls[0].init.redirect).toBe("error");
    expect(calls[0].init.body).toBe('{"a":1}');
  });

  it("attaches the server-side service token and never one from the browser", async () => {
    vi.stubEnv("SCIENCE_API_TOKEN", "svc-token");
    await GET(req(`analyses/${RUN}`, { headers: { authorization: "Bearer browser" } }), ctx("analyses", RUN));
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe("Bearer svc-token");
  });

  it("returns only allow-listed response headers, and keeps the upstream status and body", async () => {
    const res = await GET(req(`analyses/${RUN}`), ctx("analyses", RUN));
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(res.headers.get("server")).toBeNull();
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-correlation-id")).toBeTruthy();
  });

  it("never calls the service for routes that are not allow-listed", async () => {
    const cases = [
      [["admin"], "GET"],
      [["analyses", "..", "x"], "GET"],
      [["health"], "POST"],
    ] as const;
    for (const [slug, method] of cases) {
      const res = await (method === "GET" ? GET : POST)(req(slug.join("/"), { method }), ctx(...slug));
      expect([404, 405]).toContain(res.status);
      expect((await res.json()).error.code).toMatch(/NOT_FOUND|METHOD_NOT_ALLOWED/);
    }
    const bad = await GET(req(`analyses/${RUN}/results?evil=1`), ctx("analyses", RUN, "results"));
    expect(bad.status).toBe(422);
    expect(calls).toHaveLength(0);
  });

  it("refuses an oversized body before forwarding it", async () => {
    const res = await POST(req("analyses", { method: "POST", body: "x".repeat(70_000) }), ctx("analyses"));
    expect(res.status).toBe(413);
    expect(calls).toHaveLength(0);
  });

  it("turns an unreachable service into a retryable 502 in the same error envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("connect ECONNREFUSED");
      }),
    );
    const res = await GET(req("health"), ctx("health"));
    const body = await res.json();
    expect(res.status).toBe(502);
    expect(body.error).toMatchObject({ code: "SERVICE_UNAVAILABLE", retryable: true });
    expect(body.error.correlation_id).toBeTruthy();
  });

  it("passes service errors through unchanged so their codes stay part of the contract", async () => {
    const env = { error: { code: "QUEUE_FULL", message: "busy", field: null, retryable: true, correlation_id: "c" } };
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify(env), {
            status: 503,
            headers: { "retry-after": "10", "content-type": "application/json" },
          }),
      ),
    );
    const res = await POST(req("analyses", { method: "POST", body: "{}" }), ctx("analyses"));
    expect(res.status).toBe(503);
    expect(res.headers.get("retry-after")).toBe("10");
    expect(await res.json()).toEqual(env);
  });
});
