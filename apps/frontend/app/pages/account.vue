<template>
  <section>
    <UiPageTitle title="アカウント" />
    <p v-if="!loaded || loading" role="status">アカウントを確認しています…</p>
    <template v-else-if="authenticated && profile">
      <p v-if="error" class="alert alert-danger" role="alert">{{ error }}</p>
      <p v-if="message" class="alert alert-success" role="status">{{ message }}</p>
      <div class="mb-4">
        <input id="account-name" class="form-control" :value="profile.name" placeholder="アカウント名（他のアカウントと重複可）" aria-label="アカウント名" readonly />
        <p class="small text-body-secondary mt-1 mb-0">名前は連携済みのDiscord名からのみ反映できます。</p>
      </div>
      <p class="small text-body-secondary text-break">アカウントID：{{ profile.id }}</p>
      <p>権限：{{ isAdmin ? '管理者' : '一般ユーザー' }}</p>
      <h2 class="h4 mt-4">Discordアカウント</h2>
      <p class="text-body-secondary small">Discord名は各IDでログインしたときに自動更新されます。「反映」は現在ログイン中のDiscord IDのみ更新できます。</p>
      <div v-for="identity in profile.discord_profiles" :key="identity.discord_id" class="border rounded p-3 mb-2">
        <div class="fw-semibold">{{ identity.display_name || identity.username || identity.discord_id }}</div>
        <div class="small text-body-secondary">ユーザー名：{{ identity.username || '未取得' }}</div>
        <div class="small text-body-secondary text-break">Discord ID：{{ identity.discord_id }}</div>
        <button type="button" class="btn btn-sm btn-primary mt-2" :disabled="busy || !hasDiscordName(identity)"
          @click="adoptName(identity.discord_id)">このDiscord名をアカウント名へ反映</button>
      </div>
      <a :href="`${apiBase}/auth/discord/refresh`" class="btn btn-secondary mt-2">ログイン中のDiscord名を再取得</a>
      <h2 class="h4 mt-4">Minecraftアカウント（自己申告）</h2>
      <p class="small text-body-secondary">Minecraftでの本人確認は行っていません。JE・BEとも複数登録できます。</p>
      <ul v-if="profile.minecraft_ids.length" class="list-group mb-3">
        <li v-for="identity in profile.minecraft_ids" :key="identity.id" class="list-group-item d-flex gap-2 justify-content-between align-items-center">
          <span>{{ identity.edition.toUpperCase() }}：{{ identity.username }}</span>
          <button type="button" class="btn btn-sm btn-outline-danger" :disabled="busy" @click="removeMinecraft(identity.id)">解除</button>
        </li>
      </ul>
      <form class="row g-2 align-items-end mb-4" @submit.prevent="addMinecraft">
        <div class="col-auto">
          <select id="minecraft-edition" v-model="edition" class="form-select" aria-label="版" :disabled="busy"><option value="je">JE</option><option value="be">BE</option></select>
        </div>
        <div class="col">
          <input id="minecraft-name" v-model="minecraftName" class="form-control" maxlength="32" required placeholder="Minecraft名" aria-label="Minecraft名" :disabled="busy" />
        </div>
        <div class="col-auto"><button type="submit" class="btn btn-primary" :disabled="busy || !minecraftName.trim()">追加</button></div>
      </form>
      <div class="d-flex flex-wrap gap-2">
        <NuxtLink v-if="isAdmin" to="/admin/notices" class="btn btn-outline-primary">お知らせ管理</NuxtLink>
        <NuxtLink v-if="isAdmin" to="/admin/accounts" class="btn btn-outline-secondary">アカウント管理</NuxtLink>
        <button type="button" class="btn btn-outline-danger" :disabled="busy" @click="signOut">ログアウト</button>
      </div>
    </template>
    <template v-else><p>ログインしていません。</p><NuxtLink to="/login" class="btn btn-primary">ログインする</NuxtLink></template>
    <p v-if="!profile && error" role="alert" class="alert alert-danger mt-3">{{ error }}</p>
  </section>
</template>

<script setup lang="ts">
import type { AccountRecord, DiscordIdentity } from '../composables/useAccountApi'
import { accountError } from '../composables/useAccountApi'

const { public: { apiBase } } = useRuntimeConfig()
const { authenticated, isAdmin, loaded, refresh, logout } = useAccountSession()
const { get, mutate } = useAccountApi()
const profile = ref<AccountRecord | null>(null)
const minecraftName = ref(''), edition = ref<'je' | 'be'>('je')
const busy = ref(false), loading = ref(true), error = ref(''), message = ref('')
const hasDiscordName = (identity: DiscordIdentity) => [identity.display_name, identity.username].some(value => !!value && value !== identity.discord_id)
async function load() { profile.value = await get<AccountRecord>('/accounts/me') }
async function run(action: () => Promise<AccountRecord>, success: string) {
  if (busy.value) return
  busy.value = true; error.value = ''; message.value = ''
  try { profile.value = await action(); message.value = success }
  catch (issue) { error.value = accountError(issue) }
  finally { busy.value = false }
}
function adoptName(discordId: string) { void run(() => mutate<AccountRecord>('/accounts/me/adopt-discord-name', 'POST', { discord_id: discordId }), 'アカウント名を更新しました。') }
async function addMinecraft() {
  await run(() => mutate<AccountRecord>('/accounts/me/minecraft', 'POST', { edition: edition.value, username: minecraftName.value }), 'Minecraft名を追加しました。')
  if (!error.value) minecraftName.value = ''
}
function removeMinecraft(id: string) { void run(() => mutate<AccountRecord>(`/accounts/me/minecraft/${id}`, 'DELETE'), 'Minecraft名を解除しました。') }
async function signOut() {
  busy.value = true; error.value = ''
  try { await logout(); await navigateTo('/') }
  catch (issue) { error.value = accountError(issue) }
  finally { busy.value = false }
}
onMounted(async () => {
  try { await refresh(); if (authenticated.value) await load() }
  catch (issue) { error.value = accountError(issue) }
  finally { loading.value = false }
})
</script>
