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
                <div class="dropdown d-none d-lg-block">
                  <button
                    type="button"
                    class="btn btn-outline-secondary dropdown-toggle"
                    :aria-expanded="openCategory === index"
                    @click="toggleCategory(index)"
                  >
                    {{ item.label }}
                  </button>
                  <ul v-if="openCategory === index" class="dropdown-menu show mt-1">
                    <li v-for="child in item.children" :key="child.to">
                      <NuxtLink :to="child.to" class="dropdown-item" @click="closeNavigation">
                        {{ child.label }}
                      </NuxtLink>
                    </li>
                  </ul>
                </div>
                <div class="accordion accordion-flush d-lg-none">
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
              <NuxtLink v-else-if="item.to" :to="item.to" class="btn btn-outline-secondary" @click="closeNavigation">
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
import { ref } from 'vue'
import type { HeaderNavigationItem } from '../../types/header-navigation'

withDefaults(defineProps<{
  items?: HeaderNavigationItem[]
}>(), {
  items: () => [],
})

const openMobileMenu = ref<'side' | 'navigation' | null>(null)
const openCategory = ref<number | null>(null)
const mobileAccordionCycle = ref(0)

function toggleMobileMenu(menu: 'side' | 'navigation') {
  const next = openMobileMenu.value === menu ? null : menu
  openMobileMenu.value = next
  openCategory.value = null
  // Opening the hamburger menu always restores its categories to the default open state.
  if (next === 'navigation') mobileAccordionCycle.value++
}

function toggleCategory(index: number) {
  openCategory.value = openCategory.value === index ? null : index
}

function closeNavigation() {
  openMobileMenu.value = null
  openCategory.value = null
}
</script>
