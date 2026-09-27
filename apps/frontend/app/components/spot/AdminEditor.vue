<template>
  <section>
    <UiPageTitle :title="spotLabel(kind) + (spotId ? '編集' : '投稿')" />
    <p v-if="loading" role="status">編集画面を読み込んでいます…</p>
    <div v-else-if="!isAdmin" class="alert alert-warning" role="alert">
      管理者権限が必要です。<NuxtLink to="/login">ログイン</NuxtLink>
    </div>
    <form v-else @submit.prevent="save(true)">
      <div v-if="error" class="alert alert-danger" role="alert">{{ error }}</div>
      <div class="mb-3">
        <label for="spot-name" class="form-label">名前</label>
        <input id="spot-name" v-model="name" class="form-control" maxlength="100" required @input="dirty = true" />
      </div>
      <div class="mb-3">
        <label for="spot-main-image" class="form-label">メイン画像（任意）</label>
        <img v-if="previewSource" :src="previewSource" alt="選択中のメイン画像" class="d-block border rounded mb-2 spot-preview" />
        <input id="spot-main-image" type="file" class="form-control" accept="image/jpeg,image/png,image/webp"
          :disabled="busy || uploading" @change="uploadMainImage" />
        <div v-if="mainImageId" class="text-end mt-2">
          <button type="button" class="btn btn-outline-secondary btn-sm" :disabled="busy || uploading"
            @click="clearMain">画像を解除</button>
        </div>
      </div>
      <div v-if="kind === 'public'" class="mb-3">
        <label for="spot-dimension" class="form-label">ディメンション</label>
        <input id="spot-dimension" v-model="dimension" class="form-control" maxlength="100" placeholder="例：minecraft:overworld" required @input="dirty = true" />
        <div class="row g-2 mt-1">
          <div v-for="axis in axisFields" :key="axis.key" class="col-4">
            <label class="form-label" :for="'spot-' + axis.key">{{ axis.label }}座標</label>
            <input :id="'spot-' + axis.key" v-model="coordinates[axis.key]" class="form-control"
              type="number" step="1" required @input="dirty = true" />
          </div>
        </div>
      </div>
      <div v-else class="mb-3">
        <label for="spot-territory" class="form-label">場所（領地）</label>
        <select id="spot-territory" v-model="territoryId" class="form-select" required @change="dirty = true">
          <option value="">領地を選択</option>
          <option v-for="territory in territories" :key="territory.id" :value="territory.id">{{ territory.name }}</option>
        </select>
        <NoticeTagPicker :model-value="selectedTags" :tags="allTags" class="mt-3" :disabled="busy"
          @update:model-value="updateTags" />
      </div>
      <label class="form-label">説明文</label>
      <ClientOnly><div ref="editor" class="mb-3" aria-label="スポットの説明文" /></ClientOnly>
      <p class="form-text">本文にはQuillのツールバーから画像を挿入できます。保存時に反映されます。</p>
      <div class="d-flex flex-wrap gap-2 justify-content-end">
        <NuxtLink :to="base" class="btn btn-outline-secondary">管理一覧へ戻る</NuxtLink>
        <button v-if="selected?.status === 'published'" type="button" class="btn btn-warning"
          :disabled="busy || uploading" @click="decision = 'unpublish'">公開取り消し</button>
        <button v-else-if="selected" type="button" class="btn btn-danger"
          :disabled="busy || uploading" @click="decision = 'remove'">削除</button>
        <button type="submit" class="btn btn-primary" :disabled="busy || uploading || !quillReady">保存</button>
        <button v-if="selected?.status !== 'published'" type="button" class="btn btn-success"
          :disabled="busy || uploading || !quillReady" @click="publish">公開する</button>
      </div>
    </form>
    <UiConfirmDialog :open="decision !== null" :title="decision === 'remove' ? '削除の確認' : '公開取り消しの確認'"
      :message="decision === 'remove' ? 'スポットと画像を完全に削除します。よろしいですか？' : 'スポットの公開を取り消しますか？'"
      :confirm-label="decision === 'remove' ? '削除する' : '公開を取り消す'"
      :danger="true" :busy="busy" @cancel="decision = null" @confirm="confirmDecision" />
  </section>
</template>

