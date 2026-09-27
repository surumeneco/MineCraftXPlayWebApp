<template><section>
  <UiPageTitle title="企業承認" />
  <p v-if="loading">申請を読み込んでいます…</p>
  <p v-else-if="error" class="alert alert-danger">{{error}}</p>
  <div v-else-if="!auth.isAdmin.value" class="alert alert-warning">管理者権限が必要です。</div>
  <div v-else class="row g-3">
    <div v-for="item in items" :key="item.id" class="col-md-6 col-xl-4">
      <NuxtLink :to="`/admin/companies/${item.id}/review`" class="card h-100 overflow-hidden text-decoration-none text-body">
        <img v-if="item.image_id" :src="`${apiBase}/company-images/${item.image_id}`" :alt="item.name" class="company-card-image" />
        <div class="card-body"><h2 class="h5">{{item.name}}</h2><p class="mb-1">申請者: {{item.applicant.name}}</p><p class="mb-1">タグ: {{item.tags.join('、')||'なし'}}</p><TerritoryStatusBadge :status="item.status" /></div>
      </NuxtLink>
    </div>
    <p v-if="!items.length">承認待ちの企業はありません。</p>
  </div>
</section></template>
<script setup lang="ts">
import type {CompanyRecord} from '../../../types/company'
import {userFacingError} from '../../../utils/user-error'
const auth=useAccountSession(),{get}=useAccountApi(),{public:{apiBase}}=useRuntimeConfig()
const items=ref<CompanyRecord[]>([]),loading=ref(true),error=ref('')
onMounted(async()=>{try{await auth.refresh();if(auth.isAdmin.value)items.value=await get<CompanyRecord[]>('/admin/companies')}catch(e){error.value=userFacingError(e)}finally{loading.value=false}})
</script>
<style scoped>.company-card-image{display:block;width:100%;aspect-ratio:16/9;object-fit:cover}</style>
