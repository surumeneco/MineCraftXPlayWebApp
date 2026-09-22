<template>
  <section aria-labelledby="site-images-heading">
    <UiPageTitle id="site-images-heading" title="画像管理" />
    <p v-if="loading" role="status">管理者権限と画像を確認しています…</p>
    <div v-else-if="!auth.isAdmin.value" class="alert alert-warning" role="alert">
      この画面は管理者限定です。<NuxtLink to="/login">ログイン</NuxtLink>
    </div>
    <template v-else>
      <div class="d-flex flex-wrap justify-content-between gap-2 mb-3">
        <NuxtLink to="/admin/master" class="btn btn-outline-secondary">マスタメンテに戻る</NuxtLink>
        <NuxtLink to="/admin/image-presets" class="btn btn-outline-primary">画像プリセット管理</NuxtLink>
      </div>
      <UiPanel class="mb-4">
        <UiSectionHeading title="画像リソースを追加" />
        <form class="row g-3" @submit.prevent="createResource">
          <div class="col-12 col-md-5">
            <label for="resource-key" class="form-label">管理キー（変更不可）</label>
            <input id="resource-key" v-model.trim="newResource.key" class="form-control" maxlength="80" pattern="[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_-]*)+" placeholder="card.event" required />
          </div>
          <div class="col-12 col-md-7">
            <label for="resource-name" class="form-label">管理名</label>
            <input id="resource-name" v-model.trim="newResource.name" class="form-control" maxlength="100" required />
          </div>
          <div class="col-12">
            <label for="resource-description" class="form-label">説明（任意）</label>
            <input id="resource-description" v-model="newResource.description" class="form-control" maxlength="500" />
          </div>
          <div class="col-12 text-end"><button type="submit" class="btn btn-primary" :disabled="busy">画像リソースを追加</button></div>
        </form>
        <p class="small text-body-secondary mb-0 mt-2">管理キーを追加しただけではサイトに表示箇所は作成されません。</p>
      </UiPanel>

      <UiPanel>
        <UiSectionHeading title="画像一覧と履歴" />
        <div class="mb-3">
          <label for="resource-picker" class="form-label">管理対象</label>
          <select id="resource-picker" v-model="selectedId" class="form-select">
            <option v-for="resource in resources" :key="resource.id" :value="resource.id">{{ resource.name }}（{{ resource.key }}）</option>
          </select>
        </div>
        <template v-if="selected">
          <p class="small text-body-secondary text-break">{{ selected.key }} ／ {{ selected.versions.length }}バージョン</p>
          <form class="row g-2 mb-4" @submit.prevent="saveResource">
            <div class="col-12 col-md-5">
              <label for="edit-resource-name" class="form-label">リソース名</label>
              <input id="edit-resource-name" v-model.trim="resourceEdit.name" maxlength="100" class="form-control" required />
            </div>
            <div class="col-12 col-md-7">
              <label for="edit-resource-note" class="form-label">説明</label>
              <input id="edit-resource-note" v-model="resourceEdit.description" maxlength="500" class="form-control" />
            </div>
            <div class="col-12 text-end"><button class="btn btn-outline-primary" type="submit" :disabled="busy">リソース情報を保存</button></div>
          </form>
          <UiSectionHeading title="新しい画像バージョンを追加" />
          <form class="row g-3 mb-4" @submit.prevent="uploadVersion">
            <div class="col-12">
              <label for="image-file" class="form-label">画像ファイル（JPEG・PNG・WebP・SVG、5 MiB以内）</label>
              <input id="image-file" ref="fileInput" type="file" class="form-control" accept=".jpg,.jpeg,.png,.webp,.svg,image/jpeg,image/png,image/webp,image/svg+xml" required @change="chooseFile" />
            </div>
            <div class="col-12 col-md-5">
              <label for="image-name" class="form-label">画像名</label>
              <input id="image-name" v-model.trim="newVersion.name" class="form-control" maxlength="100" required />
            </div>
            <div class="col-12 col-md-7">
              <label for="image-note" class="form-label">メモ（任意）</label>
              <input id="image-note" v-model="newVersion.note" class="form-control" maxlength="500" />
            </div>
            <div class="col-12 text-end"><button type="submit" class="btn btn-primary" :disabled="busy || !uploadFile">アップロードして履歴に保存</button></div>
          </form>

          <UiSectionHeading title="保存済みのバージョン" />
          <p v-if="!selected.versions.length">登録済みの画像はありません。</p>
          <div v-for="version in selected.versions" :key="version.id" class="border rounded p-3 mb-3">
            <div class="row g-3 align-items-start">
              <div class="col-12 col-md-4">
                <img :src="preview(version)" :alt="version.name" class="img-fluid rounded xplay-image-preview" loading="lazy" />
              </div>
              <div class="col-12 col-md-8">
                <p class="small text-body-secondary">バージョン {{ version.version_number }} ／ {{ new Date(version.created_at).toLocaleString('ja-JP') }}</p>
                <template v-if="versionEdits[version.id]">
                  <label :for="`version-name-${version.id}`" class="form-label">画像名</label>
                  <input :id="`version-name-${version.id}`" v-model.trim="versionEdits[version.id].name" class="form-control mb-2" maxlength="100" required />
                  <label :for="`version-note-${version.id}`" class="form-label">メモ</label>
                  <input :id="`version-note-${version.id}`" v-model="versionEdits[version.id].note" class="form-control mb-2" maxlength="500" />
                  <div class="text-end"><button type="button" class="btn btn-sm btn-outline-primary" :disabled="busy" @click="saveVersion(version.id)">名前・メモを保存</button></div>
                </template>
              </div>
            </div>
          </div>
          <p class="small text-body-secondary mb-0">過去バージョンは削除されません。どの画像を表示するかはプリセット管理で指定します。</p>
        </template>
        <p v-else>画像リソースがありません。</p>
      </UiPanel>
    </template>
  </section>
