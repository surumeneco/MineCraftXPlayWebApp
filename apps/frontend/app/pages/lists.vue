<template>
  <section aria-labelledby="lists-heading">
    <UiPageTitle id="lists-heading" title="一覧" />
    <nav aria-label="一覧ページ" class="row g-3">
      <div class="col-md-6 col-xl-4">
        <UiCard :image="cardImage" title="領地一覧" to="/territories" />
      </div>
    </nav>
  </section>
</template>
<script setup lang="ts">
const siteImages = useSiteImages()
const cardImage = computed(() => siteImages.image('card.lists', '/images/card-default.svg', '/images/card-default.svg'))
</script>