<script setup lang="ts">
import type { NoticeTag } from '../../types/notice'
import type { Spot, SpotKind } from '../../types/spot'
import { spotLabel } from '../../types/spot'
import { noticeToolbarOptions } from '../notice/toolbar-options'
import { userFacingError } from '../../utils/user-error'
const props = defineProps<{ kind: SpotKind; spotId?: string }>()
const { public: { apiBase } } = useRuntimeConfig()
const router = useRouter()
const auth = useAccountSession(), api = useAccountApi()
const { showSuccess, showError } = useUiFeedback()
const isAdmin = auth.isAdmin
const base = computed(() => '/admin/spots/' + props.kind)
const loading = ref(true), busy = ref(false), uploading = ref(false), dirty = ref(false), quillReady = ref(false)
const error = ref(''), decision = ref<'remove' | 'unpublish' | null>(null)
const selected = ref<Spot | null>(null)
const name = ref(''), dimension = ref(''), territoryId = ref('')
const mainImageId = ref<string | null>(null), localPreview = ref('')
const coordinates = reactive<{ x: string; y: string; z: string }>({ x: '', y: '', z: '' })
const axisFields = [{ key: 'x' as const, label: 'X' }, { key: 'y' as const, label: 'Y' }, { key: 'z' as const, label: 'Z' }]
const allTags = ref<NoticeTag[]>([]), selectedTags = ref<string[]>([])
const territories = ref<{ id: string; name: string; status: string }[]>([])
const editor = ref<HTMLDivElement | null>(null)
const { $loadQuill } = useNuxtApp()
let quill: InstanceType<Awaited<ReturnType<typeof $loadQuill>>> | null = null
const previewSource = computed(() => localPreview.value || (mainImageId.value ? apiBase + '/spot-images/' + mainImageId.value : ''))
function clearPreview() {
  if (localPreview.value) URL.revokeObjectURL(localPreview.value)
  localPreview.value = ''
}
function reset(item: Spot | null) {
  selected.value = item
  name.value = item?.name ?? ''
  mainImageId.value = item?.main_image_id ?? null
  dimension.value = item?.dimension ?? ''
  coordinates.x = item?.pos_x == null ? '' : String(item.pos_x)
  coordinates.y = item?.pos_y == null ? '' : String(item.pos_y)
  coordinates.z = item?.pos_z == null ? '' : String(item.pos_z)
  territoryId.value = item?.territory_id ?? ''
  selectedTags.value = item?.tags.map(tag => tag.name) ?? []
  clearPreview()
  if (quill) quill.setContents((item?.body_delta ?? { ops: [{ insert: '\n' }] }) as Parameters<typeof quill.setContents>[0])
  dirty.value = false
}
async function ensureQuill() {
  if (!editor.value || quill) return
  const Quill = await $loadQuill()
  if (!editor.value || quill) return
  quill = new Quill(editor.value, { theme: 'snow', modules: { toolbar: noticeToolbarOptions } })
  quill.getModule('toolbar')?.addHandler('image', () => void uploadBodyImage())
  quill.on('text-change', (_delta, _old, source) => { if (source === 'user') dirty.value = true })
  quillReady.value = true
  reset(selected.value)
}
watch(editor, () => void ensureQuill(), { flush: 'post' })
function updateTags(value: string[]) { selectedTags.value = value; dirty.value = true }
function clearMain() { mainImageId.value = null; clearPreview(); dirty.value = true }
async function sendImage(file: File) {
  if (file.size > 5 * 1024 * 1024) throw new Error('画像は5MB以内にしてください。')
  return await $fetch<{ id: string; url: string }>(apiBase + '/admin/spot-images/file', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/octet-stream',
      'X-XPlay-CSRF': auth.session.value.csrf_token ?? '', 'X-XPlay-Image-Mime': file.type },
    body: file,
  })
}
async function uploadMainImage(event: Event) {
  const input = event.target as HTMLInputElement, file = input.files?.[0]
  if (!file) return
  uploading.value = true
  error.value = ''
  try {
    const saved = await sendImage(file)
    clearPreview()
    localPreview.value = URL.createObjectURL(file)
    mainImageId.value = saved.id
    dirty.value = true
  } catch (cause) { error.value = userFacingError(cause); showError(cause) }
  finally { uploading.value = false; input.value = '' }
}
async function uploadBodyImage() {
  if (!quill || uploading.value || busy.value) return
  const input = document.createElement('input')
  input.type = 'file'; input.accept = 'image/jpeg,image/png,image/webp'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file || !quill) return
    uploading.value = true
    try {
      const saved = await sendImage(file)
      const index = quill.getSelection(true)?.index ?? quill.getLength()
      quill.insertEmbed(index, 'image', saved.url, 'user')
      quill.setSelection(index + 1)
    } catch (cause) { error.value = userFacingError(cause); showError(cause) }
    finally { uploading.value = false }
  }
  input.click()
}
function payload() {
  if (!name.value.trim()) throw new Error('名前を入力してください。')
  if (!quill) throw new Error('本文の読み込みが完了していません。')
  const common = { name: name.value, body_delta: quill.getContents(), main_image_id: mainImageId.value,
    ...(selected.value ? { expected_version: selected.value.version } : {}) }
  if (props.kind === 'public') {
    if (!dimension.value.trim() || Object.values(coordinates).some(value => value.trim() === '')) {
      throw new Error('ディメンションと座標を入力してください。')
    }
    return { ...common, dimension: dimension.value, x: Number(coordinates.x), y: Number(coordinates.y), z: Number(coordinates.z) }
  }
  if (!territoryId.value) throw new Error('領地を選択してください。')
  return { ...common, territory_id: territoryId.value, tags: selectedTags.value }
}
async function save(redirect = true): Promise<Spot | null> {
  if (busy.value || uploading.value) return null
  busy.value = true; error.value = ''
  try {
    const data = payload()
    const wasNew = !selected.value
    const result = selected.value
      ? await api.mutate<Spot>(base.value + '/' + selected.value.id, 'PATCH', data)
      : await api.mutate<Spot>(base.value, 'POST', data)
    reset(result)
    showSuccess('保存されました。')
    if (wasNew && redirect) await navigateTo(base.value + '/' + result.id + '/edit')
    return result
  } catch (cause) { error.value = userFacingError(cause); showError(cause); return null }
  finally { busy.value = false }
}
async function publish() {
  if (selected.value?.status === 'published' || busy.value) return
  if (props.kind === 'tourist' && !selectedTags.value.length) {
    error.value = '公開するにはタグを1件以上設定してください。'; return
  }
  const item = dirty.value || !selected.value ? await save(false) : selected.value
  if (!item) return
  busy.value = true
  try {
    const result = await api.mutate<Spot>(base.value + '/' + item.id + '/publish', 'POST', { expected_version: item.version })
    reset(result)
    showSuccess('公開されました。')
    if (!props.spotId) await navigateTo(base.value + '/' + result.id + '/edit')
  } catch (cause) { error.value = userFacingError(cause); showError(cause) }
  finally { busy.value = false }
}
async function confirmDecision() {
  if (!selected.value || !decision.value || busy.value) return
  const item = selected.value, action = decision.value
  busy.value = true
  try {
    if (action === 'unpublish') {
      const result = await api.mutate<Spot>(base.value + '/' + item.id + '/unpublish', 'POST',
        { expected_version: item.version })
      reset(result)
      showSuccess('公開を取り消しました。')
    } else {
      await api.mutate(base.value + '/' + item.id, 'DELETE', { expected_version: item.version })
      dirty.value = false
      showSuccess('削除されました。')
      await navigateTo(base.value)
    }
  } catch (cause) { error.value = userFacingError(cause); showError(cause) }
  finally { busy.value = false; decision.value = null }
}
onMounted(async () => {
  try {
    await auth.refresh()
    if (isAdmin.value) {
      const [items, list, tags] = await Promise.all([
        props.spotId ? api.get<Spot>(base.value + '/' + props.spotId) : Promise.resolve(null),
        props.kind === 'tourist' ? api.get<{ id: string; name: string; status: string }[]>('/territories?status=approved') : Promise.resolve([]),
        props.kind === 'tourist' ? api.get<NoticeTag[]>('/admin/spots/tags') : Promise.resolve([]),
      ])
      territories.value = list.filter(item => item.status === 'approved')
      allTags.value = tags
      reset(items)
    }
  } catch (cause) { error.value = userFacingError(cause); showError(cause) }
  finally { loading.value = false; await nextTick(); await ensureQuill() }
})
onBeforeUnmount(() => { clearPreview() })
</script>

<style scoped>
.spot-preview { width: min(100%, 22rem); max-height: 14rem; object-fit: contain; }
</style>
