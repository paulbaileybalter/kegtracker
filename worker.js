/**
 * BALTER BREWING — KEG TRACKER
 * Cloudflare Worker entry point.
 *
 * - Password-protects the whole site (single shared password, stored as the
 *   Worker secret SITE_PASSWORD — never in the repo).
 * - Serves the static site via the [assets] binding.
 * - Handles GET/PUT /api/keg-state (multi-device sync) backed by KV.
 *
 * Fails closed: if SITE_PASSWORD hasn't been set, nobody gets in.
 */

const KEY = "keg-ordering-state";
const COOKIE = "keg_session";
const SESSION_DAYS = 30;
const MAX_FAILS = 10;          // failed logins allowed per IP...
const FAIL_WINDOW_SECS = 900;  // ...per 15 minutes

// Reachable without logging in (login page branding + PWA metadata only).
function isPublicPath(p) {
  return p === "/manifest.json" || p.startsWith("/assets/") || p.startsWith("/fonts/");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (!env.SITE_PASSWORD) {
      return page(setupNeededHtml(), 503);
    }

    if (isPublicPath(path)) return env.ASSETS.fetch(request);

    if (path === "/login") {
      if (request.method === "POST") return handleLogin(request, env);
      return page(loginHtml(""));
    }
    if (path === "/logout") {
      return new Response(null, {
        status: 302,
        headers: { Location: "/login", "Set-Cookie": cookie("", 0) }
      });
    }

    const authed = await hasValidSession(request, env);
    if (!authed) {
      if (path.startsWith("/api/")) return json({ error: "Unauthorized" }, 401);
      return new Response(null, { status: 302, headers: { Location: "/login" } });
    }

    if (path === "/api/keg-state") {
      if (request.method === "GET") return handleGet(env);
      if (request.method === "PUT" || request.method === "POST") return handlePut(request, env);
      return json({ error: "Method not allowed" }, 405);
    }

    return env.ASSETS.fetch(request);
  }
};

/* ---------------- auth ---------------- */

async function handleLogin(request, env) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const failKey = "loginfail:" + ip;

  if (env.KEG_KV) {
    const fails = parseInt((await env.KEG_KV.get(failKey)) || "0", 10);
    if (fails >= MAX_FAILS) {
      return page(loginHtml("Too many attempts. Try again in a few minutes."), 429);
    }
  }

  let supplied = "";
  try { supplied = String((await request.formData()).get("password") || ""); } catch (e) {}

  if (await safeEqual(supplied, env.SITE_PASSWORD)) {
    if (env.KEG_KV) await env.KEG_KV.delete(failKey);
    const expires = Date.now() + SESSION_DAYS * 86400000;
    const token = expires + "." + (await sign(String(expires), env.SITE_PASSWORD));
    return new Response(null, {
      status: 302,
      headers: { Location: "/", "Set-Cookie": cookie(token, SESSION_DAYS * 86400) }
    });
  }

  if (env.KEG_KV) {
    const fails = parseInt((await env.KEG_KV.get(failKey)) || "0", 10) + 1;
    await env.KEG_KV.put(failKey, String(fails), { expirationTtl: FAIL_WINDOW_SECS });
  }
  await new Promise(function (r) { setTimeout(r, 800); });
  return page(loginHtml("Incorrect password."), 401);
}

async function hasValidSession(request, env) {
  const m = (request.headers.get("Cookie") || "").match(new RegExp("(?:^|;\\s*)" + COOKIE + "=([^;]+)"));
  if (!m) return false;
  const parts = m[1].split(".");
  if (parts.length !== 2) return false;
  const expires = parseInt(parts[0], 10);
  if (!isFinite(expires) || expires < Date.now()) return false;
  return safeEqual(parts[1], await sign(String(expires), env.SITE_PASSWORD));
}

function cookie(value, maxAge) {
  return COOKIE + "=" + value + "; Path=/; Max-Age=" + maxAge + "; HttpOnly; Secure; SameSite=Strict";
}

async function sign(message, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
  return Array.from(sig).map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");
}

// Constant-time comparison (hashes both sides first so lengths never leak).
async function safeEqual(a, b) {
  const x = await sign(a, "cmp"), y = await sign(b, "cmp");
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

/* ---------------- KV sync ---------------- */

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
    JSON.parse(body);
  } catch (e) {
    return json({ error: "Invalid JSON body" }, 400);
  }
  await env.KEG_KV.put(KEY, body);
  return json({ ok: true });
}

/* ---------------- responses ---------------- */

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "Content-Type": "application/json" }
  });
}

function page(html, status) {
  return new Response(html, {
    status: status || 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }
  });
}

function shell(title, inner) {
  return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>' + title + '</title><link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">' +
    '<style>' +
    '@font-face{font-family:"Lexend";src:url("/fonts/lexend-latin-wght-normal.woff2") format("woff2");font-weight:100 900;font-display:swap}' +
    '*{box-sizing:border-box}body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;' +
    'font-family:"Lexend",system-ui,sans-serif;background:#f7f6f1;color:#000;padding:16px}' +
    '.box{background:#fff;border-radius:14px;box-shadow:0 2px 14px rgba(0,0,0,.08);width:100%;max-width:360px;padding:28px 24px;' +
    'border-top:4px solid #47D7AC;text-align:center}' +
    '.box img{width:56px;height:56px;border-radius:12px}h1{font-size:20px;margin:12px 0 4px}' +
    'p{font-size:13px;color:#555;margin:0 0 18px}input{width:100%;padding:11px 12px;border:1.5px solid #cfccbf;border-radius:10px;font:inherit;margin-bottom:12px}' +
    'input:focus{outline:none;border-color:#7566A0}button{width:100%;padding:11px;border:0;border-radius:10px;background:#47D7AC;color:#000;' +
    'font:inherit;font-weight:700;cursor:pointer}button:hover{background:#000;color:#fff}' +
    '.err{color:#a8362a;font-size:13px;font-weight:600;margin-bottom:12px}code{background:#f0efe8;padding:1px 5px;border-radius:4px}' +
    '</style></head><body><div class="box"><img src="/assets/icon-192.png" alt="">' + inner + '</div></body></html>';
}

function loginHtml(error) {
  return shell("Keg Tracker — Sign in",
    '<h1>Keg Tracker</h1><p>Balter Brewing</p>' +
    (error ? '<div class="err">' + error + '</div>' : '') +
    '<form method="POST" action="/login"><input type="password" name="password" placeholder="Password" autocomplete="current-password" autofocus required>' +
    '<button type="submit">Sign in</button></form>');
}

function setupNeededHtml() {
  return shell("Keg Tracker — Setup needed",
    '<h1>Almost there</h1><p>This site is locked until a password is set. In the Cloudflare dashboard open this Worker → ' +
    'Settings → Variables and Secrets → add a <b>Secret</b> named <code>SITE_PASSWORD</code>, then deploy.</p>');
}
