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
      <div class="territory-info__item">
        <dt>申請日時</dt><dd>{{ date(territory.applied_at) }}</dd>
      </div>
      <div class="territory-info__item">
        <dt>承認日時</dt><dd>{{ date(territory.approved_at) }}</dd>
      </div>
      <div class="territory-info__item">
        <dt>変更日時</dt><dd>{{ date(territory.changed_at) }}</dd>
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
withDefaults(defineProps<{ territory: TerritoryRecord; showApplicant?: boolean; showDates?: boolean }>(), {
  showApplicant: false,
  showDates: true,
})
const date = (value: string | null) => value ? new Date(value).toLocaleString('ja-JP') : '—'
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
@media (max-width: 575.98px) {
  .territory-info__group { flex-wrap: wrap; }
}
</style>
