<template>
  <aside aria-label="サイドメニュー">
    <div class="d-flex justify-content-between align-items-center gap-2 mb-3">
      <h2 class="h6 mb-0">お知らせ</h2>
      <NuxtLink to="/info/notice" class="small">一覧</NuxtLink>
    </div>
    <p v-if="status === 'pending' || status === 'idle'" class="small" role="status">読み込み中…</p>
    <p v-else-if="error" class="small text-body-secondary">お知らせを取得できませんでした。</p>
    <p v-else-if="latest.length === 0" class="small">公開中のお知らせはありません。</p>
    <div v-else class="d-grid gap-2">
      <NoticeBanner v-for="notice in latest" :key="notice.id" :notice="notice" :lines="2" :preview-length="120" />
    </div>
    <!-- TODO: Bluemap リンク -->
  </aside>
</template>

<script setup lang="ts">
import { sortNotices } from '../../utils/notice'

const { data: notices, status, error } = usePublicNotices()
const latest = computed(() => sortNotices(
  notices.value.filter(notice => !notice.is_draft && notice.published_at),
  'published_at',
).slice(0, 2))
</script>
