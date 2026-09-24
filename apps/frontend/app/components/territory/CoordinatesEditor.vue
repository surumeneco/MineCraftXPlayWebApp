<template>
  <div>
    <div v-for="(point,index) in local" :key="index" class="row g-2 align-items-center mb-2">
      <div class="col"><label class="visually-hidden" :for="`coord-x-${index}`">X</label><input :id="`coord-x-${index}`" v-model.number="point.x" type="number" step="1" class="form-control" placeholder="X" @input="emitValue" /></div>
      <div class="col"><label class="visually-hidden" :for="`coord-z-${index}`">Z</label><input :id="`coord-z-${index}`" v-model.number="point.z" type="number" step="1" class="form-control" placeholder="Z" @input="emitValue" /></div>
      <div class="col-auto"><button type="button" class="btn btn-outline-danger" :disabled="local.length<=minPoints" @click="remove(index)">削除</button></div>
    </div>
    <button type="button" class="btn btn-outline-secondary btn-sm" @click="add">座標を追加</button>
    <p v-if="error" class="text-danger small mt-2 mb-0">{{ error }}</p>
  </div>
</template>
<script setup lang="ts">
import type { TerritoryPoint } from '../../utils/territory'
import { territoryCoordinateError } from '../../utils/territory'
const props=withDefaults(defineProps<{modelValue:TerritoryPoint[];minPoints?:number}>(),{minPoints:3})
const emit=defineEmits<{ 'update:modelValue':[TerritoryPoint[]] }>()
const local=ref<TerritoryPoint[]>(props.modelValue.map(p=>({...p})))
watch(()=>props.modelValue,(v)=>{if(JSON.stringify(v)!==JSON.stringify(local.value))local.value=v.map(p=>({...p}))},{deep:true})
const error=computed(()=>territoryCoordinateError(local.value,props.minPoints))
function emitValue(){emit('update:modelValue',local.value.map(p=>({x:Number(p.x),z:Number(p.z)})))}
function add(){local.value.push({x:0,z:0});emitValue()}
function remove(i:number){if(local.value.length>props.minPoints){local.value.splice(i,1);emitValue()}}
</script>
