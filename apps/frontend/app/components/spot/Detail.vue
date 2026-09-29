<template>
  <article>
    <p v-if="status === 'pending' || status === 'idle'" role="status">スポットを読み込んでいます…</p>
    <div v-else-if="error" class="alert alert-danger" role="alert">
      スポットを取得できませんでした。
      <button type="button" class="btn btn-sm btn-primary" @click="refresh()">再読み込み</button>
    </div>
    <template v-else-if="spot">
      <UiPageTitle :title="spot.name" />
      <div v-if="spot.main_image_id" class="mb-4">
        <img :src="apiBase + '/spot-images/' + spot.main_image_id" :alt="spot.name + 'のメイン画像'"
          class="spot-main-image border rounded" />
      </div>
      <dl class="row mb-4">
        <dt class="col-sm-3">場所</dt>
        <dd class="col-sm-9">
          <NuxtLink v-if="spot.kind === 'tourist' && spot.territory_id" :to="'/territories/' + spot.territory_id">{{ spotLocation(spot) }}</NuxtLink>
          <span v-else>{{ spotLocation(spot) }}</span>
        </dd>
        <template v-if="spot.kind === 'tourist'">
          <dt class="col-sm-3">タグ</dt>
          <dd class="col-sm-9">{{ spot.tags.map(tag => tag.name).join('、') || 'なし' }}</dd>
        </template>
      </dl>
      <UiDateMeta :items="[
        { label: '投稿日時', icon: 'calendar', value: spot.published_at },
        { label: '更新日時', icon: 'clock-history', value: spot.updated_at },
      ]" />
      <UiSectionHeading as="h2">案内・説明</UiSectionHeading>
      <ClientOnly>
        <div ref="editor" class="xplay-quill-readonly" aria-label="スポットの説明文" />
        <template #fallback><p>説明文を表示しています…</p></template>
      </ClientOnly>
    </template>
    <p v-else role="status">スポットが見つかりません。</p>
  </article>
</template>

<script setup lang="ts">
import type { Spot, SpotKind } from '../../types/spot'
import { spotLocation } from '../../types/spot'
const props = defineProps<{ kind: SpotKind; id: string }>()
const breadcrumbNames = useSpotBreadcrumbNames()
watch(() => [props.kind, props.id] as const, ([kind, id]) => breadcrumbNames.forget(kind, id), { immediate: true })
const { public: { apiBase } } = useRuntimeConfig()
const { data: spot, status, error, refresh } = useFetch<Spot>(
  () => apiBase + '/spots/' + props.kind + '/' + encodeURIComponent(props.id),
  { server: false, lazy: true },
)
watch(spot, item => {
  if (item && item.kind === props.kind && item.id === props.id) {
    breadcrumbNames.remember(item.kind, item.id, item.name)
  }
}, { immediate: true })
watch(error, issue => { if (issue) breadcrumbNames.forget(props.kind, props.id) })
const editor = ref<HTMLDivElement | null>(null)
const { $loadQuill } = useNuxtApp()
let viewer: InstanceType<Awaited<ReturnType<typeof $loadQuill>>> | null = null
watch([spot, editor], async ([item, element]) => {
  if (!item || !element) return
  const Quill = await $loadQuill()
  if (element !== editor.value || item !== spot.value) return
  if (!viewer || viewer.root.parentElement !== element) {
    viewer = new Quill(element, { theme: 'bubble', readOnly: true, modules: { toolbar: false } })
  }
  viewer.setContents(item.body_delta as Parameters<typeof viewer.setContents>[0])
  viewer.disable()
}, { immediate: true, flush: 'post' })
</script>

<style scoped>
.spot-main-image { display: block; width: 100%; max-height: 30rem; object-fit: contain; }
</style>
