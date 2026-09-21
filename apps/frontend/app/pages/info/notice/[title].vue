<template>
  <article>
    <p v-if="status === 'pending' || status === 'idle'" role="status">お知らせを読み込んでいます…</p>
    <div v-else-if="error" class="alert alert-danger" role="alert">
      お知らせを取得できませんでした。URLを確認してください。
      <button type="button" class="btn btn-sm btn-primary" aria-label="お知らせを再読み込み" title="再読み込み" @click="refresh()"><UiBootstrapIcon name="arrow-clockwise" /></button>
    </div>
    <p v-else-if="!notice || notice.is_draft || !notice.published_at" role="status">お知らせが見つかりません。</p>
    <template v-else>
      <UiPageTitle><span class="text-break">{{ notice.title }}</span></UiPageTitle>
      <div class="mb-4"><NoticeMeta :published-at="notice.published_at" :updated-at="notice.updated_at" :tags="notice.tags" /></div>
      <ClientOnly>
        <div ref="editor" aria-label="お知らせ本文" />
        <template #fallback><p>本文を表示しています…</p></template>
      </ClientOnly>
    </template>
  </article>
</template>

<script setup lang="ts">
import type { Notice } from '../../../types/notice'

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
