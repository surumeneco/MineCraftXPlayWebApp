<template>
  <img
    v-if="!failed"
    class="xplay-operator-photo"
    :src="`/images/operators/${filename}`"
    :alt="`${name}の紹介画像`"
    loading="lazy"
    decoding="async"
    @error="failed = true"
  >
</template>

<script setup lang="ts">
defineProps<{
  filename: string
  name: string
}>()

// The image is optional: members without an uploaded file retain their text-only layout.
const failed = ref(false)
</script>

<style scoped lang="scss">
.xplay-operator-photo {
  display: block;
  width: auto;
  max-width: 100%;
  height: auto;
  max-height: 28rem;
  margin: 0 auto 1rem;
  object-fit: contain;
  border: 1px solid var(--xplay-border);
  border-radius: var(--xplay-panel-radius);
}
</style>
