<template>
  <div v-if="imageId && !failed" class="territory-image border rounded overflow-hidden">
    <img :src="source" :alt="`${name}の領地画像`" loading="lazy" class="territory-image__img" @error="failed=true" />
  </div>
</template>
<script setup lang="ts">
const props = defineProps<{ imageId?: string | null; name: string }>()
const { public: { apiBase } } = useRuntimeConfig()
const failed = ref(false)
watch(() => props.imageId, () => { failed.value = false })
const source = computed(() => `${apiBase}/territory-images/${props.imageId}`)
</script>
<style scoped>
.territory-image { width: 100%; aspect-ratio: 16 / 9; background: var(--xplay-panel-soft); }
.territory-image__img { display: block; width: 100%; height: 100%; object-fit: cover; }
</style>
