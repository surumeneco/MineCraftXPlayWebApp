import { BadRequestException } from '@nestjs/common'

export type Point = { x: number; z: number }
const EPS = 1e-9

function cross(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)
}

export function pointOnSegment(p: Point, a: Point, b: Point): boolean {
  if (Math.abs(cross(a, b, p)) > EPS) return false
  return p.x >= Math.min(a.x, b.x) - EPS && p.x <= Math.max(a.x, b.x) + EPS
    && p.z >= Math.min(a.z, b.z) - EPS && p.z <= Math.max(a.z, b.z) + EPS
}

function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const c1 = cross(a, b, c), c2 = cross(a, b, d), c3 = cross(c, d, a), c4 = cross(c, d, b)
  if (((c1 > EPS && c2 < -EPS) || (c1 < -EPS && c2 > EPS))
    && ((c3 > EPS && c4 < -EPS) || (c3 < -EPS && c4 > EPS))) return true
  return (Math.abs(c1) <= EPS && pointOnSegment(c, a, b))
    || (Math.abs(c2) <= EPS && pointOnSegment(d, a, b))
    || (Math.abs(c3) <= EPS && pointOnSegment(a, c, d))
    || (Math.abs(c4) <= EPS && pointOnSegment(b, c, d))
}

function properIntersection(a: Point, b: Point, c: Point, d: Point): boolean {
  const c1 = cross(a, b, c), c2 = cross(a, b, d), c3 = cross(c, d, a), c4 = cross(c, d, b)
  return ((c1 > EPS && c2 < -EPS) || (c1 < -EPS && c2 > EPS))
    && ((c3 > EPS && c4 < -EPS) || (c3 < -EPS && c4 > EPS))
}

export function signedArea(points: Point[]): number {
  let twice = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length]
    twice += a.x * b.z - b.x * a.z
  }
  return twice / 2
}

export function area(points: Point[]): number {
  return Math.abs(signedArea(points))
}

export function centroid(points: Point[]): Point {
  const signed = signedArea(points)
  if (Math.abs(signed) <= EPS) throw new BadRequestException('Territory polygon area must be greater than zero')
  let x = 0, z = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length]
    const factor = a.x * b.z - b.x * a.z
    x += (a.x + b.x) * factor
    z += (a.z + b.z) * factor
  }
  const divisor = 6 * signed
  return { x: x / divisor, z: z / divisor }
}

export function pointInPolygon(point: Point, polygon: Point[], includeBoundary = true): boolean {
  for (let i = 0; i < polygon.length; i++) {
    if (pointOnSegment(point, polygon[i], polygon[(i + 1) % polygon.length])) return includeBoundary
  }
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j]
    const crosses = (a.z > point.z) !== (b.z > point.z)
      && point.x < (b.x - a.x) * (point.z - a.z) / (b.z - a.z) + a.x
    if (crosses) inside = !inside
  }
  return inside
}

export function validateCoordinates(value: unknown): Point[] {
  if (!Array.isArray(value) || value.length < 3) throw new BadRequestException('At least three territory coordinates are required')
  const points = value.map((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new BadRequestException('Invalid territory coordinate')
    const { x, z } = raw as Record<string, unknown>
    if (!Number.isSafeInteger(x) || !Number.isSafeInteger(z)) throw new BadRequestException('Territory coordinates must be integers')
    return { x: x as number, z: z as number }
  })
  const unique = new Set(points.map(point => `${point.x},${point.z}`))
  if (unique.size !== points.length) throw new BadRequestException('Territory coordinates must not contain duplicate vertices')
  if (area(points) <= EPS) throw new BadRequestException('Territory polygon area must be greater than zero')
  for (let i = 0; i < points.length; i++) {
    const previous = points[(i - 1 + points.length) % points.length]
    const current = points[i]
    const next = points[(i + 1) % points.length]
    const backtrack = (previous.x - current.x) * (next.x - current.x)
      + (previous.z - current.z) * (next.z - current.z)
    if (Math.abs(cross(previous, current, next)) <= EPS && backtrack > EPS) {
      throw new BadRequestException('Territory polygon must not backtrack along an edge')
    }
  }
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length]
    for (let j = i + 1; j < points.length; j++) {
      const adjacent = j === i || j === (i + 1) % points.length || i === (j + 1) % points.length
      if (adjacent) continue
      if (segmentsIntersect(a, b, points[j], points[(j + 1) % points.length])) {
        throw new BadRequestException('Territory polygon must not self-intersect')
      }
    }
  }
  return points
}

