<template>
  <section v-if="members.length" class="border rounded p-3 my-4" aria-labelledby="operator-photo-heading">
    <h2 id="operator-photo-heading" class="h4">運営メンバー紹介画像</h2>
    <p class="small text-body-secondary">運営メンバー紹介ページで使用する画像です。画像の変更は自分のアカウントからのみ行えます。</p>
    <div v-for="member in members" :key="member.member_key" class="mb-3">
      <h3 class="h5">{{ member.minecraft_name }}</h3>
      <img v-if="(member.image_id || member.static_path) && !failed[member.member_key]"
        :src="preview(member)" :alt="`${member.minecraft_name}の現在の紹介画像`"
        class="operator-image-preview mb-2" @error="failed[member.member_key] = true" />
      <p v-else class="small text-body-secondary">画像が設定されていません。</p>
      <label class="form-label" :for="`operator-file-${member.member_key}`">画像ファイル（JPEG・PNG・WebP・SVG）</label>
      <input :id="`operator-file-${member.member_key}`" type="file"
        accept=".jpg,.jpeg,.png,.webp,.svg,image/jpeg,image/png,image/webp,image/svg+xml"
        class="form-control" :disabled="busy" @change="selectFile(member.member_key,$event)" />
      <p v-if="fileNames[member.member_key]" class="small mt-1">{{ fileNames[member.member_key] }}</p>
      <p v-if="messages[member.member_key]" class="alert alert-success mt-2" role="status">{{ messages[member.member_key] }}</p>
      <div class="d-flex gap-2 justify-content-end mt-2">
        <button type="button" class="btn btn-outline-secondary" :disabled="busy || (!member.image_id && !member.static_path)"
          @click="remove(member.member_key)">画像を削除</button>
        <button type="button" class="btn btn-primary" :disabled="busy || !files.has(member.member_key)"
          @click="save(member.member_key)">画像を保存</button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
type MemberPhoto = { member_key: string; minecraft_name: string; image_id: string | null; static_path: string | null }
const { public: { apiBase } } = useRuntimeConfig()
const session = useAccountSession()
const { showError, showSuccess } = useUiFeedback()
const members = ref<MemberPhoto[]>([])
const busy = ref(false)
const files = reactive(new Map<string,File>())
const fileNames = reactive<Record<string,string>>({})
const messages = reactive<Record<string,string>>({})
const failed = reactive<Record<string,boolean>>({})
function preview(member: MemberPhoto): string {
  return member.static_path || `${apiBase}/operator-photos/${encodeURIComponent(member.member_key)}?v=${encodeURIComponent(member.image_id || '')}`
}
async function load() {
  members.value = await $fetch<MemberPhoto[]>(`${apiBase}/accounts/me/operator-photos`, { credentials: 'include' })
}
function selectFile(key: string, event: Event) {
  const element = event.target as HTMLInputElement
  const file = element.files?.[0]
  if (file) { files.set(key,file); fileNames[key] = file.name; messages[key] = '' }
  element.value = ''
}
async function save(key: string) {
  const file = files.get(key)
  if (!file || busy.value) return
  busy.value = true; messages[key] = ''
  try {
    await $fetch(`${apiBase}/accounts/me/operator-photos/${encodeURIComponent(key)}/file`, {
      method: 'POST', credentials: 'include', body: file,
      headers: { 'Content-Type':'application/octet-stream', 'X-XPlay-CSRF':session.session.value.csrf_token ?? '',
        'X-XPlay-Image-Mime': encodeURIComponent(file.type) },
    })
    files.delete(key); delete fileNames[key]; failed[key] = false
    await load()
    messages[key] = '画像が保存されました。'
    showSuccess(messages[key])
  } catch (error) { showError(error) }
  finally { busy.value = false }
}
async function remove(key: string) {
  if (busy.value) return
  busy.value = true; messages[key] = ''
  try {
    await $fetch(`${apiBase}/accounts/me/operator-photos/${encodeURIComponent(key)}`, {
      method:'DELETE', credentials:'include',
      headers: { 'X-XPlay-CSRF':session.session.value.csrf_token ?? '' },
    })
    files.delete(key); delete fileNames[key]; failed[key] = false
    await load()
    messages[key] = '画像の設定を解除しました。'
    showSuccess(messages[key])
  } catch (error) { showError(error) }
  finally { busy.value = false }
}
onMounted(async () => {
  try { await load() }
  catch (error) { showError(error) }
})
</script>

<style scoped>
.operator-image-preview { display: block; max-width: 100%; max-height: 20rem; width: auto; height: auto; object-fit: contain; border-radius: var(--xplay-panel-radius); }
</style>
