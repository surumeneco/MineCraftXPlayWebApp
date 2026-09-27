<template>
  <div class="xplay-date-meta" role="group" aria-label="日時">
    <div v-for="item in items" :key="item.label" class="xplay-date-meta__item">
      <UiBootstrapIcon :name="item.icon" />
      <span class="visually-hidden">{{ item.label }}：</span>
      <time v-if="item.value" :datetime="item.value" :title="item.label">{{ noticeDate(item.value) }}</time>
      <span v-else :title="item.label">—</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { noticeDate } from '../../utils/notice'

defineProps<{ items: Array<{ label: string; icon: string; value: string | null | undefined }> }>()
</script>

<style scoped>
.xplay-date-meta {
  display: flex;
  flex-wrap: wrap;
  gap: .65rem 1.1rem;
  max-width: 100%;
  min-width: 0;
  padding: .65rem .8rem;
  margin-bottom: 1rem;
  border: 1px solid var(--xplay-border-subtle);
  background: var(--xplay-background-surface-subtle);
  border-radius: var(--xplay-input-radius);
}
.xplay-date-meta__item {
  display: inline-flex;
  align-items: baseline;
  min-width: 0;
  gap: .35rem;
  overflow-wrap: anywhere;
}
</style>
