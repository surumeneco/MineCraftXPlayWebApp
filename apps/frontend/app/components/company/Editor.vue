<template><section>
  <UiPageTitle :title="editing?'企業編集':sourceId?'企業再申請':'企業申請'" />
  <p v-if="loading" role="status">申請情報を読み込んでいます…</p>
  <p v-else-if="error && !ready" class="alert alert-danger">{{error}}</p>
  <template v-else-if="!auth.authenticated.value"><p class="alert alert-warning">企業申請にはログインが必要です。</p><NuxtLink to="/login" class="btn btn-primary">ログイン</NuxtLink></template>
  <form v-else-if="ready" @submit.prevent="submit">
    <p v-if="error" class="alert alert-danger">{{error}}</p>
    <div class="mb-3"><label for="company-name" class="form-label">企業名 *</label><input id="company-name" v-model="name" class="form-control" maxlength="100" required /><div v-if="editing" class="form-text">変更には管理者の承認が必要です。</div></div>
    <div v-if="auth.isAdmin.value" class="form-check mb-3"><input id="company-public" v-model="isPublic" type="checkbox" class="form-check-input" /><label class="form-check-label" for="company-public">公営企業</label></div>
    <fieldset class="mb-3"><legend class="form-label">タグ</legend><div class="d-flex flex-wrap gap-3"><label v-for="tag in companyTags" :key="tag" class="form-check"><input v-model="tags" class="form-check-input" type="checkbox" :value="tag" /><span class="form-check-label">{{tag}}</span></label></div><p v-if="editing" class="form-text">タグの変更には管理者の承認が必要です。</p></fieldset>
    <div v-if="showRepresentative" class="mb-3">
      <label for="company-rep-search" class="form-label">代表者 *</label>
      <input id="company-rep-search" v-model="repSearch" type="search" autocomplete="off" maxlength="100" class="form-control" placeholder="アカウント名で検索" />
      <p v-if="accountError" class="small text-danger">{{accountError}}</p>
      <div v-if="repCandidates.length" class="list-group mt-2" role="group" aria-label="代表者候補">
        <label v-for="account in repCandidates" :key="account.id" class="list-group-item d-flex gap-2 align-items-center">
          <input v-model="representativeId" type="radio" name="company-representative" :value="account.id" />{{account.name}}
        </label>
      </div>
      <p v-if="selectedRepresentative" class="form-text">選択中: {{selectedRepresentative.name}}</p>
      <p v-if="editing" class="form-text">代表者の変更には管理者の承認が必要です。</p>
    </div>
    <div v-else class="mb-3"><span class="form-label d-block">代表者</span><span>{{profile?.name}}</span></div>
    <div class="mb-3">
      <label for="company-member-search" class="form-label">所属者（代表者以外1アカウント以上必須） *</label>
      <input id="company-member-search" v-model="memberSearch" class="form-control" type="search" maxlength="100" autocomplete="off" placeholder="アカウント名で検索" />
      <p v-if="accountError" class="small text-danger">{{accountError}}</p>
      <div v-if="memberCandidates.length" class="list-group mt-2" role="group" aria-label="所属者候補">
        <button v-for="account in memberCandidates" :key="account.id" type="button" class="list-group-item list-group-item-action d-flex align-items-center justify-content-between" @click="addMember(account)">
          <span>{{account.name}}</span><i class="bi bi-plus-circle" aria-hidden="true" />
        </button>
      </div>
      <ul class="list-group mt-2" aria-label="選択した所属者">
        <li v-for="account in members" :key="account.id" class="list-group-item d-flex align-items-center justify-content-between gap-2"><span>{{account.name}}</span><button type="button" class="btn btn-outline-danger btn-sm" :aria-label="`${account.name}を削除`" @click="removeMember(account.id)"><i class="bi bi-x-lg" /></button></li>
      </ul>
    </div>
    <div class="mb-3"><label for="company-headquarters" class="form-label">主要活動拠点 *</label><select id="company-headquarters" v-model="headquartersId" class="form-select" required><option value="" disabled>領地を選択してください</option><option v-for="territory in headquarters" :key="territory.id" :value="territory.id">{{territory.name}}</option></select></div>
    <div class="mb-3"><label for="company-activities" class="form-label">活動内容 *</label><textarea id="company-activities" v-model="activities" required rows="5" maxlength="20000" class="form-control" /><p v-if="editing" class="form-text">変更には管理者の承認が必要です。</p></div>
    <CompanyImageField v-model="imageId" @uploading="imageUploading=$event" />
    <div class="mb-3"><label class="form-label">紹介文</label><ClientOnly><div ref="editor" aria-label="企業紹介文の編集" /></ClientOnly><p class="form-text">Quill形式で保存します。本文中の画像埋め込みには対応していません。</p></div>
    <div class="d-flex justify-content-end gap-2"><NuxtLink :to="companyId?`/companies/${companyId}`:'/companies'" class="btn btn-outline-secondary">戻る</NuxtLink><button type="submit" class="btn btn-primary" :disabled="busy||imageUploading||!quillReady||!name.trim()||!activities.trim()||!headquartersId||!representativeId||!members.length">{{busy?'保存しています…':editing?'保存・申請':'申請'}}</button></div>
  </form>
