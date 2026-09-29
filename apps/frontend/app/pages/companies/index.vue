<template><section>
  <UiPageTitle title="企業一覧" />
  <form class="row g-2 mb-4" @submit.prevent="load">
    <div class="col-md-3"><TerritorySearchField v-model="filters.name" :options="names" placeholder="企業名" label="企業名で検索" @selected="load" /></div>
    <div class="col-md-2"><select v-model="filters.tag" class="form-select" aria-label="タグで検索"><option value="">全タグ</option><option v-for="tag in companyTags" :key="tag">{{tag}}</option></select></div>
    <div class="col-md-3"><TerritorySearchField v-model="filters.account" :options="accounts" placeholder="代表者・所属者" label="アカウントで検索" @selected="load" /></div>
    <div class="col-md-2"><TerritorySearchField v-model="filters.headquarters" :options="headquarters" placeholder="主要活動拠点" label="主要活動拠点で検索" @selected="load" /></div>
    <div class="col-md-2"><select v-model="filters.sort" class="form-select" aria-label="並べ替え"><option value="approved_at">承認日時順</option><option value="applied_at">申請日時順</option><option value="changed_at">変更日時順</option><option value="name">企業名順</option></select></div>
    <div class="col-12 text-end"><button type="submit" class="btn btn-primary" :disabled="loading">検索・並べ替え</button></div>
  </form>
  <p v-if="loading" role="status">企業を読み込んでいます…</p>
  <p v-else-if="error" class="alert alert-danger" role="alert">{{error}}</p>
  <div v-else class="row g-3">
    <div v-for="company in items" :key="company.id" class="col-md-6 col-xl-4">
      <NuxtLink :to="`/companies/${company.id}`" class="card h-100 overflow-hidden text-decoration-none text-body">
        <img v-if="company.image_id" :src="`${apiBase}/company-images/${company.image_id}`" :alt="company.name" class="company-list-image" />
        <div class="card-body">
          <div class="d-flex justify-content-between gap-2"><h2 class="h5 card-title">{{companyDisplayName(company.name,company.abbreviation)}}</h2><div class="d-flex flex-wrap align-items-start gap-1"><span v-if="company.is_public" class="badge text-bg-info">公営</span><TerritoryStatusBadge v-if="company.status!=='approved'" :status="company.status" /></div></div>
          <p class="card-text text-body-secondary mb-0">{{company.tags.join(' / ')||'タグなし'}}</p>
        </div>
      </NuxtLink>
    </div>
    <p v-if="!items.length" class="text-body-secondary">該当する企業はありません。</p>
  </div>
</section></template>
<script setup lang="ts">
import type {CompanyRecord} from '../../types/company'
import {companyDisplayName,companyTags} from '../../types/company'
import {userFacingError} from '../../utils/user-error'
const {get}=useAccountApi(),auth=useAccountSession()
const {public:{apiBase}}=useRuntimeConfig()
const items=ref<CompanyRecord[]>([]),source=ref<CompanyRecord[]>([]),loading=ref(true),error=ref('')
const names=computed(()=>source.value.map(v=>v.name))
const accounts=computed(()=>source.value.flatMap(v=>[v.representative.name,...v.members.map(m=>m.name)]))
const headquarters=computed(()=>source.value.map(v=>v.headquarters.name??'').filter(Boolean))
const filters=reactive({name:'',tag:'',account:'',headquarters:'',sort:'approved_at'})
async function load(){loading.value=true;error.value='';try{const q=new URLSearchParams();for(const [key,value] of Object.entries(filters))if(value)q.set(key,value);items.value=await get<CompanyRecord[]>(`/companies?${q}`)}catch(e){error.value=userFacingError(e)}finally{loading.value=false}}
onMounted(async()=>{try{await auth.refresh();source.value=await get<CompanyRecord[]>('/companies');items.value=source.value}catch(e){error.value=userFacingError(e)}finally{loading.value=false}})
</script>
<style scoped>.company-list-image{display:block;width:100%;aspect-ratio:16/9;object-fit:cover}</style>
