<template><section>
  <UiPageTitle :title="territory?.name??'領地詳細'" />
  <p v-if="route.query.ownerSaved === '1'" class="alert alert-success" role="status">所有者の変更を保存しました。</p>
  <p v-if="loading">読み込んでいます…</p><p v-else-if="error" class="alert alert-danger">{{ error }}</p>
  <template v-else-if="territory">
    <div class="d-flex gap-2 flex-wrap justify-content-end mb-3"><NuxtLink v-if="territory.can_edit" :to="`/territories/${territory.id}/edit`" class="btn btn-primary"><i class="bi bi-pencil-square" aria-hidden="true" /><span class="visually-hidden">編集</span></NuxtLink><NuxtLink v-if="territory.can_reapply" :to="`/territories/apply?source=${territory.id}`" class="btn btn-primary">再申請</NuxtLink><button v-if="territory.can_withdraw" class="btn btn-outline-danger" :disabled="busy" @click="withdraw">取下</button></div>
    <TerritoryInfoGrid :territory="territory" />
    <section class="mb-4">
      <h2 class="h4">開発構想</h2>
      <p class="territory-multiline">{{ territory.development_concept || '未記入' }}</p>
      <template v-if="territory.can_edit_concept">
        <button v-if="!conceptEditing" class="btn btn-outline-secondary btn-sm" type="button" @click="conceptEditing=true">開発構想を編集</button>
        <form v-else @submit.prevent="saveConcept">
          <textarea v-model="conceptDraft" rows="5" maxlength="20000" class="form-control mb-2" aria-label="開発構想" />
          <p v-if="conceptError" class="alert alert-danger">{{ conceptError }}</p>
          <div class="d-flex gap-2 justify-content-end">
            <button type="button" class="btn btn-outline-secondary btn-sm" @click="conceptEditing=false;conceptDraft=territory.development_concept??''">キャンセル</button>
            <button type="submit" :disabled="conceptBusy" class="btn btn-primary btn-sm">保存</button>
          </div>
        </form>
        <p v-if="conceptSaved" class="alert alert-success mt-2" role="status">開発構想を保存しました。</p>
      </template>
    </section>
    <section v-if="territory.note !== undefined" class="mb-4"><h2 class="h4">備考</h2><p class="territory-multiline">{{ territory.note }}</p></section>
    <TerritoryImage v-if="territory.image_id" class="mb-3" :image-id="territory.image_id" :name="territory.name" />
    <TerritoryBlueMapPreview class="mb-4" :coordinates="territory.coordinates" />
    <h2 class="h4">座標</h2><TerritoryCoordinatesList :coordinates="territory.coordinates" />
    <template v-if="territory.nearby?.length"><h2 class="h4">近くの領地</h2><ul><li v-for="near in territory.nearby" :key="near.id"><NuxtLink :to="`/territories/${near.id}`">{{ near.name }}</NuxtLink></li></ul></template>
  </template>
</section></template>
<script setup lang="ts">
import type { TerritoryRecord } from '../../../utils/territory'
import { userFacingError } from '../../../utils/user-error'
const route=useRoute(),{get,mutate}=useAccountApi(),auth=useAccountSession()
const territory=ref<TerritoryRecord|null>(null),loading=ref(true),busy=ref(false),error=ref(''),withdrawOperationId=ref('')
const conceptDraft=ref(''),conceptEditing=ref(false),conceptBusy=ref(false),conceptSaved=ref(false),conceptError=ref('')
const withdrawOperation=()=>withdrawOperationId.value||(withdrawOperationId.value=crypto.randomUUID())
const breadcrumbNames = useState<Record<string,string>>('xplay-territory-breadcrumb-names', () => ({}))
const id=computed(()=>String(route.params.id))
async function load(){
  const value = await get<TerritoryRecord>(`/territories/${id.value}`)
  territory.value = value
  conceptDraft.value = value.development_concept ?? ''
  breadcrumbNames.value = { ...breadcrumbNames.value, [value.id]: value.name }
}
async function saveConcept(){
  if(!territory.value)return
  conceptBusy.value=true;conceptError.value='';conceptSaved.value=false
  try{
    await mutate(`/territories/${id.value}/concept`,'POST',{development_concept:conceptDraft.value})
    await load()
    conceptEditing.value=false
    conceptSaved.value=true
  }catch(e){conceptError.value=userFacingError(e)}finally{conceptBusy.value=false}
}
async function withdraw(){busy.value=true;error.value='';try{await mutate(`/territories/${id.value}/withdraw`,'POST',{operation_id:withdrawOperation()});await navigateTo(`/territories/apply?source=${id.value}`)}catch(e){error.value=userFacingError(e)}finally{busy.value=false}}
onMounted(async()=>{try{await auth.refresh();await load()}catch(e){error.value=userFacingError(e)}finally{loading.value=false}})
</script>

<style scoped>
.territory-multiline { white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
