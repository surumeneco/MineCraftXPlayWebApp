<template><section>
  <UiPageTitle :title="company?.name??'企業詳細'" />
  <p v-if="loading" role="status">読み込んでいます…</p><p v-else-if="error" class="alert alert-danger" role="alert">{{error}}</p>
  <template v-else-if="company">
    <div class="d-flex justify-content-end gap-2 mb-3">
      <button v-if="company.can_withdraw" class="btn btn-outline-danger" :disabled="busy" @click="withdraw">申請を取り下げる</button>
      <NuxtLink v-if="company.can_edit" :to="`/companies/${company.id}/edit`" class="btn btn-primary" aria-label="企業編集"><i class="bi bi-pencil-square" aria-hidden="true" /><span class="visually-hidden">編集</span></NuxtLink>
      <NuxtLink v-if="company.can_reapply" :to="`/companies/apply?source=${company.id}`" class="btn btn-primary">再申請</NuxtLink>
    </div>
    <dl class="row mb-4">
      <dt class="col-sm-3">名称</dt><dd class="col-sm-9">{{company.name}} <span v-if="company.is_public" class="badge text-bg-info ms-2">公営</span></dd>
      <template v-if="company.abbreviation"><dt class="col-sm-3">略称</dt><dd class="col-sm-9">{{company.abbreviation}}</dd></template>
      <dt class="col-sm-3">承認状況</dt><dd class="col-sm-9"><TerritoryStatusBadge :status="company.status" /><span v-if="company.pending_changes" class="small ms-2">変更申請中</span><span v-if="company.approved_at && ['returned','withdrawn'].includes(company.last_application_status??'')" class="small ms-2">直近の変更申請: {{company.last_application_status==='returned'?'差戻':'取下'}}</span></dd>
      <dt class="col-sm-3">タグ</dt><dd class="col-sm-9">{{company.tags.join('、')||'なし'}}</dd>
      <dt class="col-sm-3">BlueMap表示色</dt><dd class="col-sm-9"><span v-if="colorHex" class="d-inline-flex align-items-center gap-2"><span class="company-color-preview border rounded" :style="{ backgroundColor: colorHex }" aria-hidden="true" /><code>{{colorHex}}</code></span><span v-else>未設定</span></dd>
    </dl>
    <UiDateMeta :items="[
      { label: '申請日時', icon: 'calendar-plus', value: company.applied_at },
      { label: '承認日時', icon: 'calendar-check', value: company.approved_at },
      { label: '変更日時', icon: 'clock-history', value: company.changed_at },
    ]" />
    <img v-if="company.image_id" :src="`${apiBase}/company-images/${company.image_id}`" :alt="`${company.name}のメイン画像`" class="company-detail-image border rounded mb-4" />
    <dl class="row mb-4">
      <dt class="col-sm-3">代表者</dt><dd class="col-sm-9">{{company.representative.name}}<span v-if="!company.representative.minecraft_ids.length" class="small text-body-secondary ms-2">Minecraft ID未登録</span><ul v-else class="list-inline mb-0"><li v-for="(mc,i) in company.representative.minecraft_ids" :key="i" class="list-inline-item"><span class="badge text-bg-secondary">{{mc.edition.toUpperCase()}}</span> {{mc.username}}</li></ul></dd>
      <dt class="col-sm-3">所属者</dt><dd class="col-sm-9">{{company.members.map(m=>m.name).join('、')||'なし'}}</dd>
      <dt class="col-sm-3">主要活動拠点</dt><dd class="col-sm-9"><NuxtLink v-if="company.headquarters.id" :to="`/territories/${company.headquarters.id}`">{{company.headquarters.name}}</NuxtLink><span v-else>未設定</span></dd>
      <dt class="col-sm-3">活動内容</dt><dd class="col-sm-9 company-wrap">{{company.activities}}</dd>
    </dl>
    <UiSectionHeading as="h2" title="紹介文" />
    <CompanyIntroduction :value="company.introduction_delta" />
    <p v-if="company.reason" class="alert alert-secondary mt-3">審査理由: {{company.reason}}</p>
  </template>
</section></template>
<script setup lang="ts">
import type {CompanyRecord} from '../../../types/company'
import {userFacingError} from '../../../utils/user-error'
const {public:{apiBase}}=useRuntimeConfig(),route=useRoute(),{get,mutate}=useAccountApi(),auth=useAccountSession()
const company=ref<CompanyRecord|null>(null),loading=ref(true),error=ref(''),busy=ref(false)
const breadcrumbs=useState<Record<string,string>>('xplay-company-breadcrumb-names',()=>({}))
const colorHex=computed(()=>company.value?.map_color ? `#${[company.value.map_color.r,company.value.map_color.g,company.value.map_color.b].map(v=>v.toString(16).padStart(2,'0')).join('')}` : null)
async function load(){const data=await get<CompanyRecord>(`/companies/${route.params.id}`);company.value=data;breadcrumbs.value={...breadcrumbs.value,[data.id]:data.name}}
async function withdraw(){if(!company.value)return;busy.value=true;error.value='';try{await mutate(`/companies/${company.value.id}/withdraw`,'POST',{operation_id:crypto.randomUUID()});await load()}catch(e){error.value=userFacingError(e)}finally{busy.value=false}}
onMounted(async()=>{try{await auth.refresh();await load()}catch(e){error.value=userFacingError(e)}finally{loading.value=false}})
</script>
<style scoped>.company-detail-image{display:block;max-width:100%;max-height:30rem;object-fit:contain}.company-wrap{white-space:pre-wrap;overflow-wrap:anywhere}.company-color-preview{width:1.75rem;height:1.75rem;display:inline-block}</style>
