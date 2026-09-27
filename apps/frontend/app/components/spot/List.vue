<template>
  <section>
    <UiPageTitle :title="spotLabel(kind)" />
    <form v-if="kind === 'tourist'" class="row g-3 align-items-end mb-4" @submit.prevent>
      <div class="col-md-4">
        <label for="spot-name-query" class="form-label">名前で検索</label>
        <input id="spot-name-query" v-model="nameQuery" class="form-control" type="search" placeholder="スポット名" />
      </div>
      <div class="col-md-4"><UiSelect v-model="tagId" label="タグで絞り込み" :options="tagOptions" /></div>
      <div class="col-md-4 d-flex justify-content-md-end"><UiSortSwitch v-model="sortBy" /></div>
    </form>
    <p v-if="status === 'pending' || status === 'idle'" role="status">スポットを読み込んでいます…</p>
    <div v-else-if="error" class="alert alert-danger" role="alert">
      スポット一覧を取得できませんでした。
      <button type="button" class="btn btn-sm btn-primary" aria-label="再読み込み" @click="refresh()">再読み込み</button>
    </div>
    <p v-else-if="!displayed.length" role="status">該当するスポットはありません。</p>
    <div v-else class="row g-3">
      <div v-for="spot in displayed" :key="spot.id" class="col-md-6 col-xl-4">
        <UiCard :to="'/info/' + routeKind + '/' + spot.id"
          :image="spot.main_image_id ? apiBase + '/spot-images/' + spot.main_image_id : undefined"
          :title="spot.name" :note="spotNote(spot)" hide-image-when-unset />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { Spot, SpotKind } from '../../types/spot'
import { spotLabel, spotLocation } from '../../types/spot'
const props = defineProps<{ kind: SpotKind }>()
const routeKind = computed(() => props.kind === 'public' ? 'public-spots' : 'tourist-spots')
const { public: { apiBase } } = useRuntimeConfig()
const { data: spots, status, error, refresh } = useFetch<Spot[]>(
  () => apiBase + '/spots/' + props.kind, { server: false, lazy: true, default: () => [] },
)
const nameQuery = ref(''), tagId = ref(''), sortBy = ref<'published_at' | 'updated_at'>('published_at')
const tagOptions = computed(() => {
  const distinct = new Map<string, string>()
  for (const item of spots.value) for (const tag of item.tags) distinct.set(String(tag.id), tag.name)
  return [{ value: '', label: 'すべてのタグ' },
    ...[...distinct].sort((a, b) => a[1].localeCompare(b[1], 'ja')).map(([value, label]) => ({ value, label }))]
})
const displayed = computed(() => {
  const filtered = props.kind === 'tourist' ? spots.value.filter(item =>
    item.name.normalize('NFKC').toLocaleLowerCase('ja').includes(nameQuery.value.trim().normalize('NFKC').toLocaleLowerCase('ja')) &&
    (!tagId.value || item.tags.some(tag => String(tag.id) === tagId.value))) : spots.value
  if (props.kind === 'public') return filtered
  return [...filtered].sort((a, b) => {
    const difference = Date.parse(b[sortBy.value] ?? '') - Date.parse(a[sortBy.value] ?? '')
    return Number.isFinite(difference) && difference !== 0 ? difference : a.id.localeCompare(b.id)
  })
})
function spotNote(spot: Spot) {
  const location = spotLocation(spot)
  return spot.kind === 'tourist' && spot.tags.length
    ? location + ' / ' + spot.tags.map(tag => tag.name).join('、')
    : location
}
</script>
