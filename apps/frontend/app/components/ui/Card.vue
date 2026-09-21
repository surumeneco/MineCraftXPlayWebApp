<template>
  <component
    :is="destination ? NuxtLink : 'article'"
    class="xplay-card"
    :class="{ 'xplay-card--link': Boolean(destination) }"
    :to="destination || undefined"
    :style="{ height: cardHeight }"
    :aria-label="destination && !title && !note ? 'リンク先を開く' : undefined"
  >
    <div class="xplay-card__media">
      <img class="xplay-card__image" :src="image?.trim() || defaultImage" alt="" loading="lazy" />
    </div>
    <div v-if="title || note" class="xplay-card__content">
      <h3 v-if="title" class="xplay-card__title">{{ title }}</h3>
      <p v-if="note" class="xplay-card__note">{{ note }}</p>
    </div>
  </component>
</template>

<script setup lang="ts">
import { NuxtLink } from '#components'

const defaultImage = '/images/card-default.svg'

const props = withDefaults(defineProps<{
  image?: string
  title?: string
  note?: string
  /** Internal destination. Takes precedence over url when both are set. */
  to?: string
  /** Alternative destination; absolute URLs are also supported. */
  url?: string
  /** Fixed height in pixels (number) or as a CSS length (string). */
  height?: number | string
}>(), { height: 320 })

const destination = computed(() => props.to?.trim() || props.url?.trim() || '')
const cardHeight = computed(() => typeof props.height === 'number' ? `${props.height}px` : props.height)
</script>

<style scoped>
.xplay-card {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  overflow: hidden;
  color: var(--xplay-text);
  background: var(--xplay-panel);
  border: 1px solid var(--xplay-border);
  border-radius: var(--xplay-panel-radius);
  box-shadow: var(--xplay-card-shadow);
  text-decoration: none;
}
.xplay-card--link {
  cursor: pointer;
  transition: border-color .2s ease, box-shadow .2s ease;
}
.xplay-card--link:hover {
  border-color: var(--xplay-main);
  box-shadow: var(--xplay-panel-shadow);
}
.xplay-card--link:focus-visible {
  outline: 2px solid var(--xplay-main-soft);
  outline-offset: 3px;
}
.xplay-card__media {
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
  background: var(--xplay-panel-soft);
}
.xplay-card__image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}
.xplay-card__content {
  flex: 0 1 auto;
  box-sizing: border-box;
  max-height: 55%;
  min-width: 0;
  overflow: hidden;
  padding: .85rem 1rem;
}
.xplay-card__title {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  overflow-wrap: anywhere;
  margin: 0;
  padding: 0;
  border: 0;
  color: var(--xplay-text);
  font-size: var(--xplay-font-lg);
  font-weight: 700;
  line-height: 1.35;
}
.xplay-card__note {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  overflow-wrap: anywhere;
  margin: .35rem 0 0;
  color: var(--xplay-text-muted);
  font-size: var(--xplay-font-sm);
  line-height: 1.45;
}
@media (prefers-reduced-motion: reduce) {
  .xplay-card--link { transition: none; }
}
</style>
