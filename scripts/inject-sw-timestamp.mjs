#!/usr/bin/env node
/**
 * Injects the current build timestamp into the Service Worker (`// BUILD:` line).
 *
 * Problem this solves
 * -------------------
 * `public/sw.js` ships with a fixed `// BUILD: __TIMESTAMP__` placeholder. If
 * the emitted `sw.js` is byte-for-byte identical between deploys, the browser
 * never sees a new Service Worker version, so the PWA update banner never
 * appears and field technicians stay stuck on the old cached code.
 *
 * This script rewrites the `// BUILD:` line with the current ISO timestamp so
 * the SW changes on every deploy. The browser then installs the new SW, which
 * enters the "waiting" state, which is exactly what `usePwaUpdate` detects to
 * show the banner.
 *
 * What it touches
 * ---------------
 * Only the single `// BUILD:` line is rewritten (regex: `/^\/\/ BUILD:.*$/m`).
 * The Service Worker logic itself (install, activate, fetch, cache, push,
 * message/skipWaiting) is never modified.
 *
 * Why a post-build script (and not a Vite plugin)
 * -----------------------------------------------
 * `vite.config.ts` is platform-managed and cannot be edited in this project,
 * so we cannot register a Rollup `generateBundle` plugin. A standalone Node
 * script invoked after `vite build` is the equivalent: it runs in the same
 * `npm run build` step and edits the already-emitted `dist/sw.js` in place.
 * The source `public/sw.js` is intentionally left untouched so it keeps the
 * `__TIMESTAMP__` placeholder (no git churn between builds); only the artifact
 * that actually ships gets a real timestamp.
 *
 * Usage
 * -----
 *   node scripts/inject-sw-timestamp.mjs            # production (dist/)
 *   node scripts/inject-sw-timestamp.mjs --dev      # development (dev-dist/)
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const isDev = process.argv.includes('--dev')
const outDir = isDev ? 'dev-dist' : 'dist'

const BUILD_TIMESTAMP = new Date().toISOString()

/** Replace the `// BUILD:` line with the current timestamp. No-op if absent. */
function injectTimestamp(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(`[sw-timestamp] not found, skipping: ${filePath}`)
    return false
  }
  const source = fs.readFileSync(filePath, 'utf8')
  const updated = source.replace(/^\/\/ BUILD:.*$/m, `// BUILD: ${BUILD_TIMESTAMP}`)
  if (updated === source) {
    // No `// BUILD:` line present — nothing to do (don't touch the file).
    console.warn(`[sw-timestamp] no // BUILD: marker in ${filePath}`)
    return false
  }
  fs.writeFileSync(filePath, updated, 'utf8')
  console.log(`[sw-timestamp] ${path.relative(root, filePath)} -> // BUILD: ${BUILD_TIMESTAMP}`)
  return true
}

// The emitted Service Worker in the build output (what gets deployed).
// The source public/sw.js is intentionally NOT modified — it keeps its
// `__TIMESTAMP__` placeholder; only the shipped artifact gets a real value.
const distSw = path.join(root, outDir, 'sw.js')

if (!injectTimestamp(distSw)) {
  console.warn('[sw-timestamp] no sw.js was updated.')
}

// --- index.html: data-app-version ------------------------------------------
// Injeta o MESMO timestamp do sw.js no atributo data-app-version do <html>. O
// app lê esse atributo em runtime (src/hooks/use-app-version.ts) e compara com
// a versão reportada pelo sw.js deployado (// BUILD:). Se divergirem, o
// index.html servido está stale (cacheado pelo SW antigo) e o app exibe o
// banner "App desatualizado — feche e abra novamente para atualizar".
const distIndex = path.join(root, outDir, 'index.html')

/** Replace the `data-app-version="__APP_VERSION__"` placeholder. No-op if absent. */
function injectAppVersion(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(`[sw-timestamp] not found, skipping: ${filePath}`)
    return false
  }
  const source = fs.readFileSync(filePath, 'utf8')
  const updated = source.replace(
    /data-app-version="__APP_VERSION__"/,
    `data-app-version="${BUILD_TIMESTAMP}"`,
  )
  if (updated === source) {
    console.warn(`[sw-timestamp] no __APP_VERSION__ marker in ${filePath}`)
    return false
  }
  fs.writeFileSync(filePath, updated, 'utf8')
  console.log(
    `[sw-timestamp] ${path.relative(root, filePath)} -> data-app-version="${BUILD_TIMESTAMP}"`,
  )
  return true
}

if (!injectAppVersion(distIndex)) {
  console.warn('[sw-timestamp] no index.html was updated.')
}
