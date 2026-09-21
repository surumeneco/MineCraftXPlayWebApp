<template>
  <header class="navbar navbar-expand-lg sticky-top border-bottom bg-body py-3">
    <div class="container">
      <div class="row align-items-center w-100 g-2 xplay-header-row">
        <div class="col d-lg-none">
          <button type="button" class="navbar-toggler xplay-hamburger"
            :class="{ 'xplay-hamburger--open': openMobileMenu === 'side' }"
            aria-label="サイドメニュー" aria-controls="mobile-menu-drawer"
            :aria-expanded="openMobileMenu === 'side'" @click="toggleMobileMenu('side', $event)">
            <span class="navbar-toggler-icon" aria-hidden="true" />
            <span class="xplay-hamburger__label" aria-hidden="true">{{ openMobileMenu === 'side' ? '閉じる' : 'サイド' }}</span>
          </button>
        </div>
        <div class="col-auto text-center xplay-header-brand">
          <NuxtLink to="/" class="xplay-site-logo" aria-label="もふもふ広場 ホームへ" @click="closeNavigation">
            <slot name="logo"><span class="fs-3 fw-bold">もふもふ広場</span></slot>
          </NuxtLink>
        </div>
        <div class="col d-lg-none d-flex justify-content-end">
          <button type="button" class="navbar-toggler xplay-hamburger"
            :class="{ 'xplay-hamburger--open': openMobileMenu === 'navigation' }"
            aria-label="ナビゲーションメニュー" aria-controls="mobile-menu-drawer"
            :aria-expanded="openMobileMenu === 'navigation'" @click="toggleMobileMenu('navigation', $event)">
            <span class="navbar-toggler-icon" aria-hidden="true" />
            <span class="xplay-hamburger__label" aria-hidden="true">{{ openMobileMenu === 'navigation' ? '閉じる' : 'メニュー' }}</span>
          </button>
        </div>
        <nav id="header-navigation" class="col-12 col-lg d-none d-lg-flex justify-content-lg-center xplay-desktop-navigation"
          aria-label="メインナビゲーション">
          <ul class="navbar-nav flex-row flex-wrap gap-2 w-100 justify-content-lg-center">
            <li v-for="(item, index) in items" :key="item.label" class="nav-item">
              <LayoutNavigationDropdown v-if="item.children?.length" :key="`${index}-${desktopDropdownCycle}`"
                :label="item.label" :links="item.children" @link-selected="closeNavigation" />
              <NuxtLink v-else-if="item.to" :to="item.to" class="nav-link" @click="closeNavigation">{{ item.label }}</NuxtLink>
            </li>
          </ul>
        </nav>
        <div class="col-auto d-none d-lg-block ms-lg-auto account-menu" @focusout="handleAccountFocusOut" @keydown.esc="accountOpen = false">
          <button type="button" class="nav-link account-menu__button" aria-label="アカウントメニュー"
            :aria-expanded="accountOpen" aria-controls="desktop-account-menu" @click="accountOpen = !accountOpen">
            <UiBootstrapIcon name="person-circle" /><span class="visually-hidden">アカウント</span>
          </button>
          <ul v-if="accountOpen" id="desktop-account-menu" class="dropdown-menu dropdown-menu-end show">
            <li><NuxtLink class="dropdown-item" :to="authenticated ? '/account' : '/login'" @click="closeNavigation">
              {{ authenticated ? '詳細' : 'ログイン' }}
            </NuxtLink></li>
          </ul>
        </div>
      </div>
    </div>
    <dialog id="mobile-menu-drawer" ref="mobileDialog" class="xplay-mobile-drawer"
      :class="{ 'xplay-mobile-drawer--closing': drawerClosing }"
      :style="{ '--xplay-header-bottom': `${headerBottom}px` }"
      :aria-label="openMobileMenu === 'side' ? 'サイドメニュー' : 'ナビゲーションメニュー'"
      @cancel.prevent="closeDrawer()" @close="onDrawerClose">
      <div class="xplay-mobile-drawer__scrim" aria-hidden="true" @click="closeDrawer()" />
      <div class="xplay-mobile-drawer__panel"
        :class="openMobileMenu === 'navigation' ? 'xplay-mobile-drawer__panel--right' : 'xplay-mobile-drawer__panel--left'">
        <div class="xplay-mobile-drawer__heading"
          :class="openMobileMenu === 'navigation' ? 'xplay-mobile-drawer__heading--right' : 'xplay-mobile-drawer__heading--left'">
          <h2 class="xplay-mobile-drawer__title">{{ openMobileMenu === 'side' ? 'サイドメニュー' : 'ナビゲーション' }}</h2>
        </div>
        <nav v-if="openMobileMenu === 'navigation'" id="mobile-navigation" aria-label="モバイルナビゲーション">
          <ul class="navbar-nav flex-column gap-2">
            <li v-for="(item, index) in items" :key="item.label" class="nav-item">
              <div v-if="item.children?.length" class="accordion accordion-flush w-100">
                <UiAccordion :key="`${index}-${mobileAccordionCycle}`" :title="item.label" :default-open="true">
                  <ul class="list-unstyled mb-0">
                    <li v-for="child in item.children" :key="child.to">
                      <NuxtLink :to="child.to" class="nav-link xplay-mobile-drawer__link" @click="closeNavigation">{{ child.label }}</NuxtLink>
                    </li>
                  </ul>
                </UiAccordion>
              </div>
              <NuxtLink v-else-if="item.to" :to="item.to" class="nav-link xplay-mobile-drawer__link" @click="closeNavigation">{{ item.label }}</NuxtLink>
            </li>
            <li class="nav-item border-top pt-2">
              <div class="accordion accordion-flush w-100">
                <UiAccordion :key="`account-${mobileAccordionCycle}`" title="アカウント" :default-open="false">
                  <template #header><UiBootstrapIcon name="person-circle" /> <span class="ms-2">アカウント</span></template>
                  <ul class="list-unstyled mb-0">
                    <li><NuxtLink :to="authenticated ? '/account' : '/login'" class="nav-link xplay-mobile-drawer__link"
                      @click="closeNavigation">{{ authenticated ? '詳細' : 'ログイン' }}</NuxtLink></li>
                  </ul>
                </UiAccordion>
              </div>
            </li>
          </ul>
        </nav>
        <div v-else-if="openMobileMenu === 'side'" id="mobile-side-menu" @click="onSideMenuClick"><slot name="side-menu" /></div>
      </div>
      <!-- showModal() makes the header inert; this button occupies the opener's exact viewport rectangle. -->
      <button v-if="openMobileMenu" ref="closeButton" type="button"
        class="navbar-toggler xplay-hamburger xplay-hamburger--open xplay-mobile-drawer__toggle xplay-mobile-drawer__close"
        :style="openerStyle" :aria-label="openMobileMenu === 'side' ? 'サイドメニューを閉じる' : 'ナビゲーションメニューを閉じる'"
        autofocus @click="closeDrawer()">
        <span class="navbar-toggler-icon" aria-hidden="true" />
        <span class="xplay-hamburger__label" aria-hidden="true">閉じる</span>
      </button>
    </dialog>
  </header>
