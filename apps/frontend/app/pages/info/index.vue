<template>
  <section aria-labelledby="information-heading">
    <UiPageTitle id="information-heading" title="情報" />
    <nav aria-label="情報ページ一覧" class="row g-3">
      <div v-for="item in links" :key="item.to" class="col-md-6 col-xl-4">
        <UiCard :image="cardImage" :title="item.label" :to="item.to" />
      </div>
    </nav>
  </section>
</template>
<script setup lang="ts">
const siteImages = useSiteImages()
const cardImage = computed(() => siteImages.image('card.info', '/images/card-default.svg', '/images/card-default.svg'))
const links = [
  { label: 'お知らせ', to: '/info/notice' },
  { label: 'コミュニティ概要', to: '/info/about' },
  { label: '運営メンバー紹介', to: '/info/operators' },
  { label: 'サーバー情報', to: '/info/server' },
  { label: '運営方針とルール', to: '/info/rules' },
]
</script>
