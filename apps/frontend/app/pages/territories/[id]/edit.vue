<template><section>
  <UiPageTitle :title="territory ? `領地編集 - ${territory.name}` : '領地編集'" />
  <p v-if="loading">読み込んでいます…</p>
  <p v-else-if="error && !territory" class="alert alert-danger">{{ error }}</p>
  <form v-else-if="territory" @submit.prevent="submit">
    <p v-if="error" class="alert alert-danger">{{ error }}</p>
    <div class="mb-3"><label for="edit-territory-name" class="form-label">領地名 *</label><input id="edit-territory-name" v-model="name" maxlength="100" required class="form-control" /></div>
    <fieldset class="mb-4">
      <legend class="h5">置き換える既存境界</legend>
      <p class="small text-body-secondary">最初の点を選択後は、選択済み範囲に隣接する点のみ追加できます。全頂点は選択できません。</p>
      <div class="row g-2">
        <div v-for="(point,index) in approved" :key="index" class="col-md-6">
          <div class="form-check border rounded p-2 ps-5">
            <input :id="`existing-${index}`" class="form-check-input" type="checkbox" :checked="selected.has(index)" :disabled="!canToggle(index)" @change="toggle(index)" />
            <label class="form-check-label" :for="`existing-${index}`">#{{ index + 1 }}: X {{ point.x }} / Z {{ point.z }}</label>
          </div>
        </div>
      </div>
    </fieldset>
    <template v-if="range">
      <section class="border rounded p-3 mb-3">
        <h2 class="h5">新しい境界</h2>
        <p class="small text-body-secondary">選択範囲の両端は固定です。その間に必要な頂点を追加してください。</p>
        <div class="row g-2 mb-2">
          <div class="col-md-6"><label class="form-label">始点</label><input class="form-control" :value="`X ${range.startPoint.x} / Z ${range.startPoint.z}`" readonly /></div>
          <div class="col-md-6"><label class="form-label">終点</label><input class="form-control" :value="`X ${range.endPoint.x} / Z ${range.endPoint.z}`" readonly /></div>
        </div>
        <TerritoryCoordinatesEditor v-model="intermediate" :min-points="0" />
      </section>
    </template>
    <div class="mb-3">
      <h2 class="h5">変更後の領地</h2>
      <p v-if="range" class="small text-body-secondary">選択した境界の間に新しい座標を入力してください。名称のみの変更ならチェックを外してください。</p>
      <p>面積: <strong>{{ area === null ? '—' : formatArea(area) }}</strong></p>
      <p v-if="validationError" class="text-danger small">{{ validationError }}</p>
      <TerritoryBlueMapPreview :coordinates="proposed" />
    </div>
    <div class="d-flex gap-2 flex-wrap">
      <button type="submit" class="btn btn-primary" :disabled="busy || !name.trim() || !!validationError || unchanged">変更を申請</button>
      <NuxtLink :to="`/territories/${territory.id}`" class="btn btn-outline-secondary">戻る</NuxtLink>
    </div>
  </form>
</section></template>

<script setup lang="ts">
import type { TerritoryDraftPoint, TerritoryPoint, TerritoryRecord } from '../../../utils/territory'
import { formatArea, territoryArea, territoryCoordinateError } from '../../../utils/territory'
import { userFacingError } from '../../../utils/user-error'

const route=useRoute(),auth=useAccountSession(),{get,mutate}=useAccountApi()
const territory=ref<TerritoryRecord|null>(null),name=ref(''),intermediate=ref<TerritoryDraftPoint[]>([])
const breadcrumbNames=useState<Record<string,string>>('xplay-territory-breadcrumb-names', () => ({}))
const selected=ref<Set<number>>(new Set()),loading=ref(true),busy=ref(false),error=ref(''),operationId=ref('')
const operation=()=>operationId.value||(operationId.value=crypto.randomUUID())
const approved=computed(()=>territory.value?.approved_coordinates ?? territory.value?.coordinates ?? [])
const modulo=(value:number,length:number)=>(value+length)%length

function endpoints(set=selected.value){
  const n=approved.value.length
  if(!set.size||!n)return null
  if(set.size===1){const only=[...set][0];return{start:only,end:only}}
  const start=[...set].find(i=>!set.has(modulo(i-1,n)))
  if(start===undefined)return null
  let end=start
  while(set.has(modulo(end+1,n))&&modulo(end+1,n)!==start)end=modulo(end+1,n)
  return{start,end}
}
function canToggle(index:number){
  const n=approved.value.length
  if(!n)return false
  const set=selected.value
  if(set.has(index)){
    if(set.size<=1)return true
    const prev=set.has(modulo(index-1,n)),next=set.has(modulo(index+1,n))
    return !(prev&&next)
  }
  if(set.size>=n-1)return false
  if(set.size===0)return true
  return set.has(modulo(index-1,n))||set.has(modulo(index+1,n))
}
function toggle(index:number){
  if(!canToggle(index))return
  const next=new Set(selected.value)
  if(next.has(index))next.delete(index);else next.add(index)
  selected.value=next
  intermediate.value=next.size >= 2 ? [{x:null,z:null}] : []
}
const range=computed(()=>{
  if(selected.value.size<2)return null
  const ends=endpoints()
  if(!ends)return null
  return{...ends,startPoint:approved.value[ends.start],endPoint:approved.value[ends.end]}
})
const proposed=computed<TerritoryDraftPoint[]>(()=>{
  const source=approved.value.map(p=>({...p}))
  if(!range.value)return source
  const {start,end}=range.value
  if(start<end)return[...source.slice(0,start+1),...intermediate.value.map(p=>({...p})),...source.slice(end)]
  return[...source.slice(end,start+1),...intermediate.value.map(p=>({...p}))]
})
const validationError=computed(()=>territoryCoordinateError(proposed.value))
const area=computed(()=>validationError.value ? null : territoryArea(proposed.value as TerritoryPoint[]))
const unchanged=computed(()=>{
  if(!territory.value)return true
  return name.value.trim()===territory.value.name && JSON.stringify(proposed.value)===JSON.stringify(approved.value)
})
async function submit(){
  if(!territory.value||validationError.value||unchanged.value)return
  busy.value=true;error.value=''
  try{
    const result=await mutate<TerritoryRecord>(`/territories/${territory.value.id}/edit`,'POST',{
      operation_id:operation(),
      name:name.value.trim(),
      ...(range.value?{replacement:{start:range.value.start,end:range.value.end,intermediate:intermediate.value}}:{})
    })
    await navigateTo(`/territories/${result.id}`)
  }catch(e){error.value=userFacingError(e)}finally{busy.value=false}
}
onMounted(async()=>{
  try{
    await auth.refresh()
    const loaded=await get<TerritoryRecord>(`/territories/${route.params.id}`)
    if(!loaded.can_edit)throw new Error(loaded.status !== 'approved'
      ? '承認済みの領地だけ編集できます。申請中の変更は承認結果を確認してください。'
      : 'この領地を編集する権限がありません。')
    territory.value=loaded;name.value=loaded.name
    breadcrumbNames.value = { ...breadcrumbNames.value, [loaded.id]: loaded.name }
  }catch(e){error.value=userFacingError(e)}finally{loading.value=false}
})
</script>