</section></template>
<script setup lang="ts">
import type {AccountRecord} from '../../composables/useAccountApi'
import type {CompanyAccount,CompanyRecord,CompanyTag} from '../../types/company'
import {companyTags} from '../../types/company'
import {userFacingError} from '../../utils/user-error'
const props=defineProps<{editId?:string;sourceId?:string}>()
const editing=computed(()=>!!props.editId),companyId=computed(()=>props.editId||props.sourceId||'')
const {get,mutate}=useAccountApi(),auth=useAccountSession(),{ $loadQuill }=useNuxtApp()
const breadcrumbs=useState<Record<string,string>>('xplay-company-breadcrumb-names',()=>({}))
const loading=ref(true),ready=ref(false),busy=ref(false),imageUploading=ref(false),error=ref(''),operationId=ref('')
const operation=()=>operationId.value||(operationId.value=crypto.randomUUID())
const profile=ref<AccountRecord|null>(null),selected=ref<CompanyRecord|null>(null)
const name=ref(''),tags=ref<CompanyTag[]>([]),isPublic=ref(false),activities=ref(''),imageId=ref<string|null>(null)
const headquartersId=ref(''),headquarters=ref<Array<{id:string;name:string}>>([])
const representativeId=ref(''),repSearch=ref(''),memberSearch=ref(''),accounts=ref<CompanyAccount[]>([]),members=ref<CompanyAccount[]>([]),accountError=ref('')
const repCandidates=computed(()=>accounts.value.filter(a=>a.name.normalize('NFKC').toLocaleLowerCase('ja').includes(repSearch.value.normalize('NFKC').toLocaleLowerCase('ja'))))
const memberCandidates=computed(()=>accounts.value.filter(a=>a.id!==representativeId.value && !members.value.some(m=>m.id===a.id)
  && a.name.normalize('NFKC').toLocaleLowerCase('ja').includes(memberSearch.value.normalize('NFKC').toLocaleLowerCase('ja'))))
