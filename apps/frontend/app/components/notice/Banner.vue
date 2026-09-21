<template>
  <NuxtLink :to="noticeUrl(notice.title)" class="notice-banner card w-100 text-decoration-none text-body"
    :style="{ '--notice-lines': previewLines, '--notice-preview-max-height': `${previewLines * 1.5}em` }"
    :aria-label="`${notice.title} の詳細を見る`">
    <div class="card-body d-flex flex-column gap-2">
      <h3 class="h5 card-title mb-0 text-break">{{ notice.title }}</h3>
      <NoticeMeta :published-at="notice.published_at" :updated-at="notice.updated_at" :tags="notice.tags" />
      <p v-if="preview" class="notice-preview card-text mb-0">{{ preview }}</p>
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
import type { Notice } from '../../types/notice'
import { noticePreview, noticeUrl } from '../../utils/notice'

const props = withDefaults(defineProps<{
  notice: Notice
  lines?: number
  previewLength?: number
}>(), { lines: 3, previewLength: 200 })

const previewLines = computed(() => Number.isInteger(props.lines) && props.lines > 0 ? props.lines : 3)
const preview = computed(() => noticePreview(props.notice.body_delta, props.previewLength))
</script>

<style scoped>
.notice-banner { min-width: 0; container-type: inline-size; transition: border-color .15s, box-shadow .15s; }
.notice-banner:hover { border-color: var(--bs-primary); box-shadow: 0 .15rem .55rem rgba(0, 0, 0, .18); }
.notice-banner:focus-visible { outline: 3px solid var(--bs-primary); outline-offset: 3px; }
.notice-preview {
  line-height: 1.5;
  max-height: var(--notice-preview-max-height);
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: var(--notice-lines);
  overflow: hidden;
  overflow-wrap: anywhere;
}
@media (prefers-reduced-motion: reduce) { .notice-banner { transition: none; } }
</style>
