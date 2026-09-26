<template><section>
  <UiPageTitle :title="sourceId?'領地再申請':'領地申請'" />
  <p v-if="loading">読み込んでいます…</p>
  <template v-else-if="!auth.authenticated.value"><p class="alert alert-warning">領地申請にはログインが必要です。</p><NuxtLink to="/login" class="btn btn-primary">ログイン</NuxtLink></template>
  <form v-else-if="profile" @submit.prevent="submit">
    <p v-if="error" class="alert alert-danger">{{ error }}</p>
    <div class="mb-3"><label for="territory-name" class="form-label">領地名 *</label><input id="territory-name" v-model="name" maxlength="100" required class="form-control" /></div>
    <div class="mb-3"><label for="territory-owner" class="form-label">所有者 *</label><select id="territory-owner" v-model="ownerType" class="form-select" :disabled="!auth.isAdmin.value"><option value="account">{{ profile.name }}</option><option v-if="auth.isAdmin.value" value="shared_area">共同建築エリア</option><option v-if="auth.isAdmin.value" value="administration">運営</option><option v-if="auth.isAdmin.value" value="protected_area">保護区</option></select></div>
    <section v-if="!profile.minecraft_ids.length" class="border rounded p-3 mb-3"><h2 class="h5">Minecraft ID登録</h2><p class="small text-body-secondary">領地申請前にMinecraft IDを1件以上登録してください。</p><div class="row g-2"><div class="col-auto"><select v-model="edition" class="form-select"><option value="je">JE</option><option value="be">BE</option></select></div><div class="col"><input v-model="minecraftName" maxlength="32" class="form-control" placeholder="Minecraft ID" /></div><div class="col-auto"><button type="button" class="btn btn-secondary" :disabled="busy||!minecraftName.trim()" @click="addMinecraft">登録</button></div></div></section>
    <div class="mb-3"><label class="form-label">座標 (X/Z) *</label><TerritoryCoordinatesEditor v-model="coordinates" /></div>
    <p>面積: <strong>{{ area===null?'—':formatArea(area) }}</strong></p>
    <button type="submit" class="btn btn-primary" :disabled="busy||!!coordinateError||!profile.minecraft_ids.length||!name.trim()||unchanged">{{ sourceId?'再申請':'申請' }}</button>
  </form>
</section></template>
<script setup lang="ts">
import type { AccountRecord } from '../../composables/useAccountApi'
import type { TerritoryOwnerType, TerritoryDraftPoint, TerritoryPoint, TerritoryRecord } from '../../utils/territory'
import { formatArea, territoryArea, territoryCoordinateError } from '../../utils/territory'
import { userFacingError } from '../../utils/user-error'
const route=useRoute(),auth=useAccountSession(),{get,mutate}=useAccountApi()
const sourceId=computed(()=>typeof route.query.source==='string'?route.query.source:'')
const profile=ref<AccountRecord|null>(null),name=ref(''),ownerType=ref<TerritoryOwnerType>('account')
const coordinates=ref<TerritoryDraftPoint[]>([{x:null,z:null},{x:null,z:null},{x:null,z:null}])
const initial=ref(''),edition=ref<'je'|'be'>('je'),minecraftName=ref('')
const loading=ref(true),busy=ref(false),error=ref(''),operationId=ref('')
const operation=()=>operationId.value||(operationId.value=crypto.randomUUID())
const coordinateError=computed(()=>territoryCoordinateError(coordinates.value))
const area=computed(()=>coordinateError.value ? null : territoryArea(coordinates.value as TerritoryPoint[]))
const snapshot=computed(()=>JSON.stringify({name:name.value.trim(),owner_type:ownerType.value,coordinates:coordinates.value}))
const unchanged=computed(()=>!!sourceId.value&&snapshot.value===initial.value)
async function addMinecraft(){busy.value=true;error.value='';try{profile.value=await mutate<AccountRecord>('/accounts/me/minecraft','POST',{edition:edition.value,username:minecraftName.value});minecraftName.value=''}catch(e){error.value=userFacingError(e)}finally{busy.value=false}}
async function submit(){if(!profile.value||coordinateError.value||unchanged.value)return;busy.value=true;error.value='';try{const body={operation_id:operation(),name:name.value.trim(),owner_type:ownerType.value,coordinates:coordinates.value as TerritoryPoint[]};const result=sourceId.value?await mutate<TerritoryRecord>(`/territories/${sourceId.value}/reapply`,'POST',body):await mutate<TerritoryRecord>('/territories','POST',body);await navigateTo(`/territories/${result.id}`)}catch(e){error.value=userFacingError(e)}finally{busy.value=false}}
onMounted(async()=>{try{await auth.refresh();if(!auth.authenticated.value)return;profile.value=await get<AccountRecord>('/accounts/me');await get('/accounts/me/map-color');if(sourceId.value){const source=await get<TerritoryRecord>(`/territories/${sourceId.value}`);if(!source.can_reapply)throw new Error('この領地は再申請できません。');name.value=source.name;ownerType.value=source.owner.type;coordinates.value=source.coordinates.map(p=>({...p}));initial.value=snapshot.value}}catch(e){error.value=userFacingError(e)}finally{loading.value=false}})
</script>
