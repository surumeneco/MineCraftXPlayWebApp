<template>
  <section>
    <h1 class="h2 mb-3">アカウント編集</h1>
    <p v-if="loading" role="status">アカウントを読み込んでいます…</p>
    <div v-else-if="!auth.isAdmin.value" class="alert alert-warning">管理者権限が必要です。</div>
    <template v-else-if="account">
      <p v-if="error" class="alert alert-danger" role="alert">{{ error }}</p>
      <p v-if="message" class="alert alert-success" role="status">{{ message }}</p>
      <p class="small text-body-secondary text-break">アカウントID：{{ account.id }}</p>
      <form class="mb-4" @submit.prevent="saveName">
        <label for="edit-account-name" class="form-label">アカウント名</label>
        <div class="d-flex gap-2 flex-wrap">
          <input id="edit-account-name" v-model="name" class="form-control flex-grow-1" maxlength="100" required :disabled="busy" />
          <button type="submit" class="btn btn-primary" :disabled="busy || !name.trim()">保存</button>
        </div>
      </form>
      <fieldset class="border rounded p-3 mb-4" :disabled="busy || account.is_protected">
        <legend class="float-none w-auto px-2 fs-5">管理者権限</legend>
        <div class="form-check form-switch">
          <input id="edit-account-role" class="form-check-input" type="checkbox" :checked="account.is_admin"
            :disabled="busy || account.is_protected" @change="askRole" />
          <label class="form-check-label" for="edit-account-role">管理者</label>
        </div>
        <p v-if="account.is_protected" class="small text-body-secondary mb-0">初期管理者の管理者権限は解除できません。ほかの情報は編集できます。</p>
      </fieldset>
      <h2 class="h4">Discord ID / 名</h2>
      <ul class="list-group mb-3">
        <li v-for="identity in account.discord_profiles" :key="identity.discord_id" class="list-group-item d-flex align-items-center justify-content-between gap-2">
          <span class="text-break"><strong>{{ identity.display_name || identity.username || '未取得' }}</strong>
            <small class="d-block text-body-secondary">ユーザー名：{{ identity.username || '未取得' }} / ID：{{ identity.discord_id }}</small>
          </span>
          <button type="button" class="btn btn-sm btn-outline-danger" :disabled="busy || account.discord_profiles.length <= 1 || protectedDiscord(identity.discord_id)"
            @click="ask('discord', identity.discord_id, `Discord ID ${identity.discord_id} の紐付けを解除しますか？`)">解除</button>
        </li>
      </ul>
      <form class="d-flex gap-2 flex-wrap mb-4" @submit.prevent="addDiscord">
        <label class="visually-hidden" for="new-discord">Discord IDを追加</label>
        <input id="new-discord" v-model="discordId" class="form-control flex-grow-1" inputmode="numeric" pattern="[0-9]{15,22}" required placeholder="Discord ID" :disabled="busy" />
        <button type="submit" class="btn btn-outline-primary" :disabled="busy || !discordId">Discord IDを追加</button>
      </form>
      <h2 class="h4">Minecraft ID（未認証）</h2>
      <ul v-if="account.minecraft_ids.length" class="list-group mb-3">
        <li v-for="identity in account.minecraft_ids" :key="identity.id" class="list-group-item d-flex justify-content-between align-items-center gap-2">
          <span>{{ identity.edition.toUpperCase() }}：{{ identity.username }}</span>
          <button type="button" class="btn btn-sm btn-outline-danger" :disabled="busy"
            @click="ask('minecraft', identity.id, `${identity.username} の登録を解除しますか？`)">解除</button>
        </li>
      </ul>
      <form class="row g-2 align-items-end mb-4" @submit.prevent="addMinecraft">
        <div class="col-auto"><label for="new-minecraft-edition" class="form-label">版</label>
          <select id="new-minecraft-edition" v-model="edition" class="form-select"><option value="je">JE</option><option value="be">BE</option></select></div>
        <div class="col"><label for="new-minecraft-name" class="form-label">Minecraft名</label>
          <input id="new-minecraft-name" v-model="minecraftName" class="form-control" maxlength="32" required :disabled="busy" /></div>
        <div class="col-auto"><button type="submit" class="btn btn-outline-primary" :disabled="busy || !minecraftName.trim()">追加</button></div>
      </form>
      <div class="d-flex gap-2 flex-wrap mt-4">
        <NuxtLink to="/admin/accounts" class="btn btn-outline-secondary">一覧へ戻る</NuxtLink>
        <NuxtLink :to="`/admin/accounts/merge?source=${account.id}`" class="btn btn-outline-warning" :aria-disabled="account.is_protected">統合元として選択</NuxtLink>
        <button type="button" class="btn btn-danger" :disabled="busy || account.is_protected"
          @click="ask('delete', account.id, `アカウント「${account.name}」を完全に削除します。取り消せません。続行しますか？`)">削除</button>
      </div>
      <p v-if="account.is_protected" class="small text-body-secondary mt-2">初期管理者のアカウント削除と統合元への指定はできません。</p>
    </template>
    <UiConfirmDialog :open="!!decision" :title="decision?.title ?? ''" :message="decision?.message ?? ''"
      :confirm-label="decision?.kind === 'delete' ? '削除する' : '実行する'"
      :danger="decision?.kind !== 'role'" :busy="busy" @confirm="execute" @cancel="cancelDecision" />
  </section>
