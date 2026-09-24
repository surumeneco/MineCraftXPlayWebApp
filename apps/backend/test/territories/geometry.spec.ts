import { describe, expect, it } from 'vitest'
import { area, centroid, pointInPolygon, polygonDistance, polygonsOverlapArea, replaceBoundarySegment, validateCoordinates } from '../../src/territory-geometry.js'

describe('territory geometry', () => {
  const square = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }, { x: 0, z: 10 }]
  it('uses shoelace area and polygon centroid', () => {
    expect(area(square)).toBe(100)
    expect(centroid(square)).toEqual({ x: 5, z: 5 })
  })
  it('includes the boundary in coordinate search', () => {
    expect(pointInPolygon({ x: 0, z: 5 }, square, true)).toBe(true)
    expect(pointInPolygon({ x: 0, z: 5 }, square, false)).toBe(false)
  })
  it('allows touching without treating it as positive-area overlap', () => {
    const touching = [{ x: 10, z: 0 }, { x: 20, z: 0 }, { x: 20, z: 10 }, { x: 10, z: 10 }]
    expect(polygonsOverlapArea(square, touching)).toBe(false)
    expect(polygonDistance(square, touching)).toBe(0)
  })
  it('detects overlap, containment and 32-block distance', () => {
    const overlap = [{ x: 5, z: 5 }, { x: 15, z: 5 }, { x: 15, z: 15 }, { x: 5, z: 15 }]
    const inside = [{ x: 2, z: 2 }, { x: 4, z: 2 }, { x: 4, z: 4 }, { x: 2, z: 4 }]
    const near = [{ x: 42, z: 0 }, { x: 50, z: 0 }, { x: 50, z: 8 }, { x: 42, z: 8 }]
    expect(polygonsOverlapArea(square, overlap)).toBe(true)
    expect(polygonDistance(square, inside)).toBe(0)
    expect(polygonDistance(square, near)).toBe(32)
  })
  it('rejects self-intersection and non-integer coordinates', () => {
    expect(() => validateCoordinates([{ x: 0, z: 0 }, { x: 10, z: 10 }, { x: 0, z: 10 }, { x: 10, z: 0 }])).toThrow()
    expect(() => validateCoordinates([{ x: 0, z: 0 }, { x: 3.5, z: 0 }, { x: 0, z: 3 }])).toThrow()
    expect(() => validateCoordinates([{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 5, z: 0 }, { x: 5, z: 10 }])).toThrow()
  })
  it('replaces only a contiguous boundary segment, including wrap-around', () => {
    expect(replaceBoundarySegment(square, { start: 0, end: 2, intermediate: [{ x: 12, z: 5 }] }))
      .toEqual([{ x: 0, z: 0 }, { x: 12, z: 5 }, { x: 10, z: 10 }, { x: 0, z: 10 }])
    expect(replaceBoundarySegment(square, { start: 3, end: 1, intermediate: [{ x: -5, z: 5 }] }))
      .toEqual([{ x: 10, z: 0 }, { x: 10, z: 10 }, { x: 0, z: 10 }, { x: -5, z: 5 }])
    expect(() => replaceBoundarySegment(square, { start: 0, end: 0, intermediate: [] })).toThrow()
  })
})
