<template>
  <section aria-labelledby="home-heading">
    <UiPageTitle id="home-heading" title="ホーム" />

    <div class="row g-3 mb-4">
      <div class="col-12">
        <UiCard
          :image="discordImage"
          title="参加はこちらから！"
          url="https://discord.gg/h8NNfn4qPg"
          new-tab
          height="100px"
        />
      </div>
    </div>

    <div class="d-flex justify-content-between align-items-center gap-2 mb-3">
      <UiSectionHeading title="最近のお知らせ" class="mb-0 flex-grow-1" />
    </div>
    <p v-if="!layout && (status === 'pending' || status === 'idle')" role="status">
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
        :lines="1"
      />
    </div>
    <div class="text-end mt-3 mb-4">
      <NuxtLink to="/info/notice" class="btn btn-outline-primary"
        >全てのお知らせを見る</NuxtLink
      >
    </div>

    <p v-if="!homeLayout && (homeStatus === 'pending' || homeStatus === 'idle')" role="status">カードを読み込んでいます…</p>
    <p v-else-if="homeError && !homeLayout" class="text-body-secondary">カードを取得できませんでした。</p>
    <template v-else-if="homeLayout">
      <section v-for="category in homeLayout.data.categories" :key="category.id" class="mb-4" :aria-label="category.title">
        <UiSectionHeading :title="category.title" class="mb-3" />
        <div class="row g-3">
          <div v-for="card in category.cards" :key="card.id" class="col-12 col-md-6 col-xl-4">
            <HomeCard :card="card" :hubs="homeLayout.data.hubs" :links="homeLayout.links" />
          </div>
        </div>
      </section>
    </template>
  </section>
</template>

<script setup lang="ts">
import { sortNotices } from "../utils/notice";

const siteImages = useSiteImages()
const discordImage = computed(() => siteImages.image('card.discord', '/images/discord.png', '/images/card-default.svg'))
const { data: homeLayout, status: homeStatus, error: homeError } = useHomeLayout()
const { data: notices, status, error } = usePublicNotices();
const latest = computed(() =>
  sortNotices(
    notices.value.filter((notice) => !notice.is_draft && notice.published_at),
    "published_at",
  ).slice(0, 3),
);
</script>
