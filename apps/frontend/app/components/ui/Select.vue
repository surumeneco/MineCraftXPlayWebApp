<template>
  <div>
    <label v-if="label" class="form-label" :for="selectId">{{ label }}</label>
    <select
      :id="selectId"
      class="form-select"
      :class="{ 'is-invalid': !!error }"
      :value="modelValue"
      :disabled="disabled"
      :required="required"
      :aria-invalid="error ? 'true' : undefined"
      @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option>
    </select>
    <div v-if="error" class="invalid-feedback">{{ error }}</div>
  </div>
</template>

<script setup lang="ts">
interface SelectOption {
  value: string
  label: string
}
const props = defineProps<{
  modelValue: string
  options: SelectOption[]
  id?: string
  label?: string
  disabled?: boolean
  required?: boolean
  error?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const generatedId = useId()
const selectId = computed(() => props.id ?? generatedId)
</script>
