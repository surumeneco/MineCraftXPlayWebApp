import { describe, expect, it } from 'vitest'
import { blueMapTerritoryUrl, territoryCoordinateError } from '../../app/utils/territory'

describe('territory coordinate drafts and local BlueMap', () => {
  it('rejects incomplete input without silently treating an empty field as zero', () => {
    expect(territoryCoordinateError([{ x: null, z: null }, { x: null, z: null }, { x: null, z: null }])).not.toBe('')
    expect(territoryCoordinateError([{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 0, z: 10 }])).toBe('')
  })
  it('builds map anchors against the configured local or public base', () => {
    const points = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 0, z: 10 }]
    expect(blueMapTerritoryUrl(points, 'http://localhost:8100/'))
      .toMatch(/^http:\/\/localhost:8100\/#world:/)
    expect(blueMapTerritoryUrl(points)).toMatch(/^\/bluemap\/#world:/)
    expect(blueMapTerritoryUrl(points, 'http://localhost:8100'))
      .toMatch(/^http:\/\/localhost:8100\/#world:/)
  })
})
