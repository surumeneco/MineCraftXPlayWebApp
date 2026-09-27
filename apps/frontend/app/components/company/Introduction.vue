<template>
  <ClientOnly>
    <div ref="target" class="xplay-notice-readonly" aria-label="企業紹介文" />
    <template #fallback><p>紹介文を読み込んでいます…</p></template>
  </ClientOnly>
</template>
<script setup lang="ts">
import type { CompanyRecord } from '../../types/company'
const props=defineProps<{ value:CompanyRecord['introduction_delta'] }>()
const target=ref<HTMLDivElement|null>(null)
const { $loadQuill }=useNuxtApp()
let viewer: InstanceType<Awaited<ReturnType<typeof $loadQuill>>>|null=null
watch([()=>props.value,target],async ([value,element])=>{
  if(!element)return
  const Quill=await $loadQuill()
  if(element!==target.value)return
  if(!viewer || viewer.root.parentElement!==element){
    viewer=new Quill(element,{theme:'bubble',readOnly:true,modules:{toolbar:false}})
  }
  viewer.setContents(value as Parameters<typeof viewer.setContents>[0])
  viewer.disable()
},{immediate:true,flush:'post'})
</script>
