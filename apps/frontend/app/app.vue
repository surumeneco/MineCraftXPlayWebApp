<script setup lang="ts">
import type { HeaderNavigationItem } from './types/header-navigation'
import type { FooterInternalLink } from './types/footer-links'

const navigationItems: HeaderNavigationItem[] = [
  { label: 'ホーム', to: '/' },
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
]

const footerInternalLinks: FooterInternalLink[] = [
  { label: '運営メンバー紹介', to: '/info/operators' },
  { label: '運営方針とルール', to: '/info/rules' },
]
</script>

<template>
  <NuxtLayout
    name="layout"
    :navigation-items="navigationItems"
    :footer-internal-links="footerInternalLinks"
  >
    <NuxtPage />
  </NuxtLayout>
</template>
