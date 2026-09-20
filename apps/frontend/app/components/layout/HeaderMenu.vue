<template>
  <header class="navbar navbar-expand-lg sticky-top border-bottom bg-body py-3">
    <div class="container">
      <div class="row align-items-center w-100 g-2">
        <div class="col d-lg-none">
          <button
            type="button"
            class="navbar-toggler xplay-hamburger"
            aria-label="サイドメニュー"
            aria-controls="mobile-menu-drawer"
            :aria-expanded="openMobileMenu === 'side'"
            @click="toggleMobileMenu('side', $event)"
          >
            <span class="navbar-toggler-icon" aria-hidden="true" />
            <span class="xplay-hamburger__label" aria-hidden="true">サイド</span>
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
            class="navbar-toggler xplay-hamburger"
            aria-label="ナビゲーションメニュー"
            aria-controls="mobile-menu-drawer"
            :aria-expanded="openMobileMenu === 'navigation'"
            @click="toggleMobileMenu('navigation', $event)"
          >
            <span class="navbar-toggler-icon" aria-hidden="true" />
            <span class="xplay-hamburger__label" aria-hidden="true">メニュー</span>
          </button>
        </div>

        <nav
          id="header-navigation"
          class="col-12 col-lg d-none d-lg-flex justify-content-lg-end"
          aria-label="メインナビゲーション"
        >
          <ul class="navbar-nav flex-row flex-wrap gap-2 w-100 justify-content-lg-end">
            <li v-for="(item, index) in items" :key="item.label" class="nav-item">
              <LayoutNavigationDropdown
                v-if="item.children?.length"
                :key="`${index}-${desktopDropdownCycle}`"
                :label="item.label"
                :links="item.children"
                @link-selected="closeNavigation"
              />
              <NuxtLink v-else-if="item.to" :to="item.to" class="nav-link" @click="closeNavigation">
                {{ item.label }}
              </NuxtLink>
            </li>
          </ul>
        </nav>
      </div>
    </div>

    <!-- Native showModal makes the background inert and confines keyboard focus to the drawer. -->
    <dialog
      id="mobile-menu-drawer"
      ref="mobileDialog"
      class="xplay-mobile-drawer"
      :aria-label="openMobileMenu === 'side' ? 'サイドメニュー' : 'ナビゲーションメニュー'"
      @cancel.prevent="closeDrawer()"
      @close="onDrawerClose"
    >
      <div class="xplay-mobile-drawer__scrim" aria-hidden="true" @click="closeDrawer()" />
      <div
        class="xplay-mobile-drawer__panel"
        :class="openMobileMenu === 'navigation' ? 'xplay-mobile-drawer__panel--right' : 'xplay-mobile-drawer__panel--left'"
      >
        <div class="xplay-mobile-drawer__heading">
          <h2 class="xplay-mobile-drawer__title">{{ openMobileMenu === 'side' ? 'サイドメニュー' : 'ナビゲーション' }}</h2>
          <button ref="closeButton" type="button" class="btn btn-outline-primary xplay-mobile-drawer__close" autofocus @click="closeDrawer()">
            閉じる <span aria-hidden="true">×</span>
          </button>
        </div>

        <nav v-if="openMobileMenu === 'navigation'" id="mobile-navigation" aria-label="モバイルナビゲーション">
          <ul class="navbar-nav flex-column gap-2">
            <li v-for="(item, index) in items" :key="item.label" class="nav-item">
              <div v-if="item.children?.length" class="accordion accordion-flush w-100">
                <UiAccordion :key="`${index}-${mobileAccordionCycle}`" :title="item.label" :default-open="true">
                  <ul class="list-unstyled mb-0">
                    <li v-for="child in item.children" :key="child.to">
                      <NuxtLink :to="child.to" class="nav-link xplay-mobile-drawer__link" @click="closeNavigation">
                        {{ child.label }}
                      </NuxtLink>
                    </li>
                  </ul>
                </UiAccordion>
              </div>
              <NuxtLink v-else-if="item.to" :to="item.to" class="nav-link xplay-mobile-drawer__link" @click="closeNavigation">
                {{ item.label }}
              </NuxtLink>
            </li>
          </ul>
        </nav>
        <div v-else-if="openMobileMenu === 'side'" id="mobile-side-menu">
          <slot name="side-menu" />
        </div>
      </div>
    </dialog>
  </header>
</template>

<script setup lang="ts">
import type { HeaderNavigationItem } from '../../types/header-navigation'

withDefaults(defineProps<{
  items?: HeaderNavigationItem[]
}>(), {
  items: () => [],
})

type MobileMenu = 'side' | 'navigation'
const openMobileMenu = ref<MobileMenu | null>(null)
const mobileDialog = ref<HTMLDialogElement | null>(null)
const closeButton = ref<HTMLButtonElement | null>(null)
const mobileAccordionCycle = ref(0)
const desktopDropdownCycle = ref(0)
let opener: HTMLButtonElement | null = null
let previousBodyOverflow: string | null = null
let shouldRestoreFocus = true

async function toggleMobileMenu(menu: MobileMenu, event: MouseEvent) {
  if (openMobileMenu.value === menu) {
    closeDrawer()
    return
  }
  if (openMobileMenu.value) closeDrawer(false)
  opener = event.currentTarget as HTMLButtonElement
  shouldRestoreFocus = true
  openMobileMenu.value = menu
  desktopDropdownCycle.value++
  if (menu === 'navigation') mobileAccordionCycle.value++
  await nextTick()
  if (openMobileMenu.value !== menu) return
  const dialog = mobileDialog.value
  if (!dialog) return
  if (!dialog.open) {
    if (typeof dialog.showModal === 'function') dialog.showModal()
    else dialog.setAttribute('open', '') // jsdom fallback; production uses the native modal.
  }
  if (previousBodyOverflow === null) {
    previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  closeButton.value?.focus()
}

function onDrawerClose() {
  // Native close events are queued: do not clear a newly opened drawer after a switch.
  if (mobileDialog.value?.open) return
  openMobileMenu.value = null
  if (previousBodyOverflow !== null) {
    document.body.style.overflow = previousBodyOverflow
    previousBodyOverflow = null
  }
  if (shouldRestoreFocus) opener?.focus()
  opener = null
  shouldRestoreFocus = true
}

function closeDrawer(restoreFocus = true) {
  shouldRestoreFocus = restoreFocus
  const dialog = mobileDialog.value
  if (dialog?.open) {
    if (typeof dialog.close === 'function') dialog.close()
    else dialog.removeAttribute('open')
  }
  // Keep reactive state and body scroll in sync before the native close event fires.
  onDrawerClose()
}

function closeNavigation() {
  if (openMobileMenu.value) closeDrawer(false)
  desktopDropdownCycle.value++
}

function onViewportChange() {
  if (window.innerWidth >= 992 && openMobileMenu.value) closeDrawer()
}

onMounted(() => window.addEventListener('resize', onViewportChange))
onBeforeUnmount(() => {
  window.removeEventListener('resize', onViewportChange)
  if (mobileDialog.value?.open) closeDrawer(false)
})
</script>
