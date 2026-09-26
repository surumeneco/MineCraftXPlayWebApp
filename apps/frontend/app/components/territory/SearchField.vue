<template>
  <div class="territory-search position-relative">
    <input :id="inputId" :value="modelValue" type="search" class="form-control"
      :placeholder="placeholder" :aria-label="label" role="combobox"
      aria-autocomplete="list" :aria-expanded="open && candidates.length > 0"
      :aria-controls="listId" :aria-activedescendant="open && active >= 0 ? `${listId}-${active}` : undefined"
      autocomplete="off" @input="onInput" @focus="open = true"
      @blur="open = false" @keydown.down.prevent="move(1)" @keydown.up.prevent="move(-1)"
      @keydown.esc="open = false" @keydown.enter="onEnter" />
    <ul v-if="open && candidates.length" :id="listId"
      class="dropdown-menu show w-100 territory-search__results" role="listbox" :aria-label="`${label}の候補`">
      <li v-for="(candidate, index) in candidates" :key="candidate" role="presentation">
        <button :id="`${listId}-${index}`" type="button" class="dropdown-item text-wrap"
          role="option" :aria-selected="index === active" :class="{active: index === active}"
          @mousedown.prevent @click="choose(candidate)">{{ candidate }}</button>
      </li>
    </ul>
  </div>
</template>
<script setup lang="ts">
const props = defineProps<{
  modelValue: string
  options: string[]
  placeholder: string
  label: string
}>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
  selected: []
}>()
const id = useId()
const inputId = `territory-search-${id}`
const listId = `territory-suggestions-${id}`
const open = ref(false)
const active = ref(-1)
const normalized = (value: string) => value.normalize('NFKC').toLocaleLowerCase('ja')
const candidates = computed(() => {
  const q = normalized(props.modelValue.trim())
  const distinct = [...new Set(props.options.map(value => value.trim()).filter(Boolean))]
  return distinct.filter(value => normalized(value).includes(q))
    .sort((a, b) => {
      const aStarts = normalized(a).startsWith(q) ? 0 : 1
      const bStarts = normalized(b).startsWith(q) ? 0 : 1
      return aStarts - bStarts || a.localeCompare(b, 'ja')
    }).slice(0, 8)
})
function onInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
  active.value = -1
  open.value = true
}
function move(delta: number) {
  if (!candidates.value.length) return
  open.value = true
  active.value = (active.value + delta + candidates.value.length) % candidates.value.length
}
function choose(value: string) {
  emit('update:modelValue', value)
  open.value = false
  active.value = -1
  emit('selected')
}
function onEnter(event: KeyboardEvent) {
  if (!open.value || active.value < 0 || !candidates.value[active.value]) return
  event.preventDefault()
  choose(candidates.value[active.value])
}
</script>
<style scoped>
.territory-search__results { max-height: 16rem; overflow-y: auto; z-index: 1050; }
</style>
