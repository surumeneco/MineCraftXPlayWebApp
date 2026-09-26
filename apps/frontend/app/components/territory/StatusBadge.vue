<template>
  <span class="territory-status badge" :class="`territory-status--${status}`">{{ territoryStatusLabel[status] }}</span>
</template>

<script setup lang="ts">
import type { TerritoryStatus } from '../../utils/territory'
import { territoryStatusLabel } from '../../utils/territory'
defineProps<{ status: TerritoryStatus }>()
</script>

<style scoped>
.territory-status {
  font-weight: 600;
  border: 1px solid;
  white-space: nowrap;
}
.territory-status--approved {
  background: var(--xplay-feedback-success-background);
  color: var(--xplay-feedback-success-text);
  border-color: var(--xplay-feedback-success-border);
}
.territory-status--pending {
  background: var(--xplay-feedback-info-background);
  color: var(--xplay-feedback-info-text);
  border-color: var(--xplay-feedback-info-border);
}
.territory-status--returned {
  background: var(--xplay-feedback-warning-background);
  color: var(--xplay-feedback-warning-text);
  border-color: var(--xplay-feedback-warning-border);
}
.territory-status--withdrawn {
  background: var(--xplay-background-surface-subtle);
  color: var(--xplay-text-note);
  border-color: var(--xplay-border-base);
}
.territory-status--rejected {
  background: var(--xplay-feedback-error-background);
  color: var(--xplay-feedback-error-text);
  border-color: var(--xplay-feedback-error-border);
}
</style>
