<template>
  <section>
    <UiPageTitle title="お知らせ一覧" />
    <p v-if="loading" role="status">記事一覧を読み込んでいます…</p>
    <div v-else-if="!isAdmin" class="alert alert-warning" role="alert">
      お知らせ管理には管理者権限が必要です。<NuxtLink to="/login">ログイン</NuxtLink>
    </div>
    <template v-else>
      <div class="d-flex flex-wrap gap-2 mb-3">
        <NuxtLink to="/admin/notices/new" class="btn btn-primary">新規投稿</NuxtLink>
        <button type="button" class="btn btn-primary d-inline-flex align-items-center justify-content-center" :disabled="busy"
          aria-label="お知らせ一覧を更新" title="一覧更新" @click="reload"><UiBootstrapIcon name="arrow-clockwise" /></button>
      </div>
      <div v-if="errorMessage" class="alert alert-danger" role="alert">{{ errorMessage }}</div>
      <p v-if="!notices.length" role="status">記事はありません。</p>
      <div v-else class="list-group">
        <NuxtLink v-for="notice in notices" :key="notice.id" :to="`/admin/notices/${notice.id}/edit`"
          class="list-group-item list-group-item-action d-flex justify-content-between align-items-start gap-2">
          <div class="min-width-0 text-break d-grid gap-2">
            <strong>{{ notice.title }}</strong>
            <div v-if="notice.tags.length" class="d-inline-flex flex-wrap align-items-center gap-1 small text-body-secondary" aria-label="タグ">
              <UiBootstrapIcon name="tag" /><span>{{ notice.tags.map(tag => tag.name).join('、') }}</span>
            </div>
            <div class="d-flex flex-wrap gap-3 small text-body-secondary">
              <time :datetime="notice.created_at" class="d-inline-flex align-items-center gap-1" aria-label="作成日時"><UiBootstrapIcon name="calendar" />作成：{{ noticeDate(notice.created_at) }}</time>
              <time :datetime="notice.updated_at" class="d-inline-flex align-items-center gap-1" aria-label="更新日時"><UiBootstrapIcon name="clock" />更新：{{ noticeDate(notice.updated_at) }}</time>
              <time v-if="notice.published_at" :datetime="notice.published_at" class="d-inline-flex align-items-center gap-1" aria-label="公開日時"><UiBootstrapIcon name="calendar" />公開：{{ noticeDate(notice.published_at) }}</time>
            </div>
          </div>
          <span class="badge flex-shrink-0" :class="statusClass(notice.status)">{{ statusLabel(notice.status) }}</span>
        </NuxtLink>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { noticeDate } from '../../../utils/notice'
import { userFacingError } from '../../../utils/user-error'
type AdminNotice = {
  id: string; title: string; status: 'draft' | 'published' | 'unpublished'
  tags: { id: string; name: string }[]
  created_at: string; updated_at: string; published_at: string | null
}
const { public: { apiBase } } = useRuntimeConfig()
const { isAdmin, refresh } = useAccountSession()
const { showError } = useUiFeedback()
const loading = ref(true), busy = ref(false), errorMessage = ref('')
const notices = ref<AdminNotice[]>([])
const statusLabel = (status: AdminNotice['status']) => ({ draft: '下書き', published: '公開', unpublished: '非公開' })[status]
const statusClass = (status: AdminNotice['status']) => ({ draft: 'text-bg-secondary', published: 'text-bg-info', unpublished: 'text-bg-warning' })[status]
async function reload() {
  busy.value = true; errorMessage.value = ''
  try { notices.value = await $fetch<AdminNotice[]>(`${apiBase}/admin/notices`, { credentials: 'include' }) }
  catch (error) { errorMessage.value = userFacingError(error); showError(error) }
  finally { busy.value = false }
}
onMounted(async () => {
  try { await refresh(); if (isAdmin.value) await reload() }
  catch (error) { errorMessage.value = userFacingError(error); showError(error) }
  finally { loading.value = false }
})
</script>
