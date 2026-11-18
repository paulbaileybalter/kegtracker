/**
 * BALTER BREWING — KEG ORDERING DESK
 * Site configuration.
 *
 * ---------------------------------------------------------------
 * MULTI-DEVICE SYNC (optional but recommended)
 * ---------------------------------------------------------------
 * By default this sheet only saves to the device/browser you're using
 * (via localStorage). To make it sync across phones, laptops, and the
 * warehouse tablet at once, wire up a free JSONBin.io bin:
 *
 *   1. Create a free account at https://jsonbin.io
 *   2. Create a NEW bin (any starting content, e.g. {}) — copy its Bin ID
 *   3. Copy your "X-Master-Key" from the JSONBin dashboard (API Keys)
 *   4. Paste both values below and set enabled: true
 *   5. Redeploy — every device that opens this site will now read/write
 *      the same bin, polling for changes every ~20 seconds and whenever
 *      the tab regains focus.
 *
 * IMPORTANT: this needs its OWN bin, separate from the Logistics Daily
 * Handover sheet (or any other sheet) — don't reuse a bin across tools,
 * or they'll overwrite each other's data.
 */
window.KEG_CONFIG = {
  cloudSync: {
    enabled: false,
    binId: "",
    apiKey: "",
    pollSeconds: 20        // how often other devices are checked for updates
  }
};
