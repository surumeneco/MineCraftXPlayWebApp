<template>
  <div class="d-inline-flex flex-column gap-1" role="group" :aria-label="label">
    <span class="form-label mb-0">{{ label }}</span>
    <div class="d-inline-flex align-items-center gap-2">
      <span :class="{ 'fw-bold': modelValue === 'published_at' }">投稿日時順</span>
      <span class="form-check form-switch m-0 p-0">
        <input :id="inputId" class="form-check-input m-0" type="checkbox" role="switch"
          :checked="modelValue === 'updated_at'" aria-label="更新日時順で表示"
          @change="change" />
      </span>
      <label :for="inputId" :class="{ 'fw-bold': modelValue === 'updated_at' }">更新日時順</label>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ modelValue: 'published_at' | 'updated_at'; label?: string }>(), { label: '並び替え' })
const emit = defineEmits<{ 'update:modelValue': [value: 'published_at' | 'updated_at'] }>()
const inputId = useId()
function change(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).checked ? 'updated_at' : 'published_at')
}
</script>

<style scoped>
.form-check-input { width: 2.75rem; height: 1.5rem; cursor: pointer; }
.form-check-input:checked { background-color: var(--xplay-concept-main); border-color: var(--xplay-concept-main); }
.form-check-input:focus-visible { outline: 2px solid var(--xplay-focus-indicator-outer); outline-offset: 2px; }
label { cursor: pointer; }
</style>
