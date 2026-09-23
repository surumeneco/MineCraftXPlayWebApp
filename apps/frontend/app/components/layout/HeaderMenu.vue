<template>
  <header class="navbar navbar-expand-lg sticky-top border-bottom bg-body py-3">
    <div class="container">
      <div class="row align-items-center w-100 g-2 xplay-header-row">
        <div class="col d-lg-none">
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
        <div class="col-auto text-center xplay-header-brand">
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
        <div class="col d-lg-none d-flex justify-content-end">
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
          class="col-12 col-lg d-none d-lg-flex justify-content-lg-center xplay-desktop-navigation"
          aria-label="メインナビゲーション"
        >
          <ul
            class="navbar-nav flex-row flex-wrap gap-2 w-100 justify-content-lg-center"
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
          class="col-auto d-none d-lg-block ms-lg-auto account-menu"
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
withDefaults(defineProps<{ items?: HeaderNavigationItem[] }>(), {
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
function onViewportChange() {
  if (window.innerWidth >= 992 && openMobileMenu.value) finishClose();
  else if (openMobileMenu.value) positionDrawer();
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
onMounted(() => {
  window.addEventListener("resize", onViewportChange);
  document.addEventListener("keydown", onKeydown);
});
onBeforeUnmount(() => {
  window.removeEventListener("resize", onViewportChange);
  document.removeEventListener("keydown", onKeydown);
  if (openMobileMenu.value) finishClose();
});
</script>

<style scoped>
.account-menu {
  position: relative;
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
