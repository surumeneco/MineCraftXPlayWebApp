<script setup lang="ts">
const props = withDefaults(defineProps<{
  to?: string
  type?: 'button' | 'submit' | 'reset'
  variant?: 'primary' | 'secondary' | 'danger' | 'outline-primary' | 'outline-secondary'
  size?: 'sm' | 'lg'
  block?: boolean
  disabled?: boolean
  loading?: boolean
  pressed?: boolean
}>(), {
  type: 'button',
  variant: 'primary',
})

const emit = defineEmits<{ click: [event: MouseEvent] }>()
const classes = computed(() => [
  'btn', `btn-${props.variant}`,
  props.size && `btn-${props.size}`,
  props.block && 'w-100',
])
</script>

<template>
  <NuxtLink v-if="to && !disabled && !loading" :to="to" :class="classes">
    <slot />
  </NuxtLink>
  <button
    v-else
    :type="type"
    :class="classes"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
    :aria-pressed="pressed"
    @click="emit('click', $event)"
  >
    <slot />
  </button>
</template>
