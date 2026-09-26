<template>
  <section aria-labelledby="home-maintenance-heading">
    <UiPageTitle id="home-maintenance-heading" title="ホームメンテ" />
    <p v-if="loading" role="status">管理者権限とカード設定を確認しています…</p>
    <p v-else-if="!auth.isAdmin.value" role="alert" class="alert alert-warning">管理者権限が必要です。</p>
    <template v-else-if="draft">
      <p v-if="message" class="alert alert-success" role="status">{{ message }}</p>
      <UiPanel class="mb-4">
        <UiSectionHeading title="ホームのカテゴリ・カード" />
        <p class="small text-body-secondary">「最近のお知らせ」より下の表示内容です。上から順に表示されます。</p>
        <div v-for="(category, categoryIndex) in draft.categories" :key="category.id" class="border rounded p-3 mb-3">
          <div class="row g-2 align-items-end mb-3">
            <div class="col-12 col-lg">
              <label class="form-label" :for="`category-${category.id}`">カテゴリ名</label>
              <input :id="`category-${category.id}`" v-model="category.title" maxlength="100" required class="form-control" />
            </div>
            <div class="col-12 col-lg-auto d-flex gap-2 justify-content-end flex-wrap">
              <button type="button" class="btn btn-outline-secondary" :disabled="busy || categoryIndex === 0"
                :aria-label="`${category.title}を上へ`" @click="move(draft.categories,categoryIndex,-1)">上へ</button>
              <button type="button" class="btn btn-outline-secondary" :disabled="busy || categoryIndex === draft.categories.length-1"
                :aria-label="`${category.title}を下へ`" @click="move(draft.categories,categoryIndex,1)">下へ</button>
              <button type="button" class="btn btn-outline-danger" :disabled="busy" @click="draft.categories.splice(categoryIndex,1)">カテゴリ削除</button>
            </div>
          </div>
          <div v-for="(card, cardIndex) in category.cards" :key="card.id" class="border rounded p-3 mb-3">
            <div class="d-flex justify-content-between align-items-center gap-2 flex-wrap mb-2">
              <strong>{{ card.type === 'hub' ? 'トップカード参照' : 'カスタムカード' }} {{ cardIndex + 1 }}</strong>
              <div class="d-flex gap-2 justify-content-end">
                <button type="button" class="btn btn-sm btn-outline-secondary" :disabled="busy || cardIndex === 0" @click="move(category.cards,cardIndex,-1)">上へ</button>
                <button type="button" class="btn btn-sm btn-outline-secondary" :disabled="busy || cardIndex === category.cards.length-1" @click="move(category.cards,cardIndex,1)">下へ</button>
                <button type="button" class="btn btn-sm btn-outline-danger" :disabled="busy" @click="category.cards.splice(cardIndex,1)">削除</button>
              </div>
            </div>
            <template v-if="card.type === 'hub'">
              <label class="form-label" :for="`home-ref-${card.id}`">参照するトップカード</label>
              <select :id="`home-ref-${card.id}`" v-model="card.hub_key" class="form-select" :disabled="busy">
                <option v-for="link in links" :key="link.key" :value="link.key">{{ groupTitle(link.group) }}：{{ link.title }}</option>
              </select>
              <p class="small text-body-secondary mt-2 mb-0">タイトル・補足文・リンク・画像は元のトップカードの設定を使用します。下の「情報・一覧・申請トップ」で変更できます。</p>
            </template>
            <template v-else>
              <div class="row g-3">
                <div class="col-12 col-md-6">
                  <label class="form-label" :for="`card-title-${card.id}`">タイトル（必須）</label>
                  <input :id="`card-title-${card.id}`" v-model="card.title" class="form-control" maxlength="100" required />
                </div>
                <div class="col-12 col-md-6">
                  <label class="form-label" :for="`card-link-${card.id}`">リンク（必須）</label>
                  <input :id="`card-link-${card.id}`" v-model="card.url" class="form-control" maxlength="512" required placeholder="/info または https://..." />
                </div>
                <div class="col-12">
                  <label class="form-label" :for="`card-note-${card.id}`">補足文（任意）</label>
                  <input :id="`card-note-${card.id}`" v-model="card.note" class="form-control" maxlength="500" />
                </div>
                <div class="col-12 form-check ms-2">
                  <input :id="`card-newtab-${card.id}`" v-model="card.new_tab" class="form-check-input" type="checkbox" />
                  <label :for="`card-newtab-${card.id}`" class="form-check-label">新しいタブで開く</label>
                </div>
              </div>
              <div class="mt-3">
                <label class="form-label" :for="`card-image-${card.id}`">カード画像（任意）</label>
                <input :id="`card-image-${card.id}`" type="file" class="form-control" accept="image/jpeg,image/png,image/webp,image/svg+xml,.svg"
                  :disabled="busy" @change="selectImage(`card:${card.id}`,$event)" />
                <p v-if="fileNames[`card:${card.id}`]" class="small mt-1">保存時にアップロード：{{ fileNames[`card:${card.id}`] }}</p>
                <img v-else-if="imageSource(card.image)" class="image-preview my-2" :src="imageSource(card.image)" alt="設定中のカード画像" />
                <div class="text-end mt-2">
                  <button type="button" class="btn btn-sm btn-outline-secondary" :disabled="busy"
                    @click="clearImage(card,`card:${card.id}`)">画像を未設定にする</button>
                </div>
              </div>
            </template>
          </div>
          <div class="d-flex gap-2 flex-wrap justify-content-end">
            <button type="button" class="btn btn-outline-primary" :disabled="busy" @click="addCustom(category)">カスタムカードを追加</button>
            <div class="d-flex gap-2 flex-grow-1 flex-sm-grow-0">
              <select v-model="selectedRefs[category.id]" :aria-label="`${category.title}に追加するトップカード`" class="form-select" :disabled="busy">
                <option v-for="link in links" :key="link.key" :value="link.key">{{ groupTitle(link.group) }}：{{ link.title }}</option>
              </select>
              <button type="button" class="btn btn-outline-primary text-nowrap" :disabled="busy || !links.length" @click="addReference(category)">参照追加</button>
            </div>
          </div>
        </div>
        <div class="text-end"><button type="button" class="btn btn-outline-primary" :disabled="busy" @click="addCategory">カテゴリを追加</button></div>
      </UiPanel>

      <UiPanel class="mb-4">
        <UiSectionHeading title="情報・一覧・申請トップのカード" />
        <p class="small text-body-secondary">カード名とリンク先は固定です。各ページ内の順序、補足文、画像を変更できます。ホームで参照しているカードにも同じ設定が反映されます。</p>
        <section v-for="group in groups" :key="group.key" class="mb-4" :aria-label="`${group.title}トップ`">
          <h3 class="h5 mb-3">{{ group.title }}トップ</h3>
          <div v-for="(hub,index) in groupHubs(group.key)" :key="hub.key" class="border rounded p-3 mb-3">
            <div class="d-flex justify-content-between align-items-center gap-2 flex-wrap mb-2">
              <strong>{{ linkFor(hub.key)?.title }}</strong>
              <div class="d-flex gap-2">
                <button type="button" class="btn btn-sm btn-outline-secondary" :disabled="busy || index === 0" @click="moveHub(group.key,index,-1)">上へ</button>
                <button type="button" class="btn btn-sm btn-outline-secondary" :disabled="busy || index === groupHubs(group.key).length-1" @click="moveHub(group.key,index,1)">下へ</button>
              </div>
            </div>
            <p class="small text-body-secondary">{{ linkFor(hub.key)?.url }}</p>
            <label class="form-label" :for="`hub-note-${hub.key}`">補足文（任意）</label>
            <input :id="`hub-note-${hub.key}`" v-model="hub.note" class="form-control" maxlength="500" />
            <label class="form-label mt-3" :for="`hub-image-${hub.key}`">カード画像（任意）</label>
            <input :id="`hub-image-${hub.key}`" type="file" class="form-control" accept="image/jpeg,image/png,image/webp,image/svg+xml,.svg"
              :disabled="busy" @change="selectImage(`hub:${hub.key}`,$event)" />
            <p v-if="fileNames[`hub:${hub.key}`]" class="small mt-1">保存時にアップロード：{{ fileNames[`hub:${hub.key}`] }}</p>
            <img v-else-if="imageSource(hub.image)" class="image-preview my-2" :src="imageSource(hub.image)" alt="設定中のカード画像" />
            <div class="text-end mt-2">
              <button type="button" class="btn btn-sm btn-outline-secondary" :disabled="busy" @click="clearImage(hub,`hub:${hub.key}`)">画像を未設定にする</button>
            </div>
          </div>
        </section>
      </UiPanel>
      <div class="d-flex justify-content-end mb-3">
        <button type="button" class="btn btn-primary" :disabled="busy" @click="save">{{ busy ? '保存中…' : 'すべての変更を保存' }}</button>
      </div>
    </template>
    <p v-else class="alert alert-danger" role="alert">カード設定を読み込めませんでした。</p>
  </section>
