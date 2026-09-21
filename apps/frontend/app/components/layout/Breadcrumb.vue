<template>
  <nav aria-label="breadcrumb" class="mb-3">
    <ol class="breadcrumb small mb-0 flex-wrap">
      <li v-for="(item, index) in items" :key="`${item.to ?? 'current'}-${index}`"
        class="breadcrumb-item" :class="{ active: index === items.length - 1 }"
        :aria-current="index === items.length - 1 ? 'page' : undefined">
        <NuxtLink v-if="index < items.length - 1 && item.to" :to="item.to">{{ item.label }}</NuxtLink>
        <span v-else class="text-break">{{ item.label }}</span>
      </li>
    </ol>
  </nav>
</template>

<script setup lang="ts">
type Crumb = { label: string; to?: string }
const route = useRoute()
const labels: Record<string, string> = {
  info: '情報', notice: 'お知らせ', about: 'コミュニティ概要', operators: '運営メンバー紹介',
  server: 'サーバー情報', rules: '運営方針とルール', login: 'ログイン', account: 'アカウント',
}
const items = computed<Crumb[]>(() => {
  const home: Crumb = { label: 'ホーム', to: '/' }
  const path = route.path.replace(/\/$/, '') || '/'
  if (path === '/') return [{ label: 'ホーム' }]
  if (path === '/admin/notices') return [home, { label: 'お知らせ管理', to: '/admin/notices' }, { label: 'お知らせ一覧' }]
  if (path === '/admin/notices/new') return [home, { label: 'お知らせ管理', to: '/admin/notices' }, { label: 'お知らせ投稿' }]
  if (/^\/admin\/notices\/[^/]+\/edit$/.test(path)) return [home, { label: 'お知らせ管理', to: '/admin/notices' }, { label: 'お知らせ一覧', to: '/admin/notices' }, { label: '記事編集' }]
  if (path === '/admin/accounts') return [home, { label: 'アカウント管理' }]
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
</script>
