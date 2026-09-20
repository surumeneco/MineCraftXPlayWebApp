<template>
  <section aria-labelledby="notice-heading">
    <UiPageTitle id="notice-heading" title="お知らせ" />
    <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-end gap-3 mb-4">
      <div>
        <div class="form-label mb-1">並び替え</div>
        <div class="btn-group" role="group" aria-label="お知らせの並び替え">
          <UiButton :variant="sortBy === 'published_at' ? 'primary' : 'outline-primary'" :pressed="sortBy === 'published_at'" @click="sortBy = 'published_at'">投稿日時順</UiButton>
          <UiButton :variant="sortBy === 'updated_at' ? 'primary' : 'outline-primary'" :pressed="sortBy === 'updated_at'" @click="sortBy = 'updated_at'">更新日時順</UiButton>
        </div>
      </div>
      <div class="flex-grow-1" style="max-width: 20rem">
        <UiSelect v-model="tagId" label="タグで絞り込み" :options="tagOptions" />
      </div>
    </div>

    <p v-if="status === 'pending' || status === 'idle'" role="status">お知らせを読み込んでいます…</p>
    <div v-else-if="error" class="alert alert-danger" role="alert">
      お知らせを取得できませんでした。
      <UiButton variant="outline-secondary" size="sm" @click="refresh()">再読み込み</UiButton>
    </div>
    <p v-else-if="displayed.length === 0" role="status">該当するお知らせはありません。</p>
    <div v-else class="d-grid gap-3">
      <NoticeBanner v-for="notice in displayed" :key="notice.id" :notice="notice" :lines="3" />
    </div>
  </section>
</template>

<script setup lang="ts">
import type { NoticeTag } from '../../../types/notice'
import { sortNotices } from '../../../utils/notice'

const { public: { apiBase } } = useRuntimeConfig()
const { data: notices, status, error, refresh } = usePublicNotices()
const { data: masterTags } = useFetch<NoticeTag[]>(`${apiBase}/tags`, {
  key: 'public-notice-tags',
  server: false,
  lazy: true,
  default: () => [],
})
const sortBy = ref<'published_at' | 'updated_at'>('published_at')
const tagId = ref('')
const published = computed(() => notices.value.filter(notice => !notice.is_draft && notice.published_at))
const tags = computed(() => {
  const all = new Map<string, NoticeTag>()
  for (const tag of [...masterTags.value, ...published.value.flatMap(notice => notice.tags)]) {
    all.set(String(tag.id), tag)
  }
  return [...all.values()].sort((a, b) => a.name.localeCompare(b.name, 'ja'))
})
const tagOptions = computed(() => [
  { value: '', label: 'すべてのタグ' },
  ...tags.value.map(tag => ({ value: String(tag.id), label: tag.name })),
])
const displayed = computed(() => sortNotices(
  published.value.filter(notice => !tagId.value || notice.tags.some(tag => String(tag.id) === tagId.value)),
  sortBy.value,
))
</script>
