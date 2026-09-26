<template>
  <header class="navbar sticky-top border-bottom bg-body py-3">
    <div class="container-fluid px-3 px-lg-4">
      <div ref="headerRow" class="xplay-header-row w-100" :class="{ 'xplay-header-row--desktop': desktop }">
        <div v-show="!desktop" class="xplay-header-side-toggle">
          <button
            type="button"
            class="navbar-toggler xplay-hamburger"
            :class="{ 'xplay-hamburger--open': openMobileMenu === 'side' }"
            aria-label="サイドメニュー"
            aria-controls="mobile-menu-drawer"
            :aria-expanded="openMobileMenu === 'side'"
            @click="toggleMobileMenu('side')"
          >
            <span class="navbar-toggler-icon" aria-hidden="true" />
            <span class="xplay-hamburger__label" aria-hidden="true">{{
              openMobileMenu === "side" ? "閉じる" : "サイド"
            }}</span>
          </button>
        </div>
        <div ref="brand" class="xplay-header-brand">
          <NuxtLink
            to="/"
            class="xplay-site-logo"
            aria-label="もふもふ広場 ホームへ"
            @click="closeNavigation"
          >
            <slot name="logo"
              ><span class="fs-3 fw-bold">もふもふ広場</span></slot
            >
          </NuxtLink>
        </div>
        <div v-show="!desktop" class="xplay-header-nav-toggle">
          <button
            type="button"
            class="navbar-toggler xplay-hamburger"
            :class="{
              'xplay-hamburger--open': openMobileMenu === 'navigation',
            }"
            aria-label="ナビゲーションメニュー"
            aria-controls="mobile-menu-drawer"
            :aria-expanded="openMobileMenu === 'navigation'"
            @click="toggleMobileMenu('navigation')"
          >
            <span class="navbar-toggler-icon" aria-hidden="true" />
            <span class="xplay-hamburger__label" aria-hidden="true">{{
              openMobileMenu === "navigation" ? "閉じる" : "メニュー"
            }}</span>
          </button>
        </div>
        <nav
          id="header-navigation"
          ref="desktopNavigation"
          class="xplay-desktop-navigation"
          :class="{ 'xplay-desktop-navigation--hidden': !desktop }"
          :aria-hidden="!desktop"
          :inert="!desktop"
          aria-label="メインナビゲーション"
        >
          <ul
            class="navbar-nav flex-row flex-nowrap gap-2 justify-content-center"
          >
            <li
              v-for="(item, index) in items"
              :key="item.label"
              class="nav-item"
            >
              <LayoutNavigationDropdown
                v-if="item.children?.length"
                :key="`${index}-${desktopDropdownCycle}`"
                :label="item.label"
                :links="item.children"
                @link-selected="closeNavigation"
              />
              <a
                v-else-if="item.to && item.native"
                :href="item.to"
                class="nav-link"
                @click="closeNavigation"
                >{{ item.label }}</a
              >
              <NuxtLink
                v-else-if="item.to"
                :to="item.to"
                class="nav-link"
                @click="closeNavigation"
                >{{ item.label }}</NuxtLink
              >
            </li>
          </ul>
        </nav>
        <div
          ref="accountMenu"
          class="account-menu"
          :class="{ 'account-menu--hidden': !desktop }"
          @focusout="handleAccountFocusOut"
          @keydown.esc="accountOpen = false"
        >
          <button
            type="button"
            class="nav-link account-menu__button"
            aria-label="アカウントメニュー"
            :aria-expanded="accountOpen"
            aria-controls="desktop-account-menu"
            @click="accountOpen = !accountOpen"
          >
            <UiBootstrapIcon name="person-circle" /><span
              class="visually-hidden"
              >アカウント</span
            >
          </button>
          <ul
            v-if="accountOpen"
            id="desktop-account-menu"
            class="dropdown-menu dropdown-menu-end show"
          >
            <li>
              <NuxtLink
                class="dropdown-item"
                :to="authenticated ? '/account' : '/login'"
                @click="closeNavigation"
              >
                {{ authenticated ? "詳細" : "ログイン" }}
              </NuxtLink>
            </li>
          </ul>
        </div>
      </div>
    </div>
    <!-- Nonmodal dialog: unlike showModal(), show() does not make the header inert. -->
    <dialog
      id="mobile-menu-drawer"
      ref="mobileDialog"
      class="xplay-mobile-drawer"
      :class="{
        'xplay-mobile-drawer--visible': drawerVisible,
        'xplay-mobile-drawer--closing': drawerClosing,
      }"
      :style="{ '--xplay-header-bottom': `${headerBottom}px` }"
      :aria-label="
        openMobileMenu === 'side' ? 'サイドメニュー' : 'ナビゲーションメニュー'
      "
      @cancel.prevent="closeDrawer()"
      @close="onDrawerClose"
      @keydown.esc.prevent="closeDrawer()"
    >
      <div
        class="xplay-mobile-drawer__scrim"
        aria-hidden="true"
        @click="closeDrawer()"
      />
      <div
        class="xplay-mobile-drawer__panel"
        :class="
          openMobileMenu === 'navigation'
            ? 'xplay-mobile-drawer__panel--right'
            : 'xplay-mobile-drawer__panel--left'
        "
      >
        <div
          class="xplay-mobile-drawer__heading"
          :class="
            openMobileMenu === 'navigation'
              ? 'xplay-mobile-drawer__heading--right'
              : 'xplay-mobile-drawer__heading--left'
          "
        >
          <h2 class="xplay-mobile-drawer__title">
            {{
              openMobileMenu === "side" ? "サイドメニュー" : "ナビゲーション"
            }}
          </h2>
        </div>
        <!-- Keep the navigation mounted so opening the drawer never creates expanded accordions mid-animation. -->
        <nav
          v-show="openMobileMenu === 'navigation'"
          id="mobile-navigation"
          aria-label="モバイルナビゲーション"
        >
          <ul class="navbar-nav flex-column gap-2">
            <li v-for="item in items" :key="item.label" class="nav-item">
              <div
                v-if="item.children?.length"
                class="accordion accordion-flush w-100"
              >
                <UiAccordion :title="item.label" :default-open="true">
                  <ul class="list-unstyled mb-0">
                    <li v-for="child in item.children" :key="child.to">
                      <NuxtLink
                        :to="child.to"
                        class="nav-link xplay-mobile-drawer__link"
                        @click="closeNavigation"
                        >{{ child.label }}</NuxtLink
                      >
                    </li>
                  </ul>
                </UiAccordion>
              </div>
              <a
                v-else-if="item.to && item.native"
                :href="item.to"
                class="nav-link xplay-mobile-drawer__link"
                @click="closeNavigation"
                >{{ item.label }}</a
              >
              <NuxtLink
                v-else-if="item.to"
                :to="item.to"
                class="nav-link xplay-mobile-drawer__link"
                @click="closeNavigation"
                >{{ item.label }}</NuxtLink
              >
            </li>
            <li class="nav-item border-top pt-2">
              <div class="accordion accordion-flush w-100">
                <UiAccordion
                  :key="`account-${mobileAccordionCycle}`"
                  title="アカウント"
                  :default-open="true"
                >
                  <template #header
                    ><UiBootstrapIcon name="person-circle" />
                    <span class="ms-2">アカウント</span></template
                  >
                  <ul class="list-unstyled mb-0">
                    <li>
                      <NuxtLink
                        :to="authenticated ? '/account' : '/login'"
                        class="nav-link xplay-mobile-drawer__link"
                        @click="closeNavigation"
                        >{{ authenticated ? "詳細" : "ログイン" }}</NuxtLink
                      >
                    </li>
                  </ul>
                </UiAccordion>
              </div>
            </li>
          </ul>
        </nav>
        <div
          v-if="openMobileMenu === 'side'"
          id="mobile-side-menu"
          @click="onSideMenuClick"
        >
          <slot name="side-menu" />
        </div>
      </div>
    </dialog>
  </header>
