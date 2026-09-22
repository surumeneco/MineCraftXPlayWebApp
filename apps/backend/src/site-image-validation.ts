import { validateStaticSvg } from './site-image-svg-validation.js'
export { validateStaticSvg } from './site-image-svg-validation.js'

// Site images do not have an application byte/pixel cap; physical infrastructure limits still apply.
export const RESOURCE_KEY = /^[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_-]*)+$/
function dimensions(w: number, h: number): void {
  if (!Number.isSafeInteger(w) || !Number.isSafeInteger(h) || w < 1 || h < 1) throw new Error('画像の解像度が不正です。')
}
function jpegDimensions(b: Buffer): [number, number] {
  let p = 2
  while (p + 4 < b.length) {
    if (b[p++] !== 0xff) break
    while (b[p] === 0xff) p++
    const marker = b[p++]
    if (marker === 0xda || marker === 0xd9) break
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue
    if (p + 2 > b.length) break
    const length = b.readUInt16BE(p)
    if (length < 2 || p + length > b.length) break
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) && length >= 7) return [b.readUInt16BE(p + 5), b.readUInt16BE(p + 3)]
    p += length
  }
  throw new Error('JPEGの画像サイズを判定できません。')
}
function stripJpegExif(b: Buffer): Buffer {
  const chunks: Buffer[] = [b.subarray(0, 2)]
  let p = 2
  while (p < b.length) {
    const start = p
    if (b[p++] !== 0xff) break
    while (b[p] === 0xff) p++
    const marker = b[p++]
    if (marker === 0xda || marker === 0xd9) { chunks.push(b.subarray(start)); return Buffer.concat(chunks) }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { chunks.push(b.subarray(start, p)); continue }
    if (p + 2 > b.length) break
    const length = b.readUInt16BE(p)
    if (length < 2 || p + length > b.length) break
    const end = p + length
    if (!(marker === 0xe1 && b.subarray(p + 2, p + 8).toString('ascii') === 'Exif\0\0')) chunks.push(b.subarray(start, end))
    p = end
  }
  throw new Error('JPEGの構造が不正です。')
}
function stripPngExif(b: Buffer): Buffer {
  const chunks: Buffer[] = [b.subarray(0, 8)]
  let p = 8, ended = false
  while (p + 12 <= b.length) {
    const length = b.readUInt32BE(p)
    const end = p + 12 + length
    if (end > b.length) break
    const type = b.toString('ascii', p + 4, p + 8)
    if (type !== 'eXIf') chunks.push(b.subarray(p, end))
    p = end
    if (type === 'IEND') { ended = true; break }
  }
  if (!ended || p !== b.length) throw new Error('PNGの構造が不正です。')
  return Buffer.concat(chunks)
}
function webpDimensions(b: Buffer): [number, number] {
  if (b.length < 30 || b.readUInt32LE(4) + 8 !== b.length) throw new Error('WebPの構造が不正です。')
  let p = 12, size: [number, number] | undefined
  while (p + 8 <= b.length) {
    const type = b.toString('ascii', p, p + 4), length = b.readUInt32LE(p + 4)
    const end = p + 8 + length
    if (end > b.length) throw new Error('WebPの構造が不正です。')
    if (type === 'EXIF') throw new Error('EXIF付きWebPはメタデータを除去してから登録してください。')
    if (type === 'VP8X' && length >= 10) {
      if (b[p + 8] & 0x08) throw new Error('EXIF付きWebPはメタデータを除去してから登録してください。')
      size = [1 + b.readUIntLE(p + 12, 3), 1 + b.readUIntLE(p + 15, 3)]
    }
    if (type === 'VP8 ' && length >= 10 && !size) size = [b.readUInt16LE(p + 14) & 0x3fff, b.readUInt16LE(p + 16) & 0x3fff]
    if (type === 'VP8L' && length >= 5 && !size && b[p + 8] === 0x2f) {
      const bits = b.readUInt32LE(p + 9)
      size = [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1]
    }
    p = end + (length % 2)
  }
  if (p !== b.length || !size) throw new Error('WebPの画像サイズを判定できません。')
  return size
}
export function decodeSiteImage(raw: unknown): { data: Buffer; mime: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('画像情報が不正です。')
  const value = raw as Record<string, unknown>
  let bytes: Buffer
  if (Buffer.isBuffer(value.file_bytes)) bytes = value.file_bytes
  else {
    const encoded = value.data_base64
    if (typeof encoded !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error('画像データが不正です。')
    bytes = Buffer.from(encoded, 'base64')
    if (bytes.toString('base64') !== encoded) throw new Error('画像データが不正です。')
  }
  if (!bytes.length) throw new Error('画像データが不正です。')
  let mime: string
  if (bytes.length >= 3 && bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
    mime = 'image/jpeg'
    const [w, h] = jpegDimensions(bytes); dimensions(w, h)
    bytes = stripJpegExif(bytes)
  } else if (bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    mime = 'image/png'
    dimensions(bytes.readUInt32BE(16), bytes.readUInt32BE(20))
    bytes = stripPngExif(bytes)
  } else if (bytes.length >= 16 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') {
    mime = 'image/webp'
    const [w, h] = webpDimensions(bytes); dimensions(w, h)
  } else {
    let svg: string
    try { svg = new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
    catch { throw new Error('画像形式が不正です。') }
    validateStaticSvg(svg)
    mime = 'image/svg+xml'
    bytes = Buffer.from(svg, 'utf8')
  }
  if (value.mime_type !== mime) throw new Error('画像形式とMIMEタイプが一致しません。')
  return { data: bytes, mime }
}
