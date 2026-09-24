<template><section>
  <UiPageTitle title="未承認領地一覧" />
  <p v-if="loading && !auth.loaded.value">アカウントを確認しています…</p>
  <p v-else-if="error && !auth.isAdmin.value" class="alert alert-danger">{{ error }}</p>
  <div v-else-if="!auth.isAdmin.value" class="alert alert-warning">管理者権限が必要です。</div>
  <template v-else>
    <form class="row g-2 mb-4" @submit.prevent="load">
      <div class="col-md-3"><input v-model="filters.name" class="form-control" placeholder="領地名" aria-label="領地名で検索" /></div>
      <div class="col-md-3"><input v-model="filters.owner" class="form-control" placeholder="所有者名" aria-label="所有者名で検索" /></div>
      <div class="col-6 col-md-1"><input v-model="filters.x" type="number" step="1" class="form-control" placeholder="X" aria-label="X座標" /></div>
      <div class="col-6 col-md-1"><input v-model="filters.z" type="number" step="1" class="form-control" placeholder="Z" aria-label="Z座標" /></div>
      <div class="col-md-2"><select v-model="filters.sort" class="form-select" aria-label="並べ替え"><option value="approved_at">承認日時順</option><option value="applied_at">申請日時順</option><option value="changed_at">変更日時順</option><option value="name">領地名順</option><option value="owner">所有者名順</option></select></div>
      <div class="col-md-2"><button class="btn btn-primary w-100" type="submit" :disabled="loading">検索・並べ替え</button></div>
    </form>
    <p v-if="loading" role="status">読み込んでいます…</p>
    <p v-else-if="error" class="alert alert-danger">{{ error }}</p>
    <div v-else class="row g-3">
      <div v-for="item in items" :key="item.id" class="col-md-6 col-xl-4">
        <NuxtLink :to="`/admin/territories/${item.id}/review`" class="card h-100 text-decoration-none text-body">
          <div class="card-body"><h2 class="h5">{{ item.name }}</h2><p class="mb-1">所有者: {{ item.owner.name }}</p><p class="mb-1">重心: {{ formatCentroid(item.centroid) }}</p><span class="badge text-bg-secondary">{{ territoryStatusLabel[item.status] }}</span></div>
        </NuxtLink>
      </div>
      <p v-if="!items.length">承認待ちの領地はありません。</p>
    </div>
  </template>
</section></template>
<script setup lang="ts">
import type { TerritoryRecord } from '../../../utils/territory'
import { formatCentroid, territoryStatusLabel } from '../../../utils/territory'
import { userFacingError } from '../../../utils/user-error'
const auth=useAccountSession(),{get}=useAccountApi()
const items=ref<TerritoryRecord[]>([]),loading=ref(true),error=ref('')
const filters=reactive({name:'',owner:'',x:'',z:'',sort:'approved_at'})
async function load(){
  loading.value=true;error.value=''
  try{
    const q=new URLSearchParams()
    for(const [key,value] of Object.entries(filters)) if(value!=='') q.set(key,value)
    items.value=await get<TerritoryRecord[]>(`/admin/territories?${q}`)
  }catch(e){error.value=userFacingError(e)}finally{loading.value=false}
}
onMounted(async()=>{try{await auth.refresh();if(auth.isAdmin.value)await load()}catch(e){error.value=userFacingError(e);loading.value=false}})
</script>