</template>

<script setup lang="ts">
import type { HeaderNavigationItem } from "../../types/header-navigation";
const props = withDefaults(defineProps<{ items?: HeaderNavigationItem[] }>(), {
  items: () => [],
});
type MobileMenu = "side" | "navigation";
const CLOSE_DURATION_MS = 260;
const { authenticated } = useAccountSession();
const route = useRoute();
const openMobileMenu = ref<MobileMenu | null>(null);
const drawerVisible = ref(false);
const drawerClosing = ref(false);
const headerBottom = ref(0);
const accountOpen = ref(false);
const desktop = ref(false);
const headerRow = ref<HTMLElement | null>(null);
const desktopNavigation = ref<HTMLElement | null>(null);
const brand = ref<HTMLElement | null>(null);
const accountMenu = ref<HTMLElement | null>(null);
let navigationObserver: ResizeObserver | undefined;
const mobileDialog = ref<HTMLDialogElement | null>(null);
const mobileAccordionCycle = ref(0),
  desktopDropdownCycle = ref(0);
let previousBodyOverflow: string | null = null;
let closeTimer: ReturnType<typeof setTimeout> | undefined;

function handleAccountFocusOut(event: FocusEvent) {
  const next = event.relatedTarget;
  if (
    !(next instanceof Node) ||
    !(event.currentTarget as HTMLElement).contains(next)
  )
    accountOpen.value = false;
}
function onSideMenuClick(event: MouseEvent) {
  if (event.target instanceof Element && event.target.closest("a[href]"))
    closeNavigation();
}
function positionDrawer() {
  const header = mobileDialog.value?.parentElement;
  headerBottom.value = header
    ? Math.max(0, header.getBoundingClientRect().bottom)
    : 0;
}
async function toggleMobileMenu(menu: MobileMenu) {
  if (openMobileMenu.value === menu) {
    closeDrawer();
    return;
  }
  if (openMobileMenu.value) finishClose();
  openMobileMenu.value = menu;
  drawerVisible.value = false;
  drawerClosing.value = false;
  desktopDropdownCycle.value++;
  if (menu === "navigation") mobileAccordionCycle.value++;
  await nextTick();
  if (openMobileMenu.value !== menu) return;
  positionDrawer();
  const dialog = mobileDialog.value;
  if (!dialog) return;
  if (!dialog.open) {
    if (typeof dialog.show === "function") dialog.show();
    else dialog.setAttribute("open", "");
  }
  if (previousBodyOverflow === null) {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  // Commit the off-screen layout while the dialog is visible, before transitioning to its final position.
  // In particular, this avoids starting the right-hand animation before the navigation is painted.
  void dialog
    .querySelector(".xplay-mobile-drawer__panel")
    ?.getBoundingClientRect();
  if (openMobileMenu.value === menu && !drawerClosing.value)
    drawerVisible.value = true;
}
function onDrawerClose() {
  if (mobileDialog.value?.open) return;
  if (closeTimer) clearTimeout(closeTimer);
  closeTimer = undefined;
  drawerVisible.value = false;
  drawerClosing.value = false;
  openMobileMenu.value = null;
  if (previousBodyOverflow !== null) {
    document.body.style.overflow = previousBodyOverflow;
    previousBodyOverflow = null;
  }
}
function finishClose() {
  if (closeTimer) clearTimeout(closeTimer);
  closeTimer = undefined;
  const dialog = mobileDialog.value;
  if (dialog?.open) {
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }
  onDrawerClose();
}
function closeDrawer() {
  if (!openMobileMenu.value) return;
  if (
    typeof window.matchMedia !== "function" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    finishClose();
    return;
  }
  if (drawerClosing.value) return;
  drawerVisible.value = false;
  drawerClosing.value = true;
  closeTimer = setTimeout(finishClose, CLOSE_DURATION_MS);
}
function closeNavigation() {
  if (openMobileMenu.value) closeDrawer();
  accountOpen.value = false;
  desktopDropdownCycle.value++;
}
function measureNavigation() {
  const row = headerRow.value, nav = desktopNavigation.value
  const logo = brand.value, account = accountMenu.value
  if (!row || !nav || !logo || !account) return
  const rowWidth = row.getBoundingClientRect().width
  const logoWidth = logo.getBoundingClientRect().width
  const accountWidth = account.getBoundingClientRect().width
  // The navigation is absolutely positioned so its intrinsic width remains measurable while hidden.
  // Top-level items determine the switch; expanded dropdowns must not affect it.
  const topLevelWidth = nav.querySelector('ul.navbar-nav')?.getBoundingClientRect().width ?? 0
  const requiredWidth = topLevelWidth > 0 ? topLevelWidth : nav.scrollWidth
  const fits = rowWidth > 0 && requiredWidth > 0
    && (rowWidth - requiredWidth) / 2 >= Math.max(logoWidth, accountWidth) + 16
  desktop.value = fits
  if (fits && openMobileMenu.value) finishClose()
}
function onViewportChange() {
  measureNavigation()
  if (openMobileMenu.value) positionDrawer()
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape" && openMobileMenu.value) {
    event.preventDefault();
    closeDrawer();
  }
}
watch(
  () => route.fullPath,
  () => closeNavigation(),
);
watch(() => props.items, async () => { await nextTick(); measureNavigation() }, { deep: true });
onMounted(() => {
  measureNavigation()
  if (typeof ResizeObserver !== 'undefined') {
    navigationObserver = new ResizeObserver(measureNavigation)
    for (const element of [headerRow.value, desktopNavigation.value, brand.value, accountMenu.value]) {
      if (element) navigationObserver.observe(element)
    }
  }
  void document.fonts?.ready.then(measureNavigation)
  window.addEventListener("resize", onViewportChange);
  document.addEventListener("keydown", onKeydown);
});
onBeforeUnmount(() => {
  navigationObserver?.disconnect()
  window.removeEventListener("resize", onViewportChange);
  document.removeEventListener("keydown", onKeydown);
  if (openMobileMenu.value) finishClose();
});
</script>

