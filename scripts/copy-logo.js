import fs from 'node:fs'
import path from 'node:path'

const source = path.join(process.cwd(), 'src/assets/editedimage1786731852013-eff90.png')

const destinations = [
  'public/logo.png',
  'public/icon-192.png',
  'public/icon-512.png',
  'public/icon-192-maskable.png',
  'public/icon-512-maskable.png',
  'src/assets/logo.png',
]

destinations.forEach((dest) => {
  const destPath = path.join(process.cwd(), dest)
  fs.mkdirSync(path.dirname(destPath), { recursive: true })
  fs.copyFileSync(source, destPath)
  console.log(`Copied logo to ${dest}`)
})