const selectedRepresentative=computed(()=>accounts.value.find(a=>a.id===representativeId.value)??(selected.value?.representative.id===representativeId.value?selected.value.representative:null))
const showRepresentative=computed(()=>editing.value||auth.isAdmin.value)
const editor=ref<HTMLDivElement|null>(null),quillReady=ref(false)
let quill:InstanceType<Awaited<ReturnType<typeof $loadQuill>>>|null=null
let sourceContents:CompanyRecord['introduction_delta']={ops:[{insert:'\n'}]}
const toolbar=[['bold','italic','underline','strike'],[{header:[1,2,3,false]}],[{list:'ordered'},{list:'bullet'}],['link'],['clean']]
watch(editor,async element=>{if(!element||quill)return;const Quill=await $loadQuill();if(element!==editor.value||quill)return;quill=new Quill(element,{theme:'snow',modules:{toolbar}});quill.setContents(sourceContents as Parameters<typeof quill.setContents>[0]);quillReady.value=true},{flush:'post'})
let accountVersion=0
async function searchAccounts(term:string){if(!auth.authenticated.value)return;const version=++accountVersion;accountError.value='';try{const found=await get<CompanyAccount[]>(`/companies/accounts?name=${encodeURIComponent(term)}`);if(version===accountVersion){const combined=[...found,...members.value,...(selected.value?[selected.value.representative]:[]),...(profile.value?[{id:profile.value.id,name:profile.value.name}]:[])];accounts.value=Array.from(new Map(combined.map(a=>[a.id,a])).values())}}catch(e){if(version===accountVersion)accountError.value=userFacingError(e)}}
watch(repSearch,value=>{void searchAccounts(value)})
watch(memberSearch,value=>{void searchAccounts(value)})
function addMember(member:CompanyAccount){if(member.id!==representativeId.value && !members.value.some(m=>m.id===member.id))members.value=[...members.value,member];memberSearch.value=''}
function removeMember(id:string){members.value=members.value.filter(m=>m.id!==id)}
let headquartersVersion=0
async function loadHeadquarters(){
  const version=++headquartersVersion
  const path=editing.value
    ? `/companies/headquarters?mode=edit&company_id=${encodeURIComponent(companyId.value)}&representative_account_id=${encodeURIComponent(representativeId.value)}`
    : '/companies/headquarters?mode=apply'
  const loaded=await get<Array<{id:string;name:string}>>(path)
  if(version!==headquartersVersion)return
  headquarters.value=loaded
  if(headquartersId.value && !loaded.some(item=>item.id===headquartersId.value))headquartersId.value=''
}
watch(representativeId,()=>{
  members.value=members.value.filter(member=>member.id!==representativeId.value)
  if(editing.value && ready.value)void loadHeadquarters().catch(e=>{error.value=userFacingError(e)})
})
async function submit(){if(!profile.value||!quill||!headquartersId.value||!members.value.length||members.value.some(member=>member.id===representativeId.value))return;busy.value=true;error.value='';try{
  const body={operation_id:operation(),name:name.value.trim(),tags:tags.value,activities:activities.value,headquarters_territory_id:headquartersId.value,image_id:imageId.value,introduction_delta:quill.getContents(),
    ...(editing.value||auth.isAdmin.value?{representative_account_id:representativeId.value}:{}),
    ...(auth.isAdmin.value?{is_public:isPublic.value}:{}),member_account_ids:members.value.map(a=>a.id)}
  const result=editing.value?await mutate<CompanyRecord>(`/companies/${companyId.value}/edit`,'POST',body):props.sourceId?await mutate<CompanyRecord>(`/companies/${companyId.value}/reapply`,'POST',body):await mutate<CompanyRecord>('/companies','POST',body)
  await navigateTo(`/companies/${result.id}`)
}catch(e){error.value=userFacingError(e)}finally{busy.value=false}}
onMounted(async()=>{try{
  await auth.refresh();if(!auth.authenticated.value)return
  profile.value=await get<AccountRecord>('/accounts/me');representativeId.value=profile.value.id
  if(companyId.value){selected.value=await get<CompanyRecord>(`/companies/${companyId.value}`);if(editing.value&&!selected.value.can_edit)throw new Error('企業を編集できません。');if(!editing.value&&!selected.value.can_reapply)throw new Error('企業を再申請できません。')
    const c=selected.value;breadcrumbs.value={...breadcrumbs.value,[c.id]:c.name}
    const draft=!editing.value?c.reapply_draft:null
    name.value=draft?.name??c.name;tags.value=[...(draft?.tags??c.tags)];isPublic.value=c.is_public;activities.value=draft?.activities??c.activities;imageId.value=c.image_id;headquartersId.value=c.headquarters.id??'';representativeId.value=draft?.representative.id??c.representative.id;repSearch.value=draft?.representative.name??c.representative.name;members.value=c.members.filter(member=>member.id!==representativeId.value);sourceContents=c.introduction_delta
  }
  await Promise.all([loadHeadquarters(),searchAccounts('')]);ready.value=true
}catch(e){error.value=userFacingError(e)}finally{loading.value=false}})
</script>
