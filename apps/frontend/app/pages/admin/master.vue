<template>
  <section aria-labelledby="master-maintenance-heading">
    <UiPageTitle id="master-maintenance-heading" title="マスタメンテ" />
    <p v-if="!loaded" role="status">管理者権限を確認しています…</p>
    <div v-else-if="!isAdmin" class="alert alert-warning" role="alert">
      マスタメンテには管理者権限が必要です。<NuxtLink to="/login">ログイン</NuxtLink>
    </div>
    <nav v-else aria-label="マスタメンテ一覧" class="d-grid gap-3">
      <UiCardLink to="/admin/accounts">アカウント管理</UiCardLink>
    </nav>
  </section>
</template>

<script setup lang="ts">
const { isAdmin, loaded, refresh } = useAccountSession()
onMounted(() => { void refresh() })
</script>
