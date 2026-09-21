<template>
  <section aria-labelledby="home-heading">
    <UiPageTitle id="home-heading" title="ホーム" />

    <!-- カード形式：Discord招待リンク -->

    <div class="d-flex justify-content-between align-items-center gap-2 mb-3">
      <UiSectionHeading title="最新のお知らせ" class="mb-0 flex-grow-1" />
    </div>
    <p v-if="status === 'pending' || status === 'idle'" role="status">
      お知らせを読み込んでいます…
    </p>
    <p v-else-if="error" class="text-body-secondary">
      お知らせを取得できませんでした。
    </p>
    <p v-else-if="latest.length === 0">公開中のお知らせはありません。</p>
    <div v-else class="d-grid gap-2">
      <NoticeBanner
        v-for="notice in latest"
        :key="notice.id"
        :notice="notice"
        :heading-level="3"
        :lines="2"
      />
    </div>
    <div class="text-end mt-3 mb-4">
      <NuxtLink to="/info/notice" class="btn btn-outline-primary">全てのお知らせを見る</NuxtLink>
    </div>

    <div class="row g-3 mb-4">
      <div class="col-12 col-md-6 col-xl-4">
        <UiCard
          image="/images/card-ofuse.jpg"
          title="ご支援はこちらから"
          url="https://ofuse.me/mofupark"
          new-tab
        />
      </div>
    </div>

    <!-- Bluemap見出し -->
    <!-- カード形式：Bluemap -->
    <!-- 場所案内見出し -->
    <!-- カード形式：公営スポット -->
    <!-- カード形式：観光情報 -->
    <!-- 一覧・検索見出し -->
    <!-- カード形式：領地一覧 -->
    <!-- カード形式：企業一覧 -->
    <!-- 情報ページ見出し -->
    <!-- カード形式：各情報ページ -->
    <!-- 一覧ページ見出し -->
    <!-- カード形式：各一覧ページ -->
    <!-- 申請ページ見出し -->
    <!-- カード形式：各申請ページ -->
  </section>
</template>

<script setup lang="ts">
import { sortNotices } from "../utils/notice";

const { data: notices, status, error } = usePublicNotices();
const latest = computed(() =>
  sortNotices(
    notices.value.filter((notice) => !notice.is_draft && notice.published_at),
    "published_at",
  ).slice(0, 3),
);
</script>
