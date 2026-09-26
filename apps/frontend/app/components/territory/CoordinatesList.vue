<template>
  <div class="border rounded overflow-hidden" role="list" aria-label="領地の頂点座標">
    <div v-for="(point,index) in coordinates" :key="index" role="listitem"
      class="d-flex gap-3 align-items-center px-3 py-2"
      :class="{ 'border-bottom': index < coordinates.length - 1 }">
      <span class="small text-body-secondary">#{{ index + 1 }}</span>
      <span>X {{ point.x }}</span><span>Z {{ point.z }}</span>
    </div>
    <p v-if="!coordinates.length" class="p-3 mb-0">座標がありません。</p>
  </div>
</template>
<script setup lang="ts">
import type { TerritoryPoint } from '../../utils/territory'
defineProps<{ coordinates: TerritoryPoint[] }>()
</script>
