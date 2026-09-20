<template>
  <div class="xplay-panel" :class="{ 'xplay-panel--inset': inset }">
    <slot />
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  inset?: boolean
}>(), {
  inset: false,
})
</script>
