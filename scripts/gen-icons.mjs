import sharp from 'sharp'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))
const root  = join(__dir, '..')

// Purple background + centered lightning bolt SVG
function makeIconSvg(size) {
  const pad  = Math.round(size * 0.18)
  const inner = size - pad * 2
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.22)}" fill="#7C3AED"/>
  <image href="data:image/svg+xml;base64,${readFileSync(join(root, 'public/favicon.svg')).toString('base64')}"
         x="${pad}" y="${pad}" width="${inner}" height="${inner}"/>
</svg>`
}

for (const size of [192, 512]) {
  await sharp(Buffer.from(makeIconSvg(size)))
    .png()
    .toFile(join(root, `public/icons/icon-${size}.png`))
  console.log(`icon-${size}.png done`)
}
