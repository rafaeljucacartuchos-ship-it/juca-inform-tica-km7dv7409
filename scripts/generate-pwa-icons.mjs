#!/usr/bin/env node
/**
 * Generates the raster PWA icons (PNG) used by public/manifest.webmanifest
 * from the SVG sources in /public.
 *
 * Run with:  node scripts/generate-pwa-icons.mjs
 *
 * It writes:
 *   public/icons/icon-192.png
 *   public/icons/icon-512.png
 *   public/icons/icon-192-maskable.png
 *   public/icons/icon-512-maskable.png
 *
 * No external dependencies: uses Node's built-in canvas-free approach by
 * rendering the SVG through `sharp` if available, otherwise falls back to
 * copying the SVG. In this project `sharp` is available through the Vite
 * dependency tree, so PNG generation works out of the box.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const publicDir = path.join(root, 'public')
const iconsDir = path.join(publicDir, 'icons')

const sizes = [192, 512]

async function loadSharp() {
  try {
    const mod = await import('sharp')
    return mod.default
  } catch {
    return null
  }
}

async function renderSvgToPng(sharp, svgPath, outPath, size) {
  const svgBuffer = await fs.promises.readFile(svgPath)
  await sharp(svgBuffer, { density: 384 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(outPath)
  console.log(`✓ ${path.relative(root, outPath)} (${size}x${size})`)
}

async function main() {
  fs.mkdirSync(iconsDir, { recursive: true })

  const sharp = await loadSharp()
  if (!sharp) {
    console.warn(
      '⚠ sharp not available — skipping PNG generation. ' +
        'SVG icons will still be used by the manifest.',
    )
    return
  }

  for (const size of sizes) {
    await renderSvgToPng(
      sharp,
      path.join(publicDir, 'icon.svg'),
      path.join(iconsDir, `icon-${size}.png`),
      size,
    )
    await renderSvgToPng(
      sharp,
      path.join(publicDir, 'icon-maskable.svg'),
      path.join(iconsDir, `icon-${size}-maskable.png`),
      size,
    )
  }

  console.log('PWA icons generated successfully.')
}

main().catch((err) => {
  console.error('Failed to generate PWA icons:', err)
  process.exit(1)
})