</template>

<script setup lang="ts">
import type { HeaderNavigationItem } from '../../types/header-navigation'
withDefaults(defineProps<{ items?: HeaderNavigationItem[] }>(), { items: () => [] })
type MobileMenu = 'side' | 'navigation'
const CLOSE_DURATION_MS = 260
const { authenticated } = useAccountSession()
const route = useRoute()
const openMobileMenu = ref<MobileMenu | null>(null)
const drawerClosing = ref(false)
const openerStyle = ref<Record<string, string>>({})
const headerBottom = ref(0)
const accountOpen = ref(false)
const mobileDialog = ref<HTMLDialogElement | null>(null)
const closeButton = ref<HTMLButtonElement | null>(null)
const mobileAccordionCycle = ref(0), desktopDropdownCycle = ref(0)
let opener: HTMLButtonElement | null = null
let previousBodyOverflow: string | null = null
let shouldRestoreFocus = true
let closeTimer: ReturnType<typeof setTimeout> | undefined

function handleAccountFocusOut(event: FocusEvent) {
  const next = event.relatedTarget
  if (!(next instanceof Node) || !(event.currentTarget as HTMLElement).contains(next)) accountOpen.value = false
}
function onSideMenuClick(event: MouseEvent) {
  if (event.target instanceof Element && event.target.closest('a[href]')) closeNavigation()
}
function positionCloseButton() {
  const header = mobileDialog.value?.parentElement
  headerBottom.value = header ? Math.max(0, header.getBoundingClientRect().bottom) : 0
  if (!opener) return
  const rect = opener.getBoundingClientRect()
  openerStyle.value = {
    left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`,
  }
}
async function toggleMobileMenu(menu: MobileMenu, event: MouseEvent) {
  if (openMobileMenu.value === menu) { closeDrawer(); return }
  if (openMobileMenu.value) {
    shouldRestoreFocus = false
    finishClose()
  }
  opener = event.currentTarget as HTMLButtonElement
  shouldRestoreFocus = true
  openMobileMenu.value = menu
  drawerClosing.value = false
  positionCloseButton()
  desktopDropdownCycle.value++
  if (menu === 'navigation') mobileAccordionCycle.value++
  await nextTick()
  if (openMobileMenu.value !== menu) return
  const dialog = mobileDialog.value
  if (!dialog) return
  if (!dialog.open) {
    if (typeof dialog.showModal === 'function') dialog.showModal()
    else dialog.setAttribute('open', '')
  }
  if (previousBodyOverflow === null) {
    previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  closeButton.value?.focus()
}
function onDrawerClose() {
  if (mobileDialog.value?.open) return
  if (closeTimer) clearTimeout(closeTimer)
  closeTimer = undefined
  drawerClosing.value = false
  openMobileMenu.value = null
  if (previousBodyOverflow !== null) {
    document.body.style.overflow = previousBodyOverflow
    previousBodyOverflow = null
  }
  if (shouldRestoreFocus) opener?.focus()
  opener = null
  shouldRestoreFocus = true
}
function finishClose() {
  if (closeTimer) clearTimeout(closeTimer)
  closeTimer = undefined
  const dialog = mobileDialog.value
  if (dialog?.open) {
    if (typeof dialog.close === 'function') dialog.close()
    else dialog.removeAttribute('open')
  }
  onDrawerClose()
}
function closeDrawer(restoreFocus = true) {
  if (!openMobileMenu.value || drawerClosing.value) return
  shouldRestoreFocus = restoreFocus
  if (typeof window.matchMedia !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    finishClose()
    return
  }
  drawerClosing.value = true
  closeTimer = setTimeout(finishClose, CLOSE_DURATION_MS)
}
function closeNavigation() {
  if (openMobileMenu.value) closeDrawer(false)
  accountOpen.value = false
  desktopDropdownCycle.value++
}
function onViewportChange() {
  if (window.innerWidth >= 992 && openMobileMenu.value) closeDrawer(false)
  else if (openMobileMenu.value) positionCloseButton()
}
watch(() => route.fullPath, () => closeNavigation())
onMounted(() => window.addEventListener('resize', onViewportChange))
onBeforeUnmount(() => {
  window.removeEventListener('resize', onViewportChange)
  if (openMobileMenu.value) {
    shouldRestoreFocus = false
    finishClose()
  }
})
</script>

<style scoped>
.account-menu { position: relative; }
.account-menu__button { display: inline-flex; align-items: center; justify-content: center; padding: .45rem .6rem; border: 1px solid var(--bs-border-color); border-radius: .5rem; }
.account-menu__button :deep(svg) { width: 23px; height: 23px; }
.account-menu .dropdown-menu { right: 0; left: auto; position: absolute; min-width: 8rem; }
</style>
