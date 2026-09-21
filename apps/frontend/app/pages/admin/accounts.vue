<template>
  <section>
    <h1 class="h2 mb-3">アカウント管理</h1>
    <p v-if="loading" role="status">アカウントを読み込んでいます…</p>
    <div v-else-if="!isAdmin" class="alert alert-warning" role="alert">
      アカウント管理には管理者権限が必要です。<NuxtLink to="/login">ログイン</NuxtLink>
    </div>
    <template v-else>
      <p class="text-body-secondary">アカウントの内部IDとDiscord IDは別々に管理します。権限変更・統合は管理者だけが実行できます。</p>
      <p v-if="error" class="alert alert-danger" role="alert">{{ error }}</p>
      <p v-if="message" class="alert alert-success" role="status">{{ message }}</p>
      <div class="d-flex justify-content-end mb-3">
        <button type="button" class="btn btn-outline-primary" :disabled="busy" @click="loadAccounts">一覧更新</button>
      </div>
      <div class="table-responsive">
        <table class="table table-striped align-middle">
          <thead><tr><th scope="col">アカウントID</th><th scope="col">Discord ID</th><th scope="col">権限</th><th scope="col">操作</th></tr></thead>
          <tbody>
            <tr v-for="entry in accounts" :key="entry.id">
              <td class="text-break small">{{ entry.id }}</td>
              <td><span v-for="id in entry.discord_ids" :key="id" class="d-block small">{{ id }}</span></td>
              <td>{{ entry.is_admin ? '管理者' : '一般' }}</td>
              <td>
                <button type="button" class="btn btn-sm" :class="entry.is_admin ? 'btn-outline-danger' : 'btn-outline-primary'"
                  :disabled="busy || (entry.is_admin && adminCount <= 1)"
                  @click="changeRole(entry)">{{ entry.is_admin ? '管理権限を解除' : '管理権限を付与' }}</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="!accounts.length">登録済みのアカウントはありません。</p>

      <h2 class="h4 mt-4">アカウントを統合</h2>
      <p class="text-body-secondary">同一人物の別Discord IDが別々のアカウントに登録された場合のみ使用します。統合元の画像と管理権限は統合先に引き継がれ、統合元のログインセッションは失効します。操作は取り消せません。</p>
      <form class="d-grid gap-3" @submit.prevent="mergeAccounts">
        <div>
          <label for="merge-target" class="form-label">統合先（残すアカウント）</label>
          <select id="merge-target" v-model="targetId" class="form-select" required>
            <option value="">選択してください</option>
            <option v-for="entry in accounts" :key="entry.id" :value="entry.id">{{ entry.discord_ids.join(', ') }} / {{ entry.id }}</option>
          </select>
        </div>
        <div>
          <label for="merge-source" class="form-label">統合元（削除するアカウント）</label>
          <select id="merge-source" v-model="sourceId" class="form-select" required>
            <option value="">選択してください</option>
            <option v-for="entry in accounts" :key="entry.id" :value="entry.id">{{ entry.discord_ids.join(', ') }} / {{ entry.id }}</option>
          </select>
        </div>
        <button type="submit" class="btn btn-warning" :disabled="busy || !targetId || !sourceId || targetId === sourceId">統合する</button>
      </form>
    </template>
  </section>
</template>

<script setup lang="ts">
type Account = { id: string; created_at: string; is_admin: boolean; discord_ids: string[] }
const { public: { apiBase } } = useRuntimeConfig()
const auth = useAccountSession()
const isAdmin = auth.isAdmin
const loading = ref(true), busy = ref(false), error = ref(''), message = ref('')
const accounts = ref<Account[]>([])
const targetId = ref(''), sourceId = ref('')
const adminCount = computed(() => accounts.value.filter(entry => entry.is_admin).length)
function errorText(err: unknown) {
  const issue = err as { data?: { message?: string }; message?: string }
  return issue?.data?.message ?? issue?.message ?? '操作に失敗しました。'
}
async function loadAccounts() {
  busy.value = true; error.value = ''
  try { accounts.value = await $fetch<Account[]>(`${apiBase}/admin/accounts`, { credentials: 'include' }) }
  catch (err) { error.value = errorText(err) }
  finally { busy.value = false }
}
async function mutation(path: string, method: 'PATCH' | 'POST', body: object) {
  return $fetch<Account[]>(`${apiBase}${path}`, {
    method, credentials: 'include', headers: { 'X-XPlay-CSRF': auth.session.value.csrf_token ?? '' }, body,
  })
}
async function changeRole(entry: Account) {
  const action = entry.is_admin ? '解除' : '付与'
  if (!confirm(`アカウント ${entry.id} の管理権限を${action}しますか？`)) return
  busy.value = true; error.value = ''; message.value = ''
  try {
    accounts.value = await mutation(`/admin/accounts/${entry.id}/role`, 'PATCH', { is_admin: !entry.is_admin })
    await auth.refresh()
    message.value = '管理権限を更新しました。'
    if (!isAdmin.value) await navigateTo('/account')
  } catch (err) { error.value = errorText(err) }
  finally { busy.value = false }
}
async function mergeAccounts() {
  if (!targetId.value || !sourceId.value || targetId.value === sourceId.value) return
  const target = accounts.value.find(entry => entry.id === targetId.value)
  const source = accounts.value.find(entry => entry.id === sourceId.value)
  if (!target || !source) return
  if (!confirm(`統合先: ${target.discord_ids.join(', ')}\n統合元: ${source.discord_ids.join(', ')}\n\n同一人物であることを確認しましたか？統合元アカウントは削除され、ログアウトされます。`)) return
  busy.value = true; error.value = ''; message.value = ''
  try {
    accounts.value = await mutation('/admin/accounts/merge', 'POST', {
      target_account_id: targetId.value, source_account_id: sourceId.value,
    })
    targetId.value = ''; sourceId.value = ''
    await auth.refresh()
    message.value = 'アカウントを統合しました。'
    if (!isAdmin.value) await navigateTo('/account')
  } catch (err) { error.value = errorText(err) }
  finally { busy.value = false }
}
onMounted(async () => {
  await auth.refresh()
  if (isAdmin.value) await loadAccounts()
  loading.value = false
})
</script>
