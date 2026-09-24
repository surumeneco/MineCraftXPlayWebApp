<template><section><UiPageTitle :title="item?`領地審査 - ${item.name}`:'領地審査'" /><p v-if="loading">読み込んでいます…</p><p v-else-if="error" class="alert alert-danger">{{ error }}</p><template v-else-if="item">
  <dl class="row"><dt class="col-sm-3">申請者</dt><dd class="col-sm-9">{{ item.applicant.name }}</dd><dt class="col-sm-3">座標重心</dt><dd class="col-sm-9">{{ formatCentroid(item.centroid) }}</dd><dt class="col-sm-3">面積</dt><dd class="col-sm-9">{{ formatArea(item.area) }}</dd></dl>
  <div class="alert" :class="item.overlaps.approved.length||item.overlaps.pending.length?'alert-warning':'alert-success'"><strong>被り判定:</strong><div>承認済: {{ item.overlaps.approved.map(v=>v.name).join('、')||'なし' }}</div><div>申請中: {{ item.overlaps.pending.map(v=>v.name).join('、')||'なし' }}</div></div>
  <TerritoryBlueMapPreview class="mb-4" :coordinates="item.coordinates" />
  <h2 class="h4">座標</h2><ol><li v-for="(p,i) in item.coordinates" :key="i">X {{ p.x }} / Z {{ p.z }}</li></ol>
  <h2 class="h4 mt-4">申請者の他の領地</h2><div class="accordion mb-4"><UiAccordion v-for="status in statuses" :key="status" :title="`${territoryStatusLabel[status]} (${grouped[status].length})`"><ul class="list-group list-group-flush"><li v-for="other in grouped[status]" :key="other.id" class="list-group-item"><NuxtLink :to="`/territories/${other.id}`">{{ other.name }}</NuxtLink><span class="d-block small text-body-secondary">申請: {{ new Date(other.applied_at).toLocaleString('ja-JP') }} / 重心 {{ formatCentroid(other.centroid) }} / 面積 {{ formatArea(other.area) }}</span></li><li v-if="!grouped[status].length" class="list-group-item text-body-secondary">なし</li></ul></UiAccordion></div>
  <div class="mb-3"><label for="review-reason" class="form-label">差戻・却下理由</label><textarea id="review-reason" v-model="reason" class="form-control" rows="3" /></div>
  <div class="d-flex gap-2 flex-wrap"><button class="btn btn-success" :disabled="busy" @click="review('approve')">承認</button><button class="btn btn-warning" :disabled="busy||!reason.trim()" @click="review('return')">差戻</button><button class="btn btn-danger" :disabled="busy||!reason.trim()" @click="review('reject')">却下</button></div>
</template></section></template>
<script setup lang="ts">
import type {TerritoryRecord,TerritoryStatus} from '../../../../utils/territory'
import {formatArea,formatCentroid,territoryStatusLabel} from '../../../../utils/territory'
import {userFacingError} from '../../../../utils/user-error'
type Review=TerritoryRecord&{overlaps:{approved:Array<{id:string;name:string}>;pending:Array<{id:string;name:string}>};applicant_other_territories:TerritoryRecord[]}
const route=useRoute(),auth=useAccountSession(),{get,mutate}=useAccountApi(),item=ref<Review|null>(null),loading=ref(true),busy=ref(false),error=ref(''),reason=ref('')
const statuses:TerritoryStatus[]=['pending','approved','returned','withdrawn','rejected']
const grouped=computed(()=>Object.fromEntries(statuses.map(s=>[s,item.value?.applicant_other_territories.filter(v=>v.status===s)??[]])) as Record<TerritoryStatus,TerritoryRecord[]>)
async function review(action:'approve'|'return'|'reject'){busy.value=true;error.value='';try{await mutate(`/admin/territories/${route.params.id}/review`,'POST',{action,reason:reason.value});await navigateTo('/admin/territories')}catch(e){error.value=userFacingError(e)}finally{busy.value=false}}
onMounted(async()=>{try{await auth.refresh();if(auth.isAdmin.value)item.value=await get<Review>(`/admin/territories/${route.params.id}`)}catch(e){error.value=userFacingError(e)}finally{loading.value=false}})
</script>
