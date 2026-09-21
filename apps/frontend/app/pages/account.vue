<template>
  <section>
    <UiPageTitle title="アカウント" />
    <p v-if="!loaded" role="status">アカウントを確認しています…</p>
    <template v-else-if="authenticated">
      <p>ログイン中です。</p>
      <p class="small text-body-secondary text-break">アカウントID：{{ session.account_id }}</p>
      <p>権限：{{ isAdmin ? '管理者' : '一般ユーザー' }}</p>
      <div class="d-flex flex-wrap gap-2">
        <NuxtLink v-if="isAdmin" to="/admin/notices" class="btn btn-outline-primary">お知らせ管理</NuxtLink>
        <NuxtLink v-if="isAdmin" to="/admin/accounts" class="btn btn-outline-secondary">アカウント管理</NuxtLink>
        <button type="button" class="btn btn-outline-danger" :disabled="busy" @click="signOut">ログアウト</button>
      </div>
    </template>
    <template v-else>
      <p>ログインしていません。</p>
      <NuxtLink to="/login" class="btn btn-primary">ログインする</NuxtLink>
    </template>
    <p v-if="error" role="alert" class="alert alert-danger mt-3">{{ error }}</p>
  </section>
</template>

<script setup lang="ts">
const { session, authenticated, isAdmin, loaded, refresh, logout } = useAccountSession()
const busy = ref(false), error = ref('')
onMounted(() => { void refresh() })
async function signOut() {
  busy.value = true; error.value = ''
  try { await logout(); await navigateTo('/') }
  catch { error.value = 'ログアウトできませんでした。再度お試しください。' }
  finally { busy.value = false }
}
</script>
