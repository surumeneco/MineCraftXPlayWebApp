<template>
  <section aria-labelledby="presets-heading">
    <UiPageTitle id="presets-heading" title="画像プリセット管理" />
    <p v-if="loading" role="status">管理者権限とプリセットを確認しています…</p>
    <div v-else-if="!auth.isAdmin.value" class="alert alert-warning" role="alert">
      この画面は管理者限定です。<NuxtLink to="/login">ログイン</NuxtLink>
    </div>
    <template v-else>
      <div class="d-flex flex-wrap justify-content-between gap-2 mb-3">
        <NuxtLink to="/admin/master" class="btn btn-outline-secondary">マスタメンテに戻る</NuxtLink>
        <NuxtLink to="/admin/images" class="btn btn-outline-primary">画像管理</NuxtLink>
      </div>
      <UiPanel class="mb-4">
        <UiSectionHeading title="適用中の設定" />
        <p class="mb-2"><strong>{{ activePreset?.name ?? '取得できません' }}</strong> <span v-if="activePreset?.is_default" class="badge text-bg-success">通常設定</span></p>
        <p class="small text-body-secondary">イベント用プリセットから通常設定に戻すと、通常設定で保存されている最新の構成になります。</p>
        <button v-if="activePreset && !activePreset.is_default && normalPreset" type="button" class="btn btn-outline-primary" :disabled="busy" @click="askApply(normalPreset.id)">通常設定に戻す</button>
      </UiPanel>
      <UiPanel class="mb-4">
        <UiSectionHeading title="イベント用プリセットを新規作成" />
        <form class="row g-3" @submit.prevent="createPreset">
          <div class="col-12 col-md-5">
            <label for="new-preset-name" class="form-label">プリセット名</label>
            <input id="new-preset-name" v-model.trim="newPreset.name" class="form-control" maxlength="100" placeholder="クリスマス2026" required />
          </div>
          <div class="col-12 col-md-7">
            <label for="new-preset-description" class="form-label">説明（任意）</label>
            <input id="new-preset-description" v-model="newPreset.description" class="form-control" maxlength="500" />
          </div>
          <div class="col-12 text-end"><button type="submit" class="btn btn-primary" :disabled="busy">プリセットを追加</button></div>
        </form>
      </UiPanel>
      <UiPanel>
        <UiSectionHeading title="プリセット編集・プレビュー" />
        <div class="mb-3">
          <label for="preset-picker" class="form-label">対象プリセット</label>
          <select id="preset-picker" v-model="selectedId" class="form-select">
            <option v-for="preset in presetData.presets" :key="preset.id" :value="preset.id">{{ preset.name }}{{ preset.is_default ? '（通常設定）' : '' }}{{ preset.id === presetData.active_preset_id ? '［適用中］' : '' }}</option>
          </select>
        </div>
        <template v-if="selectedPreset">
          <form v-if="!selectedPreset.is_default" class="row g-2 mb-3" @submit.prevent="savePreset">
            <div class="col-12 col-md-5">
              <label for="edit-preset-name" class="form-label">プリセット名</label>
              <input id="edit-preset-name" v-model.trim="presetEdit.name" class="form-control" maxlength="100" required />
            </div>
            <div class="col-12 col-md-7">
              <label for="edit-preset-description" class="form-label">説明</label>
              <input id="edit-preset-description" v-model="presetEdit.description" class="form-control" maxlength="500" />
            </div>
            <div class="col-12 text-end"><button type="submit" class="btn btn-outline-primary" :disabled="busy">プリセット情報を保存</button></div>
          </form>
          <p v-else class="small text-body-secondary">通常設定は削除・名称変更できません。画像の割り当ては編集できます。</p>
          <p v-if="selectedPreset.id === presetData.active_preset_id" class="alert alert-info small">適用中のプリセットの画像割り当ては変更後すぐに公開表示へ反映されます。</p>
          <p v-else-if="!selectedPreset.is_default" class="small text-body-secondary">「通常設定を継承」の画像は、イベント実施中も通常設定の変更を引き継ぎます。</p>
          <div v-for="resource in resources" :key="resource.id" class="border rounded p-3 mb-3">
            <div class="row g-3 align-items-center">
              <div class="col-12 col-md-3">
                <img v-if="effectiveVersion(resource)" :src="preview(effectiveVersion(resource)!)" :alt="effectiveVersion(resource)?.name" class="img-fluid rounded xplay-preset-preview" loading="lazy" />
                <div v-else class="rounded border p-3 text-body-secondary small">画像なし・既定表示</div>
              </div>
              <div class="col-12 col-md-9">
                <strong>{{ resource.name }}</strong>
                <small class="d-block text-body-secondary text-break">{{ resource.key }}</small>
                <p class="small mb-2">表示される画像：{{ effectiveVersion(resource)?.name ?? 'なし' }}</p>
                <label :for="`mode-${resource.id}`" class="form-label">表示方法</label>
                <select :id="`mode-${resource.id}`" class="form-select mb-2" :value="modeFor(resource.id)" :disabled="busy" @change="changeMode(resource, $event)">
                  <option v-if="!selectedPreset.is_default" value="inherit">通常設定を継承</option>
                  <option value="none">画像なし（単色・既定表示）</option>
                  <option value="image" :disabled="!resource.versions.length">画像を選択</option>
                </select>
                <template v-if="modeFor(resource.id) === 'image'">
                  <label :for="`version-${resource.id}`" class="form-label">画像バージョン</label>
                  <select :id="`version-${resource.id}`" class="form-select" :value="itemFor(resource.id)?.version_id ?? ''" :disabled="busy" @change="changeVersion(resource.id, $event)">
                    <option v-for="version in resource.versions" :key="version.id" :value="version.id">v{{ version.version_number }}：{{ version.name }}</option>
                  </select>
                </template>
              </div>
            </div>
          </div>
          <div class="d-flex justify-content-end mt-3">
            <button v-if="selectedPreset.id !== presetData.active_preset_id" type="button" class="btn btn-primary" :disabled="busy" @click="askApply(selectedPreset.id)">このプリセットを一括適用</button>
            <span v-else class="badge text-bg-success align-self-center">このプリセットを適用中</span>
          </div>
          <p class="small text-body-secondary mb-0 mt-2">切り替えはプリセットの参照を一度に変更します。画像は削除されず、ほかのプリセットも保持されます。</p>
        </template>
      </UiPanel>
      <UiPanel class="mt-4">
        <UiSectionHeading title="適用履歴（直近100件）" />
        <p v-if="!history.length" class="mb-0">適用履歴はありません。</p>
        <div v-else class="table-responsive">
          <table class="table table-striped align-middle">
            <thead><tr><th scope="col">日時</th><th scope="col">変更前</th><th scope="col">変更後</th><th scope="col">操作者ID</th></tr></thead>
            <tbody><tr v-for="entry in history" :key="entry.id">
              <td>{{ new Date(entry.applied_at).toLocaleString('ja-JP') }}</td>
              <td>{{ entry.previous_name }}</td><td>{{ entry.next_name }}</td>
              <td class="small text-break">{{ entry.applied_by ?? '退会済み' }}</td>
            </tr></tbody>
          </table>
        </div>
      </UiPanel>
    </template>
    <UiDialog :open="!!applyId" kind="confirmation" title="画像プリセットを適用しますか？"
      :message="`『${applyTarget?.name ?? ''}』に切り替えます。サイトの画像表示が更新されます。`" preset="yes-no"
      :busy="busy" @action="handleApplyAction" @close="applyId = null" />
  </section>
