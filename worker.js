/**
 * BALTER BREWING — KEG TRACKER
 * Cloudflare Worker entry point.
 *
 * This Worker serves the static site (via the [assets] binding configured
 * in wrangler.toml) and handles the one API route the app needs for
 * multi-device sync: GET/PUT /api/keg-state, backed by a KV namespace.
 *
 * Any request that doesn't match /api/keg-state falls straight through to
 * the static asset handler, so this file never needs to know about the
 * rest of the site.
 */

const KEY = "keg-ordering-state";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/keg-state") {
      if (request.method === "GET") return handleGet(env);
      if (request.method === "PUT" || request.method === "POST") return handlePut(request, env);
      return json({ error: "Method not allowed" }, 405);
    }

    // Everything else: serve the static site.
    return env.ASSETS.fetch(request);
  }
};

async function handleGet(env) {
  if (!env.KEG_KV) return json({ error: "KEG_KV binding not configured" }, 503);
  const raw = await env.KEG_KV.get(KEY);
  return json(raw ? JSON.parse(raw) : null);
}

async function handlePut(request, env) {
  if (!env.KEG_KV) return json({ error: "KEG_KV binding not configured" }, 503);
  let body;
  try {
    body = await request.text();
    JSON.parse(body); // validate
  } catch (e) {
    return json({ error: "Invalid JSON body" }, 400);
  }
  await env.KEG_KV.put(KEY, body);
  return json({ ok: true });
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "Content-Type": "application/json" }
  });
}
