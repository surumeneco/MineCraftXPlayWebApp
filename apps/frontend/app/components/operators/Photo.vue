<template>
  <img
    v-if="source && !failed"
    class="xplay-operator-photo"
    :src="source"
    :alt="`${name}の紹介画像`"
    loading="lazy"
    decoding="async"
    @error="failed = true"
  >
</template>

<script setup lang="ts">
const props = defineProps<{
  memberKey: string
  name: string
}>()

const { public: { apiBase } } = useRuntimeConfig()
const source = computed(() => `${apiBase}/operator-photos/${encodeURIComponent(props.memberKey)}`)
const failed = ref(false)
watch(source, () => { failed.value = false })
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
