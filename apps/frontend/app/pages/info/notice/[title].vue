<script setup lang="ts">
import type { Notice } from '../../../types/notice'
import { noticeDate } from '../../../utils/notice'

const route = useRoute()
const { public: { apiBase } } = useRuntimeConfig()
const title = computed(() => String(route.params.title ?? ''))
const { data: notice, status, error, refresh } = useFetch<Notice>(
  () => `${apiBase}/notices/${encodeURIComponent(title.value)}`,
  { server: false, lazy: true },
)
const editor = ref<HTMLDivElement | null>(null)
const { $loadQuill } = useNuxtApp()
let viewer: InstanceType<Awaited<ReturnType<typeof $loadQuill>>> | null = null

watch([notice, editor], async ([item, element]) => {
  if (!item || item.is_draft || !element) return
  const Quill = await $loadQuill()
  if (element !== editor.value || item !== notice.value) return
  if (!viewer || viewer.root.parentElement !== element) {
    viewer = new Quill(element, { theme: 'bubble', readOnly: true, modules: { toolbar: false } })
  }
  viewer.setContents(item.body_delta as Parameters<typeof viewer.setContents>[0])
  viewer.disable()
}, { immediate: true, flush: 'post' })
</script>

<template>
  <article>
    <NuxtLink to="/info/notice" class="d-inline-block mb-3">お知らせ一覧に戻る</NuxtLink>
    <p v-if="status === 'pending' || status === 'idle'" role="status">お知らせを読み込んでいます…</p>
    <div v-else-if="error" class="alert alert-danger" role="alert">
      お知らせを取得できませんでした。URLを確認してください。
      <UiButton variant="outline-secondary" size="sm" @click="refresh()">再読み込み</UiButton>
    </div>
    <p v-else-if="!notice || notice.is_draft || !notice.published_at" role="status">お知らせが見つかりません。</p>
    <template v-else>
      <h1 class="h2 mb-3 text-break">{{ notice.title }}</h1>
      <div class="d-flex flex-wrap gap-3 small text-body-secondary mb-3">
        <time :datetime="notice.published_at">投稿日時：{{ noticeDate(notice.published_at) }}</time>
        <time v-if="notice.updated_at" :datetime="notice.updated_at">更新日時：{{ noticeDate(notice.updated_at) }}</time>
      </div>
      <div class="d-flex flex-wrap gap-2 mb-4" aria-label="タグ">
        <span v-for="tag in notice.tags" :key="tag.id" class="badge text-bg-secondary">{{ tag.name }}</span>
      </div>
      <ClientOnly>
        <div ref="editor" aria-label="お知らせ本文" />
        <template #fallback><p>本文を表示しています…</p></template>
      </ClientOnly>
    </template>
  </article>
</template>
