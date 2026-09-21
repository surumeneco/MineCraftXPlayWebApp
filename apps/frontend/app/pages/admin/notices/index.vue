<template>
  <section>
    <h1 class="h2 mb-3">お知らせ一覧</h1>
    <p v-if="loading" role="status">記事一覧を読み込んでいます…</p>
    <div v-else-if="!isAdmin" class="alert alert-warning" role="alert">
      お知らせ管理には管理者権限が必要です。<NuxtLink to="/login">ログイン</NuxtLink>
    </div>
    <template v-else>
      <div class="d-flex flex-wrap gap-2 mb-3">
        <NuxtLink to="/admin/notices/new" class="btn btn-primary">お知らせ投稿</NuxtLink>
        <button type="button" class="btn btn-outline-secondary" :disabled="busy" @click="reload">一覧更新</button>
        <NuxtLink to="/admin/accounts" class="btn btn-outline-secondary ms-auto">アカウント管理</NuxtLink>
      </div>
      <div v-if="errorMessage" class="alert alert-danger" role="alert">{{ errorMessage }}</div>
      <p v-if="!notices.length" role="status">記事はありません。</p>
      <div v-else class="list-group">
        <NuxtLink v-for="notice in notices" :key="notice.id" :to="`/admin/notices/${notice.id}/edit`"
          class="list-group-item list-group-item-action d-flex justify-content-between align-items-center gap-2">
          <span class="text-break">{{ notice.title }}</span>
          <span class="badge text-bg-secondary flex-shrink-0">{{ statusLabel(notice.status) }}</span>
        </NuxtLink>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
type AdminNotice = { id: string; title: string; status: 'draft' | 'published' | 'unpublished' }
const { public: { apiBase } } = useRuntimeConfig()
const { isAdmin, refresh } = useAccountSession()
const loading = ref(true), busy = ref(false), errorMessage = ref('')
const notices = ref<AdminNotice[]>([])
const statusLabel = (status: AdminNotice['status']) => ({ draft: '下書き', published: '公開', unpublished: '非公開' })[status]
async function reload() {
  busy.value = true; errorMessage.value = ''
  try { notices.value = await $fetch<AdminNotice[]>(`${apiBase}/admin/notices`, { credentials: 'include' }) }
  catch { errorMessage.value = '記事一覧を取得できませんでした。' }
  finally { busy.value = false }
}
onMounted(async () => {
  await refresh()
  if (isAdmin.value) await reload()
  loading.value = false
})
</script>
