<template>
  <component :is="as" :id="id" class="xplay-page-title">
    <slot>{{ title }}</slot>
  </component>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
  as?: 'h1' | 'h2'
  id?: string
}>(), {
  as: 'h1',
})
</script>