</template>

<script setup lang="ts">
import type { AccountRecord } from '../../../../composables/useAccountApi'
import { accountError } from '../../../../composables/useAccountApi'

type Decision = { kind: 'role' | 'delete' | 'discord' | 'minecraft'; value: string; title: string; message: string }
const route = useRoute()
const auth = useAccountSession()
const { get, mutate } = useAccountApi()
const id = computed(() => String(route.params.id))
const account = ref<AccountRecord | null>(null), name = ref(''), discordId = ref(''), minecraftName = ref('')
const edition = ref<'je' | 'be'>('je')
const loading = ref(true), busy = ref(false), error = ref(''), message = ref('')
const decision = ref<Decision | null>(null)
// The server independently enforces the protected identity constraint.
function protectedDiscord(discord: string) { return account.value?.is_protected && account.value.discord_profiles.length <= 1 && !!discord }
async function load() { account.value = await get<AccountRecord>(`/admin/accounts/${id.value}`); name.value = account.value.name }
async function run(action: () => Promise<AccountRecord>, success: string) {
  if (busy.value) return
  busy.value = true; error.value = ''; message.value = ''
  try { account.value = await action(); name.value = account.value.name; message.value = success; await auth.refresh() }
  catch (issue) { error.value = accountError(issue) }
  finally { busy.value = false }
}
function saveName() { void run(() => mutate<AccountRecord>(`/admin/accounts/${id.value}/name`, 'PATCH', { name: name.value }), 'アカウント名を保存しました。') }
async function addDiscord() {
  await run(() => mutate<AccountRecord>(`/admin/accounts/${id.value}/discord`, 'POST', { discord_id: discordId.value }), 'Discord IDを追加しました。')
  if (!error.value) discordId.value = ''
}
async function addMinecraft() {
  await run(() => mutate<AccountRecord>(`/admin/accounts/${id.value}/minecraft`, 'POST', { edition: edition.value, username: minecraftName.value }), 'Minecraft名を追加しました。')
  if (!error.value) minecraftName.value = ''
}
function ask(kind: Decision['kind'], value: string, text: string) { decision.value = { kind, value, title: '操作の確認', message: text } }
function askRole(event: Event) {
  const checkbox = event.target as HTMLInputElement
  if (!account.value || account.value.is_protected) { checkbox.checked = !!account.value?.is_admin; return }
  checkbox.checked = account.value.is_admin
  ask('role', String(!account.value.is_admin), `「${account.value.name}」の管理者権限を${account.value.is_admin ? '解除' : '付与'}しますか？`)
}
function cancelDecision() { if (!busy.value) decision.value = null }
async function execute() {
  const selected = decision.value
  if (!selected || busy.value) return
  busy.value = true; error.value = ''; message.value = ''
  try {
    if (selected.kind === 'delete') {
      await mutate<AccountRecord[]>(`/admin/accounts/${id.value}`, 'DELETE')
      await auth.refresh()
      decision.value = null
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
    name.value = account.value.name
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
