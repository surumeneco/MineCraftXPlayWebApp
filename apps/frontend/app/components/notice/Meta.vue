<template>
  <div class="d-flex flex-column gap-2">
    <div class="d-flex flex-wrap gap-3 small text-body-secondary">
      <time v-if="publishedAt" :datetime="publishedAt" class="d-inline-flex align-items-center gap-1" aria-label="投稿日時">
        <UiBootstrapIcon name="calendar" />
        <span class="notice-meta__full">{{ noticeDate(publishedAt) }}</span>
        <span class="notice-meta__short">{{ noticeDateOnly(publishedAt) }}</span>
      </time>
      <time v-if="updatedAt" :datetime="updatedAt" class="d-inline-flex align-items-center gap-1" aria-label="更新日時">
        <UiBootstrapIcon name="clock" />
        <span class="notice-meta__full">{{ noticeDate(updatedAt) }}</span>
        <span class="notice-meta__short">{{ noticeDateOnly(updatedAt) }}</span>
      </time>
    </div>
    <div v-if="tags.length" class="d-flex align-items-center flex-wrap gap-1 small text-body-secondary" aria-label="タグ">
      <UiBootstrapIcon name="tag" />
      <span class="d-inline-flex flex-wrap gap-2"><span v-for="tag in tags" :key="tag.id">{{ tag.name }}</span></span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { NoticeTag } from '../../types/notice'
import { noticeDate, noticeDateOnly } from '../../utils/notice'
defineProps<{ publishedAt?: string | null; updatedAt?: string | null; tags: NoticeTag[] }>()
</script>

<style scoped>
.notice-meta__short { display: none; }
@container (max-width: 34rem) {
  .notice-meta__full { display: none; }
  .notice-meta__short { display: inline; }
}
</style>
