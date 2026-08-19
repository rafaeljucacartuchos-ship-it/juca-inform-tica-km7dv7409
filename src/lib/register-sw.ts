/**
 * Registers the Service Worker for the JUCA Informática PWA.
 *
 * Centralised so every registration site uses the same options. The key option
 * is `updateViaCache: 'none'`: the browser must always fetch `sw.js` from the
 * network when checking for updates, never the HTTP cache. Without this, a
 * stale cached copy of `sw.js` can mask a newly deployed Service Worker (the
 * browser would keep comparing against the old bytes and never see the new
 * `// BUILD:` timestamp), which is exactly the "technicians stuck on the old
 * version forever" problem this project hit.
 *
 * This complements `scripts/inject-sw-timestamp.mjs`, which rewrites the
 * `// BUILD:` line in the emitted `sw.js` on every build so the SW body is
 * byte-for-byte different between deploys — that difference is what the
 * browser's update check detects to install the new SW.
 */

/**
 * Registers `/sw.js` with update-friendly options. Safe to call repeatedly —
 * calling `register()` with the same URL/scope is a no-op per the spec.
 * Resolves to the registration, or `null` if SW is unsupported or registration
 * failed (never throws — the PWA is an enhancement, not a requirement).
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null
  }
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      // Always consult the network for the SW script on update checks, never
      // the HTTP cache. Critical for deployed updates to reach installed PWAs.
      updateViaCache: 'none',
    })
    return registration
  } catch {
    // Registration failures are non-fatal: the app still works online.
    return null
  }
}
