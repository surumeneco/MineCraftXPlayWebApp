<template>
  <section aria-labelledby="home-heading">
    <UiPageTitle id="home-heading" title="ホーム" />
    <div class="d-flex justify-content-between align-items-center gap-2 mb-3">
      <UiSectionHeading title="最新のお知らせ" class="mb-0 flex-grow-1" />
      <NuxtLink to="/info/notice" class="flex-shrink-0">お知らせ一覧</NuxtLink>
    </div>
    <p v-if="status === 'pending' || status === 'idle'" role="status">お知らせを読み込んでいます…</p>
    <p v-else-if="error" class="text-body-secondary">お知らせを取得できませんでした。</p>
    <p v-else-if="latest.length === 0">公開中のお知らせはありません。</p>
    <div v-else class="d-grid gap-3">
      <NoticeBanner v-for="notice in latest" :key="notice.id" :notice="notice" :lines="3" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { sortNotices } from '../utils/notice'

const { data: notices, status, error } = usePublicNotices()
const latest = computed(() => sortNotices(
  notices.value.filter(notice => !notice.is_draft && notice.published_at),
  'published_at',
).slice(0, 3))
</script>
