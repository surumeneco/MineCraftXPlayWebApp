<script setup lang="ts">
import { sortNotices } from '../utils/notice'

const { data: notices, status, error } = usePublicNotices()
const latest = computed(() => sortNotices(
  notices.value.filter(notice => !notice.is_draft && notice.published_at),
  'published_at',
).slice(0, 3))
</script>

<template>
  <section aria-labelledby="home-heading">
    <h1 id="home-heading" class="h2 mb-4">ホーム</h1>
    <div class="d-flex justify-content-between align-items-center gap-2 mb-3">
      <h2 class="h4 mb-0">最新のお知らせ</h2>
      <NuxtLink to="/info/notice">お知らせ一覧</NuxtLink>
    </div>
    <p v-if="status === 'pending' || status === 'idle'" role="status">お知らせを読み込んでいます…</p>
    <p v-else-if="error" class="text-body-secondary">お知らせを取得できませんでした。</p>
    <p v-else-if="latest.length === 0">公開中のお知らせはありません。</p>
    <div v-else class="d-grid gap-3">
      <NoticeBanner v-for="notice in latest" :key="notice.id" :notice="notice" :lines="3" />
    </div>
  </section>
</template>
