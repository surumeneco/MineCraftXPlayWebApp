<template>
  <section>
    <h1 class="h2 mb-3">アカウント統合</h1>
    <p v-if="loading" role="status">アカウントを読み込んでいます…</p>
    <div v-else-if="!auth.isAdmin.value" class="alert alert-warning">管理者権限が必要です。</div>
    <template v-else>
      <p class="text-body-secondary">同一人物のアカウントだけを統合してください。統合先のアカウント名・IDを維持し、統合元のDiscord・Minecraft ID、権限、画像を移管します。統合元は削除され、セッションは失効します。</p>
      <p v-if="error" class="alert alert-danger" role="alert">{{ error }}</p>
      <form @submit.prevent="askMerge" class="d-grid gap-3">
        <div><label for="merge-target" class="form-label">統合先（残すアカウント）</label>
          <select id="merge-target" v-model="targetId" class="form-select" required :disabled="busy">
            <option value="">選択してください</option>
            <option v-for="entry in accounts" :key="entry.id" :value="entry.id">{{ entry.name }} / {{ entry.discord_profiles.map(p => p.display_name).join(', ') }} / {{ entry.id }}</option>
          </select>
        </div>
        <div><label for="merge-source" class="form-label">統合元（削除するアカウント）</label>
          <select id="merge-source" v-model="sourceId" class="form-select" required :disabled="busy">
            <option value="">選択してください</option>
            <option v-for="entry in accounts" :key="entry.id" :value="entry.id" :disabled="entry.is_protected">{{ entry.name }} / {{ entry.discord_profiles.map(p => p.display_name).join(', ') }} / {{ entry.id }}{{ entry.is_protected ? '（初期管理者・統合元不可）' : '' }}</option>
          </select>
        </div>
        <div class="d-flex gap-2 flex-wrap">
          <button type="submit" class="btn btn-warning" :disabled="busy || !valid">統合を確認</button>
          <NuxtLink to="/admin/accounts" class="btn btn-outline-secondary">一覧へ戻る</NuxtLink>
        </div>
      </form>
    </template>
    <UiConfirmDialog :open="confirming" title="アカウント統合の最終確認" :message="confirmation"
      confirm-label="統合する" :danger="true" :busy="busy" @confirm="executeMerge" @cancel="cancel" />
  </section>
</template>

<script setup lang="ts">
import type { AccountRecord } from '../../../composables/useAccountApi'
import { accountError } from '../../../composables/useAccountApi'
const route = useRoute()
const auth = useAccountSession()
const { get, mutate } = useAccountApi()
const accounts = ref<AccountRecord[]>([])
const targetId = ref(''), sourceId = ref('')
const loading = ref(true), busy = ref(false), error = ref(''), confirming = ref(false)
const target = computed(() => accounts.value.find(entry => entry.id === targetId.value))
const source = computed(() => accounts.value.find(entry => entry.id === sourceId.value))
const valid = computed(() => !!target.value && !!source.value && targetId.value !== sourceId.value && !source.value.is_protected)
const confirmation = computed(() => `統合先（残す）：${target.value?.name ?? ''} / ${targetId.value}\n統合元（削除）：${source.value?.name ?? ''} / ${sourceId.value}\n\n同一人物であることを確認しましたか？統合元は完全に削除され、ログアウトされます。元に戻せません。`)
function askMerge() { if (valid.value) confirming.value = true }
function cancel() { if (!busy.value) confirming.value = false }
async function executeMerge() {
  if (!valid.value || busy.value) return
  busy.value = true; error.value = ''
  try {
    await mutate<AccountRecord[]>('/admin/accounts/merge', 'POST', { target_account_id: targetId.value, source_account_id: sourceId.value })
    confirming.value = false
    await auth.refresh()
    await navigateTo(auth.isAdmin.value ? `/admin/accounts/${targetId.value}/edit` : '/account')
  } catch (issue) { error.value = accountError(issue) }
  finally { busy.value = false }
}
onMounted(async () => {
  try {
    await auth.refresh()
    if (auth.isAdmin.value) {
      accounts.value = await get<AccountRecord[]>('/admin/accounts')
      const initial = String(route.query.source ?? '')
      if (accounts.value.some(entry => entry.id === initial && !entry.is_protected)) sourceId.value = initial
    }
  } catch (issue) { error.value = accountError(issue) }
  finally { loading.value = false }
})
</script>
