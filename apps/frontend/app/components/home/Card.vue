<template>
  <UiCard v-if="resolved"
    :title="resolved.title"
    :note="resolved.note"
    :image="imageSource(resolved.image)"
    hide-image-when-unset
    :to="!isNative(resolved.url) ? destination(resolved.url) : undefined"
    :url="isNative(resolved.url) ? destination(resolved.url) : undefined"
    :native="isNative(resolved.url)"
    :new-tab="resolved.new_tab"
  />
</template>

<script setup lang="ts">
import type { HomeCardConfig, HubCardConfig, HubCardLink, ManagedCardImage } from '../../composables/useHomeLayout'

const props = defineProps<{
  card: HomeCardConfig
  hubs: HubCardConfig[]
  links: HubCardLink[]
}>()
const { imageSource, destination, isNative } = useHomeLayout()
const resolved = computed<{
  title: string; note: string; url: string; image: ManagedCardImage; new_tab: boolean
} | null>(() => {
  if (props.card.type === 'custom') {
    return { title: props.card.title || '', note: props.card.note || '', url: props.card.url || '',
      image: props.card.image ?? null, new_tab: !!props.card.new_tab }
  }
  const link = props.links.find(item => item.key === props.card.hub_key)
  const hub = props.hubs.find(item => item.key === props.card.hub_key)
  if (!link || !hub) return null
  return { title: link.title, url: link.url, note: hub.note, image: hub.image, new_tab: false }
})
</script>
