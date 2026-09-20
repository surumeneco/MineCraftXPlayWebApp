<template>
  <component :is="as" :id="id" class="xplay-section-heading">
    <slot>{{ title }}</slot>
  </component>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
  as?: 'h2' | 'h3' | 'h4'
  id?: string
}>(), {
  as: 'h2',
})
</script>
