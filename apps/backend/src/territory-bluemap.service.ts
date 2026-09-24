import { Injectable } from '@nestjs/common'
import { AccountColorService, type MapColor } from './account-color.service.js'
import { Database } from './database.js'
import { centroid, type Point } from './territory-geometry.js'

const special = {
  shared_area: { name: '共同建築エリア', color: { r: 0, g: 255, b: 255 } },
  protected_area: { name: '保護区', color: { r: 255, g: 0, b: 0 } },
  administration: { name: '運営', color: { r: 0, g: 79, b: 255 } },
} as const

type AppData = { id: string; application_type: 'new' | 'edit'; name: string; coordinates: Point[] } | null
type MarkerRow = {
  id: string
  owner_type: 'account' | keyof typeof special
  owner_account_id: string | null
  owner_account_name: string | null
  approved_application: AppData
  pending_application: AppData
}

const q = (value: string) => JSON.stringify(value)
const color = (value: MapColor, alpha: number) =>
  `{ r: ${value.r}, g: ${value.g}, b: ${value.b}, a: ${alpha} }`

@Injectable()
export class TerritoryBlueMapService {
  constructor(private readonly database: Database, private readonly colors: AccountColorService) {}

  async render(): Promise<string> {
    const rows = await this.database.sql`
      SELECT t.id,t.owner_type,t.owner_account_id,oa.name AS owner_account_name,
        (SELECT json_build_object('id',a.id,'application_type',a.application_type,'name',a.name,'coordinates',a.coordinates)
          FROM territory_applications a WHERE a.territory_id=t.id AND a.status='approved'
          ORDER BY a.decided_at DESC NULLS LAST,a.submitted_at DESC,a.id DESC LIMIT 1) AS approved_application,
        (SELECT json_build_object('id',a.id,'application_type',a.application_type,'name',a.name,'coordinates',a.coordinates)
          FROM territory_applications a WHERE a.territory_id=t.id AND a.status='pending'
          ORDER BY a.submitted_at DESC,a.id DESC LIMIT 1) AS pending_application
      FROM territories t LEFT JOIN accounts oa ON oa.id=t.owner_account_id
      WHERE t.status IN ('pending','approved') ORDER BY t.first_applied_at,t.id`
    const groups = new Map<string, string[]>()
    for (const key of ['public-area', 'Reserve', 'Administration', 'Personal']) groups.set(key, [])

    for (const row of rows as unknown as MarkerRow[]) {
      const owner = row.owner_type === 'account'
        ? { name: row.owner_account_name ?? '不明', color: await this.colors.ensure(row.owner_account_id) }
        : special[row.owner_type]
      const group = row.owner_type === 'shared_area' ? 'public-area'
        : row.owner_type === 'protected_area' ? 'Reserve'
        : row.owner_type === 'administration' ? 'Administration' : 'Personal'
      if (row.approved_application) {
        groups.get(group)!.push(this.marker(`${row.id}-approved`, owner.name, row.approved_application, owner.color, false))
      }
      if (row.pending_application) {
        if (row.pending_application.application_type === 'edit' && row.approved_application) {
          groups.get(group)!.push(...this.changedBoundaryMarkers(row.id, owner.name, row.approved_application, row.pending_application))
        } else {
          groups.get(group)!.push(this.marker(`${row.id}-pending`, owner.name, row.pending_application, { r: 0, g: 0, b: 0 }, true))
        }
      }
    }

    const definitions = [
      ['public-area', '共同建築エリア', 0],
      ['Reserve', '保護区', 1],
      ['Administration', '運営', 2],
      ['Personal', '個人領地', 3],
    ] as const
    return definitions.map(([key, label, sorting]) =>
      `${q(key)}: {\n  label: ${q(label)}\n  togglable: true\n  default-hidden: false\n  sorting: ${sorting}\n  markers: {\n${groups.get(key)!.join('\n')}\n  }\n}`
    ).join('\n\n') + '\n'
  }

  private edgeKey(a: Point, b: Point): string {
    const left = `${a.x},${a.z}`, right = `${b.x},${b.z}`
    return left < right ? `${left}|${right}` : `${right}|${left}`
  }

  private changedBoundaryMarkers(id: string, ownerName: string, approved: NonNullable<AppData>, pending: NonNullable<AppData>): string[] {
    const approvedEdges = new Set(approved.coordinates.map((point, index) =>
      this.edgeKey(point, approved.coordinates[(index + 1) % approved.coordinates.length])))
    const label = `${ownerName} - ${pending.name} (未承認)`
    const result: string[] = []
    for (let index = 0; index < pending.coordinates.length; index++) {
      const a = pending.coordinates[index], b = pending.coordinates[(index + 1) % pending.coordinates.length]
      if (approvedEdges.has(this.edgeKey(a, b))) continue
      result.push(`    ${q(`${id}-pending-edge-${index}`)}: {\n      type: "line"\n      label: ${q(label)}\n      detail: ${q(label)}\n      listed: false\n      position: { x: ${Math.round((a.x + b.x) / 2)}, y: 250, z: ${Math.round((a.z + b.z) / 2)} }\n      line-width: 5\n      line-color: ${color({ r: 0, g: 0, b: 0 }, 1)}\n      line: [\n        { x: ${a.x}, y: 250, z: ${a.z} },\n        { x: ${b.x}, y: 250, z: ${b.z} }\n      ]\n    }`)
    }
    return result
  }

  private marker(id: string, ownerName: string, app: NonNullable<AppData>, markerColor: MapColor, pending: boolean): string {
    const center = centroid(app.coordinates)
    const label = `${ownerName} - ${app.name}${pending ? ' (未承認)' : ''}`
    const shape = app.coordinates.map(point => `      { x: ${point.x}, z: ${point.z} }`).join(',\n')
    return `    ${q(id)}: {\n      type: "shape"\n      label: ${q(label)}\n      detail: ${q(label)}\n      position: { x: ${Math.round(center.x)}, y: 250, z: ${Math.round(center.z)} }\n      shape-y: 250\n      line-width: 5\n      line-color: ${color(markerColor, 1)}\n      fill-color: ${color(markerColor, 0.2)}\n      shape: [\n${shape}\n      ]\n    }`
  }
}
