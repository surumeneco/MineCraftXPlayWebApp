// Deliberately dependency-free: only a restricted, inert subset of SVG is accepted.
export const SITE_IMAGE_MAX_BYTES = 5 * 1024 * 1024
const MAX_EDGE = 4096
const MAX_PIXELS = 16_000_000
export const RESOURCE_KEY = /^[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_-]*)+$/

function dimensions(width: number, height: number): void {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 ||
      width > MAX_EDGE || height > MAX_EDGE || width * height > MAX_PIXELS) {
    throw new Error('画像の解像度は長辺4096px・1600万画素以内にしてください。')
  }
}

const allowedTags = new Set([
  'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
  'defs', 'linearGradient', 'radialGradient', 'stop', 'clipPath',
])
const allowedAttrs = new Set([
  'xmlns', 'version', 'viewBox', 'width', 'height', 'preserveAspectRatio', 'id',
  'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points',
  'transform', 'fill', 'fill-rule', 'fill-opacity', 'stroke', 'stroke-width',
  'stroke-opacity', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit',
  'stroke-dasharray', 'stroke-dashoffset', 'opacity', 'vector-effect', 'offset',
  'gradientUnits', 'gradientTransform', 'spreadMethod', 'clip-path',
])
const numeric = /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i

/** Reject instead of trying to repair active XML, attributes, entities or foreign namespaces. */
export function validateStaticSvg(source: string): void {
  let text = source.replace(/^\uFEFF/, '').replace(/^<\?xml\s+version=["']1\.0["']\s+encoding=["']UTF-8["']\s*\?>\s*/i, '')
  if (/[&]|<!|<\?|[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) throw new Error('SVGに使用できないXML構文があります。')
  const tag = /<(\/?)([A-Za-z][A-Za-z0-9]*)([^<>]*?)>/g
  const stack: string[] = []
  let previous = 0, count = 0, hasRoot = false, viewBox: string | undefined
  for (let match = tag.exec(text); match; match = tag.exec(text)) {
    if (text.slice(previous, match.index).trim()) throw new Error('SVGに不正なテキストがあります。')
    previous = tag.lastIndex
    const [, closing, name, raw] = match
    if (!allowedTags.has(name)) throw new Error('SVGに許可されていない要素があります。')
    if (++count > 10000) throw new Error('SVGの要素数が多すぎます。')
    if (closing) {
      if (raw.trim() || stack.pop() !== name) throw new Error('SVGのタグ構造が不正です。')
      continue
    }
    if (!hasRoot) {
      if (name !== 'svg') throw new Error('SVGのルート要素が不正です。')
      hasRoot = true
    } else if (!stack.length) throw new Error('SVGのルート要素は1つだけ指定してください。')
    const selfClosing = /\/\s*$/.test(raw)
    const attrs = selfClosing ? raw.replace(/\/\s*$/, '') : raw
    const attribute = /\s+([A-Za-z][A-Za-z0-9-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
    const names = new Set<string>()
    let end = 0
    for (let attr = attribute.exec(attrs); attr; attr = attribute.exec(attrs)) {
      if (attrs.slice(end, attr.index).trim()) throw new Error('SVGの属性構文が不正です。')
      end = attribute.lastIndex
      const key = attr[1], value = attr[2] ?? attr[3]
      if (!allowedAttrs.has(key) || names.has(key) || /[&<>\\]/.test(value) || /[\u0000-\u001f]/.test(value)) {
        throw new Error('SVGに許可されていない属性があります。')
      }
      names.add(key)
      if (key === 'xmlns' && (name !== 'svg' || value !== 'http://www.w3.org/2000/svg')) throw new Error('SVGの名前空間が不正です。')
      if (/url\s*\(/i.test(value) && !((key === 'fill' || key === 'stroke' || key === 'clip-path') && /^url\(#[A-Za-z_][\w.-]*\)$/.test(value))) {
        throw new Error('SVGの外部参照は許可されません。')
      }
      if ((key === 'fill' || key === 'stroke' || key === 'clip-path') && /url/i.test(value) && !/^url\(#[A-Za-z_][\w.-]*\)$/.test(value)) {
        throw new Error('SVGの参照先が不正です。')
      }
      if (name === 'svg' && key === 'viewBox') viewBox = value
      if (name === 'svg' && (key === 'width' || key === 'height') && numeric.test(value) && Number(value) > MAX_EDGE) {
        throw new Error('SVGの表示サイズが大きすぎます。')
      }
    }
    if (attrs.slice(end).trim()) throw new Error('SVGの属性構文が不正です。')
    if (!selfClosing) stack.push(name)
  }
  if (!hasRoot || stack.length || text.slice(previous).trim() || !viewBox) throw new Error('SVGのタグまたはviewBoxが不正です。')
  const values = viewBox.trim().split(/[\s,]+/)
  if (values.length !== 4 || values.some(v => !numeric.test(v))) throw new Error('SVGのviewBoxが不正です。')
  const [, , width, height] = values.map(Number)
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 ||
      width > MAX_EDGE || height > MAX_EDGE || width * height > MAX_PIXELS) {
    throw new Error('SVGのviewBoxが許容範囲外です。')
  }
}

function jpegDimensions(bytes: Buffer): [number, number] {
  let p = 2
  while (p + 4 < bytes.length) {
    if (bytes[p++] !== 0xff) break
    while (bytes[p] === 0xff) p++
    const marker = bytes[p++]
    if (marker === 0xda || marker === 0xd9) break
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue
    if (p + 2 > bytes.length) break
    const length = bytes.readUInt16BE(p)
    if (length < 2 || p + length > bytes.length) break
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) && length >= 7) {
      return [bytes.readUInt16BE(p + 5), bytes.readUInt16BE(p + 3)]
    }
    p += length
  }
  throw new Error('JPEGの画像サイズを判定できません。')
}

function stripJpegExif(bytes: Buffer): Buffer {
  const chunks: Buffer[] = [bytes.subarray(0, 2)]
  let p = 2
  while (p < bytes.length) {
    const start = p
    if (bytes[p++] !== 0xff) break
    while (bytes[p] === 0xff) p++
    const marker = bytes[p++]
    if (marker === 0xda || marker === 0xd9) { chunks.push(bytes.subarray(start)); return Buffer.concat(chunks) }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { chunks.push(bytes.subarray(start, p)); continue }
    if (p + 2 > bytes.length) break
    const length = bytes.readUInt16BE(p)
    if (length < 2 || p + length > bytes.length) break
    const end = p + length
    if (!(marker === 0xe1 && bytes.subarray(p + 2, p + 8).toString('ascii') === 'Exif\0\0')) chunks.push(bytes.subarray(start, end))
    p = end
  }
  throw new Error('JPEGの構造が不正です。')
}

function stripPngExif(bytes: Buffer): Buffer {
  const chunks: Buffer[] = [bytes.subarray(0, 8)]
  let p = 8, ended = false
  while (p + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(p)
    const end = p + 12 + length
    if (end > bytes.length) break
    const type = bytes.toString('ascii', p + 4, p + 8)
    if (type !== 'eXIf') chunks.push(bytes.subarray(p, end))
    p = end
    if (type === 'IEND') { ended = true; break }
  }
  if (!ended || p !== bytes.length) throw new Error('PNGの構造が不正です。')
  return Buffer.concat(chunks)
}

function webpDimensions(bytes: Buffer): [number, number] {
  if (bytes.length < 30 || bytes.readUInt32LE(4) + 8 !== bytes.length) throw new Error('WebPの構造が不正です。')
  let p = 12, size: [number, number] | undefined
  while (p + 8 <= bytes.length) {
    const type = bytes.toString('ascii', p, p + 4), length = bytes.readUInt32LE(p + 4)
    const end = p + 8 + length
    if (end > bytes.length) throw new Error('WebPの構造が不正です。')
    if (type === 'EXIF') throw new Error('EXIF付きWebPはメタデータを除去してから登録してください。')
    if (type === 'VP8X' && length >= 10) {
      if (bytes[p + 8] & 0x08) throw new Error('EXIF付きWebPはメタデータを除去してから登録してください。')
      size = [1 + bytes.readUIntLE(p + 12, 3), 1 + bytes.readUIntLE(p + 15, 3)]
    }
    if (type === 'VP8 ' && length >= 10 && !size) size = [bytes.readUInt16LE(p + 14) & 0x3fff, bytes.readUInt16LE(p + 16) & 0x3fff]
    if (type === 'VP8L' && length >= 5 && !size && bytes[p + 8] === 0x2f) {
      const bits = bytes.readUInt32LE(p + 9)
      size = [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1]
    }
    p = end + (length % 2)
  }
  if (p !== bytes.length || !size) throw new Error('WebPの画像サイズを判定できません。')
  return size
}

export function decodeSiteImage(raw: unknown): { data: Buffer; mime: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('画像情報が不正です。')
  const value = raw as Record<string, unknown>
  const encoded = value.data_base64
  if (typeof encoded !== 'string' || encoded.length > Math.ceil(SITE_IMAGE_MAX_BYTES / 3) * 4 + 4 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error('画像データまたは容量が不正です。')
  let bytes: Buffer = Buffer.from(encoded, 'base64')
  if (!bytes.length || bytes.length > SITE_IMAGE_MAX_BYTES || bytes.toString('base64') !== encoded) throw new Error('画像データまたは容量が不正です。')
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
