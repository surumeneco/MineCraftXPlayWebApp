<script setup lang="ts">
import type { HeaderNavigationItem } from '../types/header-navigation'

defineProps<{
  navigationItems?: HeaderNavigationItem[]
}>()
</script>

<template>
  <div class="d-flex min-vh-100 flex-column">
    <LayoutHeaderMenu :items="navigationItems">
      <template v-if="$slots.logo" #logo>
        <slot name="logo" />
      </template>
    </LayoutHeaderMenu>

    <LayoutBodyContent class="flex-grow-1">
      <slot />
    </LayoutBodyContent>

    <LayoutFooter />
  </div>
</template>
