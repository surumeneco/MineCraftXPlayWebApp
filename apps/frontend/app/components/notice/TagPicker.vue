<template>
  <fieldset class="border-0 p-0 m-0" :disabled="disabled">
    <legend class="fs-6">タグ</legend>
    <div class="row g-2 align-items-start">
      <div class="col-12 col-md-6">
        <div class="d-flex align-items-end gap-2">
          <div class="flex-grow-1 min-width-0">
            <UiSelect v-model="selectedTag" label="既存タグ" :options="choices" :disabled="disabled" @keydown.enter.prevent="addExisting" />
          </div>
          <UiButton variant="outline-secondary" class="flex-shrink-0" :disabled="disabled || !selectedTag" @click="addExisting">追加</UiButton>
        </div>
      </div>
      <div class="col-12 col-md-6">
        <div class="d-flex align-items-end gap-2">
          <div class="flex-grow-1 min-width-0" @keydown.enter.prevent="addNew">
            <UiTextInput v-model="newTag" label="新規タグ" placeholder="空白不可・20文字以内" :disabled="disabled" :error="error" @update:model-value="error = ''" />
          </div>
          <UiButton variant="outline-secondary" class="flex-shrink-0" :disabled="disabled" @click="addNew">追加</UiButton>
        </div>
      </div>
    </div>
    <div class="d-flex flex-wrap gap-2 mt-2" aria-label="選択済みタグ">
      <span v-for="name in modelValue" :key="name" class="badge text-bg-secondary d-inline-flex align-items-center gap-2">
        {{ name }}
        <button type="button" class="btn-close btn-close-white" :aria-label="`${name}を解除`" :disabled="disabled" @click="remove(name)" />
      </span>
    </div>
  </fieldset>
</template>

<script setup lang="ts">
import type { NoticeTag } from '../../types/notice'

const props = defineProps<{
  modelValue: string[]
  tags: NoticeTag[]
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()

const selectedTag = ref('')
const newTag = ref('')
const error = ref('')
const normalized = (name: string) => name.normalize('NFKC').toLowerCase()
const candidates = computed(() => props.tags
  .filter(tag => !props.modelValue.some(name => normalized(name) === normalized(tag.name)))
  .map(tag => ({ value: String(tag.id), label: tag.name })))
const choices = computed(() => [{ value: '', label: '既存タグを選択' }, ...candidates.value])

function addExisting() {
  if (props.disabled || !selectedTag.value) return
  const tag = props.tags.find(tag => String(tag.id) === selectedTag.value)
  if (tag && !props.modelValue.some(name => normalized(name) === normalized(tag.name))) {
    emit('update:modelValue', [...props.modelValue, tag.name])
  }
  selectedTag.value = ''
}

function addNew() {
  if (props.disabled) return
  const value = newTag.value
  if (!value || /\s/u.test(value) || Array.from(value).length > 20) {
    error.value = 'タグ名は1～20文字です。空白は使用できません。'
    return
  }
  const canonical = props.tags.find(tag => normalized(tag.name) === normalized(value))?.name ?? value
  if (!props.modelValue.some(name => normalized(name) === normalized(canonical))) {
    emit('update:modelValue', [...props.modelValue, canonical])
  }
  newTag.value = ''
  error.value = ''
}

function remove(name: string) {
  if (!props.disabled) emit('update:modelValue', props.modelValue.filter(value => value !== name))
}
</script>
