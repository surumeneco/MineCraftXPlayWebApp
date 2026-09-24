<template><section>
  <UiPageTitle title="領地一覧" />
  <form class="row g-2 mb-4" @submit.prevent="load">
    <div class="col-md-3"><input v-model="filters.name" class="form-control" placeholder="領地名" aria-label="領地名で検索" /></div>
    <div class="col-md-3"><input v-model="filters.owner" class="form-control" placeholder="所有者名" aria-label="所有者名で検索" /></div>
    <div class="col-6 col-md-1"><input v-model="filters.x" type="number" step="1" class="form-control" placeholder="X" aria-label="X座標" /></div>
    <div class="col-6 col-md-1"><input v-model="filters.z" type="number" step="1" class="form-control" placeholder="Z" aria-label="Z座標" /></div>
    <div class="col-md-2"><select v-model="filters.status" class="form-select" aria-label="承認状況"><option value="">全状態</option><option v-for="(label,key) in visibleStatuses" :key="key" :value="key">{{ label }}</option></select></div>
    <div class="col-md-2"><select v-model="filters.sort" class="form-select" aria-label="並べ替え"><option value="approved_at">承認日時順</option><option value="applied_at">申請日時順</option><option value="changed_at">変更日時順</option><option value="name">領地名順</option><option value="owner">所有者名順</option></select></div>
    <div class="col-12"><button class="btn btn-primary" type="submit">検索・並べ替え</button></div>
  </form>
  <p v-if="loading">読み込んでいます…</p>
  <p v-else-if="error" class="alert alert-danger">{{ error }}</p>
  <div v-else class="row g-3">
    <div v-for="item in territories" :key="item.id" class="col-md-6 col-xl-4">
      <NuxtLink :to="`/territories/${item.id}`" class="card h-100 text-decoration-none text-body">
        <div class="card-body"><div class="d-flex justify-content-between gap-2"><h2 class="h5 card-title">{{ item.name }}</h2><span class="badge text-bg-secondary align-self-start">{{ territoryStatusLabel[item.status] }}</span></div>
          <dl class="mb-0"><dt>所有者</dt><dd>{{ item.owner.name }}</dd><dt>座標重心</dt><dd>{{ formatCentroid(item.centroid) }}</dd></dl>
        </div>
      </NuxtLink>
    </div>
    <p v-if="!territories.length" class="text-body-secondary">該当する領地はありません。</p>
  </div>
</section></template>
<script setup lang="ts">
import type { TerritoryRecord, TerritoryStatus } from '../../utils/territory'
import { formatCentroid, territoryStatusLabel } from '../../utils/territory'
import { userFacingError } from '../../utils/user-error'
const {get}=useAccountApi(),auth=useAccountSession()
const territories=ref<TerritoryRecord[]>([]),loading=ref(true),error=ref('')
const filters=reactive({name:'',owner:'',x:'',z:'',status:'',sort:'approved_at'})
const visibleStatuses=computed(()=>Object.fromEntries(Object.entries(territoryStatusLabel).filter(([key])=>key!=='rejected'||auth.isAdmin.value)) as Record<TerritoryStatus,string>)
async function load(){loading.value=true;error.value='';try{const q=new URLSearchParams();for(const [k,v] of Object.entries(filters))if(v!=='')q.set(k,v);territories.value=await get<TerritoryRecord[]>(`/territories?${q}`)}catch(e){error.value=userFacingError(e)}finally{loading.value=false}}
onMounted(async()=>{await auth.refresh();await load()})
</script>