<style scoped>
.xplay-header-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: .5rem;
  min-width: 0;
  position: relative;
}
.xplay-header-side-toggle { grid-column: 1; justify-self: start; }
.xplay-header-brand { grid-column: 2; justify-self: center; white-space: nowrap; }
.xplay-header-nav-toggle { grid-column: 3; justify-self: end; }
.xplay-header-row--desktop { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
.xplay-header-row--desktop .xplay-header-brand { grid-column: 1; justify-self: start; }
.xplay-desktop-navigation {
  position: absolute;
  left: 50%;
  top: 50%;
  width: max-content;
  max-width: none;
  transform: translate(-50%, -50%);
  z-index: 2;
}
.xplay-desktop-navigation--hidden { visibility: hidden; pointer-events: none; }
.xplay-desktop-navigation .navbar-nav { flex-wrap: nowrap; }
.xplay-desktop-navigation .nav-item,
.xplay-desktop-navigation .nav-link { white-space: nowrap; }
.account-menu {
  position: relative;
  grid-column: 2;
  justify-self: end;
}
.account-menu--hidden {
  position: absolute;
  right: 0;
  visibility: hidden;
  pointer-events: none;
}
.account-menu__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--bs-border-color);
  border-radius: 0.5rem;
}
.account-menu__button :deep(svg) {
  width: 23px;
  height: 23px;
}
.account-menu .dropdown-menu {
  right: 0;
  left: auto;
  position: absolute;
  min-width: 8rem;
}
</style>
