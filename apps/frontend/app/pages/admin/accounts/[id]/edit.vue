<template>
  <section>
    <UiPageTitle title="アカウント編集" />
    <p v-if="loading" role="status">アカウントを読み込んでいます…</p>
    <div v-else-if="!auth.isAdmin.value" class="alert alert-warning">管理者権限が必要です。</div>
    <p v-else-if="!account" class="alert alert-danger" role="alert">{{ error || 'アカウントを取得できませんでした。' }}</p>
    <template v-else>
      <p v-if="error" class="alert alert-danger" role="alert">{{ error }}</p>
      <p v-if="message" class="alert alert-success" role="status">{{ message }}</p>
      <p class="small text-body-secondary text-break">アカウントID：{{ account.id }}</p>
      <div class="mb-4">
        <input id="edit-account-name" class="form-control" :value="account.name" readonly placeholder="アカウント名（他のアカウントと重複可）" aria-label="アカウント名" />
        <p class="small text-body-secondary mt-1 mb-0">連携済みのDiscord名からのみ変更できます。</p>
      </div>
      <fieldset class="border rounded p-3 mb-4" :disabled="busy || account.is_protected || account.merged_sources.length > 0">
        <legend class="float-none w-auto px-2 fs-5">管理者権限</legend>
        <div class="form-check form-switch">
          <input id="edit-account-role" class="form-check-input" type="checkbox" :checked="account.is_admin"
            :disabled="busy || account.is_protected || account.merged_sources.length > 0" @change="askRole" />
          <label class="form-check-label" for="edit-account-role">管理者</label>
        </div>
        <p v-if="account.is_protected" class="small text-body-secondary mb-0">初期管理者の管理者権限は解除できません。</p>
        <p v-else-if="account.merged_sources.length" class="small text-body-secondary mb-0">統合履歴の復元に必要なため、分離するまで権限を変更できません。</p>
      </fieldset>
      <h2 class="h4">Discord ID / 名</h2>
      <ul class="list-group mb-3">
        <li v-for="identity in account.discord_profiles" :key="identity.discord_id" class="list-group-item d-flex align-items-center justify-content-between gap-2 flex-wrap">
          <span class="text-break"><strong>{{ identity.display_name || identity.username || '未取得' }}</strong>
            <small class="d-block text-body-secondary">ユーザー名：{{ identity.username || '未取得' }} / ID：{{ identity.discord_id }}</small>
          </span>
          <span class="d-flex gap-2 flex-wrap">
            <button type="button" class="btn btn-sm btn-primary" :disabled="busy || !hasDiscordName(identity)"
              @click="adoptName(identity.discord_id)">アカウント名へ反映</button>
            <button type="button" class="btn btn-sm btn-outline-danger" :disabled="busy || account.discord_profiles.length <= 1 || account.merged_sources.length > 0 || protectedDiscord(identity.discord_id)"
              @click="ask('discord', identity.discord_id, `Discord ID ${identity.discord_id} の紐付けを解除しますか？`)">解除</button>
          </span>
        </li>
      </ul>
      <h2 class="h4">Minecraft ID（未認証）</h2>
      <ul v-if="account.minecraft_ids.length" class="list-group mb-3">
        <li v-for="identity in account.minecraft_ids" :key="identity.id" class="list-group-item d-flex justify-content-between align-items-center gap-2">
          <span>{{ identity.edition.toUpperCase() }}：{{ identity.username }}</span>
          <button type="button" class="btn btn-sm btn-outline-danger" :disabled="busy || account.merged_sources.length > 0"
            @click="ask('minecraft', identity.id, `${identity.username} の登録を解除しますか？`)">解除</button>
        </li>
      </ul>
      <form class="row g-2 align-items-end mb-4" @submit.prevent="addMinecraft">
        <div class="col-auto">
          <select id="new-minecraft-edition" v-model="edition" class="form-select" aria-label="版" :disabled="busy"><option value="je">JE</option><option value="be">BE</option></select>
        </div>
        <div class="col">
          <input id="new-minecraft-name" v-model="minecraftName" class="form-control" maxlength="32" required :disabled="busy" placeholder="Minecraft名" aria-label="Minecraft名" />
        </div>
        <div class="col-auto"><button type="submit" class="btn btn-primary" :disabled="busy || !minecraftName.trim()">追加</button></div>
      </form>
      <AccountMapColorEditor :account-id="account.id" />
      <section class="border rounded p-3 mb-4" aria-labelledby="merge-title">
        <h2 id="merge-title" class="h4">アカウント統合・分離</h2>
        <p class="small text-body-secondary">このアカウントを統合先とし、既存の別アカウントを統合元に選びます。元のアカウントと所有者情報はDBに残るため、後から分離できます。</p>
        <template v-if="account.merged_sources.length">
          <p class="small text-body-secondary">このアカウントは現在、次のアカウントの統合先です。新たな統合を行う場合は先に分離してください。</p>
          <div v-for="source in account.merged_sources" :key="source.id" class="d-flex align-items-center justify-content-between gap-2 flex-wrap mb-2">
            <span class="text-break">{{ source.name }} / {{ source.id }}</span>
            <button type="button" class="btn btn-warning" :disabled="busy" @click="askRestore(source.id, source.name)">分離する</button>
          </div>
        </template>
        <form v-else class="d-flex flex-wrap align-items-end gap-2" @submit.prevent="askMerge">
          <div class="flex-grow-1">
            <label class="form-label" for="merge-source">統合元アカウント</label>
            <select id="merge-source" v-model="mergeSourceId" class="form-select" required :disabled="busy">
              <option value="">既存のアカウントを選択</option>
              <option v-for="candidate in mergeCandidates" :key="candidate.id" :value="candidate.id">{{ candidate.name }} / {{ candidate.discord_ids.join('、') }} / {{ candidate.id }}</option>
            </select>
          </div>
          <button type="submit" class="btn btn-warning" :disabled="busy || !mergeSource">統合する</button>
        </form>
      </section>
      <div class="d-flex gap-2 flex-wrap mt-4">
        <NuxtLink to="/admin/accounts" class="btn btn-outline-secondary">一覧へ戻る</NuxtLink>
        <button type="button" class="btn btn-danger" :disabled="busy || account.is_protected || account.merged_sources.length > 0"
          @click="ask('delete', account.id, `アカウント「${account.name}」を完全に削除します。取り消せません。続行しますか？`)">削除</button>
      </div>
      <p v-if="account.is_protected" class="small text-body-secondary mt-2">初期管理者のアカウント削除と統合元への指定はできません。</p>
    </template>
    <UiConfirmDialog :open="!!decision" :title="decision?.title ?? ''" :message="decision?.message ?? ''"
      :confirm-label="decision?.kind === 'delete' ? '削除する' : decision?.kind === 'merge' ? '統合する' : decision?.kind === 'restore' ? '分離する' : '実行する'"
      :danger="decision?.kind !== 'role'" :busy="busy" @confirm="execute" @cancel="cancelDecision" />
  </section>
