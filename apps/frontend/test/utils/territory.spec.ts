import { describe, expect, it } from 'vitest'
import { blueMapTerritoryUrl, territoryCoordinateError, parseBlueMapCoordinates, formatArea } from '../../app/utils/territory'

describe('territory coordinate drafts and local BlueMap', () => {
  it('rejects incomplete input without silently treating an empty field as zero', () => {
    expect(territoryCoordinateError([{ x: null, z: null }, { x: null, z: null }, { x: null, z: null }])).not.toBe('')
    expect(territoryCoordinateError([{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 0, z: 10 }])).toBe('')
  })
  it('parses only complete safe signed BlueMap X/Z pairs or X/Y/Z triples', () => {
    expect(parseBlueMapCoordinates('12 -34')).toEqual({ x: 12, z: -34 })
    expect(parseBlueMapCoordinates('-12 255 +34')).toBeNull()
    expect(parseBlueMapCoordinates(' -12 255 34 ')).toEqual({ x: -12, z: 34 })
    expect(parseBlueMapCoordinates('-12\t-64\n34')).toEqual({ x: -12, z: 34 })
    expect(parseBlueMapCoordinates('0 0')).toEqual({ x: 0, z: 0 })
    for (const input of ['', '12', '12 ', '12 A', '12 34 56 78', '12.1 34', '9007199254740992 0', '12 9007199254740992 34']) {
      expect(parseBlueMapCoordinates(input)).toBeNull()
    }
  })
  it('builds map anchors against the configured local or public base', () => {
    const points = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 0, z: 10 }]
    expect(blueMapTerritoryUrl(points, 'http://localhost:8100/'))
      .toMatch(/^http:\/\/localhost:8100\/#world:/)
    expect(blueMapTerritoryUrl(points)).toMatch(/^\/bluemap\/#world:/)
    expect(blueMapTerritoryUrl(points, 'http://localhost:8100'))
      .toMatch(/^http:\/\/localhost:8100\/#world:/)
    const publicUrl = blueMapTerritoryUrl(points)\n    expect(publicUrl).toBe('/bluemap/#world:3:250:3:200:0:0:0:0:perspective')\n    expect(publicUrl.split('#')[1]?.split(':')).toHaveLength(10)
  })
  it('formats area with thousands separators while keeping half-block precision', () => {
    expect(formatArea(100000)).toBe('100,000')
    expect(formatArea(100000.5)).toBe('100,000.5')
    expect(formatArea(-12345.5)).toBe('-12,345.5')
  })

})
