<template>
  <NuxtLink :to="to" class="xplay-card-link">
    <span class="xplay-card-link__label"><slot>{{ label }}</slot></span>
    <span class="xplay-card-link__arrow" aria-hidden="true">→</span>
  </NuxtLink>
</template>

<script setup lang="ts">
defineProps<{
  to: string
  label?: string
}>()
</script>
