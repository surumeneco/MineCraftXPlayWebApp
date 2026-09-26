<template>
  <div>
    <div v-for="(point, index) in local" :key="index" class="row g-2 align-items-center mb-2">
      <div class="col">
        <label class="visually-hidden" :for="`coord-x-${id}-${index}`">X座標</label>
        <input :id="`coord-x-${id}-${index}`" v-model="point.x" type="number" step="1"
          class="form-control" placeholder="x" inputmode="numeric" @input="emitValue" />
      </div>
      <div class="col">
        <label class="visually-hidden" :for="`coord-z-${id}-${index}`">Z座標</label>
        <input :id="`coord-z-${id}-${index}`" v-model="point.z" type="number" step="1"
          class="form-control" placeholder="z" inputmode="numeric" @input="emitValue" />
      </div>
      <div class="col-auto">
        <button type="button" class="btn btn-outline-danger"
          :disabled="local.length <= minPoints" @click="remove(index)">削除</button>
      </div>
    </div>
    <button type="button" class="btn btn-outline-secondary btn-sm" @click="add">座標を追加</button>
    <p v-if="error" class="text-danger small mt-2 mb-0">{{ error }}</p>
  </div>
</template>
<script setup lang="ts">
import type { TerritoryDraftPoint } from '../../utils/territory'
import { territoryCoordinateError } from '../../utils/territory'

const props = withDefaults(defineProps<{ modelValue: TerritoryDraftPoint[]; minPoints?: number }>(), { minPoints: 3 })
const emit = defineEmits<{ 'update:modelValue': [TerritoryDraftPoint[]] }>()
const id = useId()
type TextPoint = { x: string | number; z: string | number }
const textPoint = (value: TerritoryDraftPoint): TextPoint => ({
  x: value.x === null ? '' : String(value.x),
  z: value.z === null ? '' : String(value.z),
})
function integer(value: string | number): number | null {
  const trimmed = String(value).trim()
  if (!/^-?\d+$/.test(trimmed)) return null
  const parsed = Number(trimmed)
  return Number.isSafeInteger(parsed) ? parsed : null
}
const parsed = (values: TextPoint[]): TerritoryDraftPoint[] =>
  values.map(point => ({ x: integer(point.x), z: integer(point.z) }))
const local = ref<TextPoint[]>(props.modelValue.map(textPoint))
watch(() => props.modelValue, value => {
  // Keep a partially typed value (e.g. '-') rather than replacing it with zero.
  if (JSON.stringify(value) !== JSON.stringify(parsed(local.value))) {
    local.value = value.map(textPoint)
  }
}, { deep: true })
const error = computed(() => {
  if (local.value.length < props.minPoints || local.value.some(p => !String(p.x).trim() || !String(p.z).trim())) return ''
  return territoryCoordinateError(parsed(local.value), props.minPoints)
})
function emitValue() { emit('update:modelValue', parsed(local.value)) }
function add() { local.value.push({ x: '', z: '' }); emitValue() }
function remove(index: number) {
  if (local.value.length > props.minPoints) { local.value.splice(index, 1); emitValue() }
}
</script>
