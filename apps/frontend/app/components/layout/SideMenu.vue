<template>
  <aside aria-label="サイドメニュー">
    <UiPanel>
      <div class="d-flex justify-content-between align-items-center gap-2 mb-3">
        <UiSectionHeading as="h2" title="お知らせ" class="mb-0 flex-grow-1" />
      </div>
      <UiNote v-if="status === 'pending' || status === 'idle'" role="status"
        >読み込み中…</UiNote
      >
      <UiNote v-else-if="error">お知らせを取得できませんでした。</UiNote>
      <UiNote v-else-if="latest.length === 0"
        >公開中のお知らせはありません。</UiNote
      >
      <div v-else class="d-grid gap-2">
        <NoticeBanner
          v-for="notice in latest"
          :key="notice.id"
          :notice="notice"
          :lines="2"
          :preview-length="120"
        />
      </div>
      <!-- TODO: Bluemap リンク -->
    </UiPanel>
  </aside>
</template>

<script setup lang="ts">
import { sortNotices } from "../../utils/notice";

const { data: notices, status, error } = usePublicNotices();
const latest = computed(() =>
  sortNotices(
    notices.value.filter((notice) => !notice.is_draft && notice.published_at),
    "published_at",
  ).slice(0, 2),
);
</script>
