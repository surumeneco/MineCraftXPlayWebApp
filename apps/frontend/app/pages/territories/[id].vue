<template><section>
  <UiPageTitle :title="territory?.name??'領地詳細'" />
  <p v-if="loading">読み込んでいます…</p><p v-else-if="error" class="alert alert-danger">{{ error }}</p>
  <template v-else-if="territory">
    <div class="d-flex gap-2 flex-wrap mb-3"><NuxtLink v-if="territory.can_edit" :to="`/territories/${territory.id}/edit`" class="btn btn-primary"><i class="bi bi-pencil-square" aria-hidden="true" /><span class="visually-hidden">編集</span></NuxtLink><NuxtLink v-if="territory.can_reapply" :to="`/territories/apply?source=${territory.id}`" class="btn btn-primary">再申請</NuxtLink><button v-if="territory.can_withdraw" class="btn btn-outline-danger" :disabled="busy" @click="withdraw">取下</button></div>
    <dl class="row"><dt class="col-sm-3">所有者</dt><dd class="col-sm-9">{{ territory.owner.name }}</dd><dt class="col-sm-3">申請状況</dt><dd class="col-sm-9">{{ territoryStatusLabel[territory.status] }}</dd><dt class="col-sm-3">申請日時</dt><dd class="col-sm-9">{{ date(territory.applied_at) }}</dd><dt class="col-sm-3">承認日時</dt><dd class="col-sm-9">{{ date(territory.approved_at) }}</dd><dt class="col-sm-3">変更日時</dt><dd class="col-sm-9">{{ date(territory.changed_at) }}</dd><dt class="col-sm-3">座標重心</dt><dd class="col-sm-9">{{ formatCentroid(territory.centroid) }}</dd><dt class="col-sm-3">面積</dt><dd class="col-sm-9">{{ formatArea(territory.area) }}</dd></dl>
    <TerritoryBlueMapPreview class="mb-4" :coordinates="territory.coordinates" />
    <h2 class="h4">座標</h2><ol><li v-for="(point,i) in territory.coordinates" :key="i">X {{ point.x }} / Z {{ point.z }}</li></ol>
    <template v-if="territory.nearby?.length"><h2 class="h4">近くの領地</h2><ul><li v-for="near in territory.nearby" :key="near.id"><NuxtLink :to="`/territories/${near.id}`">{{ near.name }}</NuxtLink></li></ul></template>
  </template>
</section></template>
<script setup lang="ts">
import type { TerritoryRecord } from '../../utils/territory'
import { formatArea,formatCentroid,territoryStatusLabel } from '../../utils/territory'
import { userFacingError } from '../../utils/user-error'
const route=useRoute(),{get,mutate}=useAccountApi(),auth=useAccountSession()
const territory=ref<TerritoryRecord|null>(null),loading=ref(true),busy=ref(false),error=ref(''),withdrawOperationId=ref('')
const withdrawOperation=()=>withdrawOperationId.value||(withdrawOperationId.value=crypto.randomUUID())
const id=computed(()=>String(route.params.id));const date=(v:string|null)=>v?new Date(v).toLocaleString('ja-JP'):'—'
async function load(){territory.value=await get<TerritoryRecord>(`/territories/${id.value}`)}
async function withdraw(){busy.value=true;error.value='';try{await mutate(`/territories/${id.value}/withdraw`,'POST',{operation_id:withdrawOperation()});await navigateTo(`/territories/apply?source=${id.value}`)}catch(e){error.value=userFacingError(e)}finally{busy.value=false}}
onMounted(async()=>{try{await auth.refresh();await load()}catch(e){error.value=userFacingError(e)}finally{loading.value=false}})
</script>