</template>

<script setup lang="ts">
import type { HomeLayoutData, HomeLayoutResponse, HomeCategoryConfig, HomeCardConfig, HubCardConfig, HubCardLink, ManagedCardImage } from '../../composables/useHomeLayout'

const groups = [
  { key: 'info', title: '情報' },
  { key: 'lists', title: '一覧' },
  { key: 'applications', title: '申請' },
]
const auth = useAccountSession()
const { public: { apiBase } } = useRuntimeConfig()
const { showError, showSuccess } = useUiFeedback()
const { imageSource } = useHomeLayout()
const draft = ref<HomeLayoutData | null>(null)
const links = ref<HubCardLink[]>([])
const revision = ref(0)
const loading = ref(true), busy = ref(false), message = ref('')
const files = new Map<string, File>()
const fileNames = reactive<Record<string,string>>({})
const selectedRefs = reactive<Record<string,string>>({})
function groupTitle(group: string): string { return groups.find(item => item.key === group)?.title ?? group }
function linkFor(key: string): HubCardLink | undefined { return links.value.find(item => item.key === key) }
function groupHubs(group: string): HubCardConfig[] { return draft.value?.hubs.filter(hub => linkFor(hub.key)?.group === group) ?? [] }
function move<T>(items: T[], index: number, by: number) {
  const destination = index + by
  if (index < 0 || destination < 0 || destination >= items.length) return
  ;[items[index], items[destination]] = [items[destination], items[index]]
}
function moveHub(group: string, index: number, by: number) {
  if (!draft.value) return
  const items = groupHubs(group)
  const other = items[index + by]
  if (!other) return
  const left = draft.value.hubs.findIndex(hub => hub.key === items[index].key)
  const right = draft.value.hubs.findIndex(hub => hub.key === other.key)
  ;[draft.value.hubs[left],draft.value.hubs[right]] = [draft.value.hubs[right],draft.value.hubs[left]]
}
function newId(): string { return crypto.randomUUID() }
function addCategory() {
  if (!draft.value) return
  const id = newId()
  draft.value.categories.push({ id, title: '新しいカテゴリ', cards: [] })
  selectedRefs[id] = links.value[0]?.key || ''
}
function addCustom(category: HomeCategoryConfig) {
  category.cards.push({ id: newId(), type: 'custom', title: '', note: '', url: '', image: null, new_tab: false })
}
function addReference(category: HomeCategoryConfig) {
  const key = selectedRefs[category.id] || links.value[0]?.key
  if (key) category.cards.push({ id: newId(), type: 'hub', hub_key: key })
}
function selectImage(key: string, event: Event) {
  const input = event.target as HTMLInputElement
  const chosen = input.files?.[0]
  if (chosen) { files.set(key, chosen); fileNames[key] = chosen.name }
  input.value = ''
}
function clearImage(item: { image?: ManagedCardImage }, key: string) {
  item.image = null
  files.delete(key)
  delete fileNames[key]
}
async function load() {
  const response = await $fetch<HomeLayoutResponse>(`${apiBase}/admin/home-layout`, { credentials: 'include' })
  revision.value = response.revision
  links.value = response.links
  draft.value = structuredClone(response.data)
  files.clear()
  Object.keys(fileNames).forEach(key => delete fileNames[key])
  for (const category of response.data.categories) selectedRefs[category.id] = links.value[0]?.key || ''
}
async function upload(file: File): Promise<{image_id:string}> {
  return $fetch<{image_id:string}>(`${apiBase}/admin/home-layout/images/file`, {
    method: 'POST', credentials: 'include', body: file,
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-XPlay-CSRF': auth.session.value.csrf_token ?? '',
      'X-XPlay-Image-Mime': encodeURIComponent(file.type),
    },
  })
}
async function save() {
  if (busy.value || !draft.value) return
  busy.value = true
  message.value = ''
  try {
    for (const [key,file] of files.entries()) {
      const [kind,id] = key.split(':',2)
      const target = kind === 'hub'
        ? draft.value.hubs.find(hub => hub.key === id)
        : draft.value.categories.flatMap(category => category.cards).find(card => card.id === id && card.type === 'custom')
      if (!target) continue
      target.image = await upload(file)
      files.delete(key)
      delete fileNames[key]
    }
    await $fetch<HomeLayoutResponse>(`${apiBase}/admin/home-layout`, {
      method: 'PUT', credentials: 'include',
      headers: { 'X-XPlay-CSRF': auth.session.value.csrf_token ?? '' },
      body: { revision: revision.value, ...draft.value },
    })
    await load()
    await refreshNuxtData('home-layout')
    showSuccess('ホームとトップカードの設定を保存しました。')
    message.value = '保存されました。'
  } catch (error) { showError(error) }
  finally { busy.value = false }
}
onMounted(async () => {
  try { await auth.refresh(); if (auth.isAdmin.value) await load() }
  catch (error) { showError(error) }
  finally { loading.value = false }
})
</script>

<style scoped>
.image-preview { display: block; max-width: 100%; max-height: 12rem; height: auto; object-fit: contain; border-radius: var(--xplay-panel-radius); }
</style>
