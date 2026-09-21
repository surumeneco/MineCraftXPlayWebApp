<template>
  <section>
    <UiPageTitle title="アカウント管理" />
    <p v-if="loading" role="status">アカウントを読み込んでいます…</p>
    <div v-else-if="!isAdmin" class="alert alert-warning" role="alert">アカウント管理には管理者権限が必要です。<NuxtLink to="/login">ログイン</NuxtLink></div>
    <template v-else>
      <p v-if="error" class="alert alert-danger" role="alert">{{ error }}</p>
      <div class="d-flex justify-content-end mb-3">
        <button type="button" class="btn btn-primary d-inline-flex align-items-center justify-content-center" :disabled="busy" aria-label="アカウント一覧を更新" title="一覧更新" @click="loadAccounts">
          <UiBootstrapIcon name="arrow-clockwise" />
        </button>
      </div>
      <div class="table-responsive">
        <table class="table table-striped align-middle">
          <thead><tr><th scope="col">アカウント名 / ID</th><th scope="col">Discord名 / ID</th><th scope="col">Minecraft名</th><th scope="col">権限</th><th scope="col">操作</th></tr></thead>
          <tbody>
            <tr v-for="entry in accounts" :key="entry.id">
              <td><strong>{{ entry.name }}</strong><small class="d-block text-body-secondary text-break">{{ entry.id }}</small></td>
              <td><span v-for="identity in entry.discord_profiles" :key="identity.discord_id" class="d-block mb-1">
                {{ identity.display_name || identity.username || '未取得' }}
                <small class="d-block text-body-secondary text-break">{{ identity.discord_id }}</small>
              </span></td>
              <td><span v-for="identity in entry.minecraft_ids" :key="identity.id" class="d-block small">{{ identity.edition.toUpperCase() }}：{{ identity.username }}</span></td>
              <td>{{ entry.is_admin ? '管理者' : '一般' }}<small v-if="entry.is_protected" class="d-block text-body-secondary">初期管理者</small></td>
              <td><NuxtLink :to="`/admin/accounts/${entry.id}/edit`" class="btn btn-sm btn-primary">編集</NuxtLink></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="!accounts.length">登録済みのアカウントはありません。</p>
    </template>
  </section>
</template>

<script setup lang="ts">
import type { AccountRecord } from '../../../composables/useAccountApi'
import { accountError } from '../../../composables/useAccountApi'
const auth = useAccountSession()
const isAdmin = auth.isAdmin
const { get } = useAccountApi()
const loading = ref(true), busy = ref(false), error = ref('')
const accounts = ref<AccountRecord[]>([])
async function loadAccounts() {
  busy.value = true; error.value = ''
  try { accounts.value = await get<AccountRecord[]>('/admin/accounts') }
  catch (issue) { error.value = accountError(issue) }
  finally { busy.value = false }
}
onMounted(async () => {
  try { await auth.refresh(); if (isAdmin.value) await loadAccounts() }
  catch (issue) { error.value = accountError(issue) }
  finally { loading.value = false }
})
</script>
