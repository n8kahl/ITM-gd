#!/usr/bin/env node

import path from 'node:path'
import { mkdir } from 'node:fs/promises'
import sharp from 'sharp'

const ROOT = process.cwd()
const PUBLIC_DIR = path.join(ROOT, 'public')
const SOURCE_LOGO = path.join(PUBLIC_DIR, 'hero-logo.png')
const ICON_DIR = path.join(PUBLIC_DIR, 'icons')
const SPLASH_DIR = path.join(PUBLIC_DIR, 'splash')
const APPLE_TOUCH_ICON = path.join(PUBLIC_DIR, 'apple-touch-icon.png')
const BACKGROUND = '#0a0a0b'

const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512]
const SPLASH_SIZES = [
  [640, 1136],
  [750, 1334],
  [828, 1792],
  [1125, 2436],
  [1170, 2532],
  [1179, 2556],
  [1242, 2208],
  [1242, 2688],
  [1284, 2778],
  [1290, 2796],
  [1320, 2868],
  [1536, 2048],
  [1620, 2160],
  [1640, 2360],
  [1668, 2224],
  [1668, 2388],
  [2048, 2732],
]

async function renderSquareIcon(outputPath, size, logoScale) {
  const logoMax = Math.max(1, Math.round(size * logoScale))
  const logo = await sharp(SOURCE_LOGO)
    .resize({
      width: logoMax,
      height: logoMax,
      fit: 'inside',
      withoutEnlargement: false,
    })
    .png()
    .toBuffer()

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BACKGROUND,
    },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(outputPath)
}

async function renderSplash(outputPath, width, height) {
  const logoMaxWidth = Math.max(1, Math.round(Math.min(width, height) * 0.68))
  const logoMaxHeight = Math.max(1, Math.round(height * 0.24))

  const logo = await sharp(SOURCE_LOGO)
    .resize({
      width: logoMaxWidth,
      height: logoMaxHeight,
      fit: 'inside',
      withoutEnlargement: false,
    })
    .png()
    .toBuffer()

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: BACKGROUND,
    },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(outputPath)
}

async function main() {
  await mkdir(ICON_DIR, { recursive: true })
  await mkdir(SPLASH_DIR, { recursive: true })

  for (const size of ICON_SIZES) {
    await renderSquareIcon(path.join(ICON_DIR, `icon-${size}x${size}.png`), size, 0.72)
    await renderSquareIcon(path.join(ICON_DIR, `maskable-icon-${size}x${size}.png`), size, 0.58)
  }

  await renderSquareIcon(APPLE_TOUCH_ICON, 180, 0.72)

  for (const [width, height] of SPLASH_SIZES) {
    await renderSplash(path.join(SPLASH_DIR, `apple-splash-${width}x${height}.png`), width, height)
  }
}

await main()

