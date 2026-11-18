/**
 * BALTER BREWING — KEG TRACKER
 * Application logic (no build step, no framework — plain JS)
 *
 * Data model mirrors the "2026 Keg Tracking Platform" Excel tab exactly:
 * every weekday has an Opening Inventory, Packaging, Inbounds and a
 * computed Daily Total Stock On Hand, chained Mon→Fri and week→week.
 * Opening is normally carried forward automatically but can be manually
 * overridden on any day (e.g. an actual recount differs from the
 * projection) — exactly like overwriting a formula cell in Excel.
 */
(function () {
  "use strict";

  /* ---------------------------------------------------------
     CONSTANTS
  --------------------------------------------------------- */
  var LS_PREFIX = "balterKegV2:";
  var LS_LEDGER = LS_PREFIX + "ledger";      // { "YYYY-MM-DD": { opening, packaging, inbound } }
  var LS_WEEKNOTES = LS_PREFIX + "weeknotes"; // { "YYYY-MM-DD" (Monday of week): "note text" }
  var LS_POINTER = LS_PREFIX + "pointer";     // "YYYY-MM-DD" current stocktake date
  var LS_SETTINGS = LS_PREFIX + "settings";
  var LS_HISTORY = LS_PREFIX + "history";

  var WINDOW_WEEKS = 4; // this week (remaining) + next 3 full weeks

  var DEFAULT_SETTINGS = {
    loadSize: 560,
    targetStock: 1000,
    minStock: 900,
    maxStock: 1500,
    hardMaxStock: 2000,
    backloadEvery: 3,
    deliveryCounter: 0,
    supplierName: "",
    supplierCarrier: "",
    senderName: "",
    senderRole: ""
  };

  var LOGO_DATA_URI = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAYAAACtWK6eAAAWfmNhQlgAABZ+anVtYgAAAB5qdW1kYzJwYQARABCAAACqADibcQNjMnBhAAAAFlhqdW1iAAAAR2p1bWRjMm1hABEAEIAAAKoAOJtxA3VybjpjMnBhOmQ5NTM3ZDU2LWIxMTItNDA3NC04YTlkLTM2ZWQ4ODRiOGQzMQAAAAOTanVtYgAAAClqdW1kYzJhcwARABCAAACqADibcQNjMnBhLmFzc2VydGlvbnMAAAAAuGp1bWIAAABEanVtZGNib3IAEQAQgAAAqgA4m3ETYzJwYS5pbmdyZWRpZW50LnYzAAAAABhjMnNoc8rzO7mUk6yGejTGcJyengAAAGxjYm9yo2lkYzpmb3JtYXRpaW1hZ2UvcG5namluc3RhbmNlSUR4LHhtcDppaWQ6YTMzMTk5MzktMzRmOS00MmQ3LWI2YzYtZDg2NTQ4YjU2ODk3bHJlbGF0aW9uc2hpcGhwYXJlbnRPZgAAAeJqdW1iAAAAQWp1bWRjYm9yABEAEIAAAKoAOJtxE2MycGEuYWN0aW9ucy52MgAAAAAYYzJzaK/gQHM5b8UURvIsDZETNsAAAAGZY2JvcqJnYWN0aW9uc4KiZmFjdGlvbmtjMnBhLm9wZW5lZGpwYXJhbWV0ZXJzoWtpbmdyZWRpZW50c4GiY3VybHgtc2VsZiNqdW1iZj1jMnBhLmFzc2VydGlvbnMvYzJwYS5pbmdyZWRpZW50LnYzZGhhc2hYIIzLSBes048uiT45/LKRhDVpzWYZ2peiNYF6wk81M2oHpGZhY3Rpb254HWNvbS5hbnRocm9waWMuY2xhdWRlLnByb3ZpZGVkanBhcmFtZXRlcnOheB9jb20uYW50aHJvcGljLm9yaWdpbi1jb25maWRlbmNlZ3Vua25vd25rZGVzY3JpcHRpb254ZkNsYXVkZSBwcm92aWRlZCB0aGlzIGZpbGUgYXQgdGhlIHJlcXVlc3Qgb2YgYSB1c2VyIGFuZCBtYXkgaGF2ZSBjcmVhdGVkIG9yIG1vZGlmaWVkIHRoZSBmaWxlIGNvbnRlbnRzLm1zb2Z0d2FyZUFnZW50oWRuYW1lZkNsYXVkZXJhbGxBY3Rpb25zSW5jbHVkZWT1AAAAyGp1bWIAAABAanVtZGNib3IAEQAQgAAAqgA4m3ETYzJwYS5oYXNoLmRhdGEAAAAAGGMyc2ghkMK9lrQvIqiVLDXFjx30AAAAgGNib3KlY2FsZ2ZzaGEyNTZjcGFkTQAAAAAAAAAAAAAAAABkaGFzaFggg8AgL0FhX/eHl0EXVmvV4le0PT6AnKZL2oT/Tdp+ZF5kbmFtZW5qdW1iZiBtYW5pZmVzdGpleGNsdXNpb25zgaJlc3RhcnQYIWZsZW5ndGgZFooAAAI+anVtYgAAACdqdW1kYzJjbAARABCAAACqADibcQNjMnBhLmNsYWltLnYyAAAAAg9jYm9ypWNhbGdmc2hhMjU2aXNpZ25hdHVyZXhNc2VsZiNqdW1iZj0vYzJwYS91cm46YzJwYTpkOTUzN2Q1Ni1iMTEyLTQwNzQtOGE5ZC0zNmVkODg0YjhkMzEvYzJwYS5zaWduYXR1cmVqaW5zdGFuY2VJRHgseG1wOmlpZDpiYTZkOTc0NS03NjhjLTRhMmQtYWY1My01YmMyM2U2ZDEzYTFyY3JlYXRlZF9hc3NlcnRpb25zg6JjdXJseC1zZWxmI2p1bWJmPWMycGEuYXNzZXJ0aW9ucy9jMnBhLmluZ3JlZGllbnQudjNkaGFzaFggjMtIF6zTjy6JPjn8spGENWnNZhnal6I1gXrCTzUzageiY3VybHgqc2VsZiNqdW1iZj1jMnBhLmFzc2VydGlvbnMvYzJwYS5hY3Rpb25zLnYyZGhhc2hYICAQc+XRiy2dT+1O9FUlxMGWWoipy/wQn8dSVFQ+OgcHomN1cmx4KXNlbGYjanVtYmY9YzJwYS5hc3NlcnRpb25zL2MycGEuaGFzaC5kYXRhZGhhc2hYIPlGLV83iu9BBBx+3TrleRQpbw6OJkPTxtiprqh8V67ydGNsYWltX2dlbmVyYXRvcl9pbmZvo2RuYW1lb0FudGhyb3BpYyBGaWxlc2d2ZXJzaW9uZTEuMC4wa3NwZWNWZXJzaW9uZTIuNC4wAAAQOGp1bWIAAAAoanVtZGMyY3MAEQAQgAAAqgA4m3EDYzJwYS5zaWduYXR1cmUAAAAQCGNib3LShFkCEqIBJhghWQIKMIICBjCCAY2gAwIBAgIUQOWgCu7COdC+uIP6BkIFPWdVEwAwCgYIKoZIzj0EAwMwSTEXMBUGA1UEChMOQW50aHJvcGljLCBQQkMxLjAsBgNVBAMTJUFudGhyb3BpYyBDb250ZW50IENyZWRlbnRpYWxzIFJvb3QgQ0EwHhcNMjYwODA3MTg0MzU2WhcNMjgwODA2MTk0MzU2WjBEMRcwFQYDVQQKEw5BbnRocm9waWMsIFBCQzEpMCcGA1UEAxMgQW50aHJvcGljIENsYXVkZSBDb250ZW50IFNpZ25pbmcwWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAASYegpry1AYBRTVNL1CpTlbROnY3dey+UrsF9C3phYrATN3ZHf93Mo8RQN0KOUuOn19P4oWNFWe5n2/She9N7eTo1gwVjAOBgNVHQ8BAf8EBAMCB4AwFQYDVR0lBA4wDAYKKwYBBAGD6F4CATAMBgNVHRMBAf8EAjAAMB8GA1UdIwQYMBaAFM5R4gSBTmRbI/jjxM+aPpzB11zCMAoGCCqGSM49BAMDA2cAMGQCMDFzHRSeAXrSy1WOzkbhPZ6Km2wGTmZ/2gK18k8BQGXyqz88Rdrz6CTX9flAnYNVxgIwcF9c3fVhqmJKpi+UhasNUMko69cyX6STPfta3Q8EjyzDjzoyrol46FP6VFHhvUcJoWNwYWRZDZ4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA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";
  var LOGO_SVG = '<img src="' + LOGO_DATA_URI + '" width="36" height="36" alt="Balter Brewing" style="display:block;border:0;">';

  var WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var WEEKDAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  /* ---------------------------------------------------------
     DATE HELPERS
  --------------------------------------------------------- */
  function todayISO() { return toISO(new Date()); }
  function toISO(d) {
    var y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }
  function parseISO(iso) {
    var parts = iso.split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  function addDays(iso, n) {
    var d = parseISO(iso);
    d.setDate(d.getDate() + n);
    return toISO(d);
  }
  function mondayOf(iso) {
    var d = parseISO(iso);
    var day = d.getDay(); // 0 Sun .. 6 Sat
    var diff = (day === 0 ? -6 : 1 - day);
    d.setDate(d.getDate() + diff);
    return toISO(d);
  }
  function weekdayIdx(iso) { return parseISO(iso).getDay(); }
  function isWeekday(iso) { var d = weekdayIdx(iso); return d >= 1 && d <= 5; }
  function formatPretty(iso) {
    if (!iso) return "";
    var d = parseISO(iso);
    return d.toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "numeric" });
  }
  function formatShort(iso) {
    if (!iso) return "";
    var d = parseISO(iso);
    return d.getDate() + " " + MONTH_SHORT[d.getMonth()];
  }
  function formatDots(iso) {
    if (!iso) return "";
    var d = parseISO(iso);
    var dd = String(d.getDate()).padStart(2, "0");
    var mm = String(d.getMonth() + 1).padStart(2, "0");
    var yy = String(d.getFullYear()).slice(-2);
    return dd + "." + mm + "." + yy;
  }
  function formatBanner(iso) {
    if (!iso) return "";
    var d = parseISO(iso);
    var weekday = d.toLocaleDateString("en-AU", { weekday: "long" });
    var dd = String(d.getDate()).padStart(2, "0");
    var mm = String(d.getMonth() + 1).padStart(2, "0");
    var yy = String(d.getFullYear()).slice(-2);
    return weekday + ", " + dd + "/" + mm + "/" + yy;
  }
  function weekdayShort(iso) { return WEEKDAY_SHORT[weekdayIdx(iso)]; }
  function weekdayLong(iso) { return WEEKDAY_LONG[weekdayIdx(iso)]; }

  /* ---------------------------------------------------------
     WINDOW: the list of dates currently in view (all 7 days/week)
  --------------------------------------------------------- */
  function windowStart() {
    return App.pointer;
  }
  function windowEnd() {
    return addDays(mondayOf(windowStart()), (WINDOW_WEEKS - 1) * 7 + 6); // Sunday of the last week
  }
  function windowDays() {
    var days = [];
    var d = windowStart();
    var end = windowEnd();
    while (d <= end) {
      days.push(d);
      d = addDays(d, 1);
    }
    return days;
  }
  function isWeekend(iso) { var d = weekdayIdx(iso); return d === 0 || d === 6; }
  // Deliveries normally land Monday–Thursday; Friday is a fallback used only
  // when no Mon–Thu slot is available in time. Weekends never take a delivery.
  function isPreferredDeliveryDay(iso) { var d = weekdayIdx(iso); return d >= 1 && d <= 4; }
  function isFridayDeliveryDay(iso) { return weekdayIdx(iso) === 5; }

  /* ---------------------------------------------------------
     LOCAL STORAGE
  --------------------------------------------------------- */
  function lsGet(key) {
    try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* storage full / unavailable */ }
  }

  function numOr(val, fallback) {
    var n = parseInt(val, 10);
    return isFinite(n) ? Math.max(0, n) : fallback;
  }

  function sanitizeSettings(s) {
    var out = Object.assign({}, DEFAULT_SETTINGS);
    if (!s || typeof s !== "object") return out;
    out.loadSize = Math.max(1, numOr(s.loadSize, DEFAULT_SETTINGS.loadSize));
    out.targetStock = numOr(s.targetStock, DEFAULT_SETTINGS.targetStock);
    // One-time migration: 500 was the old hard-coded floor default. Anyone
    // still sitting on exactly that value hasn't manually chosen it since —
    // the floor was raised to 900, so move them onto the new default rather
    // than silently keeping a stale number.
    var minRaw = numOr(s.minStock, DEFAULT_SETTINGS.minStock);
    out.minStock = (minRaw === 500) ? DEFAULT_SETTINGS.minStock : minRaw;
    out.maxStock = numOr(s.maxStock, DEFAULT_SETTINGS.maxStock);
    out.hardMaxStock = Math.max(out.maxStock, numOr(s.hardMaxStock, DEFAULT_SETTINGS.hardMaxStock));
    out.backloadEvery = Math.max(1, numOr(s.backloadEvery, DEFAULT_SETTINGS.backloadEvery));
    out.deliveryCounter = numOr(s.deliveryCounter, 0);
    out.supplierName = typeof s.supplierName === "string" ? s.supplierName : "";
    out.supplierCarrier = typeof s.supplierCarrier === "string" ? s.supplierCarrier : "";
    out.senderName = typeof s.senderName === "string" ? s.senderName : "";
    out.senderRole = typeof s.senderRole === "string" ? s.senderRole : "";
    return out;
  }

  /* ---------------------------------------------------------
     APP STATE
  --------------------------------------------------------- */
  var App = {
    pointer: todayISO(),
    ledger: {},      // date -> { opening, packaging, inbound }
    weekNotes: {},   // mondayDate -> note string
    settings: null,
    history: [],
    saveTimer: null,
    pollTimer: null,
    dirty: false
  };

  function dayEntry(dateISO) {
    return App.ledger[dateISO] || { opening: "", packaging: "", inbound: "" };
  }
  function setDayField(dateISO, field, value) {
    if (!App.ledger[dateISO]) App.ledger[dateISO] = { opening: "", packaging: "", inbound: "" };
    App.ledger[dateISO][field] = value;
  }
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }

  /* ---------------------------------------------------------
     LOAD
  --------------------------------------------------------- */
  function loadApp() {
    App.settings = sanitizeSettings(lsGet(LS_SETTINGS));
    App.history = lsGet(LS_HISTORY) || [];
    App.ledger = lsGet(LS_LEDGER) || {};
    App.weekNotes = lsGet(LS_WEEKNOTES) || {};
    App.pointer = lsGet(LS_POINTER) || todayISO();
    document.getElementById("sheetDate").value = App.pointer;
    renderAll();
  }

  function saveNow(toastMsg) {
    lsSet(LS_LEDGER, App.ledger);
    lsSet(LS_WEEKNOTES, App.weekNotes);
    lsSet(LS_POINTER, App.pointer);
    lsSet(LS_SETTINGS, App.settings);
    lsSet(LS_HISTORY, App.history);
    App.dirty = false;
    setSyncStatus("saved");
    if (toastMsg) showToast(toastMsg);
    pushToCloud();
  }

  function scheduleSave() {
    App.dirty = true;
    setSyncStatus("saving");
    clearTimeout(App.saveTimer);
    App.saveTimer = setTimeout(function () { saveNow(false); }, 600);
  }

  /* ---------------------------------------------------------
     CLOUD SYNC — Cloudflare Pages Function backed by a KV namespace.
     Nothing to configure client-side (no keys) — this just calls a
     same-origin endpoint. If the site isn't deployed on Cloudflare
     Pages with the KV binding set up (see README), every call below
     fails harmlessly and the tool quietly runs on localStorage only.
  --------------------------------------------------------- */
  var CLOUD_ENDPOINT = (window.KEG_CONFIG && window.KEG_CONFIG.cloudSync && window.KEG_CONFIG.cloudSync.endpoint) || "/api/keg-state";
  var CLOUD_POLL_SECONDS = (window.KEG_CONFIG && window.KEG_CONFIG.cloudSync && window.KEG_CONFIG.cloudSync.pollSeconds) || 15;
  var cloudAvailable = null; // null = not probed yet, then true/false once we know

  function cloudReady() { return cloudAvailable === true; }

  function pushToCloud() {
    var payload = {
      ledger: App.ledger, weekNotes: App.weekNotes, pointer: App.pointer,
      settings: App.settings, history: App.history, savedAt: Date.now()
    };
    fetch(CLOUD_ENDPOINT, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (res) {
      cloudAvailable = !!(res && res.ok);
      setSyncStatus("saved");
    }).catch(function () { cloudAvailable = false; setSyncStatus("saved"); });
  }

  function fetchCloud() {
    return fetch(CLOUD_ENDPOINT).then(function (res) {
      if (!res.ok) { cloudAvailable = false; return null; }
      return res.json();
    }).then(function (json) {
      cloudAvailable = true;
      return json || null;
    }).catch(function () { cloudAvailable = false; return null; });
  }

  function pullFromCloud(isBackground) {
    if (!isBackground) setSyncStatus("saving");
    fetchCloud().then(function (remote) {
      if (!remote) { setSyncStatus("saved"); return; }
      var changed = false;
      if (remote.ledger) { App.ledger = remote.ledger; changed = true; }
      if (remote.weekNotes) { App.weekNotes = remote.weekNotes; changed = true; }
      if (remote.settings) { App.settings = sanitizeSettings(remote.settings); changed = true; }
      if (Array.isArray(remote.history)) { App.history = remote.history; changed = true; }
      if (changed) { renderAll(); showToast("Updated from another device"); }
      setSyncStatus("saved");
    }).catch(function () { setSyncStatus("saved"); });
  }

  function setSyncStatus(state) {
    var dot = document.getElementById("syncDot");
    var text = document.getElementById("syncText");
    if (!dot || !text) return;
    dot.className = "sync-dot";
    if (state === "saving") { dot.classList.add("is-saving"); text.textContent = "Saving…"; }
    else {
      dot.classList.add("is-saved");
      text.textContent = cloudReady() ? "Synced across devices" : "Saved to this device";
    }
  }

  /* ---------------------------------------------------------
     CALCULATION — the daily chain
  --------------------------------------------------------- */
  // Returns an array of { date, opening, openingIsManual, packaging, inbound, closing }
  // across every weekday in the current window, chained Mon→Fri, week→week.
  function computeSequence() {
    var days = windowDays();
    var running = null;
    return days.map(function (date) {
      var e = dayEntry(date);
      var manual = e.opening !== "" && e.opening != null;
      var opening = manual ? num(e.opening) : (running != null ? running : 0);
      var packaging = num(e.packaging);
      var inbound = num(e.inbound);
      var closing = opening - packaging + inbound;
      running = closing;
      return { date: date, opening: opening, openingIsManual: manual, packaging: packaging, inbound: inbound, closing: closing };
    });
  }

  function groupByWeek(seq) {
    var groups = [];
    var map = {};
    seq.forEach(function (row) {
      var wk = mondayOf(row.date);
      if (!map[wk]) { map[wk] = { weekStart: wk, days: [] }; groups.push(map[wk]); }
      map[wk].days.push(row);
    });
    return groups;
  }

  // The keg order sent to the supplier starts from next Monday — the
  // current (partial) week's deliveries are already arranged, so they're
  // dropped from the email even though they still show in Daily tracking.
  function emailGroups(seq) {
    return groupByWeek(seq).slice(1);
  }

  /* ---------------------------------------------------------
     DELIVERY / BACKLOAD ASSIGNMENT (preview, from settings.deliveryCounter)
  --------------------------------------------------------- */
  // Returns array parallel to seq: { loadUnits, backloadUnits }
  function computeDeliveryFlags(seq) {
    var s = App.settings;
    var counter = s.deliveryCounter;
    return seq.map(function (row) {
      var units = row.inbound > 0 ? Math.max(1, Math.round(row.inbound / s.loadSize)) : 0;
      var backloadUnits = 0;
      for (var u = 0; u < units; u++) {
        counter += 1;
        if (counter % s.backloadEvery === 0) backloadUnits += 1;
      }
      return { units: units, backloadUnits: backloadUnits };
    });
  }

  /* ---------------------------------------------------------
     AUTO-SUGGEST DELIVERIES
     Never touches "This week (remaining)" — no new orders, floor-
     protection or otherwise, since that week's deliveries are already
     locked in from previous orders. New suggestions only ever start
     from next Monday.
     Works incrementally, day by day within each (eligible) week — any
     day that already has a value (manually entered, or from an earlier
     click of this button) is treated as locked and left untouched, but
     still counted when checking the floor/target. Only blank days can
     receive a new suggestion. That way a week isn't skipped just
     because one day in it already has something in it.
     Deliveries prefer Monday–Thursday; Friday is only used as a fallback
     when no Mon–Thu slot is available in time (never weekends). A single
     day can only ever take one load (560 a day, no more, no less) — loads
     are never stacked onto a day that already has one, even if that
     leaves a breach unresolved; if a real delivery ever comes in at a
     different amount, just edit that day's Inbound cell by hand.
     Two-phase per week:
       1) Prevent any day's closing stock from dropping below minStock —
          placing a full load on the latest possible blank Mon–Thu day at
          or before the shortfall, falling back to Friday only if no
          Mon–Thu slot remains in time.
       2) Top up so the week's last day closes at/above targetStock,
          adding a full load to the latest available blank day — unless
          that load would push any day between it and week's end above
          hardMaxStock, in which case top-up stops there rather than
          placing a partial load. maxStock is a softer, flexible ceiling —
          preferred but not enforced, since clearing the floor and (within
          the hard ceiling) hitting the target take priority.
  --------------------------------------------------------- */
  function autoSuggestDeliveries() {
    var s = App.settings;
    var anyFilled = false;

    // Process week-by-week (not all at once) so a later week's opening
    // stock correctly reflects any delivery just suggested for an earlier
    // week in this same run, rather than the stale pre-suggestion chain.
    // Starts at pass 1 (next Monday) — no new orders, floor-protection or
    // otherwise, are ever suggested for "This week (remaining)" since
    // that week's deliveries are already locked in from previous orders.
    for (var pass = 1; pass < WINDOW_WEEKS; pass++) {
      var seq = computeSequence();
      var groups = groupByWeek(seq);
      var g = groups[pass];
      if (!g) break;

      var n = g.days.length;
      var blockOpeningStart = g.days[0].opening;
      // Seed with whatever's already entered (locked, never overwritten);
      // blank days start at 0 and are the only ones this function can fill.
      var locked = g.days.map(function (r) { return !!dayEntry(r.date).inbound; });
      var inboundPerDay = g.days.map(function (r) { return num(dayEntry(r.date).inbound); });

      if (locked.every(function (v) { return v; })) continue; // every day already specified — nothing to add

      function simulate() {
        var running = blockOpeningStart, out = [];
        for (var i = 0; i < n; i++) {
          var opening = running;
          var closing = opening - g.days[i].packaging + inboundPerDay[i];
          out.push(closing);
          running = closing;
        }
        return out;
      }
      // Finds the latest eligible day at-or-before idx. Mon–Thu is tried
      // first across the whole range before Friday is considered at all,
      // so Friday is only ever used when truly necessary. A day can only
      // ever take one load (560 a day, no more, no less — never stacked),
      // so only a day with nothing on it yet (this run or otherwise) is
      // ever eligible; a locked (already-entered) day is never touched.
      // If every eligible day in the week is already spoken for, this
      // returns -1 and that particular breach/top-up simply can't be
      // resolved within the week — it's left for a manual look, rather
      // than silently doubling up a delivery that can't really happen.
      function findSlot(scanFrom, scanTo, step, requireAtOrBefore, idx) {
        function tryTier(dayFilter) {
          for (var j = scanFrom; (step > 0 ? j <= scanTo : j >= scanTo); j += step) {
            if (requireAtOrBefore && j > idx) continue;
            if (!dayFilter(g.days[j].date) || locked[j] || inboundPerDay[j] !== 0) continue;
            return j;
          }
          return -1;
        }
        var r;
        r = tryTier(isPreferredDeliveryDay); if (r !== -1) return r;
        r = tryTier(isFridayDeliveryDay); if (r !== -1) return r;
        return -1;
      }
      function latestSlotAtOrBefore(idx) { return findSlot(idx, 0, -1, true, idx); }
      function latestSlot() { return findSlot(n - 1, 0, -1, false, -1); }

      // Phase 1 — never drop below minStock. Always a full load; clearing
      // the floor takes priority over every ceiling.
      for (var guard1 = 0; guard1 < 50; guard1++) {
        var sim1 = simulate();
        var breachIdx = -1;
        for (var i = 0; i < n; i++) { if (sim1[i] < s.minStock) { breachIdx = i; break; } }
        if (breachIdx === -1) break;
        var placeIdx = latestSlotAtOrBefore(breachIdx);
        if (placeIdx === -1) break; // no eligible day available in time — can't prevent within this block
        inboundPerDay[placeIdx] += s.loadSize;
      }

      // Phase 2 — top up so the week closes at/above target, one full
      // load at a time. Stops (rather than placing a partial load) if a
      // full load would push any day from the delivery through week's end
      // above hardMaxStock.
      for (var guard2 = 0; guard2 < 50; guard2++) {
        var sim2 = simulate();
        if (sim2[n - 1] >= s.targetStock) break;
        var placeIdx2 = latestSlot();
        if (placeIdx2 === -1) break;
        var fits = true;
        for (var h = placeIdx2; h < n; h++) { if (sim2[h] + s.loadSize > s.hardMaxStock) { fits = false; break; } }
        if (!fits) break; // a full load here would breach the hard ceiling — stop topping up
        inboundPerDay[placeIdx2] += s.loadSize;
      }

      g.days.forEach(function (r, i) {
        if (!locked[i] && inboundPerDay[i] > 0) {
          setDayField(r.date, "inbound", String(inboundPerDay[i]));
          anyFilled = true;
        }
      });
    }

    if (anyFilled) {
      scheduleSave();
      renderAll();
      showToast("Suggested deliveries filled in");
    } else {
      showToast("Nothing to suggest — clear a week's inbound cells first, or all weeks are already on target");
    }
  }

  /* ---------------------------------------------------------
     RENDER: ALL
  --------------------------------------------------------- */
  function renderAll() {
    document.getElementById("dateBanner").innerHTML =
      '<span>' + esc(formatBanner(App.pointer)) + '</span><span class="date-banner__sub">Weekly keg stocktake</span>';
    renderStock();
    renderDailyTracking();
    renderDeliverySchedule();
    renderSettings();
    renderHistory();
  }

  function esc(v) {
    if (v === undefined || v === null) return "";
    return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* ---------------------------------------------------------
     FOCUS PRESERVATION — re-rendering via innerHTML destroys and
     recreates input elements, which drops focus mid-keystroke.
     This captures which field (and cursor position) was active
     before a render, then restores it afterwards.
  --------------------------------------------------------- */
  function activeFieldSelector() {
    var el = document.activeElement;
    if (!el || (el.tagName !== "INPUT" && el.tagName !== "TEXTAREA")) return null;
    if (el.dataset && el.dataset.date && el.dataset.field) {
      return '.day-input[data-date="' + el.dataset.date + '"][data-field="' + el.dataset.field + '"]';
    }
    if (el.dataset && el.dataset.weeknote) {
      return '[data-weeknote="' + el.dataset.weeknote + '"]';
    }
    if (el.id) return "#" + el.id;
    return null;
  }

  function withFocusPreserved(renderFn) {
    var selector = activeFieldSelector();
    var el = document.activeElement;
    var selStart = (el && typeof el.selectionStart === "number") ? el.selectionStart : null;
    var selEnd = (el && typeof el.selectionEnd === "number") ? el.selectionEnd : null;

    renderFn();

    if (!selector) return;
    var restored = document.querySelector(selector);
    if (!restored) return;
    restored.focus();
    if (selStart != null && restored.setSelectionRange) {
      try { restored.setSelectionRange(selStart, selEnd); } catch (e) { /* not all input types support this */ }
    }
  }

  /* ---------------------------------------------------------
     RENDER: STOCK ON HAND
  --------------------------------------------------------- */
  function renderStock() {
    var el = document.getElementById("stockSection");
    var s = App.settings;
    var seq = computeSequence();
    var day0 = seq[0];
    var groups = groupByWeek(seq);
    var week1Closing = groups[0].days[groups[0].days.length - 1].closing;

    var pkgDays = seq.filter(function (r) { return r.packaging > 0; });
    var avgPkg = pkgDays.length ? (pkgDays.reduce(function (a, r) { return a + r.packaging; }, 0) / pkgDays.length) : 0;
    var stockVal = day0.opening;
    var coverText = (avgPkg > 0 && stockVal > 0) ? (stockVal / avgPkg).toFixed(1) + " wks" : "—";

    var vsTarget = week1Closing - s.targetStock;
    var vsTargetText = (vsTarget >= 0 ? "+" : "") + Math.round(vsTarget).toLocaleString();
    var vsTargetClass = vsTarget >= 0 ? "is-good" : "is-warn";

    var remainingToBackload = s.backloadEvery - (s.deliveryCounter % s.backloadEvery);
    var entry = dayEntry(App.pointer);

    var lowestClosing = seq.reduce(function (min, r) { return Math.min(min, r.closing); }, Infinity);
    var lowestText = Math.round(lowestClosing).toLocaleString();
    var lowestClass = lowestClosing < s.minStock ? "is-warn" : "is-good";

    el.innerHTML =
      '<div class="card__head"><div class="card__head-left"><span class="tab" data-color="mint">01</span><div><h2 class="card__title">Stock on hand</h2>' +
      '<p class="card-hint">Count kegs on hand for this week\u2019s stocktake \u2014 ' + esc(weekdayLong(App.pointer)) + ' ' + esc(formatShort(App.pointer)) + '</p></div></div></div>' +
      '<div class="card__body stock-grid">' +
        '<div class="stock-input-col">' +
          '<div class="stock-big"><span class="field__label">Kegs on hand today</span>' +
          '<input type="text" inputmode="numeric" pattern="[0-9]*" id="stockOnHand" value="' + esc(entry.opening) + '" placeholder="e.g. 1477"></div>' +
        '</div>' +
        '<div class="stat-tile-col">' +
          '<div class="stat-tile"><span class="stat-tile__label">This week\u2019s close vs. target (' + s.targetStock.toLocaleString() + ')</span><span class="stat-tile__value ' + vsTargetClass + '">' + vsTargetText + '</span></div>' +
          '<div class="stat-tile"><span class="stat-tile__label">Lowest projected stock (floor ' + s.minStock.toLocaleString() + ')</span><span class="stat-tile__value ' + lowestClass + '">' + lowestText + '</span></div>' +
          '<div class="stat-tile"><span class="stat-tile__label">Weeks of cover</span><span class="stat-tile__value">' + coverText + '</span></div>' +
          '<div class="stat-tile"><span class="stat-tile__label">Deliveries to next backload</span><span class="stat-tile__value">' + remainingToBackload + '</span></div>' +
        '</div>' +
      '</div>';

    document.getElementById("stockOnHand").addEventListener("input", function (e) {
      setDayField(App.pointer, "opening", e.target.value);
      scheduleSave();
      withFocusPreserved(function () {
        renderStock();
        renderDailyTracking();
        renderDeliverySchedule();
      });
    });
  }

  /* ---------------------------------------------------------
     RENDER: DAILY TRACKING (mirrors the Excel Mon–Fri grid)
  --------------------------------------------------------- */
  function renderDailyTracking() {
    var el = document.getElementById("dailyTrackingSection");
    var s = App.settings;
    var seq = computeSequence();
    var groups = groupByWeek(seq);

    var blocksHtml = groups.map(function (g, gi) {
      var totalPkg = g.days.reduce(function (a, r) { return a + r.packaging; }, 0);
      var totalInb = g.days.reduce(function (a, r) { return a + r.inbound; }, 0);
      var title = (gi === 0 && g.days.length < 7) ? "This week (remaining)" : ("Week of " + formatShort(g.weekStart));
      var note = App.weekNotes[g.weekStart] || "";

      var head = '<tr><th></th>' + g.days.map(function (r) { return '<th class="' + (isWeekend(r.date) ? "is-weekend" : "") + '">' + esc(weekdayShort(r.date)) + '<br>' + esc(formatShort(r.date)) + '</th>'; }).join("") + '<th>Total</th></tr>';

      var openingRow = '<tr><td>Opening inventory</td>' + g.days.map(function (r) {
        var placeholder = r.openingIsManual ? "" : String(Math.round(r.opening));
        var val = r.openingIsManual ? String(dayEntry(r.date).opening) : "";
        return '<td class="' + (isWeekend(r.date) ? "is-weekend" : "") + '"><input type="text" inputmode="numeric" pattern="[0-9]*" class="day-input day-input--opening" data-date="' + r.date + '" data-field="opening" value="' + esc(val) + '" placeholder="' + esc(placeholder) + '"></td>';
      }).join("") + '<td></td></tr>';

      var packagingRow = '<tr><td>Packaging</td>' + g.days.map(function (r) {
        var val = dayEntry(r.date).packaging;
        return '<td class="' + (isWeekend(r.date) ? "is-weekend" : "") + '"><input type="text" inputmode="numeric" pattern="[0-9]*" class="day-input" data-date="' + r.date + '" data-field="packaging" value="' + esc(val) + '" placeholder="0"></td>';
      }).join("") + '<td style="font-family:var(--font-data);font-weight:700;">' + (totalPkg || "") + '</td></tr>';

      var inboundRow = '<tr><td>Inbounds</td>' + g.days.map(function (r) {
        var val = dayEntry(r.date).inbound;
        return '<td class="' + (isWeekend(r.date) ? "is-weekend" : "") + '"><input type="text" inputmode="numeric" pattern="[0-9]*" class="day-input" data-date="' + r.date + '" data-field="inbound" value="' + esc(val) + '" placeholder="0"></td>';
      }).join("") + '<td style="font-family:var(--font-data);font-weight:700;">' + (totalInb || "") + '</td></tr>';

      var closingRow = '<tr class="row-closing"><td>Daily total stock on hand</td>' + g.days.map(function (r) {
        var cls = r.closing < s.minStock ? "is-low" : (r.closing < s.targetStock ? "is-watch" : (r.closing > s.maxStock ? "is-over" : "is-good"));
        return '<td class="' + cls + '">' + Math.round(r.closing).toLocaleString() + '</td>';
      }).join("") + '<td></td></tr>';

      return '<div class="week-block" data-week="' + g.weekStart + '">' +
        '<div class="week-block__head"><span class="week-block__title">' + esc(title) + '</span>' +
          '<span class="week-block__totals">Packaging ' + totalPkg.toLocaleString() + ' \u00b7 Inbound ' + totalInb.toLocaleString() + '</span></div>' +
        '<div class="daytable-scroll"><table class="daytable"><thead>' + head + '</thead><tbody>' +
          openingRow + packagingRow + inboundRow + closingRow +
        '</tbody></table></div>' +
        '<div class="week-notes"><textarea data-weeknote="' + g.weekStart + '" placeholder="Weekly notes\u2026">' + esc(note) + '</textarea></div>' +
      '</div>';
    }).join("");

    var boardImportHtml =
      '<div class="board-import" id="boardImport">' +
        '<div class="board-dropzone" id="boardDropzone" tabindex="0" role="button" aria-label="Import packaging from the Live Brewery Board">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="m7 8 5-5 5 5"/><path d="M5 21h14"/></svg>' +
          '<div class="board-dropzone__title">Drop the Live Brewery Board here to import packaging</div>' +
          '<div class="board-dropzone__sub">Reads the \u201cKegs\u201d row of each week tab and fills blank Packaging cells in the window below \u2014 or <span class="board-dropzone__link">choose a file</span></div>' +
        '</div>' +
        '<input type="file" id="boardFileInput" accept=".xlsx,.xls" style="display:none;">' +
        '<div class="board-import__status" id="boardImportStatus"></div>' +
      '</div>';

    el.innerHTML =
      '<div class="card__head"><div class="card__head-left"><span class="tab" data-color="purple">02</span><div><h2 class="card__title">Daily tracking</h2>' +
      '<p class="card-hint">Opening inventory carries forward automatically \u2014 overwrite any day if an actual count differs. Red = below the ' + s.minStock.toLocaleString() + ' floor, amber = below the ' + s.targetStock.toLocaleString() + ' target, blue = above the ' + s.maxStock.toLocaleString() + ' ceiling.</p></div></div></div>' +
      '<div class="card__body">' + boardImportHtml + blocksHtml + '</div>';

    el.querySelectorAll(".day-input").forEach(function (input) {
      input.addEventListener("input", function () {
        setDayField(input.dataset.date, input.dataset.field, input.value);
        scheduleSave();
        withFocusPreserved(function () {
          renderStock();
          renderDailyTracking();
          renderDeliverySchedule();
        });
      });
    });
    el.querySelectorAll("[data-weeknote]").forEach(function (ta) {
      ta.addEventListener("input", function () {
        App.weekNotes[ta.dataset.weeknote] = ta.value;
        scheduleSave();
      });
    });

    wireBoardImport(el);
  }

  /* ---------------------------------------------------------
     LIVE BREWERY BOARD IMPORT
     Drag-and-drop (or choose-file) import of the Live Brewery Board
     workbook. Reads every sheet's "Date" row and "Kegs" row block
     client-side (via SheetJS/xlsx.js \u2014 nothing is uploaded anywhere),
     sums each day's kegged quantity (plain numbers, plus the number
     following an "NZ EX ##" export tag), and fills it into that day's
     Packaging cell \u2014 but only for days currently in view and currently
     blank, so a manually-entered Packaging number is never overwritten.
  --------------------------------------------------------- */
  function wireBoardImport(scopeEl) {
    var dz = scopeEl.querySelector("#boardDropzone");
    var input = scopeEl.querySelector("#boardFileInput");
    if (!dz || !input) return;

    dz.addEventListener("click", function () { input.click(); });
    dz.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
    dz.addEventListener("dragover", function (e) { e.preventDefault(); dz.classList.add("is-drag"); });
    dz.addEventListener("dragleave", function () { dz.classList.remove("is-drag"); });
    dz.addEventListener("drop", function (e) {
      e.preventDefault();
      dz.classList.remove("is-drag");
      var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) handleBoardFile(file);
    });
    input.addEventListener("change", function () {
      if (input.files && input.files[0]) handleBoardFile(input.files[0]);
      input.value = "";
    });
  }

  function setBoardStatus(msg, isError) {
    var statusEl = document.getElementById("boardImportStatus");
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.className = "board-import__status" + (isError ? " is-error" : "");
  }

  function handleBoardFile(file) {
    if (typeof XLSX === "undefined") {
      setBoardStatus("Couldn't load the spreadsheet reader \u2014 check your connection and try again.", true);
      return;
    }
    setBoardStatus("Reading " + file.name + "\u2026");
    var reader = new FileReader();
    reader.onerror = function () { setBoardStatus("Couldn't read that file.", true); };
    reader.onload = function (e) {
      try {
        var wb = XLSX.read(new Uint8Array(e.target.result), { type: "array", cellDates: true });
        var kegsByDate = extractKegsByDate(wb);
        applyKegsToLedger(kegsByDate);
      } catch (err) {
        setBoardStatus("Couldn't read that workbook \u2014 is it the Live Brewery Board export?", true);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  // Scans every sheet for a "Date" row and a "Kegs" row block (same layout
  // in every weekly tab: 7 day-groups of 3 columns \u2014 product, vessel,
  // quantity \u2014 starting at column B, one group per weekday Mon\u2192Sun).
  // Returns { "YYYY-MM-DD": totalKegsThatDay }, merged across every sheet
  // that contains a given date (so it doesn't matter which tab a date
  // lives in, or how the tabs are named/ordered).
  function extractKegsByDate(wb) {
    var GROUP_COLS = [2, 5, 8, 11, 14, 17, 20]; // 1-indexed: B,E,H,K,N,Q,T (Mon..Sun)
    var out = {};
    // Only bother fully parsing a sheet if its week is within (roughly) the
    // app's current window \u2014 skips the dozens of historical/old tabs fast.
    var winStart = parseISO(mondayOf(windowStart()));
    var winEnd = parseISO(windowEnd());
    var loMs = winStart.getTime() - 8 * 86400000, hiMs = winEnd.getTime() + 8 * 86400000;

    wb.SheetNames.forEach(function (name) {
      var ws = wb.Sheets[name];
      if (!ws || !ws["!ref"]) return;
      var range = XLSX.utils.decode_range(ws["!ref"]);
      var dateRow = -1, kegsRow = -1, kegsRowEnd = -1;
      for (var r = range.s.r; r <= Math.min(range.e.r, 80); r++) {
        var a = cellStr(ws, r, 0);
        if (a === "date" && dateRow === -1) dateRow = r;
        if (a === "kegs" && kegsRow === -1) {
          kegsRow = r;
          kegsRowEnd = mergedRowEnd(ws, r, 0);
        }
      }
      if (dateRow === -1 || kegsRow === -1) return;

      // Quick in-range check using the Monday date before scanning the block.
      var mondayCellDate = cellDate(ws, dateRow, GROUP_COLS[0] - 1);
      if (!mondayCellDate) return;
      var t = mondayCellDate.getTime();
      if (t < loMs || t > hiMs) return;

      GROUP_COLS.forEach(function (col0based1, gi) {
        var dateCol = col0based1 - 1;
        var qtyCol = dateCol + 2;
        var d = cellDate(ws, dateRow, dateCol);
        if (!d) return;
        var iso = toISO(d);
        var total = 0;
        for (var rr = kegsRow; rr <= kegsRowEnd; rr++) {
          total += kegsCellValue(ws, rr, qtyCol);
        }
        if (total > 0) out[iso] = (out[iso] || 0) + total;
      });
    });
    return out;
  }

  function mergedRowEnd(ws, row, col) {
    var merges = ws["!merges"] || [];
    for (var i = 0; i < merges.length; i++) {
      var m = merges[i];
      if (m.s.c === col && m.s.r === row) return m.e.r;
    }
    return row;
  }
  function cellStr(ws, r, c) {
    var cell = ws[XLSX.utils.encode_cell({ r: r, c: c })];
    if (!cell || cell.v == null) return "";
    return String(cell.v).trim().toLowerCase();
  }
  function cellDate(ws, r, c) {
    var cell = ws[XLSX.utils.encode_cell({ r: r, c: c })];
    if (!cell || cell.v == null) return null;
    if (cell.v instanceof Date) return cell.v;
    if (typeof cell.v === "number" && XLSX.SSF && XLSX.SSF.parse_date_code) {
      var pd = XLSX.SSF.parse_date_code(cell.v);
      if (pd) return new Date(pd.y, pd.m - 1, pd.d);
    }
    return null;
  }
  // A "Kegs" row quantity cell is either a plain number, or a text tag
  // like "NZ EX 48" \u2014 those export kegs still come out of the same
  // physical keg pool, so the trailing number counts too.
  function kegsCellValue(ws, r, c) {
    var cell = ws[XLSX.utils.encode_cell({ r: r, c: c })];
    if (!cell || cell.v == null || cell.v === "") return 0;
    if (typeof cell.v === "number") return cell.v;
    var m = String(cell.v).match(/NZ\s*EX\D*(\d+(?:\.\d+)?)/i);
    return m ? parseFloat(m[1]) : 0;
  }

  function applyKegsToLedger(kegsByDate) {
    var dates = Object.keys(kegsByDate);
    if (!dates.length) {
      setBoardStatus("No kegging found in that file for the weeks currently shown below.", true);
      return;
    }
    var winDays = windowDays();
    var filled = 0, skipped = 0, outOfWindow = 0;
    dates.forEach(function (iso) {
      if (winDays.indexOf(iso) === -1) { outOfWindow++; return; }
      var existing = dayEntry(iso).packaging;
      if (existing !== "" && existing != null) { skipped++; return; }
      setDayField(iso, "packaging", String(Math.round(kegsByDate[iso])));
      filled++;
    });
    if (filled > 0) {
      scheduleSave();
      renderAll();
      showToast("Imported packaging for " + filled + " day" + (filled === 1 ? "" : "s") + " from the Live Brewery Board");
    }
    var statusMsg = filled > 0
      ? ("Filled " + filled + " day" + (filled === 1 ? "" : "s") + (skipped > 0 ? "; left " + skipped + " day" + (skipped === 1 ? "" : "s") + " already entered" : "") + ".")
      : (skipped > 0 ? "Every matching day already has a Packaging value \u2014 clear a cell first to re-import it." : "No kegging found in that file for the weeks currently shown below.");
    setBoardStatus(statusMsg, filled === 0);
  }

  /* ---------------------------------------------------------
     RENDER: DELIVERY SCHEDULE
  --------------------------------------------------------- */
  function renderDeliverySchedule() {
    var el = document.getElementById("deliveryScheduleSection");
    var seq = computeSequence();
    var flags = computeDeliveryFlags(seq);
    var groups = groupByWeek(seq);

    var rowsHtml = groups.map(function (g, gi) {
      var rows = g.days.map(function (r) {
        var idx = seq.indexOf(r);
        var f = flags[idx];
        var hasLoad = f.units > 0;
        var loadText = hasLoad ? (f.units + " Load" + (f.units > 1 ? "s" : "")) : "";
        var backloadText = f.backloadUnits > 0 ? ('<span class="tag tag--purple">Backload' + (f.backloadUnits > 1 ? " x" + f.backloadUnits : "") + '</span>') : "";
        return '<div class="delivery-row2' + (hasLoad ? " has-load" : "") + '">' +
          '<span class="delivery-row2__day">' + esc(weekdayLong(r.date)) + '</span>' +
          '<span class="delivery-row2__date">' + esc(formatShort(r.date)) + '</span>' +
          '<span class="delivery-row2__load">' + esc(loadText) + '</span>' +
          '<span class="delivery-row2__backload">' + backloadText + '</span>' +
        '</div>';
      }).join("");
      return rows + (gi < groups.length - 1 ? '<div class="delivery-week-gap"></div>' : "");
    }).join("");

    var totalLoads = flags.reduce(function (a, f) { return a + f.units; }, 0);
    var totalBackloads = flags.reduce(function (a, f) { return a + f.backloadUnits; }, 0);
    var totalKegs = seq.reduce(function (a, r) { return a + r.inbound; }, 0);

    el.innerHTML =
      '<div class="card__head"><div class="card__head-left"><span class="tab" data-color="orange">03</span><div><h2 class="card__title">Delivery schedule</h2>' +
      '<p class="card-hint">The day-by-day order to send to your supplier \u2014 ' + totalLoads + ' load' + (totalLoads === 1 ? "" : "s") + ' \u00b7 ' + totalKegs.toLocaleString() + ' kegs' + (totalBackloads > 0 ? (' \u00b7 ' + totalBackloads + ' backload' + (totalBackloads > 1 ? "s" : "")) : "") + '</p></div></div>' +
      '<button class="btn btn--outline btn--sm" id="autoSuggestBtn" type="button">Auto-suggest deliveries</button>' +
      '</div>' +
      '<div class="card__body">' +
        '<div class="delivery-list">' + rowsHtml + '</div>' +
        '<p class="card-hint" style="margin-top:10px;">Auto-suggest never touches "This week (remaining)" \u2014 those deliveries are already locked in. New orders can only be suggested from next Monday onward.</p>' +
        '<div class="settings-foot">' +
          '<button class="btn btn--primary btn--sm" id="confirmOrderBtn" type="button">Confirm &amp; log this week\u2019s order</button>' +
          '<span class="card-hint" id="confirmHint" style="margin:0;"></span>' +
        '</div>' +
      '</div>';

    document.getElementById("autoSuggestBtn").addEventListener("click", autoSuggestDeliveries);
    document.getElementById("confirmOrderBtn").addEventListener("click", confirmOrder);
  }

  function confirmOrder() {
    var seq = computeSequence();
    var flags = computeDeliveryFlags(seq);
    var groups = groupByWeek(seq);
    var week1 = groups[0];
    var week1Count = week1.days.length;

    var week1Loads = 0, week1Backloads = 0, week1Kegs = 0;
    for (var i = 0; i < week1Count; i++) {
      week1Loads += flags[i].units;
      week1Backloads += flags[i].backloadUnits;
      week1Kegs += seq[i].inbound;
    }

    App.history.push({
      loggedAt: new Date().toISOString(),
      weekStart: week1.weekStart,
      stocktakeDate: App.pointer,
      stockOnHand: Math.round(seq[0].opening),
      loads: week1Loads,
      kegsOrdered: week1Kegs,
      backloadCount: week1Backloads
    });

    var counter = App.settings.deliveryCounter;
    for (var u = 0; u < week1Loads; u++) counter = (counter + 1) % App.settings.backloadEvery;
    App.settings.deliveryCounter = counter;

    var nextPointer = addDays(App.pointer, 7);
    // suggest next week's opening (only if not already entered) from the projected closing
    var closingBeforeNext = null;
    seq.forEach(function (r) { if (r.date < nextPointer) closingBeforeNext = r.closing; });
    if (closingBeforeNext != null && !dayEntry(nextPointer).opening) {
      setDayField(nextPointer, "opening", String(Math.round(closingBeforeNext)));
    }

    App.pointer = nextPointer;
    saveNow(false);
    showToast("Logged " + week1Loads + " load" + (week1Loads === 1 ? "" : "s") + " (" + week1Kegs.toLocaleString() + " kegs)" + (week1Backloads > 0 ? " incl. backload" : "") + " \u2014 rolled forward to " + formatPretty(nextPointer));
    renderAll();
    document.getElementById("sheetDate").value = App.pointer;
  }

  /* ---------------------------------------------------------
     RENDER: SETTINGS
  --------------------------------------------------------- */
  function renderSettings() {
    var el = document.getElementById("settingsSection");
    var s = App.settings;

    el.innerHTML =
      '<div class="card__head"><div class="card__head-left"><span class="tab" data-color="sky">04</span><div><h2 class="card__title">Settings</h2>' +
      '<p class="card-hint">Applies to the order plan and the generated email</p></div></div></div>' +
      '<div class="card__body settings-grid">' +
        settingsField("loadSize", "Kegs per load", "number", s.loadSize) +
        settingsField("targetStock", "Target stock at week\u2019s end", "number", s.targetStock) +
        settingsField("minStock", "Never drop below", "number", s.minStock) +
        settingsField("maxStock", "Soft ceiling (flexible)", "number", s.maxStock) +
        settingsField("hardMaxStock", "Hard ceiling (never exceed)", "number", s.hardMaxStock) +
        settingsField("backloadEvery", "Backload every N deliveries", "number", s.backloadEvery) +
        settingsField("deliveryCounter", "Deliveries since last backload", "number", s.deliveryCounter) +
        settingsField("supplierName", "Supplier contact name", "text", s.supplierName, "e.g. Jarod", true) +
        settingsField("supplierCarrier", "Supplier contact / carrier note", "text", s.supplierCarrier, "e.g. CUB \u2013 HW via Linfox", true) +
        settingsField("senderName", "Your name", "text", s.senderName, "e.g. Jordan Smith") +
        settingsField("senderRole", "Your role", "text", s.senderRole, "e.g. Packaging Coordinator") +
      '</div>' +
      '<p class="card-hint" style="margin-top:14px;">Settings and order history save automatically in this browser' + (cloudReady() ? " and sync across devices." : ".") + '</p>';

    function settingsField(key, label, type, value, placeholder, wide) {
      var isNum = type === "number";
      return '<label class="field' + (wide ? " field--wide" : "") + '"><span class="field__label">' + esc(label) + '</span>' +
        '<input type="' + (isNum ? "text" : type) + '"' + (isNum ? ' inputmode="numeric" pattern="[0-9]*"' : '') + ' id="set-' + key + '" value="' + esc(value) + '"' + (placeholder ? ' placeholder="' + esc(placeholder) + '"' : '') + '></label>';
    }

    ["loadSize", "targetStock", "minStock", "maxStock", "hardMaxStock", "backloadEvery", "deliveryCounter", "supplierName", "supplierCarrier", "senderName", "senderRole"].forEach(function (key) {
      var input = document.getElementById("set-" + key);
      input.addEventListener("change", function () {
        var raw = {};
        raw[key] = input.value;
        App.settings = sanitizeSettings(Object.assign({}, App.settings, raw));
        scheduleSave();
        withFocusPreserved(function () {
          renderStock();
          renderDailyTracking();
          renderDeliverySchedule();
          if (key === "deliveryCounter" || key === "backloadEvery") renderSettings();
        });
      });
    });
  }

  /* ---------------------------------------------------------
     RENDER: ORDER HISTORY
  --------------------------------------------------------- */
  function renderHistory() {
    var el = document.getElementById("historySection");
    var rows = App.history.slice().reverse();

    el.innerHTML =
      '<div class="card__head"><div class="card__head-left"><span class="tab" data-color="gold">05</span><div><h2 class="card__title">Order history</h2>' +
      '<p class="card-hint">Confirmed weekly orders, most recent first</p></div></div></div>' +
      '<div class="card__body">' +
        (rows.length
          ? '<div class="table-scroll"><table class="dtable"><thead><tr><th class="col-med">Logged</th><th class="col-med">Week</th><th class="col-narrow">Stock on hand</th><th class="col-narrow">Loads</th><th class="col-narrow">Kegs</th><th class="col-med">Backload</th></tr></thead><tbody>' +
            rows.map(function (h) {
              return '<tr>' +
                '<td>' + esc(new Date(h.loggedAt).toLocaleDateString("en-AU")) + '</td>' +
                '<td>' + esc(formatShort(h.weekStart || h.stocktakeDate)) + '</td>' +
                '<td style="font-family:var(--font-data);">' + (h.stockOnHand || 0).toLocaleString() + '</td>' +
                '<td style="font-family:var(--font-data);font-weight:700;">' + h.loads + '</td>' +
                '<td style="font-family:var(--font-data);">' + (h.kegsOrdered || 0).toLocaleString() + '</td>' +
                '<td>' + (h.backloadCount > 0 ? '<span class="tag tag--purple">' + h.backloadCount + '</span>' : '<span class="tag tag--neutral">—</span>') + '</td>' +
              '</tr>';
            }).join("") +
          '</tbody></table></div>'
          : '<p class="card-hint">No orders logged yet \u2014 confirm a week\u2019s order in the Delivery schedule above to start a record.</p>') +
      '</div>';
  }

  /* ---------------------------------------------------------
     EMAIL BUILDER — mirrors the day-by-day order list sent to the supplier
  --------------------------------------------------------- */
  var C = { mint: "#47D7AC", mintBg: "#eafcf5", apricot: "#FDAA63", purple: "#7566A0", sky: "#99D6EA", gold: "#FFD637", ink: "#000000" };

  function td(content, style) { return '<td style="padding:7px 10px;border:1px solid #e6e6e2;font-size:13px;color:#000000;' + (style || "") + '">' + content + '</td>'; }

  function buildEmailHtml() {
    var s = App.settings;
    var seq = computeSequence();
    var flags = computeDeliveryFlags(seq);
    var groups = emailGroups(seq);
    var wcDate = groups.length ? groups[0].weekStart : App.pointer;

    var html = '';
    html += '<table style="border-collapse:collapse;width:100%;max-width:640px;font-family:Arial,Helvetica,sans-serif;">';
    html += '<tr>' +
      '<td style="border:none;padding:4px 10px 14px 2px;width:44px;vertical-align:middle;">' + LOGO_SVG + '</td>' +
      td('<div style="font-size:20px;font-weight:bold;color:' + C.ink + ';">Keg order</div>' +
         '<div style="font-size:13px;color:#666;margin-top:2px;">Balter Brewing \u00b7 WC ' + esc(formatDots(wcDate)) + '</div>', "border:none;padding:4px 2px 14px 0;vertical-align:middle;") +
    '</tr></table>';

    html += '<table style="border-collapse:collapse;width:100%;max-width:640px;">';
    html += '<tr>' + td("Good Morning " + esc(s.supplierName || "team") + ",", "border:none;padding-left:0;") + '</tr>';
    html += '<tr>' + td("Please find the keg order for WC " + esc(formatDots(wcDate)) + ", plus the proposed plan for the next two weeks", "border:none;padding-left:0;") + '</tr>';
    html += '</table>';

    html += '<table style="border-collapse:collapse;width:100%;max-width:420px;margin-top:14px;">';
    groups.forEach(function (g, gi) {
      g.days.forEach(function (r) {
        var idx = seq.indexOf(r);
        var f = flags[idx];
        var loadText = f.units > 0 ? (f.units + " Load" + (f.units > 1 ? "s" : "")) : "";
        html += '<tr>' +
          td('<strong>' + esc(weekdayLong(r.date)) + '</strong>', "border-color:#000;") +
          td(esc(formatShort(r.date)), "border-color:#000;") +
          td(loadText, "border-color:#000;font-weight:bold;") +
          (f.backloadUnits > 0 ? td("Backload", "border-color:#000;color:#5b4b8a;font-weight:bold;") : td("", "border-color:#000;")) +
        '</tr>';
      });
      if (gi < groups.length - 1) html += '<tr><td colspan="4" style="border:none;padding:6px 0;"></td></tr>';
    });
    html += '</table>';

    var signRole = s.senderRole ? ("<br>" + esc(s.senderRole)) : "";
    html += '<div style="margin-top:16px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:' + C.ink + ';">Cheers,<br><strong>' + esc(s.senderName || "Your name") + '</strong>' + signRole + '<br>Balter Brewing</div>';
    return html;
  }

  function buildEmailPlain() {
    var s = App.settings;
    var seq = computeSequence();
    var flags = computeDeliveryFlags(seq);
    var groups = emailGroups(seq);
    var wcDate = groups.length ? groups[0].weekStart : App.pointer;

    var lines = [];
    lines.push("Good Morning " + (s.supplierName || "team") + ",");
    lines.push("");
    lines.push("Please find the keg order for WC " + formatDots(wcDate) + ", plus the proposed plan for the next two weeks");
    lines.push("");
    groups.forEach(function (g) {
      g.days.forEach(function (r) {
        var idx = seq.indexOf(r);
        var f = flags[idx];
        var loadText = f.units > 0 ? (f.units + " Load" + (f.units > 1 ? "s" : "")) : "";
        lines.push(weekdayLong(r.date) + "\t" + formatShort(r.date) + (loadText ? ("\t" + loadText) : "") + (f.backloadUnits > 0 ? "\tBackload" : ""));
      });
      lines.push("");
    });
    lines.push("Cheers,");
    lines.push(s.senderName || "Your name");
    if (s.senderRole) lines.push(s.senderRole);
    lines.push("Balter Brewing");
    return lines.join("\n");
  }

  /* ---------------------------------------------------------
     EMAIL PREVIEW MODAL
  --------------------------------------------------------- */
  var overlay, preview, copyStatus, currentHTML = "", currentPlain = "";

  function openEmailModal() {
    currentHTML = buildEmailHtml();
    currentPlain = buildEmailPlain();
    preview.innerHTML = currentHTML;
    copyStatus.textContent = "";
    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
  }
  function closeEmailModal() {
    overlay.classList.remove("open");
    document.body.style.overflow = "";
  }
  function copyRich() {
    if (navigator.clipboard && window.ClipboardItem) {
      try {
        var blobHtml = new Blob([currentHTML], { type: "text/html" });
        var blobText = new Blob([currentPlain], { type: "text/plain" });
        return navigator.clipboard.write([ new ClipboardItem({ "text/html": blobHtml, "text/plain": blobText }) ]);
      } catch (e) { /* fall through to selection-based copy */ }
    }
    return new Promise(function (resolve, reject) {
      try {
        var range = document.createRange();
        range.selectNodeContents(preview);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        var ok = document.execCommand("copy");
        sel.removeAllRanges();
        ok ? resolve() : reject();
      } catch (e) { reject(e); }
    });
  }

  /* ---------------------------------------------------------
     UTIL
  --------------------------------------------------------- */
  var toastTimer = null;
  function showToast(msg) {
    var t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2600);
  }

  /* ---------------------------------------------------------
     INIT
  --------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", function () {
    try { initApp(); } catch (err) { showFatalError(err); }
  });

  function initApp() {
    loadApp();

    document.getElementById("sheetDate").addEventListener("change", function (e) {
      if (App.dirty) saveNow(false);
      App.pointer = e.target.value || todayISO();
      saveNow(false);
      renderAll();
    });
    document.getElementById("clearBtn").addEventListener("click", function () {
      var ok = window.confirm("Clear all packaging, inbound and opening entries in this 4-week window?\n\nSettings and order history are not affected. This can't be undone.");
      if (!ok) return;
      windowDays().forEach(function (d) { delete App.ledger[d]; });
      saveNow(false);
      renderAll();
      showToast("Sheet cleared");
    });
    document.getElementById("printBtn").addEventListener("click", function () { window.print(); });

    overlay = document.getElementById("modalOverlay");
    preview = document.getElementById("emailPreview");
    copyStatus = document.getElementById("copyStatus");

    document.getElementById("buildEmailBtn").addEventListener("click", openEmailModal);
    document.getElementById("modalClose").addEventListener("click", closeEmailModal);
    overlay.addEventListener("click", function (e) { if (e.target === overlay) closeEmailModal(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && overlay.classList.contains("open")) closeEmailModal(); });

    document.getElementById("copyRichBtn").addEventListener("click", function () {
      copyRich().then(function () { copyStatus.textContent = "Copied — paste it into your email."; })
        .catch(function () { copyStatus.textContent = "Couldn't copy automatically — select the preview and copy manually."; });
    });
    document.getElementById("copyPlainBtn").addEventListener("click", function () {
      (navigator.clipboard ? navigator.clipboard.writeText(currentPlain) : Promise.reject())
        .then(function () { copyStatus.textContent = "Plain text copied."; })
        .catch(function () { copyStatus.textContent = "Couldn't copy automatically — select the preview and copy manually."; });
    });
    document.getElementById("downloadImgBtn").addEventListener("click", function () {
      if (!window.html2canvas) { copyStatus.textContent = "Image tool unavailable offline."; return; }
      copyStatus.textContent = "Rendering image…";
      html2canvas(preview, { backgroundColor: "#ffffff", scale: 2 }).then(function (canvas) {
        var link = document.createElement("a");
        link.download = "balter-keg-order-" + (App.pointer || "draft") + ".png";
        link.href = canvas.toDataURL("image/png");
        link.click();
        copyStatus.textContent = "Image downloaded.";
      }).catch(function () { copyStatus.textContent = "Couldn't render image."; });
    });

    window.addEventListener("beforeunload", function () { if (App.dirty) saveNow(false); });

    // Cloud sync (Cloudflare KV) is auto-detected, not configured — always
    // attempt it; every call degrades harmlessly to localStorage-only if
    // the site isn't deployed with the KV function/binding (see README).
    var syncNowBtn = document.getElementById("syncNowBtn");
    syncNowBtn.addEventListener("click", function () {
      if (App.dirty) saveNow(false);
      syncNowBtn.classList.add("is-spinning");
      setTimeout(function () { syncNowBtn.classList.remove("is-spinning"); }, 650);
      pullFromCloud(false);
    });
    document.addEventListener("visibilitychange", function () { if (!document.hidden && !App.dirty) pullFromCloud(true); });
    window.addEventListener("focus", function () { if (!App.dirty) pullFromCloud(true); });

    pullFromCloud(true);
    App.pollTimer = setInterval(function () { if (!App.dirty) pullFromCloud(true); }, Math.max(8, CLOUD_POLL_SECONDS) * 1000);
  }

  function showFatalError(err) {
    try { console.error(err); } catch (e) {}
    var box = document.createElement("div");
    box.style.cssText = "max-width:1180px;margin:20px auto;padding:16px 20px;background:#fdeceb;border:1.5px solid #e56659;border-radius:12px;font-family:monospace;font-size:13px;color:#7a221a;white-space:pre-wrap;";
    box.textContent = "Something went wrong loading the sheet:\n\n" + (err && err.message ? err.message : String(err)) +
      "\n\nTry a hard refresh (Ctrl/Cmd+Shift+R). If that doesn't fix it, redeploy the site fresh — this usually means an old cached file is out of sync with a new one.";
    var main = document.getElementById("sheet");
    if (main && main.parentNode) main.parentNode.insertBefore(box, main);
    else document.body.appendChild(box);
  }
})();
