<template>
  <section>
    <h1 class="h2 mb-3">お知らせ管理</h1>
    <div v-if="loading" role="status">管理画面を読み込んでいます…</div>
    <div v-else-if="!authenticated" class="alert alert-info">
      管理画面の利用にはDiscord管理者認証が必要です。
      <a class="btn btn-primary ms-2" :href="`${apiBase}/auth/discord`">Discordでログイン</a>
    </div>
    <template v-else>
      <div class="d-flex flex-wrap gap-2 align-items-center mb-3">
        <button type="button" class="btn btn-outline-primary" @click="startNew">新規投稿</button>
        <button type="button" class="btn btn-outline-secondary" @click="reload">一覧更新</button>
        <button type="button" class="btn btn-outline-secondary ms-auto" @click="logout">ログアウト</button>
      </div>
      <div v-if="errorMessage" class="alert alert-danger" role="alert">{{ errorMessage }}</div>
      <div v-if="infoMessage" class="alert alert-success" role="status">{{ infoMessage }}</div>
      <div class="row g-4">
        <aside class="col-12 col-lg-4" aria-label="管理対象の記事一覧">
          <h2 class="h5">記事一覧</h2>
          <div class="list-group">
            <button v-for="notice in notices" :key="notice.id" type="button"
              class="list-group-item list-group-item-action" :class="{ active: selected?.id === notice.id }"
              @click="selectNotice(notice.id)">
              {{ notice.title }} <span class="badge text-bg-secondary">{{ statusLabel(notice.status) }}</span>
            </button>
          </div>
          <p v-if="!notices.length" class="text-body-secondary">記事はありません。</p>
        </aside>
        <div class="col-12 col-lg-8">
          <form @submit.prevent="save">
            <h2 class="h5">{{ selected ? '記事を編集' : '新規投稿' }}</h2>
            <label class="form-label" for="notice-admin-title">タイトル</label>
            <input id="notice-admin-title" v-model="heading" class="form-control mb-3" required
              :readonly="selected?.status === 'published'" @input="dirty = true" />
            <NoticeTagPicker :model-value="selectedTags" :tags="allTags" @update:model-value="updateTags" />
            <label class="form-label mt-3">本文</label>
            <ClientOnly><div ref="editor" class="mb-3" aria-label="お知らせ本文" /></ClientOnly>
            <p class="form-text">画像は本文の任意位置へ挿入できます。画像・記事の変更は保存時に確定します。</p>
            <div class="d-flex flex-wrap gap-2">
              <button type="submit" class="btn btn-primary" :disabled="busy">{{ busy ? '処理中…' : '保存' }}</button>
              <button type="button" class="btn btn-success" :disabled="busy || selected?.status === 'published'" @click="publish">公開する</button>
              <button v-if="selected?.status === 'published'" type="button" class="btn btn-warning" :disabled="busy" @click="unpublish">公開取り消し</button>
              <button v-else-if="selected" type="button" class="btn btn-danger" :disabled="busy" @click="remove">物理削除</button>
              <button type="button" class="btn btn-outline-secondary" :disabled="busy" @click="cancel">変更を破棄</button>
            </div>
          </form>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import type { NoticeDelta, NoticeTag } from '../../types/notice'

type AdminNotice = {
  id: string; title: string; status: 'draft' | 'published' | 'unpublished'; version: number;
  body_delta: NoticeDelta; tags: NoticeTag[]; created_at: string; updated_at: string; published_at: string | null
}
const { public: { apiBase } } = useRuntimeConfig()
const { $loadQuill } = useNuxtApp()
const loading = ref(true), authenticated = ref(false), busy = ref(false), dirty = ref(false)
const csrf = ref(''), errorMessage = ref(''), infoMessage = ref('')
const notices = ref<AdminNotice[]>([]), allTags = ref<NoticeTag[]>([]), selected = ref<AdminNotice | null>(null)
const heading = ref(''), selectedTags = ref<string[]>([]), editor = ref<HTMLDivElement | null>(null)
let quill: InstanceType<Awaited<ReturnType<typeof $loadQuill>>> | null = null
let session = ''
const pending = new Set<string>()
let heartbeat: ReturnType<typeof setInterval> | undefined
const statusLabel = (status: AdminNotice['status']) => ({ draft: '下書き', published: '公開', unpublished: '非公開' })[status]
const newSession = () => { session = crypto.randomUUID(); pending.clear() }

