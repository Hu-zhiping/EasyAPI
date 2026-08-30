/**
 * 生成 EasyAPI 应用图标：256x256 圆角渐变底 + 白色闪电，输出 PNG 并封装为 ICO。
 * 仅用 Node 内置能力（无第三方依赖），运行：node scripts/gen-icon.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const SIZE = 256
const RADIUS = 52

const px = new Uint8Array(SIZE * SIZE * 4)

const lerp = (a, b, t) => Math.round(a + (b - a) * t)

function inRoundedRect(x, y) {
  const r = RADIUS
  const cx = Math.min(Math.max(x, r), SIZE - r)
  const cy = Math.min(Math.max(y, r), SIZE - r)
  const dx = x - cx
  const dy = y - cy
  return dx * dx + dy * dy <= r * r
}

function inPolygon(x, y, poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0]
    const yi = poly[i][1]
    const xj = poly[j][0]
    const yj = poly[j][1]
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

const BOLT = [
  [148, 22],
  [58, 142],
  [114, 142],
  [94, 234],
  [198, 114],
  [132, 114]
]

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const i = (y * SIZE + x) * 4
    if (!inRoundedRect(x, y)) continue
    const t = y / SIZE
    px[i] = lerp(255, 240, t)
    px[i + 1] = lerp(129, 77, t)
    px[i + 2] = lerp(82, 14, t)
    px[i + 3] = 255
    if (inPolygon(x + 0.5, y + 0.5, BOLT)) {
      px[i] = 255
      px[i + 1] = 255
      px[i + 2] = 255
    }
  }
}

const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePng() {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(SIZE, 0)
  ihdr.writeUInt32BE(SIZE, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1))
  for (let y = 0; y < SIZE; y++) {
    raw[y * (SIZE * 4 + 1)] = 0
    raw.set(px.subarray(y * SIZE * 4, (y + 1) * SIZE * 4), y * (SIZE * 4 + 1) + 1)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

function wrapIco(png) {
  const head = Buffer.alloc(6)
  head.writeUInt16LE(0, 0)
  head.writeUInt16LE(1, 2)
  head.writeUInt16LE(1, 4)
  const entry = Buffer.alloc(16)
  entry[0] = 0
  entry[1] = 0
  entry.writeUInt16LE(1, 4)
  entry.writeUInt16LE(32, 6)
  entry.writeUInt32LE(png.length, 8)
  entry.writeUInt32LE(22, 12)
  return Buffer.concat([head, entry, png])
}

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const dir = path.join(root, 'build')
fs.mkdirSync(dir, { recursive: true })
const png = encodePng()
fs.writeFileSync(path.join(dir, 'icon.png'), png)
const ico = wrapIco(png)
fs.writeFileSync(path.join(dir, 'icon.ico'), ico)
console.log(`[gen-icon] 已生成 build/icon.ico (${ico.length} bytes) 与 build/icon.png`)
