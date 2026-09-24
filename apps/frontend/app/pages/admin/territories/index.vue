<template><section><UiPageTitle title="未承認領地一覧" /><p v-if="loading">読み込んでいます…</p><p v-else-if="error" class="alert alert-danger">{{ error }}</p><div v-else-if="!auth.isAdmin.value" class="alert alert-warning">管理者権限が必要です。</div><div v-else class="row g-3"><div v-for="item in items" :key="item.id" class="col-md-6 col-xl-4"><NuxtLink :to="`/admin/territories/${item.id}/review`" class="card h-100 text-decoration-none text-body"><div class="card-body"><h2 class="h5">{{ item.name }}</h2><p class="mb-1">所有者: {{ item.owner.name }}</p><p class="mb-1">重心: {{ formatCentroid(item.centroid) }}</p><span class="badge text-bg-secondary">{{ territoryStatusLabel[item.status] }}</span></div></NuxtLink></div><p v-if="!items.length">承認待ちの領地はありません。</p></div></section></template>
<script setup lang="ts">
import type { TerritoryRecord } from '../../../utils/territory'
import {formatCentroid,territoryStatusLabel} from '../../../utils/territory'
import {userFacingError} from '../../../utils/user-error'
const auth=useAccountSession(),{get}=useAccountApi(),items=ref<TerritoryRecord[]>([]),loading=ref(true),error=ref('')
onMounted(async()=>{try{await auth.refresh();if(auth.isAdmin.value)items.value=await get<TerritoryRecord[]>('/admin/territories')}catch(e){error.value=userFacingError(e)}finally{loading.value=false}})
</script>
