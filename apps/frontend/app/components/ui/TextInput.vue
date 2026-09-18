<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue: string
  id?: string
  label?: string
  type?: 'text' | 'email' | 'password'
  placeholder?: string
  disabled?: boolean
  required?: boolean
  error?: string
  maxlength?: number
}>(), { type: 'text' })
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const generatedId = useId()
const inputId = computed(() => props.id ?? generatedId)
</script>

<template>
  <div>
    <label v-if="label" class="form-label" :for="inputId">{{ label }}</label>
    <input
      :id="inputId"
      class="form-control"
      :class="{ 'is-invalid': !!error }"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :required="required"
      :maxlength="maxlength"
      :aria-invalid="error ? 'true' : undefined"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    >
    <div v-if="error" class="invalid-feedback">{{ error }}</div>
  </div>
</template>
