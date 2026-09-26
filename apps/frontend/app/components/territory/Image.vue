<template>
  <div class="territory-image border rounded overflow-hidden">
    <img :src="source" :alt="imageId ? `${name}の領地画像` : '領地の既定画像'"
      loading="lazy" class="territory-image__img" @error="failed=true" />
  </div>
</template>
<script setup lang="ts">
const props = defineProps<{ imageId?: string | null; name: string }>()
const { public: { apiBase } } = useRuntimeConfig()
const failed = ref(false)
watch(() => props.imageId, () => { failed.value = false })
const source = computed(() => props.imageId && !failed.value
  ? `${apiBase}/territory-images/${props.imageId}` : '/images/card-default.svg')
</script>
<style scoped>
.territory-image { width: 100%; max-width: 48rem; aspect-ratio: 16 / 9; background: var(--xplay-panel-soft); }
.territory-image__img { display: block; width: 100%; height: 100%; object-fit: cover; }
</style>
