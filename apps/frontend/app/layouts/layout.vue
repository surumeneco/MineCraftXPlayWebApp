<template>
  <div id="page-top" class="xplay-shell d-flex min-vh-100 flex-column">
    <LayoutHeaderMenu :items="navigationItems">
      <template v-if="$slots.logo" #logo>
        <slot name="logo" />
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
</script>
