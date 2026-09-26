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
const territoryNames = useState<Record<string,string>>('xplay-territory-breadcrumb-names', () => ({}))
const territoryName = (id: string) => territoryNames.value[id] || '領地詳細'
const home: Crumb = { label: 'ホーム', to: '/' }
const info: Crumb = { label: '情報', to: '/info' }
const lists: Crumb = { label: '一覧', to: '/lists' }
const applications: Crumb = { label: '申請', to: '/applications' }
const territories: Crumb = { label: '領地一覧', to: '/territories' }
const requests: Crumb = { label: '申請一覧', to: '/admin/territories' }
const notices: Crumb = { label: 'お知らせ管理', to: '/admin/notices' }
const master: Crumb = { label: 'マスタメンテ', to: '/admin/master' }

const infoPages: Record<string,string> = {
  about: 'コミュニティ概要', operators: '運営メンバー紹介',
  server: 'サーバー情報', rules: '運営方針とルール',
}
const items = computed<Crumb[]>(() => {
  const path = route.path.replace(/\/$/, '') || '/'
  const id = String(route.params.id ?? '')
  if (path === '/') return [{ label: 'ホーム' }]
  if (path === '/info') return [home, { label: '情報' }]
  if (path === '/info/notice') return [home, info, { label: 'お知らせ' }]
  if (path.startsWith('/info/notice/')) {
    const title = String(route.params.title ?? 'お知らせ詳細')
    return [home, info, { label: 'お知らせ', to: '/info/notice' }, { label: title }]
  }
  if (path.startsWith('/info/') && infoPages[path.slice('/info/'.length)]) {
    return [home, info, { label: infoPages[path.slice('/info/'.length)] }]
  }
  if (path === '/lists') return [home, { label: '一覧' }]
  if (path === '/territories') return [home, lists, { label: '領地一覧' }]
  if (path === '/applications') return [home, { label: '申請' }]
  if (path === '/territories/apply') {
    if (typeof route.query.source === 'string' && route.query.source) {
      return [home, lists, territories,
        { label: territoryName(route.query.source), to: `/territories/${route.query.source}` },
        { label: '領地再申請' }]
    }
    return [home, applications, { label: '領地申請' }]
  }
  if (/^\/territories\/[^/]+\/edit$/.test(path)) {
    return [home, lists, territories,
      { label: territoryName(id), to: `/territories/${id}` },
      { label: '領地変更申請' }]
  }
  if (/^\/territories\/[^/]+$/.test(path)) {
    return [home, lists, territories, { label: territoryName(id) }]
  }
  if (path === '/admin/territories') return [home, applications, { label: '申請一覧' }]
  if (/^\/admin\/territories\/[^/]+\/review$/.test(path)) {
    return [home, applications, requests, { label: `領地審査：${territoryName(id)}` }]
  }
  if (path === '/admin/notices') return [home, { label: 'お知らせ管理' }]
  if (path === '/admin/notices/new') return [home, notices, { label: '新規投稿' }]
  if (/^\/admin\/notices\/[^/]+\/edit$/.test(path)) {
    return [home, notices, { label: '記事編集' }]
  }
  if (path === '/admin/master') return [home, { label: 'マスタメンテ' }]
  const masterPages: Record<string,string> = {
    '/admin/accounts': 'アカウント管理',
    '/admin/images': '画像管理',
    '/admin/image-presets': '画像プリセット管理',
  }
  if (masterPages[path]) return [home, master, { label: masterPages[path] }]
  if (/^\/admin\/accounts\/[^/]+\/edit$/.test(path)) {
    return [home, master, { label: 'アカウント管理', to: '/admin/accounts' }, { label: 'アカウント編集' }]
  }
  if (path === '/account') return [home, { label: 'アカウント' }]
  if (path === '/login') return [home, { label: 'ログイン' }]
  if (path === '/request') return [home, { label: '要望を送る' }]
  // Unknown routes never create links to nonexistent ancestor pages.
  return [home, { label: '現在のページ' }]
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
