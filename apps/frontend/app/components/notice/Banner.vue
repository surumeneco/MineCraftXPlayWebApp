<script setup lang="ts">
import type { Notice } from '../../types/notice'
import { noticeDate, noticePreview, noticeUrl } from '../../utils/notice'

const props = withDefaults(defineProps<{
  notice: Notice
  lines?: number
  previewLength?: number
}>(), { lines: 3, previewLength: 200 })

const previewLines = computed(() => Number.isInteger(props.lines) && props.lines > 0 ? props.lines : 3)
const preview = computed(() => noticePreview(props.notice.body_delta, props.previewLength))
</script>

<template>
  <article class="notice-banner card w-100" :style="{ '--notice-lines': previewLines, '--notice-preview-height': `${previewLines * 1.5}em` }">
    <div class="card-body d-flex flex-column gap-2">
      <h3 class="h5 card-title mb-0 text-break">{{ notice.title }}</h3>
      <div class="d-flex flex-wrap gap-2 small text-body-secondary">
        <time v-if="notice.published_at" :datetime="notice.published_at">投稿日時：{{ noticeDate(notice.published_at) }}</time>
        <time v-if="notice.updated_at" :datetime="notice.updated_at">更新日時：{{ noticeDate(notice.updated_at) }}</time>
      </div>
      <div v-if="notice.tags.length" class="d-flex flex-wrap gap-1" aria-label="タグ">
        <span v-for="tag in notice.tags" :key="tag.id" class="badge text-bg-secondary">{{ tag.name }}</span>
      </div>
      <p class="notice-preview card-text mb-0">{{ preview }}</p>
      <div class="text-end mt-auto">
        <UiButton :to="noticeUrl(notice.title)" variant="outline-primary" size="sm">詳細を見る</UiButton>
      </div>
    </div>
  </article>
</template>

<style scoped>
.notice-banner { min-width: 0; }
.notice-preview {
  line-height: 1.5;
  height: var(--notice-preview-height);
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: var(--notice-lines);
  overflow: hidden;
  overflow-wrap: anywhere;
}
</style>
