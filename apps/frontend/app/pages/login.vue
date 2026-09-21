<template>
  <section>
    <UiPageTitle title="ログイン" />
    <p v-if="authenticated">ログイン済みです。</p>
    <NuxtLink v-if="authenticated" to="/account" class="btn btn-primary">アカウントを見る</NuxtLink>
    <template v-else>
      <p>Discordアカウントを使用してログインします。初回ログイン時はアカウントが作成されます。</p>
      <a class="btn btn-primary" :href="`${apiBase}/auth/discord`">Discordでログイン</a>
    </template>
  </section>
</template>

<script setup lang="ts">
const { authenticated, refresh } = useAccountSession()
const { public: { apiBase } } = useRuntimeConfig()
onMounted(() => { void refresh() })
</script>
