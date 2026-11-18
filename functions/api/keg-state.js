/**
 * Cloudflare Pages Function — backs the Keg Tracker's multi-device
 * sync with a Cloudflare KV namespace. Deployed automatically with the rest
 * of the site when you drag this folder onto Cloudflare Pages (Pages reads
 * any `functions/` folder at the project root on its own — nothing to build).
 *
 * One-time setup (see README.md "Multi-device sync" for the full walk-through):
 *   1. Cloudflare dashboard → Workers & Pages → KV → Create a namespace
 *      (any name, e.g. "keg-ordering-portal").
 *   2. Your Pages project → Settings → Functions → KV namespace bindings →
 *      Add binding → Variable name: KEG_KV → KV namespace: the one you just
 *      created.
 *   3. Redeploy (or it takes effect on the next deploy). That's it — no API
 *      keys, no third-party account. Every device that opens the site reads
 *      and writes the same KV key below, so they all stay in sync.
 *
 * If the KV binding isn't set up yet, these requests simply fail and the
 * app quietly falls back to saving locally on each device — nothing breaks.
 *
 * Everything lives under one fixed key, since this tool is meant for one
 * brewery's one shared keg-ordering sheet, not multiple tenants.
 */

const KEY = "keg-ordering-state";

export async function onRequestGet({ env }) {
  if (!env.KEG_KV) return json({ error: "KEG_KV binding not configured" }, 503);
  const raw = await env.KEG_KV.get(KEY);
  return json(raw ? JSON.parse(raw) : null);
}

export async function onRequestPut({ request, env }) {
  if (!env.KEG_KV) return json({ error: "KEG_KV binding not configured" }, 503);
  let body;
  try {
    body = await request.text();
    JSON.parse(body); // validate it's real JSON before storing
  } catch (e) {
    return json({ error: "Invalid JSON body" }, 400);
  }
  await env.KEG_KV.put(KEY, body);
  return json({ ok: true });
}

// Some environments/proxies prefer POST over PUT — accept either.
export async function onRequestPost(context) {
  return onRequestPut(context);
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "Content-Type": "application/json" }
  });
}
