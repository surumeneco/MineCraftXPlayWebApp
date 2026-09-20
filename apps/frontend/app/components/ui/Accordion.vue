<template>
  <section class="accordion-item">
    <component :is="`h${headingLevel}`" class="accordion-header">
      <button
        :id="headerId"
        type="button"
        class="accordion-button"
        :class="{ collapsed: !expanded }"
        :aria-expanded="expanded"
        :aria-controls="panelId"
        :disabled="disabled"
        @click="toggle"
      >
        <slot name="header">{{ title }}</slot>
      </button>
    </component>
    <div
      :id="panelId"
      v-show="expanded"
      class="accordion-panel"
      role="region"
      :aria-labelledby="headerId"
    >
      <div class="accordion-body">
        <slot />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  title: string
  modelValue?: boolean
  defaultOpen?: boolean
  disabled?: boolean
  id?: string
  headingLevel?: 2 | 3 | 4 | 5 | 6
}>(), {
  defaultOpen: false,
  disabled: false,
  headingLevel: 3,
})

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
const generatedId = useId()
const panelId = computed(() => props.id ?? `accordion-panel-${generatedId}`)
const headerId = computed(() => `${panelId.value}-heading`)
const localOpen = ref(props.defaultOpen)
const expanded = computed(() => props.modelValue ?? localOpen.value)

function toggle() {
  if (props.disabled) return
  const next = !expanded.value
  localOpen.value = next
  emit('update:modelValue', next)
}
</script>
