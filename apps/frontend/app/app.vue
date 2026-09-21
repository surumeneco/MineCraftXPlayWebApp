<template>
  <NuxtLayout
    name="layout"
    :navigation-items="navigationItems"
    :footer-internal-links="footerInternalLinks"
  >
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
import type { HeaderNavigationItem } from './types/header-navigation'
import type { FooterInternalLink } from './types/footer-links'

const { isAdmin, refresh } = useAccountSession()
onMounted(() => { void refresh() })

const navigationItems = computed<HeaderNavigationItem[]>(() => [
  {
    label: '情報',
    children: [
      { label: '情報トップ', to: '/info' },
      { label: 'お知らせ', to: '/info/notice' },
      { label: 'コミュニティ概要', to: '/info/about' },
      { label: '運営メンバー紹介', to: '/info/operators' },
      { label: 'サーバー情報', to: '/info/server' },
      { label: '運営方針とルール', to: '/info/rules' },
    ],
  },
  ...(isAdmin.value ? [{
    label: 'お知らせ管理',
    children: [
      { label: 'お知らせ一覧', to: '/admin/notices' },
      { label: '新規投稿', to: '/admin/notices/new' },
    ],
  }, {
    label: 'マスタメンテ',
    children: [{ label: 'アカウント管理', to: '/admin/accounts' }],
  }] : []),
])

const footerInternalLinks: FooterInternalLink[] = [
  { label: '運営メンバー紹介', to: '/info/operators' },
  { label: '運営方針とルール', to: '/info/rules' },
]
</script>
