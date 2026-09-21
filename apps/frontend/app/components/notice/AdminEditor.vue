<template>
  <section>
    <h1 class="h2 mb-3">{{ noticeId ? 'お知らせ編集' : 'お知らせ投稿' }}</h1>
    <p v-if="loading" role="status">編集画面を読み込んでいます…</p>
    <div v-else-if="!isAdmin" class="alert alert-warning" role="alert">
      お知らせの管理には管理者権限が必要です。<NuxtLink to="/login">ログイン</NuxtLink>
    </div>
    <template v-else>
      <div v-if="errorMessage" class="alert alert-danger" role="alert">{{ errorMessage }}</div>
      <div v-if="infoMessage" class="alert alert-success" role="status">{{ infoMessage }}</div>
      <form @submit.prevent="save()">
        <label class="form-label" for="notice-admin-title">タイトル</label>
        <input id="notice-admin-title" v-model="heading" class="form-control mb-3" required
          :readonly="selected?.status === 'published'" @input="dirty = true" />
        <NoticeTagPicker :model-value="selectedTags" :tags="allTags" @update:model-value="updateTags" />
        <label class="form-label mt-3">本文</label>
        <ClientOnly><div ref="editor" class="mb-3" aria-label="お知らせ本文" /></ClientOnly>
        <p class="form-text">本文中の任意位置に画像を挿入できます。画像の変更は保存時に確定します。</p>
        <div class="d-flex flex-wrap gap-2">
          <button type="submit" class="btn btn-primary" :disabled="busy">{{ busy ? '処理中…' : '保存' }}</button>
          <button type="button" class="btn btn-success" :disabled="busy || selected?.status === 'published'" @click="publish">公開する</button>
          <button v-if="selected?.status === 'published'" type="button" class="btn btn-warning" :disabled="busy" @click="unpublish">公開取り消し</button>
          <button v-else-if="selected" type="button" class="btn btn-danger" :disabled="busy" @click="remove">物理削除</button>
          <button type="button" class="btn btn-outline-secondary" :disabled="busy" @click="cancel">変更を破棄</button>
          <NuxtLink to="/admin/notices" class="btn btn-outline-secondary">お知らせ一覧</NuxtLink>
        </div>
      </form>
    </template>
  </section>
</template>

<script setup lang="ts">
import type { NoticeDelta, NoticeTag } from '../../types/notice'

type AdminNotice = {
  id: string; title: string; status: 'draft' | 'published' | 'unpublished'; version: number;
  body_delta: NoticeDelta; tags: NoticeTag[]; created_at: string; updated_at: string; published_at: string | null
}
const props = defineProps<{ noticeId?: string }>()
const { public: { apiBase } } = useRuntimeConfig()
const { $loadQuill } = useNuxtApp()
const account = useAccountSession()
const isAdmin = account.isAdmin
const loading = ref(true), busy = ref(false), dirty = ref(false)
const errorMessage = ref(''), infoMessage = ref('')
const allTags = ref<NoticeTag[]>([]), selected = ref<AdminNotice | null>(null)
const heading = ref(''), selectedTags = ref<string[]>([]), editor = ref<HTMLDivElement | null>(null)
let quill: InstanceType<Awaited<ReturnType<typeof $loadQuill>>> | null = null
let uploadSession = ''
const pending = new Set<string>()
let heartbeat: ReturnType<typeof setInterval> | undefined
const newSession = () => { uploadSession = crypto.randomUUID(); pending.clear() }

