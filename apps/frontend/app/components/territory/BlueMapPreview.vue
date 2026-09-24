<template>
  <div class="ratio ratio-16x9 border rounded overflow-hidden bg-body-tertiary">
    <iframe v-if="src" :src="src" :title="title" loading="lazy" referrerpolicy="same-origin" />
    <div v-else class="d-flex align-items-center justify-content-center text-body-secondary">有効な座標を3点以上入力すると地図を表示します。</div>
  </div>
</template>
<script setup lang="ts">
import type { TerritoryPoint } from '../../utils/territory'
import { blueMapTerritoryUrl, territoryCoordinateError } from '../../utils/territory'
const props=withDefaults(defineProps<{coordinates:TerritoryPoint[];title?:string}>(),{title:'領地周辺のBlueMap'})
const src=computed(()=>territoryCoordinateError(props.coordinates)?'':blueMapTerritoryUrl(props.coordinates))
</script>