function api<T>(path: string, options: Record<string, unknown> = {}) {
  return $fetch<T>(`${apiBase}${path}`, { credentials: 'include', ...options })
}
function mutation<T>(path: string, method: string, body?: unknown) {
  return api<T>(path, { method, headers: { 'X-XPlay-CSRF': csrf.value }, ...(body === undefined ? {} : { body }) })
}
function describeError(error: unknown) {
  const issue = error as { data?: { message?: string | string[] }; message?: string }
  return Array.isArray(issue?.data?.message) ? issue.data.message.join('、') : issue?.data?.message || issue?.message || '操作に失敗しました。'
}
async function reload() {
  try {
    const [articles, tags] = await Promise.all([
      api<AdminNotice[]>('/admin/notices'), api<NoticeTag[]>('/admin/tags'),
    ])
    notices.value = articles
    allTags.value = tags
  } catch (error) { errorMessage.value = describeError(error) }
}
async function ensureQuill() {
  await nextTick()
  if (!editor.value || quill) return
  const Quill = await $loadQuill()
  if (!editor.value) return
  quill = new Quill(editor.value, {
    theme: 'snow', modules: { toolbar: [['bold', 'italic', 'underline'], [{ header: [1, 2, 3, false] }],
      [{ list: 'ordered' }, { list: 'bullet' }], ['link', 'image'], ['clean']] },
  })
  quill.getModule('toolbar')?.addHandler('image', () => void uploadImage())
  quill.on('text-change', () => {
    dirty.value = true
    const embedded = JSON.stringify(quill?.getContents()?.ops ?? [])
    for (const id of [...pending]) {
      if (!embedded.includes(id)) {
        pending.delete(id)
        void mutation(`/admin/images/${id}`, 'DELETE').catch(() => undefined)
      }
    }
  })
}
async function discard() {
  if (session && csrf.value) {
    try { await mutation(`/admin/images/sessions/${session}`, 'DELETE') } catch { /* expired or logged out */ }
  }
  newSession()
}
async function resetForm(item: AdminNotice | null) {
  selected.value = item
  heading.value = item?.title ?? ''
  selectedTags.value = item?.tags.map(tag => tag.name) ?? []
  await ensureQuill()
  quill?.setContents((item?.body_delta ?? { ops: [{ insert: '\n' }] }) as Parameters<NonNullable<typeof quill>['setContents']>[0])
  dirty.value = false
}
async function startNew() {
  if (dirty.value && !confirm('未保存の変更を破棄しますか？')) return
  await discard()
  await resetForm(null)
  errorMessage.value = ''; infoMessage.value = ''
}
async function selectNotice(id: string) {
  if (dirty.value && !confirm('未保存の変更を破棄しますか？')) return
  try {
    await discard()
    await resetForm(await api<AdminNotice>(`/admin/notices/${id}`))
    errorMessage.value = ''; infoMessage.value = ''
  } catch (error) { errorMessage.value = describeError(error) }
}
function updateTags(value: string[]) { selectedTags.value = value; dirty.value = true }
async function save(): Promise<AdminNotice | null> {
  if (busy.value) return null
  busy.value = true; errorMessage.value = ''; infoMessage.value = ''
  try {
    const body = {
      title: heading.value, body_delta: quill?.getContents() ?? { ops: [] },
      tags: selectedTags.value, upload_session_id: session,
      ...(selected.value ? { expected_version: selected.value.version } : {}),
    }
    const result = selected.value
      ? await mutation<AdminNotice>(`/admin/notices/${selected.value.id}`, 'PATCH', body)
      : await mutation<AdminNotice>('/admin/notices', 'POST', body)
    newSession()
    await reload()
    await resetForm(result)
    infoMessage.value = '保存しました。'
    return result
  } catch (error) {
    errorMessage.value = describeError(error)
    return null
  } finally { busy.value = false }
}
async function publish() {
  if (selected.value?.status === 'published') return
  let item = selected.value
  if (dirty.value || !item) item = await save()
  if (!item) return
  busy.value = true; errorMessage.value = ''
  try {
    const result = await mutation<AdminNotice>(`/admin/notices/${item.id}/publish`, 'POST', { expected_version: item.version })
    await reload(); await resetForm(result); infoMessage.value = '公開しました。'
  } catch (error) { errorMessage.value = describeError(error) }
  finally { busy.value = false }
}
async function unpublish() {
  if (!selected.value || selected.value.status !== 'published') return
  if (dirty.value && !confirm('未保存の編集内容は破棄されます。公開を取り消しますか？')) return
  busy.value = true; errorMessage.value = ''
  try {
    const result = await mutation<AdminNotice>(`/admin/notices/${selected.value.id}/unpublish`, 'POST', { expected_version: selected.value.version })
    await discard(); await reload(); await resetForm(result); infoMessage.value = '非公開にしました。'
  } catch (error) { errorMessage.value = describeError(error) }
  finally { busy.value = false }
}
async function remove() {
  if (!selected.value || selected.value.status === 'published') return
  if (!confirm('この記事と画像を完全に削除します。取り消せません。続行しますか？')) return
  busy.value = true; errorMessage.value = ''
  try {
    await mutation(`/admin/notices/${selected.value.id}`, 'DELETE', { expected_version: selected.value.version })
    await discard(); await reload(); await resetForm(null); infoMessage.value = '記事を削除しました。'
  } catch (error) { errorMessage.value = describeError(error) }
  finally { busy.value = false }
}
async function cancel() {
  if (dirty.value && !confirm('未保存の変更を破棄しますか？')) return
  try { await discard(); await resetForm(selected.value ? await api<AdminNotice>(`/admin/notices/${selected.value.id}`) : null) }
  catch (error) { errorMessage.value = describeError(error) }
}
async function uploadImage() {
  if (!quill || busy.value) return
  const input = document.createElement('input')
  input.type = 'file'; input.accept = 'image/png,image/jpeg,image/webp'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { errorMessage.value = '画像は5MB以内にしてください。'; return }
    try {
      const reader = new FileReader()
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
      })
      const result = await mutation<{ id: string; url: string }>('/admin/images', 'POST', {
        upload_session_id: session, purpose: 'notice', mime_type: file.type, data_base64: base64,
      })
      pending.add(result.id)
      const cursor = quill?.getSelection(true)
      quill?.insertEmbed(cursor?.index ?? 0, 'image', result.url, 'user')
      quill?.setSelection((cursor?.index ?? 0) + 1)
    } catch (error) { errorMessage.value = describeError(error) }
  }
  input.click()
}
async function logout() {
  try { await discard(); await mutation('/auth/logout', 'POST'); authenticated.value = false; csrf.value = '' }
  catch (error) { errorMessage.value = describeError(error) }
}
onMounted(async () => {
  try {
    const sessionInfo = await api<{ authenticated: boolean; csrf_token?: string }>('/auth/session')
    authenticated.value = sessionInfo.authenticated
    csrf.value = sessionInfo.csrf_token ?? ''
    if (authenticated.value && csrf.value) {
      newSession(); await reload()
      heartbeat = setInterval(() => {
        if (session) void mutation(`/admin/images/sessions/${session}/refresh`, 'POST').catch(() => undefined)
      }, 30 * 60 * 1000)
    } else authenticated.value = false
  } catch (error) { errorMessage.value = describeError(error) }
  finally {
    loading.value = false
    if (authenticated.value) await ensureQuill()
  }
})
onBeforeUnmount(() => { if (heartbeat) clearInterval(heartbeat) })
</script>
