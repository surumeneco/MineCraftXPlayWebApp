<template>
  <dl class="territory-info">
    <div v-if="showApplicant" class="territory-info__item">
      <dt>申請者</dt><dd>{{ territory.applicant.name }}</dd>
    </div>
    <div class="territory-info__item">
      <dt>所有者</dt><dd>{{ territory.owner.name }}</dd>
    </div>
    <div class="territory-info__item">
      <dt>承認状況</dt><dd><TerritoryStatusBadge :status="territory.status" /></dd>
    </div>
    <div v-if="showDates" class="territory-info__item">
      <dt>申請日時</dt><dd>{{ date(territory.applied_at) }}</dd>
    </div>
    <div v-if="showDates" class="territory-info__item">
      <dt>承認日時</dt><dd>{{ date(territory.approved_at) }}</dd>
    </div>
    <div v-if="showDates" class="territory-info__item">
      <dt>変更日時</dt><dd>{{ date(territory.changed_at) }}</dd>
    </div>
    <div class="territory-info__item">
      <dt>場所</dt><dd>{{ formatCentroid(territory.centroid) }}</dd>
    </div>
    <div class="territory-info__item">
      <dt>面積</dt><dd>{{ formatArea(territory.area) }}</dd>
    </div>
  </dl>
</template>

<script setup lang="ts">
import type { TerritoryRecord } from '../../utils/territory'
import { formatArea, formatCentroid } from '../../utils/territory'
withDefaults(defineProps<{ territory: TerritoryRecord; showApplicant?: boolean; showDates?: boolean }>(), {
  showApplicant: false,
  showDates: true,
})
const date = (value: string | null) => value ? new Date(value).toLocaleString('ja-JP') : '—'
</script>

<style scoped>
.territory-info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr));
  gap: .6rem;
  margin-bottom: 1rem;
}
.territory-info__item {
  min-width: 0;
  padding: .6rem .8rem;
  border: 1px solid var(--xplay-border-subtle);
  background: var(--xplay-background-surface-subtle);
  border-radius: var(--xplay-input-radius);
}
.territory-info dt {
  color: var(--xplay-text-note);
  font-size: .85rem;
  font-weight: 600;
  margin-bottom: .2rem;
}
.territory-info dd { margin: 0; overflow-wrap: anywhere; }
</style>
