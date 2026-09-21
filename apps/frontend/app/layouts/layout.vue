<template>
  <div id="page-top" class="xplay-shell d-flex min-vh-100 flex-column" data-bs-theme="dark" :style="pageBackgroundStyle">
    <LayoutHeaderMenu :items="navigationItems" :style="headerBackgroundStyle">
      <template #logo>
        <slot v-if="$slots.logo" name="logo" />
        <img v-else-if="logoUrl && !logoFailed" :src="logoUrl" alt="もふもふ広場" class="xplay-managed-logo" @error="logoFailed = true" />
        <span v-else class="fs-3 fw-bold">もふもふ広場</span>
      </template>
      <template #side-menu>
        <LayoutSideMenu />
      </template>
    </LayoutHeaderMenu>

    <LayoutBodyContent class="flex-grow-1">
      <slot />
    </LayoutBodyContent>

    <LayoutFooter
      :external-links="footerExternalLinks"
      :internal-links="footerInternalLinks"
      :copyright-holder="copyrightHolder"
    />
  </div>
</template>

<script setup lang="ts">
import type { HeaderNavigationItem } from '../types/header-navigation'
import type { FooterExternalLink, FooterInternalLink } from '../types/footer-links'

defineProps<{
  navigationItems?: HeaderNavigationItem[]
  footerExternalLinks?: FooterExternalLink[]
  footerInternalLinks?: FooterInternalLink[]
  copyrightHolder?: string
}>()

const siteImages = useSiteImages()
const logoFailed = ref(false)
const logoUrl = computed(() => siteImages.image('site.logo'))
const pageUrl = computed(() => siteImages.image('site.background'))
const headerUrl = computed(() => siteImages.image('site.header.background'))
watch(logoUrl, () => { logoFailed.value = false })
const pageBackgroundStyle = computed(() => pageUrl.value ? {
  backgroundImage: `url("${pageUrl.value}")`,
  backgroundPosition: 'center', backgroundSize: 'cover', backgroundAttachment: 'fixed',
} : {})
const headerBackgroundStyle = computed(() => headerUrl.value ? {
  backgroundImage: `linear-gradient(rgba(16, 22, 27, .65), rgba(16, 22, 27, .65)), url("${headerUrl.value}")`,
  backgroundPosition: 'center', backgroundSize: 'cover',
} : {})
</script>

<style scoped>
.xplay-managed-logo { display: block; max-width: min(40vw, 20rem); max-height: 3rem; width: auto; height: auto; object-fit: contain; }
</style>
