// Only an inert subset of SVG is accepted; scripts, styles and external resources are forbidden.
const tags = new Set([
  'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
  'defs', 'linearGradient', 'radialGradient', 'stop', 'clipPath',
])
const attrs = new Set([
  'xmlns', 'version', 'viewBox', 'width', 'height', 'preserveAspectRatio', 'id',
  'x', 'y', 'x1', 'x2', 'y1', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points',
  'transform', 'fill', 'fill-rule', 'fill-opacity', 'stroke', 'stroke-width',
  'stroke-opacity', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit',
  'stroke-dasharray', 'stroke-dashoffset', 'opacity', 'vector-effect', 'offset',
  'gradientUnits', 'gradientTransform', 'spreadMethod', 'clip-path',
])
const numeric = /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i

export function validateStaticSvg(source: string): void {
  const text = source.replace(/^\uFEFF/, '').replace(/^<\?xml\s+version=["']1\.0["']\s+encoding=["']UTF-8["']\s*\?>\s*/i, '')
  if (/[&]|<!|<\?|[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) throw new Error('SVGに使用できないXML構文があります。')
  const tag = /<(\/?)([A-Za-z][A-Za-z0-9]*)([^<>]*?)>/g
  const stack: string[] = []
  let previous = 0, count = 0, hasRoot = false, viewBox: string | undefined
  for (let match = tag.exec(text); match; match = tag.exec(text)) {
    if (text.slice(previous, match.index).trim()) throw new Error('SVGに不正なテキストがあります。')
    previous = tag.lastIndex
    const [, closing, name, raw] = match
    if (!tags.has(name)) throw new Error('SVGに許可されていない要素があります。')
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
    const attributes = selfClosing ? raw.replace(/\/\s*$/, '') : raw
    const attribute = /\s+([A-Za-z][A-Za-z0-9-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
    const names = new Set<string>()
    let end = 0
    for (let attr = attribute.exec(attributes); attr; attr = attribute.exec(attributes)) {
      if (attributes.slice(end, attr.index).trim()) throw new Error('SVGの属性構文が不正です。')
      end = attribute.lastIndex
      const key = attr[1], value = attr[2] ?? attr[3]
      if (!attrs.has(key) || names.has(key) || /[&<>\\]/.test(value) || /[\u0000-\u001f]/.test(value)) {
        throw new Error('SVGに許可されていない属性があります。')
      }
      names.add(key)
      if (key === 'xmlns' && (name !== 'svg' || value !== 'http://www.w3.org/2000/svg')) throw new Error('SVGの名前空間が不正です。')
      if (/url\s*\(/i.test(value) && !((key === 'fill' || key === 'stroke' || key === 'clip-path') && /^url\(#[A-Za-z_][\w.-]*\)$/.test(value))) throw new Error('SVGの外部参照は許可されません。')
      if ((key === 'fill' || key === 'stroke' || key === 'clip-path') && /url/i.test(value) && !/^url\(#[A-Za-z_][\w.-]*\)$/.test(value)) throw new Error('SVGの参照先が不正です。')
      if (name === 'svg' && key === 'viewBox') viewBox = value
      if (name === 'svg' && (key === 'width' || key === 'height') && numeric.test(value) && !Number.isFinite(Number(value))) throw new Error('SVGの表示サイズが不正です。')
    }
    if (attributes.slice(end).trim()) throw new Error('SVGの属性構文が不正です。')
    if (!selfClosing) stack.push(name)
  }
  if (!hasRoot || stack.length || text.slice(previous).trim() || !viewBox) throw new Error('SVGのタグまたはviewBoxが不正です。')
  const values = viewBox.trim().split(/[\s,]+/)
  if (values.length !== 4 || values.some(value => !numeric.test(value))) throw new Error('SVGのviewBoxが不正です。')
  const [, , width, height] = values.map(Number)
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error('SVGのviewBoxが不正です。')
}
