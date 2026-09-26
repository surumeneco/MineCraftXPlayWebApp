<template>
  <NuxtLayout
    name="layout"
    :navigation-items="navigationItems"
    :footer-external-links="footerExternalLinks"
    :footer-internal-links="footerInternalLinks"
  >
    <NuxtPage />
  </NuxtLayout>
  <div
    v-if="success"
    class="xplay-feedback alert alert-success shadow"
    role="status"
  >
    <span>{{ success }}</span>
    <button
      type="button"
      class="btn-close ms-3"
      aria-label="通知を閉じる"
      @click="closeSuccess"
    />
  </div>
  <UiDialog
    :open="!!feedback"
    :kind="feedback?.kind ?? 'information'"
    :title="feedback?.title ?? ''"
    :message="feedback?.message ?? ''"
    preset="close"
    @action="closeFeedback"
    @close="closeFeedback"
  />
</template>

<script setup lang="ts">
import type { HeaderNavigationItem } from "./types/header-navigation";
import type {
  FooterExternalLink,
  FooterInternalLink,
} from "./types/footer-links";

const { isAdmin, refresh } = useAccountSession();
const { public: { bluemapBase } } = useRuntimeConfig();
const { feedback, success, closeFeedback, closeSuccess } = useUiFeedback();
onMounted(() => {
  void refresh();
});

const navigationItems = computed<HeaderNavigationItem[]>(() => [
  { label: "Bluemap", to: bluemapBase, native: true },
  {
    label: "情報",
    children: [
      { label: "情報トップ", to: "/info" },
      { label: "お知らせ", to: "/info/notice" },
      { label: "コミュニティ概要", to: "/info/about" },
      { label: "運営メンバー紹介", to: "/info/operators" },
      { label: "サーバー情報", to: "/info/server" },
      { label: "運営方針とルール", to: "/info/rules" },
    ],
  },
  {
    label: "一覧",
    children: [
      { label: "領地一覧", to: "/territories" },
    ],
  },
  {
    label: "申請",
    children: [
      { label: "領地申請", to: "/territories/apply" },
      ...(isAdmin.value ? [{ label: "申請一覧", to: "/admin/territories" }] : []),
    ],
  },
  ...(isAdmin.value
    ? [
        { label: "お知らせ投稿", to: "/admin/notices/new" },
        {
          label: "マスタメンテ",
          children: [
            { label: "マスタメンテトップ", to: "/admin/master" },
            { label: "アカウント管理", to: "/admin/accounts" },
            { label: "画像管理", to: "/admin/images" },
            { label: "画像プリセット管理", to: "/admin/image-presets" },
          ],
        },
      ]
    : []),
  { label: "要望を送る", to: "/request" },
]);

const footerExternalLinks: FooterExternalLink[] = [
  {
    label: "くまモフ様YouTube",
    href: "https://www.youtube.com/@くまモフKumamov",
    icon: "youtube",
  },
  {
    label: "くまモフ公民館",
    href: "https://discord.gg/7Yv7DtHhXw",
    icon: "discord",
  },
  {
    label: "運営へのOFUSE",
    href: "https://ofuse.me/mofupark",
    icon: "envelope",
  },
];

const footerInternalLinks: FooterInternalLink[] = [
  { label: "運営メンバー紹介", to: "/info/operators" },
  { label: "運営方針とルール", to: "/info/rules" },
];
</script>

<style scoped>
.xplay-feedback {
  position: fixed;
  z-index: 1200;
  bottom: 1rem;
  right: 1rem;
  max-width: min(90vw, 32rem);
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0;
}
</style>