function inwardSamples(polygon: Point[]): Point[] {
  const orientation = Math.sign(signedArea(polygon))
  const samples: Point[] = []
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length]
    const dx = b.x - a.x, dz = b.z - a.z
    const length = Math.hypot(dx, dz)
    if (length <= EPS) continue
    const scale = 1e-7
    const nx = orientation > 0 ? -dz / length : dz / length
    const nz = orientation > 0 ? dx / length : -dx / length
    samples.push({ x: (a.x + b.x) / 2 + nx * scale, z: (a.z + b.z) / 2 + nz * scale })
  }
  return samples
}

export function polygonsOverlapArea(a: Point[], b: Point[]): boolean {
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) {
    if (properIntersection(a[i], a[(i + 1) % a.length], b[j], b[(j + 1) % b.length])) return true
  }
  if (a.some(point => pointInPolygon(point, b, false)) || b.some(point => pointInPolygon(point, a, false))) return true
  return inwardSamples(a).some(point => pointInPolygon(point, b, false))
    || inwardSamples(b).some(point => pointInPolygon(point, a, false))
}

function pointSegmentDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dz = b.z - a.z
  const length2 = dx * dx + dz * dz
  if (length2 <= EPS) return Math.hypot(p.x - a.x, p.z - a.z)
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / length2))
  return Math.hypot(p.x - (a.x + t * dx), p.z - (a.z + t * dz))
}

export function polygonDistance(a: Point[], b: Point[]): number {
  if (polygonsOverlapArea(a, b)) return 0
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) {
    if (segmentsIntersect(a[i], a[(i + 1) % a.length], b[j], b[(j + 1) % b.length])) return 0
  }
  let best = Number.POSITIVE_INFINITY
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) {
    const aa = a[i], ab = a[(i + 1) % a.length], ba = b[j], bb = b[(j + 1) % b.length]
    best = Math.min(best, pointSegmentDistance(aa, ba, bb), pointSegmentDistance(ab, ba, bb),
      pointSegmentDistance(ba, aa, ab), pointSegmentDistance(bb, aa, ab))
  }
  return best
}

export function replaceBoundarySegment(source: Point[], value: unknown): Point[] {
  if (value === undefined || value === null) return source.map(point => ({ ...point }))
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException('Invalid territory boundary replacement')
  }
  const raw = value as Record<string, unknown>
  const start = raw.start, end = raw.end
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
    throw new BadRequestException('Territory boundary replacement indexes must be integers')
  }
  const startIndex = start as number, endIndex = end as number
  if (startIndex < 0 || endIndex < 0 || startIndex >= source.length || endIndex >= source.length || startIndex === endIndex) {
    throw new BadRequestException('Invalid territory boundary replacement range')
  }
  const selectedCount = ((endIndex - startIndex + source.length) % source.length) + 1
  if (selectedCount >= source.length) {
    throw new BadRequestException('Territory boundary replacement must keep existing vertices')
  }
  if (!Array.isArray(raw.intermediate)) {
    throw new BadRequestException('Territory boundary replacement coordinates must be an array')
  }
  const intermediate = raw.intermediate.map((point) => {
    if (!point || typeof point !== 'object' || Array.isArray(point)) {
      throw new BadRequestException('Invalid territory coordinate')
    }
    const { x, z } = point as Record<string, unknown>
    if (!Number.isSafeInteger(x) || !Number.isSafeInteger(z)) {
      throw new BadRequestException('Territory coordinates must be integers')
    }
    return { x: x as number, z: z as number }
  })
  const candidate = startIndex < endIndex
    ? [...source.slice(0, startIndex + 1), ...intermediate, ...source.slice(endIndex)]
    : [...source.slice(endIndex, startIndex + 1), ...intermediate]
  return validateCoordinates(candidate)
}