</template>

<script setup lang="ts">
import type { AccountRecord, DiscordIdentity } from '../../../../composables/useAccountApi'
import { accountError } from '../../../../composables/useAccountApi'

type Decision = { kind: 'role' | 'delete' | 'discord' | 'minecraft' | 'merge' | 'restore'; value: string; title: string; message: string }
const route = useRoute()
const auth = useAccountSession()
const { get, mutate } = useAccountApi()
const id = computed(() => String(route.params.id))
const account = ref<AccountRecord | null>(null), accounts = ref<AccountRecord[]>([])
const minecraftName = ref(''), mergeSourceId = ref('')
const edition = ref<'je' | 'be'>('je')
const loading = ref(true), busy = ref(false), error = ref(''), message = ref('')
const decision = ref<Decision | null>(null)
const mergeCandidates = computed(() => accounts.value.filter(candidate => candidate.id !== id.value && !candidate.is_protected && !candidate.merged_sources.length))
const mergeSource = computed(() => mergeCandidates.value.find(candidate => candidate.id === mergeSourceId.value))
const hasDiscordName = (identity: DiscordIdentity) => [identity.display_name, identity.username].some(value => !!value && value !== identity.discord_id)
function protectedDiscord(discord: string) { return account.value?.is_protected && account.value.discord_profiles.length <= 1 && !!discord }
async function load() {
  const [current, listing] = await Promise.all([get<AccountRecord>(`/admin/accounts/${id.value}`), get<AccountRecord[]>('/admin/accounts')])
  account.value = current; accounts.value = listing
}
async function run(action: () => Promise<AccountRecord>, success: string) {
  if (busy.value) return
  busy.value = true; error.value = ''; message.value = ''
  try { account.value = await action(); message.value = success; await auth.refresh() }
  catch (issue) { error.value = accountError(issue) }
  finally { busy.value = false }
}
function adoptName(discordId: string) { void run(() => mutate<AccountRecord>(`/admin/accounts/${id.value}/adopt-discord-name`, 'POST', { discord_id: discordId }), 'アカウント名を更新しました。') }
async function addMinecraft() {
  await run(() => mutate<AccountRecord>(`/admin/accounts/${id.value}/minecraft`, 'POST', { edition: edition.value, username: minecraftName.value }), 'Minecraft名を追加しました。')
  if (!error.value) minecraftName.value = ''
}
function ask(kind: Decision['kind'], value: string, text: string) { decision.value = { kind, value, title: '操作の確認', message: text } }
function askMerge() {
  if (!account.value || account.value.merged_sources.length || !mergeSource.value || busy.value) return
  decision.value = { kind: 'merge', value: mergeSource.value.id, title: 'アカウント統合の最終確認',
    message: `統合元：${mergeSource.value.name} / ${mergeSource.value.id}\n統合先：${account.value.name} / ${account.value.id}\n\n同一人物であることを確認してください。統合元は一覧から非表示になり、Discord・Minecraft名、権限、画像の所有情報が統合先へ移動します。統合元のセッションは失効します。元の所有関係はDBに保存され、後から分離できます。` }
}
function askRestore(sourceId: string, sourceName: string) {
  if (!account.value || busy.value) return
  decision.value = { kind: 'restore', value: sourceId, title: 'アカウント分離の確認',
    message: `統合先：${account.value.name} / ${account.value.id}\n分離する統合元：${sourceName} / ${sourceId}\n\n元のDiscord・Minecraft名・画像所有者・管理者権限を復元します。両アカウントのセッションを失効させるため再ログインが必要です。実行しますか？` }
}
function askRole(event: Event) {
  const checkbox = event.target as HTMLInputElement
  if (!account.value || account.value.is_protected || account.value.merged_sources.length) { checkbox.checked = !!account.value?.is_admin; return }
  checkbox.checked = account.value.is_admin
  ask('role', String(!account.value.is_admin), `「${account.value.name}」の管理者権限を${account.value.is_admin ? '解除' : '付与'}しますか？`)
}
function cancelDecision() { if (!busy.value) decision.value = null }
async function execute() {
  const selected = decision.value
  if (!selected || busy.value) return
  busy.value = true; error.value = ''; message.value = ''
  try {
    if (selected.kind === 'merge') {
      await mutate<AccountRecord[]>('/admin/accounts/merge', 'POST', { target_account_id: id.value, source_account_id: selected.value })
      decision.value = null; await auth.refresh()
      if (!auth.isAdmin.value) { await navigateTo('/login'); return }
      await load(); message.value = 'アカウントを統合しました。'
      return
    }
    if (selected.kind === 'restore') {
      await mutate<AccountRecord[]>(`/admin/accounts/merges/${selected.value}/restore`, 'POST')
      decision.value = null; await auth.refresh()
      if (!auth.isAdmin.value) { await navigateTo('/login'); return }
      await load(); message.value = 'アカウントを分離しました。'
      return
    }
    if (selected.kind === 'delete') {
      await mutate<AccountRecord[]>(`/admin/accounts/${id.value}`, 'DELETE')
      await auth.refresh(); decision.value = null
      await navigateTo(auth.isAdmin.value ? '/admin/accounts' : '/account')
      return
    }
    let result: AccountRecord | AccountRecord[]
    if (selected.kind === 'role') {
      result = await mutate<AccountRecord[]>(`/admin/accounts/${id.value}/role`, 'PATCH', { is_admin: selected.value === 'true' })
      await auth.refresh()
      if (!auth.isAdmin.value) { decision.value = null; await navigateTo('/account'); return }
      result = await get<AccountRecord>(`/admin/accounts/${id.value}`)
    } else if (selected.kind === 'discord') {
      result = await mutate<AccountRecord>(`/admin/accounts/${id.value}/discord/${selected.value}`, 'DELETE')
    } else {
      result = await mutate<AccountRecord>(`/admin/accounts/${id.value}/minecraft/${selected.value}`, 'DELETE')
    }
    account.value = result as AccountRecord
    decision.value = null; message.value = '変更しました。'
  } catch (issue) { error.value = accountError(issue) }
  finally { busy.value = false }
}
onMounted(async () => {
  try { await auth.refresh(); if (auth.isAdmin.value) await load() }
  catch (issue) { error.value = accountError(issue) }
  finally { loading.value = false }
})
</script>