</template>

<script setup lang="ts">
import type { SiteImageResource, SiteImageVersion } from '../../composables/useSiteImageApi'

const auth = useAccountSession()
const api = useSiteImageApi()
const { showSuccess, showError } = useUiFeedback()
const loading = ref(true), busy = ref(false)
const resources = ref<SiteImageResource[]>([])
const selectedId = ref('')
const selected = computed(() => resources.value.find(resource => resource.id === selectedId.value))
const newResource = reactive({ key: '', name: '', description: '' })
const resourceEdit = reactive({ name: '', description: '' })
const newVersion = reactive({ name: '', note: '' })
const uploadFile = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const versionEdits = reactive<Record<string, { name: string; note: string }>>({})
const preview = api.preview

watch(selected, resource => {
  resourceEdit.name = resource?.name ?? ''
  resourceEdit.description = resource?.description ?? ''
})

async function loadResources(): Promise<void> {
  resources.value = await api.get<SiteImageResource[]>('/admin/site-images')
  if (!resources.value.some(resource => resource.id === selectedId.value)) selectedId.value = resources.value[0]?.id ?? ''
  for (const resource of resources.value) for (const version of resource.versions) {
    versionEdits[version.id] = { name: version.name, note: version.note }
  }
}
async function run(action: () => Promise<void>, message: string): Promise<void> {
  if (busy.value) return
  busy.value = true
  try { await action(); showSuccess(message) }
  catch { /* useSiteImageApi has already displayed the error */ }
  finally { busy.value = false }
}
function chooseFile(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0] ?? null
  uploadFile.value = file
  if (file) newVersion.name = file.name.replace(/\.[^.]+$/, '').slice(0, 100)
  if (file && file.size > 5 * 1024 * 1024) {
    uploadFile.value = null
    showError('画像のサイズは5 MiB以内にしてください。')
  }
}
function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result.split(',')[1] ?? '') : reject(new Error('画像を読み込めません。'))
    reader.onerror = () => reject(new Error('画像を読み込めません。'))
    reader.readAsDataURL(file)
  })
}
async function createResource(): Promise<void> {
  await run(async () => {
    const created = await api.mutate<{ id: string }>('/admin/site-images/resources', 'POST', { ...newResource })
    newResource.key = ''; newResource.name = ''; newResource.description = ''
    await loadResources(); selectedId.value = created.id
  }, '画像リソースを追加しました。')
}
async function saveResource(): Promise<void> {
  if (!selected.value) return
  await run(async () => {
    await api.mutate(`/admin/site-images/resources/${selectedId.value}`, 'PATCH', { ...resourceEdit })
    await loadResources()
  }, 'リソース情報を保存しました。')
}
async function uploadVersion(): Promise<void> {
  if (!selected.value || !uploadFile.value) return
  await run(async () => {
    const file = uploadFile.value!
    const encoded = await readFile(file)
    await api.mutate(`/admin/site-images/resources/${selectedId.value}/versions`, 'POST', {
      name: newVersion.name, note: newVersion.note, mime_type: file.type, data_base64: encoded,
    })
    uploadFile.value = null; newVersion.name = ''; newVersion.note = ''
    if (fileInput.value) fileInput.value.value = ''
    await loadResources()
  }, '画像を履歴に保存しました。')
}
async function saveVersion(id: string): Promise<void> {
  const edit = versionEdits[id]
  if (!edit) return
  await run(async () => {
    await api.mutate(`/admin/site-images/versions/${id}`, 'PATCH', { ...edit })
    await loadResources()
  }, '画像名とメモを保存しました。')
}
onMounted(async () => {
  try { await auth.refresh(); if (auth.isAdmin.value) await loadResources() }
  catch { /* API errors are shown in the shared dialog */ }
  finally { loading.value = false }
})
</script>

<style scoped>
.xplay-image-preview { display: block; width: 100%; max-height: 15rem; object-fit: contain; background: var(--xplay-panel-soft); }
</style>
