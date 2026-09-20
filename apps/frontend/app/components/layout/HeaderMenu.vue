<template>
  <header class="navbar navbar-expand-lg sticky-top border-bottom bg-body py-3">
    <div class="container">
      <div class="row align-items-center w-100 g-2">
        <div class="col d-lg-none">
          <button
            type="button"
            class="navbar-toggler"
            aria-label="サイドメニュー"
            aria-controls="mobile-side-menu"
            :aria-expanded="openMobileMenu === 'side'"
            @click="toggleMobileMenu('side')"
          >
            <span class="navbar-toggler-icon" aria-hidden="true" />
          </button>
        </div>

        <div class="col-auto text-center">
          <slot name="logo">
            <span class="fs-3 fw-bold">ここにロゴ</span>
          </slot>
        </div>

        <div class="col d-lg-none d-flex justify-content-end">
          <button
            type="button"
            class="navbar-toggler"
            aria-label="ナビゲーションメニュー"
            aria-controls="header-navigation"
            :aria-expanded="openMobileMenu === 'navigation'"
            @click="toggleMobileMenu('navigation')"
          >
            <span class="navbar-toggler-icon" aria-hidden="true" />
          </button>
        </div>

        <nav
          id="header-navigation"
          class="col-12 col-lg justify-content-lg-end pt-3 pt-lg-0"
          :class="openMobileMenu === 'navigation' ? 'd-flex' : 'd-none d-lg-flex'"
          aria-label="メインナビゲーション"
        >
          <ul class="navbar-nav flex-column flex-lg-row flex-wrap gap-2 w-100 justify-content-lg-end">
            <li v-for="(item, index) in items" :key="item.label" class="nav-item">
              <template v-if="item.children?.length">
                <div class="d-none d-lg-block">
                  <LayoutNavigationDropdown
                    :key="`${index}-${desktopDropdownCycle}`"
                    :label="item.label"
                    :links="item.children"
                    @link-selected="closeNavigation"
                  />
                </div>
                <div class="accordion accordion-flush d-lg-none w-100">
                  <UiAccordion
                    :key="`${index}-${mobileAccordionCycle}`"
                    :title="item.label"
                    :default-open="true"
                  >
                    <ul class="list-unstyled mb-0">
                      <li v-for="child in item.children" :key="child.to">
                        <NuxtLink :to="child.to" class="d-block py-2" @click="closeNavigation">
                          {{ child.label }}
                        </NuxtLink>
                      </li>
                    </ul>
                  </UiAccordion>
                </div>
              </template>
              <NuxtLink v-else-if="item.to" :to="item.to" class="nav-link" @click="closeNavigation">
                {{ item.label }}
              </NuxtLink>
            </li>
          </ul>
        </nav>

        <div
          id="mobile-side-menu"
          v-show="openMobileMenu === 'side'"
          class="col-12 d-lg-none border-top mt-3 pt-3"
          :aria-hidden="openMobileMenu !== 'side'"
        >
          <slot name="side-menu" />
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import type { HeaderNavigationItem } from '../../types/header-navigation'

withDefaults(defineProps<{
  items?: HeaderNavigationItem[]
}>(), {
  items: () => [],
})

const openMobileMenu = ref<'side' | 'navigation' | null>(null)
const mobileAccordionCycle = ref(0)
const desktopDropdownCycle = ref(0)

function toggleMobileMenu(menu: 'side' | 'navigation') {
  const next = openMobileMenu.value === menu ? null : menu
  openMobileMenu.value = next
  desktopDropdownCycle.value++
  if (next === 'navigation') mobileAccordionCycle.value++
}

function closeNavigation() {
  openMobileMenu.value = null
  desktopDropdownCycle.value++
}
</script>
