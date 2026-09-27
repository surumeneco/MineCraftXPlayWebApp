<template>
  <dl class="territory-info">
    <div class="territory-info__group">
      <div v-if="showApplicant" class="territory-info__item">
        <dt>申請者</dt><dd>{{ territory.applicant.name }}</dd>
      </div>
      <div class="territory-info__item">
        <dt>所有者</dt><dd><NuxtLink v-if="territory.owner.type==='company'&&territory.owner.company_id" :to="`/companies/${territory.owner.company_id}`">{{territory.owner.name}}</NuxtLink><template v-else>{{ territory.owner.name }}</template></dd>
      </div>
      <div class="territory-info__item">
        <dt>承認状況</dt><dd><TerritoryStatusBadge :status="territory.status" /></dd>
      </div>
    </div>
    <div v-if="showDates" class="territory-info__group">
      <div v-for="item in [
        { label: '申請日時', icon: 'calendar-plus', value: territory.applied_at },
        { label: '承認日時', icon: 'calendar-check', value: territory.approved_at },
        { label: '変更日時', icon: 'clock-history', value: territory.changed_at },
      ]" :key="item.label" class="territory-info__item">
        <dt class="visually-hidden">{{ item.label }}</dt>
        <dd class="territory-info__date">
          <UiBootstrapIcon :name="item.icon" />
          <time v-if="item.value" :datetime="item.value" :title="item.label">{{ noticeDate(item.value) }}</time>
          <span v-else :title="item.label">—</span>
        </dd>
      </div>
    </div>
    <div class="territory-info__group">
      <div class="territory-info__item">
        <dt>場所</dt><dd>{{ formatCentroid(territory.centroid) }}</dd>
      </div>
      <div class="territory-info__item">
        <dt>面積</dt><dd>{{ formatArea(territory.area) }}</dd>
      </div>
    </div>
  </dl>
</template>
<script setup lang="ts">
import type { TerritoryRecord } from '../../utils/territory'
import { formatArea, formatCentroid } from '../../utils/territory'
import { noticeDate } from '../../utils/notice'
withDefaults(defineProps<{ territory: TerritoryRecord; showApplicant?: boolean; showDates?: boolean }>(), {
  showApplicant: false,
  showDates: true,
})
</script>
<style scoped>
.territory-info {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: .65rem;
  margin-bottom: 1rem;
}
.territory-info__group {
  display: flex;
  flex: 1 0 auto;
  flex-wrap: nowrap;
  gap: .9rem;
  max-width: 100%;
  border: 1px solid var(--xplay-border-subtle);
  background: var(--xplay-background-surface-subtle);
  border-radius: var(--xplay-input-radius);
  padding: .65rem .8rem;
}
.territory-info__item { min-width: 0; flex: 0 1 auto; }
.territory-info dt {
  color: var(--xplay-text-note);
  font-size: .85rem;
  font-weight: 600;
  margin-bottom: .2rem;
}
.territory-info dd { margin: 0; overflow-wrap: anywhere; }
.territory-info__date { display: inline-flex; align-items: baseline; gap: .35rem; }
@media (max-width: 575.98px) {
  .territory-info__group { flex-wrap: wrap; }
}
</style>