function api<T>(path: string, options: Record<string, unknown> = {}) {
  return $fetch<T>(`${apiBase}${path}`, { credentials: 'include', ...options })
}
function mutation<T>(path: string, method: string, body?: unknown) {
  return api<T>(path, { method, headers: { 'X-XPlay-CSRF': account.session.value.csrf_token ?? '' }, ...(body === undefined ? {} : { body }) })
}
function describeError(error: unknown) {
  const issue = error as { data?: { message?: string | string[] }; message?: string }
  return Array.isArray(issue?.data?.message) ? issue.data.message.join('、') : issue?.data?.message || issue?.message || '操作に失敗しました。'
}
async function loadTags() {
  try { allTags.value = await api<NoticeTag[]>('/admin/tags') }
  catch (error) { errorMessage.value = describeError(error) }
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
  if (uploadSession && account.session.value.csrf_token) {
    try { await mutation(`/admin/images/sessions/${uploadSession}`, 'DELETE') } catch { /* expired or logged out */ }
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
function updateTags(value: string[]) { selectedTags.value = value; dirty.value = true }
async function save(redirectOnCreate = true): Promise<AdminNotice | null> {
  if (busy.value) return null
  busy.value = true; errorMessage.value = ''; infoMessage.value = ''
  try {
    const body = {
      title: heading.value, body_delta: quill?.getContents() ?? { ops: [] },
      tags: selectedTags.value, upload_session_id: uploadSession,
      ...(selected.value ? { expected_version: selected.value.version } : {}),
    }
    const wasNew = !selected.value
    const result = selected.value
      ? await mutation<AdminNotice>(`/admin/notices/${selected.value.id}`, 'PATCH', body)
      : await mutation<AdminNotice>('/admin/notices', 'POST', body)
    newSession()
    await loadTags()
    await resetForm(result)
    infoMessage.value = '保存しました。'
    if (wasNew && redirectOnCreate) await navigateTo(`/admin/notices/${result.id}/edit`)
    return result
  } catch (error) { errorMessage.value = describeError(error); return null }
  finally { busy.value = false }
}
async function publish() {
  if (selected.value?.status === 'published') return
  let item = selected.value
  if (dirty.value || !item) item = await save(false)
  if (!item) return
  busy.value = true; errorMessage.value = ''
  try {
    const result = await mutation<AdminNotice>(`/admin/notices/${item.id}/publish`, 'POST', { expected_version: item.version })
    await resetForm(result)
    infoMessage.value = '公開しました。'
    if (!props.noticeId) await navigateTo(`/admin/notices/${result.id}/edit`)
  } catch (error) { errorMessage.value = describeError(error) }
  finally { busy.value = false }
}
async function unpublish() {
  if (!selected.value || selected.value.status !== 'published') return
  if (dirty.value && !confirm('未保存の編集内容は破棄されます。公開を取り消しますか？')) return
  busy.value = true; errorMessage.value = ''
  try {
    const result = await mutation<AdminNotice>(`/admin/notices/${selected.value.id}/unpublish`, 'POST', { expected_version: selected.value.version })
    await discard(); await resetForm(result); infoMessage.value = '非公開にしました。'
  } catch (error) { errorMessage.value = describeError(error) }
  finally { busy.value = false }
}
async function remove() {
  if (!selected.value || selected.value.status === 'published') return
  if (!confirm('この記事と画像を完全に削除します。取り消せません。続行しますか？')) return
  busy.value = true; errorMessage.value = ''
  try {
    await mutation(`/admin/notices/${selected.value.id}`, 'DELETE', { expected_version: selected.value.version })
    await discard()
    await navigateTo('/admin/notices')
  } catch (error) { errorMessage.value = describeError(error) }
  finally { busy.value = false }
}
async function cancel() {
  if (dirty.value && !confirm('未保存の変更を破棄しますか？')) return
  try {
    await discard()
    await resetForm(props.noticeId ? await api<AdminNotice>(`/admin/notices/${props.noticeId}`) : null)
  } catch (error) { errorMessage.value = describeError(error) }
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
        upload_session_id: uploadSession, purpose: 'notice', mime_type: file.type, data_base64: base64,
      })
      pending.add(result.id)
      const cursor = quill?.getSelection(true)
      quill?.insertEmbed(cursor?.index ?? 0, 'image', result.url, 'user')
      quill?.setSelection((cursor?.index ?? 0) + 1)
    } catch (error) { errorMessage.value = describeError(error) }
  }
  input.click()
}
onMounted(async () => {
  try {
    await account.refresh()
    if (isAdmin.value) {
      newSession()
      await loadTags()
      if (props.noticeId) selected.value = await api<AdminNotice>(`/admin/notices/${props.noticeId}`)
    }
  } catch (error) { errorMessage.value = describeError(error) }
  finally {
    loading.value = false
    if (isAdmin.value) {
      await resetForm(selected.value)
      heartbeat = setInterval(() => {
        if (uploadSession) void mutation(`/admin/images/sessions/${uploadSession}/refresh`, 'POST').catch(() => undefined)
      }, 30 * 60 * 1000)
    }
  }
})
onBeforeUnmount(() => {
  if (heartbeat) clearInterval(heartbeat)
  if (uploadSession) void discard()
})
</script>
