export type TerritoryPoint = { x: number; z: number }
export type TerritoryStatus = 'pending' | 'approved' | 'returned' | 'withdrawn' | 'rejected'
export type TerritoryOwnerType = 'account' | 'shared_area' | 'administration' | 'protected_area'
export type TerritoryRecord = {
  id: string
  name: string
  applicant: { id: string; name: string }
  owner: { type: TerritoryOwnerType; account_id: string | null; name: string }
  status: TerritoryStatus
  applied_at: string
  approved_at: string | null
  changed_at: string
  coordinates: TerritoryPoint[]
  area: number
  centroid: TerritoryPoint
  application_type: 'new' | 'edit'
  reason: string | null
  approved_coordinates: TerritoryPoint[] | null
  pending_coordinates: TerritoryPoint[] | null
  can_edit?: boolean
  can_reapply?: boolean
  can_withdraw?: boolean
  nearby?: Array<{ id: string; name: string }>
}

export const territoryStatusLabel: Record<TerritoryStatus,string> = {
  approved: '承認済', pending: '申請中', returned: '差戻', withdrawn: '取下', rejected: '却下',
}

const EPS = 1e-9
const cross = (a: TerritoryPoint,b: TerritoryPoint,c: TerritoryPoint) =>
  (b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x)
const onSegment=(p:TerritoryPoint,a:TerritoryPoint,b:TerritoryPoint)=>
  Math.abs(cross(a,b,p))<=EPS && p.x>=Math.min(a.x,b.x)-EPS && p.x<=Math.max(a.x,b.x)+EPS
  && p.z>=Math.min(a.z,b.z)-EPS && p.z<=Math.max(a.z,b.z)+EPS
const segmentsIntersect=(a:TerritoryPoint,b:TerritoryPoint,c:TerritoryPoint,d:TerritoryPoint)=>{
  const c1=cross(a,b,c),c2=cross(a,b,d),c3=cross(c,d,a),c4=cross(c,d,b)
  if (((c1>EPS&&c2<-EPS)||(c1<-EPS&&c2>EPS))&&((c3>EPS&&c4<-EPS)||(c3<-EPS&&c4>EPS))) return true
  return Math.abs(c1)<=EPS&&onSegment(c,a,b)||Math.abs(c2)<=EPS&&onSegment(d,a,b)
    ||Math.abs(c3)<=EPS&&onSegment(a,c,d)||Math.abs(c4)<=EPS&&onSegment(b,c,d)
}
export function territoryArea(points: TerritoryPoint[]) {
  if(points.length<3) return 0
  let twice=0
  for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];twice+=a.x*b.z-b.x*a.z}
  return Math.abs(twice/2)
}
export function territoryCentroid(points: TerritoryPoint[]): TerritoryPoint | null {
  if(points.length<3) return null
  let twice=0,x=0,z=0
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length],f=a.x*b.z-b.x*a.z
    twice+=f;x+=(a.x+b.x)*f;z+=(a.z+b.z)*f
  }
  if(Math.abs(twice)<=EPS) return null
  return {x:x/(3*twice),z:z/(3*twice)}
}
export function territoryCoordinateError(points: TerritoryPoint[], minPoints=3): string {
  if(points.length<minPoints) return minPoints ? `${minPoints}点以上の座標を入力してください。` : ''
  if(points.some(p=>!Number.isSafeInteger(p.x)||!Number.isSafeInteger(p.z))) return 'X/Z座標は整数で入力してください。'
  if(new Set(points.map(p=>`${p.x},${p.z}`)).size!==points.length) return '同じ頂点を複数指定できません。'
  if(points.length>=3 && territoryArea(points)<=EPS) return '面積が0になる形状は指定できません。'
  if(points.length>=3) for(let i=0;i<points.length;i++) for(let j=i+1;j<points.length;j++){
    if(j===i||j===(i+1)%points.length||i===(j+1)%points.length) continue
    if(segmentsIntersect(points[i],points[(i+1)%points.length],points[j],points[(j+1)%points.length])) return '境界線が自己交差しています。'
  }
  return ''
}
export function blueMapTerritoryUrl(points: TerritoryPoint[]) {
  const center=territoryCentroid(points)
  if(!center) return '/bluemap/'
  const xs=points.map(p=>p.x),zs=points.map(p=>p.z)
  const span=Math.max(Math.max(...xs)-Math.min(...xs),Math.max(...zs)-Math.min(...zs))
  const distance=Math.max(200,Math.min(4000,Math.ceil(span*2.2)))
  return `/bluemap/#world:${Math.round(center.x)}:250:${Math.round(center.z)}:${distance}:0.1:0.19:0:0:perspective`
}
export const formatCentroid=(p:TerritoryPoint)=>`(${Math.round(p.x)}, ${Math.round(p.z)})`
export const formatArea=(value:number)=>Number.isInteger(value)?String(value):value.toFixed(1)
