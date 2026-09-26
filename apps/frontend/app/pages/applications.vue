<template>
  <section aria-labelledby="applications-heading">
    <UiPageTitle id="applications-heading" title="申請" />
    <nav aria-label="申請ページ" class="row g-3">
      <div class="col-md-6 col-xl-4">
        <UiCard :image="cardImage" title="領地申請" to="/territories/apply" />
      </div>
    </nav>
  </section>
</template>
<script setup lang="ts">
const siteImages = useSiteImages()
const cardImage = computed(() => siteImages.image('card.applications', '/images/card-default.svg', '/images/card-default.svg'))
</script>
