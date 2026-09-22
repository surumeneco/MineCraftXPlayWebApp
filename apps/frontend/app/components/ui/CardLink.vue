<template>
  <NuxtLink :to="to" class="xplay-card-link">
    <span class="xplay-card-link__label"><slot>{{ label }}</slot></span>
    <span class="xplay-card-link__arrow" aria-hidden="true"><UiBootstrapIcon name="arrow-right-circle" /></span>
  </NuxtLink>
</template>

<script setup lang="ts">
defineProps<{
  to: string
  label?: string
}>()
</script>

<style scoped>
.xplay-card-link__arrow :deep(.bi::before) { font-size: 1em; }
</style>
