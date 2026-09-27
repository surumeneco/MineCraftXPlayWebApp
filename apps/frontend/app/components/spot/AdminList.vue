<template>
  <section>
    <UiPageTitle :title="label + '管理'" />
    <p v-if="!loaded" role="status">管理者権限を確認しています…</p>
    <div v-else-if="!isAdmin" class="alert alert-warning" role="alert">
      管理者権限が必要です。<NuxtLink to="/login">ログイン</NuxtLink>
    </div>
    <template v-else>
      <div class="d-flex flex-wrap justify-content-end gap-2 mb-3">
        <button type="button" class="btn btn-outline-secondary" :disabled="busy" @click="reload">一覧更新</button>
        <NuxtLink :to="base + '/new'" class="btn btn-primary">新規投稿</NuxtLink>
      </div>
      <p v-if="kind === 'public'" class="text-body-secondary">
        公営スポットの表示順はここで設定できます。上下へ移動して「順番を保存」を押してください。
      </p>
      <p v-if="busy" role="status">処理しています…</p>
      <p v-if="error" class="alert alert-danger" role="alert">{{ error }}</p>
      <p v-if="!busy && !spots.length" role="status">スポットはありません。</p>
      <ol v-else class="list-group list-group-numbered">
        <li v-for="(spot, index) in spots" :key="spot.id" class="list-group-item d-flex gap-2 align-items-center">
          <div class="flex-grow-1 min-width-0">
            <NuxtLink :to="base + '/' + spot.id + '/edit'" class="text-break fw-semibold">{{ spot.name }}</NuxtLink>
            <div class="small text-body-secondary">
              {{ statusLabel[spot.status] }} ・ 作成：{{ noticeDate(spot.created_at) }}
              <span v-if="kind === 'tourist'">・ {{ spot.territory_name }}</span>
            </div>
          </div>
          <div v-if="kind === 'public'" class="d-flex gap-1 flex-shrink-0">
            <button type="button" class="btn btn-outline-secondary btn-sm" :disabled="busy || index === 0"
              :aria-label="spot.name + 'を上へ移動'" @click="move(index, -1)"><UiBootstrapIcon name="arrow-up" /></button>
            <button type="button" class="btn btn-outline-secondary btn-sm" :disabled="busy || index === spots.length - 1"
              :aria-label="spot.name + 'を下へ移動'" @click="move(index, 1)"><UiBootstrapIcon name="arrow-down" /></button>
          </div>
        </li>
      </ol>
      <div v-if="kind === 'public'" class="text-end mt-3">
        <button type="button" class="btn btn-primary" :disabled="!orderDirty || busy" @click="saveOrder">順番を保存</button>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import type { Spot, SpotKind, SpotStatus } from '../../types/spot'
import { spotLabel } from '../../types/spot'
import { noticeDate } from '../../utils/notice'
import { userFacingError } from '../../utils/user-error'
const props = defineProps<{ kind: SpotKind }>()
const label = computed(() => spotLabel(props.kind))
const base = computed(() => '/admin/spots/' + props.kind)
const auth = useAccountSession()
const { get, mutate } = useAccountApi()
const { showSuccess, showError } = useUiFeedback()
const isAdmin = auth.isAdmin, loaded = auth.loaded
const spots = ref<Spot[]>([]), busy = ref(false), orderDirty = ref(false), error = ref('')
const statusLabel: Record<SpotStatus, string> = { draft: '下書き', published: '公開', unpublished: '非公開' }
async function reload() {
  busy.value = true
  error.value = ''
  try { spots.value = await get<Spot[]>(base.value); orderDirty.value = false }
  catch (cause) { error.value = userFacingError(cause) }
  finally { busy.value = false }
}
function move(index: number, direction: number) {
  const next = [...spots.value], partner = index + direction
  if (index < 0 || partner < 0 || partner >= next.length) return
  const item = next[index]!
  next[index] = next[partner]!
  next[partner] = item
  spots.value = next
  orderDirty.value = true
}
async function saveOrder() {
  if (!orderDirty.value || busy.value) return
  busy.value = true
  try {
    spots.value = await mutate<Spot[]>('/admin/spots/public/order', 'POST',
      { ids: spots.value.map(item => item.id) })
    orderDirty.value = false
    showSuccess('表示順を保存しました。')
  } catch (cause) { error.value = userFacingError(cause); showError(cause) }
  finally { busy.value = false }
}
onMounted(async () => { await auth.refresh(); if (isAdmin.value) await reload() })
</script>
