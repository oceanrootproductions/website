// Read-only file server for the website's big demo files, streamed straight out of the R2 bucket.
// GET and HEAD only, with byte ranges and conditional requests handled by R2 itself.

interface Env {
  BUCKET: R2Bucket;
  LIMITER: { limit(options: { key: string }): Promise<{ success: boolean }> };
  ALLOWED_ORIGINS: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin");
    const allowed = env.ALLOWED_ORIGINS.split(",").map((o) => o.trim());
    const cors: Record<string, string> =
      origin && allowed.includes(origin)
        ? {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Expose-Headers": "Content-Length, Content-Range, ETag",
            Vary: "Origin",
          }
        : { Vary: "Origin" };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          ...cors,
          "Access-Control-Allow-Methods": "GET, HEAD",
          "Access-Control-Allow-Headers": "Range",
          "Access-Control-Max-Age": "86400",
        },
      });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405, headers: { ...cors, Allow: "GET, HEAD, OPTIONS" } });
    }

    const { success } = await env.LIMITER.limit({ key: request.headers.get("CF-Connecting-IP") ?? "unknown" });
    if (!success) {
      return new Response("Too many requests", { status: 429, headers: { ...cors, "Retry-After": "60" } });
    }

    const key = decodeURIComponent(new URL(request.url).pathname.slice(1));
    if (!key || key.endsWith("/") || key.split("/").includes("..")) {
      return new Response("Not found", { status: 404, headers: cors });
    }

    const object = await env.BUCKET.get(key, { range: request.headers, onlyIf: request.headers });
    if (object === null) return new Response("Not found", { status: 404, headers: cors });

    const headers = new Headers(cors);
    object.writeHttpMetadata(headers);
    headers.set("ETag", object.httpEtag);
    headers.set("Accept-Ranges", "bytes");
    headers.set("Cache-Control", "public, max-age=300");

    // A conditional request whose condition failed comes back without a body.
    if (!("body" in object)) {
      return new Response(null, { status: request.headers.has("If-None-Match") ? 304 : 412, headers });
    }

    const bytes = request.headers.has("Range") ? byteRange(object.range, object.size) : null;
    if (bytes) headers.set("Content-Range", `bytes ${bytes[0]}-${bytes[1]}/${object.size}`);
    if (request.method === "HEAD") headers.set("Content-Length", String(object.size));

    return new Response(request.method === "HEAD" ? null : object.body, { status: bytes ? 206 : 200, headers });
  },
};

/** The [first, last] byte R2 actually returned for a ranged read. */
function byteRange(range: R2Range | undefined, size: number): [number, number] | null {
  if (!range) return null;
  if ("suffix" in range && range.suffix !== undefined) return [size - range.suffix, size - 1];
  const start = "offset" in range && range.offset !== undefined ? range.offset : 0;
  const length = "length" in range && range.length !== undefined ? range.length : size - start;
  return [start, start + length - 1];
}
