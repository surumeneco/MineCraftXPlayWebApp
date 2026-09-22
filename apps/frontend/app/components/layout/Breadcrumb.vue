<template>
  <nav aria-label="breadcrumb" class="xplay-breadcrumb mb-3">
    <button type="button" class="xplay-breadcrumb__back" aria-label="前のページに戻る" title="戻る" @click="goBack">
      <UiBootstrapIcon name="arrow-left" />
    </button>
    <span class="xplay-breadcrumb__divider" aria-hidden="true" />
    <ol class="breadcrumb small mb-0 flex-wrap">
      <li v-for="(item, index) in items" :key="`${item.to ?? 'current'}-${index}`"
        class="breadcrumb-item" :class="{ active: index === items.length - 1 }"
        :aria-current="index === items.length - 1 ? 'page' : undefined">
        <UiBootstrapIcon v-if="index > 0" name="chevron-right" />
        <NuxtLink v-if="index < items.length - 1 && item.to" :to="item.to">{{ item.label }}</NuxtLink>
        <span v-else class="text-break">{{ item.label }}</span>
      </li>
    </ol>
  </nav>
</template>

<script setup lang="ts">
type Crumb = { label: string; to?: string }
const route = useRoute()
const router = useRouter()
const labels: Record<string, string> = {
  info: '情報', notice: 'お知らせ', about: 'コミュニティ概要', operators: '運営メンバー紹介',
  server: 'サーバー情報', rules: '運営方針とルール', login: 'ログイン', account: 'アカウント',
  admin: '管理', accounts: 'アカウント管理', merge: 'アカウント統合', edit: '編集',
}
const items = computed<Crumb[]>(() => {
  const home: Crumb = { label: 'ホーム', to: '/' }
  const path = route.path.replace(/\/$/, '') || '/'
  if (path === '/') return [{ label: 'ホーム' }]
  if (path === '/admin/notices') return [home, { label: 'お知らせ管理', to: '/admin/notices' }, { label: 'お知らせ一覧' }]
  if (path === '/admin/notices/new') return [home, { label: 'お知らせ管理', to: '/admin/notices' }, { label: '新規投稿' }]
  if (/^\/admin\/notices\/[^/]+\/edit$/.test(path)) return [home, { label: 'お知らせ管理', to: '/admin/notices' }, { label: 'お知らせ一覧', to: '/admin/notices' }, { label: '記事編集' }]
  if (path === '/admin/master') return [home, { label: 'マスタメンテ' }]
  if (path === '/admin/accounts') return [home, { label: 'マスタメンテ', to: '/admin/master' }, { label: 'アカウント管理' }]
  if (path === '/admin/accounts/merge') return [home, { label: 'マスタメンテ', to: '/admin/master' }, { label: 'アカウント管理', to: '/admin/accounts' }, { label: 'アカウント統合' }]
  if (/^\/admin\/accounts\/[^/]+\/edit$/.test(path)) return [home, { label: 'マスタメンテ', to: '/admin/master' }, { label: 'アカウント管理', to: '/admin/accounts' }, { label: 'アカウント編集' }]
  if (/^\/info\/notice\/[^/]+$/.test(path)) {
    const title = String(route.params.title ?? path.split('/').at(-1) ?? '')
    return [home, { label: '情報', to: '/info' }, { label: 'お知らせ', to: '/info/notice' }, { label: title }]
  }
  const segments = path.split('/').filter(Boolean)
  return [home, ...segments.map((segment, index) => ({
    label: labels[segment] ?? decodeURIComponent(segment),
    ...(index < segments.length - 1 ? { to: '/' + segments.slice(0, index + 1).join('/') } : {}),
  }))]
})
function goBack() {
  const state = window.history.state as { back?: string | null } | null
  if (typeof state?.back === 'string' && state.back.startsWith('/')) router.back()
  else void navigateTo(items.value.at(-2)?.to ?? '/')
}
</script>

<style scoped>
.xplay-breadcrumb { display: flex; align-items: center; gap: .85rem; padding: .8rem 1rem;
  border: 1px solid var(--bs-border-color);
  background: var(--bs-tertiary-bg); border-radius: .5rem; box-shadow: 0 .15rem .45rem rgba(0,0,0,.12); }
.xplay-breadcrumb__back { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center;
  padding: .35rem; border: 0; background: transparent; color: var(--bs-body-color); border-radius: .3rem; cursor: pointer; }
.xplay-breadcrumb__back:hover { color: var(--xplay-main-soft); background: var(--xplay-panel-soft); }
.xplay-breadcrumb__divider { flex: 0 0 1px; align-self: stretch; min-height: 1.4rem; background: var(--bs-border-color); }
.breadcrumb { align-items: center; min-width: 0; }
.breadcrumb-item { display: inline-flex; align-items: center; gap: .5rem; overflow-wrap: anywhere; }
.breadcrumb-item + .breadcrumb-item::before { content: none; }
.breadcrumb-item :deep(.bi::before) { font-size: .75rem; }
.breadcrumb-item a { color: var(--bs-link-color); }
.breadcrumb-item.active { color: var(--bs-body-color); font-weight: 600; }
@media (max-width: 575.98px) { .xplay-breadcrumb { padding: .65rem; gap: .5rem; } }
</style>
