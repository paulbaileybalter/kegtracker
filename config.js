/**
 * BALTER BREWING — KEG TRACKER
 * Site configuration.
 *
 * ---------------------------------------------------------------
 * MULTI-DEVICE SYNC (Cloudflare KV — no keys to manage)
 * ---------------------------------------------------------------
 * Multi-device sync is handled by this Worker's own fetch handler
 * (worker.js) backed by a Cloudflare KV namespace — nothing to configure
 * here. The app calls that same-origin endpoint automatically on every
 * load and save; if it isn't reachable (e.g. the KV binding hasn't been
 * set up yet) it quietly falls back to saving on this device only —
 * nothing breaks either way.
 *
 * One-time setup to turn sync on, see README.md "Multi-device sync" for
 * the full walk-through:
 *   1. Cloudflare dashboard → Workers & Pages → KV → Create a namespace.
 *   2. Put that namespace's id into wrangler.toml under kv_namespaces
 *      (binding = "KEG_KV"), or add the binding from this Worker's
 *      Settings → Bindings → Add → KV namespace instead.
 *   3. Redeploy.
 *
 * The two options below are optional escape hatches — leave them alone
 * unless you have a specific reason to change them (e.g. you renamed the
 * function's route, or want devices to check in more/less often).
 */
window.KEG_CONFIG = {
  cloudSync: {
    endpoint: "/api/keg-state", // path to the Cloudflare Pages Function above
    pollSeconds: 15             // how often other devices are checked for updates
  }
};
