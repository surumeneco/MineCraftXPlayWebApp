<template><section>
  <UiPageTitle :title="company?`企業承認詳細 - ${company.name}`:'企業承認詳細'" />
  <p v-if="loading">申請を読み込んでいます…</p><p v-else-if="error" class="alert alert-danger">{{error}}</p>
  <template v-else-if="company">
    <div class="mb-4"><NuxtLink :to="`/companies/${company.id}`" class="btn btn-outline-secondary btn-sm">企業詳細</NuxtLink></div>
    <dl class="row">
      <dt class="col-sm-3">申請種別</dt><dd class="col-sm-9">{{company.application_type==='edit'?'変更申請':'新規申請'}}</dd>
      <dt class="col-sm-3">申請者</dt><dd class="col-sm-9">{{company.applicant.name}}</dd>
      <dt class="col-sm-3">企業名</dt><dd class="col-sm-9">{{company.name}}</dd>
      <template v-if="company.abbreviation"><dt class="col-sm-3">略称</dt><dd class="col-sm-9">{{company.abbreviation}}</dd></template>
      <dt class="col-sm-3">公営</dt><dd class="col-sm-9">{{company.is_public?'公営':'非公営'}}</dd>
      <dt class="col-sm-3">タグ</dt><dd class="col-sm-9">{{company.tags.join('、')||'なし'}}</dd>
      <dt class="col-sm-3">代表者</dt><dd class="col-sm-9">{{company.representative.name}}</dd>
      <dt class="col-sm-3">所属者</dt><dd class="col-sm-9">{{company.members.map(m=>m.name).join('、')||'なし'}}</dd>
      <dt class="col-sm-3">主要活動拠点</dt><dd class="col-sm-9"><NuxtLink v-if="company.headquarters.id" :to="`/territories/${company.headquarters.id}`">{{company.headquarters.name}}</NuxtLink></dd>
      <dt class="col-sm-3">活動内容</dt><dd class="col-sm-9 company-wrap">{{company.activities}}</dd>
      <dt class="col-sm-3">申請日時</dt><dd class="col-sm-9">{{companyDate(company.submitted_at)}}</dd>
    </dl>
    <img v-if="company.image_id" :src="`${apiBase}/company-images/${company.image_id}`" :alt="company.name" class="company-review-image border rounded mb-4" />
    <p v-else class="text-body-secondary">画像が設定されていません</p>
    <UiSectionHeading as="h2" title="紹介文" /><CompanyIntroduction :value="company.introduction_delta" />
    <section v-if="company.current" class="border rounded p-3 my-4">
      <h2 class="h5">現在の承認済み内容</h2><p>名称: {{company.current.name}}</p><p v-if="company.current.abbreviation">略称: {{company.current.abbreviation}}</p><p>タグ: {{company.current.tags.join('、')}}</p><p>代表者: {{company.current.representative.name}}</p><p class="company-wrap mb-0">活動内容: {{company.current.activities}}</p>
    </section>
    <div class="mb-3"><label for="company-reason" class="form-label">差戻・却下理由</label><textarea id="company-reason" v-model="reason" class="form-control" rows="3" /></div>
    <div class="d-flex flex-wrap justify-content-end gap-2"><NuxtLink to="/admin/companies" class="btn btn-outline-secondary">一覧に戻る</NuxtLink><button :disabled="busy||!reason.trim()" class="btn btn-warning" @click="review('return')">差戻</button><button :disabled="busy||!reason.trim()" class="btn btn-danger" @click="review('reject')">却下</button><button :disabled="busy" class="btn btn-success" @click="review('approve')">承認</button></div>
  </template>
</section></template>
<script setup lang="ts">
import type {CompanyReview} from '../../../../types/company'
import {companyDate} from '../../../../types/company'
import {userFacingError} from '../../../../utils/user-error'
const route=useRoute(),auth=useAccountSession(),{get,mutate}=useAccountApi(),{public:{apiBase}}=useRuntimeConfig()
const breadcrumbs=useState<Record<string,string>>('xplay-company-breadcrumb-names',()=>({}))
const company=ref<CompanyReview|null>(null),reason=ref(''),loading=ref(true),busy=ref(false),error=ref('')
async function review(action:'approve'|'return'|'reject'){if(!company.value)return;busy.value=true;error.value='';try{await mutate(`/admin/companies/${company.value.id}/review`,'POST',{operation_id:crypto.randomUUID(),action,reason:reason.value});await navigateTo('/admin/companies')}catch(e){error.value=userFacingError(e)}finally{busy.value=false}}
onMounted(async()=>{try{await auth.refresh();if(!auth.isAdmin.value)throw new Error('管理者権限が必要です。');company.value=await get<CompanyReview>(`/admin/companies/${route.params.id}`);breadcrumbs.value={...breadcrumbs.value,[company.value.id]:company.value.name}}catch(e){error.value=userFacingError(e)}finally{loading.value=false}})
</script>
<style scoped>.company-review-image{display:block;max-width:100%;max-height:25rem;object-fit:contain}.company-wrap{white-space:pre-wrap;overflow-wrap:anywhere}</style>