</template>

<script setup lang="ts">
import type { SiteImagePreset, SiteImagePresetList, SiteImageResource, SiteImageVersion, SiteImagePresetEvent } from '../../composables/useSiteImageApi'

const auth = useAccountSession()
const api = useSiteImageApi()
const { showSuccess, showError } = useUiFeedback()
const loading = ref(true), busy = ref(false)
const resources = ref<SiteImageResource[]>([])
const presetData = ref<SiteImagePresetList>({ active_preset_id: '', revision: 0, presets: [] })
const history = ref<SiteImagePresetEvent[]>([])
const selectedId = ref(''), applyId = ref<string | null>(null)
const newPreset = reactive({ name: '', description: '' })
const presetEdit = reactive({ name: '', description: '' })
const selectedPreset = computed(() => presetData.value.presets.find(p => p.id === selectedId.value))
const normalPreset = computed(() => presetData.value.presets.find(p => p.is_default))
const activePreset = computed(() => presetData.value.presets.find(p => p.id === presetData.value.active_preset_id))
const applyTarget = computed(() => presetData.value.presets.find(p => p.id === applyId.value))
const preview = api.preview

watch(selectedPreset, preset => {
  presetEdit.name = preset?.name ?? ''
  presetEdit.description = preset?.description ?? ''
})
async function load(): Promise<void> {
  const [nextResources, nextPresets, nextHistory] = await Promise.all([
    api.get<SiteImageResource[]>('/admin/site-images'),
    api.get<SiteImagePresetList>('/admin/site-image-presets'),
    api.get<SiteImagePresetEvent[]>('/admin/site-image-presets/history'),
  ])
  resources.value = nextResources; presetData.value = nextPresets; history.value = nextHistory
  if (!nextPresets.presets.some(p => p.id === selectedId.value)) selectedId.value = nextPresets.active_preset_id
}
async function run(action: () => Promise<void>, message: string): Promise<void> {
  if (busy.value) return
  busy.value = true
  try { await action(); showSuccess(message) }
  catch { /* errors are displayed by the API composable */ }
  finally { busy.value = false }
}
function itemFor(resourceId: string) { return selectedPreset.value?.items.find(i => i.resource_id === resourceId) }
function modeFor(resourceId: string): 'inherit' | 'none' | 'image' {
  const item = itemFor(resourceId)
  if (!item) return selectedPreset.value?.is_default ? 'none' : 'inherit'
  return item.version_id ? 'image' : 'none'
}
function effectiveVersion(resource: SiteImageResource): SiteImageVersion | undefined {
  const item = itemFor(resource.id)
  const chosen = selectedPreset.value?.is_default || item
    ? item?.version_id
    : normalPreset.value?.items.find(i => i.resource_id === resource.id)?.version_id
  return resource.versions.find(version => version.id === chosen)
}
async function createPreset(): Promise<void> {
  await run(async () => {
    const created = await api.mutate<{ id: string }>('/admin/site-image-presets', 'POST', { ...newPreset })
    newPreset.name = ''; newPreset.description = ''
    await load(); selectedId.value = created.id
  }, 'プリセットを作成しました。')
}
async function savePreset(): Promise<void> {
  if (!selectedPreset.value || selectedPreset.value.is_default) return
  await run(async () => {
    await api.mutate(`/admin/site-image-presets/${selectedId.value}`, 'PATCH', { ...presetEdit })
    await load()
  }, 'プリセット情報を保存しました。')
}
function changedValue(event: Event): string { return (event.target as HTMLSelectElement).value }
async function changeMode(resource: SiteImageResource, event: Event): Promise<void> {
  const mode = changedValue(event)
  const versionId = mode === 'image' ? (itemFor(resource.id)?.version_id ?? resource.versions[0]?.id) : null
  if (mode === 'image' && !versionId) { showError('選択できる画像がありません。'); return }
  await run(async () => {
    await api.mutate(`/admin/site-image-presets/${selectedId.value}/items/${resource.id}`, 'PUT', { mode, version_id: versionId })
    await load()
  }, '画像の割り当てを保存しました。')
}
async function changeVersion(resourceId: string, event: Event): Promise<void> {
  await run(async () => {
    await api.mutate(`/admin/site-image-presets/${selectedId.value}/items/${resourceId}`, 'PUT', { mode: 'image', version_id: changedValue(event) })
    await load()
  }, '使用する画像を変更しました。')
}
function askApply(id: string): void { applyId.value = id }
async function handleApplyAction(action: string): Promise<void> {
  if (action !== 'yes' || !applyId.value) { applyId.value = null; return }
  const id = applyId.value
  await run(async () => {
    await api.mutate(`/admin/site-image-presets/${id}/apply`, 'POST')
    applyId.value = null
    await load()
  }, '画像プリセットを適用しました。')
}
onMounted(async () => {
  try { await auth.refresh(); if (auth.isAdmin.value) await load() }
  catch { /* API errors are displayed in the shared dialog */ }
  finally { loading.value = false }
})
</script>

<style scoped>
.xplay-preset-preview { display: block; width: 100%; max-height: 9rem; object-fit: contain; background: var(--xplay-panel-soft); }
</style>
